"""
PRAMANA Canary Pipeline with Cryptographic Commit-Reveal (Task T7.2).

Conforms to:
- Spec §2.3: CanaryResult EAS Schema
  (bytes32 modelHash, bytes32 batchId, uint16 aucBps, uint16 eceBps, uint16 coverageBps, uint32 n, bytes32 labelsCommitHash)
- Spec §6: Status State Machine Canary Degradation Thresholds
  (aucBps < AUC_MIN [8000] or eceBps > ECE_MAX [1500] triggers MODEL_DEGRADED)
- ADR D4: Model-level canary reputation and tamper-evident continuous health auditing.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.metrics import roc_auc_score


def canonical_json_bytes(obj: Any) -> bytes:
    """Encode object to deterministic, sorted, UTF-8 canonical JSON without whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_sha256_hex(data: bytes) -> str:
    """Return 0x-prefixed SHA-256 hash."""
    return "0x" + hashlib.sha256(data).hexdigest()


def compute_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 15) -> float:
    """
    Compute Expected Calibration Error (ECE) using equal-width binning.
    y_true: binary labels (0 or 1)
    y_prob: predicted probabilities for positive class (0.0 to 1.0)
    """
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    if n == 0:
        return 0.0

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        mask = (y_prob >= bin_lower) & (y_prob < bin_upper) if i < n_bins - 1 else (y_prob >= bin_lower) & (y_prob <= bin_upper)
        bin_size = np.sum(mask)
        if bin_size > 0:
            bin_acc = np.mean(y_true[mask])
            bin_conf = np.mean(y_prob[mask])
            ece += (bin_size / n) * abs(bin_acc - bin_conf)

    return float(ece)


@dataclass
class CanaryItem:
    item_id: str
    sha256: str
    label: int  # 0: Authentic, 1: Synthetic

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_id": self.item_id,
            "label": self.label,
            "sha256": self.sha256,
        }


@dataclass
class CanaryCommitment:
    batch_id: str
    labels_commit_hash: str
    n: int
    secret_salt: str
    items: List[CanaryItem]

    def export_reveal_manifest(self) -> Dict[str, Any]:
        """Manifest revealed after predictions are collected."""
        return {
            "batch_id": self.batch_id,
            "items": [item.to_dict() for item in self.items],
            "n": self.n,
            "salt": self.secret_salt,
        }

    def export_blind_manifest(self) -> Dict[str, Any]:
        """Manifest given to evaluator without ground-truth labels."""
        return {
            "batch_id": self.batch_id,
            "items": [{"item_id": item.item_id, "sha256": item.sha256} for item in self.items],
            "labels_commit_hash": self.labels_commit_hash,
            "n": self.n,
        }


@dataclass
class CanaryMetrics:
    batch_id: str
    model_hash: str
    labels_commit_hash: str
    n: int
    auc_bps: int
    ece_bps: int
    coverage_bps: int
    is_degraded: bool
    auc_min_bps: int = 8000
    ece_max_bps: int = 1500

    def to_eas_data(self) -> Dict[str, Any]:
        return {
            "aucBps": self.auc_bps,
            "batchId": self.batch_id,
            "coverageBps": self.coverage_bps,
            "eceBps": self.ece_bps,
            "labelsCommitHash": self.labels_commit_hash,
            "modelHash": self.model_hash,
            "n": self.n,
        }


class CanaryPipeline:
    """Orchestrates commitment, inference, reveal, metric calculation, and degradation verification."""

    @staticmethod
    def create_batch(
        items: List[CanaryItem],
        batch_id: Optional[str] = None,
        salt: Optional[str] = None,
    ) -> CanaryCommitment:
        if batch_id is None:
            batch_id = "0x" + secrets.token_hex(32)
        if salt is None:
            salt = secrets.token_hex(32)

        manifest = {
            "batch_id": batch_id,
            "items": [item.to_dict() for item in items],
            "n": len(items),
            "salt": salt,
        }

        commit_hash = compute_sha256_hex(canonical_json_bytes(manifest))

        return CanaryCommitment(
            batch_id=batch_id,
            labels_commit_hash=commit_hash,
            n=len(items),
            secret_salt=salt,
            items=items,
        )

    @staticmethod
    def verify_reveal(reveal_manifest: Dict[str, Any], expected_commit_hash: str) -> bool:
        """Verify that revealed labels and salt match the pre-registered commitment."""
        recomputed = compute_sha256_hex(canonical_json_bytes(reveal_manifest))
        return recomputed.lower() == expected_commit_hash.lower()

    @staticmethod
    def evaluate(
        model_hash: str,
        commitment: CanaryCommitment,
        predictions: List[Dict[str, Any]],  # [{ item_id, p_fake, verdict }]
        auc_min_bps: int = 8000,
        ece_max_bps: int = 1500,
    ) -> CanaryMetrics:
        """
        Evaluate predictions against ground-truth labels from commitment.
        verdict: 0=ABSTAIN, 1=LIKELY_AUTHENTIC, 2=LIKELY_SYNTHETIC
        """
        pred_map = {p["item_id"]: p for p in predictions}

        y_true_list = []
        y_prob_list = []
        non_abstain_count = 0

        for item in commitment.items:
            pred = pred_map.get(item.item_id)
            if not pred:
                raise ValueError(f"Missing prediction for item_id: {item.item_id}")

            y_true_list.append(item.label)
            y_prob_list.append(float(pred["p_fake"]))

            if int(pred.get("verdict", 0)) != 0:
                non_abstain_count += 1

        y_true = np.array(y_true_list, dtype=int)
        y_prob = np.array(y_prob_list, dtype=float)
        n = len(y_true)

        # 1. AUC
        try:
            auc = float(roc_auc_score(y_true, y_prob))
        except Exception:
            auc = 0.5

        # 2. ECE
        ece = compute_ece(y_true, y_prob, n_bins=15)

        # 3. Coverage
        coverage = float(non_abstain_count / n) if n > 0 else 0.0

        auc_bps = int(round(auc * 10000))
        ece_bps = int(round(ece * 10000))
        coverage_bps = int(round(coverage * 10000))

        # Degradation condition per Spec §6
        is_degraded = (auc_bps < auc_min_bps) or (ece_bps > ece_max_bps)

        return CanaryMetrics(
            batch_id=commitment.batch_id,
            model_hash=model_hash,
            labels_commit_hash=commitment.labels_commit_hash,
            n=n,
            auc_bps=auc_bps,
            ece_bps=ece_bps,
            coverage_bps=coverage_bps,
            is_degraded=is_degraded,
            auc_min_bps=auc_min_bps,
            ece_max_bps=ece_max_bps,
        )
