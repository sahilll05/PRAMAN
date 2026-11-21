import { describe, it, expect } from "vitest";
import {
  encodeVerdictData,
  decodeVerdictData,
  encodeChallengeData,
  decodeChallengeData,
  encodeCanaryData,
  decodeCanaryData,
  computeSchemaUID,
  VERDICT_SCHEMA_STR,
  type VerdictData,
  type ChallengeData,
  type CanaryData,
} from "../src/index.js";

describe("T5.1 Chain CLI Schemas & Encoders", () => {
  it("encodes and decodes Verdict data with bit-exact roundtrip", () => {
    const verdict: VerdictData = {
      sha256Hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      pHash: 0xfeedfacedeadbeefn,
      wmId: 0x123456789an,
      modelHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      preprocHash: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
      pFakeBps: 8750,
      verdict: 2,
      evidenceHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
    };

    const encoded = encodeVerdictData(verdict);
    expect(encoded).toMatch(/^0x/);

    const decoded = decodeVerdictData(encoded);
    expect(decoded.sha256Hash).toBe(verdict.sha256Hash);
    expect(decoded.pHash).toBe(verdict.pHash);
    expect(decoded.wmId).toBe(verdict.wmId);
    expect(decoded.modelHash).toBe(verdict.modelHash);
    expect(decoded.preprocHash).toBe(verdict.preprocHash);
    expect(decoded.pFakeBps).toBe(verdict.pFakeBps);
    expect(decoded.verdict).toBe(verdict.verdict);
    expect(decoded.evidenceHash).toBe(verdict.evidenceHash);
  });

  it("encodes and decodes Challenge data with bit-exact roundtrip", () => {
    const challenge: ChallengeData = {
      modelHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      observedPFakeBps: 1200,
      observedVerdict: 1,
      evidenceHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    };

    const encoded = encodeChallengeData(challenge);
    const decoded = decodeChallengeData(encoded);

    expect(decoded.modelHash).toBe(challenge.modelHash);
    expect(decoded.observedPFakeBps).toBe(challenge.observedPFakeBps);
    expect(decoded.observedVerdict).toBe(challenge.observedVerdict);
    expect(decoded.evidenceHash).toBe(challenge.evidenceHash);
  });

  it("encodes and decodes CanaryResult data with bit-exact roundtrip", () => {
    const canary: CanaryData = {
      modelHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      batchId: "0x9999999999999999999999999999999999999999999999999999999999999999",
      aucBps: 9850,
      eceBps: 250,
      coverageBps: 9200,
      n: 500,
      labelsCommitHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    };

    const encoded = encodeCanaryData(canary);
    const decoded = decodeCanaryData(encoded);

    expect(decoded.modelHash).toBe(canary.modelHash);
    expect(decoded.batchId).toBe(canary.batchId);
    expect(decoded.aucBps).toBe(canary.aucBps);
    expect(decoded.eceBps).toBe(canary.eceBps);
    expect(decoded.coverageBps).toBe(canary.coverageBps);
    expect(decoded.n).toBe(canary.n);
    expect(decoded.labelsCommitHash).toBe(canary.labelsCommitHash);
  });

  it("computes canonical EAS schema UID", () => {
    const resolver = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const uid = computeSchemaUID(VERDICT_SCHEMA_STR, resolver, true);
    expect(uid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(uid).toBe("0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99");
  });
});
