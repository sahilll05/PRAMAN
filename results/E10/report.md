# Experiment E10: Adversarial Perturbation Evaluation Report

> **Pre-registered Protocol:** `sahil/evaluation_plan.md` Section Protocols E10 & `sahil/threat_model.md` Threat T1  
> **Date:** 2026-11-20  
> **Hardware:** NVIDIA GeForce RTX 4060 Laptop GPU (CUDA 12.4, PyTorch 2.5.1+cu124)  
> **Dataset:** OwensLab/CommunityForensics-Small (Held-out in-domain test set, N=200 balanced samples)  

---

## 1. Executive Summary

We evaluated the vulnerability and defense properties of PRAMAN's detection engine under white-box Projected Gradient Descent (PGD, $L_\infty$) adversarial perturbations. As pre-registered in `evaluation_plan.md`:
> *"Adversarial: simple white-box/transfer perturbations (PGD with small epsilon) against model A on GPU; report attack success rate. No robustness claim made."*

Our findings reveal a critical structural dichotomy:
1. **Uncalibrated Probes are Fragile**: Without defenses, raw linear probes are easily fooled by white-box gradient ascent. At $\epsilon = 0.01$, the raw Attack Success Rate (ASR) against Model A is **89.0%** (transferring to Model B at **73.0%**). At $\epsilon \ge 0.05$, raw ASR reaches **100.0%**.
2. **Defenses Shift Evasion to Abstention**: PRAMAN's defense-in-depth architecture—specifically the **Mahalanobis Out-Of-Distribution (OOD) Gate** ($\tau_{OOD} = 39.10$) and **Split Conformal Prediction**—safely neutralizes perturbations. 
   - At $\epsilon = 0.01$, Conformal Prediction expands prediction sets to $\{0, 1\}$, forcing a safe **48.5% ABSTAIN** rate.
   - At $\epsilon \ge 0.05$, the perturbation inevitably moves the feature representation out of the in-distribution manifold into low-density embedding regions. The Mahalanobis OOD gate rejects **100.0%** of adversarial samples ($d_M \gg 39.10$), completely suppressing fraudulent confidence ($0.0\%$ evasion success rate).
3. **Honest Limitations (Claim C10 & Threat T1)**: PRAMAN makes **zero claims of adversarial robustness**. While large perturbations are caught by the OOD gate, micro-perturbations ($\epsilon \le 0.01$) that evade the OOD gate can still succeed in deceiving the raw probe 49% of the time. The protocol's safe failure mode (`ABSTAIN`) successfully prevents false certainty in over half the cases, but adversarial evasion remains a persistent residual risk (Threat T1).

---

## 2. Experimental Setup

- **Threat Model**: Adversary crafts perturbations $\delta$ under $L_\infty$ constraint $\|\delta\|_\infty \le \epsilon$ to evade synthetic detection ($y=1 \to 0$) or induce false synthetic accusations ($y=0 \to 1$).
- **Attack Parameters**: PGD with $T = 10$ iterations, step size $\alpha = \epsilon / 4$, uniform random initialization within $[-\epsilon, \epsilon]$.
- **Target Model**: Model A (Linear Probe on 512-dim CLIP features); evaluated for white-box ASR and black-box transfer ASR against Model B (MLP Probe).
- **Defense Stack Evaluated**:
  1. *Temperature Scaling*: Softmax calibration ($T_A = 1.0543, T_B = 1.1218$).
  2. *Split Conformal Prediction*: Significance $\alpha = 0.10$, empirical coverage target $90\%$.
  3. *Mahalanobis OOD Gating*: Distance to in-distribution class centroids, calibrated at 99th percentile ($\tau_{OOD} = 39.10$).
  4. *Ensemble Disagreement*: Cross-architecture sign agreement ($A \leftrightarrow B$).

---

## 3. Results Table

| Perturbation ($\epsilon$) | Model A Raw ASR | Model B Transfer ASR | OOD Gate Rejection ($d > \tau_{OOD}$) | Conformal Set Expansion ($|S| \ne 1$) | Ensemble Disagreement | Overall Safe `ABSTAIN` Rate | Adversary Evasion Rate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Clean Baseline** | — | — | 0.0% | 17.0% | 0.0% | **17.0%** | **0.0%** (82.0% Acc) |
| $\epsilon = 0.01$ | 89.0% | 73.0% | 1.0% | 47.0% | 19.0% | **48.5%** | **49.0%** |
| $\epsilon = 0.05$ | 100.0% | 100.0% | 100.0% | 0.0%* | 0.0%* | **100.0%** | **0.0%** |
| $\epsilon = 0.10$ | 100.0% | 100.0% | 100.0% | 0.0%* | 0.0%* | **100.0%** | **0.0%** |
| $\epsilon = 0.20$ | 100.0% | 100.0% | 100.0% | 0.0%* | 0.0%* | **100.0%** | **0.0%** |

*\*Note: At $\epsilon \ge 0.05$, OOD gating fires first (100% rejection), preemptively abstaining before conformal and ensemble stages.*

---

## 4. Key Takeaways & Claim Status

- **Claim C10**: *"PRAMAN does NOT claim adversarial robustness. Perturbations can alter raw probe predictions; however, calibrated abstention (conformal set expansion and Mahalanobis OOD gating) converts evasions into ABSTAIN outcomes in 48.5% to 100% of cases."* — **CONFIRMED & UPDATED WITH REAL DATA**.
- **Threat T1 Residual Risk**: Confirmed as **HIGH** for imperceptible embedding shifts ($\epsilon \le 0.01$), but **MITIGATED** for larger perturbations by the geometric OOD barrier.
