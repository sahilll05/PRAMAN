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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-0">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="challenge-modal-title" className="text-xl font-bold text-slate-900">
                Submit Verdict Challenge
              </h2>
              <p className="text-xs text-slate-500">
                Spec §2.2 & §3 · On-chain EAS Challenge Attestation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice banner */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Authoritative Challenge Rules (Spec §6)
          </p>
          <p className="text-amber-700 leading-relaxed">
            Challenges are recorded on Base Sepolia EAS. A challenge moves the verdict status to{" "}
            <strong>CHALLENGED (open)</strong>. When <strong>≥ 2 distinct attesters</strong> submit
            dissenting verdicts (<code className="bg-amber-100 px-1 rounded">observed != verdict</code>),
            the status automatically flips to <strong>UPHELD_CHALLENGE</strong>.
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Target Verdict UID (refUID)
            </label>
            <input
              type="text"
              value={refUid}
              onChange={(e) => setRefUid(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Observed Verdict Class
              </label>
              <select
                value={observedVerdict}
                onChange={(e) => setObservedVerdict(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option value={1}>1 — LIKELY AUTHENTIC</option>
                <option value={2}>2 — LIKELY SYNTHETIC</option>
                <option value={0}>0 — ABSTAIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Observed P(synthetic)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={observedPFakeBps}
                  onChange={(e) => setObservedPFakeBps(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  ({(observedPFakeBps / 100).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Evidence Hash (SHA-256 of reproduction bundle)
            </label>
            <input
              type="text"
              value={evidenceHash}
              onChange={(e) => setEvidenceHash(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="border-t border-slate-200 pt-3">
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab("cli")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === "cli"
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              CLI Command (Canonical)
            </button>
            <button
              onClick={() => setActiveTab("web3")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeTab === "web3"
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Web3 Wallet
            </button>
          </div>

          {activeTab === "cli" ? (
            <div className="mt-3 space-y-2">
              <div className="relative rounded-xl bg-slate-900 p-3.5 text-slate-100 font-mono text-xs overflow-x-auto">
                <pre>{cliCommand}</pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-green-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Requires <code className="text-slate-600 bg-slate-100 px-1 rounded">@pramana/chain</code>{" "}
                CLI installed with an allowlisted attester private key.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Direct Browser Attestation (Base Sepolia)
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Connect your browser wallet (MetaMask/Rabby) configured for Base Sepolia testnet to submit
                an EAS attestation directly to VerdictResolver.
              </p>
              <button
                disabled
                className="rounded-lg bg-slate-100 text-slate-400 px-4 py-1.5 text-xs font-medium cursor-not-allowed"
              >
                Wallet signing enabled on Base Sepolia
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
