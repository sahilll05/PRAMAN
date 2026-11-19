"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeModalProps {
  targetUid?: string;
  targetModelHash?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChallengeModal({
  targetUid = "",
  targetModelHash = "",
  isOpen,
  onClose,
}: ChallengeModalProps) {
  const [refUid, setRefUid] = useState(targetUid);
  const [modelHash, setModelHash] = useState(targetModelHash);
  const [observedVerdict, setObservedVerdict] = useState<number>(1);
  const [observedPFakeBps, setObservedPFakeBps] = useState<number>(200);
  const [evidenceHash, setEvidenceHash] = useState<string>("0x" + "11".repeat(32));
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"cli" | "web3">("cli");

  if (!isOpen) return null;

  const cliCommand = `pramana-chain challenge \\
  --ref ${refUid || "0x<TARGET_UID>"} \\
  --model ${modelHash || "0x<MODEL_HASH>"} \\
  --verdict ${observedVerdict} \\
  --pfake-bps ${observedPFakeBps} \\
  --evidence-hash ${evidenceHash}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in-0">
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden space-y-5 transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="challenge-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Submit Verdict Challenge
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spec §2.2 & §3 · On-chain EAS Challenge Attestation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice banner */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-950/30 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Authoritative Challenge Rules (Spec §6)
          </p>
          <p className="leading-relaxed">
            Challenges are recorded on Base Sepolia EAS. A challenge moves the verdict status to{" "}
            <strong>CHALLENGED (open)</strong>. When <strong>≥ 2 distinct attesters</strong> submit
            dissenting verdicts (<code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">observed != verdict</code>),
            the status automatically flips to <strong>UPHELD_CHALLENGE</strong>.
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Target Verdict UID (refUID)
            </label>
            <input
              type="text"
              value={refUid}
              onChange={(e) => setRefUid(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Observed Verdict Class
              </label>
              <select
                value={observedVerdict}
                onChange={(e) => setObservedVerdict(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
              >
                <option value={1}>1 — LIKELY AUTHENTIC</option>
                <option value={2}>2 — LIKELY SYNTHETIC</option>
                <option value={0}>0 — ABSTAIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Observed P(synthetic)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={observedPFakeBps}
                  onChange={(e) => setObservedPFakeBps(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
                />
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  ({(observedPFakeBps / 100).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Evidence Hash (SHA-256 of reproduction bundle)
            </label>
            <input
              type="text"
              value={evidenceHash}
              onChange={(e) => setEvidenceHash(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3.5">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab("cli")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
                activeTab === "cli"
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              CLI Command (Canonical)
            </button>
            <button
              onClick={() => setActiveTab("web3")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
                activeTab === "web3"
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Web3 Wallet
            </button>
          </div>

          {activeTab === "cli" ? (
            <div className="mt-3.5 space-y-2">
              <div className="relative rounded-2xl bg-slate-950 dark:bg-black p-4 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
                <pre>{cliCommand}</pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Requires <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">@pramana/chain</code>{" "}
                CLI installed with an allowlisted attester private key.
              </p>
            </div>
          ) : (
            <div className="mt-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-5 text-center space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Direct Browser Attestation (Base Sepolia)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Connect your browser wallet configured for Base Sepolia testnet to submit
                an EAS attestation directly to VerdictResolver.
              </p>
              <button
                disabled
                className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 px-4 py-2 text-xs font-medium cursor-not-allowed"
              >
                Wallet signing active on Base Sepolia
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
