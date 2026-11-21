"""Experiment E7: TrustMark Watermark Survival Benchmark under Transformations.

Pre-registered in Evaluation Protocol:
- Evaluates TrustMark variant Q encode/decode survival under realistic image degradations.
- Measures decode success rate, PSNR, and SSIM across varying WM_STRENGTH and transforms.
"""

from __future__ import annotations

import io
import json
import time
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

from lv_ml.watermark.trustmark_adapter import TrustMarkWatermarker


def apply_jpeg(img: Image.Image, quality: int) -> Image.Image:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def apply_resize(img: Image.Image, scale: float) -> Image.Image:
    w, h = img.size
    new_w = max(32, int(w * scale))
    new_h = max(32, int(h * scale))
    down = img.resize((new_w, new_h), resample=Image.Resampling.BILINEAR)
    return down.resize((w, h), resample=Image.Resampling.BILINEAR)


def apply_blur(img: Image.Image, radius: float = 1.0) -> Image.Image:
    return img.filter(ImageFilter.GaussianBlur(radius=radius))


class ExperimentE7Runner:
    """Executes Experiment E7 watermark benchmark."""

    def __init__(self, repo_root: str | Path, n_samples: int = 20) -> None:
        self.root = Path(repo_root)
        self.n_samples = n_samples
        self.results_dir = self.root / "results" / "E7"
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.watermarker = TrustMarkWatermarker()

    def run(self) -> dict[str, Any]:
        print(f"=== Starting Experiment E7: TrustMark Benchmark on {self.n_samples} images ===")
        split_path = self.root / "dataset" / "splits" / "balanced_test_indomain.json"
        with open(split_path, encoding="utf-8") as f:
            records = json.load(f)

        selected = records[: self.n_samples]

        psnr_list: list[float] = []
        ssim_list: list[float] = []

        decode_results: dict[str, list[bool]] = {
            "clean_stego": [],
            "jpeg_95": [],
            "jpeg_75": [],
            "jpeg_50": [],
            "jpeg_30": [],
            "resize_075": [],
            "resize_050": [],
            "blur_10": [],
        }

        # Test false positive decode on unwatermarked images
        unmarked_false_positives = 0
        for rec in selected:
            img_path = self.root / rec["local_path"]
            raw_img = Image.open(img_path).convert("RGB")
            wm_id_unmarked, is_valid = self.watermarker.decode(raw_img)
            if is_valid and wm_id_unmarked != 0:
                unmarked_false_positives += 1

        print(f"Unmarked False Positives: {unmarked_false_positives}/{len(selected)}")

        # Watermark encode and degradation stress test
        for idx, rec in enumerate(selected):
            img_path = self.root / rec["local_path"]
            img = Image.open(img_path).convert("RGB")
            # Generate 40-bit ID
            wm_id = int((idx + 1) * 123456789 + 987654321) & 0xFFFFFFFFFF

            stego_img, psnr, ssim = self.watermarker.encode(img, wm_id, wm_strength=1.0)
            psnr_list.append(psnr)
            ssim_list.append(ssim)

            # Test clean decode
            dec_id, ok = self.watermarker.decode(stego_img)
            decode_results["clean_stego"].append(ok and (dec_id == wm_id))

            # Test JPEG degradations
            for q in [95, 75, 50, 30]:
                deg = apply_jpeg(stego_img, quality=q)
                d_id, d_ok = self.watermarker.decode(deg)
                decode_results[f"jpeg_{q}"].append(d_ok and (d_id == wm_id))

            # Test Resize degradations
            for s, s_name in [(0.75, "resize_075"), (0.50, "resize_050")]:
                deg = apply_resize(stego_img, scale=s)
                d_id, d_ok = self.watermarker.decode(deg)
                decode_results[s_name].append(d_ok and (d_id == wm_id))

            # Test Blur
            deg_blur = apply_blur(stego_img, radius=1.0)
            d_id, d_ok = self.watermarker.decode(deg_blur)
            decode_results["blur_10"].append(d_ok and (d_id == wm_id))

        rates = {k: float(np.mean(v)) for k, v in decode_results.items()}
        avg_psnr = float(np.mean(psnr_list))
        avg_ssim = float(np.mean(ssim_list))

        summary = {
            "experiment": "E7",
            "task": "T3.3",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "watermark_model": "TrustMark variant Q (BCH_5)",
            "n_samples": self.n_samples,
            "average_psnr_db": avg_psnr,
            "average_ssim": avg_ssim,
            "unmarked_false_positive_rate": unmarked_false_positives / len(selected),
            "survival_rates": rates,
        }

        print("\n==================== [E7 Summary] ====================")
        print(f"Average PSNR: {avg_psnr:.2f} dB | Average SSIM: {avg_ssim:.4f}")
        print(f"Clean Stego Recovery Rate: {rates['clean_stego']:.2%}")
        print(f"JPEG 95 Recovery Rate: {rates['jpeg_95']:.2%} | JPEG 75: {rates['jpeg_75']:.2%} | JPEG 50: {rates['jpeg_50']:.2%}")
        print(f"Resize 0.75 Recovery Rate: {rates['resize_075']:.2%} | Resize 0.50: {rates['resize_050']:.2%}")
        print(f"Blur 1.0 Recovery Rate: {rates['blur_10']:.2%}")

        out_metrics = self.results_dir / "metrics.json"
        with open(out_metrics, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        return summary
