/**
 * Neon Postgres Bit Operations and Hamming Search for pHash (Spec §4, Task T3.4).
 *
 * Implements 64-bit perceptual hash bitwise XOR and popcount query generation
 * for Neon PostgreSQL (`bit_count(p_hash # $1::bit(64))`) and fast in-memory benchmarking.
 */

/**
 * Format a 64-bit BigInt as a 64-character binary bitstring ('0' and '1').
 */
export function toBit64String(value: bigint): string {
  const normalized = value & 0xffffffffffffffffn;
  return normalized.toString(2).padStart(64, "0");
}

/**
 * Fast 32-bit popcount using parallel SWAR bitwise arithmetic.
 */
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  x = x + (x >>> 8);
  x = x + (x >>> 16);
  return x & 0x3f;
}

/**
 * Fast 64-bit population count (number of set bits) using 32-bit split SWAR.
 */
export function popcount64(val: bigint): number {
  const low = Number(val & 0xffffffffn);
  const high = Number((val >> 32n) & 0xffffffffn);
  return popcount32(low) + popcount32(high);
}

/**
 * Hamming distance between two 64-bit unsigned integers.
 */
export function hammingDistance64(a: bigint, b: bigint): number {
  return popcount64(a ^ b);
}

export interface HammingMatch {
  id: string;
  pHash: bigint;
  distance: number;
}

/**
 * In-memory scan search for candidate pHash across N entries within maxDistance.
 */
export function searchHammingInMemory(
  records: Array<{ id: string; pHash: bigint }>,
  queryHash: bigint,
  maxDistance: number
): HammingMatch[] {
  const matches: HammingMatch[] = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec) continue;
    const dist = hammingDistance64(rec.pHash, queryHash);
    if (dist <= maxDistance) {
      matches.push({ id: rec.id, pHash: rec.pHash, distance: dist });
    }
  }
  return matches.sort((a, b) => a.distance - b.distance);
}

/**
 * Construct Postgres SQL query for Neon bitwise Hamming distance search.
 *
 * In PostgreSQL (Neon):
 * - `#` is the bitwise XOR operator on bit strings (`bit(64)`).
 * - `bit_count()` is the native built-in counting the number of set bits (popcount).
 */
export function buildHammingSearchQuery(
  candidateHash: bigint,
  maxDistance: number,
  limit: number = 10
): { text: string; values: [string, number, number] } {
  const bitString = toBit64String(candidateHash);
  return {
    text: [
      "SELECT id, attestation_uid, sha256_hash, p_hash,",
      "bit_count(p_hash # $1::bit(64)) AS hamming_distance",
      "FROM media_fingerprints",
      "WHERE bit_count(p_hash # $1::bit(64)) <= $2",
      "ORDER BY hamming_distance ASC",
      "LIMIT $3;",
    ].join(" "),
    values: [bitString, maxDistance, limit],
  };
}
