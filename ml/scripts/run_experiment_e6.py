"""Runner script for Experiment E6."""

from pathlib import Path
from lv_ml.eval.experiment_e6 import ExperimentE6Runner


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    runner = ExperimentE6Runner(repo_root=repo_root, n_samples=200)
    runner.run()


if __name__ == "__main__":
    main()
