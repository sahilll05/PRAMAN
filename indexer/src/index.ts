/**
 * indexer/src/index.ts — PRAMANA indexer entry point (Phase 5: T5.2, T5.3).
 */
export const INDEXER_VERSION = "0.1.0";

export * from "./db/schema.js";
export * from "./db/hamming.js";
export * from "./status.js";
export * from "./ingest.js";
