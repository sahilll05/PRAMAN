import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  computePhashFromMatrix,
  bigIntToHex,
  hammingDistance,
} from "../src/fingerprint/phash.js";

interface GoldenVector {
  id: string;
  description: string;
  width: number;
  height: number;
  sha256: string;
  phash_dec: string;
  phash_hex: string;
  matrix32x32: number[][];
  wmId: string;
}

interface GoldenFile {
  specVersion: string;
  description: string;
  algorithm: string;
  count: number;
  vectors: GoldenVector[];
}

describe("Cross-Language Golden Test Vectors (TypeScript spec s4 validation)", () => {
  const repoRoot = path.resolve(__dirname, "../../");
  const goldenPath = path.join(repoRoot, "spec/vectors/fingerprint_v1.json");

  it("loads and parses fingerprint_v1.json", () => {
    expect(fs.existsSync(goldenPath)).toBe(true);
    const raw = fs.readFileSync(goldenPath, "utf-8");
    const data: GoldenFile = JSON.parse(raw);
    expect(data.specVersion).toBe("0.1.0-draft");
    expect(data.vectors.length).toBeGreaterThan(0);
  });

  it("computes exact matching pHash for every golden vector", () => {
    const raw = fs.readFileSync(goldenPath, "utf-8");
    const data: GoldenFile = JSON.parse(raw);

    for (const vec of data.vectors) {
      const computedBigInt = computePhashFromMatrix(vec.matrix32x32);
      const computedHex = bigIntToHex(computedBigInt);
      const expectedBigInt = BigInt(vec.phash_dec);

      expect(computedBigInt.toString()).toBe(expectedBigInt.toString());
      expect(computedHex).toBe(vec.phash_hex);

      // Verify self-Hamming distance is 0
      expect(hammingDistance(computedBigInt, expectedBigInt)).toBe(0);
    }
  });
});
