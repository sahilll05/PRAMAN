#!/usr/bin/env node
/**
 * PRAMANA Chain CLI (T5.1).
 *
 * Usage:
 *   pramana-chain <command> [options]
 *
 * Commands:
 *   register-model   Register a model bundle in Registry.sol
 *   attest-verdict   Attest a Verdict to EAS (CPU ONNX reference path)
 *   challenge        Challenge an existing Verdict
 *   canary           Publish a CanaryResult attestation
 *   revoke           Revoke an attestation
 *   read             Read and decode an attestation by UID
 */

import { type Hex, type Address } from "viem";
import { createPramanaClients } from "./client.js";
import {
  registerModel,
  attestVerdict,
  challengeVerdict,
  attestCanary,
  revokeAttestation,
  readAttestation,
} from "./actions.js";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function requireArg(flag: string): string {
  const val = getArg(flag);
  if (!val) {
    console.error(`Error: Missing required argument: ${flag}`);
    process.exit(1);
  }
  return val;
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
PRAMANA Chain CLI (v0.1.0)

Commands:
  register-model   --rpc <url> --key <privKey> --registry <addr> --model-hash <hex> --preproc-hash <hex> --uri <uri> [--spec-version <hex>]
  attest-verdict   --rpc <url> --key <privKey> --eas <addr> --registry <addr> --schema <uid> --sha256 <hex> --phash <uint64> --wmid <uint64> --model-hash <hex> --preproc-hash <hex> --pfake-bps <bps> --verdict <0|1|2> --evidence-hash <hex> --exp-days <days> [--ref-uid <hex>]
  challenge        --rpc <url> --key <privKey> --eas <addr> --registry <addr> --schema <uid> --target-uid <uid> --model-hash <hex> --pfake-bps <bps> --verdict <0|1|2> --evidence-hash <hex>
  canary           --rpc <url> --key <privKey> --eas <addr> --registry <addr> --schema <uid> --model-hash <hex> --batch-id <hex> --auc-bps <bps> --ece-bps <bps> --cov-bps <bps> -n <num> --labels-hash <hex>
  revoke           --rpc <url> --key <privKey> --eas <addr> --registry <addr> --schema <uid> --uid <hex>
  read             --rpc <url> --eas <addr> --registry <addr> --uid <hex> [--verdict-schema <uid>] [--challenge-schema <uid>] [--canary-schema <uid>]
    `);
    process.exit(0);
  }

  const rpcUrl = getArg("--rpc") ?? process.env["BASE_SEPOLIA_RPC_URL"] ?? "http://127.0.0.1:8545";
  const privateKey = (getArg("--key") ?? process.env["DEPLOYER_PRIVATE_KEY"] ?? process.env["ATTESTER_PRIVATE_KEY"]) as Hex | undefined;
  const easAddress = (getArg("--eas") ?? process.env["EAS_ADDRESS"] ?? "0x5fbdb2315678afecb367f032d93f642f64180aa3") as Address;
  const registryAddress = (getArg("--registry") ?? process.env["REGISTRY_ADDRESS"] ?? "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0") as Address;

  const clients = createPramanaClients({
    rpcUrl,
    privateKey,
    easAddress,
    registryAddress,
  });

  switch (command) {
    case "register-model": {
      const modelHash = requireArg("--model-hash") as Hex;
      const preprocHash = requireArg("--preproc-hash") as Hex;
      const uri = requireArg("--uri");
      const specVersion = (getArg("--spec-version") ?? "0x302e312e30000000000000000000000000000000000000000000000000000000") as Hex;

      console.log("Registering model in Registry.sol...");
      const txHash = await registerModel(clients, {
        modelHash,
        preprocHash,
        uri,
        specVersion,
      });
      console.log(`Success: Model registered. TxHash: ${txHash}`);
      break;
    }

    case "attest-verdict": {
      const schema = requireArg("--schema") as Hex;
      const sha256Hash = requireArg("--sha256") as Hex;
      const pHash = BigInt(requireArg("--phash"));
      const wmId = BigInt(requireArg("--wmid"));
      const modelHash = requireArg("--model-hash") as Hex;
      const preprocHash = requireArg("--preproc-hash") as Hex;
      const pFakeBps = Number(requireArg("--pfake-bps"));
      const verdict = Number(requireArg("--verdict"));
      const evidenceHash = requireArg("--evidence-hash") as Hex;
      const expDays = BigInt(getArg("--exp-days") ?? "180");
      const refUID = getArg("--ref-uid") as Hex | undefined;

      const expirationTime = BigInt(Math.floor(Date.now() / 1000)) + expDays * 86400n;

      console.log("Attesting Verdict to EAS...");
      const result = await attestVerdict(clients, {
        verdictData: {
          sha256Hash,
          pHash,
          wmId,
          modelHash,
          preprocHash,
          pFakeBps,
          verdict,
          evidenceHash,
        },
        verdictSchemaUID: schema,
        expirationTime,
        refUID,
      });
      console.log(`Success: Verdict Attested. UID: ${result.uid} (TxHash: ${result.txHash})`);
      break;
    }

    case "challenge": {
      const schema = requireArg("--schema") as Hex;
      const targetUID = requireArg("--target-uid") as Hex;
      const modelHash = requireArg("--model-hash") as Hex;
      const observedPFakeBps = Number(requireArg("--pfake-bps"));
      const observedVerdict = Number(requireArg("--verdict"));
      const evidenceHash = requireArg("--evidence-hash") as Hex;

      console.log("Attesting Challenge to EAS...");
      const result = await challengeVerdict(clients, {
        challengeData: {
          modelHash,
          observedPFakeBps,
          observedVerdict,
          evidenceHash,
        },
        challengeSchemaUID: schema,
        targetVerdictUID: targetUID,
      });
      console.log(`Success: Challenge Attested. UID: ${result.uid} (TxHash: ${result.txHash})`);
      break;
    }

    case "canary": {
      const schema = requireArg("--schema") as Hex;
      const modelHash = requireArg("--model-hash") as Hex;
      const batchId = requireArg("--batch-id") as Hex;
      const aucBps = Number(requireArg("--auc-bps"));
      const eceBps = Number(requireArg("--ece-bps"));
      const coverageBps = Number(requireArg("--cov-bps"));
      const n = Number(requireArg("-n"));
      const labelsCommitHash = requireArg("--labels-hash") as Hex;

      console.log("Attesting CanaryResult to EAS...");
      const result = await attestCanary(clients, {
        canaryData: {
          modelHash,
          batchId,
          aucBps,
          eceBps,
          coverageBps,
          n,
          labelsCommitHash,
        },
        canarySchemaUID: schema,
      });
      console.log(`Success: CanaryResult Attested. UID: ${result.uid} (TxHash: ${result.txHash})`);
      break;
    }

    case "revoke": {
      const schema = requireArg("--schema") as Hex;
      const uid = requireArg("--uid") as Hex;

      console.log(`Revoking attestation ${uid}...`);
      const txHash = await revokeAttestation(clients, schema, uid);
      console.log(`Success: Attestation Revoked. TxHash: ${txHash}`);
      break;
    }

    case "read": {
      const uid = requireArg("--uid") as Hex;
      const verdictSchema = getArg("--verdict-schema") as Hex | undefined;
      const challengeSchema = getArg("--challenge-schema") as Hex | undefined;
      const canarySchema = getArg("--canary-schema") as Hex | undefined;

      const result = await readAttestation(clients, uid, {
        verdict: verdictSchema,
        challenge: challengeSchema,
        canary: canarySchema,
      });
      console.log(JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
