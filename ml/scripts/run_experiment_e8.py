"""Script to execute Experiment E8."""

from pathlib import Path
from lv_ml.eval.experiment_e8 import ExperimentE8Runner


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    runner = ExperimentE8Runner(repo_root=repo_root, device="cuda")
    runner.run()


if __name__ == "__main__":
    main()
