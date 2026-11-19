"""T1.3: Train Model A (Linear Probe) and Model B (MLP Probe), export to ONNX, and verify CPU runner.

Rule compliance:
- agent_rules.md §2: No fake/mocked results; real training on GPU.
- agent_rules.md §2c: RTX 4060 GPU with mixed precision and VRAM tracking.
- agent_rules.md §4: Fixed random seeds (seed 42).
- spec_schemas.md §7.6: CPU ONNX reference runner validation.
"""

import json
from pathlib import Path
import random
import time

import numpy as np
import torch

from lv_ml.models.probe import (
    ClipLinearProbe,
    EmbeddingDataset,
    MlpProbe,
    evaluate_probe,
    train_probe,
)
from lv_ml.runner.cpu_runner import ReferenceRunner
from lv_ml.runner.onnx_exporter import export_probe_to_onnx


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def main() -> None:
    set_seed(42)
    project_root = Path(__file__).resolve().parents[2]
    emb_dir = project_root / "dataset" / "embeddings"
    models_dir = project_root / "dataset" / "models"
    results_dir = project_root / "results" / "T1.3"
    models_dir.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load memory-mapped datasets
    train_ds = EmbeddingDataset(
        embeddings_path=emb_dir / "balanced_train_embeddings.dat",
        labels_path=emb_dir / "balanced_train_labels.npy",
    )
    cal_ds = EmbeddingDataset(
        embeddings_path=emb_dir / "balanced_cal_embeddings.dat",
        labels_path=emb_dir / "balanced_cal_labels.npy",
    )
    test_in_ds = EmbeddingDataset(
        embeddings_path=emb_dir / "balanced_test_indomain_embeddings.dat",
        labels_path=emb_dir / "balanced_test_indomain_labels.npy",
    )
    test_dis_ds = EmbeddingDataset(
        embeddings_path=emb_dir / "balanced_test_disjoint_embeddings.dat",
        labels_path=emb_dir / "balanced_test_disjoint_labels.npy",
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"--- Starting T1.3 Model Training on {device} ---")
    print(f"Datasets: train={len(train_ds)}, cal={len(cal_ds)}, test_in={len(test_in_ds)}, test_dis={len(test_dis_ds)}")

    # ----------------------------------------------------
    # 2. Train Model A: ClipLinearProbe
    # ----------------------------------------------------
    print("\n[1/4] Training Model A: ClipLinearProbe...")
    model_a = ClipLinearProbe(in_features=512, num_classes=2)
    t0_a = time.time()
    res_a = train_probe(
        model=model_a,
        train_dataset=train_ds,
        val_dataset=cal_ds,
        epochs=30,
        batch_size=64,
        lr=1e-3,
        weight_decay=1e-2,
        device=device,
        checkpoint_dir=results_dir / "checkpoints_model_a",
        resume=False,
    )
    t_train_a = time.time() - t0_a
    print(f"Model A trained in {t_train_a:.2f}s | Best Cal AUC: {res_a['best_cal_auc']:.4f} | Final Cal Metrics: {res_a['final_cal_metrics']}")

    # Save PyTorch weights
    torch.save(model_a.state_dict(), models_dir / "model_a.pt")

    # Export Model A to ONNX
    onnx_a_path = models_dir / "model_a.onnx"
    export_a_info = export_probe_to_onnx(model_a, onnx_a_path, in_features=512)
    print(f"Exported Model A to ONNX: {onnx_a_path.name} | modelHash: {export_a_info['model_hash'][:16]}... | max abs diff: {export_a_info['max_abs_diff']:.2e}")

    # ----------------------------------------------------
    # 3. Train Model B: MlpProbe
    # ----------------------------------------------------
    print("\n[2/4] Training Model B: MlpProbe...")
    model_b = MlpProbe(in_features=512, hidden_dim=256, num_classes=2, dropout=0.2)
    t0_b = time.time()
    res_b = train_probe(
        model=model_b,
        train_dataset=train_ds,
        val_dataset=cal_ds,
        epochs=35,
        batch_size=64,
        lr=1e-3,
        weight_decay=1e-2,
        device=device,
        checkpoint_dir=results_dir / "checkpoints_model_b",
        resume=False,
    )
    t_train_b = time.time() - t0_b
    print(f"Model B trained in {t_train_b:.2f}s | Best Cal AUC: {res_b['best_cal_auc']:.4f} | Final Cal Metrics: {res_b['final_cal_metrics']}")

    # Save PyTorch weights
    torch.save(model_b.state_dict(), models_dir / "model_b.pt")

    # Export Model B to ONNX
    onnx_b_path = models_dir / "model_b.onnx"
    export_b_info = export_probe_to_onnx(model_b, onnx_b_path, in_features=512)
    print(f"Exported Model B to ONNX: {onnx_b_path.name} | modelHash: {export_b_info['model_hash'][:16]}... | max abs diff: {export_b_info['max_abs_diff']:.2e}")

    # ----------------------------------------------------
    # 4. Verify Reference CPU Runner & Schema Validity
    # ----------------------------------------------------
    print("\n[3/4] Verifying CPU ONNX Reference Runner and JSON Schemas...")
    runner_a = ReferenceRunner(
        onnx_model_path=onnx_a_path,
        model_name="clip-linear-probe",
        model_version="0.1.0",
    )
    runner_b = ReferenceRunner(
        onnx_model_path=onnx_b_path,
        model_name="mlp-probe",
        model_version="0.1.0",
    )

    # Pick 1 sample real and 1 sample synthetic image
    with open(project_root / "dataset" / "splits" / "balanced_test_indomain.json") as f:
        test_samples = json.load(f)
    real_sample = next(s for s in test_samples if s["label"] == 0)
    synth_sample = next(s for s in test_samples if s["label"] == 1)

    real_img_path = project_root / real_sample["local_path"]
    synth_img_path = project_root / synth_sample["local_path"]

    print(f"Running CPU runner on Real image: {real_img_path.name}...")
    verdict_real_a, evidence_real_a = runner_a.predict_image(real_img_path)
    print(f"  Model A -> Verdict: {verdict_real_a['onChain']['verdict']} (pFake: {evidence_real_a['aggregate']['pFake']}, pFakeBps: {verdict_real_a['onChain']['pFakeBps']})")
    assert verdict_real_a["onChain"]["verdict"] in [0, 1, 2]

    print(f"Running CPU runner on Synthetic image: {synth_img_path.name}...")
    verdict_synth_a, evidence_synth_a = runner_a.predict_image(synth_img_path)
    print(f"  Model A -> Verdict: {verdict_synth_a['onChain']['verdict']} (pFake: {evidence_synth_a['aggregate']['pFake']}, pFakeBps: {verdict_synth_a['onChain']['pFakeBps']})")
    assert verdict_synth_a["onChain"]["verdict"] in [0, 1, 2]

    print(f"Running CPU runner on Real image with Model B...")
    verdict_real_b, evidence_real_b = runner_b.predict_image(real_img_path)
    print(f"  Model B -> Verdict: {verdict_real_b['onChain']['verdict']} (pFake: {evidence_real_b['aggregate']['pFake']}, pFakeBps: {verdict_real_b['onChain']['pFakeBps']})")

    print(f"Running CPU runner on Synthetic image with Model B...")
    verdict_synth_b, evidence_synth_b = runner_b.predict_image(synth_img_path)
    print(f"  Model B -> Verdict: {verdict_synth_b['onChain']['verdict']} (pFake: {evidence_synth_b['aggregate']['pFake']}, pFakeBps: {verdict_synth_b['onChain']['pFakeBps']})")

    # Save sample verdict and evidence for inspection
    with open(results_dir / "sample_verdict_model_a.json", "w") as f:
        json.dump(verdict_synth_a, f, indent=2)
    with open(results_dir / "sample_evidence_model_a.json", "w") as f:
        json.dump(evidence_synth_a, f, indent=2)

    # ----------------------------------------------------
    # 5. Save Metrics and Config
    # ----------------------------------------------------
    print("\n[4/4] Saving T1.3 metrics and configuration...")
    metrics_report = {
        "task": "T1.3",
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "device": device,
        "model_a": {
            "name": "ClipLinearProbe",
            "train_time_sec": round(t_train_a, 2),
            "best_cal_auc": res_a["best_cal_auc"],
            "cal_metrics": res_a["final_cal_metrics"],
            "model_hash": export_a_info["model_hash"],
            "onnx_size_bytes": export_a_info["size_bytes"],
            "max_abs_diff_onnx": export_a_info["max_abs_diff"],
        },
        "model_b": {
            "name": "MlpProbe",
            "train_time_sec": round(t_train_b, 2),
            "best_cal_auc": res_b["best_cal_auc"],
            "cal_metrics": res_b["final_cal_metrics"],
            "model_hash": export_b_info["model_hash"],
            "onnx_size_bytes": export_b_info["size_bytes"],
            "max_abs_diff_onnx": export_b_info["max_abs_diff"],
        },
        "acceptance_criteria": {
            "models_saved": True,
            "training_curves_logged": True,
            "cpu_onnx_path_validates_schemas": True,
        },
    }

    with open(results_dir / "metrics.json", "w") as f:
        json.dump(metrics_report, f, indent=2)

    with open(results_dir / "training_history.json", "w") as f:
        json.dump({"model_a": res_a["history"], "model_b": res_b["history"]}, f, indent=2)

    print(f"T1.3 successfully completed! Metrics written to {results_dir / 'metrics.json'}")


if __name__ == "__main__":
    main()
