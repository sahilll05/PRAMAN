import { describe, it, expect } from "vitest";
import {
  computeVerdictStatus,
  VerdictStatus,
  getVerdictStatusFromRepo,
} from "../src/status.js";
import { InMemoryIndexerRepository } from "../src/ingest.js";
import type {
  VerdictRecord,
  ChallengeRecord,
  ModelRecord,
  CanaryRecord,
} from "../src/db/schema.js";

describe("PRAMAN Status State Machine (Spec §6, Authoritative)", () => {
  const dummyVerdict: VerdictRecord = {
    uid: "0xverdict001",
    schemaUid: "0xschemaschema01",
    refUid: "0x0000000000000000000000000000000000000000000000000000000000000000",
    attester: "0x1111111111111111111111111111111111111111",
    recipient: "0x0000000000000000000000000000000000000000",
    time: 1700000000n,
    expirationTime: 1800000000n,
    revocationTime: 0n,
    sha256Hash: "0xabc",
    pHash: "0".repeat(64),
    wmId: 0n,
    modelHash: "0xmodelhash001",
    preprocHash: "0xpreprochash001",
    pFakeBps: 9500,
    verdict: 2, // LIKELY_SYNTHETIC
    evidenceHash: "0xevidence001",
    blockNumber: 100n,
    createdAt: new Date(),
  };

  const activeModel: ModelRecord = {
    modelHash: "0xmodelhash001",
    preprocHash: "0xpreprochash001",
    uri: "https://models.pramana.test/m1.onnx",
    specVersion: "0xspec01",
    status: 0, // ACTIVE
    registeredBlock: 50n,
    registeredAt: new Date(),
  };

  it("evaluates to ACTIVE when all conditions are normal", () => {
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: activeModel,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.ACTIVE);
    expect(res.badge).toBe("ACTIVE");
    expect(res.flags.isRevoked).toBe(false);
    expect(res.flags.isExpired).toBe(false);
    expect(res.flags.isSuperseded).toBe(false);
    expect(res.flags.isChallengeUpheld).toBe(false);
  });

  it("evaluates to REVOKED when revocationTime > 0 (highest priority)", () => {
    const revokedVerdict = { ...dummyVerdict, revocationTime: 1710000000n };
    const res = computeVerdictStatus({
      verdict: revokedVerdict,
      modelInfo: activeModel,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.REVOKED);
    expect(res.badge).toBe("REVOKED");
    expect(res.flags.isRevoked).toBe(true);
  });

  it("evaluates to SUPERSEDED when a valid non-revoked superseding verdict exists", () => {
    const superseding: VerdictRecord = {
      ...dummyVerdict,
      uid: "0xverdict002",
      refUid: dummyVerdict.uid,
      revocationTime: 0n,
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      supersedingVerdicts: [superseding],
      modelInfo: activeModel,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.SUPERSEDED);
    expect(res.badge).toBe("SUPERSEDED");
    expect(res.flags.isSuperseded).toBe(true);
    expect(res.details.supersededByUID).toBe("0xverdict002");
  });

  it("ignores revoked superseding verdicts", () => {
    const revokedSuperseding: VerdictRecord = {
      ...dummyVerdict,
      uid: "0xverdict002",
      refUid: dummyVerdict.uid,
      revocationTime: 1720000000n, // Revoked!
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      supersedingVerdicts: [revokedSuperseding],
      modelInfo: activeModel,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.ACTIVE);
    expect(res.badge).toBe("ACTIVE");
    expect(res.flags.isSuperseded).toBe(false);
  });

  it("evaluates to UPHELD_CHALLENGE when >= K distinct dissenting challengers exist", () => {
    const challenge1: ChallengeRecord = {
      uid: "0xchal01",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger11111111111111111111111111111111",
      time: 1710000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 200,
      observedVerdict: 1, // Dissenting: 1 (LIKELY_AUTHENTIC) != 2
      evidenceHash: "0xevchal01",
      blockNumber: 110n,
      createdAt: new Date(),
    };

    const challenge2: ChallengeRecord = {
      uid: "0xchal02",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger22222222222222222222222222222222",
      time: 1715000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 150,
      observedVerdict: 1, // Dissenting: 1 != 2
      evidenceHash: "0xevchal02",
      blockNumber: 120n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [challenge1, challenge2],
      modelInfo: activeModel,
      currentTime: 1750000000n,
      kThreshold: 2,
    });

    expect(res.status).toBe(VerdictStatus.UPHELD_CHALLENGE);
    expect(res.badge).toBe("CHALLENGED");
    expect(res.flags.isChallengeUpheld).toBe(true);
    expect(res.details.distinctDissentingChallengers).toBe(2);
  });

  it("evaluates to CHALLENGED (open) when challengers < K threshold", () => {
    const challenge1: ChallengeRecord = {
      uid: "0xchal01",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger11111111111111111111111111111111",
      time: 1710000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 200,
      observedVerdict: 1, // Dissenting
      evidenceHash: "0xevchal01",
      blockNumber: 110n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [challenge1],
      modelInfo: activeModel,
      currentTime: 1750000000n,
      kThreshold: 2,
    });

    expect(res.status).toBe(VerdictStatus.CHALLENGED);
    expect(res.badge).toBe("CHALLENGED");
    expect(res.flags.isChallengeUpheld).toBe(false);
    expect(res.flags.isOpenChallenge).toBe(true);
    expect(res.details.distinctDissentingChallengers).toBe(1);
  });

  it("does not count duplicate challenges from the same attester toward K", () => {
    const challenge1: ChallengeRecord = {
      uid: "0xchal01",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger11111111111111111111111111111111",
      time: 1710000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 200,
      observedVerdict: 1,
      evidenceHash: "0xevchal01",
      blockNumber: 110n,
      createdAt: new Date(),
    };

    const challenge2FromSameAttester: ChallengeRecord = {
      uid: "0xchal02",
      refUid: dummyVerdict.uid,
      attester: "0xCHALLENGER11111111111111111111111111111111", // Case-insensitive duplicate
      time: 1715000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 300,
      observedVerdict: 1,
      evidenceHash: "0xevchal02",
      blockNumber: 120n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [challenge1, challenge2FromSameAttester],
      modelInfo: activeModel,
      currentTime: 1750000000n,
      kThreshold: 2,
    });

    expect(res.status).toBe(VerdictStatus.CHALLENGED); // Open, but not upheld
    expect(res.flags.isChallengeUpheld).toBe(false);
    expect(res.details.distinctDissentingChallengers).toBe(1);
  });

  it("does not count challenges with identical verdict as dissenting", () => {
    const agreeingChallenge: ChallengeRecord = {
      uid: "0xchal01",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger11111111111111111111111111111111",
      time: 1710000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 9100,
      observedVerdict: 2, // Agrees: 2 === dummyVerdict.verdict (2)
      evidenceHash: "0xevchal01",
      blockNumber: 110n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [agreeingChallenge],
      modelInfo: activeModel,
      currentTime: 1750000000n,
      kThreshold: 2,
    });

    expect(res.details.distinctDissentingChallengers).toBe(0);
    expect(res.status).toBe(VerdictStatus.CHALLENGED); // open challenge exists, but 0 dissenting
  });

  it("evaluates to EXPIRED when now > expirationTime", () => {
    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: activeModel,
      currentTime: 1850000000n, // > expirationTime (1800000000n)
    });

    expect(res.status).toBe(VerdictStatus.EXPIRED);
    expect(res.badge).toBe("EXPIRED");
    expect(res.flags.isExpired).toBe(true);
  });

  it("evaluates to MODEL_DEGRADED (STALE badge) when Registry model status is 2 (DEGRADED)", () => {
    const degradedModel: ModelRecord = {
      ...activeModel,
      status: 2, // DEGRADED
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: degradedModel,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(res.badge).toBe("STALE");
    expect(res.flags.isModelDegraded).toBe(true);
  });

  it("evaluates to MODEL_DEGRADED (STALE badge) when latest canary AUC < 8000 bps", () => {
    const lowAucCanary: CanaryRecord = {
      uid: "0xcanary01",
      attester: "0xcanaryIssuer",
      time: 1720000000n,
      modelHash: dummyVerdict.modelHash,
      batchId: "0xbatch01",
      aucBps: 7950, // < 8000 (79.5%)
      eceBps: 500,  // Good ECE
      coverageBps: 10000,
      n: 500,
      labelsCommitHash: "0xcommit01",
      blockNumber: 130n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: activeModel,
      latestCanary: lowAucCanary,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(res.badge).toBe("STALE");
    expect(res.flags.isModelDegraded).toBe(true);
  });

  it("evaluates to MODEL_DEGRADED (STALE badge) when latest canary ECE > 1500 bps", () => {
    const highEceCanary: CanaryRecord = {
      uid: "0xcanary01",
      attester: "0xcanaryIssuer",
      time: 1720000000n,
      modelHash: dummyVerdict.modelHash,
      batchId: "0xbatch01",
      aucBps: 9200, // Good AUC
      eceBps: 1550, // > 1500 (15.5%)
      coverageBps: 10000,
      n: 500,
      labelsCommitHash: "0xcommit01",
      blockNumber: 130n,
      createdAt: new Date(),
    };

    const res = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: activeModel,
      latestCanary: highEceCanary,
      currentTime: 1750000000n,
    });

    expect(res.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(res.badge).toBe("STALE");
    expect(res.flags.isModelDegraded).toBe(true);
  });

  it("verifies strict priority hierarchy clashes", () => {
    // Both REVOKED and SUPERSEDED -> REVOKED wins
    const revokedAndSuperseded = computeVerdictStatus({
      verdict: { ...dummyVerdict, revocationTime: 1710000000n },
      supersedingVerdicts: [{ ...dummyVerdict, uid: "0xsup", refUid: dummyVerdict.uid, revocationTime: 0n }],
    });
    expect(revokedAndSuperseded.status).toBe(VerdictStatus.REVOKED);

    // Both SUPERSEDED and UPHELD_CHALLENGE -> SUPERSEDED wins
    const chal1: ChallengeRecord = {
      uid: "0xc1",
      refUid: dummyVerdict.uid,
      attester: "0xa1",
      time: 1710n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 0,
      observedVerdict: 1,
      evidenceHash: "0xev",
      blockNumber: 100n,
      createdAt: new Date(),
    };
    const chal2: ChallengeRecord = {
      uid: "0xc2",
      refUid: dummyVerdict.uid,
      attester: "0xa2",
      time: 1720n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 0,
      observedVerdict: 1,
      evidenceHash: "0xev",
      blockNumber: 100n,
      createdAt: new Date(),
    };
    const supersededAndUpheld = computeVerdictStatus({
      verdict: dummyVerdict,
      supersedingVerdicts: [{ ...dummyVerdict, uid: "0xsup", refUid: dummyVerdict.uid, revocationTime: 0n }],
      challenges: [chal1, chal2],
    });
    expect(supersededAndUpheld.status).toBe(VerdictStatus.SUPERSEDED);

    // Both UPHELD_CHALLENGE and EXPIRED -> UPHELD_CHALLENGE wins
    const upheldAndExpired = computeVerdictStatus({
      verdict: dummyVerdict,
      challenges: [chal1, chal2],
      currentTime: 1900000000n, // Expired
    });
    expect(upheldAndExpired.status).toBe(VerdictStatus.UPHELD_CHALLENGE);

    // Both EXPIRED and MODEL_DEGRADED -> EXPIRED wins
    const expiredAndDegraded = computeVerdictStatus({
      verdict: dummyVerdict,
      modelInfo: { ...activeModel, status: 2 },
      currentTime: 1900000000n,
    });
    expect(expiredAndDegraded.status).toBe(VerdictStatus.EXPIRED);
  });

  it("fetches and computes status end-to-end with getVerdictStatusFromRepo", async () => {
    const repo = new InMemoryIndexerRepository();
    await repo.upsertModel(activeModel);
    await repo.upsertVerdict(dummyVerdict);

    const statusRes = await getVerdictStatusFromRepo(repo, dummyVerdict.uid, {
      currentTime: 1750000000n,
    });

    expect(statusRes).not.toBeNull();
    expect(statusRes?.status).toBe(VerdictStatus.ACTIVE);
    expect(statusRes?.badge).toBe("ACTIVE");

    // Add 2 dissenting challenges
    await repo.upsertChallenge({
      uid: "0xchal1",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger1",
      time: 1710000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 100,
      observedVerdict: 1,
      evidenceHash: "0xev",
      blockNumber: 110n,
      createdAt: new Date(),
    });
    await repo.upsertChallenge({
      uid: "0xchal2",
      refUid: dummyVerdict.uid,
      attester: "0xchallenger2",
      time: 1720000000n,
      revocationTime: 0n,
      modelHash: dummyVerdict.modelHash,
      observedPFakeBps: 120,
      observedVerdict: 1,
      evidenceHash: "0xev",
      blockNumber: 120n,
      createdAt: new Date(),
    });

    const challengedRes = await getVerdictStatusFromRepo(repo, dummyVerdict.uid, {
      currentTime: 1750000000n,
    });
    expect(challengedRes?.status).toBe(VerdictStatus.UPHELD_CHALLENGE);
    expect(challengedRes?.badge).toBe("CHALLENGED");
  });
});
