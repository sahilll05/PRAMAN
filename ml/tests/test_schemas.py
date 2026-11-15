"""
Schema validation smoke tests (T0.4).

Validates spec/vectors/verdict_sample_v1.json and evidence_sample_v1.json
against spec/schemas/verdict.schema.json and evidence.schema.json.

These tests run with zero ML dependencies and must pass in CI always.
"""

import json
from pathlib import Path

import jsonschema
import pytest

SPEC_DIR = Path(__file__).parents[2] / "spec"
SCHEMAS_DIR = SPEC_DIR / "schemas"
VECTORS_DIR = SPEC_DIR / "vectors"


def _load(path: Path) -> dict:  # type: ignore[type-arg]
    with open(path, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


def _validate(instance: dict, schema: dict) -> None:  # type: ignore[type-arg]
    validator = jsonschema.Draft7Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda e: e.path)
    if errors:
        messages = "\n".join(str(e) for e in errors)
        pytest.fail(f"Schema validation failed:\n{messages}")


class TestVerdictSchema:
    schema = _load(SCHEMAS_DIR / "verdict.schema.json")

    def test_sample_v1_is_valid(self) -> None:
        """verdict_sample_v1.json must pass verdict.schema.json."""
        instance = _load(VECTORS_DIR / "verdict_sample_v1.json")
        # Remove _comment key if present (not in schema, used for humans)
        instance.pop("_comment", None)
        _validate(instance, self.schema)

    def test_missing_required_field_fails(self) -> None:
        """Omitting evidenceHash must fail validation."""
        instance = _load(VECTORS_DIR / "verdict_sample_v1.json")
        instance.pop("_comment", None)
        del instance["evidenceHash"]
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance, self.schema)

    def test_invalid_verdict_class_fails(self) -> None:
        """verdict=3 is not in enum {0,1,2} and must fail."""
        instance = _load(VECTORS_DIR / "verdict_sample_v1.json")
        instance.pop("_comment", None)
        instance["onChain"]["verdict"] = 3
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance, self.schema)

    def test_pfake_bps_out_of_range_fails(self) -> None:
        """pFakeBps > 10000 must fail."""
        instance = _load(VECTORS_DIR / "verdict_sample_v1.json")
        instance.pop("_comment", None)
        instance["onChain"]["pFakeBps"] = 10001
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance, self.schema)


class TestEvidenceSchema:
    schema = _load(SCHEMAS_DIR / "evidence.schema.json")

    def test_sample_v1_is_valid(self) -> None:
        """evidence_sample_v1.json must pass evidence.schema.json."""
        instance = _load(VECTORS_DIR / "evidence_sample_v1.json")
        instance.pop("_comment", None)
        _validate(instance, self.schema)

    def test_missing_attester_fails(self) -> None:
        """Omitting attester must fail."""
        instance = _load(VECTORS_DIR / "evidence_sample_v1.json")
        instance.pop("_comment", None)
        del instance["attester"]
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance, self.schema)

    def test_invalid_verdict_in_aggregate_fails(self) -> None:
        """aggregate.verdict=5 must fail."""
        instance = _load(VECTORS_DIR / "evidence_sample_v1.json")
        instance.pop("_comment", None)
        instance["aggregate"]["verdict"] = 5
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance, self.schema)
