"""Unit tests for dataset splitting and PramanaDataset loader (T1.1)."""

import json
from pathlib import Path

import numpy as np
from PIL import Image
import torch

from lv_ml.data.dataset import PramanaDataset
from lv_ml.data.splits import verify_split_disjointness


def test_verify_split_disjointness_success() -> None:
    train_manifest = [
        {"image_name": "img1.png", "label": 1, "model_name": "gen_a"},
        {"image_name": "img2.png", "label": 1, "model_name": "gen_b"},
        {"image_name": "img3.png", "label": 0, "model_name": None},
    ]
    test_disjoint = [
        {"image_name": "img4.png", "label": 1, "model_name": "gen_c"},
        {"image_name": "img5.png", "label": 0, "model_name": None},
    ]

    res = verify_split_disjointness(train_manifest, test_disjoint)
    assert res["is_disjoint"] is True
    assert len(res["generator_overlap"]) == 0
    assert res["sample_overlap_count"] == 0


def test_verify_split_disjointness_catches_generator_leak() -> None:
    train_manifest = [
        {"image_name": "img1.png", "label": 1, "model_name": "gen_a"},
        {"image_name": "img2.png", "label": 1, "model_name": "gen_b"},
    ]
    test_leaked = [
        {"image_name": "img3.png", "label": 1, "model_name": "gen_a"},  # LEAK!
    ]

    res = verify_split_disjointness(train_manifest, test_leaked)
    assert res["is_disjoint"] is False
    assert "gen_a" in res["generator_overlap"]


def test_verify_split_disjointness_catches_sample_overlap() -> None:
    train_manifest = [
        {"image_name": "img1.png", "label": 1, "model_name": "gen_a"},
    ]
    test_sample_overlap = [
        {"image_name": "img1.png", "label": 1, "model_name": "gen_b"},  # Same image ID!
    ]

    res = verify_split_disjointness(train_manifest, test_sample_overlap)
    assert res["is_disjoint"] is False
    assert res["sample_overlap_count"] == 1


def test_pramana_dataset_loading(tmp_path: Path) -> None:
    # Create dummy images
    img1_path = tmp_path / "img1.png"
    img2_path = tmp_path / "img2.png"

    arr1 = np.full((32, 32, 3), 100, dtype=np.uint8)
    arr2 = np.full((32, 32, 3), 200, dtype=np.uint8)

    Image.fromarray(arr1, "RGB").save(img1_path)
    Image.fromarray(arr2, "RGB").save(img2_path)

    manifest_data = [
        {"image_name": "img1.png", "label": 0, "local_path": str(img1_path)},
        {"image_name": "img2.png", "label": 1, "local_path": str(img2_path)},
    ]
    manifest_path = tmp_path / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f)

    ds = PramanaDataset(manifest_path)
    assert len(ds) == 2

    tensor, label, meta = ds[0]
    assert isinstance(tensor, torch.Tensor)
    assert label == 0
    assert meta["image_name"] == "img1.png"
