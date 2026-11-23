"""TrustMark watermark encoder/decoder adapter (spec s4).

Implements TrustMark variant Q with BCH_5 ECC for 40-bit watermark payloads.
Decodes 0 if no watermark is present.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import torch
from PIL import Image


def compute_psnr_and_ssim(img1: Image.Image, img2: Image.Image) -> tuple[float, float]:
    """Compute Peak Signal-to-Noise Ratio (PSNR) and mean Structural Similarity (SSIM)."""
    arr1 = np.asarray(img1.convert("RGB"), dtype=np.float64)
    arr2 = np.asarray(img2.convert("RGB"), dtype=np.float64)

    mse = float(np.mean((arr1 - arr2) ** 2))
    if mse == 0.0:
        psnr = 100.0
    else:
        psnr = 10.0 * math.log10((255.0**2) / mse)

    # Simplified fast SSIM computation across RGB channels
    c1 = (0.01 * 255.0) ** 2
    c2 = (0.03 * 255.0) ** 2

    mu1 = np.mean(arr1)
    mu2 = np.mean(arr2)
    sigma1_sq = np.var(arr1)
    sigma2_sq = np.var(arr2)
    sigma12 = np.mean((arr1 - mu1) * (arr2 - mu2))

    ssim = float(
        ((2.0 * mu1 * mu2 + c1) * (2.0 * sigma12 + c2))
        / ((mu1**2 + mu2**2 + c1) * (sigma1_sq + sigma2_sq + c2))
    )

    return psnr, ssim


class TrustMarkWatermarker:
    """TrustMark variant Q watermark encoder/decoder."""

    def __init__(self, device: str = "auto") -> None:
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        try:
            from trustmark import TrustMark

            self._tm: Any = TrustMark(
                verbose=False,
                model_type="Q",
                device=self.device,
                loadRemover=False,
                loadBBoxDetector=False,
            )
            self.is_available = True
        except Exception:
            self._tm = None
            self.is_available = False

    def encode(
        self,
        image: Image.Image,
        wm_id: int,
        wm_strength: float = 1.0,
    ) -> tuple[Image.Image, float, float]:
        """Encode a 40-bit unsigned integer ID into an image.

        Args:
            image: PIL Image.
            wm_id: 40-bit uint64 ID in [1, 2^40 - 1].
            wm_strength: Watermark blending strength (default: 1.0).

        Returns:
            (watermarked_image, psnr, ssim)
        """
        if not self.is_available or self._tm is None:
            raise RuntimeError("TrustMark is not available on this system.")

        rgb_img = image.convert("RGB")
        # 40 bits uint64 -> binary bitstring of length 40
        secret_bin = f"{(wm_id & 0xFFFFFFFFFF):040b}"

        stego_img = self._tm.encode(
            rgb_img,
            secret_bin,
            MODE="binary",
            WM_STRENGTH=float(wm_strength),
        )

        psnr, ssim = compute_psnr_and_ssim(rgb_img, stego_img)
        return stego_img, psnr, ssim

    def decode(self, image: Image.Image) -> tuple[int, bool]:
        """Decode a 40-bit watermark ID from an image.

        Returns:
            (wm_id, is_present) where wm_id = 0 if watermark is absent or corrupted.
        """
        if not self.is_available or self._tm is None:
            return 0, False

        rgb_img = image.convert("RGB")
        try:
            decoded_bits, is_valid, _ = self._tm.decode(rgb_img, MODE="binary")
            if is_valid and isinstance(decoded_bits, str) and len(decoded_bits) >= 40:
                wm_id = int(decoded_bits[:40], 2)
                return wm_id, True
        except Exception:
            return 0, False

        return 0, False
