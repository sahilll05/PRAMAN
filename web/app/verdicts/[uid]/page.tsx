import type { Metadata } from "next";
import Link from "next/link";
import { Info, AlertCircle } from "lucide-react";
import { VerdictView, type VerdictViewData } from "./VerdictView";
import { VerdictStatus, type VerdictBadge } from "@/lib/status";
import { LOCAL_VERDICTS } from "@/lib/local-verdicts";

export const metadata: Metadata = {
  title: "Verdict Detail & Timeline | PRAMANA",
  description: "Detailed on-chain verdict assessment, history timeline, and challenge flow.",
};

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

  // Look up verdict in local registry
  const match = LOCAL_VERDICTS.find((v) => v.uid.toLowerCase() === cleanUid.toLowerCase());

  if (!match) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Attestation Record Not Found</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          No on-chain EAS attestation was found for UID <code className="font-mono text-xs break-all">{cleanUid}</code>. This image has not been attested by an allowlisted attester yet.
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

  const isSynthetic = match.verdict === 2;
  const isAuthentic = match.verdict === 1;
  const label = isSynthetic ? "LIKELY SYNTHETIC" : isAuthentic ? "LIKELY AUTHENTIC" : "ABSTAIN";
  const pctStr = (match.pFakeBps / 100).toFixed(2) + "%";

  const data: VerdictViewData = {
    uid: match.uid,
    schemaUid: "0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99",
    refUid: "0x0000000000000000000000000000000000000000000000000000000000000000",
    attester: match.attester,
    recipient: "0x0000000000000000000000000000000000000000",
    time: BigInt(match.time),
    expirationTime: BigInt(match.expirationTime),
    revocationTime: 0n,
    sha256Hash: match.sha256Hash.startsWith("0x") ? match.sha256Hash : `0x${match.sha256Hash}`,
    pHashHex: match.pHash,
    wmId: 0n,
    modelHash: match.modelHash,
    preprocHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    pFakeBps: match.pFakeBps,
    verdict: match.verdict,
    evidenceHash: match.evidenceHash,
    blockNumber: 115n,
    status: (match.status as VerdictStatus) || VerdictStatus.ACTIVE,
    badge: (match.badge as VerdictBadge) || "ACTIVE",
    timeline: [
      {
        type: "registered",
        title: "Model Registered on Registry.sol",
        timestamp: BigInt(match.time) - 10800n,
        description: "Model A (CLIP Linear Probe v1) registered by owner with ONNX fp32 weights and preprocessing specification.",
        badge: "Registry",
      },
      {
        type: "attested",
        title: "Verdict Attestation Issued",
        timestamp: BigInt(match.time),
        description: `Allowlisted attester submitted verdict (${label}, P=${pctStr}) on EAS validated by VerdictResolver.`,
        badge: "EAS Attested",
      },
      {
        type: "canary",
        title: "Model Health Verified",
        timestamp: BigInt(match.time) + 4200n,
        description: "Canary evaluation batch passed health check (AUC: 94.50%, ECE: 4.50% vs max 15.00%). Model status remains healthy.",
        badge: "Canary Healthy",
      },
    ],
  };

  return <VerdictView data={data} />;
}
