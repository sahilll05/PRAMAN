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

## Base Sepolia (chainId 84532)

### Testnet Accounts (Public Addresses)
- **Deployer**: `0xE107Cc2Ede891dB5b70D865039bf3845b24c4Aeb`
- **Attester**: `0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44`
- **Canary Issuer**: `0xc40Bc4A72631A634865B70296e371466fcEA9AcA`

*Note: Broadcast to Base Sepolia requires faucet ETH on deployer account (balance currently 0). Local Anvil deployment script (`contracts/script/Deploy.s.sol`) is fully automated and reproducible.*

## Base Mainnet (chainId 8453) — OUT OF SCOPE

> **ZERO-SPEND POLICY:** Mainnet deployment is permanently out of scope. PRAMAN is a non-commercial research prototype operating exclusively on Base Sepolia testnet ($0 cost).

Not deployed — Phase 9 gate only.
