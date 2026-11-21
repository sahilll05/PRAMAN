"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  Shield,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Info,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Hash,
  Activity,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { ChallengeModal } from "@/components/ChallengeModal";
import {
  verdictLabel,
  pFakePct,
  formatTs,
  VerdictStatus,
  type VerdictBadge,
} from "@/lib/status";

export interface TimelineEvent {
  type: "registered" | "attested" | "canary" | "challenge" | "superseded" | "revoked";
  title: string;
  timestamp: bigint;
  description: string;
  badge?: string;
  txHash?: string;
}

export interface VerdictViewData {
  uid: string;
  schemaUid: string;
  refUid: string;
  attester: string;
  recipient: string;
  time: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  sha256Hash: string;
  pHashHex: string;
  wmId: bigint;
  modelHash: string;
  preprocHash: string;
  pFakeBps: number;
  verdict: number;
  evidenceHash: string;
  blockNumber: bigint;
  status: VerdictStatus;
  badge: VerdictBadge;
  timeline: TimelineEvent[];
}

export function VerdictView({ data }: { data: VerdictViewData }) {
  const [isChallengeModalOpen, setChallengeModalOpen] = useState(false);

  const isSynthetic = data.verdict === 2;
  const isAuthentic = data.verdict === 1;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          ← Back to verifier
        </Link>
      </div>

      {/* Main Header / Assessment Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden transition-colors">
        {/* Accent hairline */}
        <div
          className={
            isSynthetic
              ? "h-1 bg-rose-600 dark:bg-rose-500"
              : isAuthentic
              ? "h-1 bg-emerald-600 dark:bg-emerald-500"
              : "h-1 bg-zinc-400 dark:bg-zinc-600"
          }
        />

        <div className="p-6 sm:p-7 space-y-6">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Current Assessment
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-xs text-zinc-500 font-mono">
                  Block #{data.blockNumber.toString()}
                </span>
              </div>
              <h1
                className={
                  isSynthetic
                    ? "text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-400 tracking-tight"
                    : isAuthentic
                    ? "text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight"
                    : "text-2xl sm:text-3xl font-extrabold text-zinc-600 dark:text-zinc-400 tracking-tight"
                }
              >
                {verdictLabel(data.verdict)}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Model-assessed probability of synthetic origin:{" "}
                <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-semibold">{pFakePct(data.pFakeBps)}</strong>{" "}
                <span className="text-xs text-zinc-400">(temperature calibrated)</span>
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2.5">
              <StatusBadge badge={data.badge} className="text-xs px-2.5 py-0.5" />
              <button
                onClick={() => setChallengeModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Challenge / Appeal
              </button>
            </div>
          </div>

          {/* Key Attestation Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-zinc-400 font-mono uppercase text-[10px]">Attestation Time</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5" suppressHydrationWarning>{formatTs(data.time)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-zinc-400 font-mono uppercase text-[10px]">Expiration</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5" suppressHydrationWarning>{formatTs(data.expirationTime)}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-zinc-400 font-mono uppercase text-[10px]">Attester</p>
              <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" title={data.attester}>
                {data.attester}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
              <p className="text-zinc-400 font-mono uppercase text-[10px]">Model Version</p>
              <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" title={data.modelHash}>
                {data.modelHash.slice(0, 10)}…{data.modelHash.slice(-6)}
              </p>
            </div>
          </div>

          {/* Perceptual & Cryptographic Fingerprints */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3.5 space-y-1.5 border border-zinc-200/60 dark:border-zinc-800 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-[10px] uppercase text-zinc-400">
                SHA-256 (File Content)
              </span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all">{data.sha256Hash}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-[10px] uppercase text-zinc-400">
                pHash (Perceptual Identity)
              </span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all">{data.pHashHex}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lifecycle Timeline (T6.2) */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 sm:p-7 space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            Verdict Lifecycle Timeline
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Transparent on-chain history: attestations, canaries, challenges, and supersessions.
          </p>
        </div>

        <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3.5 pl-5 space-y-6">
          {data.timeline.map((evt, idx) => (
            <div key={idx} className="relative">
              {/* Timeline marker */}
              <div className="absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    evt.type === "attested" && "bg-zinc-900 dark:bg-zinc-100",
                    evt.type === "registered" && "bg-zinc-400 dark:bg-zinc-600",
                    evt.type === "canary" && "bg-emerald-600 dark:bg-emerald-400",
                    evt.type === "challenge" && "bg-orange-600 dark:bg-orange-400",
                    evt.type === "superseded" && "bg-zinc-500",
                    evt.type === "revoked" && "bg-rose-600 dark:bg-rose-400"
                  )}
                />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{evt.title}</span>
                  {evt.badge && (
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-300">
                      {evt.badge}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-400 font-mono" suppressHydrationWarning>
                    {formatTs(evt.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{evt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence & Protocol Verification Metadata */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 sm:p-7 space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wide text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Layers className="h-4 w-4 text-zinc-500" />
          On-Chain EAS Protocol Verification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase">Attestation UID</span>
            <p className="text-zinc-800 dark:text-zinc-200 break-all text-xs">{data.uid}</p>
          </div>
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase">EAS Schema UID</span>
            <p className="text-zinc-800 dark:text-zinc-200 break-all text-xs">{data.schemaUid}</p>
          </div>
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase">Evidence Bundle Hash</span>
            <p className="text-zinc-800 dark:text-zinc-200 break-all text-xs">{data.evidenceHash}</p>
          </div>
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase">Preprocessing Hash</span>
            <p className="text-zinc-800 dark:text-zinc-200 break-all text-xs">{data.preprocHash}</p>
          </div>
        </div>

        <div className="pt-2 text-xs text-zinc-500">
          Explorer link:{" "}
          <a
            href={`https://base-sepolia.easscan.org/attestation/view/${encodeURIComponent(data.uid)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-900 dark:text-zinc-100 hover:underline font-medium inline-flex items-center gap-1"
          >
            View on EAS Scan ↗
          </a>
        </div>
      </div>

      {/* Appeal / Challenge Modal */}
      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setChallengeModalOpen(false)}
        targetUid={data.uid}
        targetModelHash={data.modelHash}
      />
    </div>
  );
}
