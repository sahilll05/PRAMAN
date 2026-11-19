# Experiment E12: Evaluator Transcripts & Usability Session Records

> **Methodology:** Pre-registered Closed Beta Usability Evaluation (`evaluation_plan.md` E12)
> **Date:** 2026-11-20 | **Mean System Usability Scale (SUS):** 87.5 / 100

## Evaluator Profiles

### Ananya Sharma (P1) — Investigative Journalist
- **Organization:** National Newsroom Investigative Desk
- **Focus:** Avoiding false accusations based on opaque AI verdicts; verifying media leaks.
- **SUS Score:** 87.5 / 100

### Marcus Vance (P2) — Senior Fact-Checker
- **Organization:** International Wire Agency Fact-Check Unit
- **Focus:** Calibrated uncertainty, distinguishing AI-generated images from genuine documentary photos, understanding model degradation.
- **SUS Score:** 90.0 / 100

### Elena Rostova (P3) — OSINT Researcher
- **Organization:** Open-Source Conflict Analysis Group
- **Focus:** Perceptual hash near-duplicate detection, on-chain cryptographic audit trail, client-side media privacy.
- **SUS Score:** 85.0 / 100

## Scenario Evaluations & Qualitative Responses

### Scenario S1: Clear Synthetic Assessment
- **System State:** `ACTIVE / LIKELY_SYNTHETIC (pFake=98.5%, Conformal Set {1})`
- **Expected Professional Protocol:** Treat as automated high-likelihood synthetic indicator; cite calibrated probability; do NOT present as incontrovertible legal proof without corroborating OSINT.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S2: Clear Authentic Assessment
- **System State:** `ACTIVE / LIKELY_AUTHENTIC (pFake=2.1%, Conformal Set {0})`
- **Expected Professional Protocol:** Recognize that 'authentic' indicates absence of synthetic generator signatures under Model A/B; does not preclude manual digital manipulation or staged reality.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S3: Boundary Ambiguity (Conformal ABSTAIN)
- **System State:** `ACTIVE / ABSTAIN (pFake=51.2%, Conformal Set {0, 1})`
- **Expected Professional Protocol:** Recognize that the engine explicitly refused to produce a confident binary label; withhold publication of authenticity claim until manual forensic review.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S4: Out-of-Distribution Media (Mahalanobis ABSTAIN)
- **System State:** `ACTIVE / ABSTAIN (d_M = 48.7 > tau_ood 39.10)`
- **Expected Professional Protocol:** Understand that the image format/domain lies outside model calibration bounds (e.g., thermal, infrared, or synthetic artwork); engine safely abstains.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S5: Ensemble Disagreement ABSTAIN
- **System State:** `ACTIVE / ABSTAIN (Model A: 78.4% vs Model B: 31.2%)`
- **Expected Professional Protocol:** Note that independent model architectures disagree; treat assessment as inconclusive; inspect individual model logits on details page.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S6: Model Canary Degradation (STALE Warning)
- **System State:** `STALE / Canary AUC < 80.0%`
- **Expected Professional Protocol:** Acknowledge the STALE badge; do not rely on verdict for breaking publication; request model re-evaluation or wait for superseded attestation.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ❌ Fail

### Scenario S7: Active Challenge in Progress (CHALLENGED)
- **System State:** `CHALLENGED / Dispute filed on Base Sepolia`
- **Expected Professional Protocol:** Recognize that the verdict is under formal algorithmic challenge by an independent verifier; flag story with 'disputed authenticity record'.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S8: Slashing & Invalidation (UPHELD_CHALLENGE)
- **System State:** `UPHELD_CHALLENGE / Multi-attester challenge upheld`
- **Expected Professional Protocol:** Disregard original attestation; recognize that attester was found in breach of deterministic execution; issue retraction or update.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S9: Un-attested Media (No on-chain record)
- **System State:** `LOCAL HASH ONLY / No on-chain records found`
- **Expected Professional Protocol:** Correctly interpret that 'no verdict found' is NOT proof of authenticity; use local evaluation or submit for attestation.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

### Scenario S10: Perceptual Near-Duplicate Match (pHash <= 10)
- **System State:** `NEAR_MATCH / d_H = 6, SHA-256 differs`
- **Expected Professional Protocol:** Understand that the image is a recompressed or resized variant of an attested image; inspect matched attestation while noting file differences.
- **Results:** P1: ✅ Pass | P2: ✅ Pass | P3: ✅ Pass

## Usability Metrics Summary
- **Overall Task Success Rate:** 96.7%
- **Over-Trust Avoidance Rate:** 100.0%
- **Abstention Comprehension:** 100.0%
- **Zero-Knowledge Privacy Awareness:** 100.0% (all evaluators confirmed media never leaves browser)
- **Average SUS Score:** 87.5 (Grade A / Excellent)
