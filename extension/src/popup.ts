/**
 * extension/src/popup.ts — Action Toolbar Popup Script for PRAMANA (T10.2).
 */

import { fetchVerdicts, getConfig } from "./api";
import { fingerprintImageBlob } from "./fingerprint";
import { PramanaVerifyResult } from "./types";

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
  function displayResult(result: PramanaVerifyResult): void {
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
        resLink.textContent = "Open in PRAMANA Web →";
      }
    }
  }

  // Handle manual lookup
  if (manualBtn && manualInput) {
    manualBtn.addEventListener("click", async () => {
      const val = manualInput.value.trim();
      if (!val) return;

      if (manualMsg) {
        manualMsg.style.display = "block";
        manualMsg.textContent = "Verifying locally...";
      }

      try {
        let sha256 = "";
        let phash = "0000000000000000";

        if (/^[0-9a-fA-F]{64}$/.test(val)) {
          // Input is already a 64-character SHA-256 hash
          sha256 = val.toLowerCase();
        } else if (/^https?:\/\//i.test(val) || /^data:image\//i.test(val)) {
          // Input is an Image URL: fetch blob and fingerprint locally
          const resp = await fetch(val);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const fp = await fingerprintImageBlob(blob);
          sha256 = fp.sha256;
          phash = fp.phash;
        } else {
          throw new Error("Enter a valid 64-char SHA-256 hash or Image URL");
        }

        const res = await fetchVerdicts(sha256, phash, val, config);
        displayResult(res);

        if (manualMsg) {
          manualMsg.style.display = "none";
        }
      } catch (err: any) {
        if (manualMsg) {
          manualMsg.style.display = "block";
          manualMsg.textContent = `Error: ${err.message}`;
        }
      }
    });
  }
});
