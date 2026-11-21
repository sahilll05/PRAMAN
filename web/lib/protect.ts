/**
 * web/lib/protect.ts — PRAMANA "Protect Mode" Creator Tool (Task T10.1).
 *
 * Generates and verifies client-side cryptographically signed `.pramana` receipts.
 * Uses Web Crypto API (SubtleCrypto ECDSA P-256 with SHA-256).
 *
 * CLAIMS & WORDING RULES:
 * - Protect Mode generates a locally-signed record of content hash and timestamp.
 * - NEVER claim "proves ownership", "proves authenticity", or "tamper-proof".
 * - Media never leaves the browser. Zero network uploads.
 */

import { z } from "zod";

/** Zod schema defining the tamper-evident structure of a .pramana receipt */
export const PramanaReceiptSchema = z.object({
  version: z.literal("pramana-receipt-v1"),
  protocol: z.literal("PRAMANA"),
  mode: z.literal("protect"),
  timestamp: z.string().datetime(),
  media: z.object({
    fileName: z.string().min(1),
    fileSize: z.number().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i, "SHA-256 must be 64 hex characters"),
    pHash: z.string().regex(/^[0-9a-f]{16}$/i, "pHash must be 16 hex characters"),
  }),
  watermark: z.object({
    status: z.enum(["none", "pending_v2", "embedded"]),
    trustmarkId: z.string().nullable().optional(),
  }),
  signer: z.object({
    algorithm: z.literal("ECDSA"),
    namedCurve: z.literal("P-256"),
    publicKeyJwk: z.object({
      kty: z.literal("EC"),
      crv: z.literal("P-256"),
      x: z.string(),
      y: z.string(),
      ext: z.boolean().optional(),
      key_ops: z.array(z.string()).optional(),
    }),
  }),
  signature: z.string().min(1), // Base64 encoded ECDSA P-256 signature
});

export type PramanaReceipt = z.infer<typeof PramanaReceiptSchema>;

/** Create deterministic canonical payload for signature computation */
export function createCanonicalPayload(data: {
  version: string;
  protocol: string;
  mode: string;
  timestamp: string;
  media: {
    fileName: string;
    fileSize: number;
    sha256: string;
    pHash: string;
  };
  watermark: {
    status: string;
    trustmarkId?: string | null;
  };
}): Uint8Array {
  const canonicalObj = {
    version: data.version,
    protocol: data.protocol,
    mode: data.mode,
    timestamp: data.timestamp,
    media: {
      fileName: data.media.fileName,
      fileSize: data.media.fileSize,
      sha256: data.media.sha256.toLowerCase(),
      pHash: data.media.pHash.toLowerCase(),
    },
    watermark: {
      status: data.watermark.status,
      trustmarkId: data.watermark.trustmarkId ?? null,
    },
  };
  return new TextEncoder().encode(JSON.stringify(canonicalObj));
}

/** Binary buffer to standard Base64 string */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Standard Base64 string to Uint8Array */
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically signed .pramana receipt locally using Web Crypto API.
 * Uses ECDSA P-256 key pair. Media never leaves browser memory.
 */
export async function generateProtectReceipt(params: {
  fileName: string;
  fileSize: number;
  sha256Hex: string;
  pHashHex: string;
  customTimestamp?: string;
  trustmarkId?: string | null;
  watermarkStatus?: "none" | "pending_v2" | "embedded";
}): Promise<PramanaReceipt> {
  const subtle = crypto.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (SubtleCrypto) is not available in this environment.");
  }

  // 1. Generate ephemeral ECDSA P-256 keypair
  const keyPair = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  // 2. Export public key as JWK
  const jwk = await subtle.exportKey("jwk", keyPair.publicKey);

  const timestamp = params.customTimestamp ?? new Date().toISOString();

  const receiptData = {
    version: "pramana-receipt-v1" as const,
    protocol: "PRAMANA" as const,
    mode: "protect" as const,
    timestamp,
    media: {
      fileName: params.fileName,
      fileSize: params.fileSize,
      sha256: params.sha256Hex.toLowerCase(),
      pHash: params.pHashHex.toLowerCase(),
    },
    watermark: {
      status: params.watermarkStatus ?? (params.trustmarkId ? ("embedded" as const) : ("none" as const)),
      trustmarkId: params.trustmarkId ?? null,
    },
  };

  // 3. Construct canonical payload and sign
  const canonicalPayload = createCanonicalPayload(receiptData);
  const signatureBuffer = await subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    keyPair.privateKey,
    canonicalPayload as unknown as BufferSource
  );

  const signature = bufferToBase64(signatureBuffer);

  const receipt: PramanaReceipt = {
    ...receiptData,
    signer: {
      algorithm: "ECDSA",
      namedCurve: "P-256",
      publicKeyJwk: {
        kty: "EC",
        crv: "P-256",
        x: jwk.x!,
        y: jwk.y!,
        ext: jwk.ext,
        key_ops: jwk.key_ops,
      },
    },
    signature,
  };

  return receipt;
}

/**
 * Verify a .pramana receipt against its embedded ECDSA public key.
 * Confirms that the receipt content has not been tampered with since creation.
 */
export async function verifyProtectReceipt(rawReceipt: unknown): Promise<{
  valid: boolean;
  error?: string;
  receipt?: PramanaReceipt;
}> {
  const parseResult = PramanaReceiptSchema.safeParse(rawReceipt);
  if (!parseResult.success) {
    return {
      valid: false,
      error: `Invalid receipt structure: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
    };
  }
  const receipt = parseResult.data;

  const subtle = crypto.subtle;
  if (!subtle) {
    return { valid: false, error: "SubtleCrypto not available in this environment." };
  }

  try {
    const publicKey = await subtle.importKey(
      "jwk",
      receipt.signer.publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    const canonicalPayload = createCanonicalPayload(receipt);
    const signatureBytes = base64ToBuffer(receipt.signature);

    const isValid = await subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      publicKey,
      signatureBytes as unknown as BufferSource,
      canonicalPayload as unknown as BufferSource
    );

    if (!isValid) {
      return {
        valid: false,
        error: "Cryptographic signature mismatch: receipt content was altered or forged.",
      };
    }

    return { valid: true, receipt };
  } catch (err: any) {
    return {
      valid: false,
      error: `Signature verification failed: ${err.message || String(err)}`,
    };
  }
}

/** Trigger browser file download of .pramana JSON receipt */
export function downloadReceiptFile(receipt: PramanaReceipt): void {
  if (typeof window === "undefined") return;
  const jsonStr = JSON.stringify(receipt, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const baseName = receipt.media.fileName.replace(/\.[^/.]+$/, "");
  a.href = url;
  a.download = `${baseName}.pramana`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
