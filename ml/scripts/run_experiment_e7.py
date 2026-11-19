"""Runner script for Experiment E7."""

from pathlib import Path
from lv_ml.eval.experiment_e7 import ExperimentE7Runner


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    runner = ExperimentE7Runner(repo_root=repo_root, n_samples=20)
    runner.run()


if __name__ == "__main__":
    main()
