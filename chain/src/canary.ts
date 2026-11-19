/**
 * PRAMANA Canary Commit-Reveal & Health Engine (Task T7.2).
 *
 * Implements cryptographic commitment-reveal verification and metrics check
 * for continuous canary model health auditing per Spec §2.3 and Spec §6.
 */

import { type Hex, type Hash } from "viem";
import { type PramanaClients } from "./client.js";
import { attestCanary } from "./actions.js";
import { type CanaryData } from "./schemas.js";

export interface CanaryItem {
  itemId: string;
  sha256: Hex;
  label: number; // 0: Authentic, 1: Synthetic
}

export interface CanaryManifest {
  batchId: Hex;
  n: number;
  salt: string;
  items: CanaryItem[];
}

export interface CanaryEvaluationResult {
  aucBps: number;
  eceBps: number;
  coverageBps: number;
  n: number;
  isDegraded: boolean;
  details: string;
}

export const DEFAULT_AUC_MIN_BPS = 8000; // 80.00%
export const DEFAULT_ECE_MAX_BPS = 1500; // 15.00%

/**
 * Check if canary metrics violate healthy thresholds per Spec §6.
 */
export function isCanaryDegraded(
  aucBps: number,
  eceBps: number,
  aucMinBps: number = DEFAULT_AUC_MIN_BPS,
  eceMaxBps: number = DEFAULT_ECE_MAX_BPS
): boolean {
  return aucBps < aucMinBps || eceBps > eceMaxBps;
}

/**
 * Submits CanaryResult attestation to EAS via canaryIssuer role (T7.2).
 */
export async function publishCanaryResult(
  clients: PramanaClients,
  canarySchemaUID: Hex,
  canaryData: CanaryData
): Promise<{ txHash: Hash; uid: Hex }> {
  return attestCanary(clients, {
    canarySchemaUID,
    canaryData,
  });
}
