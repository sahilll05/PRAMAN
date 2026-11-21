/**
 * GET /api/verdicts?sha256=<hex>&phash=<hex>&threshold=10
 *
 * T6.3: Fingerprint lookup — finds verdicts matching SHA-256 (exact) or pHash (Hamming ≤ threshold).
 * Returns array of matching verdicts with computed status.
 */
import { NextRequest, NextResponse } from "next/server";
import { LOCAL_VERDICTS } from "@/lib/local-verdicts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function hammingDistance(hexA: string, hexB: string): number {
  try {
    const a = BigInt("0x" + hexA.replace(/^0x/, ""));
    const b = BigInt("0x" + hexB.replace(/^0x/, ""));
    let xor = a ^ b;
    let dist = 0;
    while (xor > 0n) {
      if (xor & 1n) dist++;
      xor >>= 1n;
    }
    return dist;
  } catch {
    return 64;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawSha = searchParams.get("sha256")?.trim();
  const rawPhash = searchParams.get("phash")?.trim();
  const rawThreshold = searchParams.get("threshold") ?? "10";

  let threshold = parseInt(rawThreshold, 10);
  if (isNaN(threshold) || threshold < 0 || threshold > 64) {
    threshold = 10;
  }

  const sha256 = rawSha?.toLowerCase().replace(/^0x/, "");
  const phash = rawPhash?.toLowerCase().replace(/^0x/, "");

  if (!sha256 && !phash) {
    return NextResponse.json({ error: "Provide sha256 or phash query param" }, { status: 400, headers: CORS_HEADERS });
  }

  // Validate hex format
  if (sha256 && !/^[0-9a-fA-F]{64}$/.test(sha256)) {
    return NextResponse.json({ error: "Invalid sha256 hex format (expected 64 hex characters)" }, { status: 400, headers: CORS_HEADERS });
  }
  if (phash && !/^[0-9a-fA-F]{1,16}$/.test(phash)) {
    return NextResponse.json({ error: "Invalid phash hex format (expected up to 16 hex characters)" }, { status: 400, headers: CORS_HEADERS });
  }

  // 1. If Neon database is configured, query PostgreSQL
  if (process.env.NEON_DATABASE_URL) {
    try {
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const postgres = (await import("postgres")).default;

      const sql = postgres(process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });
      const db = drizzle(sql);

      const { verdicts } = await import("@pramana/indexer");
      const { eq } = await import("drizzle-orm");

      let results;
      if (sha256) {
        const normalizedSha = "0x" + sha256;
        results = await db.select().from(verdicts).where(eq(verdicts.sha256Hash, normalizedSha)).limit(20);
      } else {
        const phashBits = BigInt("0x" + (phash ?? "0")).toString(2).padStart(64, "0");
        const rawResult = await sql`
          SELECT * FROM verdicts
          WHERE bit_count(p_hash # ${phashBits}::bit(64)) <= ${threshold}
          ORDER BY bit_count(p_hash # ${phashBits}::bit(64)) ASC
          LIMIT 20
        `;
        results = rawResult;
      }

      await sql.end();
      if (results && results.length > 0) {
        return NextResponse.json({ verdicts: results, count: results.length }, { headers: CORS_HEADERS });
      }
    } catch (err) {
      console.warn("Neon DB query skipped, falling back to local registry:", err);
    }
  }

  // 2. Local Registry Search (for local testing, Anvil, and zero-spend setups)
  const matches = LOCAL_VERDICTS.filter((v) => {
    if (sha256 && v.sha256Hash.toLowerCase().replace(/^0x/, "") === sha256) {
      return true;
    }
    if (phash && v.pHash) {
      const dist = hammingDistance(v.pHash, phash);
      if (dist <= threshold) {
        return true;
      }
    }
    return false;
  });

  return NextResponse.json({ verdicts: matches, count: matches.length }, { headers: CORS_HEADERS });
}

interface BatchQueryItem {
  id?: string;
  sha256?: string;
  phash?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawItems: BatchQueryItem[] = Array.isArray(body) ? body : body.items;

    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "Provide a non-empty array of items to query" }, { status: 400, headers: CORS_HEADERS });
    }

    // Limit to 50 items per batch request
    const items = rawItems.slice(0, 50);
    const threshold = typeof body.threshold === "number" ? Math.max(0, Math.min(64, body.threshold)) : 10;

    const results = items.map((item, index) => {
      const sha256 = item.sha256?.toLowerCase().replace(/^0x/, "");
      const phash = item.phash?.toLowerCase().replace(/^0x/, "");
      const id = item.id || `item-${index}`;

      const matches = LOCAL_VERDICTS.filter((v) => {
        if (sha256 && v.sha256Hash.toLowerCase().replace(/^0x/, "") === sha256) {
          return true;
        }
        if (phash && v.pHash) {
          const dist = hammingDistance(v.pHash, phash);
          if (dist <= threshold) {
            return true;
          }
        }
        return false;
      });

      return {
        id,
        sha256: sha256 || null,
        phash: phash || null,
        found: matches.length > 0,
        count: matches.length,
        verdicts: matches,
      };
    });

    return NextResponse.json({ count: results.length, results }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid JSON request body" }, { status: 400, headers: CORS_HEADERS });
  }
}

