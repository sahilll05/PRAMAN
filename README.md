# PRAMANA (प्रमाण)

> **Evidence-Driven, Temporally Validated, and Challengeable AI-Generated Image Authenticity Verification**  
> *A decentralized protocol and reference implementation deployed on Base Sepolia testnet.*

[![CI - Python Tests](https://img.shields.io/badge/pytest-27%20passed-brightgreen.svg)](#testing--verification)
[![CI - TypeScript Tests](https://img.shields.io/badge/vitest-9%20passed-brightgreen.svg)](#testing--verification)
[![Smart Contracts](https://img.shields.io/badge/foundry-forge-blue.svg)](#smart-contracts--eas)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia%20(84532)-blue.svg)](#protocol-architecture)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Non--Commercial-lightgrey.svg)](#ethics--licensing)
[![Spec Version](https://img.shields.io/badge/spec-0.1.0--draft-orange.svg)](spec/schemas/verdict.schema.json)

---

## 1. Executive Summary & Problem

Modern generative diffusion and transformer models (e.g., Stable Diffusion 3.5, Flux, DALL-E 3) make synthetic still imagery increasingly indistinguishable from optical photography. While conventional deepfake detectors report high closed-set benchmark accuracy, they suffer from severe real-world vulnerabilities:
1. **Distributional Collapse & Generator Shift**: Detectors trained on past generative models experience substantial degradation when exposed to unseen architectures, latent spaces, or real-world social media compression pipelines.
2. **Epistemological Permanence Fallacy**: Treating an authenticity verdict as a static, irrevocable stamp is fundamentally flawed. A classification that appears sound today may be refuted tomorrow as generator families shift and new forensic models emerge.
3. **Opaque, Centralized Oracles**: Proprietary APIs output unversioned probabilities without public evidence bundles, without reproducible code, and with zero recourse for affected individuals to contest incorrect labels.

### The PRAMANA Solution
**PRAMANA** rejects the concept of an unquestionable "truth oracle." Instead, it treats media authenticity as an **expiring, versioned, challengeable, and re-executable on-chain claim** built on open-weight deterministic detectors and the **Ethereum Attestation Service (EAS)** on Base Sepolia testnet.

```
                             [ User Image (Local) ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [ Browser Web Verifier ]                       [ Local Attester Node ]
   - Streaming SHA-256 (hash-wasm)               - Open-weight Vision Backbone (CLIP)
   - DCT-II Perceptual Hash (spec §4)            - Linear & MLP Detector Heads
   - Look up on-chain timeline                   - Canonical ONNX CPU fp32 Runner
   - ZERO MEDIA UPLOAD (Privacy First)           - Generates verdict.json + evidence.json
                │                                             │
                │                                             ▼
                │                            [ Base Sepolia: EAS & VerdictResolver ]
                │                               - Schema Registry & Attestation UID
                │                               - Expiration timestamp & refUID
                │                               - Challenge & Supersession flow
                ▼                                             │
   [ On-Chain Assessment Timeline ] ◄─────────────────────────┘
   - ACTIVE / STALE / SUPERSEDED / CHALLENGED
   - Model version, confidence, & evidence hash
   - Transparent contestation / challenge link
```

---

## 2. Core Architectural Pillars

### 1. Deterministic Reference Runner (spec §7.6)
To enable fraud-proof challenge mechanics, model execution must be strictly reproducible across disparate machines and operating systems.
- **Canonical Attestation Path**: Executed strictly on **CPU ONNX Runtime (fp32)** with pinned preprocessor pipelines, single-thread execution, and fixed math kernels.
- **GPU Acceleration**: Training, feature extraction, and high-throughput evaluation run on GPU (NVIDIA RTX 4060 Laptop GPU, fp16).
- **CPU-vs-GPU Numerical Parity (Experiment E5b)**: Evaluated across $N=200$ test images, the GPU fp16 fast path and canonical CPU ONNX path agreed within a **maximum difference of 20 basis points (0.20%)**, a **mean difference of 3.00 basis points (0.030%)**, and achieved a **0.0% verdict mismatch rate** ([results/E5b/metrics.json](results/E5b/metrics.json)).

### 2. On-Chain Attestation Lifecycle (EAS on Base Sepolia)
Verdicts are formalized as revocable attestations registered in EAS with a custom `VerdictResolver`:
- **Expiration & Time-To-Live (TTL)**: Native EAS `expirationTime` (default 180 days) enforces periodic re-evaluation.
- **Supersession (`refUID`)**: When a superior model emerges, a keeper node or attester issues an updated verdict referencing the older attestation UID, maintaining a complete lineage.
- **Optimistic Challenge Flow**: Any allowlisted attester can independently re-execute the exact pinned model bundle on the original media. If the re-computed probability differs beyond the registered tolerance ($\epsilon$), a counter-challenge attestation is published on-chain.
- **Canary Degradation**: Maintainer-issued canary rounds continuously monitor detector versions against fresh test sets. If a model's canary metrics fall below acceptable thresholds, the status state machine flags all associated verdicts as **STALE**.

### 3. Client-Side Privacy-First Web Verifier
- Media files **never leave the user's browser**.
- Streaming cryptographic SHA-256 and normative 64-bit perceptual hashing (spec §4 DCT-II) are computed entirely client-side via WebAssembly (`hash-wasm`).
- The web interface queries the indexer exclusively using hashes, retrieving the full attestation timeline, model versions, evidence hashes, and appeal forms without uploading pixels to any server.

### 4. Rigorous Scientific Discipline & Pre-Registered Shortcut Audit (E13)
Benchmark datasets often contain spurious shortcuts (e.g., PNG synthetic images vs. JPEG photographic images). PRAMANA pre-registers a formal shortcut audit before reporting results:
- A metadata-only classifier achieved an AUC of 1.0000 on raw files due to file format artifacts.
- When applying strict **uniform equalization preprocessing** (224×224 bicubic downsampling, EXIF stripped, uniform JPEG quality 85 recompression), Model A maintained **0.9818 AUC** (vs. 0.9891 raw, $\Delta = -0.0073$) and Model B maintained **0.9911 AUC** (vs. 0.9957 raw, $\Delta = -0.0046$), proving that detection relies on deep visual-semantic features rather than container artifacts ([results/E13/metrics.json](results/E13/metrics.json)).

---

## 3. Empirical Benchmark Results (Phase 1 Ground Truth)

All evaluations are conducted on **Tier A open-access datasets** ([OwensLab/CommunityForensics-Small](https://huggingface.co/datasets/OwensLab/CommunityForensics-Small), [ComplexDataLab/OpenFake](https://huggingface.co/datasets/ComplexDataLab/OpenFake), and [COCO val2017](https://cocodataset.org)). All metrics reflect actual local executions with committed configurations and git SHAs:

| Experiment | Target Hypothesis | Protocol & Dataset | Primary Metric (Model A / Model B) | Status |
|---|---|---|---|---|
| **E1** | In-Domain Sanity | Balanced CF-Small + COCO test set ($N=440$) | **AUC: 0.9891 / 0.9957**<br>Accuracy: 93.4% / 96.6%<br>Precision: 97.5% / 95.6% | **PASSED** (Target $>0.80$ met) |
| **E2** | Generator-Disjoint | Held-out generator (`AbyssOrangeMix`) vs. COCO ($N=56$, zero training leak) | **AUC: 1.0000 / 0.9949**<br>Accuracy: 100.0% / 96.4% | **PASSED** (Generalizes to held-out diffusion model) |
| **E2b** | Cross-Dataset (Zero-Shot) | OpenFake core sample ($N=161$): Flux.1, DALL-E 3, SD 3.5, GPT-Image-1, SDXL | **Synthetic Recall: 83.9% / 90.8%**<br>Zero-shot AUC: 0.6541 / 0.6707<br>Uncalibrated ECE: 0.1286 / 0.3598 | **DOCUMENTED** (Reflects expected cross-dataset domain shift) |
| **E2c** | In-The-Wild Evaluation | OpenFake Reddit social media images ($N=62$) | **Synthetic Recall: 100.0% / 96.4%**<br>AUC: 0.8571 / 0.7096 | **DOCUMENTED** (High recall under social distribution) |
| **E3** | Transformation Robustness | Stress test on $N=200$ images under JPEG (Q95, Q75, Q50, Q30), resize (0.75, 0.50), blur, and noise | **AUC remains $>0.962$** under all conditions (JPEG Q30 AUC: 0.9828, 50% resize AUC: 0.9684) | **PASSED** (Stable under heavy degradation) |
| **E4** | Risk-Coverage & Abstention | Temperature scaling, Mahalanobis OOD gate, and Split Conformal Prediction evaluated on shifted OpenFake data | **Selective Acc @ 80% cov: 61.2%** (vs 59.0% at 100% cov)<br>Unified Engine Acc: **67.0%** at 58.4% natural coverage<br>In-domain calibrated ECE: **0.0399 / 0.0163** | **PASSED** (Target met: positive abstention value under generator shift) |
| **E5** | Determinism (CPU-CPU) | Independent CPU ReferenceRunner executions on $N=200$ test images | **Max diff: 0 bps (0.00%)**<br>Mean diff: 0.00 bps<br>**Verdict mismatch rate: 0.0%** (0/200) | **PASSED** (Bit-level determinism confirmed, $\epsilon=10$ bps) |
| **E5b** | CPU-vs-GPU Parity | Numerical difference between GPU fp16 and CPU ONNX fp32 on $N=200$ images | **Max diff: 20 bps (0.20%)**<br>Mean diff: 3.0 bps (0.030%)<br>**Verdict mismatch rate: 0.0%** | **PASSED** (Tolerance bounded within 25 bps) |
| **E6** | Perceptual Hashing (pHash) | pHash v1 DCT-II threshold sweep on $N=200$ images, 19,900 unmatched pairs across 8 transforms | **Composite Recall: 100.0%**<br>**False Match Rate: 0.0000%** at $T=10$<br>Unmatched min dist: 16 bits (mean 31.45)<br>Separation margin: $\ge 6$ bits | **PASSED** ($T=10$ frozen in ADR `D-PHASH-T`) |
| **E7** | TrustMark Watermark Survival | TrustMark variant Q (BCH_5 ECC, 40-bit ID) under JPEG Q95-Q30, resize 0.75/0.50, blur | **Clean Recovery: 100.0%**<br>JPEG 95/75: **100.0%** \| JPEG 50: **95.0%**<br>Resize 0.75/0.50: **100.0%**<br>Avg PSNR: **41.55 dB** (SSIM: 0.9995) | **PASSED** (High fidelity & survival) |
| **T3.4** | Neon Postgres Bit Ops Benchmark | 64-bit perceptual hash bitwise XOR and popcount query across $N=10,000$ and $N=100,000$ hashes | **10k Search Latency: 1.02 ms** (TS) / **1.26 ms** (Python)<br>100k Latency: 12.5 ms<br>Postgres query: `bit_count(p_hash # $1::bit(64)) <= 10` | **PASSED** (Budget $<5\text{ ms}$ met) |
| **E13** | Shortcut Audit | Metadata-only classification vs. uniform equalization (224px, JPEG Q85) | **Equalized AUC: 0.9818 / 0.9911**<br>$\Delta \text{AUC}: -0.0073 / -0.0046$ | **PASSED** (Eliminates container metadata shortcuts) |

*Full experiment configs, metrics, and environment logs are archived under [`results/`](results/).*

---

## 4. Repository Structure

```
PRAMANA/
├── spec/                       # Authoritative Canonical Specification
│   ├── schemas/                # JSON Schemas (verdict.schema.json, evidence.schema.json)
│   └── vectors/                # Golden test vectors shared across Python & TypeScript
├── sahil/                      # Project Memory, ADRs, & Verification Ledger
│   ├── agent_rules.md          # Hard agent operating constraints & zero-spend rules
│   ├── spec_schemas.md         # Normative protocol specification (v0.1.0-draft)
│   ├── claims.md               # Evidence-backed claim ledger
│   ├── decisions.md            # Architecture Decision Records (ADRs)
│   ├── evaluation_plan.md      # Pre-registered experimental protocols & frozen targets
│   └── progress.md             # Live phase tracking and locks
├── ml/                         # Python ML & Detection Layer
│   ├── src/lv_ml/
│   │   ├── fingerprint/        # Spec §4 pHash (DCT-II) & SHA-256 implementation
│   │   ├── features/           # Mixed-precision CLIP ViT-B-32 GPU embedding extractor
│   │   ├── models/             # PyTorch Model A (Linear Probe) & Model B (MLP Probe)
│   │   ├── runner/             # CPU ONNX Reference Runner & ONNX exporter
│   │   └── eval/               # Shortcut audit (E13) & benchmark suite (E1–E5b)
│   ├── scripts/                # Data download, split generation, and training pipelines
│   └── tests/                  # Pytest test suite (schemas, pHash, models, runners)
├── contracts/                  # Solidity Smart Contracts (Foundry)
│   ├── src/                    # Registry.sol & VerdictResolver.sol
│   └── test/                   # Fuzz, invariant, and unit tests
├── chain/                      # TypeScript Chain CLI (viem + EAS SDK)
├── indexer/                    # Event Indexer & Status State Machine (Drizzle + Postgres)
├── web/                        # Next.js Web Verifier (Tailwind + hash-wasm)
└── results/                    # Committed experiment results, configs, and git SHAs
```

---

## 5. Getting Started & Reproduction

### Prerequisites
- Python 3.11+
- Node.js 20+ & `pnpm`
- Foundry (`forge`, `anvil`)
- NVIDIA GPU with CUDA 12.4+ (optional; inference reference runner operates on CPU)

### Installation
```bash
# Clone the repository
git clone https://github.com/sahilll05/PRAMANA.git
cd PRAMANA

# 1. Setup ML Python virtual environment
cd ml
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -e .

# 2. Setup TypeScript workspace
cd ..
pnpm install

# 3. Setup Foundry contracts
cd contracts
forge build
```

### Running the Reference CPU Runner
Generate a canonical on-chain verdict and evidence bundle for an image:
```bash
python -m lv_ml.runner.cpu_runner \
  --image path/to/sample.jpg \
  --model dataset/models/model_a.onnx
```

### Running Test Suites
```bash
# Python unit tests & schema validation
pytest ml/tests/

# TypeScript workspace tests (chain, indexer, web)
pnpm -r test

# Foundry smart contract fuzz & invariant tests
cd contracts && forge test
```

---

## 6. On-Chain EAS Payload & Verdict Schema

Verdicts adhere to `spec/schemas/verdict.schema.json` and map 1-to-1 to the EAS Schema on Base Sepolia:

```json
{
  "specVersion": "0.1.0-draft",
  "evidenceHash": "c1ca534d515861af5d896d5275952a32ff3c592e5b0cf6efcf7879b81b7f0eed",
  "onChain": {
    "sha256Hash": "6287d00fe8340bb3f5b8069169d0d6a9000c431535ed91928956ebb6e8a2f4bc",
    "pHash": "319e6ce0e8b36c8a",
    "wmId": "0",
    "modelHash": "b061468a9abc417e5f6770086b4637d3e9b4d4f907a2b0b78876be92c69790d3",
    "preprocHash": "31f18fa7aa9bae0bc79ba37fc529afbd6aa2a23f7c4603015745956feb46749d",
    "pFakeBps": 7381,
    "verdict": 2,
    "evidenceHash": "c1ca534d515861af5d896d5275952a32ff3c592e5b0cf6efcf7879b81b7f0eed",
    "expirationTime": 1810660611
  }
}
```

- `verdict`: `0` = ABSTAIN, `1` = LIKELY_AUTHENTIC, `2` = LIKELY_SYNTHETIC.
- `pFakeBps`: Basis points representation of calibrated probability ($7381 = 73.81\%$).
- `evidenceHash`: SHA-256 digest of canonicalized JSON evidence bundle containing runtime hardware info, pinned dependency versions, calibration parameters, and reproduction CLI command.

---

## 7. Required Caveats & Honest Disclosures

In accordance with PRAMANA's strict claims policy ([sahil/claims.md](sahil/claims.md)):
1. **Model-Assessed Likelihood, Not an Oracle Ruling**: Verdicts reflect deterministic outputs of open forensic models at a point in time. They are not definitive statements of ontological truth.
2. **MVP Modality Scope**: The MVP strictly evaluates **still images** (AI-generated vs. authentic photography). Video deepfakes, audio synthesis, and face-swaps are deferred to stretch phases.
3. **Zero-Spend Non-Commercial Research**: The project operates with zero capital expenditure ($0). Deployment is restricted to **Base Sepolia testnet** using free testnet ETH. Mainnet deployment is explicitly out of scope.
4. **Local Attester Requirement**: New on-chain attestations appear only when an attester node executes the open runner locally. Images are never scanned by a hosted cloud service.
5. **Non-Commercial Dataset Licensing**: Training utilizes `OwensLab/CommunityForensics-Small` (CC-BY-NC-SA-4.0) and `ComplexDataLab/OpenFake` (CC-BY-NC-4.0). Any redistributed model weights carry non-commercial research restrictions.
6. **Centralized Initial Allowlist**: In v1, attester addresses are allowlisted by contract governance to mitigate Sybil flooding. Open economic bond-based registration is a post-MVP roadmap item.

---

## 8. License

This repository is released under the **MIT License**. Third-party dataset subsets and model backbones are governed by their respective non-commercial licenses (CC-BY-NC-SA 4.0 / CC-BY-NC 4.0 / LAION OpenCLIP).
