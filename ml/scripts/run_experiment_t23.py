"""Runner for Experiment T23 (T8.1 GPU Non-Determinism Boundary Stress Test)."""

import sys
from pathlib import Path

# Project root
repo_root = Path(__file__).resolve().parent.parent.parent
src_dir = repo_root / "ml" / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from lv_ml.eval.experiment_t23 import run_experiment_t23

if __name__ == "__main__":
    print(f"Executing Experiment T23 (Repo root: {repo_root})...")
    res = run_experiment_t23(
        models_dir=repo_root / "dataset" / "models",
        embeddings_dir=repo_root / "dataset" / "embeddings",
        results_dir=repo_root / "results" / "T23",
        n_boundary_samples=500,
    )
    print("Experiment T23 Completed successfully!")
    print(f"  Total boundary samples evaluated: {res['total_boundary_samples']}")
    print(f"  Max divergence: {res['max_divergence_bps']} bps")
    print(f"  Mean divergence: {res['mean_divergence_bps']} bps")
    print(f"  Verdict flips: {res['verdict_flips_detected']} ({res['boundary_flip_rate']*100:.2f}%)")
    print(f"  Conclusion: {res['conclusion']}")
