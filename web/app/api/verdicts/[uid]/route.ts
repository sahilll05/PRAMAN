/**
 * GET /api/verdicts/[uid]
 *
 * T6.3: Returns full verdict + status + challenges + canary from the indexer
 * Neon Postgres database (via Drizzle ORM).
 *
 * Requires NEON_DATABASE_URL env var. Returns 404 if not found, 503 if DB unavailable.
 */
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  if (!uid || !uid.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid UID format" }, { status: 400 });
  }

  if (!process.env.NEON_DATABASE_URL) {
    return NextResponse.json(
      {
        error: "Indexer database not configured",
        hint: "Set NEON_DATABASE_URL environment variable to connect to Neon Postgres.",
      },
      { status: 503 }
    );
  }

  try {
    // Dynamic import to avoid loading DB code when NEON_DATABASE_URL is not set
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;

    const sql = postgres(process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });
    const db = drizzle(sql);

    const { verdicts, challenges, canaryResults, models } = await import("@praman/indexer");
    const { eq } = await import("drizzle-orm");

    const [verdict] = await db.select().from(verdicts).where(eq(verdicts.uid, uid)).limit(1);
    if (!verdict) {
      await sql.end();
      return NextResponse.json({ error: "Verdict not found" }, { status: 404 });
    }

    const [verdictChallenges, modelRow, canaryRows, superseding] = await Promise.all([
      db.select().from(challenges).where(eq(challenges.refUid, uid)),
      db.select().from(models).where(eq(models.modelHash, verdict.modelHash)).limit(1),
      db.select().from(canaryResults)
        .where(eq(canaryResults.modelHash, verdict.modelHash))
        .orderBy(canaryResults.time)
        .limit(10),
      db.select().from(verdicts).where(eq(verdicts.refUid, uid)),
    ]);

    await sql.end();

    return NextResponse.json({
      verdict,
      challenges: verdictChallenges,
      model: modelRow[0] ?? null,
      latestCanary: canaryRows[canaryRows.length - 1] ?? null,
      supersedingVerdicts: superseding,
    });
  } catch (err) {
    console.error("Verdict API error:", err);
    return NextResponse.json(
      { error: "Database error", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
