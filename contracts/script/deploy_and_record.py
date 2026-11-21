"""Deploy PRAMAN contracts to local Anvil node and record deployment metadata (T4.5)."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path


def deploy_anvil() -> dict[str, object]:
    repo_root = Path(__file__).resolve().parent.parent.parent
    contracts_dir = repo_root / "contracts"
    deployments_dir = repo_root / "deployments"
    deployments_dir.mkdir(parents=True, exist_ok=True)

    foundry_bin = str(Path.home() / ".foundry" / "bin")
    env = os.environ.copy()
    env["PATH"] = foundry_bin + os.pathsep + env.get("PATH", "")

    # Start Anvil in background if not listening
    anvil_proc = None
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            in_use = s.connect_ex(("127.0.0.1", 8545)) == 0
    except Exception:
        in_use = False

    if not in_use:
        print("Starting background Anvil instance on 127.0.0.1:8545...")
        anvil_bin = str(Path.home() / ".foundry" / "bin" / "anvil.exe")
        anvil_proc = subprocess.Popen(
            [anvil_bin, "--port", "8545", "--chain-id", "31337", "--silent"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)
    else:
        print("Anvil or RPC node already running on 127.0.0.1:8545.")

    try:
        forge_bin = str(Path.home() / ".foundry" / "bin" / "forge.exe")
        cmd = [
            forge_bin,
            "script",
            "script/Deploy.s.sol:DeployScript",
            "--broadcast",
            "--rpc-url",
            "http://127.0.0.1:8545",
        ]
        print("Broadcasting deployment script to Anvil...")
        res = subprocess.run(cmd, cwd=str(contracts_dir), env=env, capture_output=True, text=True)
        if res.returncode != 0:
            print("Deploy failed:\nSTDOUT:\n", res.stdout, "\nSTDERR:\n", res.stderr)
            raise RuntimeError(f"DeployScript failed with code {res.returncode}")

        print("Deployment broadcast succeeded!")

        # Parse broadcast output
        broadcast_file = contracts_dir / "broadcast" / "Deploy.s.sol" / "31337" / "run-latest.json"
        with open(broadcast_file, "r", encoding="utf-8") as f:
            run_data = json.load(f)

        deployed_contracts = {}
        for tx in run_data.get("transactions", []):
            c_name = tx.get("contractName")
            c_addr = tx.get("contractAddress")
            if c_name and c_addr:
                deployed_contracts[c_name] = c_addr

        # Read schema UIDs from receipt or simulation
        # In our script, the return values or logs contain the UIDs
        # Let's extract them from logs or compute canonically
        resolver_addr = deployed_contracts.get("VerdictResolver")
        verdict_schema_str = "bytes32 sha256Hash, uint64 pHash, uint64 wmId, bytes32 modelHash, bytes32 preprocHash, uint16 pFakeBps, uint8 verdict, bytes32 evidenceHash"
        challenge_schema_str = "bytes32 modelHash, uint16 observedPFakeBps, uint8 observedVerdict, bytes32 evidenceHash"
        canary_schema_str = "bytes32 modelHash, bytes32 batchId, uint16 aucBps, uint16 eceBps, uint16 coverageBps, uint32 n, bytes32 labelsCommitHash"

        # Canonical EAS schema UID calculation: keccak256(abi.encodePacked(schema, resolverAddress, revocable))
        from web3 import Web3
        w3 = Web3()

        def compute_schema_uid(schema: str, resolver: str) -> str:
            types = ["string", "address", "bool"]
            values = [schema, Web3.to_checksum_address(resolver), True]
            encoded = b"".join([
                schema.encode("utf-8"),
                bytes.fromhex(resolver[2:]),
                b"\x01",
            ])
            return "0x" + w3.keccak(encoded).hex()

        schema_uids = {
            "Verdict": compute_schema_uid(verdict_schema_str, resolver_addr) if resolver_addr else "",
            "Challenge": compute_schema_uid(challenge_schema_str, resolver_addr) if resolver_addr else "",
            "CanaryResult": compute_schema_uid(canary_schema_str, resolver_addr) if resolver_addr else "",
        }

        deployment_metadata = {
            "network": "anvil",
            "chainId": 31337,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "contracts": deployed_contracts,
            "schemas": schema_uids,
            "defaultAttester": "0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44",
            "defaultCanaryIssuer": "0xc40Bc4A72631A634865B70296e371466fcEA9AcA",
        }

        out_json = deployments_dir / "anvil.json"
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(deployment_metadata, f, indent=2)

        print(f"Saved deployment metadata to {out_json}")
        return deployment_metadata

    finally:
        if anvil_proc:
            anvil_proc.terminate()
            print("Terminated temporary Anvil process.")


if __name__ == "__main__":
    deploy_anvil()
