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
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { verifyProtectReceipt, PramanReceipt } from "@/lib/protect";
import { extractWatermark } from "@/lib/watermark";
import { cn } from "@/lib/utils";

interface VerifyReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerifyReceiptModal({ isOpen, onClose }: VerifyReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "json">("upload");
  const [fileContent, setFileContent] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tested: boolean;
    valid?: boolean;
    error?: string;
    receipt?: PramanReceipt;
    watermarkDetected?: { found: boolean; id?: string };
    sourceFileName?: string;
  }>({ tested: false });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleProcessText = async (text: string, fileName?: string) => {
    if (!text.trim()) return;
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
        sourceFileName: fileName || res.receipt?.media?.fileName,
      });
    } catch (err: any) {
      setResult({
        tested: true,
        valid: false,
        error: "Failed to parse receipt JSON: " + (err.message || String(err)),
        sourceFileName: fileName,
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
              error: wmRes.found ? undefined : "No PRAMAN watermark detected in this image.",
              watermarkDetected: { found: wmRes.found, id: wmRes.watermarkIdHex },
              sourceFileName: file.name,
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
      if (text) handleProcessText(text, file.name);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Verify .praman Receipt
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Validate cryptographic ECDSA signature and manifest integrity client-side
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* When NOT tested: show clean input tabs */}
        {!result.tested && (
          <div className="space-y-4">
            {/* Input Selection Tabs */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors",
                  activeTab === "upload"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload File / Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors",
                  activeTab === "json"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>Paste JSON</span>
              </button>
            </div>

            {/* Tab 1: Upload File / Receipt */}
            {activeTab === "upload" && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".praman,.pramana,.json,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Upload className="mx-auto h-8 w-8 text-zinc-400 mb-2.5" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Drop a .praman receipt or image file here, or click to browse
                </p>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Validates ECDSA signatures & recovers embedded watermarks locally · Zero data sent to any server
                </p>
              </div>
            )}

            {/* Tab 2: Paste Raw JSON */}
            {activeTab === "json" && (
              <div className="space-y-3">
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  placeholder='Paste full .praman JSON receipt here:&#10;{&#10;  "version": "praman-receipt-v1",&#10;  "protocol": "PRAMAN", ...&#10;}'
                  rows={6}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleProcessText(fileContent)}
                    disabled={!fileContent.trim() || isLoading}
                    className="rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
                  >
                    Verify Receipt JSON
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying cryptographic ECDSA P-256 signature in Web Crypto...</span>
              </div>
            )}
          </div>
        )}

        {/* When TESTED: show clean dedicated Result Card */}
        {result.tested && (
          <div className="space-y-4">
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
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Digital Watermark Recovered: {result.watermarkDetected.id}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>No PRAMAN Watermark Detected</span>
                    </>
                  )
                ) : result.valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Valid PRAMAN Receipt — Cryptographic Signature Verified</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
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
                <div className="rounded-lg bg-white/80 dark:bg-zinc-900/90 p-3.5 space-y-2 text-xs font-mono border border-zinc-200/50 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Status:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Valid (CRC-8 Integrity Passed)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Payload ID:</span>
                    <span>{result.watermarkDetected.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Method:</span>
                    <span>PRAMAN Interleaved Differential Watermark</span>
                  </div>
                </div>
              )}

              {result.receipt && (
                <div className="rounded-lg bg-white/80 dark:bg-zinc-900/90 p-3.5 space-y-2.5 text-xs font-mono border border-zinc-200/50 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">File:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{result.receipt.media.fileName}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-zinc-500">
                      <span>SHA-256:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(result.receipt!.media.sha256, "sha256")}
                        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                      >
                        {copiedKey === "sha256" ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] break-all select-all text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
                      {result.receipt.media.sha256}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">pHash:</span>
                    <span>{result.receipt.media.pHash}</span>
                  </div>
                  {result.receipt.watermark.trustmarkId && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Watermark:</span>
                      <span>{result.receipt.watermark.trustmarkId}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Timestamp:</span>
                    <span>{result.receipt.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Algorithm:</span>
                    <span>{result.receipt.signer.algorithm} {result.receipt.signer.namedCurve}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Explanatory Notice explaining local proof vs on-chain record */}
            <div className="rounded-lg bg-zinc-100/70 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 p-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                <ShieldCheck className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                <span>Client-Side Cryptographic Proof</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This receipt proves local authorship and content integrity via ECDSA P-256 public-key cryptography. It is stored on your device and is <strong>not published to the public blockchain registry</strong> (preserving creator privacy and zero gas fees). To register an on-chain verdict, an allowlisted attester must evaluate the image via EAS.
              </p>
            </div>

            {/* Action buttons after verification */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Verify Another Receipt</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-1.5 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Footer (when not tested) */}
        {!result.tested && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}