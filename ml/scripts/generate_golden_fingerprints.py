"""Generate canonical golden test vectors for spec s4 fingerprints.

Populates spec/vectors/fingerprint_v1.json with reference images and patterns,
computing SHA-256 and pHash for cross-language validation between Python and TypeScript.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from lv_ml.fingerprint.phash import compute_phash


def matrix_to_png_bytes(matrix: np.ndarray) -> bytes:
    """Save 2D float/uint8 matrix as lossless PNG bytes."""
    uint8_mat = np.clip(matrix, 0, 255).astype(np.uint8)
    img = Image.fromarray(uint8_mat, mode="L")
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_patterns() -> list[dict[str, Any]]:
    vectors: list[dict[str, Any]] = []

    # 1. Horizontal gradient
    x_coords = np.linspace(0, 255, 32)
    mat_hgrad = np.tile(x_coords, (32, 1)).astype(np.uint8)
    png_hgrad = matrix_to_png_bytes(mat_hgrad)
    phash_hgrad = compute_phash(Image.fromarray(mat_hgrad, mode="L"))
    vectors.append({
        "id": "horizontal_gradient_32x32",
        "description": "Linear horizontal gradient from 0 to 255 across 32 columns",
        "width": 32,
        "height": 32,
        "sha256": hashlib.sha256(png_hgrad).hexdigest(),
        "phash_dec": str(phash_hgrad),
        "phash_hex": hex(phash_hgrad)[2:].zfill(16),
        "matrix32x32": mat_hgrad.tolist(),
        "wmId": "0",
    })

    # 2. Vertical gradient
    y_coords = np.linspace(0, 255, 32)[:, np.newaxis]
    mat_vgrad = np.tile(y_coords, (1, 32)).astype(np.uint8)
    png_vgrad = matrix_to_png_bytes(mat_vgrad)
    phash_vgrad = compute_phash(Image.fromarray(mat_vgrad, mode="L"))
    vectors.append({
        "id": "vertical_gradient_32x32",
        "description": "Linear vertical gradient from 0 to 255 across 32 rows",
        "width": 32,
        "height": 32,
        "sha256": hashlib.sha256(png_vgrad).hexdigest(),
        "phash_dec": str(phash_vgrad),
        "phash_hex": hex(phash_vgrad)[2:].zfill(16),
        "matrix32x32": mat_vgrad.tolist(),
        "wmId": "0",
    })

    # 3. 4x4 block checkerboard
    mat_checker = np.zeros((32, 32), dtype=np.float64)
    for r in range(32):
        for c in range(32):
            if ((r // 4) + (c // 4)) % 2 == 1:
                mat_checker[r, c] = 255.0
    png_checker = matrix_to_png_bytes(mat_checker)
    phash_checker = compute_phash(Image.fromarray(mat_checker.astype(np.uint8), mode="L"))
    vectors.append({
        "id": "checkerboard_4x4_blocks",
        "description": "32x32 checkerboard with 4x4 alternating blocks",
        "width": 32,
        "height": 32,
        "sha256": hashlib.sha256(png_checker).hexdigest(),
        "phash_dec": str(phash_checker),
        "phash_hex": hex(phash_checker)[2:].zfill(16),
        "matrix32x32": mat_checker.tolist(),
        "wmId": "0",
    })

    # 4. Diagonal stripe
    mat_diag = np.zeros((32, 32), dtype=np.float64)
    for r in range(32):
        for c in range(32):
            mat_diag[r, c] = float(((r + c) % 8) * 32)
    png_diag = matrix_to_png_bytes(mat_diag)
    phash_diag = compute_phash(Image.fromarray(mat_diag.astype(np.uint8), mode="L"))
    vectors.append({
        "id": "diagonal_stripes_32x32",
        "description": "Periodic diagonal stripes (period 8)",
        "width": 32,
        "height": 32,
        "sha256": hashlib.sha256(png_diag).hexdigest(),
        "phash_dec": str(phash_diag),
        "phash_hex": hex(phash_diag)[2:].zfill(16),
        "matrix32x32": mat_diag.tolist(),
        "wmId": "0",
    })

    # 5. Center Circle
    mat_circle = np.zeros((32, 32), dtype=np.uint8)
    for r in range(32):
        for c in range(32):
            if (r - 15.5) ** 2 + (c - 15.5) ** 2 <= 64:
                mat_circle[r, c] = 255
    png_circle = matrix_to_png_bytes(mat_circle)
    phash_circle = compute_phash(Image.fromarray(mat_circle, mode="L"))
    vectors.append({
        "id": "center_circle_32x32",
        "description": "Centered solid circle with radius 8 pixels",
        "width": 32,
        "height": 32,
        "sha256": hashlib.sha256(png_circle).hexdigest(),
        "phash_dec": str(phash_circle),
        "phash_hex": hex(phash_circle)[2:].zfill(16),
        "matrix32x32": mat_circle.tolist(),
        "wmId": "0",
    })

    # 6. Real photographic reference image (COCO)
    repo_root = Path(__file__).resolve().parents[2]
    coco_path = repo_root / "dataset" / "coco" / "images" / "000000304180.jpg"
    if coco_path.exists():
        img_coco = Image.open(coco_path).convert("RGB")
        luma_coco = img_coco.convert("L").resize((32, 32), resample=Image.Resampling.BOX)
        mat_coco = np.asarray(luma_coco, dtype=np.uint8)
        phash_coco = compute_phash(img_coco)
        vectors.append({
            "id": "real_coco_000000304180",
            "description": "Authentic COCO val2017 reference image crop",
            "width": 32,
            "height": 32,
            "sha256": hashlib.sha256(coco_path.read_bytes()).hexdigest(),
            "phash_dec": str(phash_coco),
            "phash_hex": hex(phash_coco)[2:].zfill(16),
            "matrix32x32": mat_coco.tolist(),
            "wmId": "0",
        })

    # 7. Synthetic reference image (CF-Small)
    cf_path = repo_root / "dataset" / "cf_small" / "images" / "bguisard_stable-diffusion-nano-2-1_00000161.png"
    if cf_path.exists():
        img_cf = Image.open(cf_path).convert("RGB")
        luma_cf = img_cf.convert("L").resize((32, 32), resample=Image.Resampling.BOX)
        mat_cf = np.asarray(luma_cf, dtype=np.uint8)
        phash_cf = compute_phash(img_cf)
        vectors.append({
            "id": "synthetic_cf_small_nano_00000161",
            "description": "Synthetic Stable Diffusion Nano reference image",
            "width": 32,
            "height": 32,
            "sha256": hashlib.sha256(cf_path.read_bytes()).hexdigest(),
            "phash_dec": str(phash_cf),
            "phash_hex": hex(phash_cf)[2:].zfill(16),
            "matrix32x32": mat_cf.tolist(),
            "wmId": "0",
        })

    return vectors


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    vectors_dir = repo_root / "spec" / "vectors"
    vectors_file = vectors_dir / "fingerprint_v1.json"

    patterns = generate_patterns()

    output = {
        "specVersion": "0.1.0-draft",
        "description": "PRAMAN spec s4 golden test vectors for cross-language SHA-256 and pHash validation",
        "algorithm": "DCT-II top-left 8x8 median AC big-endian uint64",
        "count": len(patterns),
        "vectors": patterns,
    }

    with open(vectors_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {len(patterns)} golden fingerprint vectors into {vectors_file}")
    for p in patterns:
        print(f"  [{p['id']}] pHash: {p['phash_hex']} (dec: {p['phash_dec']}) | sha256: {p['sha256'][:16]}...")


if __name__ == "__main__":
    main()
