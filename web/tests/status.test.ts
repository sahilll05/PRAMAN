import { describe, it, expect } from "vitest";
import {
  computeVerdictStatus,
  VerdictStatus,
  verdictLabel,
  pFakePct,
  type VerdictSummary,
  type ChallengeSummary,
  type ModelSummary,
  type CanarySummary,
} from "../lib/status.js";

describe("Web Verifier Status State Machine (Spec §6 in Browser)", () => {
  const dummyVerdict: VerdictSummary = {
    uid: "0xverdict001",
    schemaUid: "0xschema001",
    refUid: "0x0000000000000000000000000000000000000000000000000000000000000000",
    attester: "0x1111111111111111111111111111111111111111",
    time: 1700000000n,
    expirationTime: 1800000000n,
    revocationTime: 0n,
    verdict: 2, // LIKELY_SYNTHETIC
    pFakeBps: 9800,
    modelHash: "0xmodel001",
    sha256Hash: "0xabc",
    pHashHex: "0".repeat(16),
    evidenceHash: "0xev001",
    blockNumber: 100n,
  };

  it("formats verdict labels and calibrated pFake correctly", () => {
    expect(verdictLabel(0)).toBe("ABSTAIN");
    expect(verdictLabel(1)).toBe("LIKELY AUTHENTIC");
    expect(verdictLabel(2)).toBe("LIKELY SYNTHETIC");
    expect(pFakePct(9850)).toBe("98.50%");
    expect(pFakePct(35)).toBe("0.35%");
  });

  it("computes ACTIVE status when within valid bounds", () => {
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      currentTime: 1750000000n,
    });
    expect(res.status).toBe(VerdictStatus.ACTIVE);
    expect(res.badge).toBe("ACTIVE");
  });

  it("computes REVOKED when revocationTime > 0", () => {
    const res = computeVerdictStatus({
      verdict: { ...dummyVerdict, revocationTime: 1710000000n },
      currentTime: 1750000000n,
    });
    expect(res.status).toBe(VerdictStatus.REVOKED);
    expect(res.badge).toBe("REVOKED");
  });

  it("computes SUPERSEDED when a non-revoked newer verdict references refUID", () => {
    const superseding: VerdictSummary = {
      ...dummyVerdict,
      uid: "0xverdict002",
      refUid: dummyVerdict.uid,
    };
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      supersedingVerdicts: [superseding],
      currentTime: 1750000000n,
    });
    expect(res.status).toBe(VerdictStatus.SUPERSEDED);
    expect(res.badge).toBe("SUPERSEDED");
  });

  it("computes UPHELD_CHALLENGE when ≥ 2 distinct challengers submit dissenting verdicts", () => {
    const c1: ChallengeSummary = {
      uid: "0xc1",
      refUid: dummyVerdict.uid,
      attester: "0xattester1",
      revocationTime: 0n,
      observedVerdict: 1, // Dissenting: 1 != 2
      observedPFakeBps: 100,
      time: 1710000000n,
    };
    const c2: ChallengeSummary = {
      uid: "0xc2",
      refUid: dummyVerdict.uid,
      attester: "0xattester2",
      revocationTime: 0n,
      observedVerdict: 1, // Dissenting: 1 != 2
      observedPFakeBps: 150,
      time: 1720000000n,
    };
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [c1, c2],
      currentTime: 1750000000n,
    });
    expect(res.status).toBe(VerdictStatus.UPHELD_CHALLENGE);
    expect(res.badge).toBe("CHALLENGED");
    expect(res.flags.isChallengeUpheld).toBe(true);
  });

  it("computes EXPIRED when now > expirationTime", () => {
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      currentTime: 1850000000n, // > 1800000000n
    });
    expect(res.status).toBe(VerdictStatus.EXPIRED);
    expect(res.badge).toBe("EXPIRED");
  });

  it("computes MODEL_DEGRADED with STALE badge when canary AUC < 8000 bps", () => {
    const canary: CanarySummary = {
      uid: "0xcanary1",
      modelHash: dummyVerdict.modelHash,
      time: 1720000000n,
      aucBps: 7800, // < 8000
      eceBps: 400,
    };
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      latestCanary: canary,
      currentTime: 1750000000n,
    });
    expect(res.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(res.badge).toBe("STALE");
    expect(res.flags.isModelDegraded).toBe(true);
  });
});
