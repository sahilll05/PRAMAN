"use client";

import { useState, useRef } from "react";
import {
  X,
  FileCheck,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCode,
} from "lucide-react";
import { verifyProtectReceipt, PramanaReceipt } from "@/lib/protect";
import { extractWatermark } from "@/lib/watermark";
import { cn } from "@/lib/utils";

interface VerifyReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerifyReceiptModal({ isOpen, onClose }: VerifyReceiptModalProps) {
  const [fileContent, setFileContent] = useState<string>("");
  const [result, setResult] = useState<{
    tested: boolean;
    valid?: boolean;
    error?: string;
    receipt?: PramanaReceipt;
    watermarkDetected?: { found: boolean; id?: string };
  }>({ tested: false });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessText = async (text: string) => {
    setFileContent(text);
    setIsLoading(true);
    setResult({ tested: false });

    try {
      const parsed = JSON.parse(text);
      const res = await verifyProtectReceipt(parsed);
      setResult({
        tested: true,
        valid: res.valid,
        error: res.error,
        receipt: res.receipt,
      });
    } catch (err: any) {
      setResult({
        tested: true,
        valid: false,
        error: "Failed to parse receipt JSON: " + (err.message || String(err)),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    if (file.type.startsWith("image/")) {
      // Check for embedded watermark in image file
      setIsLoading(true);
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const wmRes = extractWatermark(imgData.data, canvas.width, canvas.height);
            setResult({
              tested: true,
              valid: wmRes.found,
              error: wmRes.found ? undefined : "No PRAMANA watermark detected in this image.",
              watermarkDetected: { found: wmRes.found, id: wmRes.watermarkIdHex },
            });
          }
        } finally {
          URL.revokeObjectURL(objectUrl);
          setIsLoading(false);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setIsLoading(false);
      };
      img.src = objectUrl;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) handleProcessText(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleReset = () => {
    setFileContent("");
    setResult({ tested: false });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Verify .pramana Receipt
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Validate cryptographic ECDSA signature and manifest integrity client-side
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drop Zone for .pramana or image */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-6 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pramana,.json,image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <Upload className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Drop a .pramana receipt or image file here, or click to browse
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Evaluates cryptographic signatures & embedded watermarks locally · Zero data sent to any server
          </p>
        </div>

        {/* Or Paste JSON */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Or paste raw receipt JSON:
          </label>
          <textarea
            value={fileContent}
            onChange={(e) => handleProcessText(e.target.value)}
            placeholder='{"version": "pramana-receipt-v1", ...}'
            rows={4}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying ECDSA P-256 signature in SubtleCrypto...</span>
          </div>
        )}

        {/* Verification Result */}
        {result.tested && (
          <div
            className={cn(
              "rounded-xl p-4 border space-y-3",
              result.valid
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-300"
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-xs">
              {result.watermarkDetected ? (
                result.watermarkDetected.found ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Digital Watermark Recovered: {result.watermarkDetected.id}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span>No PRAMANA Watermark Detected</span>
                  </>
                )
              ) : result.valid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Valid PRAMANA Receipt — Signature Verified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>Invalid Receipt — Cryptographic Check Failed</span>
                </>
              )}
            </div>

            {result.error && (
              <p className="text-xs font-mono text-rose-700 dark:text-rose-400">
                {result.error}
              </p>
            )}

            {result.watermarkDetected?.found && (
              <div className="rounded-lg bg-white/70 dark:bg-zinc-900/80 p-3 space-y-1.5 text-xs font-mono border border-zinc-200/50 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                <p><span className="text-zinc-400">Status:</span> Watermark recovered with CRC-8 integrity verified</p>
                <p><span className="text-zinc-400">Payload ID:</span> {result.watermarkDetected.id}</p>
                <p><span className="text-zinc-400">Method:</span> PRAMANA Interleaved Differential Watermark</p>
              </div>
            )}

            {result.receipt && (
              <div className="rounded-lg bg-white/70 dark:bg-zinc-900/80 p-3 space-y-1.5 text-xs font-mono border border-zinc-200/50 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                <p><span className="text-zinc-400">File:</span> {result.receipt.media.fileName}</p>
                <p><span className="text-zinc-400">SHA-256:</span> {result.receipt.media.sha256}</p>
                <p><span className="text-zinc-400">pHash:</span> {result.receipt.media.pHash}</p>
                {result.receipt.watermark.trustmarkId && (
                  <p><span className="text-zinc-400">Watermark:</span> {result.receipt.watermark.trustmarkId}</p>
                )}
                <p><span className="text-zinc-400">Timestamp:</span> {result.receipt.timestamp}</p>
                <p><span className="text-zinc-400">Algorithm:</span> {result.receipt.signer.algorithm} {result.receipt.signer.namedCurve}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {fileContent && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
