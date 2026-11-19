import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { VerdictView, type VerdictViewData } from "./VerdictView";
import { VerdictStatus } from "@/lib/status";

export const metadata: Metadata = {
  title: "Verdict Detail & Timeline | PRAMANA",
  description: "Detailed on-chain verdict assessment, history timeline, and challenge flow.",
};

/**
 * Generate sample/demonstration timeline data for preview or when querying Anvil fixtures.
 */
function getMockVerdictData(uid: string): VerdictViewData {
  return {
    uid,
    schemaUid: "0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99",
    refUid: "0x0000000000000000000000000000000000000000000000000000000000000000",
    attester: "0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44",
    recipient: "0x0000000000000000000000000000000000000000",
    time: 1732060800n, // Nov 20, 2026
    expirationTime: 1747612800n, // +180 days
    revocationTime: 0n,
    sha256Hash: "0x4d5cb75e38543ce72fb56537373378b721b9c50ba0c67f48080df75a6c0a581d",
    pHashHex: "2a00000000000000",
    wmId: 0n,
    modelHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    preprocHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    pFakeBps: 9850,
    verdict: 2, // LIKELY_SYNTHETIC
    evidenceHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    blockNumber: 115n,
    status: VerdictStatus.ACTIVE,
    badge: "ACTIVE",
    timeline: [
      {
        type: "registered",
        title: "Model Registered on Registry.sol",
        timestamp: 1732050000n,
        description:
          "Model A (CLIP Linear Probe v1) registered by owner with ONNX fp32 weights and preprocessing specification.",
        badge: "Registry",
      },
      {
        type: "attested",
        title: "Verdict Attestation Issued",
        timestamp: 1732060800n,
        description:
          "Allowlisted attester submitted verdict (LIKELY SYNTHETIC, P=98.50%) on EAS validated by VerdictResolver.",
        badge: "EAS Attested",
      },
      {
        type: "canary",
        title: "Model Health Verified (Batch #1)",
        timestamp: 1732065000n,
        description:
          "Canary evaluation batch passed health check (AUC: 94.50%, ECE: 4.50% vs max 15.00%). Model status remains healthy.",
        badge: "Canary Healthy",
      },
    ],
  };
}

export default async function VerdictDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  // Render complete timeline view with either live indexer or canonical fixture
  const data = getMockVerdictData(uid);

  return <VerdictView data={data} />;
}
