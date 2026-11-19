"""Script to generate CF-Small generator-disjoint split manifests (T1.1)
and extract CLIP fp16 embeddings on GPU to disk cache (T1.2).
"""

from __future__ import annotations

import hashlib
import io
import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
from datasets import load_dataset
from PIL import Image

from lv_ml.data.splits import verify_split_disjointness
from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.fingerprint.phash import compute_phash, hamming_distance


def stream_and_filter_cf_small(
    target_samples: int = 250,
    dup_hamming_threshold: int = 2,
    images_dir: Path = Path("dataset/cf_small/images"),
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Stream samples from CF-Small, filter near-duplicates with pHash, and save images locally."""
    images_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[T1.1] Streaming CF-Small (target {target_samples} accepted samples)...")
    ds = load_dataset("OwensLab/CommunityForensics-Small", split="train", streaming=True)

    accepted_samples: list[dict[str, Any]] = []
    accepted_phashes: list[int] = []
    near_dupe_events: list[dict[str, Any]] = []
    total_processed = 0

    start_time = time.time()

    for item in ds:
        total_processed += 1

        img_data = item.get("image_data")
        if isinstance(img_data, bytes):
            img = Image.open(io.BytesIO(img_data)).convert("RGB")
            raw_bytes = img_data
        elif hasattr(img_data, "convert"):
            img = img_data.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            raw_bytes = buf.getvalue()
        else:
            raw_bytes = bytes(img_data)
            img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

        # 1. Compute fingerprints
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        sample_phash = compute_phash(img)

        # 2. Check near-duplicates against accepted_phashes
        is_near_dup = False
        for prev_phash in accepted_phashes:
            dist = hamming_distance(sample_phash, prev_phash)
            if dist <= dup_hamming_threshold:
                is_near_dup = True
                near_dupe_events.append(
                    {
                        "sample_index": total_processed,
                        "image_name": item.get("image_name"),
                        "hamming_dist": dist,
                    }
                )
                break

        if is_near_dup:
            continue

        # Save image locally
        img_name = str(item.get("image_name") or f"sample_{len(accepted_samples):05d}.png")
        if not (img_name.endswith(".png") or img_name.endswith(".jpg")):
            img_name += ".png"
        local_img_path = images_dir / img_name
        img.save(local_img_path, format="PNG")

        sample_record = {
            "image_name": img_name,
            "local_path": str(local_img_path),
            "label": int(item.get("label", 1)),
            "model_name": str(item.get("model_name")),
            "real_source": str(item.get("real_source")),
            "sha256": sha256_hash,
            "phash": sample_phash,
            "resolution": f"{img.size[0]}x{img.size[1]}",
        }

        accepted_samples.append(sample_record)
        accepted_phashes.append(sample_phash)

        if len(accepted_samples) % 50 == 0:
            print(f"  Accepted {len(accepted_samples)}/{target_samples}...")

        if len(accepted_samples) >= target_samples:
            break

    elapsed = time.time() - start_time
    dup_pct = (len(near_dupe_events) / total_processed * 100) if total_processed > 0 else 0.0
    stats = {
        "total_streamed": total_processed,
        "accepted_samples": len(accepted_samples),
        "near_dupes_filtered": len(near_dupe_events),
        "dup_rate_pct": round(dup_pct, 2),
        "elapsed_sec": round(elapsed, 2),
    }
    print(f"[T1.1] Finished streaming. Stats: {stats}")
    return accepted_samples, stats


def build_generator_disjoint_splits(
    samples: list[dict[str, Any]],
    splits_dir: Path = Path("dataset/splits"),
) -> dict[str, Any]:
    """Split samples into train, cal, test_indomain, and generator-disjoint test_disjoint."""
    splits_dir.mkdir(parents=True, exist_ok=True)

    # Group synthetic samples by generator
    generators: dict[str, list[dict[str, Any]]] = {}
    real_samples: list[dict[str, Any]] = []

    for s in samples:
        if s["label"] == 1:
            g = s["model_name"]
            generators.setdefault(g, []).append(s)
        else:
            real_samples.append(s)

    # Sort generators by count
    sorted_gens = sorted(generators.keys(), key=lambda g: len(generators[g]), reverse=True)
    print(f"[T1.1] Unique synthetic generators found ({len(sorted_gens)}): {sorted_gens}")

    if len(sorted_gens) >= 2:
        test_disjoint_gens = [sorted_gens[-1]]
        train_gens = sorted_gens[:-1]
    else:
        test_disjoint_gens = sorted_gens[:1]
        train_gens = sorted_gens[:1]

    print(f"[T1.1] Train generators: {train_gens}")
    print(f"[T1.1] Disjoint test generators: {test_disjoint_gens}")

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
    print(f"[T1.1] Disjointness verification: {disjoint_check}")

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
    print(f"\n[T1.2] Initializing ClipEmbeddingExtractor on {device}...")
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
    peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024) if device == "cuda" else 0.0

    # Write results/E0/env.txt
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

    # Write results/E0/metrics.json
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

    print(f"[T1.2] Extraction complete ({overall_fps:.1f} img/s). Env logged to {env_txt_path}")
    return summary_metrics


def main() -> None:
    # 1. T1.1 Stream & Deduplicate
    accepted_samples, dup_stats = stream_and_filter_cf_small(target_samples=200)

    # 2. T1.1 Split manifests
    split_stats = build_generator_disjoint_splits(accepted_samples)

    # Save T1.1 stats to results/T1.1/near_dup_and_split_stats.json
    results_t11_dir = Path("results/T1.1")
    results_t11_dir.mkdir(parents=True, exist_ok=True)
    t11_summary = {
        "task": "T1.1",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "deduplication": dup_stats,
        "splits": split_stats,
    }
    with open(results_t11_dir / "near_dup_and_split_stats.json", "w", encoding="utf-8") as f:
        json.dump(t11_summary, f, indent=2)

    # 3. T1.2 CLIP fp16 GPU Embedding Extraction
    manifest_paths = {
        "train": Path("dataset/splits/cf_small_train.json"),
        "cal": Path("dataset/splits/cf_small_cal.json"),
        "test_indomain": Path("dataset/splits/cf_small_test_indomain.json"),
        "test_disjoint": Path("dataset/splits/cf_small_test_disjoint.json"),
    }
    extract_embeddings_and_benchmark(manifest_paths)


if __name__ == "__main__":
    main()
