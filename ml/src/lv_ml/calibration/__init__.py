"""Calibration, uncertainty quantification, and abstention module."""

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ensemble import UnifiedVerdictEngine
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import (
    TemperatureScaler,
    compute_binary_ece,
    compute_calibration_metrics,
)

__all__ = [
    "TemperatureScaler",
    "compute_binary_ece",
    "compute_calibration_metrics",
    "MahalanobisOODGate",
    "ConformalPredictor",
    "UnifiedVerdictEngine",
]
