/**
 * extension/src/fingerprint.ts — Browser-side cryptographic & perceptual fingerprinting (T10.2).
 *
 * Implements:
 * 1. SHA-256 via Web Crypto SubtleCrypto (zero external dependency, 100% native).
 * 2. Spec §4 64-bit pHash (identical to chain/src/fingerprint/phash.ts and web/lib/fingerprint.ts).
 *
 * PRIVACY GUARANTEE (Claim C9):
 * All fingerprinting is executed 100% client-side in the browser service worker or content script.
 * Zero image bytes are ever transmitted over the network.
 */

/** Compute hex-encoded SHA-256 string from an ArrayBuffer or Uint8Array using Web Crypto. */
export async function computeSha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const data = buffer instanceof Uint8Array ? (buffer as unknown as BufferSource) : buffer;
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Precomputed 32x32 DCT-II cosine table: cosTable[k][n] = 2 * cos(π*k*(2n+1) / 64) */
export const COS_TABLE: number[][] = Array.from({ length: 32 }, (_, k) =>
  Array.from({ length: 32 }, (_, n) => 2.0 * Math.cos((Math.PI * k * (2.0 * n + 1.0)) / 64.0))
);

/** Box (area-average) resize arbitrary RGB bitmap to 32×32 luma matrix per spec §4. */
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
          const idx = (y * width + x) * 4; // RGBA
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

/** Compute 2D DCT-II top-left 8×8 submatrix from a 32×32 luma matrix per spec §4. */
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

/** Compute canonical 64-bit pHash BigInt from 32×32 luma matrix per spec §4. */
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

/** Convert BigInt to 16-char hex string (no 0x prefix). */
export function bigIntToHex16(val: bigint): string {
  return (val & 0xffffffffffffffffn).toString(16).padStart(16, "0");
}

/** Decode an image Blob into raw RGBA pixels via OffscreenCanvas or Image element. */
export async function extractPixelsFromBlob(
  blob: Blob
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
  // Path A: Modern browser / Service Worker environment (OffscreenCanvas + createImageBitmap)
  if (typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function") {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire OffscreenCanvas 2D context");
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    return { pixels: imageData.data, width: bitmap.width, height: bitmap.height };
  }

  // Path B: DOM Window environment fallback (HTMLCanvasElement)
  if (typeof document !== "undefined" && typeof Image !== "undefined") {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not acquire Canvas 2D context"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve({ pixels: imageData.data, width: canvas.width, height: canvas.height });
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image in DOM"));
      };
      img.src = url;
    });
  }

  throw new Error("No pixel decoding environment (neither OffscreenCanvas nor DOM Image available)");
}

/** Full fingerprinting pipeline for an image Blob: computes both SHA-256 and 64-bit pHash hex. */
export async function fingerprintImageBlob(
  blob: Blob
): Promise<{ sha256: string; phash: string }> {
  const buffer = await blob.arrayBuffer();
  const sha256 = await computeSha256(buffer);

  const { pixels, width, height } = await extractPixelsFromBlob(blob);
  const luma = boxResizeToLuma32x32(pixels, width, height);
  const phashBigInt = computePhashFromMatrix(luma);
  const phash = bigIntToHex16(phashBigInt);

  return { sha256, phash };
}
