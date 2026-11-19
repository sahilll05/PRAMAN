import type { Metadata } from "next";
import { Users, Info, Database, ShieldCheck, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Attesters | PRAMANA",
  description: "Registered attester nodes on the PRAMANA protocol.",
};

export default function AttestersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-3">
          <KeyRound className="h-3.5 w-3.5" /> Spec §3 Consensus & Roles
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Registered Attesters</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
          Allowlisted attester nodes authorized to sign and anchor verdicts on the PRAMANA Registry smart contract.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-200/80 bg-brand-50/70 dark:border-brand-900/60 dark:bg-brand-950/40 p-5 flex gap-3.5 backdrop-blur-sm">
        <Info className="h-5 w-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-900 dark:text-brand-200">
          <p className="font-semibold">v1 Allowlist Model</p>
          <p className="mt-1 text-xs sm:text-sm text-brand-800 dark:text-brand-300 leading-relaxed">
            In v1, attesters are designated by the Registry contract owner (permissioned allowlist). This is an
            honest limitation documented in spec §3. Open bonded staking registration is a planned protocol evolution.
            Anyone may submit challenges against attested verdicts.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <p className="font-bold text-slate-900 dark:text-white">Active Authorized Attesters</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Registry.sol</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          <AttesterRow
            address="0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44"
            label="Default Testnet Attester Node (Anvil / Sepolia)"
            verdictCount={1}
            isLive={true}
          />
          <AttesterRow
            address="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
            label="Secondary Verification Worker"
            verdictCount={0}
            isLive={false}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-8 text-center space-y-3">
        <Database className="h-8 w-8 mx-auto text-slate-400" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">Continuous indexer sync</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          Attester throughput, uptime, and dispute history are indexed in real-time from on-chain EAS events.
        </p>
      </div>
    </div>
  );
}

function AttesterRow({
  address,
  label,
  verdictCount,
  isLive,
}: {
  address: string;
  label: string;
  verdictCount: number;
  isLive: boolean;
}) {
  return (
    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
              {address}
            </p>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{verdictCount}</p>
        <p className="text-xs text-slate-400">attestations</p>
      </div>
    </div>
  );
}
