"""Experiment E10: Adversarial Perturbation Test (T8.1).

Pre-registered Protocol (evaluation_plan.md / threat_model.md T1):
- White-box and transfer adversarial perturbations (PGD, L_infty) against Model A and Model B.
- Perturbation budgets: epsilon in [0.01, 0.05, 0.10, 0.20].
- Target objective: Evasion attack on synthetic images (y=1 -> y_target=0) and impersonation attack on authentic images (y=0 -> y_target=1).
- Metrics evaluated:
  1. Raw probe Attack Success Rate (ASR) before defenses.
  2. Mahalanobis OOD rejection rate (d_M > tau_ood).
  3. Conformal set expansion rate (|S| != 1).
  4. Ensemble disagreement rate (sign(prob_a - 0.5) != sign(prob_b - 0.5)).
  5. Unified Engine Defense Rate: fraction of adversarial queries safely caught by ABSTAIN (verdict 0).
  6. Evasion Rate: fraction of queries that bypass all defenses and produce false confidence.

Hardware: GPU execution (NVIDIA RTX 4060 Laptop GPU), recording env.txt.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import psutil
import torch
import torch.nn as nn

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ensemble import UnifiedVerdictEngine
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import TemperatureScaler
from lv_ml.models.probe import ClipLinearProbe, MlpProbe


def pgd_attack(
    model: nn.Module,
    x: torch.Tensor,
    y_target: torch.Tensor,
    epsilon: float,
    alpha: float,
    num_steps: int = 10,
) -> torch.Tensor:
    """Projected Gradient Descent (PGD) targeted attack under L_infinity norm.

    Minimizes cross-entropy loss with respect to y_target (forcing the model towards y_target).
    """
    model.eval()
    x_orig = x.clone().detach()
    # Random start within epsilon ball
    x_adv = x.clone().detach() + torch.empty_like(x).uniform_(-epsilon, epsilon)
    x_adv = torch.clamp(x_adv, x_orig - epsilon, x_orig + epsilon).detach()

    criterion = nn.CrossEntropyLoss()

    for _ in range(num_steps):
        x_adv.requires_grad = True
        outputs = model(x_adv)
        loss = criterion(outputs, y_target)
        grad = torch.autograd.grad(loss, x_adv, retain_graph=False, create_graph=False)[0]

        # Targeted: step in direction of negative gradient to minimize loss w.r.t y_target
        x_adv = x_adv.detach() - alpha * grad.sign()
        # Project back to L_infinity ball around x_orig
        eta = torch.clamp(x_adv - x_orig, min=-epsilon, max=epsilon)
        x_adv = (x_orig + eta).detach()

    return x_adv


def run_experiment_e10(
    models_dir: Path | str = "dataset/models",
    embeddings_dir: Path | str = "dataset/embeddings",
    results_dir: Path | str = "results/E10",
    epsilons: list[float] | None = None,
    max_samples: int = 200,
    device_str: str | None = None,
) -> dict[str, Any]:
    """Execute Experiment E10 and output metrics and env.txt."""
    if epsilons is None:
        epsilons = [0.01, 0.05, 0.10, 0.20]

    models_dir = Path(models_dir)
    embeddings_dir = Path(embeddings_dir)
    results_dir = Path(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)

    if device_str is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device_str)

    # 1. Load trained models
    model_a = ClipLinearProbe(in_features=512, num_classes=2).to(device)
    model_a.load_state_dict(torch.load(models_dir / "model_a.pt", map_location=device, weights_only=True))
    model_a.eval()

    model_b = MlpProbe(in_features=512, hidden_dim=256, num_classes=2).to(device)
    model_b.load_state_dict(torch.load(models_dir / "model_b.pt", map_location=device, weights_only=True))
    model_b.eval()

    # 2. Load calibration components
    scaler_a = TemperatureScaler.load(models_dir / "temperature_model_a.json")
    scaler_b = TemperatureScaler.load(models_dir / "temperature_model_b.json")
    conformal_a = ConformalPredictor.load(models_dir / "conformal_model_a.json")
    conformal_b = ConformalPredictor.load(models_dir / "conformal_model_b.json")
    ood_gate = MahalanobisOODGate.load(models_dir / "ood_gate.npz")

    unified_engine = UnifiedVerdictEngine(
        scaler_a=scaler_a,
        scaler_b=scaler_b,
        conformal_a=conformal_a,
        conformal_b=conformal_b,
        ood_gate=ood_gate,
    )

    # 3. Load test set embeddings
    labels_path = embeddings_dir / "balanced_test_indomain_labels.npy"
    embs_path = embeddings_dir / "balanced_test_indomain_embeddings.dat"
    test_labels = np.load(labels_path)
    n_total = len(test_labels)
    test_embeddings = np.memmap(
        embs_path,
        dtype=np.float16,
        mode="r",
        shape=(n_total, 512),
    )

    # Subsample balanced evaluation set
    np.random.seed(42)
    torch.manual_seed(42)

    synthetic_indices = np.where(test_labels == 1)[0]
    authentic_indices = np.where(test_labels == 0)[0]

    n_eval_half = min(max_samples // 2, len(synthetic_indices), len(authentic_indices))
    selected_synth = np.random.choice(synthetic_indices, size=n_eval_half, replace=False)
    selected_auth = np.random.choice(authentic_indices, size=n_eval_half, replace=False)
    eval_indices = np.concatenate([selected_synth, selected_auth])

    eval_x_np = np.array(test_embeddings[eval_indices], dtype=np.float32)
    eval_y_np = np.array(test_labels[eval_indices], dtype=np.int64)

    eval_x = torch.from_numpy(eval_x_np).to(device)
    eval_y = torch.from_numpy(eval_y_np).to(device)

    # Target: Evasion (if y=1 target is 0, if y=0 target is 1)
    y_target = 1 - eval_y

    # Record environment before run
    start_time = time.time()
    vram_start = torch.cuda.memory_allocated() / (1024**2) if torch.cuda.is_available() else 0.0

    attack_results: dict[str, Any] = {}

    # Baseline clean performance
    with torch.no_grad():
        clean_logits_a = model_a(eval_x).cpu().numpy()
        clean_logits_b = model_b(eval_x).cpu().numpy()

    clean_verdicts = []
    clean_reasons = []
    for i in range(len(eval_y_np)):
        res = unified_engine.evaluate(
            eval_x_np[i],
            clean_logits_a[i],
            clean_logits_b[i],
        )
        clean_verdicts.append(res["verdict"])
        clean_reasons.append(res["reasons"])

    clean_verdicts_arr = np.array(clean_verdicts)
    clean_raw_preds_a = (clean_logits_a[:, 1] > clean_logits_a[:, 0]).astype(int)
    clean_raw_acc_a = float(np.mean(clean_raw_preds_a == eval_y_np))

    attack_results["clean_baseline"] = {
        "n_samples": len(eval_y_np),
        "raw_accuracy_model_a": clean_raw_acc_a,
        "abstain_rate": float(np.mean(clean_verdicts_arr == 0)),
        "correct_verdict_rate": float(
            np.mean(
                ((clean_verdicts_arr == 1) & (eval_y_np == 0))
                | ((clean_verdicts_arr == 2) & (eval_y_np == 1))
            )
        ),
    }

    # Evaluate each epsilon
    for eps in epsilons:
        alpha = eps / 4.0
        # White-box attack against Model A
        x_adv = pgd_attack(
            model=model_a,
            x=eval_x,
            y_target=y_target,
            epsilon=eps,
            alpha=alpha,
            num_steps=10,
        )

        with torch.no_grad():
            adv_logits_a = model_a(x_adv).cpu().numpy()
            adv_logits_b = model_b(x_adv).cpu().numpy()

        x_adv_np = x_adv.cpu().numpy()

        # Compute raw probe attack success rate (ASR)
        adv_preds_a = (adv_logits_a[:, 1] > adv_logits_a[:, 0]).astype(int)
        adv_preds_b = (adv_logits_b[:, 1] > adv_logits_b[:, 0]).astype(int)

        # For evasion (y=1): success if adv_pred == 0
        # For impersonation (y=0): success if adv_pred == 1
        asr_raw_a = float(np.mean(adv_preds_a == y_target.cpu().numpy()))
        asr_raw_b = float(np.mean(adv_preds_b == y_target.cpu().numpy()))  # transfer ASR to Model B

        # Now evaluate through PRAMAN's Unified Verdict Engine
        adv_verdicts = []
        adv_reasons = []
        is_ood_list = []
        conformal_abstain_list = []
        disagree_list = []

        for i in range(len(eval_y_np)):
            res = unified_engine.evaluate(
                x_adv_np[i],
                adv_logits_a[i],
                adv_logits_b[i],
            )
            adv_verdicts.append(res["verdict"])
            adv_reasons.append(res["reasons"])
            is_ood_list.append(res["is_ood"])
            # Conformal set check
            set_a_size = len(res["set_a"])
            set_b_size = len(res["set_b"])
            conformal_abstain_list.append(set_a_size != 1 or set_b_size != 1)
            # Ensemble check
            diff_a = np.clip(adv_logits_a[i, 1] - adv_logits_a[i, 0], -100.0, 100.0)
            diff_b = np.clip(adv_logits_b[i, 1] - adv_logits_b[i, 0], -100.0, 100.0)
            p_a = 1.0 / (1.0 + np.exp(-diff_a))
            p_b = 1.0 / (1.0 + np.exp(-diff_b))
            disagree_list.append((p_a >= 0.5) != (p_b >= 0.5))

        adv_verdicts_arr = np.array(adv_verdicts)
        is_ood_arr = np.array(is_ood_list)
        conformal_abstain_arr = np.array(conformal_abstain_list)
        disagree_arr = np.array(disagree_list)

        # Breakdown of defenses:
        # Defense Rate: fraction where verdict is safely ABSTAIN (0)
        defense_rate = float(np.mean(adv_verdicts_arr == 0))

        # Evasion Rate: fraction where adversary succeeds in getting a false confident verdict
        # (e.g. synthetic image gets verdict 1 = AUTHENTIC, or authentic image gets verdict 2 = SYNTHETIC)
        evasion_success = (
            ((eval_y_np == 1) & (adv_verdicts_arr == 1))
            | ((eval_y_np == 0) & (adv_verdicts_arr == 2))
        )
        evasion_rate = float(np.mean(evasion_success))

        # Still correctly identified despite perturbation
        retained_correct_rate = float(
            np.mean(
                ((eval_y_np == 1) & (adv_verdicts_arr == 2))
                | ((eval_y_np == 0) & (adv_verdicts_arr == 1))
            )
        )

        attack_results[f"eps_{eps:.2f}"] = {
            "epsilon": eps,
            "raw_asr_model_a": round(asr_raw_a, 4),
            "raw_asr_model_b_transfer": round(asr_raw_b, 4),
            "ood_rejection_rate": round(float(np.mean(is_ood_arr)), 4),
            "conformal_abstention_rate": round(float(np.mean(conformal_abstain_arr)), 4),
            "ensemble_disagreement_rate": round(float(np.mean(disagree_arr)), 4),
            "overall_abstain_rate": round(defense_rate, 4),
            "evasion_success_rate": round(evasion_rate, 4),
            "retained_correct_rate": round(retained_correct_rate, 4),
        }

    total_time = time.time() - start_time
    vram_peak = torch.cuda.max_memory_allocated() / (1024**2) if torch.cuda.is_available() else 0.0

    # Write metrics.json
    output_metrics = {
        "experiment_id": "E10",
        "description": "Adversarial Perturbation Test (PGD L_infty on GPU)",
        "date": "2026-11-20",
        "device": str(device),
        "total_time_seconds": round(total_time, 2),
        "samples_evaluated": len(eval_y_np),
        "ood_threshold": float(ood_gate.threshold),
        "conformal_alpha": float(conformal_a.alpha),
        "results": attack_results,
    }

    with open(results_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(output_metrics, f, indent=2)

    # Write env.txt per GPU policy
    env_lines = [
        f"Experiment: E10 Adversarial Perturbation",
        f"Timestamp: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
        f"Device: {device}",
        f"PyTorch Version: {torch.__version__}",
        f"CUDA Available: {torch.cuda.is_available()}",
    ]
    if torch.cuda.is_available():
        env_lines.extend([
            f"GPU Device: {torch.cuda.get_device_name(0)}",
            f"VRAM Allocated Start: {vram_start:.2f} MiB",
            f"VRAM Peak: {vram_peak:.2f} MiB",
        ])
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage(os.path.abspath(results_dir))
    env_lines.extend([
        f"System RAM: {ram.total / (1024**3):.2f} GB (Used: {ram.used / (1024**3):.2f} GB, {ram.percent}%)",
        f"Disk Available on {results_dir.drive if hasattr(results_dir, 'drive') else 'Root'}: {disk.free / (1024**3):.2f} GB / {disk.total / (1024**3):.2f} GB",
        f"Execution Time: {total_time:.2f} seconds",
    ])

    with open(results_dir / "env.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(env_lines) + "\n")

    return output_metrics
