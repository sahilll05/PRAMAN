"""Ensemble disagreement and abstention rule module.

Combines Model A (Linear Probe), Model B (MLP Probe), Mahalanobis OOD gating,
and Split Conformal Prediction into the canonical verdict derivation engine per spec s7.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import TemperatureScaler


class UnifiedVerdictEngine:
    """Canonical verdict derivation engine implementing spec s7."""

    def __init__(
        self,
        scaler_a: TemperatureScaler,
        scaler_b: TemperatureScaler,
        conformal_a: ConformalPredictor,
        conformal_b: ConformalPredictor,
        ood_gate: MahalanobisOODGate,
    ) -> None:
        self.scaler_a = scaler_a
        self.scaler_b = scaler_b
        self.conformal_a = conformal_a
        self.conformal_b = conformal_b
        self.ood_gate = ood_gate

    def evaluate(
        self,
        embedding: np.ndarray,
        logit_a: float | np.ndarray,
        logit_b: float | np.ndarray,
    ) -> dict[str, Any]:
        """Evaluate embedding and model logits to derive canonical verdict and evidence details.

        Args:
            embedding: (512,) CLIP embedding.
            logit_a: Raw logit(s) from Model A (scalar or 2-element array [z0, z1]).
            logit_b: Raw logit(s) from Model B (scalar or 2-element array [z0, z1]).

        Returns:
            Dictionary with:
                - verdict: 0 (ABSTAIN), 1 (LIKELY_AUTHENTIC), 2 (LIKELY_SYNTHETIC)
                - p_fake_bps: int in [0, 10000]
                - p_fake: float in [0.0, 1.0]
                - is_ood: bool
                - ood_distance: float
                - set_a: list[int]
                - set_b: list[int]
                - reasons: list[str] (empty if not abstained)
        """
        # 1. Temperature scaling
        if isinstance(logit_a, np.ndarray) and logit_a.ndim == 1 and len(logit_a) == 2:
            arr_a = np.atleast_2d(logit_a)
        else:
            arr_a = np.asarray(logit_a)

        if isinstance(logit_b, np.ndarray) and logit_b.ndim == 1 and len(logit_b) == 2:
            arr_b = np.atleast_2d(logit_b)
        else:
            arr_b = np.asarray(logit_b)
        prob_a = float(self.scaler_a.predict_proba(arr_a)[0])
        prob_b = float(self.scaler_b.predict_proba(arr_b)[0])
        p_fake = float((prob_a + prob_b) / 2.0)
        p_fake_bps = int(np.clip(round(p_fake * 10000), 0, 10000))

        # 2. OOD Gating
        ood_dist, is_ood = self.ood_gate.score_and_gate(embedding)

        # 3. Split Conformal Sets
        sets_a = self.conformal_a.predict_set(prob_a)
        sets_b = self.conformal_b.predict_set(prob_b)
        set_a = sets_a[0]
        set_b = sets_b[0]

        reasons: list[str] = []

        # Spec s7 check 1: OOD Gate
        if is_ood:
            reasons.append("OOD_DISTANCE_EXCEEDED")

        # Spec s7 check 2: Conformal uncertainty
        if len(set_a) != 1:
            reasons.append(f"CONFORMAL_UNCERTAINTY_MODEL_A_SIZE_{len(set_a)}")
        if len(set_b) != 1:
            reasons.append(f"CONFORMAL_UNCERTAINTY_MODEL_B_SIZE_{len(set_b)}")

        # Spec s7 check 3: Model disagreement
        class_a = set_a[0] if len(set_a) == 1 else (1 if prob_a >= 0.5 else 0)
        class_b = set_b[0] if len(set_b) == 1 else (1 if prob_b >= 0.5 else 0)

        if class_a != class_b:
            reasons.append("ENSEMBLE_MODEL_DISAGREEMENT")

        # Final verdict assignment
        # 0 = ABSTAIN, 1 = LIKELY_AUTHENTIC (class 0), 2 = LIKELY_SYNTHETIC (class 1)
        if len(reasons) > 0:
            verdict = 0  # ABSTAIN
        else:
            # Both agree and sets are singletons of same class
            verdict = 2 if class_a == 1 else 1

        return {
            "verdict": verdict,
            "p_fake_bps": p_fake_bps,
            "p_fake": p_fake,
            "prob_a": prob_a,
            "prob_b": prob_b,
            "is_ood": is_ood,
            "ood_distance": ood_dist,
            "ood_threshold": self.ood_gate.threshold,
            "set_a": set_a,
            "set_b": set_b,
            "reasons": reasons,
        }
