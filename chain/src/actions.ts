import {
  type Address,
  type Hex,
  type Hash,
  decodeEventLog,
} from "viem";
import { REGISTRY_ABI, EAS_ABI } from "./abis.js";
import {
  encodeVerdictData,
  decodeVerdictData,
  encodeChallengeData,
  decodeChallengeData,
  encodeCanaryData,
  decodeCanaryData,
  type VerdictData,
  type ChallengeData,
  type CanaryData,
} from "./schemas.js";
import type { PramanaClients } from "./client.js";

export interface AttestVerdictOptions {
  verdictData: VerdictData;
  verdictSchemaUID: Hex;
  recipient?: Address | undefined;
  expirationTime: bigint;
  refUID?: Hex | undefined;
}

export interface ChallengeOptions {
  challengeData: ChallengeData;
  challengeSchemaUID: Hex;
  targetVerdictUID: Hex;
  recipient?: Address | undefined;
  expirationTime?: bigint | undefined;
}

export interface CanaryOptions {
  canaryData: CanaryData;
  canarySchemaUID: Hex;
  recipient?: Address | undefined;
  expirationTime?: bigint | undefined;
}

export interface RegisterModelOptions {
  modelHash: Hex;
  preprocHash: Hex;
  uri: string;
  specVersion: Hex;
}

/**
 * Register a forensic model in Registry.sol (T5.1).
 */
export async function registerModel(
  clients: PramanaClients,
  options: RegisterModelOptions
): Promise<Hash> {
  if (!clients.walletClient || !clients.account) {
    throw new Error("WalletClient and Account required to register model.");
  }

  const hash = await clients.walletClient.writeContract({
    chain: null,
    account: clients.account,
    address: clients.registryAddress,
    abi: REGISTRY_ABI,
    functionName: "registerModel",
    args: [
      options.modelHash,
      options.preprocHash,
      options.uri,
      options.specVersion,
    ],
  });

  await clients.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Attest a Verdict to EAS (T5.1).
 * Per spec §7.6: Must be canonical CPU ONNX path.
 */
export async function attestVerdict(
  clients: PramanaClients,
  options: AttestVerdictOptions
): Promise<{ txHash: Hash; uid: Hex }> {
  if (!clients.walletClient || !clients.account) {
    throw new Error("WalletClient and Account required to attest verdict.");
  }

  const encodedData = encodeVerdictData(options.verdictData);

  const request = {
    schema: options.verdictSchemaUID,
    data: {
      recipient: options.recipient ?? "0x0000000000000000000000000000000000000000",
      expirationTime: options.expirationTime,
      revocable: true,
      refUID: options.refUID ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encodedData,
      value: 0n,
    },
  };

  const txHash = await clients.walletClient.writeContract({
    chain: null,
    account: clients.account,
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "attest",
    args: [request],
  });

  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash: txHash });

  // Extract Attested event to get UID
  let uid: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: EAS_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "Attested" && event.args.uid) {
        uid = event.args.uid;
        break;
      }
    } catch {
      // not an EAS event log
    }
  }

  return { txHash, uid };
}

/**
 * Attest a Challenge against an existing Verdict (T5.1).
 */
export async function challengeVerdict(
  clients: PramanaClients,
  options: ChallengeOptions
): Promise<{ txHash: Hash; uid: Hex }> {
  if (!clients.walletClient || !clients.account) {
    throw new Error("WalletClient and Account required to challenge verdict.");
  }

  const encodedData = encodeChallengeData(options.challengeData);

  const request = {
    schema: options.challengeSchemaUID,
    data: {
      recipient: options.recipient ?? "0x0000000000000000000000000000000000000000",
      expirationTime: options.expirationTime ?? 0n,
      revocable: true,
      refUID: options.targetVerdictUID,
      data: encodedData,
      value: 0n,
    },
  };

  const txHash = await clients.walletClient.writeContract({
    chain: null,
    account: clients.account,
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "attest",
    args: [request],
  });

  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash: txHash });

  let uid: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: EAS_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "Attested" && event.args.uid) {
        uid = event.args.uid;
        break;
      }
    } catch {
      // skip
    }
  }

  return { txHash, uid };
}

/**
 * Attest a CanaryResult to EAS (T5.1).
 */
export async function attestCanary(
  clients: PramanaClients,
  options: CanaryOptions
): Promise<{ txHash: Hash; uid: Hex }> {
  if (!clients.walletClient || !clients.account) {
    throw new Error("WalletClient and Account required to attest canary.");
  }

  const encodedData = encodeCanaryData(options.canaryData);

  const request = {
    schema: options.canarySchemaUID,
    data: {
      recipient: options.recipient ?? "0x0000000000000000000000000000000000000000",
      expirationTime: options.expirationTime ?? 0n,
      revocable: true,
      refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
      data: encodedData,
      value: 0n,
    },
  };

  const txHash = await clients.walletClient.writeContract({
    chain: null,
    account: clients.account,
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "attest",
    args: [request],
  });

  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash: txHash });

  let uid: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: EAS_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "Attested" && event.args.uid) {
        uid = event.args.uid;
        break;
      }
    } catch {
      // skip
    }
  }

  return { txHash, uid };
}

/**
 * Revoke an existing attestation on EAS (T5.1).
 */
export async function revokeAttestation(
  clients: PramanaClients,
  schemaUID: Hex,
  attestationUID: Hex
): Promise<Hash> {
  if (!clients.walletClient || !clients.account) {
    throw new Error("WalletClient and Account required to revoke attestation.");
  }

  const txHash = await clients.walletClient.writeContract({
    chain: null,
    account: clients.account,
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "revoke",
    args: [
      {
        schema: schemaUID,
        data: {
          uid: attestationUID,
          value: 0n,
        },
      },
    ],
  });

  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export interface ReadAttestationResult {
  uid: Hex;
  schema: Hex;
  time: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  refUID: Hex;
  recipient: Address;
  attester: Address;
  revocable: boolean;
  isValid: boolean;
  decodedData?:
    | { type: "verdict"; data: VerdictData }
    | { type: "challenge"; data: ChallengeData }
    | { type: "canary"; data: CanaryData }
    | { type: "raw"; raw: Hex };
}

/**
 * Read and decode an attestation from EAS by UID (T5.1).
 */
export async function readAttestation(
  clients: PramanaClients,
  uid: Hex,
  knownSchemas?: {
    verdict?: Hex | undefined;
    challenge?: Hex | undefined;
    canary?: Hex | undefined;
  } | undefined
): Promise<ReadAttestationResult> {
  const attestation = await clients.publicClient.readContract({
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "getAttestation",
    args: [uid],
  });

  const isValid = await clients.publicClient.readContract({
    address: clients.easAddress,
    abi: EAS_ABI,
    functionName: "isAttestationValid",
    args: [uid],
  });

  let decodedData: ReadAttestationResult["decodedData"];
  const schema = attestation.schema.toLowerCase();

  if (knownSchemas?.verdict && schema === knownSchemas.verdict.toLowerCase()) {
    decodedData = { type: "verdict", data: decodeVerdictData(attestation.data) };
  } else if (knownSchemas?.challenge && schema === knownSchemas.challenge.toLowerCase()) {
    decodedData = { type: "challenge", data: decodeChallengeData(attestation.data) };
  } else if (knownSchemas?.canary && schema === knownSchemas.canary.toLowerCase()) {
    decodedData = { type: "canary", data: decodeCanaryData(attestation.data) };
  } else {
    decodedData = { type: "raw", raw: attestation.data };
  }

  return {
    uid: attestation.uid,
    schema: attestation.schema,
    time: attestation.time,
    expirationTime: attestation.expirationTime,
    revocationTime: attestation.revocationTime,
    refUID: attestation.refUID,
    recipient: attestation.recipient,
    attester: attestation.attester,
    revocable: attestation.revocable,
    isValid,
    decodedData,
  };
}
