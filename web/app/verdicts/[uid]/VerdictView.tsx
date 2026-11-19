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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          ← Back to verifier
        </Link>
      </div>

      {/* Main Header / Assessment Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        {/* Color band */}
        <div
          className={
            isSynthetic
              ? "h-2 bg-gradient-to-r from-rose-500 via-red-500 to-rose-600"
              : isAuthentic
              ? "h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600"
              : "h-2 bg-gradient-to-r from-slate-400 via-slate-500 to-gray-600"
          }
        />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Current Assessment
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Block #{data.blockNumber.toString()}
                </span>
              </div>
              <h1
                className={
                  isSynthetic
                    ? "text-3xl sm:text-4xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight"
                    : isAuthentic
                    ? "text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight"
                    : "text-3xl sm:text-4xl font-extrabold text-slate-600 dark:text-slate-400 tracking-tight"
                }
              >
                {verdictLabel(data.verdict)}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                Model-assessed probability of synthetic origin:{" "}
                <strong className="text-slate-900 dark:text-white font-mono text-base">{pFakePct(data.pFakeBps)}</strong>{" "}
                <span className="text-xs text-slate-400">(temperature calibrated)</span>
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2.5">
              <StatusBadge badge={data.badge} className="text-sm px-3.5 py-1" />
              <button
                onClick={() => setChallengeModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 dark:border-orange-500/20 px-3.5 py-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors shadow-sm"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Challenge / Appeal
              </button>
            </div>
          </div>

          {/* Key Attestation Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Attestation Time</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{formatTs(data.time)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Expiration</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{formatTs(data.expirationTime)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Attester</p>
              <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={data.attester}>
                {data.attester}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Model Version</p>
              <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={data.modelHash}>
                {data.modelHash.slice(0, 10)}…{data.modelHash.slice(-6)}
              </p>
            </div>
          </div>

          {/* Perceptual & Cryptographic Fingerprints */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2 border border-slate-100 dark:border-slate-800/60 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[11px]">
                SHA-256 (File Content)
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.sha256Hash}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[11px]">
                pHash (Perceptual Identity)
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.pHashHex}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lifecycle Timeline (T6.2) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-500" />
            Verdict Lifecycle Timeline
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transparent on-chain history: attestations, canaries, challenges, and supersessions.
          </p>
        </div>

        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-8">
          {data.timeline.map((evt, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline marker */}
              <div className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-900 ring-4 ring-slate-100 dark:ring-slate-800">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    evt.type === "attested" && "bg-brand-500",
                    evt.type === "registered" && "bg-slate-400",
                    evt.type === "canary" && "bg-emerald-500",
                    evt.type === "challenge" && "bg-orange-500",
                    evt.type === "superseded" && "bg-purple-500",
                    evt.type === "revoked" && "bg-rose-500"
                  )}
                />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{evt.title}</span>
                  {evt.badge && (
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {evt.badge}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatTs(evt.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{evt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence & Protocol Verification Metadata */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-500" />
          On-Chain EAS Protocol Verification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-slate-400 font-medium">Attestation UID</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.uid}</p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-slate-400 font-medium">EAS Schema UID</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.schemaUid}</p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-slate-400 font-medium">Evidence Bundle Hash</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.evidenceHash}</p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-slate-400 font-medium">Preprocessing Hash</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all">{data.preprocHash}</p>
          </div>
        </div>

        <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
          Explorer link:{" "}
          <a
            href={`https://base-sepolia.easscan.org/attestation/view/${data.uid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 dark:text-brand-400 hover:underline font-semibold inline-flex items-center gap-1"
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
