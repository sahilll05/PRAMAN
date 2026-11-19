"""Temperature scaling calibration module for binary classification probes.

Implements post-hoc temperature scaling (Guo et al. 2017) to optimize probability calibration
and minimize Expected Calibration Error (ECE), Negative Log-Likelihood (NLL), and Brier score.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import scipy.optimize
import torch


def compute_binary_ece(
    probs: np.ndarray,
    labels: np.ndarray,
    num_bins: int = 15,
    strategy: str = "equal_mass",
) -> float:
    """Compute Expected Calibration Error (ECE) for binary probabilities.

    Args:
        probs: 1D array of predicted probabilities P(y=1) in [0, 1].
        labels: 1D array of ground truth binary labels in {0, 1}.
        num_bins: Number of bins (default: 15).
        strategy: 'equal_mass' (adaptive quantile bins) or 'equal_width' (uniform [0, 1] bins).

    Returns:
        Expected Calibration Error in [0, 1].
    """
    probs = np.asarray(probs, dtype=np.float64)
    labels = np.asarray(labels, dtype=np.float64)
    n = len(probs)
    if n == 0:
        return 0.0

    if strategy == "equal_mass":
        # Adaptive quantile binning: approximately equal number of samples per bin
        quantiles = np.linspace(0.0, 1.0, num_bins + 1)
        bin_edges = np.quantile(probs, quantiles)
        # Avoid non-unique edges if many identical probabilities exist
        bin_edges = np.unique(bin_edges)
        if len(bin_edges) < 2:
            bin_edges = np.array([0.0, 1.0])
    elif strategy == "equal_width":
        bin_edges = np.linspace(0.0, 1.0, num_bins + 1)
    else:
        raise ValueError(f"Unknown strategy: {strategy}. Choose 'equal_mass' or 'equal_width'.")

    ece = 0.0
    for i in range(len(bin_edges) - 1):
        low, high = bin_edges[i], bin_edges[i + 1]
        if i == len(bin_edges) - 2:
            mask = (probs >= low) & (probs <= high)
        else:
            mask = (probs >= low) & (probs < high)

        bin_size = int(np.sum(mask))
        if bin_size > 0:
            avg_prob = float(np.mean(probs[mask]))
            empirical_acc = float(np.mean(labels[mask]))
            ece += (bin_size / n) * abs(empirical_acc - avg_prob)

    return float(ece)


def compute_calibration_metrics(
    probs: np.ndarray,
    labels: np.ndarray,
    num_bins: int = 15,
) -> dict[str, float]:
    """Compute comprehensive calibration metrics: ECE (mass & width), Brier score, NLL."""
    probs = np.asarray(probs, dtype=np.float64)
    labels = np.asarray(labels, dtype=np.float64)

    # Clip probabilities to avoid log(0) in NLL
    eps = 1e-12
    clipped_probs = np.clip(probs, eps, 1.0 - eps)

    ece_mass = compute_binary_ece(probs, labels, num_bins=num_bins, strategy="equal_mass")
    ece_width = compute_binary_ece(probs, labels, num_bins=num_bins, strategy="equal_width")
    brier = float(np.mean((probs - labels) ** 2))
    nll = -float(
        np.mean(labels * np.log(clipped_probs) + (1.0 - labels) * np.log(1.0 - clipped_probs))
    )

    return {
        "ece_equal_mass": ece_mass,
        "ece_equal_width": ece_width,
        "brier_score": brier,
        "nll": nll,
    }


class TemperatureScaler:
    """Scalar temperature scaling for binary classification probes."""

    def __init__(self, temperature: float = 1.0) -> None:
        if temperature <= 0.0:
            raise ValueError(f"Temperature must be strictly positive, got {temperature}")
        self.temperature = float(temperature)

    def _extract_effective_logits(self, logits: np.ndarray | torch.Tensor) -> np.ndarray:
        """Extract effective binary logits z = z_1 - z_0 if shape is (N, 2), else flatten."""
        if isinstance(logits, torch.Tensor):
            arr = logits.detach().cpu().numpy().astype(np.float64)
        else:
            arr = np.asarray(logits, dtype=np.float64)

        if arr.ndim == 2 and arr.shape[1] == 2:
            return arr[:, 1] - arr[:, 0]
        return arr.flatten()

    def fit(
        self,
        logits: np.ndarray | torch.Tensor,
        labels: np.ndarray | torch.Tensor,
    ) -> float:
        """Optimize temperature T to minimize negative log-likelihood on calibration data.

        Args:
            logits: (N, 2) or (N,) array of uncalibrated raw logits.
            labels: 1D array of binary labels {0, 1}.

        Returns:
            Optimized temperature scalar T.
        """
        logits_np = self._extract_effective_logits(logits)

        if isinstance(labels, torch.Tensor):
            labels_np = labels.detach().cpu().numpy().flatten().astype(np.float64)
        else:
            labels_np = np.asarray(labels, dtype=np.float64).flatten()

        def nll_objective(t: np.ndarray) -> float:
            temp = float(t[0])
            scaled_logits = logits_np / temp
            # Stable log-sigmoid computation
            # BCE = max(z, 0) - z * y + log(1 + exp(-|z|))
            loss = (
                np.maximum(scaled_logits, 0.0)
                - scaled_logits * labels_np
                + np.log1p(np.exp(-np.abs(scaled_logits)))
            )
            return float(np.mean(loss))

        res = scipy.optimize.minimize(
            nll_objective,
            x0=np.array([self.temperature]),
            bounds=[(0.01, 50.0)],
            method="L-BFGS-B",
        )

        self.temperature = float(res.x[0])
        return self.temperature

    def scale_logits(self, logits: np.ndarray | torch.Tensor) -> np.ndarray | torch.Tensor:
        """Scale logits by 1 / temperature."""
        return logits / self.temperature

    def predict_proba(self, logits: np.ndarray | torch.Tensor) -> np.ndarray:
        """Compute calibrated probability P(y=1) = sigmoid(effective_logits / T)."""
        logits_np = self._extract_effective_logits(logits)
        scaled = logits_np / self.temperature
        return 1.0 / (1.0 + np.exp(-scaled))

    def save(self, file_path: str | Path) -> None:
        """Save temperature parameter to JSON."""
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "temperature": self.temperature,
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, file_path: str | Path) -> TemperatureScaler:
        """Load temperature parameter from JSON."""
        file_path = Path(file_path)
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
        return cls(temperature=data["temperature"])
