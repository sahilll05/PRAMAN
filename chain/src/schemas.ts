import {
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  type Hex,
  type Address,
} from "viem";

export const VERDICT_SCHEMA_STR =
  "bytes32 sha256Hash, uint64 pHash, uint64 wmId, bytes32 modelHash, bytes32 preprocHash, uint16 pFakeBps, uint8 verdict, bytes32 evidenceHash";
export const VERDICT_SCHEMA_STRING = VERDICT_SCHEMA_STR;

export const CHALLENGE_SCHEMA_STR =
  "bytes32 modelHash, uint16 observedPFakeBps, uint8 observedVerdict, bytes32 evidenceHash";
export const CHALLENGE_SCHEMA_STRING = CHALLENGE_SCHEMA_STR;

export const CANARY_SCHEMA_STR =
  "bytes32 modelHash, bytes32 batchId, uint16 aucBps, uint16 eceBps, uint16 coverageBps, uint32 n, bytes32 labelsCommitHash";
export const CANARY_SCHEMA_STRING = CANARY_SCHEMA_STR;

const VERDICT_PARAMS = parseAbiParameters(VERDICT_SCHEMA_STR);
const CHALLENGE_PARAMS = parseAbiParameters(CHALLENGE_SCHEMA_STR);
const CANARY_PARAMS = parseAbiParameters(CANARY_SCHEMA_STR);

export interface VerdictData {
  sha256Hash: Hex;
  pHash: bigint;
  wmId: bigint;
  modelHash: Hex;
  preprocHash: Hex;
  pFakeBps: number;
  verdict: number;
  evidenceHash: Hex;
}

export interface ChallengeData {
  modelHash: Hex;
  observedPFakeBps: number;
  observedVerdict: number;
  evidenceHash: Hex;
}

export interface CanaryData {
  modelHash: Hex;
  batchId: Hex;
  aucBps: number;
  eceBps: number;
  coverageBps: number;
  n: number;
  labelsCommitHash: Hex;
}

/**
 * Encode Verdict data matching spec §2.1.
 */
export function encodeVerdictData(data: VerdictData): Hex {
  return encodeAbiParameters(VERDICT_PARAMS, [
    data.sha256Hash,
    data.pHash,
    data.wmId,
    data.modelHash,
    data.preprocHash,
    data.pFakeBps,
    data.verdict,
    data.evidenceHash,
  ]);
}

/**
 * Decode Verdict data matching spec §2.1.
 */
export function decodeVerdictData(raw: Hex): VerdictData {
  const decoded = decodeAbiParameters(VERDICT_PARAMS, raw);
  return {
    sha256Hash: decoded[0],
    pHash: decoded[1],
    wmId: decoded[2],
    modelHash: decoded[3],
    preprocHash: decoded[4],
    pFakeBps: decoded[5],
    verdict: decoded[6],
    evidenceHash: decoded[7],
  };
}

/**
 * Encode Challenge data matching spec §2.2.
 */
export function encodeChallengeData(data: ChallengeData): Hex {
  return encodeAbiParameters(CHALLENGE_PARAMS, [
    data.modelHash,
    data.observedPFakeBps,
    data.observedVerdict,
    data.evidenceHash,
  ]);
}

/**
 * Decode Challenge data matching spec §2.2.
 */
export function decodeChallengeData(raw: Hex): ChallengeData {
  const decoded = decodeAbiParameters(CHALLENGE_PARAMS, raw);
  return {
    modelHash: decoded[0],
    observedPFakeBps: decoded[1],
    observedVerdict: decoded[2],
    evidenceHash: decoded[3],
  };
}

/**
 * Encode CanaryResult data matching spec §2.3.
 */
export function encodeCanaryData(data: CanaryData): Hex {
  return encodeAbiParameters(CANARY_PARAMS, [
    data.modelHash,
    data.batchId,
    data.aucBps,
    data.eceBps,
    data.coverageBps,
    data.n,
    data.labelsCommitHash,
  ]);
}

/**
 * Decode CanaryResult data matching spec §2.3.
 */
export function decodeCanaryData(raw: Hex): CanaryData {
  const decoded = decodeAbiParameters(CANARY_PARAMS, raw);
  return {
    modelHash: decoded[0],
    batchId: decoded[1],
    aucBps: decoded[2],
    eceBps: decoded[3],
    coverageBps: decoded[4],
    n: decoded[5],
    labelsCommitHash: decoded[6],
  };
}

/**
 * Compute canonical EAS schema UID: keccak256(abi.encodePacked(schema, resolver, revocable))
 */
export function computeSchemaUID(schema: string, resolver: Address, revocable: boolean): Hex {
  return keccak256(
    encodePacked(
      ["string", "address", "bool"],
      [schema, resolver, revocable]
    )
  );
}
