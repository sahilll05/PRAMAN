# ml — PRAMANA ML Layer

Detectors, calibration, fingerprints, evidence builder, canary runner, evaluation scripts.

## Setup
```bash
uv sync --extra dev
```

## Run tests
```bash
uv run pytest
```

## Lint / type-check
```bash
uv run ruff check src/ tests/
uv run mypy src/
```
