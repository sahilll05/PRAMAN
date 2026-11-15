# results/ — Experiment outputs

This directory holds committed experiment results (small files only).

## Structure
```
results/
  <exp_id>/
    config.json     — full reproducibility config (model, data, hyperparams, splits)
    metrics.json    — all measured metrics (honest; include negative results)
    env.txt         — pip freeze / uv export output
    git_sha.txt     — git rev-parse HEAD at run time
    README.md       — one-paragraph summary + interpretation
```

## Experiment index (maintained by agents; link here when results/ populated)

| Exp ID | Phase | Task | Date | Git SHA | One-line result | Claims touched |
|---|---|---|---|---|---|---|
| (none yet) | — | — | — | — | — | — |

## Rules
- **No mocked, hardcoded or simulated numbers.** Only values from actual runs.
- Results committed here must match the numbers in `claims.md` exactly.
- Large intermediates (`.npz`, `.npy`, `.pkl`) are gitignored — link to external storage if needed.
- Always re-runnable: `config.json` + `git_sha.txt` must be enough to reproduce within stated tolerance.
