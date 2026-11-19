import type { Metadata } from "next";
import { Users, Info, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Attesters | PRAMANA",
  description: "Registered attester nodes on the PRAMANA protocol.",
};

export default function AttestersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Registered Attesters</h1>
        <p className="text-slate-500 mt-2">
          Allowlisted attester nodes authorized to submit verdicts on the PRAMANA Registry.
        </p>
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 flex gap-3">
        <Info className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-800">
          <p className="font-semibold">v1 allowlist model</p>
          <p className="mt-1">
            In v1, attesters are added by the Registry owner (centralized allowlist). This is a known
            limitation documented in spec §3. Open bonded registration is a stretch-phase goal.
            Challengers can be anyone but are also rate-limited per window.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-900">Attester Registry</p>
          <span className="text-xs text-slate-400">Source: Registry.sol (Anvil / Sepolia)</span>
        </div>
        <div className="divide-y divide-slate-100">
          <AttesterRow address="0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44" label="Default Attester (Anvil)" verdictCount={0} />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center space-y-3">
        <Database className="h-8 w-8 mx-auto text-slate-400" />
        <p className="font-semibold text-slate-600">Connect the indexer for live data</p>
        <p className="text-sm text-slate-400">
          Attester verdict counts and challenge histories are populated from the Neon Postgres indexer DB.
        </p>
      </div>
    </div>
  );
}

function AttesterRow({
  address, label, verdictCount,
}: {
  address: string; label: string; verdictCount: number;
}) {
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
          <Users className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="font-mono text-sm text-slate-700">{address}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-700">{verdictCount}</p>
        <p className="text-xs text-slate-400">verdicts</p>
      </div>
    </div>
  );
}
