import { test, expect } from "@playwright/test";

// Minimal valid 1x1 red PNG buffer
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TEST_IMAGE_BUFFER = Buffer.from(TINY_PNG_BASE64, "base64");

test.describe("PRAMANA Protect Mode & Creator Notary (Task T10.1, Claim C13)", () => {
  test("generates signed .pramana receipt locally with zero media upload", async ({
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

    // 4. Input file into hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "original-artwork-test.png",
      mimeType: "image/png",
      buffer: TEST_IMAGE_BUFFER,
    });

    // 5. Verify local receipt generation and UI update
    await expect(
      page.locator("text=Authenticity Receipt Generated")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Locally Signed (ECDSA P-256)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download .pramana Receipt/i })
    ).toBeVisible();
    await expect(page.locator("text=SHA-256 Hash")).toBeVisible();
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
      name: /Have a .pramana receipt\? Verify cryptographic integrity here/i,
    });
    await openModalBtn.click();

    await expect(
      page.locator("text=Verify .pramana Receipt")
    ).toBeVisible();
    await expect(
      page.locator("text=Validate cryptographic ECDSA signature")
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
    await expect(page.locator("text=Verify .pramana Receipt")).not.toBeVisible();
  });
});
