"""Unit tests for PRAMANA ML Models and CPU Reference Runner (T1.3)."""

import tempfile
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from lv_ml.models.probe import ClipLinearProbe, MlpProbe, compute_metrics
from lv_ml.runner.cpu_runner import ReferenceRunner
from lv_ml.runner.onnx_exporter import export_probe_to_onnx


def test_linear_probe_forward() -> None:
    model = ClipLinearProbe(in_features=512, num_classes=2)
    x = torch.randn(8, 512)
    out = model(x)
    assert out.shape == (8, 2)


def test_mlp_probe_forward() -> None:
    model = MlpProbe(in_features=512, hidden_dim=64, num_classes=2, dropout=0.1)
    model.eval()
    x = torch.randn(4, 512)
    out = model(x)
    assert out.shape == (4, 2)


def test_compute_metrics() -> None:
    y_true = np.array([0, 0, 1, 1])
    y_probs = np.array([0.1, 0.2, 0.8, 0.9])
    metrics = compute_metrics(y_true, y_probs)
    assert metrics["auc"] == 1.0
    assert metrics["accuracy"] == 1.0
    assert metrics["brier"] < 0.1
    assert "ece" in metrics


def test_onnx_export_and_cpu_runner() -> None:
    model = ClipLinearProbe(in_features=512, num_classes=2)
    with tempfile.TemporaryDirectory() as tmp_dir:
        onnx_path = Path(tmp_dir) / "test_model.onnx"
        export_info = export_probe_to_onnx(model, onnx_path, in_features=512)

        assert onnx_path.exists()
        assert len(export_info["model_hash"]) == 64
        assert export_info["max_abs_diff"] < 1e-4

        # Create a tiny test image
        img_path = Path(tmp_dir) / "test_img.png"
        img = Image.new("RGB", (64, 64), color="blue")
        img.save(img_path)

        runner = ReferenceRunner(onnx_model_path=onnx_path)
        verdict, evidence = runner.predict_image(img_path)

        assert verdict["specVersion"] == "0.1.0-draft"
        assert verdict["onChain"]["verdict"] in [0, 1, 2]
        assert verdict["onChain"]["modelHash"] == export_info["model_hash"]
        assert evidence["model"]["hash"] == export_info["model_hash"]
        assert verdict["evidenceHash"] == verdict["onChain"]["evidenceHash"]
