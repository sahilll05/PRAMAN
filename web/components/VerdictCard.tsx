"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header band */}
      <div
        className={
          isSynthetic
            ? "h-1.5 bg-gradient-to-r from-red-400 to-rose-500"
            : isAuthentic
            ? "h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"
            : "h-1.5 bg-gradient-to-r from-slate-300 to-gray-400"
        }
      />
      <div className="p-6 space-y-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={
                isSynthetic
                  ? "verdict-synthetic text-xl"
                  : isAuthentic
                  ? "verdict-authentic text-xl"
                  : "verdict-abstain text-xl"
              }
            >
              {verdictLabel(verdict.verdict)}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              P(synthetic) = <strong>{pFakePct(verdict.pFakeBps)}</strong>{" "}
              <span className="text-xs">(calibrated)</span>
            </p>
          </div>
          <StatusBadge badge={badge} />
        </div>

        {/* Key metadata */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetaRow label="Attested" value={formatTs(verdict.time)} />
          <MetaRow label="Expires" value={formatTs(verdict.expirationTime)} />
          <MetaRow label="Attester" value={truncateAddr(verdict.attester)} mono />
          <MetaRow label="Model" value={truncateHash(verdict.modelHash)} mono />
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 pt-1 text-sm">
          <Link
            href={`/verdicts/${verdict.uid}`}
            className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium"
          >
            Full timeline <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {verdict.evidenceHash && verdict.evidenceHash !== "0x" + "00".repeat(32) && (
            <span className="text-slate-400 font-mono text-xs">
              Evidence: {truncateHash(verdict.evidenceHash)}
            </span>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
          Model-assessed likelihood only — not a ruling. Verdicts can be challenged, superseded, or expire.
        </p>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={mono ? "font-mono text-slate-700 text-xs" : "text-slate-700"}>{value}</p>
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
