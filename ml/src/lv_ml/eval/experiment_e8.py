"""
Experiment E8: Perishability & Temporal Shift Benchmark (Task T7.4).

Evaluates:
(a) OpenFake temporal split: performance on older generators (<= 2024-01) vs newer generators (> 2024-01).
(b) Verdict flip rate across detector versions (Model A vs Model B) on the same test samples.

Supports Claim C6 in sahil/claims.md:
"Verdicts materially change across detector versions and across generator generations (perishability is real);
evidenced by OpenFake temporal split and model v1 vs v2 flip rate"
"""

from __future__ import annotations

import io
import json
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
from PIL import Image

from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.models.probe import ClipLinearProbe, MlpProbe, compute_metrics


def extract_pil(img_val: Any) -> Image.Image:
    if isinstance(img_val, dict) and "bytes" in img_val:
        return Image.open(io.BytesIO(img_val["bytes"])).convert("RGB")
    elif isinstance(img_val, (bytes, bytearray)):
        return Image.open(io.BytesIO(img_val)).convert("RGB")
    elif hasattr(img_val, "convert"):
        return img_val.convert("RGB")
    else:
        raise ValueError(f"Unknown image value format: {type(img_val)}")


def get_git_sha(repo_root: Path) -> str:
    git_head = repo_root / ".git" / "HEAD"
    if not git_head.exists():
        return "UNKNOWN"
    content = git_head.read_text().strip()
    if content.startswith("ref: "):
        ref_path = repo_root / ".git" / content[5:]
        return ref_path.read_text().strip() if ref_path.exists() else "UNKNOWN"
    return content


def write_env_txt(output_path: Path) -> None:
    env_str = (
        f"Platform: {platform.platform()}\n"
        f"Python: {platform.python_version()}\n"
        f"PyTorch: {torch.__version__}\n"
        f"CUDA Available: {torch.cuda.is_available()}\n"
        f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}\n"
    )
    output_path.write_text(env_str)


class ExperimentE8Runner:
    def __init__(self, repo_root: str | Path, device: str = "cuda") -> None:
        self.root = Path(repo_root)
        self.device = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
        self.git_sha = get_git_sha(self.root)

        self.models_dir = self.root / "dataset" / "models"
        self.results_dir = self.root / "results" / "E8"
        self.results_dir.mkdir(parents=True, exist_ok=True)

        print(f"[E8] Initializing models on {self.device}...")
        self.model_a = ClipLinearProbe(in_features=512, num_classes=2)
        self.model_a.load_state_dict(
            torch.load(self.models_dir / "model_a.pt", map_location=self.device)
        )
        self.model_a.to(self.device).eval()

        self.model_b = MlpProbe(in_features=512, hidden_dim=256, num_classes=2)
        self.model_b.load_state_dict(
            torch.load(self.models_dir / "model_b.pt", map_location=self.device)
        )
        self.model_b.to(self.device).eval()

        self.extractor = ClipEmbeddingExtractor(device=self.device)

    def run(self) -> Dict[str, Any]:
        print("[E8] Loading OpenFake core parquet shards...")
        p0 = self.root / "dataset" / "openfake" / "core_train_0.parquet"
        p1 = self.root / "dataset" / "openfake" / "core_train_1.parquet"
        df = pd.concat([pd.read_parquet(p0), pd.read_parquet(p1)], ignore_index=True)

        date_col = "release_date" if "release_date" in df.columns else "realease_date"

        print(f"[E8] Total OpenFake core samples: {len(df)}")

        # Extract features
        feats = []
        labels = []
        models = []
        dates = []

        print("[E8] Extracting CLIP features...")
        with torch.inference_mode():
            for _, row in df.iterrows():
                img = extract_pil(row["image"])
                t = self.extractor.preprocess(img).unsqueeze(0).to(self.device)
                if self.device == "cuda":
                    t = t.half()
                f = self.extractor.model.encode_image(t)
                f = f / f.norm(dim=-1, keepdim=True)
                feats.append(f.cpu().float().numpy()[0])
                labels.append(1 if row["label"] == "fake" else 0)
                models.append(row["model"])
                dates.append(str(row[date_col]))

        X = np.array(feats, dtype=np.float32)
        y = np.array(labels, dtype=np.int64)

        # Temporal partition:
        # Cutoff: 2024-01 (older <= 2024-01, newer > 2024-01)
        older_indices = []
        newer_indices = []

        for idx, (lbl, dt) in enumerate(zip(labels, dates)):
            if lbl == 0:
                # Real images serve as reference for both temporal splits
                older_indices.append(idx)
                newer_indices.append(idx)
            else:
                if dt <= "2024-01":
                    older_indices.append(idx)
                else:
                    newer_indices.append(idx)

        older_indices = np.array(older_indices)
        newer_indices = np.array(newer_indices)

        print(f"[E8] Older split (<=2024-01): {len(older_indices)} samples (Fake: {np.sum(y[older_indices]==1)}, Real: {np.sum(y[older_indices]==0)})")
        print(f"[E8] Newer split (>2024-01): {len(newer_indices)} samples (Fake: {np.sum(y[newer_indices]==1)}, Real: {np.sum(y[newer_indices]==0)})")

        # Evaluate Model A & B on Older vs Newer splits
        metrics_older_a = self._eval_model(self.model_a, X[older_indices], y[older_indices])
        metrics_older_b = self._eval_model(self.model_b, X[older_indices], y[older_indices])

        metrics_newer_a = self._eval_model(self.model_a, X[newer_indices], y[newer_indices])
        metrics_newer_b = self._eval_model(self.model_b, X[newer_indices], y[newer_indices])

        # Compute Flip Rate between Model A and Model B across ALL samples
        with torch.inference_mode():
            tX = torch.from_numpy(X).to(self.device)
            logits_a = self.model_a(tX)
            logits_b = self.model_b(tX)
            preds_a = torch.argmax(logits_a, dim=-1).cpu().numpy()
            preds_b = torch.argmax(logits_b, dim=-1).cpu().numpy()
            probs_a = torch.softmax(logits_a, dim=-1)[:, 1].cpu().numpy()
            probs_b = torch.softmax(logits_b, dim=-1)[:, 1].cpu().numpy()

        mismatches = np.sum(preds_a != preds_b)
        flip_rate = float(mismatches / len(X))
        prob_diffs = np.abs(probs_a - probs_b)
        mean_p_diff_bps = float(np.mean(prob_diffs) * 10000)
        max_p_diff_bps = float(np.max(prob_diffs) * 10000)

        # Breakdown flip rate by generator
        flip_by_gen: Dict[str, Any] = {}
        for m, pa, pb in zip(models, preds_a, preds_b):
            if m not in flip_by_gen:
                flip_by_gen[m] = {"total": 0, "flips": 0}
            flip_by_gen[m]["total"] += 1
            if pa != pb:
                flip_by_gen[m]["flips"] += 1

        for m, stats in flip_by_gen.items():
            stats["flip_rate"] = round(stats["flips"] / stats["total"], 4)

        report = {
            "experiment": "E8",
            "task": "T7.4",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "ComplexDataLab/OpenFake Core (temporal partition)",
            "n_total": len(X),
            "temporal_split": {
                "cutoff_date": "2024-01",
                "older_generators": {
                    "n_samples": int(len(older_indices)),
                    "n_fake": int(np.sum(y[older_indices] == 1)),
                    "n_real": int(np.sum(y[older_indices] == 0)),
                    "model_a": metrics_older_a,
                    "model_b": metrics_older_b,
                },
                "newer_generators": {
                    "n_samples": int(len(newer_indices)),
                    "n_fake": int(np.sum(y[newer_indices] == 1)),
                    "n_real": int(np.sum(y[newer_indices] == 0)),
                    "model_a": metrics_newer_a,
                    "model_b": metrics_newer_b,
                },
                "auc_drop_model_a": round(metrics_older_a["auc"] - metrics_newer_a["auc"], 4),
                "auc_drop_model_b": round(metrics_older_b["auc"] - metrics_newer_b["auc"], 4),
            },
            "flip_rate_analysis": {
                "total_comparisons": int(len(X)),
                "verdict_flips": int(mismatches),
                "flip_rate": round(flip_rate, 4),
                "flip_rate_pct": round(flip_rate * 100, 2),
                "mean_prob_diff_bps": round(mean_p_diff_bps, 1),
                "max_prob_diff_bps": round(max_p_diff_bps, 1),
                "per_generator": flip_by_gen,
            },
        }

        print("\n=== E8 Results Summary ===")
        print(f"Older Generators (<=2024-01) -> Model A AUC: {metrics_older_a['auc']}, Model B AUC: {metrics_older_b['auc']}")
        print(f"Newer Generators (>2024-01)  -> Model A AUC: {metrics_newer_a['auc']}, Model B AUC: {metrics_newer_b['auc']}")
        print(f"Temporal AUC Drop: Model A: {report['temporal_split']['auc_drop_model_a']}, Model B: {report['temporal_split']['auc_drop_model_b']}")
        print(f"Model A vs B Flip Rate: {report['flip_rate_analysis']['flip_rate_pct']}% ({mismatches}/{len(X)} samples)")

        (self.results_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (self.results_dir / "config.json").write_text(
            json.dumps({"temporal_cutoff": "2024-01", "models": ["model_a", "model_b"]}, indent=2)
        )
        (self.results_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(self.results_dir / "env.txt")

        return report

    def _eval_model(self, model: torch.nn.Module, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        with torch.inference_mode():
            tX = torch.from_numpy(X).to(self.device)
            logits = model(tX)
            probs = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()

        return compute_metrics(y, probs)
