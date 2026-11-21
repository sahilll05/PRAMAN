/**
 * extension/src/background.ts — Background Service Worker for PRAMANA (T10.2).
 *
 * Implements:
 * - Context menu item: "Verify with PRAMANA प्रमाण" on all <img> elements.
 * - In-worker image blob fetching & local cryptographic/perceptual fingerprinting.
 * - Zero media upload indexer queries.
 * - Extension badge updates & chrome.storage state persistence.
 */

import { fetchVerdicts, getConfig } from "./api";
import { fingerprintImageBlob } from "./fingerprint";
import { ExtensionMessage, PramanaVerifyResult } from "./types";

/** Initialize right-click context menu on extension install or update. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "pramana-verify-image",
      title: "Verify with PRAMANA प्रमाण",
      contexts: ["image"],
    });
  });
});

/** Ensure content script and CSS are injected in the active tab (handles tabs opened before extension load). */
async function ensureInjected(tabId: number): Promise<boolean> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (res?.pong) return true;
  } catch {
    // Content script not yet present
  }
  try {
    if (chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"],
      });
      return true;
    }
  } catch (e) {
    console.warn("Could not inject content script:", e);
  }
  return false;
}

/** Listen for right-click context menu clicks. */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "pramana-verify-image" || !info.srcUrl) return;

  let srcUrl = info.srcUrl;
  const tabId = tab?.id;

  // 1. Ensure content script is injected & get underlying image URL if overlay was clicked
  if (tabId) {
    await ensureInjected(tabId);
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: "PRAMANA_GET_TARGET_IMAGE" });
      if (resp?.realSrc && resp.realSrc !== srcUrl) {
        srcUrl = resp.realSrc;
      }
    } catch {
      // Ignored
    }
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "PRAMANA_START_VERIFY",
        srcUrl,
      } as ExtensionMessage);
    } catch {
      // Content script might not be injected on restricted pages (e.g. chrome://)
    }
  }

  try {
    // 2. Fetch the image blob in the background service worker or in-page if blob: URL
    let blob: Blob;
    if (srcUrl.startsWith("blob:") && tabId) {
      const resp = await chrome.tabs.sendMessage(tabId, {
        type: "PRAMANA_FETCH_BLOB_IN_PAGE",
        srcUrl,
      });
      if (resp?.success && resp.buffer) {
        blob = new Blob([new Uint8Array(resp.buffer)]);
      } else {
        throw new Error(resp?.error || "Could not read in-page blob");
      }
    } else {
      const response = await fetch(srcUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status} ${response.statusText}`);
      }
      blob = await response.blob();
    }

    // 3. Compute SHA-256 and pHash locally in browser memory (zero media upload!)
    const { sha256, phash } = await fingerprintImageBlob(blob);

    // 4. Query PRAMANA Indexer API with hashes only
    const config = await getConfig();
    const result = await fetchVerdicts(sha256, phash, srcUrl, config);

    // 5. Store in local history & update last verification
    await saveVerificationResult(result);

    // 6. Update toolbar extension action badge
    updateExtensionBadge(result);

    // 7. Notify active tab's content script to render the floating verdict card
    if (tabId && config.autoShowOverlay) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: "PRAMANA_VERIFY_RESULT",
          result,
        } as ExtensionMessage);
      } catch {
        // Tab might have been navigated away
      }
    }
  } catch (err: any) {
    const errorMsg = err.message || "Failed to verify image";
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: "PRAMANA_VERIFY_ERROR",
          error: errorMsg,
          srcUrl,
        } as ExtensionMessage);
      } catch {
        // Ignored
      }
    }
  }
});

/** Save verification result into chrome.storage.local. */
async function saveVerificationResult(result: PramanaVerifyResult): Promise<void> {
  const data = await chrome.storage.local.get({ history: [] });
  const history: PramanaVerifyResult[] = data.history || [];
  // Keep last 50 verifications
  const updatedHistory = [result, ...history.filter((h) => h.sha256 !== result.sha256)].slice(0, 50);

  await chrome.storage.local.set({
    lastVerification: result,
    history: updatedHistory,
  });
}

/** Update extension toolbar badge based on verdict result. */
function updateExtensionBadge(result: PramanaVerifyResult): void {
  if (result.found) {
    if (result.status === "ACTIVE") {
      chrome.action.setBadgeText({ text: "VER" });
      chrome.action.setBadgeBackgroundColor({ color: "#27272a" }); // Zinc-800
    } else if (result.status === "MODEL_DEGRADED" || result.status === "SUPERSEDED") {
      chrome.action.setBadgeText({ text: "WARN" });
      chrome.action.setBadgeBackgroundColor({ color: "#71717a" }); // Zinc-500
    } else if (result.status === "REVOKED") {
      chrome.action.setBadgeText({ text: "REV" });
      chrome.action.setBadgeBackgroundColor({ color: "#3f3f46" }); // Zinc-700
    } else {
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#27272a" });
    }
  } else {
    chrome.action.setBadgeText({ text: "0" });
    chrome.action.setBadgeBackgroundColor({ color: "#52525b" }); // Zinc-600
  }
}

/** Listen for messages from popup or content script. */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "PRAMANA_START_VERIFY" || message.type === "PRAMANA_MANUAL_VERIFY") {
    // Return true for async response if needed
    return false;
  }
  return false;
});
