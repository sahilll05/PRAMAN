"""Script to execute Experiment E9."""

import sys
from pathlib import Path

# Add ml root to path for canary_pipeline import
ml_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ml_root))

from lv_ml.eval.experiment_e9 import ExperimentE9Runner


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    runner = ExperimentE9Runner(repo_root=repo_root, device="cuda")
    runner.run()


if __name__ == "__main__":
    main()
