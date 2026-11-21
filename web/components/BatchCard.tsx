"use client";

import { useState, useRef } from "react";
import {
  BatchItemResult,
  processBatchImages,
  extractImagesFromZip,
  downloadAuditReport,
} from "@/lib/batch";

export function BatchCard() {
  const [items, setItems] = useState<BatchItemResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Handle incoming files (images or zip)
  async function handleFiles(fileList: FileList | File[]) {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setProcessing(true);
    setProgress({ done: 0, total: rawFiles.length });

    try {
      const allImageFiles: File[] = [];

      for (const f of rawFiles) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          // Extract zip
          const extracted = await extractImagesFromZip(f);
          allImageFiles.push(...extracted);
        } else if (/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name)) {
          allImageFiles.push(f);
        }
      }

      if (allImageFiles.length === 0) {
        alert("No supported images found in dropped files/archives.");
        setProcessing(false);
        return;
      }

      setProgress({ done: 0, total: allImageFiles.length });

      const results = await processBatchImages(
        allImageFiles,
        (done, total) => setProgress({ done, total }),
        4
      );

      setItems(results);
    } catch (err: any) {
      alert(`Batch processing error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  const total = items.length;
  const foundCount = items.filter((i) => i.found).length;
  const notFoundCount = total - foundCount;

  return (
    <div className="w-full space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-zinc-300 bg-zinc-900/60"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/30"
        }`}
        onClick={() => !processing && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300">
            <svg
              className="w-6 h-6 stroke-zinc-300"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 16l3-3 2 2 5-5" />
              <circle cx="8" cy="8" r="1.5" />
            </svg>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-200">
              Drop multiple images, a folder, or a ZIP archive
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Supports PNG, JPEG, WEBP · Parallel in-browser fingerprinting · Zero media upload
            </div>
          </div>

          {/* Action buttons inside dropzone */}
          <div
            className="flex flex-wrap items-center justify-center gap-2 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded text-xs border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Select Images
            </button>
            <button
              disabled={processing}
              onClick={() => folderInputRef.current?.click()}
              className="px-3 py-1.5 rounded text-xs border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Select Folder
            </button>
            <button
              disabled={processing}
              onClick={() => zipInputRef.current?.click()}
              className="px-3 py-1.5 rounded text-xs border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Select ZIP Archive
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar (during processing) */}
      {processing && (
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Fingerprinting locally in browser...</span>
            <span className="font-mono text-zinc-200">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-100 transition-all duration-150"
              style={{
                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            🛡️ Claim C14: Media never leaves your browser. Only hashes are sent for status lookup.
          </div>
        </div>
      )}

      {/* Results Section */}
      {items.length > 0 && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded border border-zinc-800 bg-zinc-950">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Total Processed</div>
              <div className="text-xl font-semibold text-zinc-100 mt-0.5">{total}</div>
            </div>
            <div className="p-3 rounded border border-zinc-800 bg-zinc-950">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">On-Chain Attested</div>
              <div className="text-xl font-semibold text-zinc-100 mt-0.5">{foundCount}</div>
            </div>
            <div className="p-3 rounded border border-zinc-800 bg-zinc-950">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">No Record Found</div>
              <div className="text-xl font-semibold text-zinc-100 mt-0.5">{notFoundCount}</div>
            </div>
            <div className="p-3 rounded border border-zinc-800 bg-zinc-950">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Privacy Status</div>
              <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center gap-1">
                <span>🛡️</span>
                <span>Zero Uploads</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-zinc-800 bg-zinc-950">
            <div className="text-xs text-zinc-400">
              Generated {items.length} cryptographic audit records
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadAuditReport(items)}
                className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>Download Audit Report (.html)</span>
              </button>
              <button
                onClick={() => setItems([])}
                className="px-3 py-1.5 rounded text-xs border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-zinc-800 overflow-x-auto bg-zinc-950">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900/60 border-b border-zinc-800 text-[11px] text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">File</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">SHA-256</th>
                  <th className="py-2.5 px-3">pHash</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Likelihood</th>
                  <th className="py-2.5 px-3 text-right">EAS Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-zinc-900/30">
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-zinc-200 max-w-[160px] truncate" title={it.filename}>
                      {it.filename}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
                          it.verdictStatus === "ACTIVE"
                            ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                            : it.verdictStatus === "MODEL_DEGRADED" || it.verdictStatus === "SUPERSEDED"
                            ? "bg-zinc-900 text-zinc-300 border-zinc-600"
                            : it.verdictStatus === "REVOKED"
                            ? "bg-stone-900 text-stone-300 border-stone-700"
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                        }`}
                      >
                        {it.verdictStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 text-[11px]" title={it.sha256}>
                      {it.sha256 ? `${it.sha256.slice(0, 8)}...${it.sha256.slice(-6)}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 text-[11px]">
                      {it.phash || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      {it.modelName || (it.modelId ? it.modelId.slice(0, 10) : "—")}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-200">
                      {it.score !== undefined ? `${(it.score * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {it.attestationUid ? (
                        <a
                          href={`/verdicts/${it.attestationUid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-zinc-300 hover:text-white underline decoration-zinc-700"
                        >
                          0x...{it.attestationUid.slice(-6)}
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
