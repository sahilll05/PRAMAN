/**
 * extension/src/popup.ts — Action Toolbar Popup Script for PRAMAN (T10.2).
 */

import { fetchVerdicts, getConfig } from "./api";
import { fingerprintImageBlob } from "./fingerprint";
import { PramanVerifyResult } from "./types";

document.addEventListener("DOMContentLoaded", async () => {
  const config = await getConfig();

  // Elements
  const emptyState = document.getElementById("empty-state");
  const verifiedState = document.getElementById("verified-state");
  const resStatusBadge = document.getElementById("res-status-badge");
  const resTime = document.getElementById("res-time");
  const resSha256 = document.getElementById("res-sha256");
  const resPhash = document.getElementById("res-phash");
  const resModelRow = document.getElementById("res-model-row");
  const resModel = document.getElementById("res-model");
  const resScoreRow = document.getElementById("res-score-row");
  const resScore = document.getElementById("res-score");
  const resLink = document.getElementById("res-link") as HTMLAnchorElement;

  const manualInput = document.getElementById("manual-input") as HTMLInputElement;
  const manualBtn = document.getElementById("manual-btn") as HTMLButtonElement;
  const manualMsg = document.getElementById("manual-msg");
  const manualResult = document.getElementById("manual-result");
  const manStatusBadge = document.getElementById("man-status-badge");
  const manTime = document.getElementById("man-time");
  const manSha256 = document.getElementById("man-sha256");
  const manDetailText = document.getElementById("man-detail-text");
  const manModelRow = document.getElementById("man-model-row");
  const manModel = document.getElementById("man-model");
  const manScoreRow = document.getElementById("man-score-row");
  const manScore = document.getElementById("man-score");
  const manLink = document.getElementById("man-link") as HTMLAnchorElement;

  const toggleSettings = document.getElementById("toggle-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const configApiUrl = document.getElementById("config-api-url") as HTMLInputElement;
  const saveConfigBtn = document.getElementById("save-config-btn");

  if (configApiUrl) {
    configApiUrl.value = config.apiBaseUrl;
  }

  // Settings toggle
  if (toggleSettings && settingsPanel) {
    toggleSettings.addEventListener("click", () => {
      settingsPanel.classList.toggle("active");
    });
  }

  // Save Settings
  if (saveConfigBtn && configApiUrl) {
    saveConfigBtn.addEventListener("click", async () => {
      const url = configApiUrl.value.trim().replace(/\/+$/, "");
      if (chrome?.storage?.sync) {
        await chrome.storage.sync.set({ apiBaseUrl: url, webAppUrl: url });
        saveConfigBtn.textContent = "Saved!";
        setTimeout(() => {
          saveConfigBtn.textContent = "Save";
        }, 1500);
      }
    });
  }

  // Load last verification result from storage
  if (chrome?.storage?.local) {
    const data = await chrome.storage.local.get("lastVerification");
    if (data.lastVerification) {
      displayResult(data.lastVerification);
    }
  }

  // Display result helper
  function displayResult(result: PramanVerifyResult): void {
    if (!emptyState || !verifiedState) return;
    emptyState.style.display = "none";
    verifiedState.style.display = "block";

    if (resStatusBadge) {
      resStatusBadge.textContent = result.found ? result.status.replace("_", " ") : "NO RECORD";
      resStatusBadge.style.borderColor = result.found ? "#3f3f46" : "#27272a";
      resStatusBadge.style.color = result.found ? "#fafafa" : "#a1a1aa";
    }

    if (resTime) {
      resTime.textContent = new Date(result.verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    if (resSha256) {
      resSha256.textContent = `${result.sha256.slice(0, 10)}...${result.sha256.slice(-8)}`;
      resSha256.title = result.sha256;
    }

    if (resPhash) {
      resPhash.textContent = result.phash || "None";
    }

    if (result.found && result.verdicts.length > 0) {
      const v = result.verdicts[0]!;
      if (resModelRow && resModel) {
        resModelRow.style.display = "flex";
        resModel.textContent = v.modelName || v.modelId.slice(0, 12);
      }
      if (resScoreRow && resScore && typeof v.score === "number") {
        resScoreRow.style.display = "flex";
        resScore.textContent = `${(v.score * 100).toFixed(1)}%`;
      }
      if (resLink) {
        const base = config.webAppUrl || "http://localhost:3000";
        resLink.href = v.uid ? `${base}/verdicts/${v.uid}` : `${base}/?sha256=${result.sha256}`;
        resLink.textContent = "View On-Chain Record →";
      }
    } else {
      if (resModelRow) resModelRow.style.display = "none";
      if (resScoreRow) resScoreRow.style.display = "none";
      if (resLink) {
        const base = config.webAppUrl || "http://localhost:3000";
        resLink.href = `${base}/?sha256=${result.sha256}`;
        resLink.textContent = "Open in PRAMAN Web →";
      }
    }
  }

  // Display result in manual lookup card helper
  function displayManualResult(result: PramanVerifyResult): void {
    if (!manualResult) return;
    manualResult.style.display = "block";

    if (manStatusBadge) {
      if (result.found) {
        manStatusBadge.textContent = result.status.replace("_", " ");
        manStatusBadge.style.borderColor = "#3f3f46";
        manStatusBadge.style.color = "#fafafa";
      } else {
        manStatusBadge.textContent = "NO ON-CHAIN RECORD";
        manStatusBadge.style.borderColor = "#27272a";
        manStatusBadge.style.color = "#a1a1aa";
      }
    }

    if (manTime) {
      manTime.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    if (manSha256) {
      manSha256.textContent = `${result.sha256.slice(0, 10)}...${result.sha256.slice(-8)}`;
      manSha256.title = result.sha256;
    }

    if (result.found && result.verdicts.length > 0) {
      const v = result.verdicts[0]!;
      if (manDetailText) {
        manDetailText.textContent = "On-chain EAS attestation verified on Base Sepolia.";
      }
      if (manModelRow && manModel) {
        manModelRow.style.display = "flex";
        manModel.textContent = v.modelName || v.modelId.slice(0, 12);
      }
      if (manScoreRow && manScore && typeof v.score === "number") {
        manScoreRow.style.display = "flex";
        manScore.textContent = `${(v.score * 100).toFixed(1)}%`;
      }
      if (manLink) {
        const base = config.webAppUrl || "http://localhost:3000";
        manLink.href = v.uid ? `${base}/verdicts/${v.uid}` : `${base}/?sha256=${result.sha256}`;
        manLink.textContent = "View On-Chain Record →";
      }
    } else {
      if (manDetailText) {
        manDetailText.textContent =
          "No on-chain attestation found. If this is a locally protected image, verify its signed .pramana receipt in the Web Verifier.";
      }
      if (manModelRow) manModelRow.style.display = "none";
      if (manScoreRow) manScoreRow.style.display = "none";
      if (manLink) {
        const base = config.webAppUrl || "http://localhost:3000";
        manLink.href = `${base}/?sha256=${result.sha256}`;
        manLink.textContent = "Open in PRAMAN Web Verifier →";
      }
    }
  }

  // Handle manual lookup Enter key
  if (manualInput) {
    manualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        manualBtn?.click();
      }
    });
  }

  // Handle manual lookup
  if (manualBtn && manualInput) {
    manualBtn.addEventListener("click", async () => {
      const rawVal = manualInput.value.trim();
      if (!rawVal) return;

      if (manualMsg) {
        manualMsg.style.display = "block";
        manualMsg.style.color = "#a1a1aa";
        manualMsg.textContent = "Querying on-chain registry...";
      }
      if (manualResult) {
        manualResult.style.display = "none";
      }

      try {
        let sha256 = "";
        let phash = "";

        const cleanVal = rawVal.replace(/^0x/i, "");
        if (/^[0-9a-fA-F]{64}$/.test(cleanVal)) {
          // Input is a 64-character SHA-256 hash (with or without 0x)
          sha256 = cleanVal.toLowerCase();
        } else if (/^https?:\/\//i.test(rawVal) || /^data:image\//i.test(rawVal)) {
          // Input is an Image URL: fetch blob and fingerprint locally
          const resp = await fetch(rawVal);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const fp = await fingerprintImageBlob(blob);
          sha256 = fp.sha256;
          phash = fp.phash;
        } else {
          throw new Error("Enter a valid 64-char SHA-256 hash (e.g. 0x...) or Image URL");
        }

        const res = await fetchVerdicts(sha256, phash, rawVal, config);
        displayManualResult(res);
        if (chrome?.storage?.local) {
          await chrome.storage.local.set({ lastVerification: res });
        }

        if (manualMsg) {
          manualMsg.style.display = "none";
        }
      } catch (err: any) {
        if (manualMsg) {
          manualMsg.style.display = "block";
          manualMsg.style.color = "#f43f5e";
          manualMsg.textContent = `Error: ${err.message}`;
        }
      }
    });
  }
});
