"""Unit tests for perceptual hash (pHash) implementation."""

import numpy as np
from PIL import Image

from lv_ml.fingerprint.phash import compute_phash, hamming_distance


def test_phash_returns_uint64() -> None:
    # Create simple solid color image
    img = Image.new("RGB", (100, 100), color=(128, 64, 32))
    h = compute_phash(img)
    assert isinstance(h, int)
    assert 0 <= h < (1 << 64)


def test_phash_deterministic() -> None:
    # Random reproducible image
    rng = np.random.default_rng(42)
    arr = rng.integers(0, 256, (128, 128, 3), dtype=np.uint8)
    img1 = Image.fromarray(arr, "RGB")
    img2 = Image.fromarray(arr.copy(), "RGB")

    h1 = compute_phash(img1)
    h2 = compute_phash(img2)
    assert h1 == h2
    assert hamming_distance(h1, h2) == 0


def test_phash_sensitivity_to_different_content() -> None:
    img1 = Image.new("RGB", (64, 64), color="black")
    # Diagonal stripe pattern
    arr = np.zeros((64, 64, 3), dtype=np.uint8)
    for i in range(64):
        arr[i, i, :] = 255
    img2 = Image.fromarray(arr, "RGB")

    h1 = compute_phash(img1)
    h2 = compute_phash(img2)
    assert h1 != h2
    assert hamming_distance(h1, h2) > 0


def test_hamming_distance() -> None:
    assert hamming_distance(0, 0) == 0
    assert hamming_distance(1, 0) == 1
    assert hamming_distance(0b1101, 0b1000) == 2
