/**
 * extension/src/types.ts — Core TypeScript definitions for the PRAMANA Browser Extension (T10.2).
 */

export type VerdictStatus =
  | "ACTIVE"
  | "CHALLENGED"
  | "UPHELD_CHALLENGE"
  | "MODEL_DEGRADED"
  | "SUPERSEDED"
  | "REVOKED"
  | "EXPIRED"
  | "NO_VERDICTS_FOUND";

export interface PramanaVerdictItem {
  uid: string;
  refUID?: string;
  modelId: string;
  modelName?: string;
  score: number;
  label?: "REAL" | "SYNTHETIC" | "ABSTAIN";
  status: VerdictStatus;
  attester: string;
  timestamp: number;
  txHash?: string;
}

export interface PramanaVerifyResult {
  found: boolean;
  sha256: string;
  phash: string;
  srcUrl: string;
  status: VerdictStatus;
  verdicts: PramanaVerdictItem[];
  error?: string;
  verifiedAt: number;
}

export interface ExtensionConfig {
  apiBaseUrl: string;
  webAppUrl: string;
  autoShowOverlay: boolean;
}

export type ExtensionMessage =
  | { type: "PRAMANA_START_VERIFY"; srcUrl: string }
  | { type: "PRAMANA_VERIFY_RESULT"; result: PramanaVerifyResult }
  | { type: "PRAMANA_VERIFY_ERROR"; error: string; srcUrl: string }
  | { type: "PRAMANA_MANUAL_VERIFY"; srcUrl?: string; sha256?: string; phash?: string };
