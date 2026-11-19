/**
 * web/lib/fingerprint.ts — Browser-side SHA-256 and pHash computation (T6.1).
 *
 * Uses hash-wasm for streaming SHA-256 (no data leaves the browser).
 * pHash uses the canonical spec §4 algorithm implemented in chain/src/fingerprint/phash.ts
 * (duplicated here for browser-side use; kept in sync via golden vector tests).
 *
 * PRIVACY: This module only reads local File bytes. Nothing is uploaded.
 */

import { createSHA256 } from "hash-wasm";

/** Streaming SHA-256 hash of an ArrayBuffer in chunks (memory-efficient for large files). */
export async function sha256File(file: File): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();

  const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buf = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buf));
    offset += CHUNK_SIZE;
  }
  return hasher.digest("hex");
}

/** Convert hex string to 0x-prefixed bytes32 string. */
export function hexToBytes32(hex: string): `0x${string}` {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${clean.padStart(64, "0")}`;
}

// ─── Spec §4 pHash (browser-side, matches chain/src/fingerprint/phash.ts) ───

/** Precomputed 32x32 DCT-II cosine table: cosTable[k][n] = 2 * cos(π*k*(2n+1) / 64) */
const COS_TABLE: number[][] = Array.from({ length: 32 }, (_, k) =>
  Array.from({ length: 32 }, (_, n) => 2.0 * Math.cos((Math.PI * k * (2.0 * n + 1.0)) / 64.0))
);

/** Box (area-average) resize arbitrary RGB bitmap to 32×32 luma matrix. */
export function boxResizeToLuma32x32(
  rgb: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number
): number[][] {
  const result: number[][] = Array.from({ length: 32 }, () => new Array<number>(32).fill(0));
  const yStep = height / 32.0;
  const xStep = width / 32.0;

  for (let r = 0; r < 32; r++) {
    const yStart = r * yStep;
    const yEnd = (r + 1) * yStep;
    const y0 = Math.floor(yStart);
    const y1 = Math.min(height, Math.ceil(yEnd));
    for (let c = 0; c < 32; c++) {
      const xStart = c * xStep;
      const xEnd = (c + 1) * xStep;
      const x0 = Math.floor(xStart);
      const x1 = Math.min(width, Math.ceil(xEnd));
      let totalWeight = 0.0;
      let weightedLuma = 0.0;
      for (let y = y0; y < y1; y++) {
        const yWeight = Math.min(y + 1, yEnd) - Math.max(y, yStart);
        if (yWeight <= 0) continue;
        for (let x = x0; x < x1; x++) {
          const xWeight = Math.min(x + 1, xEnd) - Math.max(x, xStart);
          if (xWeight <= 0) continue;
          const weight = yWeight * xWeight;
          const idx = (y * width + x) * 4; // RGBA from canvas
          const rVal = rgb[idx] ?? 0;
          const gVal = rgb[idx + 1] ?? 0;
          const bVal = rgb[idx + 2] ?? 0;
          weightedLuma += (0.299 * rVal + 0.587 * gVal + 0.114 * bVal) * weight;
          totalWeight += weight;
        }
      }
      const resRow = result[r];
      if (resRow) resRow[c] = totalWeight > 0 ? weightedLuma / totalWeight : 0;
    }
  }
  return result;
}

/** Compute 2D DCT-II top-left 8×8 submatrix from a 32×32 luma matrix. */
export function computeDct8x8(matrix: number[][]): number[][] {
  const intermediate: number[][] = Array.from({ length: 32 }, () => new Array<number>(8).fill(0));
  for (let r = 0; r < 32; r++) {
    const row = matrix[r];
    const interRow = intermediate[r];
    if (!row || !interRow) continue;
    for (let k2 = 0; k2 < 8; k2++) {
      let sum = 0.0;
      const cosRow = COS_TABLE[k2];
      if (!cosRow) continue;
      for (let n = 0; n < 32; n++) sum += (row[n] ?? 0) * (cosRow[n] ?? 0);
      interRow[k2] = sum;
    }
  }
  const dct8x8: number[][] = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  for (let k1 = 0; k1 < 8; k1++) {
    const cosRow = COS_TABLE[k1];
    const outRow = dct8x8[k1];
    if (!cosRow || !outRow) continue;
    for (let k2 = 0; k2 < 8; k2++) {
      let sum = 0.0;
      for (let n = 0; n < 32; n++) sum += (intermediate[n]?.[k2] ?? 0) * (cosRow[n] ?? 0);
      outRow[k2] = Math.abs(sum) < 1e-9 ? 0.0 : sum;
    }
  }
  return dct8x8;
}

/** Compute canonical 64-bit pHash BigInt from 32×32 luma matrix. */
export function computePhashFromMatrix(matrix: number[][]): bigint {
  const dct8x8 = computeDct8x8(matrix);
  const acCoeffs: number[] = [];
  const row0 = dct8x8[0];
  if (row0) for (let c = 1; c < 8; c++) { const v = row0[c]; if (v !== undefined) acCoeffs.push(v); }
  for (let r = 1; r < 8; r++) {
    const rowR = dct8x8[r];
    if (!rowR) continue;
    for (let c = 0; c < 8; c++) { const v = rowR[c]; if (v !== undefined) acCoeffs.push(v); }
  }
  const sorted = [...acCoeffs].sort((a, b) => a - b);
  const median = sorted[31] ?? 0;
  let phash = 0n;
  for (let r = 0; r < 8; r++) {
    const rowR = dct8x8[r];
    for (let c = 0; c < 8; c++) {
      if (r === 0 && c === 0) { phash = (phash << 1n) | 0n; }
      else { phash = (phash << 1n) | ((rowR?.[c] ?? 0) > median ? 1n : 0n); }
    }
  }
  return phash;
}

/** Compute pHash from an ImageData (from canvas). */
export function computePhashFromImageData(imageData: ImageData): bigint {
  const matrix = boxResizeToLuma32x32(imageData.data, imageData.width, imageData.height);
  return computePhashFromMatrix(matrix);
}

/** Hamming distance between two 64-bit hashes. */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = (a ^ b) & 0xffffffffffffffffn;
  let count = 0;
  while (x > 0n) { x &= x - 1n; count++; }
  return count;
}

/** Convert BigInt to 16-char hex string (no 0x prefix). */
export function bigIntToHex16(val: bigint): string {
  return (val & 0xffffffffffffffffn).toString(16).padStart(16, "0");
}

export interface FingerprintResult {
  sha256Hex: string;
  sha256Bytes32: `0x${string}`;
  pHashBigInt: bigint;
  pHashHex: string;
}

/**
 * Compute SHA-256 and pHash from a File, entirely in the browser.
 * PRIVACY GUARANTEE: File bytes are never uploaded; computation is local.
 */
export async function computeFileFingerprint(file: File): Promise<FingerprintResult> {
  // 1. SHA-256 (streaming, hash-wasm)
  const sha256Hex = await sha256File(file);

  // 2. pHash: decode image using OffscreenCanvas / createImageBitmap
  let pHashBigInt = 0n;
  try {
    const buf = await file.arrayBuffer();
    const blob = new Blob([buf], { type: file.type || "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    pHashBigInt = computePhashFromImageData(imgData);
    bitmap.close();
  } catch {
    // pHash not available in some test environments (non-browser)
    pHashBigInt = 0n;
  }

  return {
    sha256Hex,
    sha256Bytes32: hexToBytes32(sha256Hex),
    pHashBigInt,
    pHashHex: bigIntToHex16(pHashBigInt),
  };
}
