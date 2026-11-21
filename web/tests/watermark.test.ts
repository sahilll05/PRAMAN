import { describe, it, expect } from "vitest";
import {
  packWatermarkBits,
  unpackWatermarkBits,
  embedWatermark,
  extractWatermark,
  computePsnr,
  generateRandomWatermarkId,
  computeCrc8,
  idToBytes5,
  bytes5ToHex,
} from "../lib/watermark";

describe("PRAMANA Browser Watermarking (Task T10.1b)", () => {
  const sampleId = 0x1a2b3c4d5en; // 40-bit ID

  it("packs and unpacks 40-bit payload with CRC-8 bit-exact", () => {
    const bits = packWatermarkBits(sampleId);
    expect(bits.length).toBe(64); // 16 sync + 40 payload + 8 CRC

    const unpacked = unpackWatermarkBits(bits);
    expect(unpacked.valid).toBe(true);
    expect(unpacked.id?.toLowerCase()).toBe("0x1a2b3c4d5e");
  });

  it("detects corrupted bits via CRC-8", () => {
    const bits = packWatermarkBits(sampleId);

    // Flip one payload bit
    bits[20] = !bits[20];

    const unpacked = unpackWatermarkBits(bits);
    expect(unpacked.valid).toBe(false);
  });

  it("embeds and extracts 40-bit watermark ID with PSNR >= 38 dB", () => {
    const width = 128;
    const height = 128;
    const numPixels = width * height;
    const pixels = new Uint8ClampedArray(numPixels * 4);

    // Create a realistic smooth gradient image
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = Math.floor((x / width) * 200) + 20;     // R
        pixels[idx + 1] = Math.floor((y / height) * 200) + 20; // G
        pixels[idx + 2] = 128;                                // B
        pixels[idx + 3] = 255;                                // A
      }
    }

    const { watermarkedPixels, psnr, watermarkIdHex } = embedWatermark(
      pixels,
      width,
      height,
      sampleId,
      3
    );

    // AC: PSNR >= 38 dB
    expect(psnr).toBeGreaterThanOrEqual(38.0);
    expect(watermarkIdHex.toLowerCase()).toBe("0x1a2b3c4d5e");

    // AC: Recoverable via browser decoder
    const extraction = extractWatermark(watermarkedPixels, width, height);
    expect(extraction.found).toBe(true);
    expect(extraction.watermarkIdHex?.toLowerCase()).toBe("0x1a2b3c4d5e");
  });

  it("returns found: false on unwatermarked image (zero false positives)", () => {
    const width = 128;
    const height = 128;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 100;
      pixels[i + 1] = 120;
      pixels[i + 2] = 140;
      pixels[i + 3] = 255;
    }

    const extraction = extractWatermark(pixels, width, height);
    expect(extraction.found).toBe(false);
  });

  it("handles randomized 40-bit IDs across varying dimensions", () => {
    const testDims = [
      { w: 64, h: 64 },
      { w: 100, h: 80 },
      { w: 200, h: 150 },
    ];

    for (const { w, h } of testDims) {
      const randomId = generateRandomWatermarkId();
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = Math.floor((x / w) * 180 + 30);
          pixels[idx + 1] = Math.floor((y / h) * 180 + 30);
          pixels[idx + 2] = Math.floor(((x + y) / (w + h)) * 180 + 30);
          pixels[idx + 3] = 255;
        }
      }

      const { watermarkedPixels, psnr, watermarkIdHex } = embedWatermark(
        pixels,
        w,
        h,
        randomId,
        2
      );

      expect(psnr).toBeGreaterThanOrEqual(38.0);

      const res = extractWatermark(watermarkedPixels, w, h);
      expect(res.found).toBe(true);
      expect(res.watermarkIdHex?.toLowerCase()).toBe(watermarkIdHex.toLowerCase());
    }
  });
});
