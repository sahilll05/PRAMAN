"""ONNX Exporter for PRAMAN ML Probes (T1.3 / T2.6).

Exports PyTorch probes (Model A and Model B) to ONNX fp32, verifies graph validity
via onnx.checker, tests numerical agreement between PyTorch and CPU ONNX Runtime,
and computes the canonical SHA-256 modelHash per spec §2.1 and §5.
"""

import hashlib
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn as nn


def export_probe_to_onnx(
    model: nn.Module,
    output_onnx_path: str | Path,
    in_features: int = 512,
    tolerance: float = 1e-4,
) -> dict[str, Any]:
    """Export PyTorch probe to ONNX fp32, verify graph and numerical correctness."""
    output_onnx_path = Path(output_onnx_path)
    output_onnx_path.parent.mkdir(parents=True, exist_ok=True)

    model.eval()
    model_cpu = model.to("cpu")

    dummy_input = torch.randn(1, in_features, dtype=torch.float32)

    # Export to ONNX
    torch.onnx.export(
        model_cpu,
        (dummy_input,),
        str(output_onnx_path),
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
        opset_version=17,
        do_constant_folding=True,
    )

    # Verify ONNX model graph
    onnx_model = onnx.load(str(output_onnx_path))
    onnx.checker.check_model(onnx_model)

    # Numerical verification on CPU ONNX Runtime
    session_options = ort.SessionOptions()
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(
        str(output_onnx_path),
        sess_options=session_options,
        providers=["CPUExecutionProvider"],
    )

    test_input = torch.randn(4, in_features, dtype=torch.float32)
    with torch.no_grad():
        pytorch_logits = model_cpu(test_input).numpy()

    onnx_inputs = {session.get_inputs()[0].name: test_input.numpy()}
    onnx_logits = session.run(None, onnx_inputs)[0]

    max_abs_diff = float(np.max(np.abs(pytorch_logits - onnx_logits)))
    if max_abs_diff > tolerance:
        msg = f"PyTorch vs ONNX mismatch: max abs diff {max_abs_diff:.6f} > {tolerance}"
        raise ValueError(msg)

    # Compute canonical modelHash: SHA-256 hex string (no 0x prefix)
    onnx_bytes = output_onnx_path.read_bytes()
    model_hash = hashlib.sha256(onnx_bytes).hexdigest()

    return {
        "onnx_path": str(output_onnx_path.resolve()),
        "model_hash": model_hash,
        "size_bytes": len(onnx_bytes),
        "max_abs_diff": max_abs_diff,
        "onnx_version": onnx.__version__,
        "onnxruntime_version": ort.__version__,
    }
