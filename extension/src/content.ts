/**
 * extension/src/content.ts — In-Page Content Script for PRAMANA (T10.2).
 *
 * Injects a minimal, non-intrusive floating verdict badge/card when the user
 * right-clicks an image and selects "Verify with PRAMANA प्रमाण".
 *
 * PRIVACY GUARANTEE (Claim C9):
 * Pure client-side UI layer. Zero user data or media is sent to third parties.
 */

import { ExtensionMessage, PramanaVerdictItem, PramanaVerifyResult } from "./types";

const OVERLAY_ID = "pramana-overlay-root";

/** Ensure overlay container exists in the DOM. */
function getOrCreateRoot(): HTMLElement {
  let root = document.getElementById(OVERLAY_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ID;
    document.body.appendChild(root);
  }
  return root;
}

/** Remove the floating overlay card from DOM. */
function dismissOverlay(): void {
  const root = document.getElementById(OVERLAY_ID);
  if (root) {
    root.innerHTML = "";
  }
}

/** Render loading state. */
function renderLoading(srcUrl: string): void {
  const root = getOrCreateRoot();
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "pramana-card";

  // Header
  card.appendChild(createHeader());

  // Loading Body
  const loading = document.createElement("div");
  loading.className = "pramana-loading";

  const spinner = document.createElement("div");
  spinner.className = "pramana-spinner";

  const text = document.createElement("span");
  text.textContent = "Computing SHA-256 & pHash locally in browser...";

  loading.appendChild(spinner);
  loading.appendChild(text);
  card.appendChild(loading);

  root.appendChild(card);
}

/** Render error state. */
function renderError(error: string): void {
  const root = getOrCreateRoot();
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "pramana-card";

  card.appendChild(createHeader());

  const errBox = document.createElement("div");
  errBox.style.color = "#a1a1aa";
  errBox.style.fontSize = "12px";
  errBox.style.padding = "10px 0";
  errBox.textContent = `Verification error: ${error}`;
  card.appendChild(errBox);

  root.appendChild(card);
}

/** Render verification result card. */
function renderResult(result: PramanaVerifyResult): void {
  const root = getOrCreateRoot();
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "pramana-card";

  // 1. Header
  card.appendChild(createHeader());

  // 2. Status Row
  const statusRow = document.createElement("div");
  statusRow.className = "pramana-status-row";

  const badge = document.createElement("span");
  badge.className = "pramana-verdict-badge";

  if (!result.found) {
    badge.classList.add("pramana-status-none");
    badge.textContent = "No On-Chain Record";
  } else if (result.status === "ACTIVE") {
    badge.classList.add("pramana-status-active");
    badge.textContent = "Active Attestation";
  } else if (result.status === "MODEL_DEGRADED" || result.status === "SUPERSEDED") {
    badge.classList.add("pramana-status-degraded");
    badge.textContent = result.status.replace("_", " ");
  } else if (result.status === "REVOKED") {
    badge.classList.add("pramana-status-revoked");
    badge.textContent = "Attestation Revoked";
  } else {
    badge.classList.add("pramana-status-active");
    badge.textContent = result.status;
  }

  statusRow.appendChild(badge);

  const timeSpan = document.createElement("span");
  timeSpan.style.color = "#71717a";
  timeSpan.style.fontSize = "11px";
  timeSpan.textContent = new Date(result.verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  statusRow.appendChild(timeSpan);

  card.appendChild(statusRow);

  // 3. Field Group (Hashes & Model Info)
  const group = document.createElement("div");
  group.className = "pramana-field-group";

  // SHA-256
  const shaRow = createFieldRow(
    "SHA-256",
    `${result.sha256.slice(0, 8)}...${result.sha256.slice(-6)}`,
    result.sha256
  );
  group.appendChild(shaRow);

  // pHash
  const phashRow = createFieldRow("pHash (64-bit)", result.phash, result.phash);
  group.appendChild(phashRow);

  // Top verdict details if available
  if (result.found && result.verdicts.length > 0) {
    const v: PramanaVerdictItem = result.verdicts[0]!;
    const modelRow = createFieldRow("Model", v.modelName || v.modelId.slice(0, 10));
    group.appendChild(modelRow);

    if (v.score !== undefined) {
      const pct = (v.score * 100).toFixed(1);
      const scoreRow = createFieldRow("Synthetic Likelihood", `${pct}%`);
      group.appendChild(scoreRow);

      const scoreBarBg = document.createElement("div");
      scoreBarBg.className = "pramana-score-bar-bg";
      const scoreBarFill = document.createElement("div");
      scoreBarFill.className = "pramana-score-bar-fill";
      scoreBarFill.style.width = `${Math.min(100, Math.max(0, v.score * 100))}%`;
      scoreBarBg.appendChild(scoreBarFill);
      group.appendChild(scoreBarBg);
    }

    if (v.attester) {
      const attesterRow = createFieldRow(
        "Attester",
        `${v.attester.slice(0, 6)}...${v.attester.slice(-4)}`
      );
      group.appendChild(attesterRow);
    }
  }

  card.appendChild(group);

  // 4. Action Button
  const actions = document.createElement("div");
  actions.className = "pramana-actions";

  const viewLink = document.createElement("a");
  viewLink.className = "pramana-btn pramana-btn-primary";
  viewLink.target = "_blank";
  viewLink.rel = "noopener noreferrer";

  const baseUrl = "http://localhost:3000";
  if (result.found && result.verdicts[0]?.uid) {
    viewLink.href = `${baseUrl}/verdicts/${result.verdicts[0].uid}`;
    viewLink.textContent = "View On-Chain Record →";
  } else {
    viewLink.href = `${baseUrl}/?sha256=${result.sha256}`;
    viewLink.textContent = "Open in PRAMANA Web →";
  }
  actions.appendChild(viewLink);
  card.appendChild(actions);

  // 5. Privacy & Limitations Disclaimers
  const footer = document.createElement("div");
  footer.className = "pramana-footer-disclaimer";

  const privacy = document.createElement("div");
  privacy.className = "pramana-privacy-indicator";
  privacy.innerHTML = `🛡️ <span>Image fingerprinted locally. Media never leaves browser.</span>`;
  footer.appendChild(privacy);

  const disclaimer = document.createElement("div");
  disclaimer.style.marginTop = "4px";
  disclaimer.textContent = "Model-assessed likelihood only — not a ruling. See limitations.";
  footer.appendChild(disclaimer);

  card.appendChild(footer);
  root.appendChild(card);
}

/** Helper: Create card header */
function createHeader(): HTMLElement {
  const header = document.createElement("div");
  header.className = "pramana-header";

  const brand = document.createElement("div");
  brand.className = "pramana-brand";

  // Minimal hairline emblem SVG
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("class", "pramana-logo-svg");
  svg.innerHTML = `
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#fafafa" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4" stroke="#fafafa" stroke-width="1.5"/>
    <line x1="12" y1="3" x2="12" y2="7" stroke="#fafafa" stroke-width="1.5"/>
    <line x1="12" y1="17" x2="12" y2="21" stroke="#fafafa" stroke-width="1.5"/>
    <line x1="3" y1="12" x2="7" y2="12" stroke="#fafafa" stroke-width="1.5"/>
    <line x1="17" y1="12" x2="21" y2="12" stroke="#fafafa" stroke-width="1.5"/>
  `;

  const title = document.createElement("span");
  title.className = "pramana-title";
  title.textContent = "PRAMANA";

  const sanskrit = document.createElement("span");
  sanskrit.className = "pramana-sanskrit";
  sanskrit.textContent = "प्रमाण";

  const testnet = document.createElement("span");
  testnet.className = "pramana-badge-testnet";
  testnet.textContent = "testnet";

  brand.appendChild(svg);
  brand.appendChild(title);
  brand.appendChild(sanskrit);
  brand.appendChild(testnet);
  header.appendChild(brand);

  const closeBtn = document.createElement("button");
  closeBtn.className = "pramana-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "Dismiss";
  closeBtn.onclick = dismissOverlay;
  header.appendChild(closeBtn);

  return header;
}

/** Helper: Create field row with optional copy */
function createFieldRow(label: string, displayVal: string, fullVal?: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "pramana-field";

  const l = document.createElement("span");
  l.className = "pramana-field-label";
  l.textContent = label;

  const v = document.createElement("span");
  v.className = "pramana-field-value";
  v.textContent = displayVal;

  if (fullVal) {
    v.style.cursor = "pointer";
    v.title = "Click to copy full hash";
    v.onclick = () => {
      navigator.clipboard.writeText(fullVal);
      const orig = v.textContent;
      v.textContent = "Copied!";
      setTimeout(() => {
        v.textContent = orig;
      }, 1200);
    };
  }

  row.appendChild(l);
  row.appendChild(v);
  return row;
}

/** Message listener from background service worker */
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ pong: true });
    return true;
  }
  if (message.type === "PRAMANA_FETCH_BLOB_IN_PAGE") {
    (async () => {
      try {
        const resp = await fetch(message.srcUrl);
        const buf = await resp.arrayBuffer();
        sendResponse({ success: true, buffer: Array.from(new Uint8Array(buf)) });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // async
  }
  if (message.type === "PRAMANA_START_VERIFY") {
    renderLoading(message.srcUrl);
  } else if (message.type === "PRAMANA_VERIFY_RESULT") {
    renderResult(message.result);
  } else if (message.type === "PRAMANA_VERIFY_ERROR") {
    renderError(message.error);
  }
  return true;
});
