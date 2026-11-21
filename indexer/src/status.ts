/**
 * PRAMAN Status State Machine (Spec §6, Authoritative).
 *
 * Implements the normative lifecycle transitions for on-chain Verdict attestations:
 *
 * Priority order:
 *   REVOKED > SUPERSEDED > UPHELD_CHALLENGE > EXPIRED > MODEL_DEGRADED(=STALE) > CHALLENGED(open) > ACTIVE
 *
 * Rules:
 *   1. REVOKED: EAS revocationTime > 0.
 *   2. SUPERSEDED: A non-revoked Verdict exists with refUID == target.uid.
 *   3. UPHELD_CHALLENGE: At least K distinct challengers (default K=2) have valid challenges
 *      against target.uid where observedVerdict != target.verdict.
 *   4. EXPIRED: now > target.expirationTime.
 *   5. MODEL_DEGRADED: Model status is DEGRADED (status == 2) in Registry OR
 *      latest CanaryResult for modelHash has aucBps < AUC_MIN (default 8000) OR
 *      eceBps > ECE_MAX (default 1500). Displays badge "STALE".
 *   6. CHALLENGED: Open non-upheld challenge exists with refUID == target.uid.
 *   7. ACTIVE: Valid, non-expired, un-challenged, active model verdict.
 */

import type {
  VerdictRecord,
  ChallengeRecord,
  ModelRecord,
  CanaryRecord,
} from "./db/schema.js";
import type { IndexerRepository } from "./ingest.js";

export enum VerdictStatus {
  REVOKED = "REVOKED",
  SUPERSEDED = "SUPERSEDED",
  UPHELD_CHALLENGE = "UPHELD_CHALLENGE",
  EXPIRED = "EXPIRED",
  MODEL_DEGRADED = "MODEL_DEGRADED", // UI badge: "STALE"
  CHALLENGED = "CHALLENGED",         // UI badge: "CHALLENGED (open)"
  ACTIVE = "ACTIVE",
}

export type VerdictBadge =
  | "REVOKED"
  | "SUPERSEDED"
  | "CHALLENGED"
  | "EXPIRED"
  | "STALE"
  | "ACTIVE";

export interface StatusComputationInput {
  verdict: VerdictRecord;
  supersedingVerdicts?: VerdictRecord[] | undefined;
  challenges?: ChallengeRecord[] | undefined;
  modelInfo?: ModelRecord | undefined;
  latestCanary?: CanaryRecord | undefined;
  currentTime?: bigint | undefined;
  kThreshold?: number | undefined; // default: 2
  aucMin?: number | undefined;     // default: 8000 (80.00%)
  eceMax?: number | undefined;     // default: 1500 (15.00%)
}

export interface StatusComputationResult {
  status: VerdictStatus;
  badge: VerdictBadge;
  effectiveStatus: string;
  flags: {
    isRevoked: boolean;
    isSuperseded: boolean;
    isChallengeUpheld: boolean;
    isExpired: boolean;
    isModelDegraded: boolean;
    isOpenChallenge: boolean;
  };
  details: {
    distinctDissentingChallengers: number;
    kThreshold: number;
    supersededByUID?: string | undefined;
    canaryAucBps?: number | undefined;
    canaryEceBps?: number | undefined;
  };
}

export const DEFAULT_K_THRESHOLD = 2;
export const DEFAULT_AUC_MIN = 8000; // 80.00%
export const DEFAULT_ECE_MAX = 1500; // 15.00%

/**
 * Authoritative computation of effective verdict status per spec §6.
 */
export function computeVerdictStatus(input: StatusComputationInput): StatusComputationResult {
  const now = input.currentTime ?? BigInt(Math.floor(Date.now() / 1000));
  const kThreshold = input.kThreshold ?? DEFAULT_K_THRESHOLD;
  const aucMin = input.aucMin ?? DEFAULT_AUC_MIN;
  const eceMax = input.eceMax ?? DEFAULT_ECE_MAX;

  const { verdict } = input;

  // 1. REVOKED check
  const isRevoked = verdict.revocationTime > 0n;

  // 2. SUPERSEDED check: exists non-revoked Verdict with refUID == verdict.uid
  let isSuperseded = false;
  let supersededByUID: string | undefined;
  if (input.supersedingVerdicts) {
    const validSuperseding = input.supersedingVerdicts.find(
      (v) => v.refUid === verdict.uid && v.revocationTime === 0n
    );
    if (validSuperseding) {
      isSuperseded = true;
      supersededByUID = validSuperseding.uid;
    }
  }

  // 3. CHALLENGE evaluation
  // Count distinct challengers where observedVerdict != verdict.verdict
  const activeChallenges = (input.challenges ?? []).filter((c) => c.revocationTime === 0n);
  const isOpenChallenge = activeChallenges.length > 0;

  const dissentingChallengers = new Set<string>();
  for (const c of activeChallenges) {
    if (c.observedVerdict !== verdict.verdict) {
      dissentingChallengers.add(c.attester.toLowerCase());
    }
  }
  const distinctDissentingCount = dissentingChallengers.size;
  const isChallengeUpheld = distinctDissentingCount >= kThreshold;

  // 4. EXPIRED check
  const isExpired = now > verdict.expirationTime;

  // 5. MODEL_DEGRADED check (Registry status == 2 OR Canary below thresholds)
  let isModelDegraded = false;
  let canaryAucBps: number | undefined;
  let canaryEceBps: number | undefined;

  if (input.modelInfo && input.modelInfo.status === 2) {
    isModelDegraded = true;
  }

  if (input.latestCanary) {
    canaryAucBps = input.latestCanary.aucBps;
    canaryEceBps = input.latestCanary.eceBps;
    if (canaryAucBps < aucMin || canaryEceBps > eceMax) {
      isModelDegraded = true;
    }
  }

  // Determine Effective Status by strict priority:
  // REVOKED > SUPERSEDED > UPHELD_CHALLENGE > EXPIRED > MODEL_DEGRADED > CHALLENGED > ACTIVE
  let status: VerdictStatus;
  let badge: VerdictBadge;

  if (isRevoked) {
    status = VerdictStatus.REVOKED;
    badge = "REVOKED";
  } else if (isSuperseded) {
    status = VerdictStatus.SUPERSEDED;
    badge = "SUPERSEDED";
  } else if (isChallengeUpheld) {
    status = VerdictStatus.UPHELD_CHALLENGE;
    badge = "CHALLENGED";
  } else if (isExpired) {
    status = VerdictStatus.EXPIRED;
    badge = "EXPIRED";
  } else if (isModelDegraded) {
    status = VerdictStatus.MODEL_DEGRADED;
    badge = "STALE";
  } else if (isOpenChallenge) {
    status = VerdictStatus.CHALLENGED;
    badge = "CHALLENGED";
  } else {
    status = VerdictStatus.ACTIVE;
    badge = "ACTIVE";
  }

  return {
    status,
    badge,
    effectiveStatus: status.toString(),
    flags: {
      isRevoked,
      isSuperseded,
      isChallengeUpheld,
      isExpired,
      isModelDegraded,
      isOpenChallenge,
    },
    details: {
      distinctDissentingChallengers: distinctDissentingCount,
      kThreshold,
      supersededByUID,
      canaryAucBps,
      canaryEceBps,
    },
  };
}

/**
 * Retrieve and compute authoritative status for a verdict directly from an IndexerRepository.
 */
export async function getVerdictStatusFromRepo(
  repo: IndexerRepository,
  uid: string,
  options?: {
    currentTime?: bigint | undefined;
    kThreshold?: number | undefined;
    aucMin?: number | undefined;
    eceMax?: number | undefined;
  }
): Promise<StatusComputationResult | null> {
  const verdict = await repo.getVerdict(uid);
  if (!verdict) {
    return null;
  }

  const [supersedingVerdicts, challenges, modelInfo, latestCanary] = await Promise.all([
    repo.getVerdictsByRefUid(uid),
    repo.getChallengesByRefUid(uid),
    repo.getModel(verdict.modelHash),
    repo.getLatestCanary(verdict.modelHash),
  ]);

  return computeVerdictStatus({
    verdict,
    supersedingVerdicts,
    challenges,
    modelInfo: modelInfo ?? undefined,
    latestCanary: latestCanary ?? undefined,
    currentTime: options?.currentTime,
    kThreshold: options?.kThreshold,
    aucMin: options?.aucMin,
    eceMax: options?.eceMax,
  });
}

