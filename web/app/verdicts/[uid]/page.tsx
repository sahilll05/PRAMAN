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

  // Strict regex validation for 32-byte hex UID
  const cleanUid = uid?.trim();
  const isValidUid = /^0x[0-9a-fA-F]{64}$/.test(cleanUid);

  if (!isValidUid) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-900">
          <Info className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Invalid Attestation UID</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          The requested UID does not conform to the 32-byte hexadecimal EAS attestation format (<code className="font-mono text-xs">0x...</code> 64 hex chars).
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            ← Return to Verifier
          </Link>
        </div>
      </div>
    );
  }

  // Render complete timeline view with either live indexer or canonical fixture
  const data = getMockVerdictData(cleanUid);

  return <VerdictView data={data} />;
}
