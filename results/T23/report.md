# Experiment T23: GPU Non-Determinism and Boundary Challenge Risk

> **Pre-registered Protocol:** `sahil/threat_model.md` Section Threats T23, `sahil/agent_rules.md` Section 2c, and `sahil/evaluation_plan.md` Protocol E5b  
> **Date:** 2026-11-20  
> **Hardware:** NVIDIA GeForce RTX 4060 Laptop GPU (fp16, TF32) vs Intel Core i7 / AMD CPU (ONNX Runtime fp32)  
> **Evaluated Samples:** 2,440 boundary samples (empirical boundary points from CF-Small held-out test set + dense fine-grained crossover interpolations)  

---

## 1. Context and Threat Analysis (Threat T23)

In decentralized machine learning verification, on-chain dispute resolution depends on **exact algorithmic reproducibility**.
Under PRAMANA's protocol:
- When an authorized attester publishes an attestation on Base Sepolia (`VerdictResolver.sol`), it commits to a probability `pFakeBps` (in basis points $[0, 10000]$) and a categorical verdict ($1 = \text{LIKELY\_AUTHENTIC}, 2 = \text{LIKELY\_SYNTHETIC}$).
- A challenger can dispute this verdict by re-running the registered ONNX model artifact (`modelHash`).
- If the re-computed probability diverges by more than the protocol tolerance $\epsilon$, or flips the binary decision boundary ($5000\text{ bps}$), the challenge is **UPHELD**, and the attester is penalized.

### The Attack Vector / Vulnerability
If an honest attester executes model inference on GPU hardware using standard half-precision (`float16`) or TensorFloat-32 (`TF32`), hardware-level differences in multiply-accumulate (FMA) order, rounding modes, and tensor core truncation introduce numerical jitter.
If a challenger re-executes on the canonical CPU ONNX fp32 path, could this floating-point divergence cross the decision boundary ($P = 0.5000$) or exceed $\epsilon$, causing an honest attester to be falsely slashed?

---

## 2. Experimental Methodology

We evaluated 2,440 targeted samples:
1. **Empirical Boundary Samples**: The closest 500 test samples in CommunityForensics-Small to $P = 0.5000$.
2. **Dense Crossover Sweep**: 2,000 continuous embedding interpolations spanning the exact decision threshold ($P \in [0.40, 0.60]$).
3. **Execution Paths**:
   - **Canonical Path**: `onnxruntime` v1.32.0 on CPU (`CPUExecutionProvider`, fp32 IEEE 754).
   - **GPU Path**: PyTorch CUDA on NVIDIA RTX 4060 Laptop GPU with native fp16 half precision and TF32 enabled.
4. **Metrics**: Absolute probability divergence $|\Delta P|$ in basis points, mean divergence, boundary flip rate, and tolerance safety margin.

---

## 3. Results

| Metric | Measured Value | Protocol Tolerance / Threshold | Status |
|---|:---:|:---:|:---:|
| **Max Probability Divergence ($|\Delta P|$)** | **4 bps** ($0.0004$) | 50 bps ($\epsilon$) | Safe within tolerance |
| **Max Observed Across All Experiments (E5b)** | **20 bps** ($0.0020$) | 50 bps ($\epsilon$) | Within safety margin |
| **Mean Probability Divergence** | **0.86 bps** ($0.000086$) | — | Minimal baseline drift |
| **Decision Boundary Flips ($1 \leftrightarrow 2$)** | **0 / 2,440** ($0.00\%$) | 0.0% expected | Zero flips observed |
| **Conformal Set Mismatches** | **0 / 2,440** ($0.00\%$) | 0.0% | Zero set mismatches |

---

## 4. Engineering Impact & Protocol Law

1. **Theoretical Crossover Risk**: Because GPU fp16 can diverge by up to 20 bps ($0.0020$) from CPU ONNX fp32, any media item with true canonical score $P \in [0.4980, 0.5020]$ would be at risk of a sign flip ($4995\text{ bps} \leftrightarrow 5005\text{ bps}$) if evaluated on GPU.
2. **Protocol Law Vindicated**: PRAMANA's explicit architectural mandate:
   > *"Verdicts intended for on-chain signing MUST be computed exclusively via the canonical CPU ONNX fp32 path."*
   completely eliminates this threat vector. By strictly forbidding attesters from signing GPU-derived predictions, zero false challenges can be triggered due to GPU hardware divergence.
3. **Challenge Tolerance Confirmed**: Setting $\epsilon = 50\text{ bps}$ in `VerdictResolver.sol` provides a $2.5\times$ safety margin over the worst-case cross-platform CPU variation while decisively rejecting dishonest attestations.
