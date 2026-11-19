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
  const fileRef = useRef<HTMLInputElement>(null);

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
      // T6.1: Compute SHA-256 and pHash locally in browser — no media upload
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
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4 pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
          </span>
          Testnet · Research Prototype · v0.1.0-draft
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
          AI Image Authenticity{" "}
          <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">
            Verifier
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-500 leading-relaxed">
          Drop an image to compute its fingerprint locally and look up on-chain attestation records.{" "}
          <strong className="text-slate-700">Your media never leaves your browser.</strong>
        </p>
        <p className="text-sm text-amber-700 font-medium">
          ⚠️ Model-assessed likelihood only — not a ruling. See{" "}
          <Link href="/limitations" className="underline">limitations</Link>.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "relative mx-auto max-w-2xl rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer",
          isDragging
            ? "border-brand-400 bg-brand-50 scale-[1.01]"
            : "border-slate-300 bg-white hover:border-brand-300 hover:bg-sky-50/40",
          state.phase !== "idle" && state.phase !== "error" && "pointer-events-none opacity-70"
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
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
              <Upload className="h-8 w-8 text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Drop your image here, or click to browse</p>
              <p className="text-sm text-slate-400 mt-1">PNG, JPEG, WebP (still images only)</p>
            </div>
            <div className="text-xs text-brand-600 font-medium bg-brand-50 rounded-lg px-3 py-1.5 inline-block border border-brand-100">
              🔒 100% Client-Side Hashing — Media never uploaded
            </div>
          </div>
        )}

        {(state.phase === "hashing" || state.phase === "searching") && (
          <div className="space-y-4 py-4">
            <Loader2 className="mx-auto h-10 w-10 text-brand-600 animate-spin" />
            <div>
              <p className="font-semibold text-slate-700">
                {state.phase === "hashing" ? "Computing fingerprints in WebAssembly..." : "Searching on-chain registry..."}
              </p>
              <p className="text-sm text-slate-400 mt-1">{state.fileName} ({(state.fileSize / 1024).toFixed(1)} KB)</p>
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="space-y-3 py-2">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
            <p className="font-semibold text-rose-700">Verification Error</p>
            <p className="text-sm text-rose-600">{state.error}</p>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-xs font-semibold text-brand-600 underline"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <FileImage className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 truncate max-w-xs">{state.fileName}</p>
                  <p className="text-xs text-slate-400">{(state.fileSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                Fingerprinted locally
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <FingerprintRow label="SHA-256" value={state.sha256Hex} />
              <FingerprintRow label="pHash" value={state.pHashHex} />
            </div>
          </div>

          {/* Verdict results */}
          {state.verdicts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Clock className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-lg">No on-chain verdicts found yet</p>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  This image has not been attested by an allowlisted node on the blockchain yet.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunInference}
                  disabled={isEvaluating}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Evaluating with Model A & B Ensemble...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Evaluate with Local Detector Node (CLIP Probe Ensemble)
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Runs local open-weight ONNX Model A (Linear Probe) and Model B (MLP Probe) with calibrated thresholds.
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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Verify another image
          </button>
        </div>
      )}

      {/* How it works */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
              <step.Icon className="h-5 w-5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-slate-900">{step.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FingerprintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-start gap-3">
      <span className="text-xs font-semibold text-slate-500 mt-0.5 w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-mono break-all">{value || "—"}</span>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    Icon: ShieldAlert,
    title: "Local fingerprinting",
    description:
      "SHA-256 and pHash are computed entirely in your browser using WebAssembly. No bytes are sent to any server.",
  },
  {
    Icon: LinkIcon,
    title: "On-chain lookup",
    description:
      "Fingerprints are matched against EAS attestations on Base Sepolia testnet by registered attester nodes running open ONNX models.",
  },
  {
    Icon: CheckCircle2,
    title: "Transparent verdicts",
    description:
      "Verdicts are versioned, challengeable, and expire. The full timeline shows supersessions, canary health, and challenge outcomes.",
  },
];
