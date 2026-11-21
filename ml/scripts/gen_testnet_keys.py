"""Generate three throwaway testnet private keys and write to .env — no output to stdout."""

import secrets
from pathlib import Path

root = Path(__file__).parent.parent  # PRAMAN/


def gen_key() -> str:
    return "0x" + secrets.token_hex(32)


d_key = gen_key()
a_key = gen_key()
c_key = gen_key()

env_content = f"""# PRAMAN — TESTNET ENVIRONMENT
# Auto-generated throwaway keys — Base Sepolia ONLY.
# NEVER commit. NEVER reuse on mainnet.
# Generated: 2026-11-15T15:00:00Z

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org

DEPLOYER_PRIVATE_KEY={d_key}
ATTESTER_PRIVATE_KEY={a_key}
CANARY_ISSUER_PRIVATE_KEY={c_key}

BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY_HERE
DATABASE_URL=postgresql://user:password@localhost:5432/pramana
CHAIN_ID=84532
START_BLOCK=0
EAS_ADDRESS=0x4200000000000000000000000000000000000021
SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
EVIDENCE_BASE_URL=https://your-evidence-host.example.com/evidence
"""

out = root / ".env"
out.write_text(env_content, encoding="utf-8")
# Only print that it's done — never print the keys
print(f"[gen_keys] Wrote {out} ({out.stat().st_size} bytes). Keys are 32-byte random hex.")
print("[gen_keys] Derive your addresses with: cast wallet address --private-key <key>")
