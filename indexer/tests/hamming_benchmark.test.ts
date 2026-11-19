import { describe, it, expect } from "vitest";
import {
  popcount64,
  hammingDistance64,
  toBit64String,
  buildHammingSearchQuery,
  searchHammingInMemory,
} from "../src/index.js";

describe("T3.4 Hamming Search and Postgres Bit Ops Benchmark", () => {
  it("computes 64-bit popcount accurately", () => {
    expect(popcount64(0n)).toBe(0);
    expect(popcount64(1n)).toBe(1);
    expect(popcount64(0xffffffffffffffffn)).toBe(64);
    expect(popcount64(0x5555555555555555n)).toBe(32);
    expect(popcount64(0xaaaaaaaaaaaaaaaan)).toBe(32);
    expect(popcount64(1n << 63n)).toBe(1);
  });

  it("computes 64-bit Hamming distance accurately", () => {
    const a = 0b10110011n;
    const b = 0b10010010n; // differs at bit 4 and bit 0
    expect(hammingDistance64(a, b)).toBe(2);
  });

  it("converts BigInt to 64-character binary string", () => {
    const bitStr = toBit64String(15n);
    expect(bitStr).toHaveLength(64);
    expect(bitStr.endsWith("00001111")).toBe(true);
    expect(bitStr.startsWith("0".repeat(60))).toBe(true);
  });

  it("constructs valid Neon Postgres bit ops query", () => {
    const candidate = 0x1234567890abcdefn;
    const query = buildHammingSearchQuery(candidate, 10, 5);
    expect(query.text).toContain("bit_count(p_hash # $1::bit(64)) AS hamming_distance");
    expect(query.text).toContain("WHERE bit_count(p_hash # $1::bit(64)) <= $2");
    expect(query.values[0]).toHaveLength(64);
    expect(query.values[1]).toBe(10);
    expect(query.values[2]).toBe(5);
  });

  it("benchmarks 10,000 pHash records retrieval within 5ms", () => {
    const N = 10_000;
    const records: Array<{ id: string; pHash: bigint }> = new Array(N);

    // Seed pseudo-random 64-bit numbers
    let seed = 123456789n;
    for (let i = 0; i < N; i++) {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
      records[i] = { id: `rec_${i}`, pHash: seed };
    }

    const queryHash = 0xabcdef0123456789n;
    // Plant near duplicates
    records[42] = { id: "match_dist_2", pHash: queryHash ^ 0b0011n };
    records[1337] = { id: "match_dist_5", pHash: queryHash ^ 0b11111n };
    records[9999] = { id: "match_dist_9", pHash: queryHash ^ 0b111111111n };

    const T = 10;
    const startTime = performance.now();
    const results = searchHammingInMemory(records, queryHash, T);
    const elapsedMs = performance.now() - startTime;

    console.log(`[T3.4 Benchmark] Searched ${N} 64-bit pHashes in ${elapsedMs.toFixed(3)} ms`);
    console.log(`Found ${results.length} matches within Hamming threshold T = ${T}`);

    expect(elapsedMs).toBeLessThan(5.0); // Must be under 5ms
    expect(results.some((r) => r.id === "match_dist_2")).toBe(true);
    expect(results.some((r) => r.id === "match_dist_5")).toBe(true);
    expect(results.some((r) => r.id === "match_dist_9")).toBe(true);

    // Verify ordering
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
    }
  });
});
