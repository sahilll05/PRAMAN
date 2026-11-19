import {
  pgTable,
  text,
  varchar,
  timestamp,
  bigint,
  integer,
  customType,
} from "drizzle-orm/pg-core";

/**
 * Custom bit(64) type for Postgres bitwise operations in Neon.
 * Stored as 64-character binary string in JS/TS.
 */
export const bit64 = customType<{ data: string; driverData: string }>({
  dataType() {
    return "bit(64)";
  },
});

export const models = pgTable("models", {
  modelHash: varchar("model_hash", { length: 66 }).primaryKey(),
  preprocHash: varchar("preproc_hash", { length: 66 }).notNull(),
  uri: text("uri").notNull(),
  specVersion: varchar("spec_version", { length: 66 }).notNull(),
  status: integer("status").notNull().default(0), // 0=ACTIVE, 1=DEPRECATED, 2=DEGRADED
  registeredBlock: bigint("registered_block", { mode: "bigint" }).notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export const verdicts = pgTable("verdicts", {
  uid: varchar("uid", { length: 66 }).primaryKey(),
  schemaUid: varchar("schema_uid", { length: 66 }).notNull(),
  refUid: varchar("ref_uid", { length: 66 }).notNull(),
  attester: varchar("attester", { length: 42 }).notNull(),
  recipient: varchar("recipient", { length: 42 }).notNull(),
  time: bigint("time", { mode: "bigint" }).notNull(),
  expirationTime: bigint("expiration_time", { mode: "bigint" }).notNull(),
  revocationTime: bigint("revocation_time", { mode: "bigint" }).notNull().default(0n),
  sha256Hash: varchar("sha256_hash", { length: 66 }).notNull(),
  pHash: bit64("p_hash").notNull(),
  wmId: bigint("wm_id", { mode: "bigint" }).notNull(),
  modelHash: varchar("model_hash", { length: 66 }).notNull(),
  preprocHash: varchar("preproc_hash", { length: 66 }).notNull(),
  pFakeBps: integer("pfake_bps").notNull(),
  verdict: integer("verdict").notNull(), // 0=ABSTAIN, 1=LIKELY_AUTHENTIC, 2=LIKELY_SYNTHETIC
  evidenceHash: varchar("evidence_hash", { length: 66 }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challenges = pgTable("challenges", {
  uid: varchar("uid", { length: 66 }).primaryKey(),
  refUid: varchar("ref_uid", { length: 66 }).notNull(), // Target Verdict UID
  attester: varchar("attester", { length: 42 }).notNull(),
  time: bigint("time", { mode: "bigint" }).notNull(),
  revocationTime: bigint("revocation_time", { mode: "bigint" }).notNull().default(0n),
  modelHash: varchar("model_hash", { length: 66 }).notNull(),
  observedPFakeBps: integer("observed_pfake_bps").notNull(),
  observedVerdict: integer("observed_verdict").notNull(),
  evidenceHash: varchar("evidence_hash", { length: 66 }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const canaryResults = pgTable("canary_results", {
  uid: varchar("uid", { length: 66 }).primaryKey(),
  attester: varchar("attester", { length: 42 }).notNull(),
  time: bigint("time", { mode: "bigint" }).notNull(),
  modelHash: varchar("model_hash", { length: 66 }).notNull(),
  batchId: varchar("batch_id", { length: 66 }).notNull(),
  aucBps: integer("auc_bps").notNull(),
  eceBps: integer("ece_bps").notNull(),
  coverageBps: integer("coverage_bps").notNull(),
  n: integer("n").notNull(),
  labelsCommitHash: varchar("labels_commit_hash", { length: 66 }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mediaFingerprints = pgTable("media_fingerprints", {
  id: text("id").primaryKey(), // Attestation UID or hash
  attestationUid: varchar("attestation_uid", { length: 66 }).notNull(),
  sha256Hash: varchar("sha256_hash", { length: 66 }).notNull(),
  pHash: bit64("p_hash").notNull(),
  wmId: bigint("wm_id", { mode: "bigint" }),
  verdict: integer("verdict").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const syncState = pgTable("sync_state", {
  key: varchar("key", { length: 32 }).primaryKey(),
  lastIndexedBlock: bigint("last_indexed_block", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ModelRecord = typeof models.$inferSelect;
export type VerdictRecord = typeof verdicts.$inferSelect;
export type ChallengeRecord = typeof challenges.$inferSelect;
export type CanaryRecord = typeof canaryResults.$inferSelect;
export type MediaFingerprintRecord = typeof mediaFingerprints.$inferSelect;
