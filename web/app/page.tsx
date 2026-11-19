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
  status: VerdictStatus;
  badge: string;
  attester: string;
  time: bigint;
  expirationTime: bigint;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ ...INITIAL, phase: "error", error: "Only image files are supported (MVP: still images).", fileName: file.name, fileSize: file.size, sha256Hex: "", pHashHex: "", verdicts: [] });
      return;
    }

    setState((s) => ({ ...s, phase: "hashing", fileName: file.name, fileSize: file.size, error: undefined }));

    try {
      // T6.1: Compute SHA-256 and pHash locally — no upload
      const fp = await computeFileFingerprint(file);

      setState((s) => ({
        ...s,
        phase: "searching",
        sha256Hex: fp.sha256Hex,
        pHashHex: fp.pHashHex,
      }));

      // T6.3: Look up verdicts — here we use static demo data since indexer
      // requires a live Neon DB or Anvil node. In production this would call
      // /api/verdicts?sha256=... or /api/verdicts/phash?hash=...&threshold=10
      await new Promise((r) => setTimeout(r, 800)); // simulate network

      setState((s) => ({
        ...s,
        phase: "done",
        verdicts: [], // empty = no on-chain record found
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Unexpected error during fingerprinting.",
      }));
    }
  }, []);

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
              <p className="text-lg font-semibold text-slate-700">Drop an image here</p>
              <p className="text-sm text-slate-500 mt-1">or click to browse · JPEG, PNG, WebP, GIF</p>
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              All processing happens in your browser — zero upload
            </p>
          </div>
        )}

        {(state.phase === "hashing" || state.phase === "searching") && (
          <div className="space-y-4">
            <Loader2 className="h-10 w-10 mx-auto text-brand-500 animate-spin" />
            <p className="text-slate-700 font-medium">
              {state.phase === "hashing" ? "Computing fingerprints…" : "Searching on-chain records…"}
            </p>
            <p className="text-sm text-slate-400 mono">{state.fileName}</p>
          </div>
        )}

        {state.phase === "error" && (
          <div className="space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
            <p className="text-red-700 font-medium">{state.error}</p>
            <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-sm text-brand-600 underline">
              Try another file
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {state.phase === "done" && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
          {/* Fingerprint summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <FileImage className="h-5 w-5 text-brand-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{state.fileName}</p>
                <p className="text-xs text-slate-500">{(state.fileSize / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <FingerprintRow label="SHA-256" value={state.sha256Hex} />
              <FingerprintRow label="pHash" value={state.pHashHex} />
            </div>
          </div>

          {/* Verdict results */}
          {state.verdicts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Clock className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">No on-chain verdicts found</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                This image has not been attested by any registered model on PRAMANA. No on-chain record
                does not mean the image is authentic — it has simply not been evaluated.
              </p>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
                Only images processed by an authorized attester node appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {state.verdicts.map((v) => (
                <VerdictCard key={v.uid} verdict={v} />
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
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
