/**
 * indexer/src/ingest.ts — EAS & Registry Event Ingest Pipeline (Spec §2, §3, §6, Task T5.2).
 *
 * Implements:
 *   - Reorg-safe event log ingestion from START_BLOCK
 *   - ABI decoding of EAS schemas (Verdict, Challenge, Canary)
 *   - Registry ModelRegistered & ModelStatusChanged event ingestion
 *   - Drizzle ORM Neon Postgres repository & In-Memory repository
 *   - Sync state tracking with configurable confirmation buffers
 */

import {
  type PublicClient,
  type Hex,
  type Log,
  parseAbiItem,
} from "viem";
import {
  REGISTRY_ABI,
  EAS_ABI,
  decodeVerdictData,
  decodeChallengeData,
  decodeCanaryData,
} from "@praman/chain";
import {
  models,
  verdicts,
  challenges,
  canaryResults,
  mediaFingerprints,
  syncState,
  type ModelRecord,
  type VerdictRecord,
  type ChallengeRecord,
  type CanaryRecord,
  type MediaFingerprintRecord,
} from "./db/schema.js";
import { toBit64String } from "./db/hamming.js";
import { eq, desc } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

export interface IndexerConfig {
  registryAddress: Hex;
  easAddress: Hex;
  verdictSchemaUID: Hex;
  challengeSchemaUID: Hex;
  canarySchemaUID: Hex;
  startBlock?: bigint | undefined;
  confirmations?: bigint | undefined; // Reorg safety buffer (e.g. 6 on Base Sepolia, 0 on Anvil)
  chunkSize?: bigint | undefined;     // Max block range per getLogs query
}

/**
 * Storage abstraction for the Indexer (Drizzle Neon Postgres or In-Memory).
 */
export interface IndexerRepository {
  getSyncBlock(key: string): Promise<bigint | null>;
  setSyncBlock(key: string, block: bigint): Promise<void>;

  upsertModel(record: ModelRecord): Promise<void>;
  updateModelStatus(modelHash: string, status: number): Promise<void>;
  getModel(modelHash: string): Promise<ModelRecord | null>;
  getAllModels(): Promise<ModelRecord[]>;

  upsertVerdict(record: VerdictRecord): Promise<void>;
  getVerdict(uid: string): Promise<VerdictRecord | null>;
  getVerdictsByRefUid(refUid: string): Promise<VerdictRecord[]>;
  getAllVerdicts(): Promise<VerdictRecord[]>;
  revokeVerdict(uid: string, revocationTime: bigint): Promise<void>;

  upsertChallenge(record: ChallengeRecord): Promise<void>;
  getChallengesByRefUid(refUid: string): Promise<ChallengeRecord[]>;
  revokeChallenge(uid: string, revocationTime: bigint): Promise<void>;

  upsertCanary(record: CanaryRecord): Promise<void>;
  getLatestCanary(modelHash: string): Promise<CanaryRecord | null>;

  upsertFingerprint(record: MediaFingerprintRecord): Promise<void>;
  getFingerprint(id: string): Promise<MediaFingerprintRecord | null>;
  getAllFingerprints(): Promise<MediaFingerprintRecord[]>;
}

/**
 * In-memory implementation of IndexerRepository for testing and lightweight environments.
 */
export class InMemoryIndexerRepository implements IndexerRepository {
  public syncMap = new Map<string, bigint>();
  public modelsMap = new Map<string, ModelRecord>();
  public verdictsMap = new Map<string, VerdictRecord>();
  public challengesMap = new Map<string, ChallengeRecord>();
  public canaryList: CanaryRecord[] = [];
  public fingerprintsMap = new Map<string, MediaFingerprintRecord>();

  async getSyncBlock(key: string): Promise<bigint | null> {
    return this.syncMap.get(key) ?? null;
  }

  async setSyncBlock(key: string, block: bigint): Promise<void> {
    this.syncMap.set(key, block);
  }

  async upsertModel(record: ModelRecord): Promise<void> {
    const existing = this.modelsMap.get(record.modelHash.toLowerCase());
    if (existing) {
      this.modelsMap.set(record.modelHash.toLowerCase(), { ...existing, ...record });
    } else {
      this.modelsMap.set(record.modelHash.toLowerCase(), record);
    }
  }

  async updateModelStatus(modelHash: string, status: number): Promise<void> {
    const existing = this.modelsMap.get(modelHash.toLowerCase());
    if (existing) {
      existing.status = status;
    }
  }

  async getModel(modelHash: string): Promise<ModelRecord | null> {
    return this.modelsMap.get(modelHash.toLowerCase()) ?? null;
  }

  async getAllModels(): Promise<ModelRecord[]> {
    return Array.from(this.modelsMap.values());
  }

  async upsertVerdict(record: VerdictRecord): Promise<void> {
    this.verdictsMap.set(record.uid.toLowerCase(), record);
  }

  async getVerdict(uid: string): Promise<VerdictRecord | null> {
    return this.verdictsMap.get(uid.toLowerCase()) ?? null;
  }

  async getVerdictsByRefUid(refUid: string): Promise<VerdictRecord[]> {
    const target = refUid.toLowerCase();
    return Array.from(this.verdictsMap.values()).filter(
      (v) => v.refUid.toLowerCase() === target
    );
  }

  async getAllVerdicts(): Promise<VerdictRecord[]> {
    return Array.from(this.verdictsMap.values());
  }

  async revokeVerdict(uid: string, revocationTime: bigint): Promise<void> {
    const v = this.verdictsMap.get(uid.toLowerCase());
    if (v) {
      v.revocationTime = revocationTime;
    }
  }

  async upsertChallenge(record: ChallengeRecord): Promise<void> {
    this.challengesMap.set(record.uid.toLowerCase(), record);
  }

  async getChallengesByRefUid(refUid: string): Promise<ChallengeRecord[]> {
    const target = refUid.toLowerCase();
    return Array.from(this.challengesMap.values()).filter(
      (c) => c.refUid.toLowerCase() === target
    );
  }

  async revokeChallenge(uid: string, revocationTime: bigint): Promise<void> {
    const c = this.challengesMap.get(uid.toLowerCase());
    if (c) {
      c.revocationTime = revocationTime;
    }
  }

  async upsertCanary(record: CanaryRecord): Promise<void> {
    // Remove if already exists with same UID
    this.canaryList = this.canaryList.filter((c) => c.uid.toLowerCase() !== record.uid.toLowerCase());
    this.canaryList.push(record);
  }

  async getLatestCanary(modelHash: string): Promise<CanaryRecord | null> {
    const target = modelHash.toLowerCase();
    const matches = this.canaryList
      .filter((c) => c.modelHash.toLowerCase() === target)
      .sort((a, b) => Number(b.time - a.time));
    return matches[0] ?? null;
  }

  async upsertFingerprint(record: MediaFingerprintRecord): Promise<void> {
    this.fingerprintsMap.set(record.id.toLowerCase(), record);
  }

  async getFingerprint(id: string): Promise<MediaFingerprintRecord | null> {
    return this.fingerprintsMap.get(id.toLowerCase()) ?? null;
  }

  async getAllFingerprints(): Promise<MediaFingerprintRecord[]> {
    return Array.from(this.fingerprintsMap.values());
  }
}

/**
 * Production Neon Postgres repository using Drizzle ORM.
 */
export class DrizzleIndexerRepository implements IndexerRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: PgDatabase<any, any>) {}

  async getSyncBlock(key: string): Promise<bigint | null> {
    const res = await this.db
      .select({ lastIndexedBlock: syncState.lastIndexedBlock })
      .from(syncState)
      .where(eq(syncState.key, key))
      .limit(1);
    return res[0]?.lastIndexedBlock ?? null;
  }

  async setSyncBlock(key: string, block: bigint): Promise<void> {
    await this.db
      .insert(syncState)
      .values({ key, lastIndexedBlock: block, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: syncState.key,
        set: { lastIndexedBlock: block, updatedAt: new Date() },
      });
  }

  async upsertModel(record: ModelRecord): Promise<void> {
    await this.db
      .insert(models)
      .values(record)
      .onConflictDoUpdate({
        target: models.modelHash,
        set: {
          preprocHash: record.preprocHash,
          uri: record.uri,
          specVersion: record.specVersion,
          status: record.status,
        },
      });
  }

  async updateModelStatus(modelHash: string, status: number): Promise<void> {
    await this.db
      .update(models)
      .set({ status })
      .where(eq(models.modelHash, modelHash));
  }

  async getModel(modelHash: string): Promise<ModelRecord | null> {
    const res = await this.db
      .select()
      .from(models)
      .where(eq(models.modelHash, modelHash))
      .limit(1);
    return res[0] ?? null;
  }

  async getAllModels(): Promise<ModelRecord[]> {
    return this.db.select().from(models);
  }

  async upsertVerdict(record: VerdictRecord): Promise<void> {
    await this.db
      .insert(verdicts)
      .values(record)
      .onConflictDoUpdate({
        target: verdicts.uid,
        set: {
          revocationTime: record.revocationTime,
          expirationTime: record.expirationTime,
        },
      });
  }

  async getVerdict(uid: string): Promise<VerdictRecord | null> {
    const res = await this.db
      .select()
      .from(verdicts)
      .where(eq(verdicts.uid, uid))
      .limit(1);
    return res[0] ?? null;
  }

  async getVerdictsByRefUid(refUid: string): Promise<VerdictRecord[]> {
    return this.db
      .select()
      .from(verdicts)
      .where(eq(verdicts.refUid, refUid));
  }

  async getAllVerdicts(): Promise<VerdictRecord[]> {
    return this.db.select().from(verdicts);
  }

  async revokeVerdict(uid: string, revocationTime: bigint): Promise<void> {
    await this.db
      .update(verdicts)
      .set({ revocationTime })
      .where(eq(verdicts.uid, uid));
  }

  async upsertChallenge(record: ChallengeRecord): Promise<void> {
    await this.db
      .insert(challenges)
      .values(record)
      .onConflictDoUpdate({
        target: challenges.uid,
        set: { revocationTime: record.revocationTime },
      });
  }

  async getChallengesByRefUid(refUid: string): Promise<ChallengeRecord[]> {
    return this.db
      .select()
      .from(challenges)
      .where(eq(challenges.refUid, refUid));
  }

  async revokeChallenge(uid: string, revocationTime: bigint): Promise<void> {
    await this.db
      .update(challenges)
      .set({ revocationTime })
      .where(eq(challenges.uid, uid));
  }

  async upsertCanary(record: CanaryRecord): Promise<void> {
    await this.db
      .insert(canaryResults)
      .values(record)
      .onConflictDoUpdate({
        target: canaryResults.uid,
        set: {
          aucBps: record.aucBps,
          eceBps: record.eceBps,
          coverageBps: record.coverageBps,
        },
      });
  }

  async getLatestCanary(modelHash: string): Promise<CanaryRecord | null> {
    const res = await this.db
      .select()
      .from(canaryResults)
      .where(eq(canaryResults.modelHash, modelHash))
      .orderBy(desc(canaryResults.time))
      .limit(1);
    return res[0] ?? null;
  }

  async upsertFingerprint(record: MediaFingerprintRecord): Promise<void> {
    await this.db
      .insert(mediaFingerprints)
      .values(record)
      .onConflictDoUpdate({
        target: mediaFingerprints.id,
        set: { verdict: record.verdict },
      });
  }

  async getFingerprint(id: string): Promise<MediaFingerprintRecord | null> {
    const res = await this.db
      .select()
      .from(mediaFingerprints)
      .where(eq(mediaFingerprints.id, id))
      .limit(1);
    return res[0] ?? null;
  }

  async getAllFingerprints(): Promise<MediaFingerprintRecord[]> {
    return this.db.select().from(mediaFingerprints);
  }
}

/**
 * On-chain Attestation structure matching EAS contract return type.
 */
export interface OnChainAttestation {
  uid: Hex;
  schema: Hex;
  time: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  refUID: Hex;
  recipient: Hex;
  attester: Hex;
  revocable: boolean;
  data: Hex;
}

export const SYNC_KEY = "eas_indexer";
export const DEFAULT_CHUNK_SIZE = 2000n;
export const DEFAULT_CONFIRMATIONS = 0n;

/**
 * Ingest events from a single block range [fromBlock, toBlock].
 */
export async function syncBlockRange(
  client: PublicClient,
  repo: IndexerRepository,
  config: IndexerConfig,
  fromBlock: bigint,
  toBlock: bigint
): Promise<{ eventsProcessed: number }> {
  let count = 0;

  // 1. Fetch Registry events: ModelRegistered and ModelStatusChanged
  const regModelRegisteredLogs = await client.getLogs({
    address: config.registryAddress,
    event: parseAbiItem(
      "event ModelRegistered(bytes32 indexed modelHash, bytes32 preprocHash, string uri, bytes32 specVersion)"
    ),
    fromBlock,
    toBlock,
  });

  for (const log of regModelRegisteredLogs) {
    const args = log.args;
    if (!args.modelHash || !args.preprocHash || args.uri === undefined || !args.specVersion) continue;

    await repo.upsertModel({
      modelHash: args.modelHash,
      preprocHash: args.preprocHash,
      uri: args.uri,
      specVersion: args.specVersion,
      status: 0, // ACTIVE
      registeredBlock: log.blockNumber ?? fromBlock,
      registeredAt: new Date(),
    });
    count++;
  }

  const regModelStatusLogs = await client.getLogs({
    address: config.registryAddress,
    event: parseAbiItem(
      "event ModelStatusChanged(bytes32 indexed modelHash, uint8 newStatus)"
    ),
    fromBlock,
    toBlock,
  });

  for (const log of regModelStatusLogs) {
    const args = log.args;
    if (!args.modelHash || args.newStatus === undefined) continue;

    await repo.updateModelStatus(args.modelHash, args.newStatus);
    count++;
  }

  // 2. Fetch EAS events: Attested and Revoked
  const easAttestedLogs = await client.getLogs({
    address: config.easAddress,
    event: parseAbiItem(
      "event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schemaUID)"
    ),
    fromBlock,
    toBlock,
  });

  for (const log of easAttestedLogs) {
    const uid = log.args.uid;
    const schemaUID = log.args.schemaUID?.toLowerCase();
    if (!uid || !schemaUID) continue;

    // Check if the attestation belongs to our known schemas
    const isVerdict = schemaUID === config.verdictSchemaUID.toLowerCase();
    const isChallenge = schemaUID === config.challengeSchemaUID.toLowerCase();
    const isCanary = schemaUID === config.canarySchemaUID.toLowerCase();

    if (!isVerdict && !isChallenge && !isCanary) {
      continue;
    }

    // Read full on-chain attestation
    const rawAttestation = await client.readContract({
      address: config.easAddress,
      abi: EAS_ABI,
      functionName: "getAttestation",
      args: [uid],
    }) as OnChainAttestation;

    const blockNum = log.blockNumber ?? fromBlock;

    if (isVerdict) {
      const decoded = decodeVerdictData(rawAttestation.data);
      const pHashBitStr = toBit64String(decoded.pHash);

      const vRecord: VerdictRecord = {
        uid: rawAttestation.uid,
        schemaUid: rawAttestation.schema,
        refUid: rawAttestation.refUID,
        attester: rawAttestation.attester,
        recipient: rawAttestation.recipient,
        time: rawAttestation.time,
        expirationTime: rawAttestation.expirationTime,
        revocationTime: rawAttestation.revocationTime,
        sha256Hash: decoded.sha256Hash,
        pHash: pHashBitStr,
        wmId: decoded.wmId,
        modelHash: decoded.modelHash,
        preprocHash: decoded.preprocHash,
        pFakeBps: decoded.pFakeBps,
        verdict: decoded.verdict,
        evidenceHash: decoded.evidenceHash,
        blockNumber: blockNum,
        createdAt: new Date(),
      };
      await repo.upsertVerdict(vRecord);

      // Also index media fingerprint for perceptual hash Hamming search
      const fpRecord: MediaFingerprintRecord = {
        id: rawAttestation.uid,
        attestationUid: rawAttestation.uid,
        sha256Hash: decoded.sha256Hash,
        pHash: pHashBitStr,
        wmId: decoded.wmId,
        verdict: decoded.verdict,
        createdAt: new Date(),
      };
      await repo.upsertFingerprint(fpRecord);
      count++;
    } else if (isChallenge) {
      const decoded = decodeChallengeData(rawAttestation.data);
      const cRecord: ChallengeRecord = {
        uid: rawAttestation.uid,
        refUid: rawAttestation.refUID,
        attester: rawAttestation.attester,
        time: rawAttestation.time,
        revocationTime: rawAttestation.revocationTime,
        modelHash: decoded.modelHash,
        observedPFakeBps: decoded.observedPFakeBps,
        observedVerdict: decoded.observedVerdict,
        evidenceHash: decoded.evidenceHash,
        blockNumber: blockNum,
        createdAt: new Date(),
      };
      await repo.upsertChallenge(cRecord);
      count++;
    } else if (isCanary) {
      const decoded = decodeCanaryData(rawAttestation.data);
      const canRecord: CanaryRecord = {
        uid: rawAttestation.uid,
        attester: rawAttestation.attester,
        time: rawAttestation.time,
        modelHash: decoded.modelHash,
        batchId: decoded.batchId,
        aucBps: decoded.aucBps,
        eceBps: decoded.eceBps,
        coverageBps: decoded.coverageBps,
        n: decoded.n,
        labelsCommitHash: decoded.labelsCommitHash,
        blockNumber: blockNum,
        createdAt: new Date(),
      };
      await repo.upsertCanary(canRecord);
      count++;
    }
  }

  // 3. EAS Revoked events
  const easRevokedLogs = await client.getLogs({
    address: config.easAddress,
    event: parseAbiItem(
      "event Revoked(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schemaUID)"
    ),
    fromBlock,
    toBlock,
  });

  for (const log of easRevokedLogs) {
    const uid = log.args.uid;
    if (!uid) continue;

    // Fetch attestation to get precise revocation time, or fallback to current block
    let revTime = 0n;
    try {
      const raw = await client.readContract({
        address: config.easAddress,
        abi: EAS_ABI,
        functionName: "getAttestation",
        args: [uid],
      }) as OnChainAttestation;
      revTime = raw.revocationTime > 0n ? raw.revocationTime : BigInt(Math.floor(Date.now() / 1000));
    } catch {
      revTime = BigInt(Math.floor(Date.now() / 1000));
    }

    await repo.revokeVerdict(uid, revTime);
    await repo.revokeChallenge(uid, revTime);
    count++;
  }

  return { eventsProcessed: count };
}

export interface IngestRunResult {
  fromBlock: bigint;
  toBlock: bigint;
  eventsProcessed: number;
}

/**
 * Run one reorg-safe ingestion pass up to current chain head.
 */
export async function runIngest(
  client: PublicClient,
  repo: IndexerRepository,
  config: IndexerConfig
): Promise<IngestRunResult> {
  const currentHead = await client.getBlockNumber();
  const confirmations = config.confirmations ?? DEFAULT_CONFIRMATIONS;
  const chunkSize = config.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const configuredStart = config.startBlock ?? 0n;

  // Determine starting block taking reorg confirmations into account
  const lastSynced = await repo.getSyncBlock(SYNC_KEY);
  let fromBlock: bigint;
  if (lastSynced !== null) {
    const safeStart = lastSynced > confirmations ? lastSynced - confirmations + 1n : 0n;
    fromBlock = safeStart > configuredStart ? safeStart : configuredStart;
  } else {
    fromBlock = configuredStart;
  }

  if (fromBlock > currentHead) {
    return { fromBlock, toBlock: currentHead, eventsProcessed: 0 };
  }

  let totalProcessed = 0;
  let cursor = fromBlock;

  while (cursor <= currentHead) {
    const to = cursor + chunkSize - 1n < currentHead ? cursor + chunkSize - 1n : currentHead;
    const { eventsProcessed } = await syncBlockRange(client, repo, config, cursor, to);
    totalProcessed += eventsProcessed;

    await repo.setSyncBlock(SYNC_KEY, to);
    cursor = to + 1n;
  }

  return {
    fromBlock,
    toBlock: currentHead,
    eventsProcessed: totalProcessed,
  };
}
