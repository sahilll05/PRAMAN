# PRAMANA प्रमाण — Browser Extension (T10.2)
> Privacy-first, zero-media-upload right-click image verifier for Chrome, Brave, Edge, and Firefox.

## Overview
The PRAMANA Browser Extension brings decentralized media provenance directly into daily web browsing. When reading articles, browsing social media (X/Twitter, Reddit), or investigating media, right-click any image and select **"Verify with PRAMANA प्रमाण"**.

### Privacy & Verification Architecture (Claim C9)
- **Local Fingerprinting**: The extension computes the cryptographic SHA-256 and the canonical Spec §4 64-bit perceptual hash (pHash) **100% locally in browser memory** using Web Crypto and Canvas APIs.
- **Zero Media Upload**: Raw image bytes **never leave your device**. Only the resulting hash strings are queried against the PRAMANA Indexer API.
- **In-Page Floating Verdict Badge**: Displays the active on-chain attestation status (`ACTIVE`, `MODEL_DEGRADED`, `SUPERSEDED`, `REVOKED`, or `NO ON-CHAIN RECORD`), model confidence score, attester, timestamp, and a direct link to the on-chain EAS attestation record.
- **Action Toolbar Popup**: Review your last verified image, perform manual hash/URL lookups, and configure endpoint settings.

---

## Sideload Installation Guide

### Chrome / Brave / Edge (Manifest V3)
1. Build the extension:
   ```bash
   pnpm --dir extension run build
   ```
2. Open your browser and navigate to `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the directory:
   `PRAMANA/extension/dist`
5. The PRAMANA emblem will appear in your extensions toolbar.

### Firefox (WebExtension)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `PRAMANA/extension/dist/manifest.json` or the packaged zip `extension/dist/pramana-extension-v0.1.0.zip`.

---

## Store Publishing Policy (D-EXTENSION-PUBLISH)
Per project zero-spend policy:
- **Chrome Web Store**: One-time $5 USD registration fee is **deferred** until explicitly approved by the human operator. Open-source `.zip` and unpacked builds are provided.
- **Firefox Add-ons (AMO)**: Free listing (no fee required).

---

## Testing & Verification
Run the unit test suite:
```bash
pnpm --dir extension run test
pnpm --dir extension run typecheck
```
Suite verifies:
- 100% bit-exact agreement with Spec §4 golden test vectors (`spec/vectors/fingerprint_v1.json`).
- Network privacy invariants (strictly GET requests with no body, zero media bytes uploaded).
- Manifest V3 integrity and permissions.
