import * as fs from "node:fs";
import * as path from "node:path";
import postgres from "postgres";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=")) {
          let val = trimmed.slice("DATABASE_URL=".length).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          return val;
        }
      }
    }
  }

  return "";
}

const dbUrl = getDatabaseUrl();
if (!dbUrl) {
  console.error("❌ Error: DATABASE_URL not found in environment or .env file.");
  process.exit(1);
}

const sql = postgres(dbUrl);

const schemaSql = `
CREATE TABLE IF NOT EXISTS models (
  model_hash VARCHAR(66) PRIMARY KEY,
  preproc_hash VARCHAR(66) NOT NULL,
  uri TEXT NOT NULL,
  spec_version VARCHAR(66) NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  registered_block BIGINT NOT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verdicts (
  uid VARCHAR(66) PRIMARY KEY,
  schema_uid VARCHAR(66) NOT NULL,
  ref_uid VARCHAR(66) NOT NULL,
  attester VARCHAR(42) NOT NULL,
  recipient VARCHAR(42) NOT NULL,
  time BIGINT NOT NULL,
  expiration_time BIGINT NOT NULL,
  revocation_time BIGINT NOT NULL DEFAULT 0,
  sha256_hash VARCHAR(66) NOT NULL,
  p_hash BIT(64) NOT NULL,
  wm_id BIGINT NOT NULL,
  model_hash VARCHAR(66) NOT NULL,
  preproc_hash VARCHAR(66) NOT NULL,
  pfake_bps INTEGER NOT NULL,
  verdict INTEGER NOT NULL,
  evidence_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  uid VARCHAR(66) PRIMARY KEY,
  ref_uid VARCHAR(66) NOT NULL,
  attester VARCHAR(42) NOT NULL,
  time BIGINT NOT NULL,
  revocation_time BIGINT NOT NULL DEFAULT 0,
  model_hash VARCHAR(66) NOT NULL,
  observed_pfake_bps INTEGER NOT NULL,
  observed_verdict INTEGER NOT NULL,
  evidence_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canary_results (
  uid VARCHAR(66) PRIMARY KEY,
  attester VARCHAR(42) NOT NULL,
  time BIGINT NOT NULL,
  model_hash VARCHAR(66) NOT NULL,
  batch_id VARCHAR(66) NOT NULL,
  auc_bps INTEGER NOT NULL,
  ece_bps INTEGER NOT NULL,
  coverage_bps INTEGER NOT NULL,
  n INTEGER NOT NULL,
  labels_commit_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_fingerprints (
  id TEXT PRIMARY KEY,
  attestation_uid VARCHAR(66) NOT NULL,
  sha256_hash VARCHAR(66) NOT NULL,
  p_hash BIT(64) NOT NULL,
  wm_id BIGINT,
  verdict INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_state (
  key VARCHAR(32) PRIMARY KEY,
  last_indexed_block BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verdicts_sha256 ON verdicts(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_verdicts_phash ON verdicts(p_hash);
CREATE INDEX IF NOT EXISTS idx_media_fingerprints_sha256 ON media_fingerprints(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_media_fingerprints_phash ON media_fingerprints(p_hash);
`;

async function main() {
  console.log("🚀 Connecting to Neon PostgreSQL database...");
  try {
    await sql.unsafe(schemaSql);
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log("✅ Schema successfully pushed to PostgreSQL!");
    console.log(`📦 Active tables in database: ${tables.map((t) => t.table_name).join(", ")}`);
  } catch (err) {
    console.error("❌ Failed to push schema:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
