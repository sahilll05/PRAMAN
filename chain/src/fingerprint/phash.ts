/**
 * spec §4 / spec/FINGERPRINT.md Perceptual Hash (pHash) implementation in TypeScript.
 *
 * Normative specification:
 * 1. Decode image to RGB.
 * 2. Convert to grayscale luma: Y = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601).
 * 3. Resize to 32x32 using box (area-average) filter.
 * 4. Apply 2D DCT-II to the 32x32 float matrix.
 * 5. Take the top-left 8x8 sub-matrix (64 coefficients, DC at [0,0]).
 * 6. Compute the median of the 63 non-DC coefficients (exclude [0,0]).
 * 7. In row-major order: bit = 1 if coef > median else 0. Position 0 (DC bit) is always 0.
 * 8. Pack 64 bits big-endian into a uint64 (BigInt).
 */

// Precomputed 32x32 DCT-II cosine table
// cosTable[k][n] = 2.0 * cos((pi * k * (2 * n + 1)) / 64)
const COS_TABLE: number[][] = Array.from({ length: 32 }, (_, k) =>
  Array.from({ length: 32 }, (_, n) =>
    2.0 * Math.cos((Math.PI * k * (2.0 * n + 1.0)) / 64.0)
  )
);

/**
 * Resize arbitrary dimensions to 32x32 grayscale luma matrix using box (area-average) filter.
 */
export function boxResizeToLuma32x32(
  rgb: Uint8Array | number[],
  width: number,
  height: number
): number[][] {
  const result: number[][] = Array.from({ length: 32 }, () => new Array(32).fill(0));

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
          const idx = (y * width + x) * 3;
          const rVal = rgb[idx] ?? 0;
          const gVal = rgb[idx + 1] ?? 0;
          const bVal = rgb[idx + 2] ?? 0;

          // ITU-R BT.601 luma
          const luma = 0.299 * rVal + 0.587 * gVal + 0.114 * bVal;
          weightedLuma += luma * weight;
          totalWeight += weight;
        }
      }

      const resRow = result[r];
      if (resRow) {
        resRow[c] = totalWeight > 0 ? weightedLuma / totalWeight : 0;
      }
    }
  }

  return result;
}

/**
 * Compute 2D DCT-II top-left 8x8 submatrix from a 32x32 matrix.
 */
export function computeDct8x8(matrix32x32: number[][]): number[][] {
  // Step 1: 1D DCT-II along columns (across row dimension)
  const intermediate: number[][] = Array.from({ length: 32 }, () => new Array(8).fill(0));
  for (let r = 0; r < 32; r++) {
    const row = matrix32x32[r];
    const interRow = intermediate[r];
    if (!row || !interRow) continue;

    for (let k2 = 0; k2 < 8; k2++) {
      let sum = 0.0;
      const cosRow = COS_TABLE[k2];
      if (!cosRow) continue;

      for (let n = 0; n < 32; n++) {
        const val = row[n] ?? 0;
        const cosVal = cosRow[n] ?? 0;
        sum += val * cosVal;
      }
      interRow[k2] = sum;
    }
  }

  // Step 2: 1D DCT-II along rows (across column dimension) for k1 = 0..7
  const dct8x8: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0));
  for (let k1 = 0; k1 < 8; k1++) {
    const cosRow = COS_TABLE[k1];
    const outRow = dct8x8[k1];
    if (!cosRow || !outRow) continue;

    for (let k2 = 0; k2 < 8; k2++) {
      let sum = 0.0;
      for (let n = 0; n < 32; n++) {
        const interVal = intermediate[n]?.[k2] ?? 0;
        const cosVal = cosRow[n] ?? 0;
        sum += interVal * cosVal;
      }
      // Snap numerical rounding residue around zero
      if (Math.abs(sum) < 1e-9) {
        sum = 0.0;
      }
      outRow[k2] = sum;
    }
  }

  return dct8x8;
}

/**
 * Compute 64-bit pHash as BigInt from a 32x32 float/luma matrix.
 */
export function computePhashFromMatrix(matrix32x32: number[][]): bigint {
  const dct8x8 = computeDct8x8(matrix32x32);

  // Collect 63 AC coefficients (exclude [0,0])
  const acCoeffs: number[] = [];
  const row0 = dct8x8[0];
  if (row0) {
    for (let c = 1; c < 8; c++) {
      const v = row0[c];
      if (v !== undefined) acCoeffs.push(v);
    }
  }
  for (let r = 1; r < 8; r++) {
    const rowR = dct8x8[r];
    if (!rowR) continue;
    for (let c = 0; c < 8; c++) {
      const v = rowR[c];
      if (v !== undefined) acCoeffs.push(v);
    }
  }

  // Sort to find median of 63 values (element at index 31)
  const sorted = [...acCoeffs].sort((a, b) => a - b);
  const median = sorted[31] ?? 0;

  // Construct 64-bit integer
  let phash = 0n;
  for (let r = 0; r < 8; r++) {
    const rowR = dct8x8[r];
    for (let c = 0; c < 8; c++) {
      if (r === 0 && c === 0) {
        // DC bit is always 0
        phash = (phash << 1n) | 0n;
      } else {
        const coef = rowR?.[c] ?? 0;
        const bit = coef > median ? 1n : 0n;
        phash = (phash << 1n) | bit;
      }
    }
  }

  return phash;
}

/**
 * Compute 64-bit pHash from raw RGB buffer (stride 3).
 */
export function computePhashFromRgb(
  rgb: Uint8Array | number[],
  width: number,
  height: number
): bigint {
  const matrix = boxResizeToLuma32x32(rgb, width, height);
  return computePhashFromMatrix(matrix);
}

/**
 * Compute Hamming distance between two 64-bit hashes.
 */
export function hammingDistance(hash1: bigint, hash2: bigint): number {
  let x = (hash1 ^ hash2) & 0xffffffffffffffffn;
  let count = 0;
  while (x > 0n) {
    x &= x - 1n;
    count++;
  }
  return count;
}

/**
 * Convert BigInt to 16-character lowercase hex string without '0x'.
 */
export function bigIntToHex(val: bigint): string {
  const hex = (val & 0xffffffffffffffffn).toString(16);
  return hex.padStart(16, "0");
}

/**
 * Convert hex string to 64-bit BigInt.
 */
export function hexToBigInt(hexStr: string): bigint {
  const clean = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  return BigInt("0x" + clean);
}
