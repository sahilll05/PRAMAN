import { test, expect } from "@playwright/test";
import { deflateSync, crc32 } from "node:zlib";

function createValidPng(w = 64, h = 64): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdrChunk = makeChunk("IHDR", ihdrData);

  // Scanlines: 1 filter byte (0) + w * 3 bytes RGB per line
  const rowSize = 1 + w * 3;
  const rawData = Buffer.alloc(rowSize * h);
  for (let y = 0; y < h; y++) {
    rawData[y * rowSize] = 0;
    for (let x = 0; x < w; x++) {
      const idx = y * rowSize + 1 + x * 3;
      rawData[idx] = Math.floor((x / w) * 150 + 40);
      rawData[idx + 1] = Math.floor((y / h) * 150 + 40);
      rawData[idx + 2] = 120;
    }
  }

  const compressed = deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const TEST_PNG_64 = createValidPng(64, 64);

test.describe("PRAMAN Protect Mode & Digital Watermarking (Tasks T10.1 & T10.1b)", () => {
  test("embeds digital watermark and generates signed .pramana receipt locally with zero media upload", async ({
    page,
  }) => {
    const interceptedRequests: Array<{
      url: string;
      method: string;
      postData: string | null;
      headers: Record<string, string>;
    }> = [];

    // 1. Listen to all outgoing network requests
    page.on("request", (request) => {
      interceptedRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        headers: request.headers(),
      });
    });

    // 2. Navigate to web verifier home page
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("AI Image Authenticity Verifier");

    // 3. Switch to Protect Original mode
    const protectButton = page.getByRole("button", { name: /Protect Original/i });
    await protectButton.click();
    await expect(page.locator("h1")).toContainText("Digital Authenticity Notary");

    // Clear network requests after page load/mode toggle
    interceptedRequests.length = 0;

    // 4. Input 64x64 file into hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "original-artwork-test.png",
      mimeType: "image/png",
      buffer: TEST_PNG_64,
    });

    // 5. Verify local receipt and watermark generation and UI update
    await expect(
      page.locator("text=Authenticity Receipt Generated")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Locally Signed (ECDSA P-256)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download \.praman Receipt/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download Watermarked Image/i })
    ).toBeVisible();
    await expect(page.locator("text=SHA-256 Hash")).toBeVisible();
    await expect(page.locator("text=Digital Watermark Payload")).toBeVisible();
    await expect(
      page.getByText("ECDSA P-256 Signature", { exact: true })
    ).toBeVisible();

    // 6. Test self-verification button in browser Web Crypto
    const verifySelfButton = page.getByRole("button", {
      name: /Test Cryptographic Verification In Browser/i,
    });
    await verifySelfButton.click();
    await expect(
      page.locator("text=Signature strictly verified")
    ).toBeVisible({ timeout: 5000 });

    // 7. Verify PRIVACY: Zero media uploaded over network during Protect flow
    for (const req of interceptedRequests) {
      if (req.method === "POST" || req.method === "PUT") {
        const contentType = req.headers["content-type"] || "";
        expect(contentType).not.toContain("multipart/form-data");
        expect(contentType).not.toContain("image/");
        expect(contentType).not.toContain("application/octet-stream");
      }
    }
  });

  test("opens receipt verification modal and validates receipt input", async ({
    page,
  }) => {
    await page.goto("/");

    // Click modal trigger
    const openModalBtn = page.getByRole("button", {
      name: /Have a \.praman receipt\? Verify cryptographic integrity here/i,
    });
    await openModalBtn.click();

    await expect(
      page.locator("text=Verify .praman Receipt")
    ).toBeVisible();

    // Enter a mock invalid json to test failure reporting
    const textarea = page.locator("textarea");
    await textarea.fill('{"invalid": true}');

    await expect(
      page.locator("text=Invalid Receipt — Cryptographic Check Failed")
    ).toBeVisible({ timeout: 5000 });

    // Close modal
    const closeBtn = page.getByRole("button", { name: "Close" });
    await closeBtn.click();
    await expect(page.locator("text=Verify .praman Receipt")).not.toBeVisible();
  });
});
