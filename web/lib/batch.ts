/**
 * web/lib/batch.ts — Batch Verification & Local HTML Audit Report Generator (T10.3).
 *
 * PRIVACY GUARANTEE (Claim C14):
 * All image fingerprinting runs 100% locally in the client browser.
 * Only SHA-256 and pHash strings are sent to the indexer API for status lookup.
 * ZERO media bytes ever reach any server.
 */

import JSZip from "jszip";
import { computeFileFingerprint } from "./fingerprint";

export type BatchVerdictStatus =
  | "ACTIVE"
  | "CHALLENGED"
  | "UPHELD_CHALLENGE"
  | "MODEL_DEGRADED"
  | "SUPERSEDED"
  | "REVOKED"
  | "EXPIRED"
  | "NO_VERDICTS_FOUND";

export interface BatchItemResult {
  id: string;
  file?: File;
  filename: string;
  size: number;
  sha256: string;
  phash: string;
  found: boolean;
  verdictStatus: BatchVerdictStatus;
  score?: number;
  modelName?: string;
  modelId?: string;
  attester?: string;
  attestationUid?: string;
  timestamp?: number;
  error?: string;
}

/** Status priority per spec §6 */
const STATUS_PRIORITY: Record<string, number> = {
  REVOKED: 70,
  SUPERSEDED: 60,
  UPHELD_CHALLENGE: 50,
  EXPIRED: 40,
  MODEL_DEGRADED: 30,
  CHALLENGED: 20,
  ACTIVE: 10,
  NO_VERDICTS_FOUND: 0,
};

/** Extract all image files from a dropped ZIP archive */
export async function extractImagesFromZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const imageFiles: File[] = [];

  const validExts = /\.(png|jpe?g|webp|bmp|gif)$/i;

  for (const [filename, fileEntry] of Object.entries(zip.files)) {
    if (fileEntry.dir) continue;
    // Skip macOS metadata files
    if (filename.startsWith("__MACOSX/") || filename.includes("/.")) continue;

    if (validExts.test(filename)) {
      const blob = await fileEntry.async("blob");
      const cleanName = filename.split("/").pop() || filename;
      const file = new File([blob], cleanName, { type: blob.type || "image/jpeg" });
      imageFiles.push(file);
    }
  }

  return imageFiles;
}

/**
 * Fingerprint and query an array of images with concurrency limit.
 * Concurrency limit (default 4) prevents browser thread contention while delivering fast throughput.
 */
export async function processBatchImages(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  concurrency: number = 4
): Promise<BatchItemResult[]> {
  const total = files.length;
  let completed = 0;
  const results: BatchItemResult[] = new Array(total);

  // Step 1: Client-side fingerprinting with worker-style pool
  const chunks: Array<{ file: File; index: number }> = files.map((file, index) => ({ file, index }));
  const activeWorkers: Promise<void>[] = [];

  let nextIdx = 0;
  async function worker() {
    while (nextIdx < chunks.length) {
      const current = chunks[nextIdx++];
      if (!current) break;
      const { file, index } = current;

      try {
        const fp = await computeFileFingerprint(file);
        results[index] = {
          id: `batch-${index}-${Date.now()}`,
          file,
          filename: file.name,
          size: file.size,
          sha256: fp.sha256Hex,
          phash: fp.pHashHex,
          found: false,
          verdictStatus: "NO_VERDICTS_FOUND",
        };
      } catch (err: any) {
        results[index] = {
          id: `batch-${index}-${Date.now()}`,
          file,
          filename: file.name,
          size: file.size,
          sha256: "",
          phash: "",
          found: false,
          verdictStatus: "NO_VERDICTS_FOUND",
          error: err.message || "Failed to fingerprint image",
        };
      }

      completed++;
      if (onProgress) onProgress(completed, total);
    }
  }

  for (let w = 0; w < Math.min(concurrency, total); w++) {
    activeWorkers.push(worker());
  }
  await Promise.all(activeWorkers);

  // Step 2: Query Indexer API in batches of up to 50 items (hashes only!)
  const validItems = results.filter((r) => r.sha256);
  if (validItems.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batchSlice = validItems.slice(i, i + BATCH_SIZE);
      try {
        const resp = await fetch("/api/verdicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: batchSlice.map((item) => ({
              id: item.id,
              sha256: item.sha256,
              phash: item.phash,
            })),
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const queryResults: any[] = data.results || [];

          for (const qr of queryResults) {
            const target = results.find((r) => r.id === qr.id);
            if (!target) continue;

            target.found = qr.found;
            if (qr.found && qr.verdicts && qr.verdicts.length > 0) {
              // Find highest priority status
              let maxStatus: BatchVerdictStatus = "ACTIVE";
              let maxP = 0;
              let topVerdict: any = qr.verdicts[0];

              for (const v of qr.verdicts) {
                const p = STATUS_PRIORITY[v.status] ?? 0;
                if (p > maxP) {
                  maxP = p;
                  maxStatus = v.status as BatchVerdictStatus;
                  topVerdict = v;
                }
              }

              target.verdictStatus = maxStatus;
              target.score = topVerdict.score;
              target.modelName = topVerdict.modelName;
              target.modelId = topVerdict.modelId;
              target.attester = topVerdict.attester;
              target.attestationUid = topVerdict.uid || topVerdict.attestationUid;
              target.timestamp = topVerdict.timestamp;
            } else {
              target.verdictStatus = "NO_VERDICTS_FOUND";
            }
          }
        }
      } catch {
        // Fallback gracefully; items remain NO_VERDICTS_FOUND
      }
    }
  }

  return results;
}

/**
 * Generate a standalone, self-contained HTML5 "Authenticity Audit Report".
 * Contains embedded styling, SVG icons, statistics, and verifiable records.
 * Zero external script or network dependencies (valid W3C HTML5).
 */
export function generateAuditReportHtml(
  items: BatchItemResult[],
  metadata?: { generatedAt?: string; durationSeconds?: number }
): string {
  const generatedAt = metadata?.generatedAt || new Date().toISOString();
  const total = items.length;
  const verifiedCount = items.filter((i) => i.found).length;
  const unrecordedCount = total - verifiedCount;

  const activeCount = items.filter((i) => i.verdictStatus === "ACTIVE").length;
  const degradedCount = items.filter((i) => i.verdictStatus === "MODEL_DEGRADED" || i.verdictStatus === "SUPERSEDED").length;
  const revokedCount = items.filter((i) => i.verdictStatus === "REVOKED").length;

  const rows = items
    .map((item, idx) => {
      const shaShort = item.sha256 ? `${item.sha256.slice(0, 10)}...${item.sha256.slice(-8)}` : "—";
      const scoreStr = item.score !== undefined ? `${(item.score * 100).toFixed(1)}%` : "—";
      const statusClass =
        item.verdictStatus === "ACTIVE"
          ? "status-active"
          : item.verdictStatus === "MODEL_DEGRADED" || item.verdictStatus === "SUPERSEDED"
          ? "status-warn"
          : item.verdictStatus === "REVOKED"
          ? "status-revoked"
          : "status-none";

      return `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-name" title="${item.filename}">${item.filename}</td>
        <td class="col-status"><span class="badge ${statusClass}">${item.verdictStatus.replaceAll("_", " ")}</span></td>
        <td class="col-hash" title="${item.sha256}">${shaShort}</td>
        <td class="col-hash">${item.phash || "—"}</td>
        <td class="col-model">${item.modelName || item.modelId || "—"}</td>
        <td class="col-score">${scoreStr}</td>
        <td class="col-uid">${item.attestationUid ? `<a href="http://localhost:3000/verdicts/${item.attestationUid}" target="_blank">0x...${item.attestationUid.slice(-6)}</a>` : "—"}</td>
      </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PRAMANA प्रमाण — Authenticity Audit Report</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #121214;
      --border: #27272a;
      --border-subtle: #1f1f23;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --badge-bg: #18181b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo { width: 28px; height: 28px; stroke: #fafafa; }
    .title { font-size: 18px; font-weight: 600; letter-spacing: 0.05em; color: #fafafa; }
    .sanskrit { font-size: 15px; color: var(--text-muted); margin-left: 4px; }
    .meta-date { font-size: 12px; color: var(--text-dim); }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 14px 18px;
    }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 4px; }
    .stat-val { font-size: 22px; font-weight: 600; color: #fafafa; }
    .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    th {
      background: #18181b;
      color: var(--text-muted);
      font-weight: 500;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); color: var(--text); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .col-num { width: 40px; color: var(--text-dim); }
    .col-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .col-hash { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: var(--text-muted); }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--badge-bg);
    }
    .status-active { color: #fafafa; border-color: #3f3f46; }
    .status-warn { color: #e4e4e7; border-color: #52525b; }
    .status-revoked { color: #d6d3d1; border-color: #44403c; }
    .status-none { color: var(--text-dim); border-color: var(--border-subtle); }
    a { color: #fafafa; text-decoration: none; border-bottom: 1px dotted var(--text-dim); }
    a:hover { border-bottom-style: solid; }
    .disclaimer-card {
      background: var(--card-bg);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 14px 18px;
      font-size: 11px;
      color: var(--text-dim);
      line-height: 1.6;
    }
    .privacy-tag { color: var(--text-muted); font-weight: 500; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <svg class="logo" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#fafafa" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="4" stroke="#fafafa" stroke-width="1.5"/>
          <line x1="12" y1="3" x2="12" y2="7" stroke="#fafafa" stroke-width="1.5"/>
          <line x1="12" y1="17" x2="12" y2="21" stroke="#fafafa" stroke-width="1.5"/>
          <line x1="3" y1="12" x2="7" y2="12" stroke="#fafafa" stroke-width="1.5"/>
          <line x1="17" y1="12" x2="21" y2="12" stroke="#fafafa" stroke-width="1.5"/>
        </svg>
        <div>
          <span class="title">PRAMANA</span>
          <span class="sanskrit">प्रमाण</span>
          <div style="font-size: 11px; color: var(--text-dim);">Authenticity Audit Report · Testnet v0.1.0-draft</div>
        </div>
      </div>
      <div class="meta-date">Generated: ${new Date(generatedAt).toLocaleString()}</div>
    </div>

    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-label">Total Media Evaluated</div>
        <div class="stat-val">${total}</div>
        <div class="stat-sub">100% processed locally in-browser</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">On-Chain Attestations Found</div>
        <div class="stat-val">${verifiedCount}</div>
        <div class="stat-sub">${((verifiedCount / (total || 1)) * 100).toFixed(1)}% registered on EAS</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">No Record Found</div>
        <div class="stat-val">${unrecordedCount}</div>
        <div class="stat-sub">Not evaluated by registered attesters</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Status Breakdown</div>
        <div class="stat-val" style="font-size: 15px; margin-top: 6px;">
          Active: ${activeCount} · Warn: ${degradedCount} · Revoked: ${revokedCount}
        </div>
        <div class="stat-sub">Spec §6 status priority resolved</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Filename</th>
            <th>Status</th>
            <th>SHA-256</th>
            <th>pHash (64-bit)</th>
            <th>Model</th>
            <th>Likelihood</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="disclaimer-card">
      <div class="privacy-tag">🛡️ PRIVACY GUARANTEE (Claim C9 &amp; C14)</div>
      <div>All image fingerprinting (SHA-256 and perceptual pHash) was computed 100% locally on your device using Web Crypto and Canvas APIs. Raw image bytes never left the browser session.</div>
      <div style="margin-top: 8px;"><strong>Forensic Limitation Disclosure:</strong> Model-assessed likelihood scores represent algorithmic assessment, not a legal or forensic ruling. An absent on-chain record does not prove authenticity — it indicates the media was not previously attested by registered nodes. See limitations at https://pramana.local/limitations.</div>
    </div>
  </div>
</body>
</html>`;
}

/** Trigger download of the HTML audit report in the browser */
export function downloadAuditReport(items: BatchItemResult[], filename?: string): void {
  const html = generateAuditReportHtml(items);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `pramana-audit-report-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
