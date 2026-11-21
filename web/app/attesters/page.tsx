import type { Metadata } from "next";
import { Users, Info, Database, ShieldCheck, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Attesters | PRAMAN",
  description: "Registered attester nodes on the PRAMAN protocol.",
};

export default function AttestersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-3 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-3">
          <KeyRound className="h-3.5 w-3.5" /> Spec §3 Consensus & Roles
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Registered Attesters</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm leading-relaxed">
          Allowlisted attester nodes authorized to sign and anchor verdicts on the PRAMAN Registry smart contract.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 p-5 flex gap-3.5">
        <Info className="h-5 w-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-zinc-800 dark:text-zinc-200">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">v1 Allowlist Model</p>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            In v1, attesters are designated by the Registry contract owner (permissioned allowlist). This is an
            honest limitation documented in spec §3. Open bonded staking registration is a planned protocol evolution.
            Anyone may submit challenges against attested verdicts.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
        <div className="px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Active Authorized Attesters</p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Registry.sol</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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

      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-8 text-center space-y-3">
        <Database className="h-7 w-7 mx-auto text-zinc-400" />
        <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">Continuous indexer sync</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-all">
              {address}
            </p>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
                ONLINE
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{verdictCount}</p>
        <p className="text-[11px] text-zinc-400">attestations</p>
      </div>
    </div>
  );
}
