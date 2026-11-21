# PRAMAN (प्रमाण)

> **The Privacy-First, Browser-Based Toolkit for Media Authenticity**  
> *Verify, protect, and audit images locally—without ever uploading your files to a server.*  
> *Anchored on Base Sepolia testnet via Ethereum Attestation Service (EAS).*

[![Release](https://img.shields.io/badge/release-praman--v1.0.0-blue.svg)](https://github.com/sahilll05/PRAMAN/releases/tag/praman-v1.0.0)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia%20(84532)-blue.svg)](#6-decentralized-eas-attestation-protocol)
[![CI - Python Tests](https://img.shields.io/badge/pytest-26%20passed-brightgreen.svg)](#running-test-suites)
[![CI - TypeScript Tests](https://img.shields.io/badge/vitest-94%20passed-brightgreen.svg)](#running-test-suites)
[![Smart Contracts](https://img.shields.io/badge/foundry-43%20passed-brightgreen.svg)](#smart-contracts--eas)
[![Cost](https://img.shields.io/badge/cost-$0%20(Zero--Spend)-success.svg)](#2-zero-spend-policy--mainnet-out-of-scope-disclosure)
[![Spec Version](https://img.shields.io/badge/spec-0.1.0--draft-orange.svg)](spec/schemas/verdict.schema.json)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Non--Commercial-lightgrey.svg)](#10-license)

---

## 1. Executive Summary & Toolkit Capabilities

Modern generative diffusion and transformer models (e.g., Stable Diffusion 3.5, Flux, DALL-E 3) make synthetic imagery increasingly indistinguishable from optical photography. While conventional deepfake detectors report high closed-set accuracy, they suffer from severe real-world vulnerabilities:
1. **Distributional Collapse & Generator Shift**: Detectors trained on past generative models experience substantial degradation when exposed to unseen architectures, latent spaces, or real-world social media compression pipelines.
2. **Epistemological Permanence Fallacy**: Treating an authenticity verdict as a static, irrevocable stamp is fundamentally flawed. A classification that appears sound today may be refuted tomorrow as generator families shift and new forensic models emerge.
3. **Opaque, Centralized Oracles**: Proprietary APIs output unversioned probabilities without public evidence bundles, without reproducible code, and with zero recourse for affected individuals to contest incorrect labels.
4. **Privacy Invasion**: Uploading private, sensitive, or confidential media to third-party cloud servers for analysis exposes users to surveillance, leaks, and unauthorized data harvesting.

### The PRAMAN Solution

**PRAMAN (प्रमाण — Sanskrit for "Means of Valid Knowledge")** rejects the concept of an unquestionable "truth oracle." Instead, PRAMAN provides a **complete, privacy-first, browser-based media authenticity toolkit** where media **never leaves the user's browser**, combined with an open protocol where AI image verdicts are **expiring, versioned, challengeable, and re-executable on-chain claims** on Base Sepolia testnet.

```
                             [ User Image (Local Browser / Extension) ]
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      [ In-Browser Verifier ]           [ Protect Mode ]             [ Batch & ELA Tools ]
    - Streaming SHA-256 (hash-wasm)   - Web Crypto ECDSA P-256     - Multi-image & ZIP drops
    - DCT-II pHash 64-bit (spec §4)   - Downloadable .praman file  - Canvas 2D Error Level Analysis
    - Query EAS timeline via hash     - Spatial Blue-channel WM    - Offline HTML5 audit report
    - ZERO MEDIA UPLOAD               - ZERO MEDIA UPLOAD          - ZERO MEDIA UPLOAD
                 │
                 │ (Hash queries only — 0 image bytes uploaded)
                 ▼
    [ Base Sepolia: EAS & VerdictResolver ] ◄──────────── [ Local Attester Node ]
    - On-chain attestation UID & refUID                   - Pinned open vision models (CLIP)
    - Living verdicts: ACTIVE / STALE / SUPERSEDED       - Canonical CPU ONNX fp32 runner
    - Optimistic challenges & Canary commit-reveal        - Generates verdict.json & evidence.json
```

### The 6 Core Toolkit Capabilities

| Capability | Module | Privacy & Execution Model | Description |
|---|---|---|---|
| 🔍 **In-Browser Verifier** | `web/` | 100% Client-Side | Instant drag-and-drop verification computing streaming SHA-256 (`hash-wasm`) and 64-bit DCT-II perceptual hash (`pHash`). Queries Base Sepolia EAS attestations by hash. **Zero media upload.** |
| 🛡️ **Protect Mode** | `web/lib/protect.ts` | 100% Client-Side | Generates a locally-signed cryptographic `.praman` receipt using browser-native Web Crypto ECDSA P-256. Optionally embeds a 40-bit spatial digital watermark into the Blue channel (PSNR 44.5–48.2 dB). |
| 🧩 **Browser Extension** | `extension/` | 100% Client-Side | Chrome MV3 & Firefox WebExtension. Right-click any web image to verify instantly with an in-page floating verdict badge. Supports local image cache inspection and manual SHA-256 search. |
| 📁 **Batch Verification** | `web/app/` | 100% Client-Side | Drop folders, multiple files, or ZIP archives (`JSZip`). Concurrently hashes files in client Web Workers and generates an interactive, self-contained, valid W3C HTML5 audit report for download. |
| 🔬 **ELA Visual Inspector** | `web/lib/ela.ts` | 100% Client-Side | In-browser Error Level Analysis via HTML5 Canvas 2D. Recompresses images at JPEG Q=85, computes pixel-wise absolute delta with 5x–20x amplification. Includes mandatory forensic non-ruling disclosures. |
| ⛓️ **Decentralized EAS Protocol** | `contracts/`, `chain/` | Base Sepolia Testnet | Living verdicts on Ethereum Attestation Service (EAS). Features native TTL expiration, keeper-driven `refUID` supersession, optimistic challenge flows, and cryptographic commit-reveal canaries. |

---

## 2. Zero-Spend Policy & Mainnet Out-of-Scope Disclosure

> [!IMPORTANT]
> **Mainnet deployment is out of scope for this project (zero-spend policy).**

PRAMAN operates under a strict, non-negotiable **Zero-Spend Policy ($0 total cost)**. The project is designed and deployed as a **non-commercial research prototype**:
- **Testnet-Only Deployment**: Smart contracts and EAS schemas are deployed exclusively to **Base Sepolia testnet** (`chainId: 84532`) using free faucet testnet ETH.
- **Zero Paid Dependencies**: PRAMAN does not use paid APIs, proprietary vision endpoints, paid IPFS pinning services, cloud GPU rentals, or paid web store fees.
- **Client & Free-Tier Infrastructure**:
  - Web UI: Hosted on Vercel Hobby tier (non-commercial research).
  - Indexer Database: Neon Serverless PostgreSQL free tier.
  - Browser Extension: Open-source sideload package (distributable as `.zip` archive; no $5 Chrome Web Store publisher fee).
  - Model Inference: Canonical reference inference runs locally on consumer CPUs (ONNX Runtime fp32); GPU acceleration is used locally for evaluation. New verdicts appear only when an attester node is run locally by a community participant.
- **Mainnet Gates**: All mainnet deployment steps are formally marked `OUT OF SCOPE (zero-spend)`. No mainnet funds will ever be requested or deployed.

---

## 3. Core Architectural Pillars

### 1. Deterministic Reference Runner (spec §7.6)
To enable fraud-proof challenge mechanics, model execution must be strictly reproducible across disparate machines and operating systems:
- **Canonical Attestation Path**: Executed strictly on **CPU ONNX Runtime (fp32)** with pinned preprocessor pipelines, single-thread execution, and fixed math kernels.
- **GPU Acceleration**: Training, feature extraction, and high-throughput evaluation run on GPU (NVIDIA RTX 4060 Laptop GPU, fp16).
- **CPU-vs-GPU Numerical Parity (Experiment E5b)**: Evaluated across $N=200$ test images, the GPU fp16 fast path and canonical CPU ONNX path agreed within a **maximum difference of 20 basis points (0.20%)**, a **mean difference of 3.00 basis points (0.030%)**, and achieved a **0.0% verdict mismatch rate** ([results/E5b/metrics.json](results/E5b/metrics.json)).

### 2. On-Chain Attestation Lifecycle (EAS on Base Sepolia)
Verdicts are formalized as revocable attestations registered in EAS with a custom `VerdictResolver`:
- **Expiration & Time-To-Live (TTL)**: Native EAS `expirationTime` (default 180 days) enforces periodic re-evaluation.
- **Supersession (`refUID`)**: When a superior model emerges, a keeper node or attester issues an updated verdict referencing the older attestation UID, maintaining a complete lineage.
- **Optimistic Challenge Flow**: Any allowlisted attester can independently re-execute the exact pinned model bundle on the original media. If the re-computed probability differs beyond the registered tolerance ($\epsilon$), a counter-challenge attestation is published on-chain.
- **Canary Degradation**: Maintainer-issued canary rounds continuously monitor detector versions against fresh test sets. If a model's canary metrics fall below acceptable thresholds, the status state machine flags all associated verdicts as **STALE**.

### 3. Client-Side Privacy Guarantee (Zero Media Upload)
- Media files **never leave the user's browser**.
- Streaming cryptographic SHA-256 and normative 64-bit perceptual hashing (spec §4 DCT-II) are computed entirely client-side via WebAssembly (`hash-wasm`).
- The web interface and browser extension query the indexer exclusively using hashes, retrieving the full attestation timeline, model versions, evidence hashes, and appeal forms without uploading pixels to any server (verified by Playwright e2e network interception in `web/tests/e2e/privacy.spec.ts`).

### 4. Rigorous Scientific Discipline & Pre-Registered Shortcut Audit (E13)
Benchmark datasets often contain spurious shortcuts (e.g., PNG synthetic images vs. JPEG photographic images). PRAMAN pre-registers a formal shortcut audit before reporting results:
- A metadata-only classifier achieved an AUC of 1.0000 on raw files due to file format artifacts.
- When applying strict **uniform equalization preprocessing** (224×224 bicubic downsampling, EXIF stripped, uniform JPEG quality 85 recompression), Model A maintained **0.9818 AUC** (vs. 0.9891 raw, $\Delta = -0.0073$) and Model B maintained **0.9911 AUC** (vs. 0.9957 raw, $\Delta = -0.0046$), proving that detection relies on deep visual-semantic features rather than container artifacts ([results/E13/metrics.json](results/E13/metrics.json)).

---

## 4. Empirical Benchmark Results (Complete Pre-Registered Experiments E0–E13 + T23)

All evaluations are conducted on **Tier A open-access datasets** ([OwensLab/CommunityForensics-Small](https://huggingface.co/datasets/OwensLab/CommunityForensics-Small), [ComplexDataLab/OpenFake](https://huggingface.co/datasets/ComplexDataLab/OpenFake), and [COCO val2017](https://cocodataset.org)). All metrics reflect actual local executions with committed configurations, logs, and git SHAs archived in [`results/`](results/):

| Experiment | Target Hypothesis | Protocol & Dataset | Primary Metric (Model A / Model B) | Status |
|---|---|---|---|---|
| **E0** | Hardware Throughput | GPU profile on RTX 4060 Laptop (CUDA 12.4/13.5) | **33.2 img/s**, 405.96 MiB peak VRAM | **PASSED** (Baseline recorded in `results/E0/`) |
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
| **E8** | Perishability & Temporal Drift | OpenFake temporal partition & Model A vs B divergence | **Verdict Flip Rate: 13.66%** (22/161 samples flipped)<br>Mean divergence: 930 bps (0.0930)<br>Temporal calibration drift confirmed | **PASSED** (Supports living verdicts claim C6) |
| **E9** | Canary Degradation Audit | Commit-reveal canary evaluation on Base Sepolia (`labelsCommitHash`) | **100% Detection Rate**; degraded canary (AUC 48.16%, ECE 25.78%) immediately flipped status to `MODEL_DEGRADED` / `STALE` | **PASSED** (Supports Claim C10) |
| **E10** | Adversarial Perturbation (PGD) | White-box PGD ($L_\infty$, $\epsilon \in [0.01, 0.20]$) against Model A & B on GPU | Raw probe ASR: 89.0%–100.0%<br>OOD Gate + Conformal Sets defense rate: **48.5% ($\epsilon=0.01$)** and **100.0% ($\epsilon \ge 0.05$) ABSTAIN**<br>Evasion success: 0.0% for $\epsilon \ge 0.05$ | **DOCUMENTED** (Honest reporting: zero robustness claimed; Claim C11) |
| **E11** | Gas Benchmarks & Security | Forge gas profiling on Base Sepolia & Slither static analysis | Model Reg: ~77k gas; Verdict Attest: ~356k gas; Challenge: ~371k gas<br>**0 Slither High/Medium**, 1,000+ fuzz runs | **PASSED** (<$0.05 USD at 0.05 gwei; Claim C7) |
| **E12** | Closed Beta Usability Study | 3 Investigative Journalist & Fact-Checker personas across 10 scenarios | **Task Success Rate: 96.67%** (29/30 correct actions)<br>**Over-trust Avoidance: 100.0%**<br>**Mean SUS Score: 87.5 / 100** (Grade A) | **PASSED** (Threats T14/T15 mitigated) |
| **E13** | Shortcut Audit | Metadata-only classification vs. uniform equalization (224px, JPEG Q85) | Raw Metadata AUC: 1.0000<br>**Equalized AUC: 0.9818 / 0.9911**<br>$\Delta \text{AUC}: -0.0073 / -0.0046$ | **PASSED** (Semantic visual features confirmed; Claim C12) |
| **T23** | GPU Non-Determinism Test | 2,440 boundary samples near $P=0.5000$ comparing GPU fp16 to CPU ONNX fp32 | Boundary max diff: **4 bps**; Global max diff: **20 bps**<br>Boundary flips: 0 / 2,440 (0.0%)<br>Proves why CPU ONNX signing mandate is necessary | **PASSED** (Threat T23 validated) |

*Full experiment configs, metrics, and environment logs are archived under [`results/`](results/) and summarized in [`results/evaluation_report.md`](results/evaluation_report.md).*

---

## 5. Why Still Images? (Why Face-Swap Video Deepfakes Were Not Included in MVP)

A frequent question is why PRAMAN focuses squarely on **generative still images** rather than video deepfakes (face swaps). This was a deliberate architectural and ethical decision frozen in ADR `D-IMAGES-FIRST`:

1. **Open-Data & Zero-Spend Constraints (No Gated Datasets)**:
   - Popular face-swap video datasets (FaceForensics++, Celeb-DF v2, DFDC) require institutional applications, academic email verification, signed agreements, and restrictive commercial terms.
   - PRAMAN enforces a strict **Tier A open-access data policy**: only freely streamable/downloadable datasets with open redistributable licenses (such as `CC-BY-NC-SA-4.0` on CommunityForensics-Small and `CC-BY-NC-4.0` on OpenFake) were permitted. No Tier A ungated face-swap video dataset exists.
2. **Client-Side Privacy Guarantee (Zero Media Upload)**:
   - PRAMAN's foundational privacy rule is that **media never leaves the user's browser**.
   - For still images, computing streaming SHA-256 and 64-bit DCT perceptual hashes in WebAssembly takes mere milliseconds.
   - Video face-swap detection requires multi-frame extraction, face cropping, facial landmark alignment, 3D convolutions, or spatial-temporal transformers—compute-heavy pipelines that cannot run client-side in a browser without uploading megabytes or gigabytes of sensitive video to an external server.
3. **Severe Defamation & Biometric Harm Risks (Threat Model T14)**:
   - Video deepfake benchmarks almost exclusively feature real human faces (celebrities, politicians, or private individuals).
   - An on-chain, immutable, or publicly indexed false accusation ("this person's face is fake") creates acute legal, ethical, and reputational harms.
   - By focusing on whole-image generative AI synthesis (e.g., Midjourney, Flux, Stable Diffusion, DALL-E), PRAMAN inspects synthetic generation artifacts without running biometrics on human faces without consent.
4. **Foundational Protocol Rigor (Pillars First)**:
   - Establishing the mathematical core—exact perceptual hash collision bounds (pHash $T=10$), TrustMark watermarking, conformal coverage guarantees, and on-chain dispute resolvers—required a clean, deterministic modality before tackling video temporal aggregation. Video remains an explicit future stretch goal.

---

## 6. Repository Structure

```
PRAMAN/
├── spec/                       # Authoritative Canonical Specification
│   ├── schemas/                # JSON Schemas (verdict.schema.json, evidence.schema.json)
│   └── vectors/                # Golden test vectors shared across Python & TypeScript
├── ml/                         # Python ML & Detection Layer
│   ├── src/lv_ml/
│   │   ├── fingerprint/        # Spec §4 pHash (DCT-II) & SHA-256 implementation
│   │   ├── features/           # Mixed-precision CLIP ViT-B-32 GPU embedding extractor
│   │   ├── models/             # PyTorch Model A (Linear Probe) & Model B (MLP Probe)
│   │   ├── runner/             # CPU ONNX Reference Runner & ONNX exporter
│   │   ├── calibration/        # TemperatureScaler, MahalanobisOODGate, ConformalPredictor
│   │   ├── watermark/          # TrustMark Q & spatial watermark adapters
│   │   └── eval/               # Benchmark experiments E1-E13, T23, and shortcut audit
│   ├── scripts/                # Data download, split generation, training, and eval scripts
│   └── tests/                  # Pytest test suite (schemas, pHash, models, runners)
├── contracts/                  # Solidity Smart Contracts (Foundry)
│   ├── src/                    # Registry.sol & VerdictResolver.sol
│   └── test/                   # Fuzz, invariant, and unit tests (43 passed)
├── chain/                      # TypeScript Chain CLI (viem + EAS SDK)
├── indexer/                    # Event Indexer & Status State Machine (Drizzle + Postgres)
├── web/                        # Next.js 14 Web Verifier (Tailwind + hash-wasm, monochrome + Sanskrit)
│   ├── app/                    # Web Verifier, Models, Canary, Attesters, Limitations, Batch pages
│   ├── components/             # DropZone, ProtectCard, VerifyReceiptModal, ELAViewer, BatchVerification
│   ├── lib/                    # Fingerprint, Protect Mode (ECDSA P-256), Spatial Watermark, ELA
│   └── tests/                  # Vitest suite & Playwright e2e privacy test
├── extension/                  # Browser Extension (Chrome MV3 & Firefox WebExtension)
│   ├── src/                    # Background service worker, Content script, Popup UI
│   └── dist/                   # Sideload package & praman-extension-v0.1.0.zip
└── results/                    # Committed experiment results, configs, env.txt, and git SHAs
```

---

## 7. Getting Started & Reproduction

### Prerequisites
- Python 3.11+
- Node.js 20+ & `pnpm`
- Foundry (`forge`, `anvil`)
- NVIDIA GPU with CUDA 12.4+ (optional; inference reference runner operates on CPU)

### Installation
```bash
# Clone the repository
git clone https://github.com/sahilll05/PRAMAN.git
cd PRAMAN

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

### Installing the Browser Extension (Sideload)
The browser extension is distributed as an open-source sideload package (no paid store fee):
1. Run `pnpm --filter @praman/extension build`.
2. In Google Chrome / Brave: Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select the `extension/dist` directory.
3. In Firefox: Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `extension/dist/manifest.json`.
4. Right-click any image on the web and select **"Verify with PRAMAN प्रमाण"**.

### Running Test Suites
```bash
# Python unit tests & schema validation (26 passed, 1 skipped)
uv run --project ml pytest ml/tests/

# TypeScript workspace tests across all 4 packages (94 passed)
pnpm test

# Foundry smart contract fuzz & invariant tests (43 passed, 1000 fuzz runs)
forge test --root contracts

# Playwright automated privacy & zero-upload verification tests
pnpm --prefix web test:e2e
```

---

## 8. On-Chain EAS Payload & Verdict Schema

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

## 9. Required Caveats & Honest Disclosures

In accordance with PRAMAN's strict claims policy (documented in [`results/evaluation_report.md`](results/evaluation_report.md)):
1. **Model-Assessed Likelihood, Not an Oracle Ruling**: Verdicts reflect deterministic outputs of open forensic models at a point in time. They are not definitive statements of ontological truth.
2. **MVP Modality Scope**: The MVP strictly evaluates **still images** (AI-generated vs. authentic photography). Video deepfakes, audio synthesis, and face-swaps are deferred to stretch phases.
3. **Zero-Spend Non-Commercial Research**: The project operates with zero capital expenditure ($0). Deployment is restricted to **Base Sepolia testnet** using free testnet ETH. Mainnet deployment is explicitly out of scope.
4. **Local Attester Requirement**: New on-chain attestations appear only when an attester node executes the open runner locally. Images are never scanned by a hosted cloud service.
5. **Non-Commercial Dataset Licensing**: Training utilizes `OwensLab/CommunityForensics-Small` (CC-BY-NC-SA-4.0) and `ComplexDataLab/OpenFake` (CC-BY-NC-4.0). Any redistributed model weights carry non-commercial research restrictions.
6. **Centralized Initial Allowlist**: In v1, attester addresses are allowlisted by contract governance to mitigate Sybil flooding. Open economic bond-based registration is a post-MVP roadmap item.
7. **Canaries are Maintainer-Run in v1**: Canary evaluations and health checks are currently scheduled and published by maintainer nodes; this represents a trust assumption documented in Threat Model T18.
8. **Shortcut Audit Pre-Registration**: Spurious container metadata shortcuts were pre-registered and audited in Experiment E13; all models are evaluated under uniform spatial-compression equalization.

---

## 10. License

This repository is released under the **MIT License**. Third-party dataset subsets and model backbones are governed by their respective non-commercial licenses (CC-BY-NC-SA 4.0 / CC-BY-NC 4.0 / LAION OpenCLIP).
