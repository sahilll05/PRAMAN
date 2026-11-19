import type { Metadata } from "next";
import Link from "next/link";
import { Server, Database, Info, Cpu, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Models | PRAMANA",
  description: "Registered AI detector models on the PRAMANA registry.",
};

export default function ModelsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-3">
          <Cpu className="h-3.5 w-3.5" /> Spec §2.3 Registered Detectors
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Detector Models</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
          Registered AI detector models on the PRAMANA Registry smart contract.
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-2xl border border-brand-200/80 bg-brand-50/70 dark:border-brand-900/60 dark:bg-brand-950/40 p-5 flex gap-3.5 backdrop-blur-sm">
        <Info className="h-5 w-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-900 dark:text-brand-200">
          <p className="font-semibold">How models work</p>
          <p className="mt-1 text-xs sm:text-sm text-brand-800 dark:text-brand-300 leading-relaxed">
            Each model is identified by a <strong className="text-brand-950 dark:text-white">modelHash</strong> (keccak256 of ONNX weights + config) and a
            <strong className="text-brand-950 dark:text-white"> preprocHash</strong> (keccak256 of the preprocessing pipeline). Canary tests measure ongoing
            AUC and ECE; if operational thresholds are breached the model transitions to{" "}
            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded px-1.5 py-0.5 font-semibold text-xs">STALE</span>.
          </p>
        </div>
      </div>

      {/* Model cards */}
      <div className="space-y-4">
        <ModelCard
          name="Model A — CLIP Linear Probe v1"
          modelHash="0x1111111111111111111111111111111111111111111111111111111111111111"
          status={0}
          aucBps={9891}
          eceBps={399}
          uri="ipfs://QmPRAMANA-ModelA-v1"
          specVersion="0.1.0-draft"
          registeredBlock={105n}
        />
        <ModelCard
          name="Model B — CLIP MLP Probe v1"
          modelHash="0x2222222222222222222222222222222222222222222222222222222222222222"
          status={0}
          aucBps={9957}
          eceBps={163}
          uri="ipfs://QmPRAMANA-ModelB-v1"
          specVersion="0.1.0-draft"
          registeredBlock={106n}
        />
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-8 text-center space-y-3">
        <Database className="h-8 w-8 mx-auto text-slate-400" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">Connect the indexer for live on-chain queries</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          Run <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-1.5 py-0.5 text-xs font-mono">pnpm --prefix indexer dev</code> with a
          Neon Postgres URL and Anvil / Base Sepolia RPC to stream live model additions and canary state updates.
        </p>
      </div>
    </div>
  );
}

function statusLabel(s: number) {
  if (s === 0) return { text: "ACTIVE", cls: "badge-active" };
  if (s === 1) return { text: "DEPRECATED", cls: "badge-expired" };
  return { text: "DEGRADED", cls: "badge-stale" };
}

function ModelCard({
  name,
  modelHash,
  status,
  aucBps,
  eceBps,
  uri,
  specVersion,
  registeredBlock,
}: {
  name: string;
  modelHash: string;
  status: number;
  aucBps: number;
  eceBps: number;
  uri: string;
  specVersion: string;
  registeredBlock: bigint;
}) {
  const st = statusLabel(status);
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm p-6 sm:p-7 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 dark:bg-brand-400/10 text-brand-600 dark:text-brand-400">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{name}</p>
            <p className="font-mono text-xs text-slate-400 dark:text-slate-400 truncate max-w-xs sm:max-w-md">{modelHash}</p>
          </div>
        </div>
        <span className={st.cls}>{st.text}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Metric label="In-domain AUC" value={(aucBps / 100).toFixed(2) + "%"} good={aucBps >= 8000} />
        <Metric label="ECE Calibration" value={(eceBps / 100).toFixed(2) + "%"} good={eceBps <= 1500} />
        <Metric label="Specification" value={specVersion} />
        <Metric label="Registry Block" value={"#" + registeredBlock.toString()} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <p className="text-slate-400 font-mono truncate max-w-sm">URI: {uri}</p>
        <span className="text-slate-400">Weights: ONNX fp32</span>
      </div>

      <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2">
        AUC and ECE metrics displayed are baseline evaluation figures. Continuous production reliability is guarded by the canary stream.
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-100 dark:border-slate-800/60">
      <p className="text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`font-bold text-sm mt-0.5 ${good === true ? "text-emerald-600 dark:text-emerald-400" : good === false ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}
