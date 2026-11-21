/**
 * extension/src/api.ts — PRAMAN Indexer API Client for Browser Extension (T10.2).
 *
 * PRIVACY GUARANTEE (Claim C9):
 * ONLY perceptual hashes (SHA-256 and pHash strings) are transmitted as URL query parameters.
 * Image bytes NEVER leave the browser client.
 */

import { ExtensionConfig, PramanVerdictItem, PramanVerifyResult, VerdictStatus } from "./types";

export const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: "http://localhost:3000",
  webAppUrl: "http://localhost:3000",
  autoShowOverlay: true,
};

/** Load active extension configuration from chrome storage. */
export async function getConfig(): Promise<ExtensionConfig> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    const data = await chrome.storage.sync.get(DEFAULT_CONFIG);
    return {
      apiBaseUrl: data.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
      webAppUrl: data.webAppUrl || DEFAULT_CONFIG.webAppUrl,
      autoShowOverlay: data.autoShowOverlay ?? DEFAULT_CONFIG.autoShowOverlay,
    };
  }
  return DEFAULT_CONFIG;
}

/** Status priority hierarchy per spec §6: REVOKED > SUPERSEDED > UPHELD_CHALLENGE > EXPIRED > MODEL_DEGRADED > CHALLENGED > ACTIVE */
const STATUS_PRIORITY: Record<VerdictStatus, number> = {
  REVOKED: 70,
  SUPERSEDED: 60,
  UPHELD_CHALLENGE: 50,
  EXPIRED: 40,
  MODEL_DEGRADED: 30,
  CHALLENGED: 20,
  ACTIVE: 10,
  NO_VERDICTS_FOUND: 0,
};

/** Determine the highest-precedence verdict status among all returned records. */
export function aggregateVerdictStatus(verdicts: PramanVerdictItem[]): VerdictStatus {
  if (verdicts.length === 0) return "NO_VERDICTS_FOUND";
  let maxStatus: VerdictStatus = verdicts[0]!.status;
  let maxPriority = STATUS_PRIORITY[maxStatus] ?? 0;

  for (const v of verdicts) {
    const p = STATUS_PRIORITY[v.status] ?? 0;
    if (p > maxPriority) {
      maxPriority = p;
      maxStatus = v.status;
    }
  }
  return maxStatus;
}

/**
 * Query PRAMAN Indexer API for on-chain attestation records matching the image fingerprint.
 * Strictly uses GET with query parameters only.
 */
export async function fetchVerdicts(
  sha256: string,
  phash: string,
  srcUrl: string,
  config?: ExtensionConfig
): Promise<PramanVerifyResult> {
  const cfg = config || (await getConfig());
  const cleanBase = cfg.apiBaseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBase}/api/verdicts?sha256=${encodeURIComponent(sha256)}&phash=${encodeURIComponent(phash)}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Note: No body or media payload is sent!
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          sha256,
          phash,
          srcUrl,
          status: "NO_VERDICTS_FOUND",
          verdicts: [],
          verifiedAt: Date.now(),
        };
      }
      throw new Error(`API returned HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const rawVerdicts: any[] = Array.isArray(json) ? json : json.verdicts || [];

    const verdicts: PramanVerdictItem[] = rawVerdicts.map((item) => {
      const pFakePct = typeof item.pFakeBps === "number" ? item.pFakeBps / 10000 : undefined;
      const score = typeof item.score === "number" ? item.score : (pFakePct ?? 0);
      const label =
        item.label ||
        (item.verdict === 2
          ? "LIKELY SYNTHETIC"
          : item.verdict === 1
          ? "LIKELY AUTHENTIC"
          : "ABSTAIN");
      return {
        uid: item.uid || item.attestationUid || "",
        refUID: item.refUID || undefined,
        modelId: item.modelId || item.modelHash || item.model || "unknown",
        modelName: item.modelName || (item.modelHash ? `Model (${item.modelHash.slice(0, 10)})` : undefined),
        score,
        label,
        status: (item.status as VerdictStatus) || "ACTIVE",
        attester: item.attester || "",
        timestamp: item.timestamp || (item.time ? Number(item.time) * 1000 : Date.now()),
        txHash: item.txHash,
      };
    });

    const status = aggregateVerdictStatus(verdicts);

    return {
      found: verdicts.length > 0,
      sha256,
      phash,
      srcUrl,
      status,
      verdicts,
      verifiedAt: Date.now(),
    };
  } catch (err: any) {
    return {
      found: false,
      sha256,
      phash,
      srcUrl,
      status: "NO_VERDICTS_FOUND",
      verdicts: [],
      error: err.message || "Failed to query PRAMAN Indexer",
      verifiedAt: Date.now(),
    };
  }
}
