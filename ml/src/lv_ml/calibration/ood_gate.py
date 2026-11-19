"""Mahalanobis distance-based Out-Of-Distribution (OOD) Gating.

Computes class centroids and pooled empirical covariance on in-domain CLIP embeddings.
Establishes a distance threshold at the 99th percentile of the calibration distribution.
Inputs exceeding this threshold are flagged as OOD, triggering an ABSTAIN verdict.
"""

from __future__ import annotations

from pathlib import Path
from typing import cast

import numpy as np


class MahalanobisOODGate:
    """Out-of-distribution detector using Mahalanobis distance in CLIP embedding space."""

    def __init__(
        self,
        mu_0: np.ndarray | None = None,
        mu_1: np.ndarray | None = None,
        precision_matrix: np.ndarray | None = None,
        threshold: float = 0.0,
        percentile: float = 99.0,
        lambda_reg: float = 1e-4,
    ) -> None:
        self.mu_0 = mu_0
        self.mu_1 = mu_1
        self.precision_matrix = precision_matrix
        self.threshold = float(threshold)
        self.percentile = float(percentile)
        self.lambda_reg = float(lambda_reg)

    def fit(
        self,
        train_embeddings: np.ndarray,
        train_labels: np.ndarray,
        cal_embeddings: np.ndarray,
        percentile: float = 99.0,
    ) -> float:
        """Fit class centroids, pooled covariance, and calibrate the OOD threshold.

        Args:
            train_embeddings: (N_train, D) array of training CLIP embeddings.
            train_labels: (N_train,) array of binary training labels {0, 1}.
            cal_embeddings: (N_cal, D) array of calibration CLIP embeddings.
            percentile: Percentile of calibration distances to set threshold (default: 99.0).

        Returns:
            Calibrated distance threshold tau_ood.
        """
        train_embeddings = np.asarray(train_embeddings, dtype=np.float64)
        train_labels = np.asarray(train_labels, dtype=np.int64).flatten()
        cal_embeddings = np.asarray(cal_embeddings, dtype=np.float64)

        n_train, dim = train_embeddings.shape
        self.percentile = float(percentile)

        # 1. Compute class centroids
        mask_0 = train_labels == 0
        mask_1 = train_labels == 1
        if not np.any(mask_0) or not np.any(mask_1):
            raise ValueError("Training data must contain samples from both class 0 and class 1.")

        self.mu_0 = np.mean(train_embeddings[mask_0], axis=0)  # (D,)
        self.mu_1 = np.mean(train_embeddings[mask_1], axis=0)  # (D,)

        # 2. Compute pooled empirical covariance
        diff_0 = train_embeddings[mask_0] - self.mu_0
        diff_1 = train_embeddings[mask_1] - self.mu_1
        scatter = np.dot(diff_0.T, diff_0) + np.dot(diff_1.T, diff_1)
        cov = scatter / n_train

        # 3. Regularize covariance matrix with ridge shrinkage
        cov_reg = cov + self.lambda_reg * np.eye(dim, dtype=np.float64)

        # 4. Invert regularized covariance to obtain precision matrix
        try:
            self.precision_matrix = np.linalg.inv(cov_reg)
        except np.linalg.LinAlgError:
            self.precision_matrix = np.linalg.pinv(cov_reg)

        # 5. Compute Mahalanobis distances on calibration set
        cal_distances = self.compute_distances(cal_embeddings)

        # 6. Set threshold at designated percentile (e.g., 99th percentile)
        self.threshold = float(np.percentile(cal_distances, self.percentile))
        return self.threshold

    def compute_distances(self, embeddings: np.ndarray) -> np.ndarray:
        """Compute minimum Mahalanobis distance to either class centroid.

        d(x) = sqrt(min((x - mu_0)^T Lambda (x - mu_0), (x - mu_1)^T Lambda (x - mu_1)))
        """
        if self.mu_0 is None or self.mu_1 is None or self.precision_matrix is None:
            raise RuntimeError("OOD gate must be fitted or loaded before computing distances.")

        embeddings = np.asarray(embeddings, dtype=np.float64)
        if embeddings.ndim == 1:
            embeddings = embeddings[np.newaxis, :]

        diff_0 = embeddings - self.mu_0  # (N, D)
        diff_1 = embeddings - self.mu_1  # (N, D)

        # Quadratic form: diag(diff @ precision @ diff.T) = sum((diff @ precision) * diff, axis=1)
        prec = self.precision_matrix
        dist_sq_0 = np.sum((diff_0 @ prec) * diff_0, axis=1)
        dist_sq_1 = np.sum((diff_1 @ prec) * diff_1, axis=1)

        # Non-negative clipping for numerical safety
        dist_sq_0 = np.maximum(dist_sq_0, 0.0)
        dist_sq_1 = np.maximum(dist_sq_1, 0.0)

        min_dist_sq = np.minimum(dist_sq_0, dist_sq_1)
        return cast(np.ndarray, np.sqrt(min_dist_sq))

    def is_ood(self, embeddings: np.ndarray) -> np.ndarray:
        """Determine whether embeddings exceed the calibrated OOD distance threshold."""
        distances = self.compute_distances(embeddings)
        return distances > self.threshold

    def score_and_gate(self, embedding: np.ndarray) -> tuple[float, bool]:
        """Compute scalar OOD score and decision for a single embedding.

        Returns:
            (distance_score, is_ood_flag)
        """
        distances = self.compute_distances(embedding)
        dist = float(distances[0])
        return dist, dist > self.threshold

    def save(self, file_path: str | Path) -> None:
        """Save fitted centroids, precision matrix, and threshold to an .npz file."""
        if self.mu_0 is None or self.mu_1 is None or self.precision_matrix is None:
            raise RuntimeError("Cannot save unfitted OOD gate.")

        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            file_path,
            mu_0=self.mu_0,
            mu_1=self.mu_1,
            precision_matrix=self.precision_matrix,
            threshold=np.array([self.threshold], dtype=np.float64),
            percentile=np.array([self.percentile], dtype=np.float64),
            lambda_reg=np.array([self.lambda_reg], dtype=np.float64),
        )

    @classmethod
    def load(cls, file_path: str | Path) -> MahalanobisOODGate:
        """Load fitted OOD gate from an .npz file."""
        file_path = Path(file_path)
        data = np.load(file_path)
        return cls(
            mu_0=data["mu_0"],
            mu_1=data["mu_1"],
            precision_matrix=data["precision_matrix"],
            threshold=float(data["threshold"][0]),
            percentile=float(data["percentile"][0]),
            lambda_reg=float(data["lambda_reg"][0]),
        )
