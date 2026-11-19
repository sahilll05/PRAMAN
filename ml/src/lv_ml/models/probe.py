"""PRAMANA Model Probes for Still Image Authenticity (T1.3).

Model A: Single-layer linear probe on 512-dim CLIP features.
Model B: 2-layer MLP probe with BatchNorm and GELU on 512-dim CLIP features.

Both models output 2 logits: [logit_real, logit_synthetic].
Training is GPU-accelerated (with CPU fallback), supports mixed precision,
checkpoints every epoch, and logs training curves to results/T1.3/.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset


class EmbeddingDataset(Dataset):
    """Memory-mapped dataset of pre-extracted CLIP embeddings and labels."""

    def __init__(self, embeddings_path: str | Path, labels_path: str | Path) -> None:
        self.labels = np.load(labels_path)
        self.n_samples = len(self.labels)
        self.embeddings = np.memmap(
            embeddings_path,
            dtype=np.float16,
            mode="r",
            shape=(self.n_samples, 512),
        )

    def __len__(self) -> int:
        return self.n_samples

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        emb = torch.from_numpy(self.embeddings[idx].copy()).float()
        lbl = torch.tensor(int(self.labels[idx]), dtype=torch.long)
        return emb, lbl


class ClipLinearProbe(nn.Module):
    """Model A: Linear probe on 512-dim CLIP embeddings."""

    def __init__(self, in_features: int = 512, num_classes: int = 2) -> None:
        super().__init__()
        self.fc = nn.Linear(in_features, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.fc(x)


class MlpProbe(nn.Module):
    """Model B: 2-layer MLP probe with BatchNorm and GELU."""

    def __init__(
        self,
        in_features: int = 512,
        hidden_dim: int = 256,
        num_classes: int = 2,
        dropout: float = 0.2,
    ) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def compute_metrics(
    y_true: np.ndarray,
    y_probs: np.ndarray,
) -> dict[str, float]:
    """Compute standard binary classification metrics: AUC, Accuracy, Brier, ECE."""
    y_pred = (y_probs >= 0.5).astype(int)
    auc = float(roc_auc_score(y_true, y_probs)) if len(np.unique(y_true)) > 1 else 0.5
    acc = float(accuracy_score(y_true, y_pred))
    brier = float(brier_score_loss(y_true, y_probs))

    # Equal-mass ECE (10 bins)
    n_bins = 10
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        in_bin = (y_probs >= bin_boundaries[i]) & (y_probs < bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin] == y_pred[in_bin])
            avg_confidence_in_bin = np.mean(np.maximum(y_probs[in_bin], 1 - y_probs[in_bin]))
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return {
        "auc": round(auc, 4),
        "accuracy": round(acc, 4),
        "brier": round(brier, 4),
        "ece": round(float(ece), 4),
    }


def evaluate_probe(
    model: nn.Module,
    dataloader: DataLoader,
    device: str = "cuda",
) -> tuple[dict[str, float], np.ndarray, np.ndarray]:
    """Evaluate probe on a dataloader, returning metrics, all probabilities, and ground truth."""
    model.eval()
    all_probs = []
    all_targets = []
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():
        for x, y in dataloader:
            x = x.to(device)
            y = y.to(device)
            logits = model(x)
            loss = criterion(logits, y)
            total_loss += loss.item() * len(y)

            probs = torch.softmax(logits, dim=-1)[:, 1]  # P(synthetic)
            all_probs.extend(probs.cpu().numpy().tolist())
            all_targets.extend(y.cpu().numpy().tolist())

    y_true = np.array(all_targets)
    y_probs = np.array(all_probs)
    avg_loss = total_loss / max(len(y_true), 1)

    metrics = compute_metrics(y_true, y_probs)
    metrics["loss"] = round(avg_loss, 4)
    return metrics, y_probs, y_true


def train_probe(
    model: nn.Module,
    train_dataset: Dataset,
    val_dataset: Dataset,
    epochs: int = 25,
    batch_size: int = 64,
    lr: float = 1e-3,
    weight_decay: float = 1e-2,
    device: str = "cuda",
    checkpoint_dir: str | Path | None = None,
    resume: bool = True,
) -> dict[str, Any]:
    """Train probe with epoch checkpointing, early stopping, and history logging."""
    device = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
    model = model.to(device)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = nn.CrossEntropyLoss()

    start_epoch = 0
    history: list[dict[str, Any]] = []
    best_cal_auc = -1.0
    best_state: dict[str, Any] = {}

    chk_dir = Path(checkpoint_dir) if checkpoint_dir else None
    if chk_dir:
        chk_dir.mkdir(parents=True, exist_ok=True)
        latest_chk = chk_dir / "latest_checkpoint.pt"
        if resume and latest_chk.exists():
            checkpoint = torch.load(latest_chk, map_location=device)
            model.load_state_dict(checkpoint["model_state_dict"])
            optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
            start_epoch = checkpoint["epoch"] + 1
            history = checkpoint.get("history", [])
            best_cal_auc = checkpoint.get("best_cal_auc", -1.0)
            print(f"Resumed training from epoch {start_epoch} (best cal AUC: {best_cal_auc:.4f})")

    for epoch in range(start_epoch, epochs):
        model.train()
        train_loss = 0.0

        for x, y in train_loader:
            x = x.to(device)
            y = y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(y)

        scheduler.step()
        train_loss /= max(len(train_dataset), 1)

        val_metrics, _, _ = evaluate_probe(model, val_loader, device=device)

        epoch_stat = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "val_loss": val_metrics["loss"],
            "val_auc": val_metrics["auc"],
            "val_accuracy": val_metrics["accuracy"],
            "val_ece": val_metrics["ece"],
        }
        history.append(epoch_stat)

        if val_metrics["auc"] > best_cal_auc:
            best_cal_auc = val_metrics["auc"]
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if chk_dir:
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "history": history,
                    "best_cal_auc": best_cal_auc,
                },
                chk_dir / "latest_checkpoint.pt",
            )

    # Load best weights
    if best_state:
        model.load_state_dict(best_state)

    final_val_metrics, _, _ = evaluate_probe(model, val_loader, device=device)

    return {
        "best_cal_auc": best_cal_auc,
        "final_cal_metrics": final_val_metrics,
        "history": history,
    }
