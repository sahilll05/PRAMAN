import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchVerdicts, aggregateVerdictStatus, DEFAULT_CONFIG } from "../src/api";
import { PramanaVerdictItem } from "../src/types";

describe("Extension API Client & Privacy Audit (T10.2, Claim C9)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("strictly makes a GET request with zero media payload (Claim C9)", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            uid: "0x1234",
            modelId: "model-a-linear",
            score: 0.95,
            status: "ACTIVE",
            attester: "0xAttester1",
            timestamp: 1732000000,
          },
        ],
      } as Response;
    });

    const sha256 = "aae1857d38543ce72fb56537373378b721b9c50ba0c67f48080df75a6c0a581d";
    const phash = "2a00000000000000";
    const srcUrl = "https://example.com/test.png";

    const res = await fetchVerdicts(sha256, phash, srcUrl, DEFAULT_CONFIG);

    // 1. Verify URL and query params
    expect(capturedUrl).toContain("/api/verdicts?");
    expect(capturedUrl).toContain(`sha256=${sha256}`);
    expect(capturedUrl).toContain(`phash=${phash}`);

    // 2. PRIVACY GUARANTEE: Confirm no media bytes in body or payload
    expect(capturedInit?.method).toBe("GET");
    expect(capturedInit?.body).toBeUndefined();
    expect(capturedInit?.headers).toEqual({ Accept: "application/json" });

    // 3. Verify verdict parsing
    expect(res.found).toBe(true);
    expect(res.status).toBe("ACTIVE");
    expect(res.verdicts.length).toBe(1);
    expect(res.verdicts[0]?.score).toBe(0.95);
  });

  it("returns NO_VERDICTS_FOUND when API returns empty array or 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    const res = await fetchVerdicts(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "0000000000000000",
      "https://example.com/notfound.png",
      DEFAULT_CONFIG
    );

    expect(res.found).toBe(false);
    expect(res.status).toBe("NO_VERDICTS_FOUND");
    expect(res.verdicts).toEqual([]);
  });

  it("handles network failure cleanly without crashing", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const res = await fetchVerdicts(
      "1111111111111111111111111111111111111111111111111111111111111111",
      "1111111111111111",
      "https://example.com/offline.png",
      DEFAULT_CONFIG
    );

    expect(res.found).toBe(false);
    expect(res.status).toBe("NO_VERDICTS_FOUND");
    expect(res.error).toContain("Network connection refused");
  });

  it("correctly aggregates verdict status hierarchy per spec §6", () => {
    const vActive: PramanaVerdictItem = {
      uid: "0x1",
      modelId: "m1",
      score: 0.1,
      status: "ACTIVE",
      attester: "0xa",
      timestamp: 100,
    };
    const vDegraded: PramanaVerdictItem = {
      uid: "0x2",
      modelId: "m2",
      score: 0.9,
      status: "MODEL_DEGRADED",
      attester: "0xb",
      timestamp: 200,
    };
    const vRevoked: PramanaVerdictItem = {
      uid: "0x3",
      modelId: "m3",
      score: 0.8,
      status: "REVOKED",
      attester: "0xc",
      timestamp: 300,
    };

    expect(aggregateVerdictStatus([])).toBe("NO_VERDICTS_FOUND");
    expect(aggregateVerdictStatus([vActive])).toBe("ACTIVE");
    expect(aggregateVerdictStatus([vActive, vDegraded])).toBe("MODEL_DEGRADED");
    expect(aggregateVerdictStatus([vActive, vDegraded, vRevoked])).toBe("REVOKED");
  });
});
