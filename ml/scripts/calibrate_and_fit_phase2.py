"""Phase 2 Calibration, OOD Gating, and Conformal Uncertainty Fitting Script.

Implements T2.1, T2.2, T2.3, and T2.4:
- T2.1: Temperature scaling on balanced_cal, evaluates ECE reduction.
- T2.2: Mahalanobis OOD gate fitting on balanced_train, 99th percentile threshold on balanced_cal.
- T2.3: Split conformal prediction with alpha=0.10, checks coverage.
- T2.4: Unified verdict engine combining Model A & B, OOD gate, and conformal prediction.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
import torch

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ensemble import UnifiedVerdictEngine
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import (
    TemperatureScaler,
    compute_calibration_metrics,
)
from lv_ml.models.probe import ClipLinearProbe, MlpProbe


def get_git_sha(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            text=True,
        ).strip()
    except Exception:
        return "unknown"


def load_memmap(dat_path: Path, n_samples: int, dim: int = 512) -> np.ndarray:
    return (
        np.memmap(dat_path, dtype=np.float16, mode="r", shape=(n_samples, dim))
        .copy()
        .astype(np.float32)
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    embeddings_dir = repo_root / "dataset" / "embeddings"
    models_dir = repo_root / "dataset" / "models"
    results_dir = repo_root / "results"
    git_sha = get_git_sha(repo_root)

    print(f"=== Starting Phase 2 Calibration and Gating Pipeline (git: {git_sha[:8]}) ===")

    # 1. Load labels and memmaps
    train_labels = np.load(embeddings_dir / "balanced_train_labels.npy")
    cal_labels = np.load(embeddings_dir / "balanced_cal_labels.npy")
    test_indomain_labels = np.load(embeddings_dir / "balanced_test_indomain_labels.npy")
    test_disjoint_labels = np.load(embeddings_dir / "balanced_test_disjoint_labels.npy")

    train_emb = load_memmap(embeddings_dir / "balanced_train_embeddings.dat", len(train_labels))
    cal_emb = load_memmap(embeddings_dir / "balanced_cal_embeddings.dat", len(cal_labels))
    test_indomain_emb = load_memmap(
        embeddings_dir / "balanced_test_indomain_embeddings.dat", len(test_indomain_labels)
    )
    test_disjoint_emb = load_memmap(
        embeddings_dir / "balanced_test_disjoint_embeddings.dat", len(test_disjoint_labels)
    )

    print(
        f"Loaded train: {train_emb.shape}, cal: {cal_emb.shape}, test_indomain: {test_indomain_emb.shape}, test_disjoint: {test_disjoint_emb.shape}"
    )

    # 2. Load PyTorch model weights
    device = torch.device("cpu")
    model_a = ClipLinearProbe(in_features=512)
    model_a.load_state_dict(
        torch.load(models_dir / "model_a.pt", map_location=device, weights_only=True)
    )
    model_a.eval()

    model_b = MlpProbe(in_features=512)
    model_b.load_state_dict(
        torch.load(models_dir / "model_b.pt", map_location=device, weights_only=True)
    )
    model_b.eval()

    with torch.no_grad():
        cal_logits_a = model_a(torch.from_numpy(cal_emb)).numpy()
        cal_logits_b = model_b(torch.from_numpy(cal_emb)).numpy()

        test_indomain_logits_a = model_a(torch.from_numpy(test_indomain_emb)).numpy()
        test_indomain_logits_b = model_b(torch.from_numpy(test_indomain_emb)).numpy()

        test_disjoint_logits_a = model_a(torch.from_numpy(test_disjoint_emb)).numpy()
        test_disjoint_logits_b = model_b(torch.from_numpy(test_disjoint_emb)).numpy()

    # -------------------------------------------------------------------------
    # T2.1: Temperature Scaling
    # -------------------------------------------------------------------------
    print("\n--- T2.1: Temperature Scaling ---")
    scaler_a = TemperatureScaler()
    scaler_b = TemperatureScaler()

    t_a = scaler_a.fit(cal_logits_a, cal_labels)
    t_b = scaler_b.fit(cal_logits_b, cal_labels)
    print(f"Optimal Temperature -> Model A: {t_a:.4f}, Model B: {t_b:.4f}")

    def softmax_binary(logits: np.ndarray) -> np.ndarray:
        exp_z = np.exp(logits - np.max(logits, axis=1, keepdims=True))
        probs = exp_z / np.sum(exp_z, axis=1, keepdims=True)
        return probs[:, 1]

    # Compute uncalibrated and calibrated probabilities
    raw_probs_a_cal = softmax_binary(cal_logits_a)
    cal_probs_a_cal = scaler_a.predict_proba(cal_logits_a)
    raw_probs_b_cal = softmax_binary(cal_logits_b)
    cal_probs_b_cal = scaler_b.predict_proba(cal_logits_b)

    raw_probs_a_test = softmax_binary(test_indomain_logits_a)
    cal_probs_a_test = scaler_a.predict_proba(test_indomain_logits_a)
    raw_probs_b_test = softmax_binary(test_indomain_logits_b)
    cal_probs_b_test = scaler_b.predict_proba(test_indomain_logits_b)

    cal_metrics_a_uncal = compute_calibration_metrics(raw_probs_a_test, test_indomain_labels)
    cal_metrics_a_cal = compute_calibration_metrics(cal_probs_a_test, test_indomain_labels)
    cal_metrics_b_uncal = compute_calibration_metrics(raw_probs_b_test, test_indomain_labels)
    cal_metrics_b_cal = compute_calibration_metrics(cal_probs_b_test, test_indomain_labels)

    print(
        f"Model A Test Indomain ECE: {cal_metrics_a_uncal['ece_equal_mass']:.4f} -> {cal_metrics_a_cal['ece_equal_mass']:.4f} (NLL: {cal_metrics_a_uncal['nll']:.4f} -> {cal_metrics_a_cal['nll']:.4f})"
    )
    print(
        f"Model B Test Indomain ECE: {cal_metrics_b_uncal['ece_equal_mass']:.4f} -> {cal_metrics_b_cal['ece_equal_mass']:.4f} (NLL: {cal_metrics_b_uncal['nll']:.4f} -> {cal_metrics_b_cal['nll']:.4f})"
    )

    scaler_a.save(models_dir / "temperature_model_a.json")
    scaler_b.save(models_dir / "temperature_model_b.json")

    t2_1_results = {
        "git_sha": git_sha,
        "temperature_a": t_a,
        "temperature_b": t_b,
        "model_a_test_metrics_uncalibrated": cal_metrics_a_uncal,
        "model_a_test_metrics_calibrated": cal_metrics_a_cal,
        "model_b_test_metrics_uncalibrated": cal_metrics_b_uncal,
        "model_b_test_metrics_calibrated": cal_metrics_b_cal,
    }
    t2_1_dir = results_dir / "T2.1"
    t2_1_dir.mkdir(parents=True, exist_ok=True)
    with open(t2_1_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(t2_1_results, f, indent=2)

    # -------------------------------------------------------------------------
    # T2.2: Mahalanobis OOD Gating
    # -------------------------------------------------------------------------
    print("\n--- T2.2: Mahalanobis OOD Gating ---")
    ood_gate = MahalanobisOODGate()
    ood_thresh = ood_gate.fit(train_emb, train_labels, cal_emb, percentile=99.0)
    print(f"Calibrated Mahalanobis OOD Threshold (99th percentile): {ood_thresh:.4f}")

    cal_ood = ood_gate.is_ood(cal_emb)
    test_indomain_ood = ood_gate.is_ood(test_indomain_emb)
    test_disjoint_ood = ood_gate.is_ood(test_disjoint_emb)

    ood_gate.save(models_dir / "ood_gate.npz")

    t2_2_results = {
        "git_sha": git_sha,
        "percentile": 99.0,
        "ood_threshold": ood_thresh,
        "cal_ood_rate": float(np.mean(cal_ood)),
        "test_indomain_ood_rate": float(np.mean(test_indomain_ood)),
        "test_disjoint_ood_rate": float(np.mean(test_disjoint_ood)),
    }
    print(
        f"OOD Rejection Rates: Cal={t2_2_results['cal_ood_rate']:.3f}, Test-Indomain={t2_2_results['test_indomain_ood_rate']:.3f}, Test-Disjoint={t2_2_results['test_disjoint_ood_rate']:.3f}"
    )
    t2_2_dir = results_dir / "T2.2"
    t2_2_dir.mkdir(parents=True, exist_ok=True)
    with open(t2_2_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(t2_2_results, f, indent=2)

    # -------------------------------------------------------------------------
    # T2.3: Split Conformal Prediction
    # -------------------------------------------------------------------------
    print("\n--- T2.3: Split Conformal Prediction (alpha=0.10) ---")
    conformal_a = ConformalPredictor(alpha=0.10)
    conformal_b = ConformalPredictor(alpha=0.10)

    q_hat_a = conformal_a.calibrate(cal_probs_a_cal, cal_labels)
    q_hat_b = conformal_b.calibrate(cal_probs_b_cal, cal_labels)
    print(f"Non-conformity quantiles -> Model A: {q_hat_a:.4f}, Model B: {q_hat_b:.4f}")

    cov_a_cal = conformal_a.evaluate_coverage(cal_probs_a_cal, cal_labels)
    cov_a_test = conformal_a.evaluate_coverage(cal_probs_a_test, test_indomain_labels)
    cov_b_cal = conformal_b.evaluate_coverage(cal_probs_b_cal, cal_labels)
    cov_b_test = conformal_b.evaluate_coverage(cal_probs_b_test, test_indomain_labels)

    conformal_a.save(models_dir / "conformal_model_a.json")
    conformal_b.save(models_dir / "conformal_model_b.json")

    print(
        f"Model A Test Coverage: {cov_a_test['empirical_coverage']:.4f} (Singleton rate: {cov_a_test['singleton_rate']:.4f})"
    )
    print(
        f"Model B Test Coverage: {cov_b_test['empirical_coverage']:.4f} (Singleton rate: {cov_b_test['singleton_rate']:.4f})"
    )

    t2_3_results = {
        "git_sha": git_sha,
        "alpha": 0.10,
        "model_a": {
            "q_hat": q_hat_a,
            "cal_stats": cov_a_cal,
            "test_stats": cov_a_test,
        },
        "model_b": {
            "q_hat": q_hat_b,
            "cal_stats": cov_b_cal,
            "test_stats": cov_b_test,
        },
    }
    t2_3_dir = results_dir / "T2.3"
    t2_3_dir.mkdir(parents=True, exist_ok=True)
    with open(t2_3_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(t2_3_results, f, indent=2)

    # -------------------------------------------------------------------------
    # T2.4: Unified Verdict Engine Evaluation
    # -------------------------------------------------------------------------
    print("\n--- T2.4: Unified Verdict Engine Evaluation ---")
    engine = UnifiedVerdictEngine(
        scaler_a=scaler_a,
        scaler_b=scaler_b,
        conformal_a=conformal_a,
        conformal_b=conformal_b,
        ood_gate=ood_gate,
    )

    def evaluate_engine_on_split(
        emb: np.ndarray, logits_a: np.ndarray, logits_b: np.ndarray, labels: np.ndarray
    ) -> dict[str, Any]:
        verdicts = []
        p_fakes = []
        abstained_count = 0
        correct_count = 0
        selective_total = 0
        reasons_tally: dict[str, int] = {}

        for i in range(len(labels)):
            res = engine.evaluate(emb[i], logits_a[i], logits_b[i])
            v = res["verdict"]
            verdicts.append(v)
            p_fakes.append(res["p_fake"])

            if v == 0:
                abstained_count += 1
                for r in res["reasons"]:
                    reasons_tally[r] = reasons_tally.get(r, 0) + 1
            else:
                selective_total += 1
                pred_label = 1 if v == 2 else 0
                if pred_label == labels[i]:
                    correct_count += 1

        total = len(labels)
        coverage = selective_total / total if total > 0 else 0.0
        selective_acc = correct_count / selective_total if selective_total > 0 else 0.0
        overall_acc = correct_count / total if total > 0 else 0.0

        return {
            "total_samples": total,
            "abstained_samples": abstained_count,
            "abstention_rate": abstained_count / total if total > 0 else 0.0,
            "coverage": coverage,
            "selective_accuracy": selective_acc,
            "overall_accuracy": overall_acc,
            "reasons_tally": reasons_tally,
        }

    test_indomain_engine_res = evaluate_engine_on_split(
        test_indomain_emb, test_indomain_logits_a, test_indomain_logits_b, test_indomain_labels
    )
    test_disjoint_engine_res = evaluate_engine_on_split(
        test_disjoint_emb, test_disjoint_logits_a, test_disjoint_logits_b, test_disjoint_labels
    )

    print(
        f"Test Indomain: Coverage = {test_indomain_engine_res['coverage']:.3f}, Selective Acc = {test_indomain_engine_res['selective_accuracy']:.4f}, Abstain Rate = {test_indomain_engine_res['abstention_rate']:.3f}"
    )
    print(
        f"Test Disjoint: Coverage = {test_disjoint_engine_res['coverage']:.3f}, Selective Acc = {test_disjoint_engine_res['selective_accuracy']:.4f}, Abstain Rate = {test_disjoint_engine_res['abstention_rate']:.3f}"
    )
    print(f"Test Indomain Abstain Reasons: {test_indomain_engine_res['reasons_tally']}")

    t2_4_results = {
        "git_sha": git_sha,
        "test_indomain": test_indomain_engine_res,
        "test_disjoint": test_disjoint_engine_res,
    }
    t2_4_dir = results_dir / "T2.4"
    t2_4_dir.mkdir(parents=True, exist_ok=True)
    with open(t2_4_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(t2_4_results, f, indent=2)

    print("=== Phase 2 Calibration and Gating Pipeline Completed Successfully ===")


if __name__ == "__main__":
    main()
