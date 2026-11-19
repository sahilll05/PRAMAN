"""Unit tests for Phase 2 Calibration, OOD Gating, and Conformal Uncertainty modules."""

import numpy as np

from lv_ml.calibration.conformal import ConformalPredictor
from lv_ml.calibration.ensemble import UnifiedVerdictEngine
from lv_ml.calibration.ood_gate import MahalanobisOODGate
from lv_ml.calibration.temperature import (
    TemperatureScaler,
    compute_binary_ece,
    compute_calibration_metrics,
)


def test_temperature_scaler_reduces_nll() -> None:
    # Synthetic uncalibrated overconfident logits
    np.random.seed(42)
    labels = np.random.randint(0, 2, size=200)
    # Logits scaled artificially high to create miscalibration
    logits = np.where(labels == 1, 5.0, -5.0) + np.random.randn(200) * 2.0

    scaler = TemperatureScaler(temperature=1.0)
    opt_temp = scaler.fit(logits, labels)

    assert opt_temp > 0.0
    cal_probs = scaler.predict_proba(logits)
    assert np.all(cal_probs >= 0.0) and np.all(cal_probs <= 1.0)

    uncal_probs = 1.0 / (1.0 + np.exp(-logits))
    uncal_metrics = compute_calibration_metrics(uncal_probs, labels)
    cal_metrics = compute_calibration_metrics(cal_probs, labels)

    # Temperature scaling should reduce or match NLL
    assert cal_metrics["nll"] <= uncal_metrics["nll"] + 1e-5


def test_binary_ece_bounds() -> None:
    probs = np.array([0.1, 0.2, 0.8, 0.9])
    labels = np.array([0, 0, 1, 1])

    ece_mass = compute_binary_ece(probs, labels, num_bins=2, strategy="equal_mass")
    ece_width = compute_binary_ece(probs, labels, num_bins=2, strategy="equal_width")

    assert 0.0 <= ece_mass <= 1.0
    assert 0.0 <= ece_width <= 1.0


def test_mahalanobis_ood_gate() -> None:
    np.random.seed(42)
    # Generate 2 distinct in-distribution clusters
    train_0 = np.random.randn(100, 16) - 2.0
    train_1 = np.random.randn(100, 16) + 2.0
    train_embs = np.vstack([train_0, train_1])
    train_labels = np.array([0] * 100 + [1] * 100)

    cal_0 = np.random.randn(20, 16) - 2.0
    cal_1 = np.random.randn(20, 16) + 2.0
    cal_embs = np.vstack([cal_0, cal_1])

    gate = MahalanobisOODGate(lambda_reg=1e-3)
    thresh = gate.fit(train_embs, train_labels, cal_embs, percentile=95.0)

    assert thresh > 0.0

    # In-distribution sample should have distance <= threshold mostly
    in_dist = (np.random.randn(1, 16) + 2.0).astype(np.float64)
    dist_in, is_ood_in = gate.score_and_gate(in_dist)

    # Strong OOD sample far away
    out_dist = np.full((1, 16), 50.0, dtype=np.float64)
    dist_out, is_ood_out = gate.score_and_gate(out_dist)

    assert dist_out > dist_in
    assert is_ood_out is True


def test_conformal_prediction_coverage() -> None:
    np.random.seed(42)
    n_cal = 300
    cal_labels = np.random.randint(0, 2, size=n_cal)
    cal_probs = np.where(cal_labels == 1, 0.85, 0.15) + np.random.randn(n_cal) * 0.05
    cal_probs = np.clip(cal_probs, 0.01, 0.99)

    predictor = ConformalPredictor(alpha=0.10)
    q_hat = predictor.calibrate(cal_probs, cal_labels)

    assert 0.0 < q_hat <= 1.0

    # Test empirical coverage on independent draw from same distribution
    n_test = 200
    test_labels = np.random.randint(0, 2, size=n_test)
    test_probs = np.where(test_labels == 1, 0.85, 0.15) + np.random.randn(n_test) * 0.05
    test_probs = np.clip(test_probs, 0.01, 0.99)

    cov_stats = predictor.evaluate_coverage(test_probs, test_labels)
    # Empirical coverage should be close to 0.90 (allow small finite-sample variance)
    assert cov_stats["empirical_coverage"] >= 0.80


def test_unified_verdict_engine_abstention() -> None:
    scaler_a = TemperatureScaler(temperature=1.0)
    scaler_b = TemperatureScaler(temperature=1.0)
    conformal_a = ConformalPredictor(alpha=0.10, q_hat=0.30)
    conformal_b = ConformalPredictor(alpha=0.10, q_hat=0.30)

    # Dummy OOD gate with low threshold to force OOD
    gate = MahalanobisOODGate(
        mu_0=np.zeros(4),
        mu_1=np.zeros(4),
        precision_matrix=np.eye(4),
        threshold=1.0,
    )

    engine = UnifiedVerdictEngine(scaler_a, scaler_b, conformal_a, conformal_b, gate)

    # 1. Test OOD trigger -> ABSTAIN (verdict 0)
    ood_emb = np.array([10.0, 10.0, 10.0, 10.0])
    res_ood = engine.evaluate(ood_emb, logit_a=2.0, logit_b=2.0)
    assert res_ood["verdict"] == 0
    assert "OOD_DISTANCE_EXCEEDED" in res_ood["reasons"]

    # 2. Test model disagreement -> ABSTAIN (verdict 0)
    in_emb = np.array([0.1, 0.1, 0.1, 0.1])
    res_disagree = engine.evaluate(in_emb, logit_a=3.0, logit_b=-3.0)
    assert res_disagree["verdict"] == 0
    assert "ENSEMBLE_MODEL_DISAGREEMENT" in res_disagree["reasons"]

    # 3. Test agreement -> LIKELY_SYNTHETIC (verdict 2)
    res_agree_synth = engine.evaluate(in_emb, logit_a=4.0, logit_b=4.0)
    assert res_agree_synth["verdict"] == 2
    assert res_agree_synth["p_fake_bps"] > 9000
    assert len(res_agree_synth["reasons"]) == 0
