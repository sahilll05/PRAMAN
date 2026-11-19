import { pgTable, text, varchar, timestamp, bigint, customType } from "drizzle-orm/pg-core";

/**
 * Custom bit(64) type for Postgres bitwise operations in Neon.
 * Stored as 64-character binary string in JS/TS.
 */
export const bit64 = customType<{ data: string; driverData: string }>({
  dataType() {
    return "bit(64)";
  },
});

export const mediaFingerprints = pgTable("media_fingerprints", {
  id: text("id").primaryKey(),
  attestationUid: varchar("attestation_uid", { length: 66 }).notNull(),
  sha256Hash: varchar("sha256_hash", { length: 64 }).notNull(),
  pHash: bit64("p_hash").notNull(),
  wmId: bigint("wm_id", { mode: "bigint" }),
  verdict: varchar("verdict", { length: 16 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
