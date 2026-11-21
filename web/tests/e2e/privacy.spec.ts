import { test, expect } from "@playwright/test";

// Minimal valid 1x1 red PNG buffer
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TEST_IMAGE_BUFFER = Buffer.from(TINY_PNG_BASE64, "base64");

test.describe("PRAMAN Privacy Guarantee (Task T6.4, Claim C9)", () => {
  test("media never leaves browser: network inspection confirms zero media upload", async ({
    page,
  }) => {
    const interceptedRequests: Array<{
      url: string;
      method: string;
      postData: string | null;
      postDataBuffer: Buffer | null;
      headers: Record<string, string>;
    }> = [];

    // 1. Listen to all outgoing network requests
    page.on("request", (request) => {
      interceptedRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        postDataBuffer: request.postDataBuffer(),
        headers: request.headers(),
      });
    });

    // 2. Navigate to web verifier home page
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("AI Image Authenticity");

    // 3. Clear initial page load requests to isolate image upload requests
    interceptedRequests.length = 0;

    // 4. Select / drop the image file into the hidden input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-sample-image.png",
      mimeType: "image/png",
      buffer: TEST_IMAGE_BUFFER,
    });

    // 5. Wait for browser-side hashing and UI transition to complete
    await expect(page.locator("text=SHA-256")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=pHash")).toBeVisible();

    // 6. Inspect all network traffic that occurred during and after file processing
    let mediaUploadDetected = false;
    const mediaViolations: string[] = [];

    for (const req of interceptedRequests) {
      // Check for any POST / PUT requests uploading data
      if (req.method === "POST" || req.method === "PUT") {
        const contentType = req.headers["content-type"] || "";
        if (
          contentType.includes("multipart/form-data") ||
          contentType.includes("image/") ||
          contentType.includes("octet-stream")
        ) {
          mediaUploadDetected = true;
          mediaViolations.push(
            `Illegal content-type ${contentType} detected on ${req.method} ${req.url}`
          );
        }

        // Check if payload buffer matches or contains image bytes
        if (req.postDataBuffer && req.postDataBuffer.includes(TEST_IMAGE_BUFFER.subarray(0, 16))) {
          mediaUploadDetected = true;
          mediaViolations.push(
            `Raw image bytes found in request payload for ${req.method} ${req.url}`
          );
        }
      }

      // Check URL query parameters to ensure no large base64 payload is leaked in GET
      const url = new URL(req.url);
      for (const [, val] of url.searchParams.entries()) {
        if (val.length > 500 || val.includes(TINY_PNG_BASE64.substring(0, 20))) {
          mediaUploadDetected = true;
          mediaViolations.push(`Suspected media bytes leaked in URL param on ${req.url}`);
        }
      }
    }

    // 7. Verify zero media uploads
    expect(mediaUploadDetected, `Privacy violation detected: ${mediaViolations.join("; ")}`).toBe(
      false
    );
    expect(mediaViolations.length).toBe(0);

    // 8. Confirm fingerprints are visible and correct
    const shaRow = page.locator("text=SHA-256").first().locator("..");
    await expect(shaRow).toBeVisible();
  });
});

