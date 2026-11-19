"""Split creation and verification utilities for PRAMANA (T1.1).

Enforces generator-disjoint splitting:
G_train and G_test have zero generator overlap.
Also verifies no sample overlaps across splits.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def verify_split_disjointness(
    train_manifest: list[dict[str, Any]] | Path | str,
    test_disjoint_manifest: list[dict[str, Any]] | Path | str,
) -> dict[str, Any]:
    """Verify that train and test_disjoint have zero generator overlap and zero sample overlap.

    Returns:
        Dict with verification metrics: is_disjoint (bool), generator_overlap (set),
        sample_overlap (set).
    """
    if isinstance(train_manifest, (str, Path)):
        with open(train_manifest, encoding="utf-8") as f:
            train_data = json.load(f)
    else:
        train_data = train_manifest

    if isinstance(test_disjoint_manifest, (str, Path)):
        with open(test_disjoint_manifest, encoding="utf-8") as f:
            test_data = json.load(f)
    else:
        test_data = test_disjoint_manifest

    # Only synthetic samples have generators that must be disjoint
    # Real samples are paired or sourced from standard corpora
    train_generators = {
        item["model_name"]
        for item in train_data
        if item.get("label") == 1 and item.get("model_name")
    }
    test_generators = {
        item["model_name"]
        for item in test_data
        if item.get("label") == 1 and item.get("model_name")
    }

    generator_overlap = train_generators.intersection(test_generators)

    train_ids = {item["image_name"] for item in train_data}
    test_ids = {item["image_name"] for item in test_data}
    sample_overlap = train_ids.intersection(test_ids)

    is_disjoint = (len(generator_overlap) == 0) and (len(sample_overlap) == 0)

    return {
        "is_disjoint": is_disjoint,
        "train_generator_count": len(train_generators),
        "test_generator_count": len(test_generators),
        "generator_overlap": list(generator_overlap),
        "sample_overlap_count": len(sample_overlap),
    }
