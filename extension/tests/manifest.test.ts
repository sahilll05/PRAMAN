import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

describe("Extension Manifest & Build Integrity (T10.2)", () => {
  const distDir = resolve(__dirname, "../dist");
  const manifestPath = resolve(distDir, "manifest.json");

  it("manifest.json exists in dist and is valid Manifest V3", () => {
    expect(existsSync(manifestPath)).toBe(true);

    const content = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toContain("PRAMANA");
    expect(manifest.name).toContain("प्रमाण");
    expect(manifest.version).toBe("0.1.0");

    // Permissions
    expect(manifest.permissions).toContain("contextMenus");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.permissions).toContain("activeTab");

    // Host permissions for cross-origin image fetching
    expect(manifest.host_permissions).toContain("<all_urls>");

    // Service Worker
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.background.type).toBe("module");

    // Content scripts
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    expect(manifest.content_scripts[0].js).toContain("content.js");
    expect(manifest.content_scripts[0].css).toContain("content.css");

    // Firefox Gecko ID
    expect(manifest.browser_specific_settings?.gecko?.id).toBe("pramana-verifier@pramana.local");
  });

  it("all bundled files and declared assets exist in dist with non-zero size", () => {
    const requiredFiles = [
      "background.js",
      "content.js",
      "content.css",
      "popup.html",
      "popup.js",
      "manifest.json",
      "icons/icon16.png",
      "icons/icon48.png",
      "icons/icon128.png",
    ];

    for (const relPath of requiredFiles) {
      const fullPath = resolve(distDir, relPath);
      expect(existsSync(fullPath), `Missing file: ${relPath}`).toBe(true);

      const stats = statSync(fullPath);
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});
