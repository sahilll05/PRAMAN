/**
 * GET /api/verdicts?sha256=<hex>&phash=<hex>&threshold=10
 *
 * T6.3: Fingerprint lookup — finds verdicts matching SHA-256 (exact) or pHash (Hamming ≤ threshold).
 * Returns array of matching verdicts with computed status.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sha256 = searchParams.get("sha256");
  const phash = searchParams.get("phash");
  const threshold = parseInt(searchParams.get("threshold") ?? "10", 10);

  if (!sha256 && !phash) {
    return NextResponse.json({ error: "Provide sha256 or phash query param" }, { status: 400 });
  }

  if (!process.env.NEON_DATABASE_URL) {
    return NextResponse.json(
      {
        error: "Indexer database not configured",
        hint: "Set NEON_DATABASE_URL to connect to Neon Postgres.",
      },
      { status: 503 }
    );
  }

  try {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;

    const sql = postgres(process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });
    const db = drizzle(sql);

    const { verdicts } = await import("@pramana/indexer");
    const { eq } = await import("drizzle-orm");

    let results;
    if (sha256) {
      const normalizedSha = sha256.startsWith("0x") ? sha256 : "0x" + sha256;
      results = await db.select().from(verdicts).where(eq(verdicts.sha256Hash, normalizedSha)).limit(20);
    } else {
      // pHash Hamming search using Neon bit_count XOR query
      // Raw SQL required because Drizzle doesn't expose bit operators
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
    return NextResponse.json({ verdicts: results, count: results.length });
  } catch (err) {
    console.error("Verdict search error:", err);
    return NextResponse.json(
      { error: "Database error", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
