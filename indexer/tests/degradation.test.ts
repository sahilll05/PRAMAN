import { describe, it, expect } from "vitest";
import {
  InMemoryIndexerRepository,
} from "../src/ingest.js";
import {
  getVerdictStatusFromRepo,
  VerdictStatus,
  DEFAULT_AUC_MIN,
  DEFAULT_ECE_MAX,
} from "../src/status.js";
import { type VerdictRecord, type ModelRecord, type CanaryRecord } from "../src/db/schema.js";

describe("T7.3 Degradation Rule & Reactive Indexer Status", () => {
  const MODEL_A_HASH = "0xaaaa111100000000000000000000000000000000000000000000000000000000";
  const MODEL_B_HASH = "0xbbbb222200000000000000000000000000000000000000000000000000000000";
  const PREPROC_HASH = "0xpppp000000000000000000000000000000000000000000000000000000000000";

  it("dynamically flips status to MODEL_DEGRADED (STALE) upon canary degradation and resolves to SUPERSEDED", async () => {
    const repo = new InMemoryIndexerRepository();
    const now = 1700000000n;

    // 1. Model A registered as ACTIVE
    const modelA: ModelRecord = {
      modelHash: MODEL_A_HASH,
      preprocHash: PREPROC_HASH,
      uri: "ipfs://model-a",
      specVersion: "0x302e312e30000000000000000000000000000000000000000000000000000000",
      status: 0, // ACTIVE
      registeredAt: now - 1000n,
      txHash: "0xtx1",
      blockNumber: 100n,
    };
    await repo.upsertModel(modelA);

    // 2. Verdict attested with Model A
    const verdictUID = "0xverdict10000000000000000000000000000000000000000000000000000000000";
    const verdict1: VerdictRecord = {
      uid: verdictUID,
      schemaUid: "0xschema1",
      attester: "0x1111111111111111111111111111111111111111",
      recipient: "0x0000000000000000000000000000000000000000",
      sha256Hash: "0xsha1",
      pHash: "123456789",
      wmId: "0",
      modelHash: MODEL_A_HASH,
      preprocHash: PREPROC_HASH,
      pFakeBps: 9200,
      verdict: 2,
      evidenceHash: "0xevi1",
      expirationTime: now + 86400n * 180n,
      revocationTime: 0n,
      refUid: "0x0000000000000000000000000000000000000000000000000000000000000000",
      txHash: "0xtx2",
      blockNumber: 101n,
      timestamp: now - 500n,
    };
    await repo.upsertVerdict(verdict1);

    // Initially: Status should be ACTIVE
    const initialStatus = await getVerdictStatusFromRepo(repo, verdictUID, { currentTime: now });
    expect(initialStatus!.status).toBe(VerdictStatus.ACTIVE);
    expect(initialStatus!.badge).toBe("ACTIVE");
    expect(initialStatus!.flags.isModelDegraded).toBe(false);

    // 3. Canary arrives for Model A with AUC below threshold (7500 < 8000)
    const canaryDegradedAuc: CanaryRecord = {
      uid: "0xcanary1",
      attester: "0xcanaryissuer",
      time: now - 100n,
      modelHash: MODEL_A_HASH,
      batchId: "0xbatch1",
      aucBps: 7500, // Degraded: < 8000
      eceBps: 800,  // Healthy: <= 1500
      coverageBps: 8500,
      n: 200,
      labelsCommitHash: "0xcommit1",
      blockNumber: 102n,
      createdAt: new Date(),
    };
    await repo.upsertCanary(canaryDegradedAuc);

    // Status must immediately flip to MODEL_DEGRADED with badge "STALE"
    const degradedStatus = await getVerdictStatusFromRepo(repo, verdictUID, { currentTime: now });
    expect(degradedStatus!.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(degradedStatus!.badge).toBe("STALE");
    expect(degradedStatus!.flags.isModelDegraded).toBe(true);
    expect(degradedStatus!.details.canaryAucBps).toBe(7500);

    // 4. Test ECE degradation condition (> 1500)
    const canaryDegradedEce: CanaryRecord = {
      uid: "0xcanary2",
      attester: "0xcanaryissuer",
      time: now - 50n,
      modelHash: MODEL_A_HASH,
      batchId: "0xbatch2",
      aucBps: 8800, // Healthy: >= 8000
      eceBps: 1800, // Degraded: > 1500
      coverageBps: 8500,
      n: 200,
      labelsCommitHash: "0xcommit2",
      blockNumber: 103n,
      createdAt: new Date(),
    };
    await repo.upsertCanary(canaryDegradedEce);

    const degradedEceStatus = await getVerdictStatusFromRepo(repo, verdictUID, { currentTime: now });
    expect(degradedEceStatus!.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(degradedEceStatus!.badge).toBe("STALE");
    expect(degradedEceStatus!.details.canaryEceBps).toBe(1800);

    // 5. Test Registry on-chain DEGRADED status (status == 2)
    await repo.updateModelStatus(MODEL_A_HASH, 2);
    const registryDegradedStatus = await getVerdictStatusFromRepo(repo, verdictUID, { currentTime: now });
    expect(registryDegradedStatus!.status).toBe(VerdictStatus.MODEL_DEGRADED);
    expect(registryDegradedStatus!.badge).toBe("STALE");

    // 6. Keeper executes supersession: New verdict attested with healthy Model B
    const modelB: ModelRecord = {
      modelHash: MODEL_B_HASH,
      preprocHash: PREPROC_HASH,
      uri: "ipfs://model-b",
      specVersion: "0x302e312e30000000000000000000000000000000000000000000000000000000",
      status: 0, // ACTIVE
      registeredAt: now - 100n,
      txHash: "0xtx5",
      blockNumber: 104n,
    };
    await repo.upsertModel(modelB);

    const newVerdictUID = "0xverdict20000000000000000000000000000000000000000000000000000000000";
    const verdict2: VerdictRecord = {
      uid: newVerdictUID,
      schemaUid: "0xschema1",
      attester: "0x1111111111111111111111111111111111111111",
      recipient: "0x0000000000000000000000000000000000000000",
      sha256Hash: "0xsha1",
      pHash: "123456789",
      wmId: "0",
      modelHash: MODEL_B_HASH,
      preprocHash: PREPROC_HASH,
      pFakeBps: 9400,
      verdict: 2,
      evidenceHash: "0xevi2",
      expirationTime: now + 86400n * 180n,
      revocationTime: 0n,
      refUid: verdictUID, // Supersedes old verdict!
      txHash: "0xtx6",
      blockNumber: 105n,
      timestamp: now,
    };
    await repo.upsertVerdict(verdict2);

    // Old verdict must now be SUPERSEDED (priority: SUPERSEDED > MODEL_DEGRADED)
    const oldVerdictStatus = await getVerdictStatusFromRepo(repo, verdictUID, { currentTime: now });
    expect(oldVerdictStatus!.status).toBe(VerdictStatus.SUPERSEDED);
    expect(oldVerdictStatus!.badge).toBe("SUPERSEDED");
    expect(oldVerdictStatus!.flags.isSuperseded).toBe(true);
    expect(oldVerdictStatus!.details.supersededByUID).toBe(newVerdictUID);

    // New verdict must be ACTIVE
    const newVerdictStatus = await getVerdictStatusFromRepo(repo, newVerdictUID, { currentTime: now });
    expect(newVerdictStatus!.status).toBe(VerdictStatus.ACTIVE);
    expect(newVerdictStatus!.badge).toBe("ACTIVE");
  });
});
