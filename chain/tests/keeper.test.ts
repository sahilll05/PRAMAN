import { describe, it, expect, vi } from "vitest";
import {
  evaluateVerdictNeedsRescan,
  PramanaKeeper,
  type CandidateVerdict,
  type ActiveModelInfo,
} from "../src/keeper.js";
import { type Hex } from "viem";

describe("PRAMANA Keeper Engine (Task T7.1, Spec §6)", () => {
  const MODEL_V1_HASH: Hex = "0x1111111111111111111111111111111111111111111111111111111111111111";
  const MODEL_V2_HASH: Hex = "0x2222222222222222222222222222222222222222222222222222222222222222";
  const PREPROC_HASH: Hex = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const sampleVerdict: CandidateVerdict = {
    uid: "0xabc1230000000000000000000000000000000000000000000000000000000000",
    attester: "0x1234567890123456789012345678901234567890",
    sha256Hash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    pHash: 1234567890123456789n,
    wmId: 0n,
    modelHash: MODEL_V1_HASH,
    preprocHash: PREPROC_HASH,
    pFakeBps: 8500,
    verdict: 2, // LIKELY_SYNTHETIC
    evidenceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    expirationTime: 2000000000n,
    revocationTime: 0n,
  };

  it("identifies degraded model and triggers MODEL_DEGRADED re-scan", () => {
    const models = new Map<Hex, ActiveModelInfo>([
      [
        MODEL_V1_HASH,
        {
          modelHash: MODEL_V1_HASH,
          preprocHash: PREPROC_HASH,
          status: 2, // DEGRADED
          registeredAt: 1000n,
        },
      ],
      [
        MODEL_V2_HASH,
        {
          modelHash: MODEL_V2_HASH,
          preprocHash: PREPROC_HASH,
          status: 0, // ACTIVE
          registeredAt: 2000n,
        },
      ],
    ]);

    const latestHealthy: ActiveModelInfo = models.get(MODEL_V2_HASH)!;
    const now = 1500000000n;

    const evaluation = evaluateVerdictNeedsRescan(
      sampleVerdict,
      models,
      latestHealthy,
      now
    );

    expect(evaluation.needsRescan).toBe(true);
    expect(evaluation.reason).toBe("MODEL_DEGRADED");
    expect(evaluation.suggestedModelHash).toBe(MODEL_V2_HASH);
  });

  it("identifies newer model version and triggers NEWER_MODEL_AVAILABLE re-scan", () => {
    const models = new Map<Hex, ActiveModelInfo>([
      [
        MODEL_V1_HASH,
        {
          modelHash: MODEL_V1_HASH,
          preprocHash: PREPROC_HASH,
          status: 0, // ACTIVE
          registeredAt: 1000n,
        },
      ],
      [
        MODEL_V2_HASH,
        {
          modelHash: MODEL_V2_HASH,
          preprocHash: PREPROC_HASH,
          status: 0, // ACTIVE
          registeredAt: 2000n,
        },
      ],
    ]);

    const latestHealthy: ActiveModelInfo = models.get(MODEL_V2_HASH)!;
    const now = 1500000000n;

    const evaluation = evaluateVerdictNeedsRescan(
      sampleVerdict,
      models,
      latestHealthy,
      now
    );

    expect(evaluation.needsRescan).toBe(true);
    expect(evaluation.reason).toBe("NEWER_MODEL_AVAILABLE");
    expect(evaluation.suggestedModelHash).toBe(MODEL_V2_HASH);
  });

  it("identifies expiring verdict and triggers EXPIRING_SOON re-scan", () => {
    const models = new Map<Hex, ActiveModelInfo>([
      [
        MODEL_V1_HASH,
        {
          modelHash: MODEL_V1_HASH,
          preprocHash: PREPROC_HASH,
          status: 0, // ACTIVE
          registeredAt: 1000n,
        },
      ],
    ]);

    const now = 2000000000n - 100n; // 100s before expiry

    const evaluation = evaluateVerdictNeedsRescan(
      sampleVerdict,
      models,
      undefined,
      now,
      { expirationThresholdSeconds: 3600n }
    );

    expect(evaluation.needsRescan).toBe(true);
    expect(evaluation.reason).toBe("EXPIRING_SOON");
    expect(evaluation.suggestedModelHash).toBe(MODEL_V1_HASH);
  });

  it("ignores revoked verdicts", () => {
    const revokedVerdict: CandidateVerdict = {
      ...sampleVerdict,
      revocationTime: 1600000000n,
    };

    const models = new Map<Hex, ActiveModelInfo>();
    const evaluation = evaluateVerdictNeedsRescan(revokedVerdict, models);

    expect(evaluation.needsRescan).toBe(false);
  });

  it("orchestrates keeper cycle scanning and executes supersessions", async () => {
    const mockClients = {
      walletClient: {
        writeContract: vi.fn().mockResolvedValue("0xtxhash123"),
      },
      publicClient: {
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] }),
        readContract: vi.fn(),
      },
      account: { address: "0x1234567890123456789012345678901234567890" },
      easAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3" as Hex,
      registryAddress: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0" as Hex,
    } as any;

    const schemaUID: Hex = "0x9999999999999999999999999999999999999999999999999999999999999999";
    const keeper = new PramanaKeeper(mockClients, schemaUID);

    keeper.registerModelInfo({
      modelHash: MODEL_V1_HASH,
      preprocHash: PREPROC_HASH,
      status: 2, // DEGRADED
      registeredAt: 1000n,
    });

    keeper.registerModelInfo({
      modelHash: MODEL_V2_HASH,
      preprocHash: PREPROC_HASH,
      status: 0, // ACTIVE
      registeredAt: 2000n,
    });

    const candidates = keeper.scanVerdicts([sampleVerdict], 1500000000n);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.evaluation.reason).toBe("MODEL_DEGRADED");

    // Execute supersession
    const cycle = await keeper.processSupersessions([
      {
        verdict: candidates[0]!.verdict,
        evaluation: candidates[0]!.evaluation,
        recomputedData: {
          sha256Hash: sampleVerdict.sha256Hash,
          pHash: sampleVerdict.pHash,
          wmId: sampleVerdict.wmId,
          modelHash: MODEL_V2_HASH,
          preprocHash: PREPROC_HASH,
          pFakeBps: 8750,
          verdict: 2,
          evidenceHash: "0x2222eeee2222eeee2222eeee2222eeee2222eeee2222eeee2222eeee2222eeee",
        },
      },
    ]);

    expect(cycle.supersededCount).toBe(1);
    expect(cycle.supersessions[0]!.targetUid).toBe(sampleVerdict.uid);
    expect(cycle.supersessions[0]!.reason).toBe("MODEL_DEGRADED");
    expect(mockClients.walletClient.writeContract).toHaveBeenCalledTimes(1);
  });
});
