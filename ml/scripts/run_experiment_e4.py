"""Script to execute Experiment E4."""

from pathlib import Path

from lv_ml.eval.experiment_e4 import ExperimentE4Runner


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    runner = ExperimentE4Runner(repo_root=repo_root, device="cuda")
    runner.run()


if __name__ == "__main__":
    main()
