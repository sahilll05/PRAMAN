/**
 * web/lib/watermark.ts — PRAMANA Browser-Side Watermark Engine (Task T10.1b).
 *
 * Implements high-fidelity, imperceptible digital watermarking in pure TypeScript
 * using 8x8 block-partitioned interleaved spatial modulation (checkerboard differential)
 * and CRC-8 error detection.
 *
 * SPEC / ACCEPTANCE CRITERIA:
 * - Embeds a 40-bit watermark ID into image pixel data.
 * - Recoverable via browser decoder: extractWatermark().
 * - PSNR >= 38 dB (imperceptible to human eye; typically 44-48 dB).
 * - Receipt updated with watermark: { status: "embedded", trustmarkId: "0x..." }.
 * - 100% Client-Side. Zero network requests.
 */

/** 16-bit Barker synchronization code to identify watermark presence */
const SYNC_WORD = 0x5a96; // 0b0101101010010110
const SYNC_BITS = 16;
const PAYLOAD_BITS = 40;
const CRC_BITS = 8;
const TOTAL_BITS = SYNC_BITS + PAYLOAD_BITS + CRC_BITS; // 64 bits = 8x8 grid

const GRID_COLS = 8;
const GRID_ROWS = 8;

/** Standard CRC-8-CCITT computation (polynomial 0x07) */
export function computeCrc8(bytes: Uint8Array): number {
  let crc = 0x00;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]!;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

/** Convert 40-bit ID into a 5-byte array (big-endian) */
export function idToBytes5(id: bigint | number): Uint8Array {
  const bigId = BigInt(id) & 0xffffffffffn;
  const bytes = new Uint8Array(5);
  for (let i = 0; i < 5; i++) {
    bytes[4 - i] = Number((bigId >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

/** Convert 5-byte array back to 40-bit hex string */
export function bytes5ToHex(bytes: Uint8Array): string {
  let hex = "0x";
  for (let i = 0; i < 5; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return hex;
}

/** Pack 16-bit sync, 40-bit payload, and 8-bit CRC into a 64-bit boolean array */
export function packWatermarkBits(id: bigint | number): boolean[] {
  const payloadBytes = idToBytes5(id);
  const crc = computeCrc8(payloadBytes);

  const bits: boolean[] = new Array<boolean>(TOTAL_BITS);

  // 1. Sync bits (16)
  for (let i = 0; i < SYNC_BITS; i++) {
    bits[i] = ((SYNC_WORD >> (15 - i)) & 1) === 1;
  }

  // 2. Payload bits (40)
  for (let i = 0; i < 5; i++) {
    const byte = payloadBytes[i]!;
    for (let b = 0; b < 8; b++) {
      bits[SYNC_BITS + i * 8 + b] = ((byte >> (7 - b)) & 1) === 1;
    }
  }

  // 3. CRC bits (8)
  for (let i = 0; i < 8; i++) {
    bits[SYNC_BITS + PAYLOAD_BITS + i] = ((crc >> (7 - i)) & 1) === 1;
  }

  return bits;
}

/** Unpack and validate 64-bit sequence. Returns { valid: boolean, id?: string } */
export function unpackWatermarkBits(bits: boolean[]): { valid: boolean; id?: string } {
  if (bits.length !== TOTAL_BITS) return { valid: false };

  // 1. Check sync bits
  let sync = 0;
  for (let i = 0; i < SYNC_BITS; i++) {
    sync = (sync << 1) | (bits[i] ? 1 : 0);
  }
  if (sync !== SYNC_WORD) {
    return { valid: false };
  }

  // 2. Read payload bytes
  const payloadBytes = new Uint8Array(5);
  for (let i = 0; i < 5; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[SYNC_BITS + i * 8 + b] ? 1 : 0);
    }
    payloadBytes[i] = byte;
  }

  // 3. Read CRC
  let crc = 0;
  for (let i = 0; i < 8; i++) {
    crc = (crc << 1) | (bits[SYNC_BITS + PAYLOAD_BITS + i] ? 1 : 0);
  }

  // 4. Validate CRC
  const computedCrc = computeCrc8(payloadBytes);
  if (crc !== computedCrc) {
    return { valid: false };
  }

  return {
    valid: true,
    id: bytes5ToHex(payloadBytes),
  };
}

/** Compute Peak Signal-to-Noise Ratio (PSNR) in dB between two RGBA buffers */
export function computePsnr(
  original: Uint8ClampedArray | Uint8Array,
  modified: Uint8ClampedArray | Uint8Array
): number {
  if (original.length !== modified.length) return 0;
  let sumSq = 0;
  const numPixels = original.length / 4;
  for (let i = 0; i < original.length; i += 4) {
    const dr = original[i]! - modified[i]!;
    const dg = original[i + 1]! - modified[i + 1]!;
    const db = original[i + 2]! - modified[i + 2]!;
    sumSq += (dr * dr + dg * dg + db * db) / 3;
  }
  const mse = sumSq / numPixels;
  if (mse === 0) return 100.0;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Embeds a 40-bit watermark ID into an RGBA pixel buffer.
 * Uses interleaved checkerboard differential modulation on the Blue channel.
 *
 * @param pixels Source RGBA pixel buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param watermarkId 40-bit unsigned ID
 * @param delta Modulation amplitude (default: 2, ensuring PSNR > 45 dB)
 */
export function embedWatermark(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  watermarkId: bigint | number,
  delta: number = 2
): {
  watermarkedPixels: Uint8ClampedArray;
  psnr: number;
  watermarkIdHex: string;
} {
  const blockW = Math.floor(width / GRID_COLS);
  const blockH = Math.floor(height / GRID_ROWS);

  if (blockW < 2 || blockH < 1) {
    throw new Error(`Image resolution too low: minimum resolution is ${GRID_COLS * 2}x${GRID_ROWS}.`);
  }

  const bits = packWatermarkBits(watermarkId);
  const out = new Uint8ClampedArray(pixels.slice());

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const bitIdx = row * GRID_COLS + col;
      const targetBit = bits[bitIdx]!;

      const startX = col * blockW;
      const startY = row * blockH;

      for (let y = startY; y < startY + blockH; y++) {
        for (let x = startX; x < startX + blockW; x++) {
          const pixelIdx = (y * width + x) * 4 + 2; // Blue channel
          const currentB = out[pixelIdx]!;
          const isEven = (x + y) % 2 === 0;

          if (targetBit) {
            // Bit 1: Even pixels increased by delta, Odd pixels decreased by delta
            if (isEven) {
              out[pixelIdx] = Math.min(255, currentB + delta);
            } else {
              out[pixelIdx] = Math.max(0, currentB - delta);
            }
          } else {
            // Bit 0: Even pixels decreased by delta, Odd pixels increased by delta
            if (isEven) {
              out[pixelIdx] = Math.max(0, currentB - delta);
            } else {
              out[pixelIdx] = Math.min(255, currentB + delta);
            }
          }
        }
      }
    }
  }

  const psnr = computePsnr(pixels, out);
  const watermarkIdHex = bytes5ToHex(idToBytes5(watermarkId));

  return {
    watermarkedPixels: out,
    psnr,
    watermarkIdHex,
  };
}

/**
 * Extracts a 40-bit watermark ID from an RGBA pixel buffer.
 *
 * @param pixels RGBA pixel buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns { found: boolean, watermarkIdHex?: string, confidence?: number }
 */
export function extractWatermark(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): {
  found: boolean;
  watermarkIdHex?: string;
  confidence?: number;
} {
  const blockW = Math.floor(width / GRID_COLS);
  const blockH = Math.floor(height / GRID_ROWS);

  if (blockW < 2 || blockH < 1) {
    return { found: false };
  }

  const decodedBits: boolean[] = new Array<boolean>(TOTAL_BITS);
  let totalMargin = 0;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const bitIdx = row * GRID_COLS + col;
      const startX = col * blockW;
      const startY = row * blockH;

      let sumEven = 0;
      let countEven = 0;
      let sumOdd = 0;
      let countOdd = 0;

      for (let y = startY; y < startY + blockH; y++) {
        for (let x = startX; x < startX + blockW; x++) {
          const pixelIdx = (y * width + x) * 4 + 2; // Blue channel
          const bVal = pixels[pixelIdx]!;
          if ((x + y) % 2 === 0) {
            sumEven += bVal;
            countEven++;
          } else {
            sumOdd += bVal;
            countOdd++;
          }
        }
      }

      const meanEven = countEven > 0 ? sumEven / countEven : 0;
      const meanOdd = countOdd > 0 ? sumOdd / countOdd : 0;
      const diff = meanEven - meanOdd;

      decodedBits[bitIdx] = diff > 0;
      totalMargin += Math.abs(diff);
    }
  }

  const result = unpackWatermarkBits(decodedBits);
  if (!result.valid || !result.id) {
    return { found: false };
  }

  const confidence = totalMargin / TOTAL_BITS;
  return {
    found: true,
    watermarkIdHex: result.id,
    confidence,
  };
}

/** Helper: Generate a cryptographically secure 40-bit watermark ID */
export function generateRandomWatermarkId(): bigint {
  const bytes = new Uint8Array(5);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 5; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let id = 0n;
  for (let i = 0; i < 5; i++) {
    id = (id << 8n) | BigInt(bytes[i]!);
  }
  return id;
}

/**
 * Browser-side helper: Embeds digital watermark into an image File via HTML5 Canvas.
 * Returns the watermarked PNG Blob, the 40-bit hex ID, and the measured PSNR in dB.
 */
export async function applyWatermarkToFile(
  file: File
): Promise<{ watermarkedBlob: Blob; watermarkIdHex: string; psnr: number } | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (width < 16 || height < 8) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);

        const wmId = generateRandomWatermarkId();
        const { watermarkedPixels, psnr, watermarkIdHex } = embedWatermark(
          imgData.data,
          width,
          height,
          wmId
        );

        const newImgData = ctx.createImageData(width, height);
        newImgData.data.set(watermarkedPixels);
        ctx.putImageData(newImgData, 0, 0);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(null);
              return;
            }
            resolve({
              watermarkedBlob: blob,
              watermarkIdHex,
              psnr,
            });
          },
          "image/png"
        );
      } catch (err) {
        console.warn("Watermarking canvas execution failed:", err);
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}

/** Trigger browser file download of watermarked image */
export function downloadWatermarkedImage(blob: Blob, originalName: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  a.href = url;
  a.download = `${baseName}-protected.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

