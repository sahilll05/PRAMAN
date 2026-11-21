/**
 * extension/src/types.ts — Core TypeScript definitions for the PRAMAN Browser Extension (T10.2).
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

export interface PramanVerdictItem {
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

export interface PramanVerifyResult {
  found: boolean;
  sha256: string;
  phash: string;
  srcUrl: string;
  status: VerdictStatus;
  verdicts: PramanVerdictItem[];
  error?: string;
  verifiedAt: number;
}

export type PramanaVerdictItem = PramanVerdictItem;
export type PramanaVerifyResult = PramanVerifyResult;

export interface ExtensionConfig {
  apiBaseUrl: string;
  webAppUrl: string;
  autoShowOverlay: boolean;
}

export type ExtensionMessage =
  | { type: "PRAMAN_START_VERIFY"; srcUrl: string }
  | { type: "PRAMAN_VERIFY_RESULT"; result: PramanVerifyResult }
  | { type: "PRAMAN_VERIFY_ERROR"; error: string; srcUrl: string }
  | { type: "PRAMAN_MANUAL_VERIFY"; srcUrl?: string; sha256?: string; phash?: string };
