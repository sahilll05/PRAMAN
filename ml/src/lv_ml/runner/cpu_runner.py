"""PRAMAN Reference Deterministic CPU Runner (spec §7.6, T1.3, T2.6).

Executes inference strictly on CPU using ONNX Runtime (fp32) and OpenCLIP (CPU).
Integrates Phase 2 Temperature Scaling, Mahalanobis OOD Gating, Split Conformal
Prediction, and Model A + Model B Ensemble into the canonical verdict pipeline.
Produces canonical evidence.json and verdict.json bundles validating against
spec/schemas/evidence.schema.json and spec/schemas/verdict.schema.json.
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import jsonschema
import numpy as np
import onnxruntime as ort
import open_clip
import PIL
import torch
from PIL import Image

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import TemperatureScaler
from lv_ml.fingerprint.phash import compute_phash


class ReferenceRunner:
    """Canonical CPU ONNX Reference Runner for PRAMAN Verdicts."""

    def __init__(
        self,
        onnx_model_path: str | Path | None = None,
        model_b_onnx_path: str | Path | None = None,
        calibration_dir: str | Path | None = None,
        model_name: str = "pramana-ensemble",
        model_version: str = "0.1.0",
        clip_model_name: str = "ViT-B-32",
        clip_pretrained: str = "laion2b_s34b_b79k",
        spec_version: str = "0.1.0-draft",
    ) -> None:
        self.repo_root = Path(__file__).resolve().parents[4]
        default_models_dir = self.repo_root / "dataset" / "models"

        if onnx_model_path is None:
            self.onnx_model_path = default_models_dir / "model_a.onnx"
            if model_b_onnx_path is None and (default_models_dir / "model_b.onnx").exists():
                self.model_b_onnx_path: Path | None = default_models_dir / "model_b.onnx"
            elif model_b_onnx_path is not None:
                self.model_b_onnx_path = Path(model_b_onnx_path)
            else:
                self.model_b_onnx_path = None
        else:
            self.onnx_model_path = Path(onnx_model_path)
            self.model_b_onnx_path = (
                Path(model_b_onnx_path) if model_b_onnx_path is not None else None
            )

        self.model_name = model_name
        self.model_version = model_version
        self.clip_model_name = clip_model_name
        self.clip_pretrained = clip_pretrained
        self.spec_version = spec_version

        # Verify primary ONNX model
        if not self.onnx_model_path.exists():
            raise FileNotFoundError(f"ONNX model not found: {self.onnx_model_path}")

        # Compute canonical modelHash
        if self.model_b_onnx_path and self.model_b_onnx_path.exists():
            hasher = hashlib.sha256()
            hasher.update(self.onnx_model_path.read_bytes())
            hasher.update(self.model_b_onnx_path.read_bytes())
            self.model_hash = hasher.hexdigest()
        else:
            self.model_hash = hashlib.sha256(self.onnx_model_path.read_bytes()).hexdigest()

        # Load schemas for validation
        schemas_dir = self.repo_root / "spec" / "schemas"
        with open(schemas_dir / "verdict.schema.json", encoding="utf-8") as f:
            self.verdict_schema = json.load(f)
        with open(schemas_dir / "evidence.schema.json", encoding="utf-8") as f:
            self.evidence_schema = json.load(f)

        # Preprocessing hash: pinned parameters + pinned libraries
        preproc_str = f"clip:{clip_model_name}:{clip_pretrained}:224x224:bicubic:RGB:norm"
        self.preproc_hash = hashlib.sha256(preproc_str.encode("utf-8")).hexdigest()

        # ONNX Runtime CPU session for Model A
        session_options = ort.SessionOptions()
        session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session_options.intra_op_num_threads = 1
        session_options.inter_op_num_threads = 1
        self.session_a = ort.InferenceSession(
            str(self.onnx_model_path),
            sess_options=session_options,
            providers=["CPUExecutionProvider"],
        )
        self.input_name_a = self.session_a.get_inputs()[0].name

        # ONNX Runtime CPU session for Model B (if available)
        if self.model_b_onnx_path and self.model_b_onnx_path.exists():
            self.session_b: ort.InferenceSession | None = ort.InferenceSession(
                str(self.model_b_onnx_path),
                sess_options=session_options,
                providers=["CPUExecutionProvider"],
            )
            self.input_name_b: str | None = self.session_b.get_inputs()[0].name
        else:
            self.session_b = None
            self.input_name_b = None

        # Load calibration and gating modules if present
        cal_dir = Path(calibration_dir) if calibration_dir else default_models_dir
        self.scaler_a = (
            TemperatureScaler.load(cal_dir / "temperature_model_a.json")
            if (cal_dir / "temperature_model_a.json").exists()
            else TemperatureScaler(1.0)
        )
        self.scaler_b = (
            TemperatureScaler.load(cal_dir / "temperature_model_b.json")
            if (cal_dir / "temperature_model_b.json").exists()
            else TemperatureScaler(1.0)
        )
        self.conformal_a = (
            ConformalPredictor.load(cal_dir / "conformal_model_a.json")
            if (cal_dir / "conformal_model_a.json").exists()
            else ConformalPredictor(alpha=0.10, q_hat=0.90)
        )
        self.conformal_b = (
            ConformalPredictor.load(cal_dir / "conformal_model_b.json")
            if (cal_dir / "conformal_model_b.json").exists()
            else ConformalPredictor(alpha=0.10, q_hat=0.90)
        )
        self.ood_gate = (
            MahalanobisOODGate.load(cal_dir / "ood_gate.npz")
            if (cal_dir / "ood_gate.npz").exists()
            else None
        )

        # CLIP CPU visual encoder
        self.clip_model, _, self.clip_preprocess = open_clip.create_model_and_transforms(
            clip_model_name,
            pretrained=clip_pretrained,
            device="cpu",
            precision="fp32",
        )
        self.clip_model.eval()

    def predict_image(
        self,
        image_path: str | Path,
        attester_address: str = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
        expiration_ttl_sec: int = 180 * 86400,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Run CPU reference pipeline on an image file, returning validated (verdict, evidence)."""
        img_path = Path(image_path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found at {img_path}")

        file_bytes = img_path.read_bytes()
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        file_size = len(file_bytes)

        # Open PIL image
        pil_img = Image.open(img_path)
        mime = Image.MIME.get(pil_img.format, "image/jpeg") if pil_img.format else "image/jpeg"
        rgb_img = pil_img.convert("RGB")

        # Compute pHash per spec §4
        phash_val = compute_phash(rgb_img)
        phash_str = phash_val if isinstance(phash_val, str) else hex(phash_val)[2:]

        # Watermark ID (0 if absent)
        wm_id = "0"

        # Preprocess and extract CLIP embedding (CPU fp32)
        tensor_img = self.clip_preprocess(rgb_img).unsqueeze(0)
        with torch.no_grad():
            feat = self.clip_model.encode_image(tensor_img)
            feat = feat / feat.norm(dim=-1, keepdim=True)
            feat_np = feat.numpy().astype(np.float32)  # shape (1, 512)

        # Run Model A ONNX probe on CPU
        onnx_inputs_a = {self.input_name_a: feat_np}
        logits_a = self.session_a.run(None, onnx_inputs_a)[0]  # shape (1, 2)

        # Run Model B ONNX probe on CPU if present
        if self.session_b is not None and self.input_name_b is not None:
            onnx_inputs_b = {self.input_name_b: feat_np}
            logits_b = self.session_b.run(None, onnx_inputs_b)[0]
        else:
            logits_b = logits_a.copy()

        # Extract effective binary logit difference
        raw_prob_a = self.scaler_a.predict_proba(logits_a)[0]
        raw_prob_b = self.scaler_b.predict_proba(logits_b)[0]
        p_fake = float((raw_prob_a + raw_prob_b) / 2.0)
        p_fake_bps = int(np.clip(round(p_fake * 10000), 0, 10000))

        # OOD Gating
        if self.ood_gate is not None:
            ood_score, is_ood = self.ood_gate.score_and_gate(feat_np[0])
            ood_threshold = self.ood_gate.threshold
            ood_percentile = self.ood_gate.percentile
        else:
            ood_score, is_ood = 0.0, False
            ood_threshold = 100.0
            ood_percentile = 99.0

        # Conformal Prediction Sets
        set_a = self.conformal_a.predict_set(raw_prob_a)[0]
        set_b = self.conformal_b.predict_set(raw_prob_b)[0]

        # Spec s7 verdict decision logic:
        # 0 = ABSTAIN, 1 = LIKELY_AUTHENTIC, 2 = LIKELY_SYNTHETIC
        reasons: list[str] = []
        if is_ood:
            reasons.append("OOD_DISTANCE_EXCEEDED")
        if len(set_a) != 1 or len(set_b) != 1:
            reasons.append("CONFORMAL_UNCERTAINTY")

        class_a = set_a[0] if len(set_a) == 1 else (1 if raw_prob_a >= 0.5 else 0)
        class_b = set_b[0] if len(set_b) == 1 else (1 if raw_prob_b >= 0.5 else 0)
        if class_a != class_b:
            reasons.append("ENSEMBLE_DISAGREEMENT")

        if reasons:
            verdict = 0  # ABSTAIN
        else:
            verdict = 2 if class_a == 1 else 1

        # Current timestamp
        created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        now_ts = int(time.time())
        expiration_time = now_ts + expiration_ttl_sec

        # Construct canonical evidence bundle
        # Map conformal classes {0, 1} to verdict classes {1, 2} for evidence schema compatibility
        pred_set_mapped = [2 if c == 1 else 1 for c in set_a]

        evidence: dict[str, Any] = {
            "specVersion": self.spec_version,
            "createdAt": created_at,
            "attester": attester_address,
            "fileMeta": {
                "sha256": sha256_hash,
                "size": file_size,
                "mime": mime,
            },
            "fingerprints": {
                "sha256Hash": sha256_hash,
                "pHash": phash_str,
                "wmId": wm_id,
            },
            "model": {
                "hash": self.model_hash,
                "uri": f"https://models.pramana.example/{self.model_name}-v{self.model_version}.onnx",
                "name": self.model_name,
                "version": self.model_version,
            },
            "preprocHash": self.preproc_hash,
            "libs": {
                "python": (
                    f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
                ),
                "onnxruntime": ort.__version__,
                "pillow": PIL.__version__,
                "numpy": np.__version__,
            },
            "perFrame": [
                {
                    "idx": 0,
                    "pFake": round(p_fake, 4),
                    "oodScore": round(ood_score, 4),
                    "predSet": pred_set_mapped,
                }
            ],
            "aggregate": {
                "rule": "pramana_ensemble_v1",
                "pFake": round(p_fake, 4),
                "verdict": verdict,
            },
            "calibration": {
                "T": round(self.scaler_a.temperature, 4),
                "alpha": self.conformal_a.alpha,
                "qhat": round(self.conformal_a.q_hat, 4),
                "calSetId": "balanced_cal_v1",
            },
            "oodGate": {
                "metric": "mahalanobis",
                "threshold": round(ood_threshold, 4),
                "percentile": ood_percentile,
            },
            "runtime": {
                "cpu": platform.processor() or "CPU",
                "os": f"{platform.system()} {platform.release()}",
            },
            "reproduceCommand": (
                f"python -m lv_ml.runner.cpu_runner --image {img_path.name} "
                f"--model {self.onnx_model_path.name}"
            ),
        }

        # Canonicalize evidence JSON: sorted keys, UTF-8, no whitespace
        canonical_evidence_bytes = json.dumps(
            evidence, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        evidence_hash = hashlib.sha256(canonical_evidence_bytes).hexdigest()

        # Construct verdict payload
        verdict_obj: dict[str, Any] = {
            "specVersion": self.spec_version,
            "evidenceHash": evidence_hash,
            "onChain": {
                "sha256Hash": sha256_hash,
                "pHash": phash_str,
                "wmId": wm_id,
                "modelHash": self.model_hash,
                "preprocHash": self.preproc_hash,
                "pFakeBps": p_fake_bps,
                "verdict": verdict,
                "evidenceHash": evidence_hash,
                "expirationTime": expiration_time,
            },
        }

        # Validate against JSON schemas
        jsonschema.validate(instance=evidence, schema=self.evidence_schema)
        jsonschema.validate(instance=verdict_obj, schema=self.verdict_schema)

        return verdict_obj, evidence
