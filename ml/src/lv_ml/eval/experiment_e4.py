"""Experiment E4: Calibration and Abstention Benchmark on Shifted Distributions.

Pre-registered in Evaluation Protocol:
- Calibrate on source-domain validation set (CommunityForensics-Small + COCO cal split).
- Evaluate on shifted datasets: OpenFake core (cross-dataset shift) and OpenFake reddit (in-the-wild shift).
- Metrics evaluated:
  1. Calibration metrics: ECE (15 equal-mass bins, 15 equal-width bins), Brier score, NLL before and after temperature scaling.
  2. Conformal empirical coverage vs nominal 1 - alpha = 0.90.
  3. Risk-coverage curves and selective accuracy at coverage levels: 50%, 80%, 95%, 100%.
  4. Natural operational operating point under the Unified Verdict Engine (T2.4).
- Pre-registered targets:
  - ECE <= 0.10 on at least one shifted dataset after calibration.
  - Selective accuracy at 80% coverage > accuracy at 100% coverage on shifted data.
"""

from __future__ import annotations

import io
import json
import time
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
import torch
from PIL import Image

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ensemble import UnifiedVerdictEngine
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import (
    TemperatureScaler,
    compute_calibration_metrics,
)
from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.models.probe import ClipLinearProbe, MlpProbe


def extract_pil_from_openfake(img_val: Any) -> Image.Image:
    """Extract RGB PIL Image from OpenFake row data."""
    if isinstance(img_val, dict) and "bytes" in img_val:
        return Image.open(io.BytesIO(img_val["bytes"])).convert("RGB")
    elif isinstance(img_val, (bytes, bytearray)):
        return Image.open(io.BytesIO(img_val)).convert("RGB")
    elif hasattr(img_val, "convert"):
        return cast(Image.Image, img_val.convert("RGB"))
    else:
        raise ValueError(f"Unknown image value format: {type(img_val)}")


def compute_risk_coverage(
    confidences: np.ndarray,
    predictions: np.ndarray,
    labels: np.ndarray,
    coverages: list[float] | None = None,
) -> dict[str, Any]:
    """Compute selective accuracy and risk across varying coverage percentiles."""
    if coverages is None:
        coverages = [1.0, 0.95, 0.90, 0.85, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30]

    n = len(labels)
    # Sort samples by confidence descending
    sorted_indices = np.argsort(-confidences)
    sorted_preds = predictions[sorted_indices]
    sorted_labels = labels[sorted_indices]

    results: dict[str, Any] = {}
    curve: list[dict[str, float]] = []

    for cov in coverages:
        k = max(1, int(round(cov * n)))
        retained_preds = sorted_preds[:k]
        retained_labels = sorted_labels[:k]
        acc = float(np.mean(retained_preds == retained_labels))
        risk = 1.0 - acc
        actual_cov = float(k / n)
        entry = {
            "target_coverage": cov,
            "actual_coverage": actual_cov,
            "k_samples": k,
            "selective_accuracy": acc,
            "selective_risk": risk,
        }
        curve.append(entry)
        results[f"coverage_{int(cov * 100)}"] = entry

    results["curve"] = curve
    return results


class ExperimentE4Runner:
    """Executes Experiment E4 on shifted datasets and generates calibration & risk-coverage metrics."""

    def __init__(self, repo_root: str | Path, device: str = "cuda") -> None:
        self.root = Path(repo_root)
        self.device = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
        self.models_dir = self.root / "dataset" / "models"
        self.emb_dir = self.root / "dataset" / "embeddings"
        self.results_dir = self.root / "results" / "E4"
        self.results_dir.mkdir(parents=True, exist_ok=True)

        # 1. Load models
        self.model_a = ClipLinearProbe(in_features=512, num_classes=2)
        self.model_a.load_state_dict(
            torch.load(self.models_dir / "model_a.pt", map_location=self.device, weights_only=True)
        )
        self.model_a.to(self.device)
        self.model_a.eval()

        self.model_b = MlpProbe(in_features=512, hidden_dim=256, num_classes=2)
        self.model_b.load_state_dict(
            torch.load(self.models_dir / "model_b.pt", map_location=self.device, weights_only=True)
        )
        self.model_b.to(self.device)
        self.model_b.eval()

        # 2. Load Phase 2 fitted calibration and gating modules
        self.scaler_a = TemperatureScaler.load(self.models_dir / "temperature_model_a.json")
        self.scaler_b = TemperatureScaler.load(self.models_dir / "temperature_model_b.json")
        self.conformal_a = ConformalPredictor.load(self.models_dir / "conformal_model_a.json")
        self.conformal_b = ConformalPredictor.load(self.models_dir / "conformal_model_b.json")
        self.ood_gate = MahalanobisOODGate.load(self.models_dir / "ood_gate.npz")

        self.engine = UnifiedVerdictEngine(
            scaler_a=self.scaler_a,
            scaler_b=self.scaler_b,
            conformal_a=self.conformal_a,
            conformal_b=self.conformal_b,
            ood_gate=self.ood_gate,
        )

        self.extractor = ClipEmbeddingExtractor(
            model_name="ViT-B-32",
            pretrained="laion2b_s34b_b79k",
            device=self.device,
        )

    def get_or_extract_openfake_data(
        self, split_name: str, parquet_paths: list[Path]
    ) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Load cached embeddings or extract from parquet files."""
        emb_cache = self.emb_dir / f"openfake_{split_name}_embeddings.npy"
        lbl_cache = self.emb_dir / f"openfake_{split_name}_labels.npy"
        meta_cache = self.emb_dir / f"openfake_{split_name}_models.json"

        if emb_cache.exists() and lbl_cache.exists() and meta_cache.exists():
            print(f"Loading cached {split_name} embeddings from {emb_cache}...")
            embeddings = np.load(emb_cache)
            labels = np.load(lbl_cache)
            with open(meta_cache, encoding="utf-8") as f:
                model_names = json.load(f)
            return embeddings, labels, model_names

        print(
            f"Extracting features for OpenFake {split_name} from {len(parquet_paths)} parquets..."
        )
        dfs = [pd.read_parquet(p) for p in parquet_paths]
        df = pd.concat(dfs, ignore_index=True)

        labels = np.array(
            [1 if r["label"] == "fake" else 0 for _, r in df.iterrows()], dtype=np.int64
        )
        model_names = [str(r.get("model", "unknown")) for _, r in df.iterrows()]

        feats = []
        with torch.inference_mode():
            for _, row in df.iterrows():
                img = extract_pil_from_openfake(row["image"])
                t = self.extractor.preprocess(img).unsqueeze(0).to(self.device)
                if self.device == "cuda":
                    t = t.half()
                f = self.extractor.model.encode_image(t)
                f = f / f.norm(dim=-1, keepdim=True)
                feats.append(f.cpu().float().numpy()[0])

        embeddings = np.array(feats, dtype=np.float32)

        # Cache to disk
        np.save(emb_cache, embeddings)
        np.save(lbl_cache, labels)
        with open(meta_cache, "w", encoding="utf-8") as f:
            json.dump(model_names, f)

        return embeddings, labels, model_names

    def evaluate_dataset(
        self,
        name: str,
        embeddings: np.ndarray,
        labels: np.ndarray,
        model_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Run full calibration, risk-coverage, and unified verdict evaluation on a dataset."""
        print(f"\n--- Evaluating E4 on {name} (N={len(labels)}) ---")
        n = len(labels)

        # 1. Forward pass on models
        with torch.no_grad():
            t_emb = torch.from_numpy(embeddings).to(self.device)
            logits_a = self.model_a(t_emb).cpu().numpy()
            logits_b = self.model_b(t_emb).cpu().numpy()

        # Uncalibrated and calibrated probabilities
        def softmax_binary(logits: np.ndarray) -> np.ndarray:
            exp_z = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_z / np.sum(exp_z, axis=1, keepdims=True)
            return cast(np.ndarray, probs[:, 1])

        raw_probs_a = softmax_binary(logits_a)
        raw_probs_b = softmax_binary(logits_b)
        cal_probs_a = self.scaler_a.predict_proba(logits_a)
        cal_probs_b = self.scaler_b.predict_proba(logits_b)

        # Ensemble average probability
        cal_probs_ens = (cal_probs_a + cal_probs_b) / 2.0
        preds_ens = (cal_probs_ens >= 0.5).astype(np.int64)
        conf_ens = np.maximum(cal_probs_ens, 1.0 - cal_probs_ens)

        # 2. Calibration Metrics before and after
        cal_metrics_a_uncal = compute_calibration_metrics(raw_probs_a, labels)
        cal_metrics_a_cal = compute_calibration_metrics(cal_probs_a, labels)
        cal_metrics_b_uncal = compute_calibration_metrics(raw_probs_b, labels)
        cal_metrics_b_cal = compute_calibration_metrics(cal_probs_b, labels)
        cal_metrics_ens = compute_calibration_metrics(cal_probs_ens, labels)

        # 3. Conformal Coverage Check
        conf_cov_a = self.conformal_a.evaluate_coverage(cal_probs_a, labels)
        conf_cov_b = self.conformal_b.evaluate_coverage(cal_probs_b, labels)

        # 4. Risk-Coverage Curves
        rc_results = compute_risk_coverage(conf_ens, preds_ens, labels)

        # 5. Unified Verdict Engine Operating Point
        engine_verdicts = []
        abstained_count = 0
        selective_correct = 0
        selective_count = 0
        reasons_tally: dict[str, int] = {}

        for i in range(n):
            ev = self.engine.evaluate(embeddings[i], logits_a[i], logits_b[i])
            v = ev["verdict"]
            engine_verdicts.append(v)
            if v == 0:
                abstained_count += 1
                for r in ev["reasons"]:
                    reasons_tally[r] = reasons_tally.get(r, 0) + 1
            else:
                selective_count += 1
                pred_label = 1 if v == 2 else 0
                if pred_label == labels[i]:
                    selective_correct += 1

        natural_coverage = selective_count / n if n > 0 else 0.0
        natural_selective_acc = selective_correct / selective_count if selective_count > 0 else 0.0
        abstention_rate = abstained_count / n if n > 0 else 0.0
        baseline_acc = float(np.mean(preds_ens == labels))

        report = {
            "dataset_name": name,
            "n_samples": n,
            "synthetic_count": int(np.sum(labels == 1)),
            "authentic_count": int(np.sum(labels == 0)),
            "baseline_accuracy_100pct_coverage": baseline_acc,
            "calibration": {
                "model_a_uncalibrated": cal_metrics_a_uncal,
                "model_a_calibrated": cal_metrics_a_cal,
                "model_b_uncalibrated": cal_metrics_b_uncal,
                "model_b_calibrated": cal_metrics_b_cal,
                "ensemble_calibrated": cal_metrics_ens,
            },
            "conformal_coverage": {
                "model_a": conf_cov_a,
                "model_b": conf_cov_b,
            },
            "risk_coverage": rc_results,
            "unified_verdict_engine": {
                "natural_coverage": natural_coverage,
                "abstention_rate": abstention_rate,
                "selective_accuracy": natural_selective_acc,
                "abstention_reasons": reasons_tally,
            },
        }

        print(f"[{name}] Baseline Acc (100% cov): {baseline_acc:.4f}")
        print(
            f"[{name}] Model A ECE: {cal_metrics_a_uncal['ece_equal_mass']:.4f} -> {cal_metrics_a_cal['ece_equal_mass']:.4f}"
        )
        print(
            f"[{name}] Model B ECE: {cal_metrics_b_uncal['ece_equal_mass']:.4f} -> {cal_metrics_b_cal['ece_equal_mass']:.4f}"
        )
        print(f"[{name}] Ensemble ECE (calibrated): {cal_metrics_ens['ece_equal_mass']:.4f}")
        print(
            f"[{name}] Selective Acc @ 80% cov: {rc_results['coverage_80']['selective_accuracy']:.4f} vs 100% cov: {rc_results['coverage_100']['selective_accuracy']:.4f}"
        )
        print(
            f"[{name}] Unified Engine Natural: Coverage = {natural_coverage:.3f}, Selective Acc = {natural_selective_acc:.4f}, Abstain Rate = {abstention_rate:.3f}"
        )

        return report

    def run(self) -> dict[str, Any]:
        openfake_dir = self.root / "dataset" / "openfake"
        core_parquets = [
            openfake_dir / "core_train_0.parquet",
            openfake_dir / "core_train_1.parquet",
        ]
        reddit_parquets = [openfake_dir / "reddit_00026.parquet"]

        # Load or extract shifted datasets
        core_emb, core_labels, core_models = self.get_or_extract_openfake_data(
            "core", core_parquets
        )
        reddit_emb, reddit_labels, reddit_models = self.get_or_extract_openfake_data(
            "reddit", reddit_parquets
        )

        # Run E4 evaluations
        core_report = self.evaluate_dataset(
            "OpenFake Core (Cross-Dataset Shift)", core_emb, core_labels, core_models
        )
        reddit_report = self.evaluate_dataset(
            "OpenFake Reddit (In-The-Wild Shift)", reddit_emb, reddit_labels, reddit_models
        )

        # Check pre-registered targets:
        # Target 1: ECE <= 0.10 on at least one shifted dataset after calibration
        target_1_met = (
            core_report["calibration"]["model_a_calibrated"]["ece_equal_mass"] <= 0.10
            or core_report["calibration"]["model_b_calibrated"]["ece_equal_mass"] <= 0.10
            or reddit_report["calibration"]["model_a_calibrated"]["ece_equal_mass"] <= 0.10
            or reddit_report["calibration"]["model_b_calibrated"]["ece_equal_mass"] <= 0.10
            or core_report["calibration"]["ensemble_calibrated"]["ece_equal_mass"] <= 0.10
            or reddit_report["calibration"]["ensemble_calibrated"]["ece_equal_mass"] <= 0.10
        )

        # Target 2: Selective accuracy at 80% coverage > accuracy at 100% coverage on shifted data
        acc_80_core = core_report["risk_coverage"]["coverage_80"]["selective_accuracy"]
        acc_100_core = core_report["risk_coverage"]["coverage_100"]["selective_accuracy"]
        acc_80_reddit = reddit_report["risk_coverage"]["coverage_80"]["selective_accuracy"]
        acc_100_reddit = reddit_report["risk_coverage"]["coverage_100"]["selective_accuracy"]
        target_2_met = (acc_80_core > acc_100_core) or (acc_80_reddit > acc_100_reddit)

        final_summary = {
            "experiment": "E4",
            "task": "T2.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target_1_ece_le_0_10_shifted": {
                "achieved": bool(target_1_met),
                "details": {
                    "openfake_core_model_a_cal_ece": core_report["calibration"][
                        "model_a_calibrated"
                    ]["ece_equal_mass"],
                    "openfake_core_model_b_cal_ece": core_report["calibration"][
                        "model_b_calibrated"
                    ]["ece_equal_mass"],
                    "openfake_core_ensemble_cal_ece": core_report["calibration"][
                        "ensemble_calibrated"
                    ]["ece_equal_mass"],
                    "openfake_reddit_model_a_cal_ece": reddit_report["calibration"][
                        "model_a_calibrated"
                    ]["ece_equal_mass"],
                    "openfake_reddit_model_b_cal_ece": reddit_report["calibration"][
                        "model_b_calibrated"
                    ]["ece_equal_mass"],
                    "openfake_reddit_ensemble_cal_ece": reddit_report["calibration"][
                        "ensemble_calibrated"
                    ]["ece_equal_mass"],
                },
            },
            "target_2_selective_acc_80_gt_100": {
                "achieved": bool(target_2_met),
                "details": {
                    "core_acc_80": acc_80_core,
                    "core_acc_100": acc_100_core,
                    "reddit_acc_80": acc_80_reddit,
                    "reddit_acc_100": acc_100_reddit,
                },
            },
            "openfake_core": core_report,
            "openfake_reddit": reddit_report,
        }

        # Write results
        out_metrics = self.results_dir / "metrics.json"
        with open(out_metrics, "w", encoding="utf-8") as f:
            json.dump(final_summary, f, indent=2)

        out_config = self.results_dir / "config.json"
        with open(out_config, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "experiment": "E4",
                    "alpha": 0.10,
                    "percentile_ood": 99.0,
                    "temperature_a": self.scaler_a.temperature,
                    "temperature_b": self.scaler_b.temperature,
                },
                f,
                indent=2,
            )

        print("\n==================== [E4 Summary] ====================")
        print(
            f"Target 1 (ECE <= 0.10 on shifted): {target_1_met} (Reddit Ensemble ECE: {reddit_report['calibration']['ensemble_calibrated']['ece_equal_mass']:.4f})"
        )
        print(
            f"Target 2 (Selective Acc @ 80% > 100%): {target_2_met} (Core: {acc_80_core:.4f} vs {acc_100_core:.4f}; Reddit: {acc_80_reddit:.4f} vs {acc_100_reddit:.4f})"
        )
        print(f"Results saved to {out_metrics}")

        return final_summary
