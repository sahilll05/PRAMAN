CREATE TABLE IF NOT EXISTS "canary_results" (
	"uid" varchar(66) PRIMARY KEY NOT NULL,
	"attester" varchar(42) NOT NULL,
	"time" bigint NOT NULL,
	"model_hash" varchar(66) NOT NULL,
	"batch_id" varchar(66) NOT NULL,
	"auc_bps" integer NOT NULL,
	"ece_bps" integer NOT NULL,
	"coverage_bps" integer NOT NULL,
	"n" integer NOT NULL,
	"labels_commit_hash" varchar(66) NOT NULL,
	"block_number" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"uid" varchar(66) PRIMARY KEY NOT NULL,
	"ref_uid" varchar(66) NOT NULL,
	"attester" varchar(42) NOT NULL,
	"time" bigint NOT NULL,
	"revocation_time" bigint DEFAULT 0 NOT NULL,
	"model_hash" varchar(66) NOT NULL,
	"observed_pfake_bps" integer NOT NULL,
	"observed_verdict" integer NOT NULL,
	"evidence_hash" varchar(66) NOT NULL,
	"block_number" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_fingerprints" (
	"id" text PRIMARY KEY NOT NULL,
	"attestation_uid" varchar(66) NOT NULL,
	"sha256_hash" varchar(66) NOT NULL,
	"p_hash" "bit(64)" NOT NULL,
	"wm_id" bigint,
	"verdict" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "models" (
	"model_hash" varchar(66) PRIMARY KEY NOT NULL,
	"preproc_hash" varchar(66) NOT NULL,
	"uri" text NOT NULL,
	"spec_version" varchar(66) NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"registered_block" bigint NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_state" (
	"key" varchar(32) PRIMARY KEY NOT NULL,
	"last_indexed_block" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verdicts" (
	"uid" varchar(66) PRIMARY KEY NOT NULL,
	"schema_uid" varchar(66) NOT NULL,
	"ref_uid" varchar(66) NOT NULL,
	"attester" varchar(42) NOT NULL,
	"recipient" varchar(42) NOT NULL,
	"time" bigint NOT NULL,
	"expiration_time" bigint NOT NULL,
	"revocation_time" bigint DEFAULT 0 NOT NULL,
	"sha256_hash" varchar(66) NOT NULL,
	"p_hash" "bit(64)" NOT NULL,
	"wm_id" bigint NOT NULL,
	"model_hash" varchar(66) NOT NULL,
	"preproc_hash" varchar(66) NOT NULL,
	"pfake_bps" integer NOT NULL,
	"verdict" integer NOT NULL,
	"evidence_hash" varchar(66) NOT NULL,
	"block_number" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
