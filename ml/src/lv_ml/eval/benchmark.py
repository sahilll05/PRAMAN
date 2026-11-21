"""PRAMAN Phase 1 Benchmark Experiments Suite (T1.5).

Implements the frozen protocols from Evaluation Protocol:
- E1:  In-domain sanity evaluation (CF-Small + COCO balanced test set)
- E2:  Generator-disjoint evaluation (held-out generator AbyssOrangeMix vs COCO real)
- E2b: Cross-dataset evaluation (OpenFake core with Flux, SD3.5, DALL-E 3, SDXL)
- E2c: In-the-wild evaluation (OpenFake reddit test set)
- E3:  Robustness under JPEG (95,75,50,30), resize (0.75, 0.50), blur, and noise
- E5b: CPU-vs-GPU numerical agreement on N=200 test images
"""

import io
import json
import platform
import random
import time
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image, ImageFilter
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
)

from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
from lv_ml.models.probe import ClipLinearProbe, MlpProbe, compute_metrics
from lv_ml.runner.cpu_runner import ReferenceRunner


def extract_pil_from_openfake(img_val: Any) -> Image.Image:
    """Extract RGB PIL Image from OpenFake row data."""
    if isinstance(img_val, dict) and "bytes" in img_val:
        return Image.open(io.BytesIO(img_val["bytes"])).convert("RGB")
    elif isinstance(img_val, (bytes, bytearray)):
        return Image.open(io.BytesIO(img_val)).convert("RGB")
    elif hasattr(img_val, "convert"):
        return cast(Image.Image, img_val.convert("RGB"))
    else:
        raise ValueError(f"Unknown image value format: {type(img_val)}")


def get_git_sha(repo_root: Path) -> str:
    git_head = repo_root / ".git" / "HEAD"
    if not git_head.exists():
        return "UNKNOWN"
    content = git_head.read_text().strip()
    if content.startswith("ref: "):
        ref_path = repo_root / ".git" / content[5:]
        return ref_path.read_text().strip() if ref_path.exists() else "UNKNOWN"
    return content


def write_env_txt(output_path: Path) -> None:
    env_str = (
        f"Platform: {platform.platform()}\n"
        f"Python: {platform.python_version()}\n"
        f"PyTorch: {torch.__version__}\n"
        f"CUDA Available: {torch.cuda.is_available()}\n"
        f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}\n"
    )
    output_path.write_text(env_str)


class BenchmarkRunner:
    """Executes all Phase 1 benchmark experiments and records results."""

    def __init__(self, repo_root: str | Path, device: str = "cuda") -> None:
        self.root = Path(repo_root)
        self.device = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
        self.git_sha = get_git_sha(self.root)

        self.models_dir = self.root / "dataset" / "models"
        self.emb_dir = self.root / "dataset" / "embeddings"
        self.splits_dir = self.root / "dataset" / "splits"
        self.results_dir = self.root / "results"

        # Load trained PyTorch models
        self.model_a = ClipLinearProbe(in_features=512, num_classes=2)
        self.model_a.load_state_dict(
            torch.load(self.models_dir / "model_a.pt", map_location=self.device)
        )
        self.model_a.to(self.device)
        self.model_a.eval()

        self.model_b = MlpProbe(in_features=512, hidden_dim=256, num_classes=2)
        self.model_b.load_state_dict(
            torch.load(self.models_dir / "model_b.pt", map_location=self.device)
        )
        self.model_b.to(self.device)
        self.model_b.eval()

        # Visual feature extractor
        self.extractor = ClipEmbeddingExtractor(
            model_name="ViT-B-32", pretrained="laion2b_s34b_b79k", device=self.device
        )

    def _eval_model(self, model: nn.Module, X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
        with torch.no_grad():
            tensor_x = torch.from_numpy(X.astype(np.float32)).to(self.device)
            logits = model(tensor_x)
            probs = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()

        y_pred = (probs >= 0.5).astype(int)
        metrics = compute_metrics(y, probs)
        metrics["precision"] = round(float(precision_score(y, y_pred, zero_division=0)), 4)
        metrics["recall"] = round(float(recall_score(y, y_pred, zero_division=0)), 4)
        metrics["f1"] = round(float(f1_score(y, y_pred, zero_division=0)), 4)
        return metrics

    # ------------------------------------------------------------------
    # E1: In-Domain Sanity Evaluation
    # ------------------------------------------------------------------
    def run_e1(self) -> dict[str, Any]:
        print("\n==================== [E1] In-Domain Sanity Benchmark ====================")
        out_dir = self.results_dir / "E1"
        out_dir.mkdir(parents=True, exist_ok=True)

        lbls = np.load(self.emb_dir / "balanced_test_indomain_labels.npy")
        embs = np.memmap(
            self.emb_dir / "balanced_test_indomain_embeddings.dat",
            dtype=np.float16,
            mode="r",
            shape=(len(lbls), 512),
        ).copy()

        metrics_a = self._eval_model(self.model_a, embs, lbls)
        metrics_b = self._eval_model(self.model_b, embs, lbls)

        print(
            f"Model A (Linear): AUC={metrics_a['auc']} | Acc={metrics_a['accuracy']} | ECE={metrics_a['ece']} | Brier={metrics_a['brier']}"
        )
        print(
            f"Model B (MLP):    AUC={metrics_b['auc']} | Acc={metrics_b['accuracy']} | ECE={metrics_b['ece']} | Brier={metrics_b['brier']}"
        )

        report = {
            "experiment": "E1",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "CommunityForensics-Small + COCO val2017 (balanced in-domain test split)",
            "n_samples": len(lbls),
            "label_distribution": {
                str(k): int(v) for k, v in zip(*np.unique(lbls, return_counts=True))
            },
            "model_a": metrics_a,
            "model_b": metrics_b,
            "pre_registered_target_met": metrics_a["auc"] > 0.80 and metrics_b["auc"] > 0.80,
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps(
                {
                    "dataset": "balanced_test_indomain.json",
                    "split": "test_indomain",
                    "n_samples": len(lbls),
                },
                indent=2,
            )
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    # ------------------------------------------------------------------
    # E2: Generator-Disjoint Evaluation
    # ------------------------------------------------------------------
    def run_e2(self) -> dict[str, Any]:
        print("\n==================== [E2] Generator-Disjoint Benchmark ====================")
        out_dir = self.results_dir / "E2"
        out_dir.mkdir(parents=True, exist_ok=True)

        lbls = np.load(self.emb_dir / "balanced_test_disjoint_labels.npy")
        embs = np.memmap(
            self.emb_dir / "balanced_test_disjoint_embeddings.dat",
            dtype=np.float16,
            mode="r",
            shape=(len(lbls), 512),
        ).copy()

        metrics_a = self._eval_model(self.model_a, embs, lbls)
        metrics_b = self._eval_model(self.model_b, embs, lbls)

        with open(self.splits_dir / "balanced_test_disjoint.json") as f:
            disjoint_records = json.load(f)

        generator_breakdown: dict[str, dict[str, Any]] = {}
        for r, emb in zip(disjoint_records, embs):
            gen = r.get("model_name", "unknown")
            if gen not in generator_breakdown:
                generator_breakdown[gen] = {"count": 0, "correct_a": 0, "correct_b": 0}
            generator_breakdown[gen]["count"] += 1

            with torch.no_grad():
                feat = torch.from_numpy(emb.astype(np.float32)).unsqueeze(0).to(self.device)
                pred_a = int(torch.argmax(self.model_a(feat), dim=-1).item())
                pred_b = int(torch.argmax(self.model_b(feat), dim=-1).item())

            if pred_a == r["label"]:
                generator_breakdown[gen]["correct_a"] += 1
            if pred_b == r["label"]:
                generator_breakdown[gen]["correct_b"] += 1

        for gen, stats in generator_breakdown.items():
            stats["acc_a"] = round(stats["correct_a"] / stats["count"], 4)
            stats["acc_b"] = round(stats["correct_b"] / stats["count"], 4)

        print(
            f"Model A (Linear): AUC={metrics_a['auc']} | Acc={metrics_a['accuracy']} | ECE={metrics_a['ece']}"
        )
        print(
            f"Model B (MLP):    AUC={metrics_b['auc']} | Acc={metrics_b['accuracy']} | ECE={metrics_b['ece']}"
        )
        print(f"Per-generator breakdown: {generator_breakdown}")

        report = {
            "experiment": "E2",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "CommunityForensics-Small (held-out WarriorMama777/AbyssOrangeMix) + COCO",
            "n_samples": len(lbls),
            "model_a": metrics_a,
            "model_b": metrics_b,
            "per_generator_breakdown": generator_breakdown,
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps(
                {
                    "dataset": "balanced_test_disjoint.json",
                    "held_out_generator": "WarriorMama777/AbyssOrangeMix",
                },
                indent=2,
            )
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    # ------------------------------------------------------------------
    # E2b: Cross-Dataset Evaluation on OpenFake Core
    # ------------------------------------------------------------------
    def run_e2b(self) -> dict[str, Any]:
        print(
            "\n==================== [E2b] Cross-Dataset Benchmark (OpenFake Core) ===================="
        )
        out_dir = self.results_dir / "E2b"
        out_dir.mkdir(parents=True, exist_ok=True)

        df0 = pd.read_parquet(self.root / "dataset" / "openfake" / "core_train_0.parquet")
        df1 = pd.read_parquet(self.root / "dataset" / "openfake" / "core_train_1.parquet")
        df = pd.concat([df0, df1], ignore_index=True)

        y_true = np.array(
            [1 if row["label"] == "fake" else 0 for _, row in df.iterrows()], dtype=np.int64
        )

        print(f"Extracting CLIP features for {len(df)} OpenFake core images...")
        feats = []
        with torch.inference_mode():
            for idx, row in df.iterrows():
                img = extract_pil_from_openfake(row["image"])
                t = self.extractor.preprocess(img).unsqueeze(0).to(self.device)
                if self.device == "cuda":
                    t = t.half()
                f = self.extractor.model.encode_image(t)
                f = f / f.norm(dim=-1, keepdim=True)
                feats.append(f.cpu().float().numpy()[0])

        X_openfake = np.array(feats, dtype=np.float32)

        metrics_a = self._eval_model(self.model_a, X_openfake, y_true)
        metrics_b = self._eval_model(self.model_b, X_openfake, y_true)

        # Per-model breakdown
        model_breakdown = {}
        for m_name in df["model"].unique():
            idx = df["model"] == m_name
            sub_y = y_true[idx]
            sub_X = X_openfake[idx]
            if len(sub_y) > 0:
                with torch.no_grad():
                    logits_a = self.model_a(torch.from_numpy(sub_X).to(self.device))
                    preds_a = (
                        (torch.softmax(logits_a, dim=-1)[:, 1] >= 0.5).cpu().numpy().astype(int)
                    )
                acc_a = float(np.mean(preds_a == sub_y))
                model_breakdown[m_name] = {
                    "count": int(np.sum(idx)),
                    "label": "fake" if sub_y[0] == 1 else "real",
                    "accuracy_model_a": round(acc_a, 4),
                }

        print(
            f"Cross-Dataset Model A: AUC={metrics_a['auc']} | Acc={metrics_a['accuracy']} | ECE={metrics_a['ece']}"
        )
        print(
            f"Cross-Dataset Model B: AUC={metrics_b['auc']} | Acc={metrics_b['accuracy']} | ECE={metrics_b['ece']}"
        )
        print(f"Sample Generator Accuracies: {dict(list(model_breakdown.items())[:5])}")

        report = {
            "experiment": "E2b",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "ComplexDataLab/OpenFake (core split zero-shot)",
            "n_samples": len(y_true),
            "label_distribution": {
                "fake": int(np.sum(y_true == 1)),
                "real": int(np.sum(y_true == 0)),
            },
            "model_a": metrics_a,
            "model_b": metrics_b,
            "per_model_breakdown": model_breakdown,
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps(
                {
                    "dataset": "ComplexDataLab/OpenFake core",
                    "source_files": ["core_train_0.parquet", "core_train_1.parquet"],
                },
                indent=2,
            )
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    # ------------------------------------------------------------------
    # E2c: In-The-Wild Evaluation on OpenFake Reddit
    # ------------------------------------------------------------------
    def run_e2c(self) -> dict[str, Any]:
        print(
            "\n==================== [E2c] In-The-Wild Benchmark (OpenFake Reddit) ===================="
        )
        out_dir = self.results_dir / "E2c"
        out_dir.mkdir(parents=True, exist_ok=True)

        df_reddit = pd.read_parquet(self.root / "dataset" / "openfake" / "reddit_00026.parquet")
        real_images = [extract_pil_from_openfake(row["image"]) for _, row in df_reddit.iterrows()]
        n_real = len(real_images)

        # Pair with disjoint synthetic images to form balanced in-the-wild test
        with open(self.splits_dir / "balanced_test_disjoint.json") as f:
            disjoint_records = json.load(f)
        synth_records = [r for r in disjoint_records if r["label"] == 1][:n_real]
        synth_images = [
            Image.open(self.root / r["local_path"]).convert("RGB") for r in synth_records
        ]

        all_images = real_images + synth_images
        y_true = np.array([0] * len(real_images) + [1] * len(synth_images), dtype=np.int64)

        print(f"Extracting CLIP features for {len(all_images)} in-the-wild test images...")
        feats = []
        with torch.inference_mode():
            for img in all_images:
                t = self.extractor.preprocess(img).unsqueeze(0).to(self.device)
                if self.device == "cuda":
                    t = t.half()
                f = self.extractor.model.encode_image(t)
                f = f / f.norm(dim=-1, keepdim=True)
                feats.append(f.cpu().float().numpy()[0])

        X_wild = np.array(feats, dtype=np.float32)

        metrics_a = self._eval_model(self.model_a, X_wild, y_true)
        metrics_b = self._eval_model(self.model_b, X_wild, y_true)

        print(
            f"In-The-Wild Model A: AUC={metrics_a['auc']} | Acc={metrics_a['accuracy']} | ECE={metrics_a['ece']}"
        )
        print(
            f"In-The-Wild Model B: AUC={metrics_b['auc']} | Acc={metrics_b['accuracy']} | ECE={metrics_b['ece']}"
        )

        report = {
            "experiment": "E2c",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "ComplexDataLab/OpenFake reddit + Held-out Synthetic images",
            "n_samples": len(y_true),
            "label_distribution": {"real": len(real_images), "fake": len(synth_images)},
            "model_a": metrics_a,
            "model_b": metrics_b,
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps({"dataset": "OpenFake reddit_00026.parquet + AbyssOrangeMix"}, indent=2)
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    # ------------------------------------------------------------------
    # E3: Degradation Robustness Benchmark
    # ------------------------------------------------------------------
    def run_e3(self, n_subset: int = 200) -> dict[str, Any]:
        print("\n==================== [E3] Degradation Robustness Benchmark ====================")
        out_dir = self.results_dir / "E3"
        out_dir.mkdir(parents=True, exist_ok=True)

        with open(self.splits_dir / "balanced_test_indomain.json") as f:
            records = json.load(f)

        rng = random.Random(42)
        sample_records = rng.sample(records, min(n_subset, len(records)))
        y_true = np.array([r["label"] for r in sample_records], dtype=np.int64)

        loaded_imgs = [
            Image.open(self.root / r["local_path"]).convert("RGB") for r in sample_records
        ]

        conditions: dict[str, Any] = {
            "clean": lambda img: img,
            "jpeg_q95": lambda img: self._recompress_jpeg(img, 95),
            "jpeg_q75": lambda img: self._recompress_jpeg(img, 75),
            "jpeg_q50": lambda img: self._recompress_jpeg(img, 50),
            "jpeg_q30": lambda img: self._recompress_jpeg(img, 30),
            "resize_075": lambda img: img.resize(
                (int(img.width * 0.75), int(img.height * 0.75)), Image.Resampling.BILINEAR
            ).resize(img.size, Image.Resampling.BILINEAR),
            "resize_050": lambda img: img.resize(
                (int(img.width * 0.50), int(img.height * 0.50)), Image.Resampling.BILINEAR
            ).resize(img.size, Image.Resampling.BILINEAR),
            "gaussian_blur": lambda img: img.filter(ImageFilter.GaussianBlur(radius=1.5)),
            "gaussian_noise": lambda img: self._add_noise(img, sigma=15.0),
        }

        results_curve = {}
        for cond_name, transform_fn in conditions.items():
            print(f"Evaluating degradation: {cond_name}...")
            feats = []
            with torch.inference_mode():
                for img in loaded_imgs:
                    t_img = transform_fn(img)
                    t = self.extractor.preprocess(t_img).unsqueeze(0).to(self.device)
                    if self.device == "cuda":
                        t = t.half()
                    f = self.extractor.model.encode_image(t)
                    f = f / f.norm(dim=-1, keepdim=True)
                    feats.append(f.cpu().float().numpy()[0])

            X_deg = np.array(feats, dtype=np.float32)
            met_a = self._eval_model(self.model_a, X_deg, y_true)
            met_b = self._eval_model(self.model_b, X_deg, y_true)

            results_curve[cond_name] = {
                "model_a_auc": met_a["auc"],
                "model_a_acc": met_a["accuracy"],
                "model_b_auc": met_b["auc"],
                "model_b_acc": met_b["accuracy"],
            }
            print(f"  {cond_name}: Model A AUC={met_a['auc']:.4f} | Model B AUC={met_b['auc']:.4f}")

        report = {
            "experiment": "E3",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "n_samples": len(sample_records),
            "conditions_evaluated": list(conditions.keys()),
            "results": results_curve,
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps(
                {"n_subset": len(sample_records), "conditions": list(conditions.keys())}, indent=2
            )
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    def _recompress_jpeg(self, img: Image.Image, quality: int) -> Image.Image:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        buf.seek(0)
        return Image.open(buf).convert("RGB")

    def _add_noise(self, img: Image.Image, sigma: float = 15.0) -> Image.Image:
        arr = np.array(img, dtype=np.float32)
        noise = np.random.normal(0, sigma, arr.shape)
        noisy = np.clip(arr + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(noisy)

    # ------------------------------------------------------------------
    # E5b: CPU-vs-GPU Numerical Agreement on N=200 Samples
    # ------------------------------------------------------------------
    def run_e5b(self, n_samples: int = 200) -> dict[str, Any]:
        print(
            "\n==================== [E5b] CPU-vs-GPU Agreement Benchmark (N=200) ===================="
        )
        out_dir = self.results_dir / "E5b"
        out_dir.mkdir(parents=True, exist_ok=True)

        with open(self.splits_dir / "balanced_test_indomain.json") as f:
            records = json.load(f)

        rng = random.Random(42)
        sample_records = rng.sample(records, min(n_samples, len(records)))

        # Initialize canonical CPU reference runner
        runner_a = ReferenceRunner(
            onnx_model_path=self.models_dir / "model_a.onnx",
            model_name="clip-linear-probe",
            model_version="0.1.0",
        )

        diffs_bps = []
        verdict_mismatches = 0
        per_sample_logs = []

        print(
            f"Comparing GPU fp16 path vs CPU ONNX fp32 path across {len(sample_records)} samples..."
        )
        t0 = time.time()

        for idx, r in enumerate(sample_records):
            img_path = self.root / r["local_path"]

            # 1. CPU Reference Runner
            verdict_cpu, evidence_cpu = runner_a.predict_image(img_path)
            p_fake_cpu = evidence_cpu["aggregate"]["pFake"]
            v_cpu = verdict_cpu["onChain"]["verdict"]

            # 2. GPU fp16 Path
            with Image.open(img_path) as pil_img:
                t = self.extractor.preprocess(pil_img.convert("RGB")).unsqueeze(0).to(self.device)
                if self.device == "cuda":
                    t = t.half()
                with torch.inference_mode():
                    feat = self.extractor.model.encode_image(t)
                    feat = feat / feat.norm(dim=-1, keepdim=True)
                    logits_gpu = self.model_a(feat.float())
                    probs_gpu = torch.softmax(logits_gpu, dim=-1)
                    p_fake_gpu = float(probs_gpu[0, 1].item())
                    v_gpu = 2 if p_fake_gpu >= 0.5 else 1

            p_fake_cpu_bps = int(round(p_fake_cpu * 10000))
            p_fake_gpu_bps = int(round(p_fake_gpu * 10000))
            bps_diff = abs(p_fake_cpu_bps - p_fake_gpu_bps)
            diffs_bps.append(bps_diff)

            if v_cpu != v_gpu:
                verdict_mismatches += 1

            if idx < 5:
                print(
                    f"  Sample {idx}: CPU pFake={p_fake_cpu:.4f} ({p_fake_cpu_bps} bps), GPU pFake={p_fake_gpu:.4f} ({p_fake_gpu_bps} bps), diff={bps_diff} bps, CPU verdict={v_cpu}, GPU verdict={v_gpu}"
                )

            per_sample_logs.append(
                {
                    "image_name": r["image_name"],
                    "p_fake_cpu": round(p_fake_cpu, 4),
                    "p_fake_gpu": round(p_fake_gpu, 4),
                    "diff_bps": bps_diff,
                    "verdict_cpu": v_cpu,
                    "verdict_gpu": v_gpu,
                }
            )

        elapsed = time.time() - t0
        diffs_np = np.array(diffs_bps)
        max_diff = int(np.max(diffs_np))
        mean_diff = float(np.mean(diffs_np))
        pct_99_diff = float(np.percentile(diffs_np, 99))
        mismatch_rate = round(verdict_mismatches / len(sample_records), 4)

        print(f"\n[E5b Summary across {len(sample_records)} samples in {elapsed:.1f}s]:")
        print(f"  Max |pFake diff|:      {max_diff} bps ({max_diff / 100:.2f}%)")
        print(f"  Mean |pFake diff|:     {mean_diff:.2f} bps ({mean_diff / 100:.3f}%)")
        print(f"  99th percentile diff:  {pct_99_diff:.2f} bps ({pct_99_diff / 100:.3f}%)")
        print(
            f"  Verdict mismatches:    {verdict_mismatches}/{len(sample_records)} ({mismatch_rate * 100:.2f}%)"
        )

        report = {
            "experiment": "E5b",
            "task": "T1.5",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "n_samples": len(sample_records),
            "max_diff_bps": max_diff,
            "mean_diff_bps": round(mean_diff, 2),
            "p99_diff_bps": round(pct_99_diff, 2),
            "verdict_mismatches": verdict_mismatches,
            "verdict_mismatch_rate": mismatch_rate,
            "elapsed_sec": round(elapsed, 2),
            "sample_logs": per_sample_logs[:20],
        }

        (out_dir / "metrics.json").write_text(json.dumps(report, indent=2))
        (out_dir / "config.json").write_text(
            json.dumps(
                {
                    "n_samples": len(sample_records),
                    "dataset": "balanced_test_indomain.json",
                    "seed": 42,
                },
                indent=2,
            )
        )
        (out_dir / "git_sha.txt").write_text(self.git_sha)
        write_env_txt(out_dir / "env.txt")
        return report

    def run_all(self) -> dict[str, Any]:
        """Run all Phase 1 benchmark experiments sequentially."""
        res_e1 = self.run_e1()
        res_e2 = self.run_e2()
        res_e2b = self.run_e2b()
        res_e2c = self.run_e2c()
        res_e3 = self.run_e3()
        res_e5b = self.run_e5b()

        return {
            "E1": res_e1,
            "E2": res_e2,
            "E2b": res_e2b,
            "E2c": res_e2c,
            "E3": res_e3,
            "E5b": res_e5b,
        }


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[4]
    runner = BenchmarkRunner(project_root)
    runner.run_all()
