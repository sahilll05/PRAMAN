"""Download approved 1.17 GB CF-Small shard, generate disjoint split manifests (T1.1),
and extract fp16 CLIP embeddings on RTX 4060 GPU (T1.2).
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import time
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq
import torch
from huggingface_hub import hf_hub_download
from PIL import Image

from lv_ml.data.splits import verify_split_disjointness
from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.fingerprint.phash import compute_phash, hamming_distance


def download_shard(dest_dir: Path = Path("dataset/cf_small")) -> Path:
    """Download HFCF_small_0.parquet using huggingface_hub (approved by human 2026-11-19)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    target_file = dest_dir / "HFCF_small_0.parquet"

    if target_file.exists() and target_file.stat().st_size > 1_000_000_000:
        size_mb = target_file.stat().st_size / (1024 * 1024)
        print(f"[DOWNLOAD] Shard already exists at {target_file} ({size_mb:.1f} MB).")
        return target_file

    print(f"\n[DOWNLOAD] Downloading HFCF_small_0.parquet (~1.17 GB) to {target_file}...")
    t0 = time.time()
    cached_path = hf_hub_download(
        repo_id="OwensLab/CommunityForensics-Small",
        repo_type="dataset",
        filename="data/HFCF_small_0.parquet",
    )
    shutil.copy2(cached_path, target_file)
    size_mb = target_file.stat().st_size / (1024 * 1024)
    dt = time.time() - t0
    rate = size_mb / dt if dt > 0 else 0.0
    print(f"[DOWNLOAD] Completed in {dt:.1f}s ({size_mb:.1f} MB, {rate:.1f} MB/s).")
    return target_file


def process_shard_and_filter(
    shard_path: Path,
    max_samples: int = 1500,
    dup_hamming_threshold: int = 2,
    images_dir: Path = Path("dataset/cf_small/images"),
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Read local parquet shard, deduplicate using pHash, save images, and collect metadata."""
    images_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n[T1.1] Reading local parquet shard: {shard_path}...")
    table = pq.read_table(shard_path)
    total_rows = len(table)
    print(f"[T1.1] Total rows in shard: {total_rows}. Target to process: {max_samples}")

    accepted_samples: list[dict[str, Any]] = []
    accepted_phashes: list[int] = []
    near_dupe_events: list[dict[str, Any]] = []

    t0 = time.time()

    img_data_col = table["image_data"]
    img_name_col = table["image_name"]
    label_col = table["label"]
    model_name_col = table["model_name"]
    real_source_col = table["real_source"] if "real_source" in table.column_names else None

    limit = min(max_samples, total_rows)

    for i in range(limit):
        raw_bytes = img_data_col[i].as_py()
        img_name = str(img_name_col[i].as_py())
        label_val = int(label_col[i].as_py())
        model_name = str(model_name_col[i].as_py())
        real_src = str(real_source_col[i].as_py()) if real_source_col is not None else "None"

        try:
            img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        except Exception as e:
            print(f"  Warning: failed to decode row {i} ({img_name}): {e}")
            continue

        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        sample_phash = compute_phash(img)

        # Near-duplicate check
        is_near_dup = False
        for prev_phash in accepted_phashes:
            if hamming_distance(sample_phash, prev_phash) <= dup_hamming_threshold:
                is_near_dup = True
                near_dupe_events.append({"idx": i, "image_name": img_name})
                break

        if is_near_dup:
            continue

        safe_model = model_name.replace("/", "_").replace("\\", "_")
        unique_img_name = f"{safe_model}_{img_name}"
        if not (unique_img_name.endswith(".png") or unique_img_name.endswith(".jpg")):
            unique_img_name += ".png"
        local_img_path = images_dir / unique_img_name
        img.save(local_img_path, format="PNG")

        accepted_samples.append({
            "image_name": unique_img_name,
            "local_path": str(local_img_path),
            "label": label_val,
            "model_name": model_name,
            "real_source": real_src,
            "sha256": sha256_hash,
            "phash": sample_phash,
            "resolution": f"{img.size[0]}x{img.size[1]}",
        })
        accepted_phashes.append(sample_phash)

        if len(accepted_samples) % 250 == 0:
            print(f"  Processed {i+1}/{limit} rows -> {len(accepted_samples)} accepted...")

    dt = time.time() - t0
    stats = {
        "total_rows_inspected": limit,
        "accepted_samples": len(accepted_samples),
        "near_dupes_filtered": len(near_dupe_events),
        "dup_rate_pct": round(len(near_dupe_events) / limit * 100, 2) if limit > 0 else 0.0,
        "elapsed_sec": round(dt, 2),
    }
    print(f"[T1.1] Deduplication complete in {dt:.1f}s. Stats: {stats}")
    return accepted_samples, stats


def build_generator_disjoint_splits(
    samples: list[dict[str, Any]],
    splits_dir: Path = Path("dataset/splits"),
) -> dict[str, Any]:
    """Split into train, cal, test_indomain, and generator-disjoint test_disjoint."""
    splits_dir.mkdir(parents=True, exist_ok=True)

    generators: dict[str, list[dict[str, Any]]] = {}
    real_samples: list[dict[str, Any]] = []

    for s in samples:
        if s["label"] == 1:
            g = s["model_name"]
            generators.setdefault(g, []).append(s)
        else:
            real_samples.append(s)

    sorted_gens = sorted(generators.keys(), key=lambda g: len(generators[g]), reverse=True)
    print(f"\n[T1.1] Synthetic generator models found ({len(sorted_gens)}):")
    for g in sorted_gens:
        print(f"  - {g}: {len(generators[g])} samples")

    if len(sorted_gens) >= 2:
        test_disjoint_gens = [sorted_gens[-1]]
        train_gens = sorted_gens[:-1]
    else:
        test_disjoint_gens = sorted_gens[:1]
        train_gens = sorted_gens[:1]

    print(f"[T1.1] Train generators ({len(train_gens)}): {train_gens}")
    print(f"[T1.1] Disjoint generators ({len(test_disjoint_gens)}): {test_disjoint_gens}")

    test_disjoint_samples: list[dict[str, Any]] = []
    for g in test_disjoint_gens:
        test_disjoint_samples.extend(generators[g])

    n_disjoint_real = max(1, len(real_samples) // 5) if real_samples else 0
    test_disjoint_samples.extend(real_samples[:n_disjoint_real])
    remaining_reals = real_samples[n_disjoint_real:]

    in_domain_synthetics: list[dict[str, Any]] = []
    for g in train_gens:
        in_domain_synthetics.extend(generators[g])

    rng = np.random.default_rng(42)
    in_domain_pool = in_domain_synthetics + remaining_reals
    rng.shuffle(in_domain_pool)

    n_pool = len(in_domain_pool)
    n_cal = max(1, int(0.15 * n_pool))
    n_test_in = max(1, int(0.15 * n_pool))
    n_train = n_pool - n_cal - n_test_in

    train_samples = in_domain_pool[:n_train]
    cal_samples = in_domain_pool[n_train : n_train + n_cal]
    test_indomain_samples = in_domain_pool[n_train + n_cal :]

    manifest_paths = {
        "train": splits_dir / "cf_small_train.json",
        "cal": splits_dir / "cf_small_cal.json",
        "test_indomain": splits_dir / "cf_small_test_indomain.json",
        "test_disjoint": splits_dir / "cf_small_test_disjoint.json",
    }

    for name, path in manifest_paths.items():
        data = {
            "train": train_samples,
            "cal": cal_samples,
            "test_indomain": test_indomain_samples,
            "test_disjoint": test_disjoint_samples,
        }[name]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    disjoint_check = verify_split_disjointness(train_samples, test_disjoint_samples)
    print(f"[T1.1] Disjointness verification check: {disjoint_check}")
    if not disjoint_check["is_disjoint"]:
        raise RuntimeError("CRITICAL: Generator leakage detected across train and test_disjoint!")

    split_stats = {
        "train_count": len(train_samples),
        "cal_count": len(cal_samples),
        "test_indomain_count": len(test_indomain_samples),
        "test_disjoint_count": len(test_disjoint_samples),
        "train_generators": train_gens,
        "test_disjoint_generators": test_disjoint_gens,
        "disjoint_check": disjoint_check,
    }
    return split_stats


def extract_embeddings_and_benchmark(
    manifest_paths: dict[str, Path],
    embeddings_dir: Path = Path("dataset/embeddings"),
    results_e0_dir: Path = Path("results/E0"),
) -> dict[str, Any]:
    """Run T1.2: extract fp16 CLIP embeddings on GPU, save memmaps, record env.txt benchmark."""
    embeddings_dir.mkdir(parents=True, exist_ok=True)
    results_e0_dir.mkdir(parents=True, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n[T1.2] Initializing ClipEmbeddingExtractor on {device} (fp16 mixed precision)...")
    extractor = ClipEmbeddingExtractor(device=device)

    all_metrics: dict[str, Any] = {}
    total_images = 0
    total_time = 0.0

    for split_name, manifest_path in manifest_paths.items():
        print(f"  Extracting embeddings for split '{split_name}' ({manifest_path})...")
        emb_file = embeddings_dir / f"{split_name}_embeddings.dat"
        lbl_file = embeddings_dir / f"{split_name}_labels.npy"

        metrics = extractor.extract_and_cache(
            manifest_path=manifest_path,
            output_embeddings_path=emb_file,
            output_labels_path=lbl_file,
            batch_size=64,
        )
        all_metrics[split_name] = metrics
        total_images += metrics["n_samples"]
        total_time += metrics["total_time_sec"]

    overall_fps = total_images / total_time if total_time > 0 else 0.0
    peak_vram = (
        torch.cuda.max_memory_allocated() / (1024 * 1024) if device == "cuda" else 0.0
    )

    env_txt_path = results_e0_dir / "env.txt"
    with open(env_txt_path, "w", encoding="utf-8") as f:
        f.write("=== PRAMANA Experiment E0 / T1.2 Hardware & Benchmark Report ===\n")
        f.write(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Device: {device}\n")
        if device == "cuda":
            f.write(f"GPU: {torch.cuda.get_device_name(0)}\n")
            f.write(f"CUDA Version: {torch.version.cuda}\n")
            f.write(f"Peak VRAM: {peak_vram:.2f} MiB\n")
        f.write(f"PyTorch Version: {torch.__version__}\n")
        f.write(f"Model: {extractor.model_name} ({extractor.pretrained})\n")
        f.write("Precision: fp16 (mixed)\n")
        f.write(f"Total Images Processed: {total_images}\n")
        f.write(f"Total Extraction Time: {total_time:.2f} s\n")
        f.write(f"Throughput: {overall_fps:.2f} images/sec\n")
        f.write("\n=== Per-Split Breakdown ===\n")
        for s_name, s_m in all_metrics.items():
            line = (
                f"- {s_name}: {s_m['n_samples']} img, {s_m['total_time_sec']}s "
                f"({s_m['images_per_sec']} img/s)\n"
            )
            f.write(line)

    metrics_json_path = results_e0_dir / "metrics.json"
    summary_metrics = {
        "experiment": "E0",
        "task": "T1.2",
        "device": device,
        "peak_vram_mib": round(peak_vram, 2),
        "total_images": total_images,
        "total_time_sec": round(total_time, 2),
        "overall_images_per_sec": round(overall_fps, 2),
        "splits": all_metrics,
    }
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_metrics, f, indent=2)

    print(f"\n[T1.2] Extraction complete! Speed: {overall_fps:.1f} img/s. Env: {env_txt_path}")
    return summary_metrics


def main() -> None:
    # 1. Download approved shard
    shard_path = download_shard()

    # 2. Process rows and deduplicate via pHash (T1.1)
    samples, dup_stats = process_shard_and_filter(shard_path, max_samples=1500)

    # 3. Create generator-disjoint splits (T1.1)
    split_stats = build_generator_disjoint_splits(samples)

    # Save T1.1 stats
    t11_dir = Path("results/T1.1")
    t11_dir.mkdir(parents=True, exist_ok=True)
    t11_summary = {
        "task": "T1.1",
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "deduplication": dup_stats,
        "splits": split_stats,
    }
    with open(t11_dir / "near_dup_and_split_stats.json", "w", encoding="utf-8") as f:
        json.dump(t11_summary, f, indent=2)

    # 4. Extract fp16 CLIP embeddings on GPU (T1.2)
    manifest_paths = {
        "train": Path("dataset/splits/cf_small_train.json"),
        "cal": Path("dataset/splits/cf_small_cal.json"),
        "test_indomain": Path("dataset/splits/cf_small_test_indomain.json"),
        "test_disjoint": Path("dataset/splits/cf_small_test_disjoint.json"),
    }
    extract_embeddings_and_benchmark(manifest_paths)


if __name__ == "__main__":
    main()
