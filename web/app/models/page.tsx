import type { Metadata } from "next";
import Link from "next/link";
import { Server, Database, Info, Cpu } from "lucide-react";

export const metadata: Metadata = {
  title: "Models | PRAMANA",
  description: "Registered AI detector models on the PRAMANA registry.",
};

export default function ModelsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-3 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-3">
          <Cpu className="h-3.5 w-3.5" /> Spec §2.3 Registered Detectors
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Detector Models</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm leading-relaxed">
          Registered AI detector models on the PRAMANA Registry smart contract.
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 p-5 flex gap-3.5">
        <Info className="h-5 w-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-zinc-800 dark:text-zinc-200">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">How models work</p>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Each model is identified by a <strong className="text-zinc-900 dark:text-zinc-100">modelHash</strong> (keccak256 of ONNX weights + config) and a
            <strong className="text-zinc-900 dark:text-zinc-100"> preprocHash</strong> (keccak256 of the preprocessing pipeline). Canary tests measure ongoing
            AUC and ECE; if operational thresholds are breached the model transitions to{" "}
            <span className="bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 rounded px-1.5 py-0.5 font-mono text-xs">STALE</span>.
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

      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-8 text-center space-y-3">
        <Database className="h-7 w-7 mx-auto text-zinc-400" />
        <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">Connect the indexer for live on-chain queries</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
          Run <code className="bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono">pnpm --prefix indexer dev</code> with a
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
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 dark:text-zinc-100">{name}</p>
            <p className="font-mono text-xs text-zinc-400 truncate max-w-xs sm:max-w-md">{modelHash}</p>
          </div>
        </div>
        <span className={st.cls}>{st.text}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
        <Metric label="In-domain AUC" value={(aucBps / 100).toFixed(2) + "%"} good={aucBps >= 8000} />
        <Metric label="ECE Calibration" value={(eceBps / 100).toFixed(2) + "%"} good={eceBps <= 1500} />
        <Metric label="Specification" value={specVersion} />
        <Metric label="Registry Block" value={"#" + registeredBlock.toString()} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-mono">
        <p className="text-zinc-400 truncate max-w-sm">URI: {uri}</p>
        <span className="text-zinc-500">Weights: ONNX fp32</span>
      </div>

      <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
        AUC and ECE metrics displayed are baseline evaluation figures. Continuous production reliability is guarded by the canary stream.
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200/60 dark:border-zinc-800">
      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`font-semibold text-xs mt-0.5 ${good === true ? "text-emerald-700 dark:text-emerald-400" : good === false ? "text-rose-700 dark:text-rose-400" : "text-zinc-800 dark:text-zinc-200"}`}>
        {value}
      </p>
    </div>
  );
}
