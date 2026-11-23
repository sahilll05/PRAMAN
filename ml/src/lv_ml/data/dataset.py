"""PyTorch Dataset loader for PRAMAN manifests (T1.1).

Full-image preprocessing only (MVP: still images, no face-crop pipeline).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset


class PramanDataset(Dataset[tuple[torch.Tensor, int, dict[str, Any]]]):
    """Loads images from a PRAMAN split manifest with full-image preprocessing."""

    def __init__(
        self,
        manifest_path: str | Path,
        transform: Callable[[Image.Image], torch.Tensor] | None = None,
    ) -> None:
        self.manifest_path = Path(manifest_path)
        with open(self.manifest_path, encoding="utf-8") as f:
            self.samples: list[dict[str, Any]] = json.load(f)

        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int, dict[str, Any]]:
        sample = self.samples[idx]
        image_path = Path(sample["local_path"])

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found at {image_path}")

        image = Image.open(image_path).convert("RGB")

        if self.transform is not None:
            tensor = self.transform(image)
        else:
            # Default fallback: ToTensor normalization
            arr = np.asarray(image, dtype=np.float32) / 255.0
            tensor = torch.from_numpy(arr).permute(2, 0, 1)

        label = int(sample["label"])
        return tensor, label, sample


PramanaDataset = PramanDataset
