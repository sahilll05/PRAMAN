import { describe, it, expect } from "vitest";
import {
  generateProtectReceipt,
  verifyProtectReceipt,
  PramanaReceiptSchema,
  createCanonicalPayload,
  bufferToBase64,
  base64ToBuffer,
} from "../lib/protect";

describe("PRAMANA Protect Mode — Cryptographic Receipts (Task T10.1, Claim C13)", () => {
  const sampleMedia = {
    fileName: "artist_original_artwork.png",
    fileSize: 1048576,
    sha256Hex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    pHashHex: "0123456789abcdef",
  };

  it("generates a valid .pramana receipt satisfying Zod schema", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);

    expect(receipt.version).toBe("pramana-receipt-v1");
    expect(receipt.protocol).toBe("PRAMANA");
    expect(receipt.mode).toBe("protect");
    expect(receipt.media.fileName).toBe(sampleMedia.fileName);
    expect(receipt.media.fileSize).toBe(sampleMedia.fileSize);
    expect(receipt.media.sha256).toBe(sampleMedia.sha256Hex);
    expect(receipt.media.pHash).toBe(sampleMedia.pHashHex);
    expect(receipt.signer.algorithm).toBe("ECDSA");
    expect(receipt.signer.namedCurve).toBe("P-256");
    expect(receipt.signer.publicKeyJwk.kty).toBe("EC");
    expect(receipt.signer.publicKeyJwk.crv).toBe("P-256");
    expect(typeof receipt.signature).toBe("string");
    expect(receipt.signature.length).toBeGreaterThan(20);

    // Schema validation passes
    const parseResult = PramanaReceiptSchema.safeParse(receipt);
    expect(parseResult.success).toBe(true);
  });

  it("verifies genuine receipts successfully", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);
    const verification = await verifyProtectReceipt(receipt);

    expect(verification.valid).toBe(true);
    expect(verification.error).toBeUndefined();
    expect(verification.receipt?.media.sha256).toBe(sampleMedia.sha256Hex);
  });

  it("detects tampered SHA-256 hash in receipt", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);

    // Tamper with sha256
    const tampered = {
      ...receipt,
      media: {
        ...receipt.media,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      },
    };

    const verification = await verifyProtectReceipt(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Cryptographic signature mismatch");
  });

  it("detects tampered pHash in receipt", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);

    // Tamper with pHash
    const tampered = {
      ...receipt,
      media: {
        ...receipt.media,
        pHash: "ffffffffffffffff",
      },
    };

    const verification = await verifyProtectReceipt(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Cryptographic signature mismatch");
  });

  it("detects tampered timestamp in receipt", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);

    // Tamper with timestamp
    const tampered = {
      ...receipt,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    };

    const verification = await verifyProtectReceipt(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Cryptographic signature mismatch");
  });

  it("detects tampered signature in receipt", async () => {
    const receipt = await generateProtectReceipt(sampleMedia);

    // Tamper with signature
    const sigBytes = base64ToBuffer(receipt.signature);
    sigBytes[0] = (sigBytes[0]! ^ 0xff); // flip bits
    const tampered = {
      ...receipt,
      signature: bufferToBase64(sigBytes),
    };

    const verification = await verifyProtectReceipt(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Cryptographic signature mismatch");
  });

  it("rejects malformed or invalid receipt structures", async () => {
    const invalidReceipts = [
      null,
      {},
      { version: "wrong-version" },
      { ...sampleMedia, version: "pramana-receipt-v1" },
      {
        version: "pramana-receipt-v1",
        protocol: "PRAMANA",
        mode: "protect",
        timestamp: "invalid-date",
        media: sampleMedia,
        watermark: { status: "none" },
        signer: { algorithm: "ECDSA", namedCurve: "P-256", publicKeyJwk: {} },
        signature: "abc",
      },
    ];

    for (const inv of invalidReceipts) {
      const res = await verifyProtectReceipt(inv);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it("encodes and decodes base64 buffers consistently", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4]);
    const b64 = bufferToBase64(original);
    const decoded = base64ToBuffer(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});
