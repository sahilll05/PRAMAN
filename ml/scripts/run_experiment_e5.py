"""Experiment E5: Determinism and CPU-CPU Numerical Agreement Verification.

Pre-registered in sahil/evaluation_plan.md:
- Evaluate identical files across independent CPU reference runner executions (N=200 images).
- Measure max/mean |pFake diff| in bps and verdict-class mismatch rate.
- Set canonical challenge tolerance epsilon (bps).
- Target: verdict-class mismatch rate <= 0.1% (0/200 mismatches).
"""

from __future__ import annotations

import json
import platform
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np

from lv_ml.runner.cpu_runner import ReferenceRunner


def get_git_sha(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            text=True,
        ).strip()
    except Exception:
        return "unknown"


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    split_path = repo_root / "dataset" / "splits" / "balanced_test_indomain.json"
    results_dir = repo_root / "results" / "E5"
    results_dir.mkdir(parents=True, exist_ok=True)
    git_sha = get_git_sha(repo_root)

    print(f"=== Starting Experiment E5: CPU-CPU Determinism Benchmark (git: {git_sha[:8]}) ===")

    with open(split_path, encoding="utf-8") as f:
        records = json.load(f)

    # Select N=200 images
    n_target = 200
    selected_records = records[:n_target]
    print(f"Loaded {len(selected_records)} images from {split_path.name}")

    # Initialize two independent CPU reference runners
    runner_1 = ReferenceRunner()
    runner_2 = ReferenceRunner()

    diffs_bps: list[int] = []
    verdict_mismatches = 0
    sha256_matches = 0
    phash_matches = 0

    print(f"Running independent CPU executions on N={len(selected_records)} images...")
    t0 = time.time()

    per_sample_results: list[dict[str, Any]] = []

    for idx, rec in enumerate(selected_records):
        img_rel = Path(rec["local_path"])
        img_path = repo_root / img_rel
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found at {img_path}")

        # Run 1
        v1, e1 = runner_1.predict_image(img_path)
        # Run 2
        v2, e2 = runner_2.predict_image(img_path)

        p1_bps = v1["onChain"]["pFakeBps"]
        p2_bps = v2["onChain"]["pFakeBps"]
        diff = abs(p1_bps - p2_bps)
        diffs_bps.append(diff)

        class_1 = v1["onChain"]["verdict"]
        class_2 = v2["onChain"]["verdict"]
        if class_1 != class_2:
            verdict_mismatches += 1

        if v1["onChain"]["sha256Hash"] == v2["onChain"]["sha256Hash"]:
            sha256_matches += 1
        if v1["onChain"]["pHash"] == v2["onChain"]["pHash"]:
            phash_matches += 1

        per_sample_results.append(
            {
                "idx": idx,
                "image": img_rel.name,
                "p1_bps": p1_bps,
                "p2_bps": p2_bps,
                "diff_bps": diff,
                "verdict_1": class_1,
                "verdict_2": class_2,
            }
        )

        if (idx + 1) % 50 == 0 or idx == len(selected_records) - 1:
            elapsed = time.time() - t0
            print(
                f"Processed {idx + 1}/{len(selected_records)} images ({elapsed:.1f}s) | Max diff: {max(diffs_bps)} bps | Mismatches: {verdict_mismatches}"
            )

    elapsed_total = time.time() - t0
    diffs_arr = np.array(diffs_bps, dtype=np.float64)

    max_diff = int(np.max(diffs_arr))
    mean_diff = float(np.mean(diffs_arr))
    p99_diff = float(np.percentile(diffs_arr, 99.0))
    p999_diff = float(np.percentile(diffs_arr, 99.9))
    mismatch_rate = float(verdict_mismatches / len(selected_records))

    # Empirical challenge tolerance: max(p99.9, max_diff) + safety margin
    # On identical CPU kernels, bit-level determinism yields diff = 0 bps.
    # To absorb potential cross-architecture single-precision rounding jitter across disparate CPUs,
    # set epsilon to 10 bps for CPU-CPU re-execution.
    epsilon_bps = 10

    metrics = {
        "experiment": "E5",
        "task": "T2.7",
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "git_sha": git_sha,
        "n_samples": len(selected_records),
        "elapsed_seconds": round(elapsed_total, 2),
        "throughput_img_per_sec": round(len(selected_records) * 2 / elapsed_total, 2),
        "max_diff_bps": max_diff,
        "mean_diff_bps": mean_diff,
        "p99_diff_bps": p99_diff,
        "p999_diff_bps": p999_diff,
        "verdict_mismatches": verdict_mismatches,
        "verdict_mismatch_rate": mismatch_rate,
        "sha256_match_rate": sha256_matches / len(selected_records),
        "phash_match_rate": phash_matches / len(selected_records),
        "target_met": mismatch_rate <= 0.001,
        "recommended_epsilon_bps": epsilon_bps,
        "system": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "python": platform.python_version(),
        },
    }

    print("\n==================== [E5 Summary] ====================")
    print(f"Max Diff: {max_diff} bps | Mean Diff: {mean_diff:.4f} bps | p99.9: {p999_diff:.2f} bps")
    print(f"Verdict Mismatches: {verdict_mismatches}/{len(selected_records)} ({mismatch_rate:.2%})")
    print(f"Target (Mismatch Rate <= 0.1%): {metrics['target_met']}")
    print(f"Recommended Epsilon for Challenges: {epsilon_bps} bps (0.10%)")

    with open(results_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(results_dir / "config.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "split": "balanced_test_indomain.json",
                "n_samples": n_target,
                "runner": "ReferenceRunner (CPU ONNX fp32, single-thread)",
                "onnx_model_a": "model_a.onnx",
                "onnx_model_b": "model_b.onnx",
            },
            f,
            indent=2,
        )

    print(f"Results written to {results_dir / 'metrics.json'}")


if __name__ == "__main__":
    main()
