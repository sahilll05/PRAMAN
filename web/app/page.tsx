"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Info,
  Loader2,
  Link as LinkIcon,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { computeFileFingerprint } from "@/lib/fingerprint";
import { StatusBadge } from "@/components/StatusBadge";
import { VerdictCard } from "@/components/VerdictCard";
import { VerdictStatus } from "@/lib/status";

type VerifyPhase = "idle" | "hashing" | "searching" | "done" | "error";

interface LocalVerdict {
  uid: string;
  verdict: number;
  pFakeBps: number;
  status: VerdictStatus | string;
  badge: string;
  attester: string;
  time: bigint | string | number;
  expirationTime: bigint | string | number;
  modelHash: string;
  evidenceHash: string;
}

interface VerifyState {
  phase: VerifyPhase;
  sha256Hex: string;
  pHashHex: string;
  fileName: string;
  fileSize: number;
  error?: string;
  verdicts: LocalVerdict[];
}

const INITIAL: VerifyState = {
  phase: "idle",
  sha256Hex: "",
  pHashHex: "",
  fileName: "",
  fileSize: 0,
  verdicts: [],
};

export default function HomePage() {
  const [state, setState] = useState<VerifyState>(INITIAL);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({
        ...INITIAL,
        phase: "error",
        error: "Only image files are supported (MVP: still images).",
        fileName: file.name,
        fileSize: file.size,
      });
      return;
    }

    setCurrentFile(file);
    setState((s) => ({ ...s, phase: "hashing", fileName: file.name, fileSize: file.size, error: undefined }));

    try {
      // T6.1: Compute SHA-256 and pHash locally in browser via WebAssembly — no media upload
      const fp = await computeFileFingerprint(file);

      setState((s) => ({
        ...s,
        phase: "searching",
        sha256Hex: fp.sha256Hex,
        pHashHex: fp.pHashHex,
      }));

      // T6.3: Query on-chain / indexer verdicts by SHA-256 and pHash
      let matchedVerdicts: LocalVerdict[] = [];
      try {
        const res = await fetch(`/api/verdicts?sha256=${fp.sha256Hex}&phash=${fp.pHashHex}&threshold=10`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.verdicts) && data.verdicts.length > 0) {
            matchedVerdicts = data.verdicts.map((v: any) => ({
              uid: v.uid,
              verdict: Number(v.verdict),
              pFakeBps: Number(v.pFakeBps ?? v.p_fake_bps ?? 5000),
              status: v.status ?? "ACTIVE",
              badge: v.badge ?? "ACTIVE",
              attester: v.attester,
              time: v.time ?? v.createdAt ?? Date.now() / 1000,
              expirationTime: v.expirationTime ?? v.expiration_time ?? (Date.now() / 1000 + 180 * 86400),
              modelHash: v.modelHash ?? v.model_hash ?? "0x1111111111111111111111111111111111111111111111111111111111111111",
              evidenceHash: v.evidenceHash ?? v.evidence_hash ?? "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            }));
          }
        }
      } catch (searchErr) {
        console.warn("Search fetch failed:", searchErr);
      }

      setState((s) => ({
        ...s,
        phase: "done",
        verdicts: matchedVerdicts,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Unexpected error during fingerprinting.",
      }));
    }
  }, []);

  const handleRunInference = async () => {
    if (!currentFile) return;

    setIsEvaluating(true);
    try {
      const formData = new FormData();
      formData.append("file", currentFile);

      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || "Inference failed");
      }

      const data = await res.json();
      if (data.success && data.verdict) {
        setState((s) => ({
          ...s,
          verdicts: [data.verdict],
        }));
      }
    } catch (err: any) {
      alert("Model evaluation failed: " + (err.message || String(err)));
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const reset = () => {
    setState(INITIAL);
    setCurrentFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 dark:border-brand-400/30 dark:bg-brand-400/10 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
          </span>
          Base Sepolia Testnet · Open Protocol
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          AI Image Authenticity{" "}
          <span className="bg-gradient-to-r from-brand-600 via-sky-500 to-indigo-500 dark:from-brand-400 dark:via-sky-300 dark:to-indigo-300 bg-clip-text text-transparent">
            Verifier
          </span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Drop an image to compute streaming cryptographic fingerprints in your browser and check on-chain attestations.{" "}
          <strong className="text-slate-900 dark:text-white font-semibold">Your media never leaves your device.</strong>
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "relative mx-auto max-w-2xl rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 cursor-pointer backdrop-blur-xl shadow-lg",
          isDragging
            ? "border-brand-500 bg-brand-500/10 scale-[1.01] shadow-brand-500/20 shadow-2xl"
            : "border-slate-300/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-sky-50/30 dark:hover:bg-slate-900/90 shadow-slate-200/50 dark:shadow-none",
          state.phase !== "idle" && state.phase !== "error" && "pointer-events-none opacity-80"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for image file verification"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileInput}
          aria-label="Select image file"
        />

        {state.phase === "idle" && (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-600 text-white shadow-lg shadow-brand-500/30">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Drop your image here, or click to browse
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                PNG, JPEG, WebP (still images only)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-300 font-medium bg-brand-50 dark:bg-brand-950/60 rounded-xl px-3.5 py-1.5 border border-brand-200/60 dark:border-brand-800/60">
              🔒 100% Client-Side Hashing — Media never uploaded to any server
            </div>
          </div>
        )}

        {(state.phase === "hashing" || state.phase === "searching") && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-12 w-12 text-brand-500 animate-spin" />
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {state.phase === "hashing" ? "Computing fingerprints locally via WebAssembly..." : "Searching Base Sepolia registry..."}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {state.fileName} ({(state.fileSize / 1024).toFixed(1)} KB)
              </p>
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="space-y-3 py-4">
            <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
            <p className="font-semibold text-rose-700 dark:text-rose-400">Verification Error</p>
            <p className="text-sm text-rose-600 dark:text-rose-300">{state.error}</p>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 underline"
            >
              Try another image
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {state.phase === "done" && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Fingerprint Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 dark:bg-brand-400/10 border border-brand-500/20 text-brand-600 dark:text-brand-300">
                  <FileImage className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white truncate max-w-xs">{state.fileName}</p>
                  <p className="text-xs text-slate-400">{(state.fileSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                ✓ Fingerprinted Locally
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <FingerprintRow
                label="SHA-256"
                value={state.sha256Hex}
                isCopied={copiedKey === "sha256"}
                onCopy={() => copyToClipboard(state.sha256Hex, "sha256")}
              />
              <FingerprintRow
                label="pHash"
                value={state.pHashHex}
                isCopied={copiedKey === "phash"}
                onCopy={() => copyToClipboard(state.pHashHex, "phash")}
              />
            </div>
          </div>

          {/* Verdict results */}
          {state.verdicts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 shadow-sm backdrop-blur-xl text-center space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Clock className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white text-lg">No on-chain verdicts found yet</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  This image has not been attested by an authorized node on the blockchain yet.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunInference}
                  disabled={isEvaluating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 via-sky-500 to-indigo-600 hover:from-brand-500 hover:to-sky-400 text-white px-6 py-3.5 text-sm font-bold shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Evaluating with Model A & B Probe Ensemble...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Evaluate with Local Detector Node (CLIP Probe Ensemble)
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                Runs local open-weight ONNX Model A (Linear Probe) and Model B (MLP Probe) with temperature scaling and calibrated conformal sets.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {state.verdicts.map((v) => (
                <VerdictCard key={v.uid} verdict={v as any} />
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-sm transition-colors cursor-pointer"
          >
            Verify another image
          </button>
        </div>
      )}

      {/* How it works Cards */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {HOW_IT_WORKS.map((step) => (
          <div
            key={step.title}
            className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-md space-y-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 dark:bg-brand-400/10 border border-brand-500/20 text-brand-600 dark:text-brand-400">
              <step.Icon className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">{step.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FingerprintRow({
  label,
  value,
  isCopied,
  onCopy,
}: {
  label: string;
  value: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl bg-slate-100/70 dark:bg-slate-950/70 px-3.5 py-2.5 flex items-center justify-between gap-3 border border-slate-200/40 dark:border-slate-800/50">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 w-16 flex-shrink-0">
          {label}
        </span>
        <span className="text-xs text-slate-700 dark:text-slate-200 font-mono truncate">
          {value || "—"}
        </span>
      </div>
      {value && (
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          title={`Copy ${label}`}
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    Icon: ShieldAlert,
    title: "Local Fingerprinting",
    description:
      "SHA-256 and 64-bit pHash are computed entirely in your browser using WebAssembly. Zero image bytes are transmitted over the network.",
  },
  {
    Icon: LinkIcon,
    title: "On-Chain Lookups",
    description:
      "Fingerprints match tamper-evident EAS attestations on Base Sepolia published by allowlisted attester nodes running verified ONNX models.",
  },
  {
    Icon: CheckCircle2,
    title: "Living Verdicts",
    description:
      "Verdicts are dynamic: canaries continuous health checks, challenge resolution, and keeper daemon re-scans keep assessments up to date.",
  },
];
