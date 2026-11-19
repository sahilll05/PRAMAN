"""Test TrustMark watermarker adapter."""

import pytest
from PIL import Image

from lv_ml.watermark.trustmark_adapter import TrustMarkWatermarker


def test_trustmark_adapter_encode_decode():
    wm = TrustMarkWatermarker()
    if not wm.is_available:
        pytest.skip("TrustMark model weights not available.")

    # Create synthetic RGB test image
    img = Image.new("RGB", (256, 256), color=(100, 150, 200))
    test_id = 0x123456789A

    stego, psnr, ssim = wm.encode(img, test_id)
    assert psnr > 35.0, f"PSNR too low: {psnr}"
    assert ssim > 0.95, f"SSIM too low: {ssim}"

    decoded_id, is_valid = wm.decode(stego)
    assert is_valid, "Decode failed to detect valid watermark"
    assert decoded_id == test_id, f"Expected {hex(test_id)}, got {hex(decoded_id)}"

    # Decode unwatermarked image should yield is_valid = False
    clean_id, clean_valid = wm.decode(img)
    err_msg = f"Expected clean image is_valid=False, got {clean_valid} (id={clean_id})"
    assert not clean_valid, err_msg
