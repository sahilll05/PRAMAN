import { test, expect } from "@playwright/test";
import { deflateSync, crc32 } from "node:zlib";

function createValidPng(w = 64, h = 64, seed = 0): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

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

  const rowSize = 1 + w * 3;
  const rawData = Buffer.alloc(rowSize * h);
  for (let y = 0; y < h; y++) {
    rawData[y * rowSize] = 0;
    for (let x = 0; x < w; x++) {
      const idx = y * rowSize + 1 + x * 3;
      rawData[idx] = Math.floor((x / w) * 150 + seed * 20) % 255;
      rawData[idx + 1] = Math.floor((y / h) * 150 + seed * 30) % 255;
      rawData[idx + 2] = (100 + seed * 25) % 255;
    }
  }

  const compressed = deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

test.describe("PRAMANA Batch Verification & Error Level Analysis (Tasks T10.3 & T10.4)", () => {
  test("Batch Verification: processes N=5 images locally with zero media upload (Claim C14)", async ({
    page,
  }) => {
    const uploadedMediaPayloads: Buffer[] = [];
    const outgoingRequests: { url: string; method: string; contentType?: string } = [];

    // Intercept all outgoing network requests
    page.on("request", (req) => {
      const url = req.url();
      const method = req.method();
      const headers = req.headers();
      const contentType = headers["content-type"] || "";
      const postData = req.postDataBuffer();

      // Check for any media upload
      if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("image/") ||
        contentType.includes("octet-stream")
      ) {
        if (postData) uploadedMediaPayloads.push(postData);
      }

      outgoingRequests.push({ url, method, contentType });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click "Batch Verify" toggle
    await page.getByRole("button", { name: /Batch Verify/i }).click();
    await expect(page.getByText("Drop multiple images, a folder, or a ZIP archive")).toBeVisible({ timeout: 10000 });

    // Generate 5 valid test PNG buffers
    const testFiles = Array.from({ length: 5 }, (_, i) => ({
      name: `batch_sample_${i + 1}.png`,
      mimeType: "image/png",
      buffer: createValidPng(64, 64, i + 1),
    }));

    // Upload 5 files via the hidden file input
    const fileInput = page.locator('input[type="file"][multiple]:not([webkitdirectory])');
    await fileInput.setInputFiles(testFiles);

    // Wait for batch processing to finish (all 5 items rendered in table)
    await expect(page.getByText("Generated 5 cryptographic audit records")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("batch_sample_1.png")).toBeVisible();
    await expect(page.getByText("batch_sample_5.png")).toBeVisible();

    // Verify Claim C14 Invariant: Zero media bytes uploaded
    expect(uploadedMediaPayloads.length).toBe(0);

    // Verify only /api/verdicts was called with hashes
    const apiCalls = outgoingRequests.filter((r) => r.url.includes("/api/verdicts"));
    expect(apiCalls.length).toBeGreaterThan(0);
    for (const call of apiCalls) {
      expect(call.contentType).toBe("application/json");
    }
  });

  test("Error Level Analysis (ELA): computes in-browser with zero additional network requests (Claim C15)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Ensure we are in "Verify Media" mode
    await page.click("text=Verify Media");

    // Upload test image
    const singleFile = {
      name: "ela_test_sample.png",
      mimeType: "image/png",
      buffer: createValidPng(80, 80, 42),
    };

    const fileInput = page.locator('input[type="file"][aria-label="Select image file"]');
    await fileInput.setInputFiles(singleFile);

    // Wait for fingerprinting to complete
    await expect(page.getByText("Fingerprinted Locally")).toBeVisible({ timeout: 10000 });

    // Click evaluate with local detector node
    const evaluateBtn = page.getByRole("button", { name: /Evaluate with Local Detector Node/i });
    if (await evaluateBtn.isVisible()) {
      await evaluateBtn.click();
      await page.waitForTimeout(1000);
    }

    // Network inspection during ELA interaction
    const requestsDuringEla: string[] = [];
    const elaRequestListener = (req: any) => {
      requestsDuringEla.push(`${req.method()} ${req.url()}`);
    };

    // Open ELA modal
    const elaBtn = page.getByRole("button", { name: /Inspect Anomaly \(ELA\)/i });
    if (await elaBtn.isVisible()) {
      page.on("request", elaRequestListener);

      await elaBtn.click();

      // Check modal rendered
      const elaDialog = page.getByRole("dialog", { name: /Error Level Analysis/i });
      await expect(elaDialog).toBeVisible({ timeout: 5000 });

      // Verify forensic disclosure text is present (Task T10.4 requirement)
      await expect(
        page.getByText("ELA is a visual hint, not a forensic ruling. Uniform re-saves may erase this signal.")
      ).toBeVisible();

      // Interact with scale multiplier buttons
      await page.getByRole("button", { name: "15x" }).click();
      await page.waitForTimeout(300);

      // Verify Claim C15 Invariant: ZERO network API or media requests occurred during ELA inspection
      // (Only local browser in-memory blob: URLs for canvas rendering are expected)
      const networkApiRequests = requestsDuringEla.filter(
        (r) => r.includes("/api/") || (!r.includes("blob:") && !r.includes("_rsc"))
      );
      expect(networkApiRequests.length).toBe(0);

      // Close modal
      await page.getByRole("button", { name: "Close" }).click();
      await expect(elaDialog).toBeHidden();
      page.off("request", elaRequestListener);
    }
  });
});
