/**
 * PRAMANA Keeper Daemon & Re-scan Engine (Task T7.1).
 *
 * Scans active and historical verdicts, detects models that have degraded or
 * verdicts that are nearing expiration or superseded by newer registered models,
 * and issues superseding on-chain EAS attestations with `refUID = old_uid`.
 *
 * Conforms to:
 * - Spec §2.1 (Verdict EAS Schema & refUID supersession)
 * - Spec §3.2 (VerdictResolver on-chain supersession validation)
 * - Spec §6 (Authoritative status state machine)
 */

import { type Hex, type Hash } from "viem";
import { type PramanaClients } from "./client.js";
import { attestVerdict, type AttestVerdictOptions } from "./actions.js";
import { type VerdictData } from "./schemas.js";

export type RescanReason =
  | "MODEL_DEGRADED"
  | "NEWER_MODEL_AVAILABLE"
  | "EXPIRING_SOON"
  | "MANUAL_RESCAN";

export interface CandidateVerdict {
  uid: Hex;
  attester: Hex;
  sha256Hash: Hex;
  pHash: bigint;
  wmId: bigint;
  modelHash: Hex;
  preprocHash: Hex;
  pFakeBps: number;
  verdict: number;
  evidenceHash: Hex;
  expirationTime: bigint;
  revocationTime: bigint;
  refUid?: Hex | undefined;
}

export interface ActiveModelInfo {
  modelHash: Hex;
  preprocHash: Hex;
  status: number; // 0=ACTIVE, 1=DEPRECATED, 2=DEGRADED
  registeredAt?: bigint | undefined;
}

export interface RescanEvaluation {
  needsRescan: boolean;
  reason?: RescanReason | undefined;
  suggestedModelHash?: Hex | undefined;
  suggestedPreprocHash?: Hex | undefined;
  details: string;
}

export interface KeeperOptions {
  /** Grace period before expiration to trigger re-scan (default: 14 days in seconds) */
  expirationThresholdSeconds?: bigint | undefined;
  /** Force re-scan even if model is not degraded */
  force?: boolean | undefined;
}

export const DEFAULT_EXPIRATION_THRESHOLD = 14n * 24n * 3600n; // 14 days

/**
 * Evaluates whether a given Verdict requires re-scan and supersession.
 */
export function evaluateVerdictNeedsRescan(
  verdict: CandidateVerdict,
  activeModels: Map<Hex, ActiveModelInfo>,
  latestHealthyModel?: ActiveModelInfo | undefined,
  currentTime: bigint = BigInt(Math.floor(Date.now() / 1000)),
  options: KeeperOptions = {}
): RescanEvaluation {
  // If already revoked, do not re-scan
  if (verdict.revocationTime > 0n) {
    return {
      needsRescan: false,
      details: "Verdict is revoked; supersession disallowed.",
    };
  }

  const model = activeModels.get(verdict.modelHash);

  // 1. Model is degraded or deprecated
  if (!model || model.status === 2 /* DEGRADED */) {
    if (latestHealthyModel && latestHealthyModel.modelHash !== verdict.modelHash) {
      return {
        needsRescan: true,
        reason: "MODEL_DEGRADED",
        suggestedModelHash: latestHealthyModel.modelHash,
        suggestedPreprocHash: latestHealthyModel.preprocHash,
        details: `Model ${verdict.modelHash} is DEGRADED. Re-scan required with healthy model ${latestHealthyModel.modelHash}.`,
      };
    }
    return {
      needsRescan: false,
      details: `Model ${verdict.modelHash} is DEGRADED, but no healthy replacement model is registered.`,
    };
  }

  // 2. Newer model available
  if (
    latestHealthyModel &&
    latestHealthyModel.modelHash !== verdict.modelHash &&
    latestHealthyModel.status === 0 /* ACTIVE */ &&
    (latestHealthyModel.registeredAt ?? 0n) > (model.registeredAt ?? 0n)
  ) {
    return {
      needsRescan: true,
      reason: "NEWER_MODEL_AVAILABLE",
      suggestedModelHash: latestHealthyModel.modelHash,
      suggestedPreprocHash: latestHealthyModel.preprocHash,
      details: `Newer active model ${latestHealthyModel.modelHash} available to supersede older model ${verdict.modelHash}.`,
    };
  }

  // 3. Expiring soon
  const threshold = options.expirationThresholdSeconds ?? DEFAULT_EXPIRATION_THRESHOLD;
  if (verdict.expirationTime <= currentTime + threshold) {
    return {
      needsRescan: true,
      reason: "EXPIRING_SOON",
      suggestedModelHash: verdict.modelHash,
      suggestedPreprocHash: verdict.preprocHash,
      details: `Verdict expires at ${verdict.expirationTime} (within threshold ${threshold}s). Re-scan required to extend validity.`,
    };
  }

  if (options.force) {
    return {
      needsRescan: true,
      reason: "MANUAL_RESCAN",
      suggestedModelHash: latestHealthyModel?.modelHash ?? verdict.modelHash,
      suggestedPreprocHash: latestHealthyModel?.preprocHash ?? verdict.preprocHash,
      details: "Manual forced re-scan requested.",
    };
  }

  return {
    needsRescan: false,
    details: "Verdict is fresh and attested with active model; no re-scan needed.",
  };
}

export interface SupersedeVerdictParams {
  clients: PramanaClients;
  verdictSchemaUID: Hex;
  targetVerdict: CandidateVerdict;
  newVerdictData: VerdictData;
  expirationDays?: number | undefined;
}

/**
 * Submits an on-chain EAS attestation that supersedes a target verdict (T7.1).
 */
export async function supersedeVerdict(
  params: SupersedeVerdictParams
): Promise<{ txHash: Hash; newUid: Hex; targetUid: Hex }> {
  const { clients, verdictSchemaUID, targetVerdict, newVerdictData, expirationDays = 180 } = params;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const expirationTime = now + BigInt(expirationDays * 24 * 3600);

  const attestResult = await attestVerdict(clients, {
    verdictData: newVerdictData,
    verdictSchemaUID,
    expirationTime,
    refUID: targetVerdict.uid,
  });

  return {
    txHash: attestResult.txHash,
    newUid: attestResult.uid,
    targetUid: targetVerdict.uid,
  };
}

export interface KeeperCycleResult {
  totalChecked: number;
  rescanCandidates: number;
  supersededCount: number;
  supersessions: Array<{
    targetUid: Hex;
    newUid: Hex;
    txHash: Hash;
    reason: RescanReason;
  }>;
}

/**
 * Keeper Engine class for orchestrating automated scans and supersessions.
 */
export class PramanaKeeper {
  constructor(
    private clients: PramanaClients,
    private verdictSchemaUID: Hex,
    private models: Map<Hex, ActiveModelInfo> = new Map()
  ) {}

  public registerModelInfo(info: ActiveModelInfo): void {
    this.models.set(info.modelHash, info);
  }

  public getModelInfo(modelHash: Hex): ActiveModelInfo | undefined {
    return this.models.get(modelHash);
  }

  public findLatestHealthyModel(): ActiveModelInfo | undefined {
    let latest: ActiveModelInfo | undefined;
    for (const model of this.models.values()) {
      if (model.status === 0 /* ACTIVE */) {
        if (!latest || (model.registeredAt ?? 0n) > (latest.registeredAt ?? 0n)) {
          latest = model;
        }
      }
    }
    return latest;
  }

  public scanVerdicts(
    verdicts: CandidateVerdict[],
    currentTime: bigint = BigInt(Math.floor(Date.now() / 1000)),
    options?: KeeperOptions | undefined
  ): Array<{ verdict: CandidateVerdict; evaluation: RescanEvaluation }> {
    const healthyModel = this.findLatestHealthyModel();
    const results: Array<{ verdict: CandidateVerdict; evaluation: RescanEvaluation }> = [];

    for (const verdict of verdicts) {
      const evalResult = evaluateVerdictNeedsRescan(
        verdict,
        this.models,
        healthyModel,
        currentTime,
        options
      );
      if (evalResult.needsRescan) {
        results.push({ verdict, evaluation: evalResult });
      }
    }

    return results;
  }

  public async processSupersessions(
    candidates: Array<{
      verdict: CandidateVerdict;
      evaluation: RescanEvaluation;
      recomputedData: VerdictData;
    }>,
    expirationDays: number = 180
  ): Promise<KeeperCycleResult> {
    const cycleResult: KeeperCycleResult = {
      totalChecked: candidates.length,
      rescanCandidates: candidates.length,
      supersededCount: 0,
      supersessions: [],
    };

    for (const item of candidates) {
      const res = await supersedeVerdict({
        clients: this.clients,
        verdictSchemaUID: this.verdictSchemaUID,
        targetVerdict: item.verdict,
        newVerdictData: item.recomputedData,
        expirationDays,
      });

      cycleResult.supersededCount++;
      cycleResult.supersessions.push({
        targetUid: res.targetUid,
        newUid: res.newUid,
        txHash: res.txHash,
        reason: item.evaluation.reason ?? "MANUAL_RESCAN",
      });
    }

    return cycleResult;
  }
}
