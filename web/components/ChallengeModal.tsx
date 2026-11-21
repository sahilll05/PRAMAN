"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Copy,
  Check,
  Terminal,
  X,
  AlertCircle,
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

  const cliCommand = `praman-chain challenge \\
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in-0">
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-5 transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 id="challenge-modal-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Submit Verdict Challenge
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                Spec §2.2 & §3 · On-chain EAS Challenge Attestation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Notice banner */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
            <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
            Authoritative Challenge Rules (Spec §6)
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
            Challenges are recorded on Base Sepolia EAS. A challenge moves the verdict status to{" "}
            <strong>CHALLENGED</strong>. When <strong>≥ 2 distinct attesters</strong> submit
            dissenting verdicts (<code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">observed != verdict</code>),
            the status automatically flips to <strong>UPHELD_CHALLENGE</strong>.
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">
              Target Verdict UID (refUID)
            </label>
            <input
              type="text"
              value={refUid}
              onChange={(e) => setRefUid(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">
                Observed Verdict Class
              </label>
              <select
                value={observedVerdict}
                onChange={(e) => setObservedVerdict(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-colors"
              >
                <option value={1}>1 — LIKELY AUTHENTIC</option>
                <option value={2}>2 — LIKELY SYNTHETIC</option>
                <option value={0}>0 — ABSTAIN</option>
              </select>
            </div>

            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">
                Observed P(synthetic)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={observedPFakeBps}
                  onChange={(e) => setObservedPFakeBps(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-colors"
                />
                <span className="font-mono text-zinc-400 whitespace-nowrap">
                  ({(observedPFakeBps / 100).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">
              Evidence Hash (SHA-256 of reproduction bundle)
            </label>
            <input
              type="text"
              value={evidenceHash}
              onChange={(e) => setEvidenceHash(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <button
              onClick={() => setActiveTab("cli")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === "cli"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              CLI Command (Canonical)
            </button>
            <button
              onClick={() => setActiveTab("web3")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === "web3"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              Web3 Wallet
            </button>
          </div>

          {activeTab === "cli" ? (
            <div className="mt-3 space-y-2">
              <div className="relative rounded-lg bg-zinc-950 p-3.5 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800">
                <pre>{cliCommand}</pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200 transition-colors"
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
              <p className="text-[11px] text-zinc-400 font-mono">
                Requires @praman/chain CLI installed with an allowlisted attester key.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-4 text-center space-y-1.5">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Direct Browser Attestation (Base Sepolia)
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Connect your browser wallet configured for Base Sepolia testnet to submit
                an EAS attestation directly to VerdictResolver.
              </p>
              <button
                disabled
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-3 py-1 text-xs cursor-not-allowed"
              >
                Wallet signing active on Base Sepolia
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
