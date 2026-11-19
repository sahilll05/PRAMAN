"""PRAMANA ML Evaluation Modules."""

try:
    from lv_ml.eval.benchmark import BenchmarkRunner
except (ImportError, ModuleNotFoundError):
    BenchmarkRunner = None

try:
    from lv_ml.eval.shortcut_audit import (
        equalize_image,
        extract_metadata_features,
        run_shortcut_audit,
    )
except (ImportError, ModuleNotFoundError):
    equalize_image = None  # type: ignore[assignment]
    extract_metadata_features = None  # type: ignore[assignment]
    run_shortcut_audit = None  # type: ignore[assignment]

__all__ = [
    "BenchmarkRunner",
    "equalize_image",
    "extract_metadata_features",
    "run_shortcut_audit",
]
