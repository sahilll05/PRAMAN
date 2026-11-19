"""Download real images from COCO val2017 and create balanced splits and embeddings.

Rule compliance:
- agent_rules.md §2b: Open-data policy (COCO val2017 is public Tier A, CC-BY 2.0).
- decisions.md D-DATASETS: Real images from COCO val2017.
- agent_rules.md §2c: GPU fp16 embedding extraction with peak VRAM tracking.
- spec_schemas.md §4: pHash computed for each image.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import io
import json
import os
from pathlib import Path
import random
import re
import time
import urllib.request

import numpy as np
from PIL import Image
import torch

from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.fingerprint.phash import compute_phash


COCO_BASE_URL = "http://images.cocodataset.org/val2017"
COCO_LFS_URL = "https://huggingface.co/datasets/merve/coco/resolve/main/annotations/instances_val2017.json"


def get_coco_val2017_filenames() -> list[str]:
    """Fetch COCO val2017 image filenames from the raw annotation header."""
    req = urllib.request.Request(
        COCO_LFS_URL,
        headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1500000"}
    )
    resp = urllib.request.urlopen(req, timeout=30)
    data = resp.read().decode("utf-8", errors="ignore")
    fnames = re.findall(r'file_name":\s*"(\d+\.jpg)"', data)
    if len(fnames) < 1500:
        raise ValueError(f"Expected at least 1500 COCO filenames, got {len(fnames)}")
    return fnames


def download_single_coco_image(fname: str, dest_dir: Path) -> Path:
    dest_path = dest_dir / fname
    if dest_path.exists() and dest_path.stat().st_size > 0:
        return dest_path

    url = f"{COCO_BASE_URL}/{fname}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=30)
    img_bytes = resp.read()

    # Validate image can be opened
    img = Image.open(io.BytesIO(img_bytes))
    img.verify()

    dest_path.write_bytes(img_bytes)
    return dest_path


def download_coco_subset(fnames: list[str], dest_dir: Path, max_workers: int = 16) -> list[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    downloaded = []
    print(f"Downloading {len(fnames)} COCO val2017 images using {max_workers} threads...")
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_fname = {
            executor.submit(download_single_coco_image, fname, dest_dir): fname
            for fname in fnames
        }
        done_count = 0
        for future in as_completed(future_to_fname):
            fname = future_to_fname[future]
            try:
                p = future.result()
                downloaded.append(p)
                done_count += 1
                if done_count % 250 == 0 or done_count == len(fnames):
                    print(f"  Downloaded {done_count}/{len(fnames)} images...")
            except Exception as e:
                print(f"  Error downloading {fname}: {e}")

    elapsed = time.time() - t0
    total_bytes = sum(p.stat().st_size for p in downloaded)
    print(f"Downloaded {len(downloaded)} images ({total_bytes / (1024*1024):.2f} MB) in {elapsed:.1f}s ({len(downloaded)/elapsed:.1f} img/s)")
    return downloaded


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    splits_dir = project_root / "dataset" / "splits"
    coco_img_dir = project_root / "dataset" / "coco" / "images"
    emb_dir = project_root / "dataset" / "embeddings"
    emb_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load existing synthetic splits
    with open(splits_dir / "cf_small_train.json", "r") as f:
        synth_train = json.load(f)
    with open(splits_dir / "cf_small_cal.json", "r") as f:
        synth_cal = json.load(f)
    with open(splits_dir / "cf_small_test_indomain.json", "r") as f:
        synth_test_indomain = json.load(f)
    with open(splits_dir / "cf_small_test_disjoint.json", "r") as f:
        synth_test_disjoint = json.load(f)

    n_train = len(synth_train)
    n_cal = len(synth_cal)
    n_test_in = len(synth_test_indomain)
    n_test_dis = len(synth_test_disjoint)
    n_total_real = n_train + n_cal + n_test_in + n_test_dis

    print(f"Target real image counts: train={n_train}, cal={n_cal}, test_in={n_test_in}, test_dis={n_test_dis} (total={n_total_real})")

    # 2. Get list of filenames
    all_coco_fnames = get_coco_val2017_filenames()
    rng = random.Random(42)
    selected_fnames = rng.sample(all_coco_fnames, n_total_real)

    # Partition selected filenames
    real_train_fnames = selected_fnames[:n_train]
    real_cal_fnames = selected_fnames[n_train:n_train + n_cal]
    real_test_in_fnames = selected_fnames[n_train + n_cal:n_train + n_cal + n_test_in]
    real_test_dis_fnames = selected_fnames[n_train + n_cal + n_test_in:]

    # 3. Download images
    download_coco_subset(selected_fnames, coco_img_dir, max_workers=24)

    # 4. Build real split metadata records
    def build_real_records(fnames: list[str]) -> list[dict]:
        records = []
        for fname in fnames:
            img_path = coco_img_dir / fname
            img = Image.open(img_path).convert("RGB")
            phash_val = compute_phash(img)
            # if compute_phash returns string or int
            phash_int = int(phash_val, 16) if isinstance(phash_val, str) else phash_val
            records.append({
                "image_name": f"coco_{fname}",
                "local_path": f"dataset/coco/images/{fname}",
                "model_name": "coco_val2017",
                "label": 0,
                "real_source": "COCO",
                "sha256": hashlib.sha256(img_path.read_bytes()).hexdigest(),
                "phash": phash_int,
                "resolution": f"{img.width}x{img.height}",
            })
        return records

    print("Building real image records and computing pHashes...")
    real_train = build_real_records(real_train_fnames)
    real_cal = build_real_records(real_cal_fnames)
    real_test_in = build_real_records(real_test_in_fnames)
    real_test_dis = build_real_records(real_test_dis_fnames)

    # 5. Combine into balanced splits
    balanced_splits = {
        "balanced_train": synth_train + real_train,
        "balanced_cal": synth_cal + real_cal,
        "balanced_test_indomain": synth_test_indomain + real_test_in,
        "balanced_test_disjoint": synth_test_disjoint + real_test_dis,
    }

    for split_name, records in balanced_splits.items():
        rng.shuffle(records)
        split_path = splits_dir / f"{split_name}.json"
        with open(split_path, "w") as f:
            json.dump(records, f, indent=2)
        real_c = sum(1 for r in records if r["label"] == 0)
        synth_c = sum(1 for r in records if r["label"] == 1)
        print(f"Wrote {split_path.name}: {len(records)} samples ({real_c} real, {synth_c} synth)")

    # 6. Extract CLIP embeddings for all balanced splits
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\nInitializing ClipEmbeddingExtractor on device: {device}")
    extractor = ClipEmbeddingExtractor(model_name="ViT-B-32", pretrained="laion2b_s34b_b79k", device=device)

    for split_name in balanced_splits.keys():
        split_path = splits_dir / f"{split_name}.json"
        emb_dat_path = emb_dir / f"{split_name}_embeddings.dat"
        lbl_npy_path = emb_dir / f"{split_name}_labels.npy"
        print(f"\nExtracting CLIP embeddings for {split_name} from {split_path.name}...")
        stats = extractor.extract_and_cache(
            manifest_path=split_path,
            output_embeddings_path=emb_dat_path,
            output_labels_path=lbl_npy_path,
            batch_size=64,
            num_workers=2,
        )
        print(f"Stats for {split_name}: {stats}")

    print("\nBalanced dataset assembly and embedding extraction complete!")


if __name__ == "__main__":
    main()
