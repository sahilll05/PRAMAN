import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeSha256,
  boxResizeToLuma32x32,
  computePhashFromMatrix,
  bigIntToHex16,
} from "../src/fingerprint";

interface GoldenVector {
  id: string;
  description: string;
  width: number;
  height: number;
  sha256: string;
  phash_dec: string;
  phash_hex: string;
  matrix32x32: number[][];
}

interface GoldenVectorsFile {
  specVersion: string;
  count: number;
  vectors: GoldenVector[];
}

describe("Extension Fingerprint & Golden Vectors (T10.2, Spec §4)", () => {
  const vectorPath = resolve(__dirname, "../../spec/vectors/fingerprint_v1.json");
  const fileContent = readFileSync(vectorPath, "utf-8");
  const golden: GoldenVectorsFile = JSON.parse(fileContent);

  it("loads 7 canonical golden test vectors from spec", () => {
    expect(golden.count).toBe(7);
    expect(golden.vectors.length).toBe(7);
  });

  for (const v of golden.vectors) {
    it(`matches canonical pHash for vector: ${v.id}`, () => {
      const phashBigInt = computePhashFromMatrix(v.matrix32x32);
      const hex = bigIntToHex16(phashBigInt);

      expect(hex.toLowerCase()).toBe(v.phash_hex.toLowerCase());
      expect(phashBigInt.toString()).toBe(v.phash_dec);
    });
  }

  it("computes SHA-256 using Web Crypto SubtleCrypto bit-identically", async () => {
    const encoder = new TextEncoder();
    const testData = encoder.encode("PRAMAN प्रमाण Testnet 2026");
    const hash = await computeSha256(testData);

    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);

    // Known standard sha256 of empty string
    const emptyHash = await computeSha256(new Uint8Array(0));
    expect(emptyHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("resizes 32x32 RGB array identically to luma matrix", () => {
    // 32x32 RGB flat buffer with white (255, 255, 255, 255)
    const rgba = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }

    const luma = boxResizeToLuma32x32(rgba, 32, 32);
    expect(luma).toHaveLength(32);
    expect(luma[0]).toHaveLength(32);
    expect(Math.round(luma[0]![0]!)).toBe(255);
  });
});
