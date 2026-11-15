# spec/vectors — Golden Test Vectors

> **Both Python and TypeScript tests MUST pass against every file in this directory.**
> Any algorithm change in `spec_schemas.md` requires updating these vectors AND bumping the spec version.

## Contents (populated progressively)

| File | Phase | Description |
|---|---|---|
| `fingerprint_v1.json` | T3.1 | sha256 + pHash + wmId for reference images |
| `verdict_sample_v1.json` | T0.4 | A minimal valid verdict.json for schema smoke tests |
| `evidence_sample_v1.json` | T0.4 | A minimal valid evidence.json for schema smoke tests |

## How to use
- Python: `tests/test_golden_vectors.py` loads each file and validates + recomputes.
- TypeScript: `chain/tests/golden.test.ts` does the same.

## Rules
- Vectors are committed. Never auto-generate them in CI from live code without review.
- Label the git commit that changes a vector with the spec version bump.
