/**
 * web/lib/status.ts — Status state machine (re-export, browser-compatible).
 *
 * Mirrors indexer/src/status.ts spec §6 logic, without DB imports,
 * so it can be called client-side in the web verifier.
 */

export enum VerdictStatus {
  REVOKED = "REVOKED",
  SUPERSEDED = "SUPERSEDED",
  UPHELD_CHALLENGE = "UPHELD_CHALLENGE",
  EXPIRED = "EXPIRED",
  MODEL_DEGRADED = "MODEL_DEGRADED", // badge: STALE
  CHALLENGED = "CHALLENGED",
  ACTIVE = "ACTIVE",
}

export type VerdictBadge = "REVOKED" | "SUPERSEDED" | "CHALLENGED" | "EXPIRED" | "STALE" | "ACTIVE";

export const DEFAULT_K_THRESHOLD = 2;
export const DEFAULT_AUC_MIN = 8000;
export const DEFAULT_ECE_MAX = 1500;

export interface VerdictSummary {
  uid: string;
  revocationTime: bigint;
  expirationTime: bigint;
  refUid: string;
  attester: string;
  time: bigint;
  verdict: number; // 0=ABSTAIN, 1=LIKELY_AUTHENTIC, 2=LIKELY_SYNTHETIC
  pFakeBps: number;
  modelHash: string;
  sha256Hash: string;
  pHashHex: string;
  evidenceHash: string;
  blockNumber: bigint;
  schemaUid: string;
}

export interface ChallengeSummary {
  uid: string;
  refUid: string;
  attester: string;
  revocationTime: bigint;
  observedVerdict: number;
  observedPFakeBps: number;
  time: bigint;
}

export interface ModelSummary {
  modelHash: string;
  status: number; // 0=ACTIVE, 1=DEPRECATED, 2=DEGRADED
  uri: string;
}

export interface CanarySummary {
  uid: string;
  time: bigint;
  aucBps: number;
  eceBps: number;
  modelHash: string;
}

export interface StatusInput {
  verdict: VerdictSummary;
  supersedingVerdicts?: VerdictSummary[];
  challenges?: ChallengeSummary[];
  model?: ModelSummary;
  latestCanary?: CanarySummary;
  currentTime?: bigint;
  kThreshold?: number;
  aucMin?: number;
  eceMax?: number;
}

export interface StatusResult {
  status: VerdictStatus;
  badge: VerdictBadge;
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
    supersededByUID?: string;
    canaryAucBps?: number;
    canaryEceBps?: number;
  };
}

/** Authoritative status computation per spec §6. */
export function computeVerdictStatus(input: StatusInput): StatusResult {
  const now = input.currentTime ?? BigInt(Math.floor(Date.now() / 1000));
  const kThreshold = input.kThreshold ?? DEFAULT_K_THRESHOLD;
  const aucMin = input.aucMin ?? DEFAULT_AUC_MIN;
  const eceMax = input.eceMax ?? DEFAULT_ECE_MAX;
  const { verdict } = input;

  const isRevoked = verdict.revocationTime > 0n;

  let isSuperseded = false;
  let supersededByUID: string | undefined;
  for (const sv of input.supersedingVerdicts ?? []) {
    if (sv.refUid.toLowerCase() === verdict.uid.toLowerCase() && sv.revocationTime === 0n) {
      isSuperseded = true;
      supersededByUID = sv.uid;
      break;
    }
  }

  const activeChallenges = (input.challenges ?? []).filter((c) => c.revocationTime === 0n);
  const isOpenChallenge = activeChallenges.length > 0;
  const dissentingSet = new Set<string>();
  for (const c of activeChallenges) {
    if (c.observedVerdict !== verdict.verdict) dissentingSet.add(c.attester.toLowerCase());
  }
  const distinctDissentingChallengers = dissentingSet.size;
  const isChallengeUpheld = distinctDissentingChallengers >= kThreshold;

  const isExpired = now > verdict.expirationTime;

  let isModelDegraded = false;
  let canaryAucBps: number | undefined;
  let canaryEceBps: number | undefined;
  if (input.model?.status === 2) isModelDegraded = true;
  if (input.latestCanary) {
    canaryAucBps = input.latestCanary.aucBps;
    canaryEceBps = input.latestCanary.eceBps;
    if (canaryAucBps < aucMin || canaryEceBps > eceMax) isModelDegraded = true;
  }

  let status: VerdictStatus;
  let badge: VerdictBadge;
  if (isRevoked) { status = VerdictStatus.REVOKED; badge = "REVOKED"; }
  else if (isSuperseded) { status = VerdictStatus.SUPERSEDED; badge = "SUPERSEDED"; }
  else if (isChallengeUpheld) { status = VerdictStatus.UPHELD_CHALLENGE; badge = "CHALLENGED"; }
  else if (isExpired) { status = VerdictStatus.EXPIRED; badge = "EXPIRED"; }
  else if (isModelDegraded) { status = VerdictStatus.MODEL_DEGRADED; badge = "STALE"; }
  else if (isOpenChallenge) { status = VerdictStatus.CHALLENGED; badge = "CHALLENGED"; }
  else { status = VerdictStatus.ACTIVE; badge = "ACTIVE"; }

  return {
    status,
    badge,
    flags: { isRevoked, isSuperseded, isChallengeUpheld, isExpired, isModelDegraded, isOpenChallenge },
    details: { distinctDissentingChallengers, kThreshold, supersededByUID, canaryAucBps, canaryEceBps },
  };
}

/** Human-readable verdict label per spec §1. */
export function verdictLabel(v: number): string {
  if (v === 0) return "ABSTAIN";
  if (v === 1) return "LIKELY AUTHENTIC";
  if (v === 2) return "LIKELY SYNTHETIC";
  return "UNKNOWN";
}

/** Human-readable pFake percentage string from bps. */
export function pFakePct(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

/** Format Unix timestamp to locale string. */
export function formatTs(ts: bigint | number | string): string {
  if (!ts || ts === 0n || ts === "0" || ts === 0) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}
