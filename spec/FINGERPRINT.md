# spec/FINGERPRINT.md — Fingerprint Algorithm Specification v1

> This document is normative. Code must match it exactly. Changing any algorithm requires bumping
> `spec_schemas.md` version and updating golden vectors in `spec/vectors/fingerprint_v1.json`.

## 1. SHA-256 Hash

`sha256Hash` = SHA-256 of the **raw file bytes** (not decoded pixels).

No preprocessing. Deterministic. Sensitive to any byte change (compression, metadata).

## 2. Perceptual Hash (pHash) — spec §4

**Input**: file path (or raw bytes).

**Algorithm** (spec-exact; both Python and TypeScript must implement identically):

1. Decode image to **RGB** using the standard decoder for the format.
2. Convert to **grayscale luma**: `Y = 0.299·R + 0.587·G + 0.114·B` (ITU-R BT.601 luma weights).
   - Apply per-pixel, on float values in [0, 255].
3. **Resize** to **32×32** using **box (area-average)** filter. No other filter.
4. Apply **2D DCT-II** to the 32×32 float matrix.
5. Take the **top-left 8×8 sub-matrix** (64 coefficients, DC at [0,0]).
6. Compute the **median** of the **63 non-DC coefficients** (exclude [0,0]).
7. For each of the 63 non-DC coefficients in **row-major order**:
   - bit = 1 if coefficient > median, else 0.
   - DC bit (position 0) is always **0**.
8. Pack the resulting 64 bits **big-endian** into a **uint64**.

**Known issue**: different JPEG decoders may produce slightly different RGB values → pHash may differ
by a few bits. The Hamming threshold T (chosen in Phase 3, logged in decisions.md) absorbs this.

**Video**: pHash of each sampled frame independently. A video's representative pHash = pHash of the
**middle sampled frame** (index ⌊N/2⌋ of the N uniformly sampled frames). sha256 is of the full file.

## 3. TrustMark Watermark ID (wmId)

- Library: `trustmark` (pip install trustmark), variant **Q** (default), encoding **BCH_5** (default).
- Payload: 40-bit random ID, stored as **uint64** (upper 24 bits = 0).
- **Decode**: return 0 if no watermark detected or decode fails. Never throw on missing watermark.
- **Encode** (by content creator, optional): embed a 40-bit ID; register as soft-binding (stretch).
- Limitations: center-crop for extreme aspect ratios; variant-specific decoding (Q cannot decode P/C/B).
  Document these in the web verifier UI.

## 4. Video Sampling

- Sample **N = 16** frames uniformly spaced from the video duration.
- If a face is detected (use OpenCV Haar or dnn detector, fixed model), crop to face with fixed margin.
- If no face: use full frame.
- Frame indices: `floor(i * total_frames / N)` for i in 0..N-1.

## 5. Golden Vectors

See `spec/vectors/fingerprint_v1.json` (created in T3.1). Contains:
- Reference image(s) with known sha256Hash, pHash, wmId.
- Intermediate values (grayscale matrix sample, DCT sample) for debugging.
- Both Python and TypeScript CI tests must reproduce all values exactly.
