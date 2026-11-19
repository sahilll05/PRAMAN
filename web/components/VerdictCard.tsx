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

      <div className="p-5 sm:p-6 space-y-5">
        {/* Top row: Verdict Header & Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isSynthetic ? (
                <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              ) : isAuthentic ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-zinc-400" />
              )}
              <h3
                className={
                  isSynthetic
                    ? "text-xl font-bold text-rose-700 dark:text-rose-400 tracking-tight"
                    : isAuthentic
                    ? "text-xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight"
                    : "text-xl font-bold text-zinc-600 dark:text-zinc-400 tracking-tight"
                }
              >
                {verdictLabel(verdict.verdict)}
              </h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Calibrated statistical likelihood:{" "}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-semibold">{pFakePct(verdict.pFakeBps)}</strong>{" "}
              synthetic confidence
            </p>
          </div>

          <StatusBadge badge={badge} />
        </div>

        {/* Minimal Probability Meter Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500">
            <span>Authentic (0%)</span>
            <span>Decision Boundary (50%)</span>
            <span>Synthetic (100%)</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isSynthetic
                  ? "bg-rose-600 dark:bg-rose-500"
                  : "bg-emerald-600 dark:bg-emerald-500"
              }`}
              style={{ width: `${Math.min(Math.max(pFakePercent, 3), 100)}%` }}
            />
          </div>
        </div>

        {/* Key Metadata Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetaCard label="Attested" value={formatTs(verdict.time)} />
          <MetaCard label="Expires" value={formatTs(verdict.expirationTime)} />
          <MetaCard label="Attester Node" value={truncateAddr(verdict.attester)} mono />
          <MetaCard label="Model Hash" value={truncateHash(verdict.modelHash)} mono />
        </div>

        {/* Action Link Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Link
            href={`/verdicts/${verdict.uid}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
          >
            <span>View full EAS attestation & timeline</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          {verdict.evidenceHash && verdict.evidenceHash !== "0x" + "00".repeat(32) && (
            <span className="text-[10px] font-mono text-zinc-400">
              Evidence: {truncateHash(verdict.evidenceHash)}
            </span>
          )}
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-normal">
          Model-assessed likelihood only — not a ruling. Anchored onto Base Sepolia testnet.
        </p>
      </div>
    </div>
  );
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/70 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
      <p className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className={`text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-0.5 truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function truncateHash(hash: string) {
  if (!hash || hash.length < 16) return hash || "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
