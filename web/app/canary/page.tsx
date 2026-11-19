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
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 mb-3">
          <Activity className="h-3.5 w-3.5" /> Spec §2.3 & §6 Monitoring
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Canary Evaluations & Model Health</h1>
        <p className="text-slate-500 mt-2 max-w-3xl leading-relaxed">
          PRAMANA uses ongoing canary batches (freshly synthesized, held-out images with commit-reveal labels)
          to measure whether detector performance has degraded against evolving generation techniques.
        </p>
      </div>

      {/* Degradation Rule Callout */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-amber-900 font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Authoritative Degradation Trigger (Spec §6)
        </div>
        <p className="text-sm text-amber-800 leading-relaxed">
          If the latest attested CanaryResult for a model violates either operational threshold:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-xl border border-amber-300 bg-white/70 p-3 space-y-1">
            <span className="font-semibold text-amber-900">Minimum AUC Threshold:</span>
            <p className="text-slate-700 font-mono text-sm">AUC &lt; 80.00% (8000 bps)</p>
            <p className="text-slate-500 text-[11px]">Discriminative power fell below safety tolerance.</p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-white/70 p-3 space-y-1">
            <span className="font-semibold text-amber-900">Maximum ECE Threshold:</span>
            <p className="text-slate-700 font-mono text-sm">ECE &gt; 15.00% (1500 bps)</p>
            <p className="text-slate-500 text-[11px]">Calibration error exceeds acceptable uncertainty bound.</p>
          </div>
        </div>
        <p className="text-xs text-amber-900 font-medium pt-1">
          Outcome: The indexer state machine automatically marks all active verdicts using that model as{" "}
          <span className="inline-block rounded bg-amber-200 px-1.5 py-0.5 text-amber-900 font-bold">
            MODEL_DEGRADED
          </span>{" "}
          and surfaces the prominent <span className="font-bold">STALE</span> badge in the verifier UI.
        </p>
      </div>

      {/* Benchmark Rounds */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-slate-900">Latest Attested Canary Batches</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Role: canaryIssuer</span>
        </div>

        <div className="divide-y divide-slate-100">
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Info className="h-4 w-4 text-brand-600" />
          Trust Assumptions & Commit-Reveal Architecture
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          In v1, canary evaluations are issued by the designated <code>canaryIssuer</code> address on
          the Registry contract. To prevent overfitting or front-running by attester nodes, test labels are
          committed via <code>labelsCommitHash</code> prior to public disclosure.
        </p>
        <p className="text-xs text-slate-500">
          This maintainer-issued setup is an honest centralization caveat documented in spec §3 and
          the <Link href="/limitations" className="text-brand-600 underline">limitations disclosure</Link>.
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
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-900">{modelName}</span>
          <p className="font-mono text-xs text-slate-400 truncate max-w-sm">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide">Canary AUC</p>
          <p className={`text-sm font-bold ${aucBps >= 8000 ? "text-emerald-700" : "text-red-600"}`}>
            {(aucBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-slate-400">Target: ≥ 80.00%</span>
        </div>
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide">Canary ECE</p>
          <p className={`text-sm font-bold ${eceBps <= 1500 ? "text-emerald-700" : "text-red-600"}`}>
            {(eceBps / 100).toFixed(2)}%
          </p>
          <span className="text-[10px] text-slate-400">Target: ≤ 15.00%</span>
        </div>
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide">Sample Size (n)</p>
          <p className="text-sm font-bold text-slate-800">{n} samples</p>
          <span className="text-[10px] text-slate-400">100% coverage</span>
        </div>
        <div>
          <p className="text-slate-400 font-medium uppercase tracking-wide">Attested Block</p>
          <p className="text-sm font-bold text-slate-800">#{blockNumber.toString()}</p>
          <span className="text-[10px] text-slate-400">{time}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-50">
        <span className="flex items-center gap-1 font-mono">
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
