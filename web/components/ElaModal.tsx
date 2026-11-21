"use client";

import { useState, useEffect } from "react";
import { computeEla, ElaResult } from "@/lib/ela";

interface ElaModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile?: File | null;
  imageSrc?: string | null;
}

export function ElaModal({ isOpen, onClose, imageFile, imageSrc }: ElaModalProps) {
  const [elaResult, setElaResult] = useState<ElaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState<number>(10);
  const [blend, setBlend] = useState<number>(100); // 0 = 100% original, 100 = 100% ELA
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (!imageFile && !imageSrc)) {
      setElaResult(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const source = imageFile || (imageSrc ? imageSrc : null);
    if (!source) {
      setLoading(false);
      return;
    }

    // Load and compute ELA client-side
    (async () => {
      try {
        let input: File | Blob | HTMLImageElement;
        if (imageFile) {
          input = imageFile;
        } else {
          // If imageSrc is a URL or data URL
          const resp = await fetch(imageSrc!);
          input = await resp.blob();
        }

        const res = await computeEla(input, 0.85, scale);
        if (isMounted) {
          setElaResult(res);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to compute Error Level Analysis");
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageFile, imageSrc, scale]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ela-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-6 text-zinc-100 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-mono text-xs">🔬</span>
            <h2 id="ela-dialog-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              Error Level Analysis (ELA) Inspector
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400">
              Q=85 · {scale}x Scale
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-900 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin" />
            <span className="text-xs">Computing pixel re-compression differences locally in browser...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400">
            Error: {error}
          </div>
        ) : elaResult ? (
          <div className="space-y-4">
            {/* Image Viewer with Blend Slider */}
            <div className="relative w-full aspect-video max-h-[380px] bg-zinc-900/70 border border-zinc-800 rounded flex items-center justify-center overflow-hidden">
              {/* Original Image Base */}
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Original"
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {/* ELA Overlay */}
              <img
                src={elaResult.elaDataUrl}
                alt="ELA Heatmap"
                className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-75"
                style={{ opacity: blend / 100 }}
              />
            </div>

            {/* Blend & Scale Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded">
              {/* Blend Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Overlay Blend</span>
                  <span className="font-mono text-zinc-200">{blend}% ELA</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={blend}
                  onChange={(e) => setBlend(Number(e.target.value))}
                  className="w-full accent-zinc-200 bg-zinc-800 h-1 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Original</span>
                  <span>Heatmap</span>
                </div>
              </div>

              {/* Amplification Multiplier */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Amplification Scale</span>
                  <span className="font-mono text-zinc-200">{scale}x</span>
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  {[5, 10, 15, 20].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScale(s)}
                      className={`flex-1 py-1 rounded text-xs font-mono transition-colors border ${
                        scale === s
                          ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-medium"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-zinc-900/50 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Peak Anomaly</div>
                <div className="font-mono text-zinc-100 font-medium mt-0.5">{elaResult.maxDiff} / 255</div>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Mean Error Level</div>
                <div className="font-mono text-zinc-100 font-medium mt-0.5">{elaResult.meanDiff.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded bg-zinc-900/50 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Dimensions</div>
                <div className="font-mono text-zinc-100 font-medium mt-0.5">
                  {elaResult.width} × {elaResult.height}
                </div>
              </div>
            </div>

            {/* Mandatory Forensic Disclosure (claims.md) */}
            <div className="p-3 rounded border border-zinc-800/80 bg-zinc-900/40 text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                <span>⚠️</span>
                <span>Forensic Interpretation Note</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Error Level Analysis highlights compression discrepancy across pixel blocks. High-contrast edges and synthetic textures naturally exhibit higher error.
                <strong className="text-zinc-300"> ELA is a visual hint, not a forensic ruling. Uniform re-saves may erase this signal.</strong>
              </p>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 flex items-center gap-1">
                <span>🛡️</span>
                <span>Computed 100% locally in your browser session via Canvas API. Zero network requests made.</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
