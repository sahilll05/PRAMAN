import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ShieldCheck, AlertTriangle, Info, GitCommit } from "lucide-react";

export const metadata: Metadata = {
  title: "Canary Health | PRAMAN",
  description: "Canary evaluation batches and continuous model health tracking.",
};

export default function CanaryPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-3 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-3">
          <Activity className="h-3.5 w-3.5" /> Spec §2.3 & §6 Health Monitoring
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Canary Evaluations & Model Health
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-3xl text-sm leading-relaxed">
          PRAMAN uses ongoing canary batches (freshly synthesized, held-out images with commit-reveal labels)
          to measure whether detector performance has degraded against evolving generation techniques.
        </p>
      </div>

      {/* Degradation Rule Callout */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/40 dark:bg-zinc-900/30 p-6 space-y-3">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Authoritative Degradation Trigger (Spec §6)
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          If the latest attested CanaryResult for a model violates either operational threshold:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-1">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Minimum AUC Threshold:</span>
            <p className="text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold">AUC &lt; 80.00% (8000 bps)</p>
            <p className="text-zinc-500 text-[11px]">Discriminative power fell below safety tolerance.</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-1">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Maximum ECE Threshold:</span>
            <p className="text-zinc-800 dark:text-zinc-200 font-mono text-xs font-semibold">ECE &gt; 15.00% (1500 bps)</p>
            <p className="text-zinc-500 text-[11px]">Calibration error exceeds acceptable uncertainty bound.</p>
          </div>
        </div>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 pt-1">
          Outcome: The indexer state machine automatically marks all active verdicts using that model as{" "}
          <span className="inline-block rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-amber-800 dark:text-amber-300 font-mono text-xs font-medium">
            MODEL_DEGRADED
          </span>{" "}
          and surfaces the <span className="font-semibold">STALE</span> badge in the verifier UI.
        </p>
      </div>

      {/* Benchmark Rounds */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
        <div className="px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Latest Attested Canary Batches</span>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Role: canaryIssuer</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-5 space-y-2">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Info className="h-4 w-4 text-zinc-500" />
          Trust Assumptions & Commit-Reveal Architecture
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          In v1, canary evaluations are issued by the designated <code className="font-mono text-xs bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">canaryIssuer</code> address on
          the Registry contract. To prevent overfitting or front-running by attester nodes, test labels are
          committed via <code className="font-mono text-xs bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">labelsCommitHash</code> prior to public disclosure.
        </p>
        <p className="text-xs text-zinc-500">
          This maintainer-issued setup is an honest centralization caveat documented in spec §3 and
          the <Link href="/limitations" className="text-zinc-800 dark:text-zinc-200 underline font-medium">limitations disclosure</Link>.
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
    <div className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{modelName}</span>
          <p className="font-mono text-xs text-zinc-400 truncate max-w-sm mt-0.5">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-zinc-400 font-mono uppercase text-[10px]">Canary AUC</p>
          <p className={`text-xs font-semibold mt-0.5 ${aucBps >= 8000 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {(aucBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-zinc-400">Target: ≥ 80.00%</span>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-zinc-400 font-mono uppercase text-[10px]">Canary ECE</p>
          <p className={`text-xs font-semibold mt-0.5 ${eceBps <= 1500 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {(eceBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-zinc-400">Target: ≤ 15.00%</span>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-zinc-400 font-mono uppercase text-[10px]">Sample Size</p>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{n} samples</p>
          <span className="text-[10px] text-zinc-400">100% coverage</span>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-zinc-400 font-mono uppercase text-[10px]">Block</p>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">#{blockNumber.toString()}</p>
          <span className="text-[10px] text-zinc-400">{time}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <span className="flex items-center gap-1.5 font-mono">
          <GitCommit className="h-3.5 w-3.5 text-zinc-400" />
          Labels Commit: {labelsCommit.slice(0, 10)}…{labelsCommit.slice(-6)}
        </span>
        <span className="font-mono">
          Batch ID: {batchId.slice(0, 10)}…{batchId.slice(-6)}
        </span>
      </div>
    </div>
  );
}
