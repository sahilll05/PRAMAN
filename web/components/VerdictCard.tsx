"use client";

import Link from "next/link";
import { ExternalLink, ShieldCheck, ShieldAlert, AlertCircle } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { verdictLabel, pFakePct, formatTs, VerdictStatus } from "@/lib/status";
import type { VerdictBadge } from "@/lib/status";

interface VerdictCardProps {
  verdict: {
    uid: string;
    verdict: number;
    pFakeBps: number;
    status: VerdictStatus | string;
    badge: string;
    attester: string;
    time: bigint | string | number;
    expirationTime: bigint | string | number;
    modelHash: string;
    evidenceHash: string;
  };
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  const isAuthentic = verdict.verdict === 1;
  const isSynthetic = verdict.verdict === 2;
  const badge = verdict.badge as VerdictBadge;
  const pFakePercent = verdict.pFakeBps / 100;

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-lg backdrop-blur-xl overflow-hidden transition-all duration-200">
      {/* Header accent strip */}
      <div
        className={
          isSynthetic
            ? "h-2 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500"
            : isAuthentic
            ? "h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-sky-500"
            : "h-2 bg-gradient-to-r from-slate-400 to-slate-600"
        }
      />

      <div className="p-6 sm:p-7 space-y-6">
        {/* Top row: Verdict Header & Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isSynthetic ? (
                <ShieldAlert className="h-6 w-6 text-rose-500" />
              ) : isAuthentic ? (
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-slate-400" />
              )}
              <h3
                className={
                  isSynthetic
                    ? "text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight"
                    : isAuthentic
                    ? "text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight"
                    : "text-2xl font-extrabold text-slate-500 dark:text-slate-400 tracking-tight"
                }
              >
                {verdictLabel(verdict.verdict)}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Calibrated Statistical Likelihood:{" "}
              <strong className="text-slate-900 dark:text-white font-bold">{pFakePct(verdict.pFakeBps)}</strong>{" "}
              synthetic confidence
            </p>
          </div>

          <StatusBadge badge={badge} />
        </div>

        {/* Probability Meter Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Authentic (0%)</span>
            <span>Threshold (50%)</span>
            <span>Synthetic (100%)</span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSynthetic
                  ? "bg-gradient-to-r from-amber-500 to-rose-500"
                  : "bg-gradient-to-r from-emerald-400 to-teal-500"
              }`}
              style={{ width: `${Math.min(Math.max(pFakePercent, 4), 100)}%` }}
            />
          </div>
        </div>

        {/* Key Metadata Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaCard label="Attested" value={formatTs(verdict.time)} />
          <MetaCard label="Expires" value={formatTs(verdict.expirationTime)} />
          <MetaCard label="Attester Node" value={truncateAddr(verdict.attester)} mono />
          <MetaCard label="Model Hash" value={truncateHash(verdict.modelHash)} mono />
        </div>

        {/* Action Link Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <Link
            href={`/verdicts/${verdict.uid}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
          >
            <span>View Full EAS Attestation & Timeline</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          {verdict.evidenceHash && verdict.evidenceHash !== "0x" + "00".repeat(32) && (
            <span className="text-[11px] font-mono text-slate-400">
              Evidence: {truncateHash(verdict.evidenceHash)}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-normal">
          Model-assessed likelihood only — not a ruling. Live on Base Sepolia testnet.
        </p>
      </div>
    </div>
  );
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/60 p-3 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">{label}</p>
      <p className={`text-xs font-semibold ${mono ? "font-mono text-slate-800 dark:text-slate-200" : "text-slate-900 dark:text-slate-100"} truncate`}>
        {value}
      </p>
    </div>
  );
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function truncateHash(h: string): string {
  if (!h || h.length < 10) return h;
  return h.slice(0, 8) + "…" + h.slice(-6);
}
