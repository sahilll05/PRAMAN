"""CLIP Embedding Extractor for PRAMAN (T1.2).

Extracts normalized visual embeddings on GPU (fp16) and saves as
NumPy memory-mapped arrays in dataset/embeddings/.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np
import open_clip
import torch
from torch.utils.data import DataLoader

from lv_ml.data.dataset import PramanDataset


class ClipEmbeddingExtractor:
    """Extracts and caches CLIP embeddings with mixed-precision GPU acceleration."""

    def __init__(
        self,
        model_name: str = "ViT-B-32",
        pretrained: str = "laion2b_s34b_b79k",
        device: str | None = None,
    ) -> None:
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.model_name = model_name
        self.pretrained = pretrained

        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name,
            pretrained=pretrained,
            device=self.device,
            precision="fp16" if self.device == "cuda" else "fp32",
        )
        self.model.eval()

    def extract_and_cache(
        self,
        manifest_path: str | Path,
        output_embeddings_path: str | Path,
        output_labels_path: str | Path,
        batch_size: int = 128,
        num_workers: int = 2,
    ) -> dict[str, Any]:
        """Extract embeddings for all samples in manifest and save as fp16 NumPy memmap."""
        output_embeddings_path = Path(output_embeddings_path)
        output_labels_path = Path(output_labels_path)
        output_embeddings_path.parent.mkdir(parents=True, exist_ok=True)
        output_labels_path.parent.mkdir(parents=True, exist_ok=True)

        dataset = PramanDataset(manifest_path, transform=self.preprocess)
        n_samples = len(dataset)

        if n_samples == 0:
            raise ValueError(f"Manifest at {manifest_path} contains 0 samples.")

        dataloader = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers if self.device == "cuda" else 0,
            pin_memory=(self.device == "cuda"),
        )

        # Get embedding dimension
        embed_dim = self.model.visual.output_dim  # e.g. 512 for ViT-B-32

        # Create memory-mapped array for embeddings
        fp16_memmap = np.memmap(
            output_embeddings_path,
            dtype=np.float16,
            mode="w+",
            shape=(n_samples, embed_dim),
        )
        labels_arr = np.zeros(n_samples, dtype=np.int64)

        if self.device == "cuda":
            torch.cuda.reset_peak_memory_stats()
            torch.cuda.synchronize()

        start_time = time.time()
        idx_offset = 0

        with torch.inference_mode():
            for batch_images, batch_labels, _ in dataloader:
                batch_images = batch_images.to(self.device)
                if self.device == "cuda":
                    batch_images = batch_images.half()

                # Extract features and L2-normalize
                features = self.model.encode_image(batch_images)
                features = features / features.norm(dim=-1, keepdim=True)

                features_cpu = features.cpu().to(torch.float16).numpy()
                batch_len = len(features_cpu)

                fp16_memmap[idx_offset : idx_offset + batch_len] = features_cpu
                labels_arr[idx_offset : idx_offset + batch_len] = batch_labels.numpy()

                idx_offset += batch_len

        if self.device == "cuda":
            torch.cuda.synchronize()

        total_time = time.time() - start_time
        fp16_memmap.flush()

        # Save labels
        np.save(output_labels_path, labels_arr)

        throughput = n_samples / total_time if total_time > 0 else 0.0
        peak_vram_mib = (
            torch.cuda.max_memory_allocated() / (1024 * 1024) if self.device == "cuda" else 0.0
        )

        metrics = {
            "n_samples": n_samples,
            "embed_dim": embed_dim,
            "total_time_sec": round(total_time, 2),
            "images_per_sec": round(throughput, 2),
            "peak_vram_mib": round(peak_vram_mib, 2),
            "device": self.device,
            "model_name": self.model_name,
            "pretrained": self.pretrained,
            "embeddings_file": str(output_embeddings_path),
            "labels_file": str(output_labels_path),
        }
        return metrics
