"""PRAMANA Reference Deterministic CPU Runner (spec §7.6, T1.3).

Executes inference strictly on CPU using ONNX Runtime (fp32) and OpenCLIP (CPU).
Produces canonical evidence.json and verdict.json bundles validating against
spec/schemas/evidence.schema.json and spec/schemas/verdict.schema.json.
"""

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

from lv_ml.fingerprint.phash import compute_phash


class ReferenceRunner:
    """Canonical CPU ONNX Reference Runner for PRAMANA Verdicts."""

    def __init__(
        self,
        onnx_model_path: str | Path,
        model_name: str = "clip-linear-probe",
        model_version: str = "0.1.0",
        clip_model_name: str = "ViT-B-32",
        clip_pretrained: str = "laion2b_s34b_b79k",
        spec_version: str = "0.1.0-draft",
    ) -> None:
        self.onnx_model_path = Path(onnx_model_path)
        self.model_name = model_name
        self.model_version = model_version
        self.clip_model_name = clip_model_name
        self.clip_pretrained = clip_pretrained
        self.spec_version = spec_version

        # Compute canonical modelHash from ONNX bytes
        if not self.onnx_model_path.exists():
            raise FileNotFoundError(f"ONNX model not found: {self.onnx_model_path}")
        onnx_bytes = self.onnx_model_path.read_bytes()
        self.model_hash = hashlib.sha256(onnx_bytes).hexdigest()

        # Load schemas for validation
        self.repo_root = Path(__file__).resolve().parents[4]
        schemas_dir = self.repo_root / "spec" / "schemas"
        with open(schemas_dir / "verdict.schema.json", encoding="utf-8") as f:
            self.verdict_schema = json.load(f)
        with open(schemas_dir / "evidence.schema.json", encoding="utf-8") as f:
            self.evidence_schema = json.load(f)

        # Preprocessing hash: pinned parameters + pinned libraries
        preproc_str = f"clip:{clip_model_name}:{clip_pretrained}:224x224:bicubic:RGB:norm"
        self.preproc_hash = hashlib.sha256(preproc_str.encode("utf-8")).hexdigest()

        # ONNX Runtime CPU session
        session_options = ort.SessionOptions()
        session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session_options.intra_op_num_threads = 1
        session_options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(
            str(self.onnx_model_path),
            sess_options=session_options,
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name

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
            feat_np = feat.numpy().astype(np.float32)

        # Run ONNX probe on CPU
        onnx_inputs = {self.input_name: feat_np}
        logits = self.session.run(None, onnx_inputs)[0]  # shape (1, 2)

        # Compute probabilities via softmax
        exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
        p_fake = float(probs[0, 1])
        p_fake_bps = int(round(p_fake * 10000))
        p_fake_bps = max(0, min(10000, p_fake_bps))

        # Verdict class: 0=ABSTAIN, 1=LIKELY_AUTHENTIC, 2=LIKELY_SYNTHETIC
        verdict = 2 if p_fake >= 0.5 else 1

        # Current timestamp
        created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        now_ts = int(time.time())
        expiration_time = now_ts + expiration_ttl_sec

        # Construct canonical evidence bundle
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
                    "oodScore": 0.0,
                    "predSet": [verdict],
                }
            ],
            "aggregate": {
                "rule": "clip_probe_v1",
                "pFake": round(p_fake, 4),
                "verdict": verdict,
            },
            "calibration": {
                "T": 1.0,
                "alpha": 0.1,
                "qhat": 0.9,
                "calSetId": "balanced_cal_v1",
            },
            "oodGate": {
                "metric": "mahalanobis",
                "threshold": 100.0,
                "percentile": 99.0,
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
