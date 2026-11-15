"""T1.0 Dataset Verification Script.

Loads 100 samples from OwensLab/CommunityForensics-Small and ComplexDataLab/OpenFake (core).
Verifies:
- Keys present
- Label types and values
- Generator metadata (model names)
- Image validity (PIL open, resolution, mode)
- HF card / license metadata via HfApi
Outputs results to results/T1.0/dataset_verification.json
"""

import io
import json
from pathlib import Path
from typing import Any

from datasets import load_dataset
from huggingface_hub import HfApi
from PIL import Image


def inspect_cf_small(n_samples: int = 100) -> dict[str, Any]:
    print(f"\n--- Streaming {n_samples} samples from OwensLab/CommunityForensics-Small ---")
    ds = load_dataset("OwensLab/CommunityForensics-Small", split="train", streaming=True)

    samples_checked = 0
    keys_seen = set()
    label_counts: dict[str, int] = {}
    generators_seen: dict[str, int] = {}
    resolutions_seen: dict[str, int] = {}
    modes_seen: dict[str, int] = {}
    errors: list[str] = []

    first_sample_keys = []

    for item in ds:
        if samples_checked >= n_samples:
            break

        current_keys = list(item.keys())
        keys_seen.update(current_keys)
        if not first_sample_keys:
            first_sample_keys = current_keys

        # Check label
        lbl = str(item.get("label"))
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

        # Check generator / model_name
        model_name = str(item.get("model_name"))
        generators_seen[model_name] = generators_seen.get(model_name, 0) + 1

        # Check image
        img_data = item.get("image_data")
        try:
            if isinstance(img_data, bytes):
                img = Image.open(io.BytesIO(img_data))
            elif hasattr(img_data, "convert"):
                img = img_data
            else:
                img = Image.open(io.BytesIO(bytes(img_data)))

            modes_seen[img.mode] = modes_seen.get(img.mode, 0) + 1
            res_str = f"{img.size[0]}x{img.size[1]}"
            resolutions_seen[res_str] = resolutions_seen.get(res_str, 0) + 1
        except Exception as e:
            errors.append(f"Sample {samples_checked} image error: {e!s}")

        samples_checked += 1
        if samples_checked % 25 == 0:
            print(f"  CF-Small: {samples_checked}/{n_samples} samples processed...")

    sorted_generators = sorted(generators_seen.items(), key=lambda x: x[1], reverse=True)[:10]
    sorted_resolutions = sorted(resolutions_seen.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "dataset": "OwensLab/CommunityForensics-Small",
        "samples_checked": samples_checked,
        "keys": sorted(keys_seen),
        "first_sample_keys": first_sample_keys,
        "label_counts": label_counts,
        "unique_generators_count": len(generators_seen),
        "generator_distribution_sample": dict(sorted_generators),
        "image_modes": modes_seen,
        "resolutions_sample": dict(sorted_resolutions),
        "errors": errors,
    }


def inspect_openfake_core(n_samples: int = 100) -> dict[str, Any]:
    print(f"\n--- Streaming {n_samples} samples from ComplexDataLab/OpenFake (core) ---")
    ds = load_dataset("ComplexDataLab/OpenFake", "core", split="train", streaming=True)

    samples_checked = 0
    keys_seen = set()
    label_counts: dict[str, int] = {}
    generators_seen: dict[str, int] = {}
    release_dates_seen: dict[str, int] = {}
    modes_seen: dict[str, int] = {}
    resolutions_seen: dict[str, int] = {}
    errors: list[str] = []

    first_sample_keys = []

    for item in ds:
        if samples_checked >= n_samples:
            break

        current_keys = list(item.keys())
        keys_seen.update(current_keys)
        if not first_sample_keys:
            first_sample_keys = current_keys

        lbl = str(item.get("label"))
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

        model_name = str(item.get("model"))
        generators_seen[model_name] = generators_seen.get(model_name, 0) + 1

        rel_date = str(item.get("release_date"))
        release_dates_seen[rel_date] = release_dates_seen.get(rel_date, 0) + 1

        img = item.get("image")
        try:
            if hasattr(img, "size"):
                modes_seen[img.mode] = modes_seen.get(img.mode, 0) + 1
                res_str = f"{img.size[0]}x{img.size[1]}"
                resolutions_seen[res_str] = resolutions_seen.get(res_str, 0) + 1
            else:
                errors.append(f"Sample {samples_checked} image is not a PIL Image: {type(img)}")
        except Exception as e:
            errors.append(f"Sample {samples_checked} image error: {e!s}")

        samples_checked += 1
        if samples_checked % 25 == 0:
            print(f"  OpenFake core: {samples_checked}/{n_samples} samples processed...")

    sorted_generators = sorted(generators_seen.items(), key=lambda x: x[1], reverse=True)[:10]
    sorted_dates = sorted(release_dates_seen.items(), key=lambda x: x[1], reverse=True)[:5]
    sorted_resolutions = sorted(resolutions_seen.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "dataset": "ComplexDataLab/OpenFake (core)",
        "samples_checked": samples_checked,
        "keys": sorted(keys_seen),
        "first_sample_keys": first_sample_keys,
        "label_counts": label_counts,
        "unique_generators_count": len(generators_seen),
        "generator_distribution_sample": dict(sorted_generators),
        "release_dates_sample": dict(sorted_dates),
        "image_modes": modes_seen,
        "resolutions_sample": dict(sorted_resolutions),
        "errors": errors,
    }


def fetch_hf_license_metadata() -> dict[str, Any]:
    print("\n--- Fetching HF Dataset Metadata / License Information ---")
    api = HfApi()
    metadata: dict[str, Any] = {}

    for repo_id in ["OwensLab/CommunityForensics-Small", "ComplexDataLab/OpenFake"]:
        try:
            info = api.dataset_info(repo_id)
            card_data = getattr(info, "card_data", None)
            tags = getattr(info, "tags", [])
            license_val = None
            if card_data and hasattr(card_data, "get"):
                license_val = card_data.get("license")
            elif card_data and isinstance(card_data, dict):
                license_val = card_data.get("license")
            metadata[repo_id] = {
                "tags": [t for t in tags if "license:" in t or "task" in t or "size" in t],
                "card_license": license_val,
                "private": info.private,
                "gated": getattr(info, "gated", False),
                "author": info.author,
                "sha": info.sha,
            }
        except Exception as e:
            metadata[repo_id] = {"error": str(e)}

    return metadata


def main() -> None:
    output_dir = Path("results/T1.0")
    output_dir.mkdir(parents=True, exist_ok=True)

    report: dict[str, Any] = {
        "task": "T1.0",
        "date": "2026-11-16",
        "cf_small": inspect_cf_small(100),
        "openfake_core": inspect_openfake_core(100),
        "hf_metadata": fetch_hf_license_metadata(),
    }

    out_file = output_dir / "dataset_verification.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[DONE] Verification complete. Saved report to {out_file}")


if __name__ == "__main__":
    main()
