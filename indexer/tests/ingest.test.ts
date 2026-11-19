import { describe, it, expect, vi } from "vitest";
import {
  type PublicClient,
  type Hex,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import {
  encodeVerdictData,
  encodeChallengeData,
  encodeCanaryData,
  VERDICT_SCHEMA_STRING,
  CHALLENGE_SCHEMA_STRING,
  CANARY_SCHEMA_STRING,
  computeSchemaUID,
} from "@pramana/chain";
import {
  InMemoryIndexerRepository,
  syncBlockRange,
  runIngest,
  type IndexerConfig,
  type OnChainAttestation,
  SYNC_KEY,
} from "../src/ingest.js";

describe("Indexer Ingest Pipeline (Task T5.2)", () => {
  const REGISTRY_ADDR = "0x0000000000000000000000000000000000000001" as Hex;
  const EAS_ADDR = "0x0000000000000000000000000000000000000002" as Hex;

  const verdictSchemaUID = computeSchemaUID(VERDICT_SCHEMA_STRING, REGISTRY_ADDR, true);
  const challengeSchemaUID = computeSchemaUID(CHALLENGE_SCHEMA_STRING, REGISTRY_ADDR, true);
  const canarySchemaUID = computeSchemaUID(CANARY_SCHEMA_STRING, REGISTRY_ADDR, true);

  const config: IndexerConfig = {
    registryAddress: REGISTRY_ADDR,
    easAddress: EAS_ADDR,
    verdictSchemaUID,
    challengeSchemaUID,
    canarySchemaUID,
    startBlock: 100n,
    confirmations: 0n,
    chunkSize: 1000n,
  };

  it("stores and updates syncState correctly in repository", async () => {
    const repo = new InMemoryIndexerRepository();
    expect(await repo.getSyncBlock(SYNC_KEY)).toBeNull();

    await repo.setSyncBlock(SYNC_KEY, 150n);
    expect(await repo.getSyncBlock(SYNC_KEY)).toBe(150n);
  });

  it("ingests Registry ModelRegistered and ModelStatusChanged events", async () => {
    const repo = new InMemoryIndexerRepository();

    const modelHash = "0x" + "11".repeat(32) as Hex;
    const preprocHash = "0x" + "22".repeat(32) as Hex;
    const specVersion = "0x" + "33".repeat(32) as Hex;
    const uri = "ipfs://bafybeimodel01";

    const mockClient = {
      getLogs: vi.fn().mockImplementation(async (params: { address: Hex; event: { name: string } }) => {
        if (params.event.name === "ModelRegistered") {
          return [
            {
              blockNumber: 105n,
              args: {
                modelHash,
                preprocHash,
                uri,
                specVersion,
              },
            },
          ];
        }
        if (params.event.name === "ModelStatusChanged") {
          return [
            {
              blockNumber: 110n,
              args: {
                modelHash,
                newStatus: 2, // DEGRADED
              },
            },
          ];
        }
        return [];
      }),
      readContract: vi.fn(),
    } as unknown as PublicClient;

    const { eventsProcessed } = await syncBlockRange(mockClient, repo, config, 100n, 120n);
    expect(eventsProcessed).toBe(2);

    const model = await repo.getModel(modelHash);
    expect(model).not.toBeNull();
    expect(model?.modelHash).toBe(modelHash);
    expect(model?.uri).toBe(uri);
    expect(model?.status).toBe(2); // Updated to DEGRADED
    expect(model?.registeredBlock).toBe(105n);
  });

  it("ingests EAS Verdict Attested events and indexes perceptual hash", async () => {
    const repo = new InMemoryIndexerRepository();

    const verdictUid = "0x" + "aa".repeat(32) as Hex;
    const modelHash = "0x" + "11".repeat(32) as Hex;
    const preprocHash = "0x" + "22".repeat(32) as Hex;
    const sha256Hash = "0x" + "33".repeat(32) as Hex;
    const evidenceHash = "0x" + "44".repeat(32) as Hex;
    const pHashBigInt = 0xabcdef0123456789n;

    const verdictEncodedData = encodeVerdictData({
      sha256Hash,
      pHash: pHashBigInt,
      wmId: 0n,
      modelHash,
      preprocHash,
      pFakeBps: 9800,
      verdict: 2, // LIKELY_SYNTHETIC
      evidenceHash,
    });

    const mockAttestation: OnChainAttestation = {
      uid: verdictUid,
      schema: verdictSchemaUID,
      time: 1700000000n,
      expirationTime: 1800000000n,
      revocationTime: 0n,
      refUID: ("0x" + "00".repeat(32)) as Hex,
      recipient: ("0x" + "00".repeat(20)) as Hex,
      attester: ("0x" + "fe".repeat(20)) as Hex,
      revocable: true,
      data: verdictEncodedData,
    };

    const mockClient = {
      getLogs: vi.fn().mockImplementation(async (params: { event: { name: string } }) => {
        if (params.event.name === "Attested") {
          return [
            {
              blockNumber: 115n,
              args: {
                recipient: mockAttestation.recipient,
                attester: mockAttestation.attester,
                uid: verdictUid,
                schemaUID: verdictSchemaUID,
              },
            },
          ];
        }
        return [];
      }),
      readContract: vi.fn().mockResolvedValue(mockAttestation),
    } as unknown as PublicClient;

    const { eventsProcessed } = await syncBlockRange(mockClient, repo, config, 100n, 120n);
    expect(eventsProcessed).toBe(1);

    // Verify verdict in repository
    const storedVerdict = await repo.getVerdict(verdictUid);
    expect(storedVerdict).not.toBeNull();
    expect(storedVerdict?.uid).toBe(verdictUid);
    expect(storedVerdict?.pFakeBps).toBe(9800);
    expect(storedVerdict?.verdict).toBe(2);
    expect(storedVerdict?.sha256Hash).toBe(sha256Hash);

    // Verify media fingerprint indexed for Hamming search
    const fp = await repo.getFingerprint(verdictUid);
    expect(fp).not.toBeNull();
    expect(fp?.sha256Hash).toBe(sha256Hash);
    expect(fp?.verdict).toBe(2);
    expect(fp?.pHash).toBe(pHashBigInt.toString(2).padStart(64, "0"));
  });

  it("ingests EAS Challenge Attested and Revoked events", async () => {
    const repo = new InMemoryIndexerRepository();

    const chalUid = "0x" + "cc".repeat(32) as Hex;
    const targetVerdictUid = "0x" + "aa".repeat(32) as Hex;
    const modelHash = "0x" + "11".repeat(32) as Hex;
    const evidenceHash = "0x" + "55".repeat(32) as Hex;

    const chalData = encodeChallengeData({
      modelHash,
      observedPFakeBps: 150,
      observedVerdict: 1, // LIKELY_AUTHENTIC
      evidenceHash,
    });

    const mockChalAttestation: OnChainAttestation = {
      uid: chalUid,
      schema: challengeSchemaUID,
      time: 1710000000n,
      expirationTime: 0n,
      revocationTime: 0n,
      refUID: targetVerdictUid,
      recipient: ("0x" + "00".repeat(20)) as Hex,
      attester: ("0x" + "77".repeat(20)) as Hex,
      revocable: true,
      data: chalData,
    };

    let revoked = false;

    const mockClient = {
      getLogs: vi.fn().mockImplementation(async (params: { event: { name: string } }) => {
        if (params.event.name === "Attested" && !revoked) {
          return [
            {
              blockNumber: 120n,
              args: {
                recipient: mockChalAttestation.recipient,
                attester: mockChalAttestation.attester,
                uid: chalUid,
                schemaUID: challengeSchemaUID,
              },
            },
          ];
        }
        if (params.event.name === "Revoked" && revoked) {
          return [
            {
              blockNumber: 130n,
              args: {
                recipient: mockChalAttestation.recipient,
                attester: mockChalAttestation.attester,
                uid: chalUid,
                schemaUID: challengeSchemaUID,
              },
            },
          ];
        }
        return [];
      }),
      readContract: vi.fn().mockImplementation(async () => {
        return {
          ...mockChalAttestation,
          revocationTime: revoked ? 1720000000n : 0n,
        };
      }),
    } as unknown as PublicClient;

    // First pass: ingest Challenge
    await syncBlockRange(mockClient, repo, config, 115n, 125n);
    const chal = (await repo.getChallengesByRefUid(targetVerdictUid))[0];
    expect(chal).toBeDefined();
    expect(chal?.uid).toBe(chalUid);
    expect(chal?.observedVerdict).toBe(1);
    expect(chal?.revocationTime).toBe(0n);

    // Second pass: Revoke Challenge
    revoked = true;
    await syncBlockRange(mockClient, repo, config, 126n, 135n);
    const chalAfterRevoke = (await repo.getChallengesByRefUid(targetVerdictUid))[0];
    expect(chalAfterRevoke?.revocationTime).toBe(1720000000n);
  });

  it("ingests Canary Attested events and updates latest Canary metrics", async () => {
    const repo = new InMemoryIndexerRepository();

    const canaryUid = "0x" + "dd".repeat(32) as Hex;
    const modelHash = "0x" + "11".repeat(32) as Hex;
    const batchId = "0x" + "99".repeat(32) as Hex;
    const labelsCommit = "0x" + "88".repeat(32) as Hex;

    const canaryData = encodeCanaryData({
      modelHash,
      batchId,
      aucBps: 9450,
      eceBps: 450,
      coverageBps: 10000,
      n: 1000,
      labelsCommitHash: labelsCommit,
    });

    const mockCanaryAttestation: OnChainAttestation = {
      uid: canaryUid,
      schema: canarySchemaUID,
      time: 1725000000n,
      expirationTime: 0n,
      revocationTime: 0n,
      refUID: ("0x" + "00".repeat(32)) as Hex,
      recipient: ("0x" + "00".repeat(20)) as Hex,
      attester: ("0x" + "99".repeat(20)) as Hex,
      revocable: true,
      data: canaryData,
    };

    const mockClient = {
      getLogs: vi.fn().mockImplementation(async (params: { event: { name: string } }) => {
        if (params.event.name === "Attested") {
          return [
            {
              blockNumber: 140n,
              args: {
                recipient: mockCanaryAttestation.recipient,
                attester: mockCanaryAttestation.attester,
                uid: canaryUid,
                schemaUID: canarySchemaUID,
              },
            },
          ];
        }
        return [];
      }),
      readContract: vi.fn().mockResolvedValue(mockCanaryAttestation),
    } as unknown as PublicClient;

    await syncBlockRange(mockClient, repo, config, 135n, 145n);

    const latest = await repo.getLatestCanary(modelHash);
    expect(latest).not.toBeNull();
    expect(latest?.uid).toBe(canaryUid);
    expect(latest?.aucBps).toBe(9450);
    expect(latest?.eceBps).toBe(450);
    expect(latest?.n).toBe(1000);
  });

  it("runs reorg-safe runIngest with chunking and persistent block tracking", async () => {
    const repo = new InMemoryIndexerRepository();

    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(150n),
      getLogs: vi.fn().mockResolvedValue([]),
      readContract: vi.fn(),
    } as unknown as PublicClient;

    // Run 1: from startBlock 100n up to 150n
    const res1 = await runIngest(mockClient, repo, { ...config, chunkSize: 25n });
    expect(res1.fromBlock).toBe(100n);
    expect(res1.toBlock).toBe(150n);
    expect(await repo.getSyncBlock(SYNC_KEY)).toBe(150n);

    // Run 2: block head advances to 160n, confirmations = 5n
    (mockClient.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(160n);
    const res2 = await runIngest(mockClient, repo, { ...config, confirmations: 5n });
    // Safe start: 150 - 5 + 1 = 146n
    expect(res2.fromBlock).toBe(146n);
    expect(res2.toBlock).toBe(160n);
    expect(await repo.getSyncBlock(SYNC_KEY)).toBe(160n);
  });
});
