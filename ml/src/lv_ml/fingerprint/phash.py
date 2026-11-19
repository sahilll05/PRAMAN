"""spec §4 / spec/FINGERPRINT.md Perceptual Hash (pHash) implementation.

Normative implementation:
1. Decode image to RGB.
2. Convert to grayscale luma: Y = 0.299*R + 0.587*G + 0.114*B (float in [0, 255]).
3. Resize to 32x32 using box (area-average) filter.
4. Apply 2D DCT-II to the 32x32 float matrix.
5. Take the top-left 8x8 sub-matrix (64 coefficients, DC at [0,0]).
6. Compute the median of the 63 non-DC coefficients (exclude [0,0]).
7. In row-major order: bit = 1 if coef > median else 0. Position 0 (DC bit) is always 0.
8. Pack 64 bits big-endian into a uint64.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image
from scipy.fft import dct


def compute_phash(image: Image.Image | bytes) -> int:
    """Compute 64-bit perceptual hash according to PRAMANA spec §4.

    Args:
        image: PIL Image instance or raw image bytes.

    Returns:
        64-bit unsigned integer pHash.
    """
    if isinstance(image, bytes):
        pil_img = Image.open(io.BytesIO(image))
    else:
        pil_img = image

    # 1. Decode image to RGB
    rgb_img = pil_img.convert("RGB")

    # 2. Convert to grayscale luma Y = 0.299*R + 0.587*G + 0.114*B
    rgb_array = np.asarray(rgb_img, dtype=np.float64)
    luma = 0.299 * rgb_array[:, :, 0] + 0.587 * rgb_array[:, :, 1] + 0.114 * rgb_array[:, :, 2]

    # Convert back to PIL Image (mode 'F') to apply box filter resizing
    luma_img = Image.fromarray(luma, mode="F")

    # 3. Resize to 32x32 using box (area-average) filter
    resized_img = luma_img.resize((32, 32), resample=Image.Resampling.BOX)
    matrix = np.asarray(resized_img, dtype=np.float64)

    # 4. Apply 2D DCT-II (type=2, norm=None as standard unnormalized DCT-II)
    # 2D DCT = 1D DCT along axis 0, then 1D DCT along axis 1
    dct_2d = dct(dct(matrix, type=2, axis=0), type=2, axis=1)

    # 5. Take top-left 8x8 sub-matrix
    dct_8x8 = dct_2d[:8, :8]

    # 6. Compute median of the 63 non-DC coefficients (exclude [0,0])
    ac_coeffs = np.concatenate([dct_8x8[0, 1:], dct_8x8[1:, :].flatten()])
    median_val = float(np.median(ac_coeffs))

    # 7. For each coefficient in row-major order:
    # bit = 1 if coef > median else 0. Position 0 (DC bit) is always 0.
    bits: list[int] = [0]  # DC bit is always 0
    for r in range(8):
        for c in range(8):
            if r == 0 and c == 0:
                continue
            bits.append(1 if dct_8x8[r, c] > median_val else 0)

    # 8. Pack 64 bits big-endian into uint64
    phash_uint64 = 0
    for b in bits:
        phash_uint64 = (phash_uint64 << 1) | b

    return phash_uint64


def hamming_distance(hash1: int, hash2: int) -> int:
    """Compute Hamming distance between two 64-bit hashes."""
    return (hash1 ^ hash2).bit_count()
