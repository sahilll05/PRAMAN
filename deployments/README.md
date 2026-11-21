# deployments — On-chain deployment records

> Never commit private keys or mnemonic phrases here.
> Record only public addresses and transaction hashes.

## Local Anvil (chainId 31337)

Deployment record archived in [`deployments/anvil.json`](anvil.json) and gas benchmarks in [`deployments/gas.md`](gas.md).

| Contract / Schema | Address / UID |
|---|---|
| **Registry** | `0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0` |
| **VerdictResolver** | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` |
| **Verdict EAS Schema UID** | `0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99` |
| **Challenge EAS Schema UID** | `0x75af41a6841f31130063d320bfba8237732a390fa05f3f6abc723030731805c6` |
| **CanaryResult EAS Schema UID** | `0x40b7431db61c01339c9f901cf5f5d720a7dbbea630a890bebd4891337325691c` |

## Base Sepolia (chainId 84532) — LIVE PUBLIC TESTNET

Deployment record archived in [`deployments/base-sepolia.json`](base-sepolia.json).

| Contract / Schema | Address / UID | BaseScan Link |
|---|---|---|
| **Registry** | `0x5572e50d8d83aAFD90d4B4f724c9640174E17f9D` | [View on BaseScan](https://sepolia.basescan.org/address/0x5572e50d8d83aAFD90d4B4f724c9640174E17f9D) |
| **VerdictResolver** | `0xE4bD50E88212EeCD34977956524f8adA4B8013Ad` | [View on BaseScan](https://sepolia.basescan.org/address/0xE4bD50E88212EeCD34977956524f8adA4B8013Ad) |
| **Verdict EAS Schema UID** | `0xefd6ece3503b54ca4d4a2235eb5e855446390620a7bcf65a92d957641c72f8ae` | [View on EAS Scan](https://base-sepolia.easscan.org/schema/view/0xefd6ece3503b54ca4d4a2235eb5e855446390620a7bcf65a92d957641c72f8ae) |
| **Challenge EAS Schema UID** | `0x32650399e58d7240c74023f5fe8b482df30cb6b80c372300a9e15718c0de4ea9` | [View on EAS Scan](https://base-sepolia.easscan.org/schema/view/0x32650399e58d7240c74023f5fe8b482df30cb6b80c372300a9e15718c0de4ea9) |
| **CanaryResult EAS Schema UID** | `0x4e42b547e5983c9a18959e95c90991e312e85039609cd45b0ef6794a53c9f217` | [View on EAS Scan](https://base-sepolia.easscan.org/schema/view/0x4e42b547e5983c9a18959e95c90991e312e85039609cd45b0ef6794a53c9f217) |

### Testnet Accounts (Public Addresses)
- **Deployer**: `0xE107Cc2Ede891dB5b70D865039bf3845b24c4Aeb`
- **Default Attester**: `0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44`
- **Default Canary Issuer**: `0xc40Bc4A72631A634865B70296e371466fcEA9AcA`

## Base Mainnet (chainId 8453) — OUT OF SCOPE

> **ZERO-SPEND POLICY:** Mainnet deployment is permanently out of scope. PRAMAN is a non-commercial research prototype operating exclusively on Base Sepolia testnet ($0 cost).

Not deployed — Phase 9 gate only.
