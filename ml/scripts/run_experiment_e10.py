"""Runner for Experiment E10 (T8.1 Adversarial Perturbation Test)."""

import sys
from pathlib import Path

# Project root
repo_root = Path(__file__).resolve().parent.parent.parent
src_dir = repo_root / "ml" / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from lv_ml.eval.experiment_e10 import run_experiment_e10

if __name__ == "__main__":
    print(f"Executing Experiment E10 (Repo root: {repo_root})...")
    res = run_experiment_e10(
        models_dir=repo_root / "dataset" / "models",
        embeddings_dir=repo_root / "dataset" / "embeddings",
        results_dir=repo_root / "results" / "E10",
        epsilons=[0.01, 0.05, 0.10, 0.20],
        max_samples=200,
    )
    print("Experiment E10 Completed successfully!")
    print("Summary:")
    for k, v in res["results"].items():
        print(f"  {k}: {v}")
