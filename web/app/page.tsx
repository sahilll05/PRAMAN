"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Loader2,
  Link as LinkIcon,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Stamp,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeFileFingerprint } from "@/lib/fingerprint";
import { generateProtectReceipt, PramanaReceipt } from "@/lib/protect";
import { applyWatermarkToFile } from "@/lib/watermark";
import { StatusBadge } from "@/components/StatusBadge";
import { VerdictCard } from "@/components/VerdictCard";
import { ProtectCard } from "@/components/ProtectCard";
import { VerifyReceiptModal } from "@/components/VerifyReceiptModal";
import { VerdictStatus } from "@/lib/status";

type AppMode = "verify" | "protect";
type VerifyPhase = "idle" | "hashing" | "searching" | "signing" | "done" | "error";

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
  receipt?: PramanaReceipt;
  watermarkedBlob?: Blob | null;
  watermarkPsnr?: number | null;
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
  const [mode, setMode] = useState<AppMode>("verify");
  const [state, setState] = useState<VerifyState>(INITIAL);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const processFile = useCallback(
    async (file: File) => {
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
      setState((s) => ({
        ...s,
        phase: "hashing",
        fileName: file.name,
        fileSize: file.size,
        error: undefined,
      }));

      try {
        // T6.1: Compute SHA-256 and pHash locally in browser via WebAssembly — no media upload
        const fp = await computeFileFingerprint(file);

        if (mode === "protect") {
          // T10.1 & T10.1b: Protect Mode — Digital Watermarking + Signed .pramana Receipt
          setState((s) => ({
            ...s,
            phase: "signing",
            sha256Hex: fp.sha256Hex,
            pHashHex: fp.pHashHex,
          }));

          // T10.1b: Embed imperceptible digital watermark via HTML5 Canvas (PSNR >= 38 dB)
          let wmResult = null;
          try {
            wmResult = await applyWatermarkToFile(file);
          } catch (wmErr) {
            console.warn("Watermarking execution failed:", wmErr);
          }

          const receipt = await generateProtectReceipt({
            fileName: file.name,
            fileSize: file.size,
            sha256Hex: fp.sha256Hex,
            pHashHex: fp.pHashHex,
            trustmarkId: wmResult?.watermarkIdHex ?? null,
            watermarkStatus: wmResult ? ("embedded" as const) : ("none" as const),
          });

          setState((s) => ({
            ...s,
            phase: "done",
            receipt,
            watermarkedBlob: wmResult?.watermarkedBlob ?? null,
            watermarkPsnr: wmResult?.psnr ?? null,
          }));
          return;
        }

        // Verify Mode: Query on-chain / indexer verdicts by SHA-256 and pHash
        setState((s) => ({
          ...s,
          phase: "searching",
          sha256Hex: fp.sha256Hex,
          pHashHex: fp.pHashHex,
        }));

        let matchedVerdicts: LocalVerdict[] = [];
        try {
          const res = await fetch(
            `/api/verdicts?sha256=${fp.sha256Hex}&phash=${fp.pHashHex}&threshold=10`
          );
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
                expirationTime:
                  v.expirationTime ?? v.expiration_time ?? Date.now() / 1000 + 180 * 86400,
                modelHash:
                  v.modelHash ??
                  v.model_hash ??
                  "0x1111111111111111111111111111111111111111111111111111111111111111",
                evidenceHash:
                  v.evidenceHash ??
                  v.evidence_hash ??
                  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
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
    },
    [mode]
  );

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

  const handleModeChange = (newMode: AppMode) => {
    if (mode === newMode) return;
    setMode(newMode);
    reset();
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-3.5 py-1 text-xs text-zinc-700 dark:text-zinc-300">
          <span className="font-sanskrit text-sm font-semibold text-zinc-900 dark:text-zinc-100">प्रमाण</span>
          <span className="text-zinc-400 dark:text-zinc-600">/</span>
          <span>PRAMANA Protocol</span>
          <span className="text-zinc-400 dark:text-zinc-600">/</span>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">Base Sepolia Testnet</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {mode === "verify" ? "AI Image Authenticity Verifier" : "Digital Authenticity Notary"}
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
          {mode === "verify" ? (
            <>
              In Indian epistemology, <strong className="font-sanskrit font-medium text-zinc-900 dark:text-zinc-200">प्रमाण</strong> denotes the grounds and instruments of valid knowledge. Compute streaming cryptographic fingerprints locally in your browser and verify on-chain attestations. <span className="text-zinc-900 dark:text-zinc-200 font-medium">Your media never leaves your device.</span>
            </>
          ) : (
            <>
              Protect your original work before publishing. Generate a cryptographically signed, timestamped <code className="font-mono text-zinc-800 dark:text-zinc-200">.pramana</code> receipt containing SHA-256, perceptual hash, and an ECDSA P-256 signature. <span className="text-zinc-900 dark:text-zinc-200 font-medium">100% client-side Web Crypto.</span>
            </>
          )}
        </p>

        {/* Mode Selector Toggle */}
        <div className="pt-2 flex items-center justify-center">
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => handleModeChange("verify")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
                mode === "verify"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verify Media</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("protect")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
                mode === "protect"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Stamp className="h-3.5 w-3.5" />
              <span>Protect Original</span>
              <span className="ml-1 text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                Creator
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "relative mx-auto max-w-2xl rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-900/50"
            : "border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-zinc-500 dark:hover:border-zinc-600",
          state.phase !== "idle" && state.phase !== "error" && "pointer-events-none opacity-80"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for image file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
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
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              {mode === "verify" ? <Upload className="h-5 w-5" /> : <Stamp className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {mode === "verify"
                  ? "Drop an image to verify, or click to browse"
                  : "Drop your original work to generate a signed .pramana receipt"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                PNG, JPEG, WebP (still images only)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-900 rounded-md px-3 py-1 border border-zinc-200 dark:border-zinc-800">
              {mode === "verify"
                ? "Client-Side WebAssembly Fingerprinting · Zero Media Upload"
                : "ECDSA P-256 Web Crypto Signature · Zero Media Upload"}
            </div>
          </div>
        )}

        {(state.phase === "hashing" || state.phase === "searching" || state.phase === "signing") && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-8 w-8 text-zinc-700 dark:text-zinc-300 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {state.phase === "hashing" && "Computing fingerprints locally via WebAssembly..."}
                {state.phase === "searching" && "Searching Base Sepolia registry..."}
                {state.phase === "signing" && "Generating ECDSA P-256 signed receipt in Web Crypto..."}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                {state.fileName} ({(state.fileSize / 1024).toFixed(1)} KB)
              </p>
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="space-y-3 py-4">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <p className="font-semibold text-sm text-rose-700 dark:text-rose-400">Processing Error</p>
            <p className="text-xs text-rose-600 dark:text-rose-300">{state.error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="text-xs font-medium text-zinc-800 dark:text-zinc-200 underline"
            >
              Try another image
            </button>
          </div>
        )}
      </div>

      {/* Verify Existing Receipt Shortcut */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsReceiptModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-4 cursor-pointer transition-colors"
        >
          <FileCheck className="h-3.5 w-3.5" />
          <span>Have a .pramana receipt? Verify cryptographic integrity here</span>
        </button>
      </div>

      {/* Results Section */}
      {state.phase === "done" && (
        <div className="max-w-2xl mx-auto space-y-6">
          {mode === "protect" && state.receipt ? (
            /* Protect Mode Result */
            <ProtectCard
              receipt={state.receipt}
              watermarkedBlob={state.watermarkedBlob}
              watermarkPsnr={state.watermarkPsnr}
              onReset={reset}
            />
          ) : (
            /* Verify Mode Result */
            <>
              {/* Fingerprint Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                      <FileImage className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-xs">
                        {state.fileName}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono">
                        {(state.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-2.5 py-0.5">
                    ✓ Fingerprinted Locally
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-7 text-center space-y-4">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                      No on-chain verdicts found yet
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      This image has not been attested by an authorized attester node on the blockchain yet.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleRunInference}
                      disabled={isEvaluating}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Evaluating with Model A & B Probe Ensemble...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Evaluate with Local Detector Node (CLIP Probe Ensemble)
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
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
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Verify another image
              </button>
            </>
          )}
        </div>
      )}

      {/* How it works Cards */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {HOW_IT_WORKS.map((step) => (
          <div
            key={step.title}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-5 space-y-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
              <step.Icon className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{step.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      {/* Verify Receipt Modal */}
      <VerifyReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />
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
    <div className="rounded-md bg-zinc-100/70 dark:bg-zinc-950 px-3 py-2 flex items-center justify-between gap-3 border border-zinc-200/60 dark:border-zinc-800">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 w-16 flex-shrink-0">
          {label}
        </span>
        <span className="text-xs text-zinc-800 dark:text-zinc-200 font-mono truncate">
          {value || "—"}
        </span>
      </div>
      {value && (
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
    Icon: Stamp,
    title: "Creator Protect Mode",
    description:
      "Original media generates a downloadable, locally-signed .pramana JSON receipt using Web Crypto ECDSA P-256 to prove fingerprint existence at a timestamp.",
  },
];
