import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ShieldCheck, AlertTriangle, Database, Info, GitCommit } from "lucide-react";

export const metadata: Metadata = {
  title: "Canary Health | PRAMANA",
  description: "Canary evaluation batches and continuous model health tracking.",
};

export default function CanaryPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-3">
          <Activity className="h-3.5 w-3.5" /> Spec §2.3 & §6 Health Monitoring
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Canary Evaluations & Model Health
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
          PRAMANA uses ongoing canary batches (freshly synthesized, held-out images with commit-reveal labels)
          to measure whether detector performance has degraded against evolving generation techniques.
        </p>
      </div>

      {/* Degradation Rule Callout */}
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-950/30 p-6 sm:p-7 space-y-4 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-300 font-bold text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Authoritative Degradation Trigger (Spec §6)
        </div>
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
          If the latest attested CanaryResult for a model violates either operational threshold:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-2xl border border-amber-500/20 bg-white/70 dark:bg-slate-900/70 p-4 space-y-1.5 shadow-sm">
            <span className="font-bold text-amber-900 dark:text-amber-300">Minimum AUC Threshold:</span>
            <p className="text-slate-800 dark:text-slate-200 font-mono text-sm font-semibold">AUC &lt; 80.00% (8000 bps)</p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Discriminative power fell below safety tolerance.</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-white/70 dark:bg-slate-900/70 p-4 space-y-1.5 shadow-sm">
            <span className="font-bold text-amber-900 dark:text-amber-300">Maximum ECE Threshold:</span>
            <p className="text-slate-800 dark:text-slate-200 font-mono text-sm font-semibold">ECE &gt; 15.00% (1500 bps)</p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Calibration error exceeds acceptable uncertainty bound.</p>
          </div>
        </div>
        <p className="text-xs text-amber-900 dark:text-amber-300 font-medium pt-1">
          Outcome: The indexer state machine automatically marks all active verdicts using that model as{" "}
          <span className="inline-block rounded-lg bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-amber-900 dark:text-amber-300 font-bold">
            MODEL_DEGRADED
          </span>{" "}
          and surfaces the prominent <span className="font-bold">STALE</span> badge in the verifier UI.
        </p>
      </div>

      {/* Benchmark Rounds */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <span className="font-bold text-slate-900 dark:text-white">Latest Attested Canary Batches</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Role: canaryIssuer</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          <CanaryRow
            batchId="0x9999999999999999999999999999999999999999999999999999999999999999"
            modelName="Model A — CLIP Linear Probe v1"
            modelHash="0x1111111111111111111111111111111111111111111111111111111111111111"
            aucBps={9450}
            eceBps={450}
            coverageBps={10000}
            n={1000}
            labelsCommit="0x8888888888888888888888888888888888888888888888888888888888888888"
            blockNumber={140n}
            time="2026-11-20 00:30 UTC"
          />
          <CanaryRow
            batchId="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            modelName="Model B — CLIP MLP Probe v1"
            modelHash="0x2222222222222222222222222222222222222222222222222222222222222222"
            aucBps={9520}
            eceBps={380}
            coverageBps={10000}
            n={1000}
            labelsCommit="0x7777777777777777777777777777777777777777777777777777777777777777"
            blockNumber={142n}
            time="2026-11-20 00:35 UTC"
          />
        </div>
      </div>

      {/* Trust & Transparency Disclosure */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 sm:p-7 space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Info className="h-4 w-4 text-brand-500" />
          Trust Assumptions & Commit-Reveal Architecture
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          In v1, canary evaluations are issued by the designated <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">canaryIssuer</code> address on
          the Registry contract. To prevent overfitting or front-running by attester nodes, test labels are
          committed via <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">labelsCommitHash</code> prior to public disclosure.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This maintainer-issued setup is an honest centralization caveat documented in spec §3 and
          the <Link href="/limitations" className="text-brand-600 dark:text-brand-400 underline font-medium">limitations disclosure</Link>.
        </p>
      </div>
    </div>
  );
}

function CanaryRow({
  batchId,
  modelName,
  modelHash,
  aucBps,
  eceBps,
  coverageBps,
  n,
  labelsCommit,
  blockNumber,
  time,
}: {
  batchId: string;
  modelName: string;
  modelHash: string;
  aucBps: number;
  eceBps: number;
  coverageBps: number;
  n: number;
  labelsCommit: string;
  blockNumber: bigint;
  time: string;
}) {
  const isHealthy = aucBps >= 8000 && eceBps <= 1500;

  return (
    <div className="p-6 sm:p-7 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-900 dark:text-white">{modelName}</span>
          <p className="font-mono text-xs text-slate-400 dark:text-slate-400 truncate max-w-sm mt-0.5">
            Model: {modelHash.slice(0, 10)}…{modelHash.slice(-8)}
          </p>
        </div>
        <span
          className={
            isHealthy
              ? "badge-active self-start sm:self-auto"
              : "badge-stale self-start sm:self-auto"
          }
        >
          {isHealthy ? "✓ HEALTHY" : "⚠ DEGRADED"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Canary AUC</p>
          <p className={`text-sm font-bold mt-0.5 ${aucBps >= 8000 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {(aucBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-slate-400">Target: ≥ 80.00%</span>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Canary ECE</p>
          <p className={`text-sm font-bold mt-0.5 ${eceBps <= 1500 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {(eceBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-slate-400">Target: ≤ 15.00%</span>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Sample Size (n)</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{n} samples</p>
          <span className="text-[10px] text-slate-400">100% coverage</span>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
          <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Attested Block</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">#{blockNumber.toString()}</p>
          <span className="text-[10px] text-slate-400">{time}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <span className="flex items-center gap-1.5 font-mono">
          <GitCommit className="h-3.5 w-3.5 text-slate-400" />
          Labels Commit: {labelsCommit.slice(0, 10)}…{labelsCommit.slice(-6)}
        </span>
        <span className="font-mono">
          Batch ID: {batchId.slice(0, 10)}…{batchId.slice(-6)}
        </span>
      </div>
    </div>
  );
}
