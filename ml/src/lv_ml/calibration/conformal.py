"""Split Conformal Prediction for distribution-free uncertainty quantification.

Constructs finite-sample valid prediction sets S(x) subset {0, 1} with coverage guarantee:
    P(y in S(x)) >= 1 - alpha

When |S(x)| == 1, outputs unambiguous class verdict.
When |S(x)| == 0 or |S(x)| == 2, outputs ABSTAIN (verdict 0) per spec s7.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


class ConformalPredictor:
    """Split Conformal Predictor for binary classification."""

    def __init__(
        self,
        alpha: float = 0.10,
        q_hat: float = 1.0,
        cal_size: int = 0,
    ) -> None:
        if not (0.0 < alpha < 1.0):
            raise ValueError(f"Significance level alpha must be in (0, 1), got {alpha}")
        self.alpha = float(alpha)
        self.q_hat = float(q_hat)
        self.cal_size = int(cal_size)

    def calibrate(
        self,
        cal_probs: np.ndarray,
        cal_labels: np.ndarray,
    ) -> float:
        """Compute the empirical non-conformity quantile q_hat on the calibration split.

        Args:
            cal_probs: Calibrated probabilities P(y=1) in [0, 1].
            cal_labels: Ground truth binary labels in {0, 1}.

        Returns:
            Computed non-conformity threshold q_hat.
        """
        cal_probs = np.asarray(cal_probs, dtype=np.float64).flatten()
        cal_labels = np.asarray(cal_labels, dtype=np.int64).flatten()

        n = len(cal_probs)
        if n == 0:
            raise ValueError("Calibration set cannot be empty.")
        self.cal_size = n

        # Non-conformity score: s_i = 1 - p(y_i | x_i)
        # For y = 1: s_i = 1 - p_1
        # For y = 0: s_i = 1 - p_0 = 1 - (1 - p_1) = p_1
        true_class_probs = np.where(cal_labels == 1, cal_probs, 1.0 - cal_probs)
        scores = 1.0 - true_class_probs

        # Compute empirical quantile at level ceil((n + 1)(1 - alpha)) / n
        level = int(np.ceil((n + 1) * (1.0 - self.alpha)))
        level = min(level, n)

        sorted_scores = np.sort(scores)
        self.q_hat = float(sorted_scores[level - 1])
        return self.q_hat

    def predict_set(self, probs: np.ndarray | float) -> list[list[int]]:
        """Construct conformal prediction sets for given synthetic probabilities P(y=1).

        A class c is in S(x) if p(c | x) >= 1 - q_hat.

        Args:
            probs: Synthetic probabilities P(y=1), shape (N,) or scalar float.

        Returns:
            List of prediction sets, where each set is a list of classes in {0, 1}.
        """
        probs_arr = np.atleast_1d(np.asarray(probs, dtype=np.float64))
        p1 = probs_arr
        p0 = 1.0 - p1

        cutoff = 1.0 - self.q_hat

        prediction_sets: list[list[int]] = []
        for prob_0, prob_1 in zip(p0, p1, strict=True):
            s: list[int] = []
            if prob_0 >= cutoff:
                s.append(0)  # Authentic class
            if prob_1 >= cutoff:
                s.append(1)  # Synthetic class
            prediction_sets.append(s)

        return prediction_sets

    def evaluate_coverage(
        self,
        test_probs: np.ndarray,
        test_labels: np.ndarray,
    ) -> dict[str, float]:
        """Evaluate empirical coverage and set size statistics on test data."""
        test_probs = np.asarray(test_probs, dtype=np.float64).flatten()
        test_labels = np.asarray(test_labels, dtype=np.int64).flatten()

        pred_sets = self.predict_set(test_probs)
        n = len(test_labels)

        covered = sum(1 for s, y in zip(pred_sets, test_labels, strict=True) if y in s)
        empirical_coverage = covered / n if n > 0 else 0.0

        set_sizes = [len(s) for s in pred_sets]
        avg_set_size = float(np.mean(set_sizes)) if set_sizes else 0.0
        singleton_rate = sum(1 for sz in set_sizes if sz == 1) / n if n > 0 else 0.0
        empty_rate = sum(1 for sz in set_sizes if sz == 0) / n if n > 0 else 0.0
        ambiguous_rate = sum(1 for sz in set_sizes if sz == 2) / n if n > 0 else 0.0

        return {
            "nominal_coverage": 1.0 - self.alpha,
            "empirical_coverage": empirical_coverage,
            "average_set_size": avg_set_size,
            "singleton_rate": singleton_rate,
            "empty_rate": empty_rate,
            "ambiguous_rate": ambiguous_rate,
            "q_hat": self.q_hat,
        }

    def save(self, file_path: str | Path) -> None:
        """Save conformal parameters to JSON."""
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "alpha": self.alpha,
            "q_hat": self.q_hat,
            "cal_size": self.cal_size,
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, file_path: str | Path) -> ConformalPredictor:
        """Load conformal parameters from JSON."""
        file_path = Path(file_path)
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
        return cls(
            alpha=data["alpha"],
            q_hat=data["q_hat"],
            cal_size=data.get("cal_size", 0),
        )
