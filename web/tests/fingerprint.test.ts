import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computePhashFromMatrix,
  computeDct8x8,
  hammingDistance,
  bigIntToHex16,
  boxResizeToLuma32x32,
} from "../lib/fingerprint.js";
import { createSHA256 } from "hash-wasm";

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

describe("Web Verifier Fingerprint & Golden Vectors (T6.1)", () => {
  const vectorPath = resolve(__dirname, "../../spec/vectors/fingerprint_v1.json");
  const fileContent = readFileSync(vectorPath, "utf-8");
  const golden: GoldenVectorsFile = JSON.parse(fileContent);

  it("loads 7 canonical golden test vectors", () => {
    expect(golden.count).toBe(7);
    expect(golden.vectors.length).toBe(7);
  });

  for (const v of golden.vectors) {
    it(`matches canonical pHash for golden vector: ${v.id}`, () => {
      const computedPhash = computePhashFromMatrix(v.matrix32x32);
      const computedHex = bigIntToHex16(computedPhash);

      expect(computedPhash.toString()).toBe(v.phash_dec);
      expect(computedHex.toLowerCase()).toBe(v.phash_hex.toLowerCase());
    });
  }

  it("verifies hash-wasm SHA-256 implementation matches standard test vectors", async () => {
    const hasher = await createSHA256();
    hasher.init();
    hasher.update(new TextEncoder().encode("PRAMAN spec v1.0 SHA-256 test"));
    const digest = hasher.digest("hex");

    // hashlib.sha256(b"PRAMAN spec v1.0 SHA-256 test").hexdigest()
    const expected = "f47ccd4801ecfb0d0b25162774cb826e03ef93578e04dc344155fd6b736ed1e6";
    expect(digest).toBe(expected);
  });

  it("computes accurate Hamming distance between hashes", () => {
    const h1 = 0b00000000n;
    const h2 = 0b00001111n;
    expect(hammingDistance(h1, h2)).toBe(4);

    const h3 = 0xffffffffffffffffn;
    const h4 = 0x0000000000000000n;
    expect(hammingDistance(h3, h4)).toBe(64);
  });

  it("guarantees zero-snapping in DCT-II calculation", () => {
    // A uniform matrix has all AC coefficients strictly zero
    const uniform = Array.from({ length: 32 }, () => new Array(32).fill(128));
    const dct = computeDct8x8(uniform);

    // DC component is at [0][0]
    expect(dct[0]![0]).toBeGreaterThan(0);

    // All AC components must be exactly 0
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === 0 && c === 0) continue;
        expect(dct[r]![c]).toBe(0);
      }
    }
  });

  it("confirms privacy guarantee: no media upload requests executed", () => {
    // Static assertion & sanity check that fingerprint library imports no network upload APIs
    const source = readFileSync(resolve(__dirname, "../lib/fingerprint.ts"), "utf-8");
    expect(source.includes("fetch(")).toBe(false);
    expect(source.includes("XMLHttpRequest")).toBe(false);
    expect(source.includes("axios")).toBe(false);
  });
});
