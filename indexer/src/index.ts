/**
 * indexer/src/index.ts — PRAMANA indexer entry point (skeleton).
 * Populated in Phase 5 (T5.2, T5.3).
 *
 * Sub-modules (to be created per task):
 *   ingest.ts  — read EAS Attested/Revoked + Registry events from start block
 *   decode.ts  — decode EAS schema data via ABI
 *   status.ts  — status state machine (spec §6, authoritative)
 *   db.ts      — Drizzle ORM schema + Postgres connection
 */
export const INDEXER_VERSION = "0.1.0-skeleton";

export * from "./db/schema.js";
export * from "./db/hamming.js";
