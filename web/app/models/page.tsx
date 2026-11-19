import type { Metadata } from "next";
import Link from "next/link";
import { Server, Database, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Models | PRAMANA",
  description: "Registered AI detector models on the PRAMANA registry.",
};

export default function ModelsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Detector Models</h1>
        <p className="text-slate-500 mt-2">
          Registered AI detector models on the PRAMANA Registry contract.
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 flex gap-3">
        <Info className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-800">
          <p className="font-semibold">How models work</p>
          <p className="mt-1">
            Each model is identified by a <strong>modelHash</strong> (keccak256 of ONNX weights + config) and a
            <strong> preprocHash</strong> (keccak256 of the preprocessing pipeline). Canary tests measure ongoing
            AUC and ECE; if thresholds are breached the model transitions to{" "}
            <span className="bg-amber-100 text-amber-700 rounded px-1 font-semibold">STALE</span>.
          </p>
        </div>
      </div>

      {/* Model cards */}
      <div className="space-y-4">
        <ModelCard
          name="Model A — CLIP Linear Probe v1"
          modelHash="0x000…(connect indexer to see)"
          status={0}
          aucBps={9891}
          eceBps={399}
          uri="ipfs://QmPRAMANA-ModelA-v1"
          specVersion="0.1.0-draft"
          registeredBlock={105n}
        />
        <ModelCard
          name="Model B — CLIP MLP Probe v1"
          modelHash="0x000…(connect indexer to see)"
          status={0}
          aucBps={9957}
          eceBps={163}
          uri="ipfs://QmPRAMANA-ModelB-v1"
          specVersion="0.1.0-draft"
          registeredBlock={106n}
        />
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center space-y-3">
        <Database className="h-8 w-8 mx-auto text-slate-400" />
        <p className="font-semibold text-slate-600">Connect the indexer for live data</p>
        <p className="text-sm text-slate-400">
          Run <code className="bg-slate-100 rounded px-1.5 py-0.5 text-xs">pnpm --prefix indexer dev</code> with a
          Neon Postgres URL and Anvil / Base Sepolia RPC to populate live model registry data.
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
  name, modelHash, status, aucBps, eceBps, uri, specVersion, registeredBlock,
}: {
  name: string; modelHash: string; status: number; aucBps: number; eceBps: number;
  uri: string; specVersion: string; registeredBlock: bigint;
}) {
  const st = statusLabel(status);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
            <Server className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{name}</p>
            <p className="font-mono text-xs text-slate-400">{modelHash}</p>
          </div>
        </div>
        <span className={st.cls}>{st.text}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Metric label="In-domain AUC" value={(aucBps / 100).toFixed(2) + "%"} good={aucBps >= 8000} />
        <Metric label="ECE" value={(eceBps / 100).toFixed(2) + "%"} good={eceBps <= 1500} />
        <Metric label="Spec" value={specVersion} />
        <Metric label="Block" value={"#" + registeredBlock.toString()} />
      </div>
      <p className="text-xs text-slate-400 font-mono truncate">URI: {uri}</p>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
        AUC and ECE values are from internal training evaluation. Canary results (live production metrics) require the indexer pipeline.
      </p>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`font-semibold ${good === true ? "text-green-700" : good === false ? "text-red-600" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}
