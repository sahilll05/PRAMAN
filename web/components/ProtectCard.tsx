"use client";

import { useState } from "react";
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  Calendar,
  FileCode,
  FileCheck,
  Info,
} from "lucide-react";
import { PramanaReceipt, downloadReceiptFile, verifyProtectReceipt } from "@/lib/protect";
import { cn } from "@/lib/utils";

interface ProtectCardProps {
  receipt: PramanaReceipt;
  onReset: () => void;
}

export function ProtectCard({ receipt, onReset }: ProtectCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isVerifyingSelf, setIsVerifyingSelf] = useState(false);
  const [selfVerificationResult, setSelfVerificationResult] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleVerifySelf = async () => {
    setIsVerifyingSelf(true);
    try {
      const res = await verifyProtectReceipt(receipt);
      if (res.valid) {
        setSelfVerificationResult("✓ Signature strictly verified: ECDSA P-256 matches embedded public key.");
      } else {
        setSelfVerificationResult("✗ Signature verification failed: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      setSelfVerificationResult("✗ Error: " + (err.message || String(err)));
    } finally {
      setIsVerifyingSelf(false);
    }
  };

  const formattedDate = new Date(receipt.timestamp).toLocaleString("en-US", {
    timeZoneName: "short",
  });

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Authenticity Receipt Generated
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {receipt.media.fileName} ({(receipt.media.fileSize / 1024).toFixed(1)} KB)
            </p>
          </div>
        </div>
        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-2.5 py-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Locally Signed (ECDSA P-256)
        </span>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => downloadReceiptFile(receipt)}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white px-5 py-3 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4" />
          Download .pramana Receipt
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(JSON.stringify(receipt, null, 2), "json")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          {copiedKey === "json" ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Copied JSON</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy JSON</span>
            </>
          )}
        </button>
      </div>

      {/* Receipt Details Grid */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Receipt Manifest
        </h4>

        <div className="grid grid-cols-1 gap-2.5 text-xs font-mono">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" /> Timestamp (ISO 8601)
              </span>
              <span className="text-[11px] text-zinc-400">{formattedDate}</span>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200 break-all">{receipt.timestamp}</p>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <FileCode className="h-3.5 w-3.5" /> SHA-256 Hash
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(receipt.media.sha256, "sha256")}
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {copiedKey === "sha256" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200 break-all">{receipt.media.sha256}</p>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <FileCode className="h-3.5 w-3.5" /> Perceptual Hash (pHash)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(receipt.media.pHash, "phash")}
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {copiedKey === "phash" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200">{receipt.media.pHash}</p>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200/70 dark:border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <KeyRound className="h-3.5 w-3.5" /> ECDSA P-256 Signature
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(receipt.signature, "sig")}
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {copiedKey === "sig" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200 truncate">{receipt.signature}</p>
          </div>
        </div>
      </div>

      {/* Self Verification Row */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleVerifySelf}
          disabled={isVerifyingSelf}
          className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 underline cursor-pointer"
        >
          {isVerifyingSelf ? "Verifying signature in Web Crypto..." : "Test Cryptographic Verification In Browser"}
        </button>
        {selfVerificationResult && (
          <p
            className={cn(
              "mt-2 text-xs font-mono p-2.5 rounded-lg border",
              selfVerificationResult.startsWith("✓")
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
            )}
          >
            {selfVerificationResult}
          </p>
        )}
      </div>

      {/* Honest Limitation / Compliance Notice */}
      <div className="rounded-xl bg-zinc-100/70 dark:bg-zinc-950 p-3.5 border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
        <Info className="h-4 w-4 text-zinc-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            Notice on Digital Receipts
          </p>
          <p className="leading-relaxed text-[11px]">
            A <code className="font-mono text-zinc-700 dark:text-zinc-300">.pramana</code> receipt generates a locally-signed record of your media&apos;s content hash and creation timestamp using standard Web Crypto primitives. It provides a verifiable timestamped fingerprint, not legal proof of copyright or copyright registration. Media never leaves your browser.
          </p>
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        Protect another original
      </button>
    </div>
  );
}
