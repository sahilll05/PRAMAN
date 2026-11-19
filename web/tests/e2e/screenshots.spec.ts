import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = "C:/Users/Sahil/.gemini/antigravity/brain/53895e59-d7c7-4553-90b3-24eb4bfe019f";

test.describe("PRAMANA Visual Live Verification", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test("Capture screenshots of all routes and dropzone flow", async ({ page }) => {
    // 1. Home page
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("AI Image Authenticity");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-home.png"), fullPage: true });

    // 2. Perform file upload in dropzone
    const TINY_PNG_BASE64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "sample-photograph.png",
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
    });

    await expect(page.locator("text=SHA-256")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=pHash")).toBeVisible();
    await page.waitForTimeout(500); // UI transition
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-dropzone-analyzed.png"), fullPage: true });

    // 3. Models page
    await page.goto("http://localhost:3000/models");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Detector");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-models.png"), fullPage: true });

    // 4. Canary page
    await page.goto("http://localhost:3000/canary");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Canary");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-canary.png"), fullPage: true });

    // 5. Attesters page
    await page.goto("http://localhost:3000/attesters");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Attester");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-attesters.png"), fullPage: true });

    // 6. Limitations page
    await page.goto("http://localhost:3000/limitations");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Limitations");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "screenshot-limitations.png"), fullPage: true });
  });
});
