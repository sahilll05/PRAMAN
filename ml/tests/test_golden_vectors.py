"""Validation tests against canonical golden vectors in spec/vectors/."""

import json
from pathlib import Path

import numpy as np
from PIL import Image

from lv_ml.fingerprint.phash import compute_phash


def test_golden_fingerprint_vectors_in_python() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    vectors_file = repo_root / "spec" / "vectors" / "fingerprint_v1.json"

    assert vectors_file.exists(), f"Golden vectors file missing at {vectors_file}"

    with open(vectors_file, encoding="utf-8") as f:
        data = json.load(f)

    assert data["specVersion"] == "0.1.0-draft"
    assert len(data["vectors"]) > 0

    for vec in data["vectors"]:
        mat = np.array(vec["matrix32x32"], dtype=np.uint8)
        img = Image.fromarray(mat, mode="L")
        computed_phash = compute_phash(img)
        expected_phash_dec = int(vec["phash_dec"])
        expected_phash_hex = vec["phash_hex"]

        computed_hex = hex(computed_phash)[2:].zfill(16)
        msg_dec = f"Vector {vec['id']} pHash mismatch: {computed_phash} != {expected_phash_dec}"
        assert computed_phash == expected_phash_dec, msg_dec
        assert computed_hex == expected_phash_hex, (
            f"Vector {vec['id']} pHash hex mismatch: {computed_hex} != {expected_phash_hex}"
        )
