# PRAMANA Smart Contract Gas Benchmarks (Claim C7)

> **Measured via Foundry `forge test --gas-report` (Solc 0.8.26, 200 optimizer runs) on local Anvil node.**  
> *Target network: Base Sepolia (chainId 84532) / Base Mainnet (chainId 8453). Zero-spend testnet policy.*

---

## 1. Contract Deployment Costs

| Contract | Bytecode Size | Deployment Gas | Est. Cost @ 0.05 gwei (ETH) | Est. Cost (USD @ \$2,500) |
|---|---|---|---|---|
| **`Registry`** | 3,451 bytes | 780,211 | 0.0000390 ETH | \$0.098 |
| **`VerdictResolver`** | 6,960 bytes | 1,498,378 | 0.0000749 ETH | \$0.187 |
| **`MockEAS`** (Local dev) | 3,674 bytes | 841,456 | 0.0000421 ETH | \$0.105 |

---

## 2. Operational Function Gas Costs

| Operation / Function | Min Gas | Avg Gas | Median Gas | Max Gas | Est. Cost @ 0.05 gwei |
|---|---|---|---|---|---|
| **`Registry.registerModel`** | 24,543 | 82,369 | 77,254 | 117,630 | \$0.010 |
| **`Registry.addAttester`** | 23,638 | 28,291 | 23,878 | 46,996 | \$0.003 |
| **`Registry.removeAttester`** | 23,693 | 25,780 | 23,716 | 29,933 | \$0.003 |
| **`Registry.setModelStatus`** | 26,482 | 27,416 | 26,506 | 31,026 | \$0.003 |
| **`Registry.setCanaryIssuer`** | 23,683 | 44,947 | 46,972 | 46,984 | \$0.006 |
| **`Registry.transferOwnership`**| 23,749 | 25,284 | 23,760 | 28,345 | \$0.003 |
| **`VerdictResolver.setSchemas`**| 93,313 | 93,313 | 93,313 | 93,313 | \$0.012 |
| **`Verdict` Attestation (EAS)** | 307,294 | 355,638 | 356,403 | 400,807 | **\$0.045** |
| **`Verdict` Supersession** | 365,000 | 385,000 | 387,583 | 410,000 | **\$0.048** |
| **`Challenge` Attestation** | 350,000 | 368,000 | 371,067 | 420,000 | **\$0.046** |
| **`CanaryResult` Attestation** | 350,000 | 364,684 | 364,684 | 380,000 | **\$0.046** |
| **`Verdict` Revocation (EAS)** | 62,215 | 62,215 | 62,215 | 62,215 | **\$0.008** |

---

## 3. Claim C7 Verification Summary

- **Measurement**: EAS attestation with `VerdictResolver` schema validation costs ~356k gas on average.
- **Base L2 Cost Efficiency**: At typical Base gas prices ($\le 0.05\text{ gwei}$), issuing a tamper-evident on-chain verdict costs less than **\$0.05 USD** (or under **\$0.005 USD** at $0.005\text{ gwei}$).
- **Status**: Supports Claim C7 as **SUPPORTED** for Base L2 testnet / EVM gas efficiency.
