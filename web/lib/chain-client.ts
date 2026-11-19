/**
 * web/lib/chain-client.ts — Read-only Viem public client for the PRAMANA web verifier (T6.3).
 *
 * Connects to Anvil (local dev) or Base Sepolia (testnet).
 * Never sends transactions or exposes private keys.
 * EAS contract addresses from: deployments/anvil.json and EAS Base Sepolia docs.
 */

import { createPublicClient, http, type PublicClient, type Chain } from "viem";
import { baseSepolia } from "viem/chains";
import { EAS_ABI, REGISTRY_ABI } from "@pramana/chain";

/** Anvil local chain (chainId 31337) */
const anvil: Chain = {
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
};

export type NetworkKey = "anvil" | "baseSepolia";

export interface NetworkConfig {
  chain: Chain;
  rpcUrl: string;
  easAddress: `0x${string}`;
  registryAddress: `0x${string}`;
  verdictSchemaUID: `0x${string}`;
  challengeSchemaUID: `0x${string}`;
  canarySchemaUID: `0x${string}`;
  explorerBase: string;
}

/** Deployment addresses from deployments/anvil.json (committed) */
const ANVIL_CONFIG: NetworkConfig = {
  chain: anvil,
  rpcUrl: "http://127.0.0.1:8545",
  easAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  registryAddress: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
  verdictSchemaUID: "0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99",
  challengeSchemaUID: "0x75af41a6841f31130063d320bfba8237732a390fa05f3f6abc723030731805c6",
  canarySchemaUID: "0x40b7431db61c01339c9f901cf5f5d720a7dbbea630a890bebd4891337325691c",
  explorerBase: "http://localhost:8545",
};

/**
 * Base Sepolia addresses (EAS pre-deployed; UNVERIFIED — verify at base-sepolia.easscan.org before use).
 * Registry / VerdictResolver: not yet deployed to Sepolia (Phase 4 T4.5 fallback = Anvil).
 */
const BASE_SEPOLIA_CONFIG: NetworkConfig = {
  chain: baseSepolia,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia.base.org",
  easAddress: "0x4200000000000000000000000000000000000021",
  registryAddress: "0x0000000000000000000000000000000000000000", // PLACEHOLDER — not yet deployed
  verdictSchemaUID: "0x0000000000000000000000000000000000000000000000000000000000000000", // PLACEHOLDER
  challengeSchemaUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
  canarySchemaUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
  explorerBase: "https://base-sepolia.easscan.org",
};

export function getNetworkConfig(network: NetworkKey = "anvil"): NetworkConfig {
  return network === "baseSepolia" ? BASE_SEPOLIA_CONFIG : ANVIL_CONFIG;
}

export function createVerifierClient(network: NetworkKey = "anvil"): PublicClient {
  const cfg = getNetworkConfig(network);
  return createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });
}

export interface OnChainAttestation {
  uid: `0x${string}`;
  schema: `0x${string}`;
  time: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  refUID: `0x${string}`;
  recipient: `0x${string}`;
  attester: `0x${string}`;
  revocable: boolean;
  data: `0x${string}`;
}

/** Fetch a full attestation from EAS by UID. Returns null if not found. */
export async function fetchAttestation(
  client: PublicClient,
  easAddress: `0x${string}`,
  uid: `0x${string}`
): Promise<OnChainAttestation | null> {
  try {
    const result = await client.readContract({
      address: easAddress,
      abi: EAS_ABI,
      functionName: "getAttestation",
      args: [uid],
    });
    const a = result as OnChainAttestation;
    // EAS returns a zero-uid attestation for non-existent UIDs
    if (a.uid === "0x0000000000000000000000000000000000000000000000000000000000000000") return null;
    return a;
  } catch {
    return null;
  }
}

/** Check if a model is registered and active on Registry. */
export async function fetchModelInfo(
  client: PublicClient,
  registryAddress: `0x${string}`,
  modelHash: `0x${string}`
): Promise<{ preprocHash: `0x${string}`; uri: string; specVersion: `0x${string}`; status: number; registered: boolean } | null> {
  if (registryAddress === "0x0000000000000000000000000000000000000000") return null;
  try {
    const result = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "getModel",
      args: [modelHash],
    });
    return result as { preprocHash: `0x${string}`; uri: string; specVersion: `0x${string}`; status: number; registered: boolean };
  } catch {
    return null;
  }
}
