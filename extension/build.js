/**
 * extension/build.js — Production Build & Bundle Script for PRAMANA Extension (T10.2).
 */

import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, "dist");
const PUBLIC_DIR = path.join(__dirname, "public");
const SRC_DIR = path.join(__dirname, "src");

async function build() {
  console.log("🚀 Building PRAMANA Extension (Chrome MV3 + Firefox WebExtension)...");

  // Ensure clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 1. Bundle Background Service Worker (ESM format)
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, "background.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    outfile: path.join(DIST_DIR, "background.js"),
    sourcemap: false,
    minify: false,
  });
  console.log("  ✓ Built background.js (ESM)");

  // 2. Bundle Content Script (IIFE format for universal web page compatibility)
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, "content.ts")],
    bundle: true,
    format: "iife",
    target: "es2022",
    outfile: path.join(DIST_DIR, "content.js"),
    sourcemap: false,
    minify: false,
  });
  console.log("  ✓ Built content.js (IIFE)");

  // 3. Bundle Popup Script (IIFE format)
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, "popup.ts")],
    bundle: true,
    format: "iife",
    target: "es2022",
    outfile: path.join(DIST_DIR, "popup.js"),
    sourcemap: false,
    minify: false,
  });
  console.log("  ✓ Built popup.js (IIFE)");

  // 4. Copy Static Assets
  // manifest.json
  fs.copyFileSync(
    path.join(PUBLIC_DIR, "manifest.json"),
    path.join(DIST_DIR, "manifest.json")
  );

  // popup.html
  fs.copyFileSync(
    path.join(PUBLIC_DIR, "popup.html"),
    path.join(DIST_DIR, "popup.html")
  );

  // content.css
  fs.copyFileSync(
    path.join(SRC_DIR, "content.css"),
    path.join(DIST_DIR, "content.css")
  );

  // icons
  const iconsDist = path.join(DIST_DIR, "icons");
  fs.mkdirSync(iconsDist, { recursive: true });
  const iconsPublic = path.join(PUBLIC_DIR, "icons");
  if (fs.existsSync(iconsPublic)) {
    for (const iconFile of fs.readdirSync(iconsPublic)) {
      fs.copyFileSync(
        path.join(iconsPublic, iconFile),
        path.join(iconsDist, iconFile)
      );
    }
  }
  console.log("  ✓ Copied static assets (manifest.json, popup.html, content.css, icons)");

  // 5. Package zip for distribution
  try {
    const { execSync } = await import("node:child_process");
    execSync("python scripts/package_zip.py", { cwd: __dirname, stdio: "inherit" });
  } catch (err) {
    console.warn("  ⚠ Note: package_zip.py skipped:", err.message);
  }

  console.log("\n🎉 Extension built successfully in extension/dist!");
  console.log("   - Load unpacked in Chrome/Brave/Edge: navigate to chrome://extensions and select extension/dist");
  console.log("   - Load in Firefox: navigate to about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> select extension/dist/manifest.json");
}

build().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
