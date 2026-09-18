import os
import sys
import time
import json
import copy
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


# ============================================================
# SETTINGS & HYPERPARAMETERS (DEEPGUARD MODEL V10 OMNISHIELD)
# ============================================================

DATA_ROOT = "dataset_v10"
TRAIN_DIR = os.path.join(DATA_ROOT, "train")
VALID_DIR = os.path.join(DATA_ROOT, "valid")

BATCH_SIZE = 64
EPOCHS = 15
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-3
PATIENCE = 4

MODEL_PATH = "best_deepfake_detector_v10.pth"
METRICS_PATH = "v10_training_metrics.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("=" * 65, flush=True)
print("DEEPGUARD MODEL V10 (OMNISHIELD) CONVNEXT TRAINING PIPELINE", flush=True)
print("=" * 65, flush=True)
print("Device:", DEVICE, flush=True)
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0), flush=True)
    print(f"Total VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB", flush=True)


# ============================================================
# DATA AUGMENTATION & ROBUSTNESS TRANSFORMS
# ============================================================

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(
        224,
        scale=(0.80, 1.0)
    ),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=10),
    transforms.ColorJitter(
        brightness=0.18,
        contrast=0.18,
        saturation=0.15,
        hue=0.03
    ),
    transforms.RandomGrayscale(p=0.04),
    transforms.RandomApply([
        transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.2))
    ], p=0.25),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

eval_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# FOCAL LOSS WITH HARD-EXAMPLE ATTENTION & LABEL SMOOTHING
# ============================================================

class FocalLoss(nn.Module):
    def __init__(self, gamma=1.5, label_smoothing=0.03):
        super().__init__()
        self.gamma = gamma
        self.ce = nn.CrossEntropyLoss(label_smoothing=label_smoothing, reduction='none')
        
    def forward(self, inputs, targets):
        ce_loss = self.ce(inputs, targets)
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()


def run_training():
    if not os.path.exists(TRAIN_DIR) or not os.path.exists(VALID_DIR):
        print(f"Error: Dataset directories not found: {TRAIN_DIR} or {VALID_DIR}", flush=True)
        sys.exit(1)

    train_dataset = datasets.ImageFolder(TRAIN_DIR, transform=train_transform)
    valid_dataset = datasets.ImageFolder(VALID_DIR, transform=eval_transform)

    print(f"\nClasses: {train_dataset.classes}", flush=True)
    print(f"Class mapping: {train_dataset.class_to_idx}", flush=True)
    print(f"Training samples:   {len(train_dataset):,}", flush=True)
    print(f"Validation samples: {len(valid_dataset):,}", flush=True)

    # Ensure class mapping is fake=0, real=1
    assert train_dataset.class_to_idx.get("fake") == 0, "Expected 'fake' to map to 0"
    assert train_dataset.class_to_idx.get("real") == 1, "Expected 'real' to map to 1"

    # In Windows, pin_memory=True with num_workers=2 works great
    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=2,
        pin_memory=True,
        persistent_workers=True
    )

    valid_loader = DataLoader(
        valid_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=2,
        pin_memory=True,
        persistent_workers=True
    )

    # ============================================================
    # ARCHITECTURE: CONVNEXT-TINY BACKBONE + FORENSIC HEAD
    # ============================================================
    print("\nInitializing ConvNeXt-Tiny with ImageNet-1K pretrained weights...", flush=True)
    weights = models.ConvNeXt_Tiny_Weights.DEFAULT
    model = models.convnext_tiny(weights=weights)
    
    # ConvNeXt classifier structure:
    # classifier[0]: LayerNorm2d((768,), eps=1e-06, elementwise_affine=True)
    # classifier[1]: Flatten(start_dim=1, end_dim=-1)
    # classifier[2]: Linear(in_features=768, out_features=1000, bias=True)
    num_features = model.classifier[2].in_features  # 768
    
    model.classifier = nn.Sequential(
        model.classifier[0],  # LayerNorm2d
        model.classifier[1],  # Flatten
        nn.Dropout(0.35),
        nn.Linear(num_features, 256),
        nn.GELU(),
        nn.Dropout(0.20),
        nn.Linear(256, 2)
    )
    model = model.to(DEVICE)

    # Focal Loss prioritizes subtle face swaps and inpainting boundaries
    criterion = FocalLoss(gamma=1.5, label_smoothing=0.03)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY
    )

    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=EPOCHS,
        eta_min=1e-6
    )

    scaler = torch.amp.GradScaler('cuda', enabled=(DEVICE.type == "cuda"))

    # ============================================================
    # TRAINING LOOP WITH MIXED PRECISION (AMP)
    # ============================================================
    best_f1 = 0.0
    best_epoch = 0
    patience_counter = 0

    history = {
        "train_loss": [],
        "train_acc": [],
        "valid_loss": [],
        "valid_acc": [],
        "valid_precision": [],
        "valid_recall": [],
        "valid_f1": []
    }

    start_training_time = time.time()
    print("\nStarting Model V10 (OmniShield) Training...", flush=True)

    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()
        model.train()

        running_loss = 0.0
        train_preds = []
        train_targets = []

        for batch_idx, (inputs, targets) in enumerate(train_loader):
            inputs = inputs.to(DEVICE, non_blocking=True)
            targets = targets.to(DEVICE, non_blocking=True)

            optimizer.zero_grad()

            with torch.amp.autocast('cuda', enabled=(DEVICE.type == "cuda")):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            train_preds.extend(preds.detach().cpu().numpy())
            train_targets.extend(targets.detach().cpu().numpy())

        epoch_train_loss = running_loss / len(train_dataset)
        epoch_train_acc = accuracy_score(train_targets, train_preds)

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_preds = []
        val_targets = []

        with torch.no_grad():
            for inputs, targets in valid_loader:
                inputs = inputs.to(DEVICE, non_blocking=True)
                targets = targets.to(DEVICE, non_blocking=True)

                with torch.amp.autocast('cuda', enabled=(DEVICE.type == "cuda")):
                    outputs = model(inputs)
                    loss = criterion(outputs, targets)

                val_loss += loss.item() * inputs.size(0)
                preds = torch.argmax(outputs, dim=1)
                val_preds.extend(preds.detach().cpu().numpy())
                val_targets.extend(targets.detach().cpu().numpy())

        epoch_val_loss = val_loss / len(valid_dataset)
        epoch_val_acc = accuracy_score(val_targets, val_preds)
        epoch_val_prec = precision_score(val_targets, val_preds, zero_division=0)
        epoch_val_rec = recall_score(val_targets, val_preds, zero_division=0)
        epoch_val_f1 = f1_score(val_targets, val_preds, zero_division=0)

        scheduler.step()
        epoch_time = time.time() - epoch_start
        current_lr = scheduler.get_last_lr()[0]

        history["train_loss"].append(epoch_train_loss)
        history["train_acc"].append(epoch_train_acc)
        history["valid_loss"].append(epoch_val_loss)
        history["valid_acc"].append(epoch_val_acc)
        history["valid_precision"].append(epoch_val_prec)
        history["valid_recall"].append(epoch_val_rec)
        history["valid_f1"].append(epoch_val_f1)

        print(f"Epoch [{epoch:02d}/{EPOCHS:02d}] ({epoch_time:.1f}s, lr: {current_lr:.6f}):", flush=True)
        print(f"  Train Loss: {epoch_train_loss:.4f} | Train Acc: {epoch_train_acc * 100:.2f}%", flush=True)
        print(f"  Valid Loss: {epoch_val_loss:.4f} | Valid Acc: {epoch_val_acc * 100:.2f}% | F1: {epoch_val_f1:.4f} | Prec: {epoch_val_prec:.4f} | Rec: {epoch_val_rec:.4f}", flush=True)

        # Checkpoint if F1 improved
        if epoch_val_f1 > best_f1:
            best_f1 = epoch_val_f1
            best_epoch = epoch
            patience_counter = 0
            
            # Save checkpoint with metadata for dynamic architecture detection
            checkpoint_payload = {
                "model_state_dict": model.state_dict(),
                "arch": "convnext_tiny",
                "model_name": "DeepGuard Model V10 OmniShield",
                "num_classes": 2,
                "epoch": epoch,
                "valid_f1": best_f1,
                "valid_acc": epoch_val_acc
            }
            torch.save(checkpoint_payload, MODEL_PATH)
            print(f"  --> Saved new best checkpoint to {MODEL_PATH} (F1: {best_f1:.4f}, Acc: {epoch_val_acc * 100:.2f}%)", flush=True)
        else:
            patience_counter += 1
            print(f"  Patience: {patience_counter}/{PATIENCE}", flush=True)
            if patience_counter >= PATIENCE:
                print(f"\nEarly stopping triggered after {epoch} epochs.", flush=True)
                break

    total_training_time = time.time() - start_training_time
    print("\n" + "=" * 65, flush=True)
    print("MODEL V10 TRAINING FINISHED", flush=True)
    print(f"Total time: {total_training_time / 60:.2f} minutes", flush=True)
    print(f"Best Epoch: {best_epoch} with Validation F1: {best_f1:.4f}", flush=True)
    print(f"Model saved to: {MODEL_PATH}", flush=True)
    print("=" * 65, flush=True)

    # Save metrics log
    metrics_summary = {
        "model_name": "DeepGuard Model V10 OmniShield",
        "architecture": "convnext_tiny",
        "best_epoch": best_epoch,
        "best_valid_f1": best_f1,
        "total_training_time_sec": total_training_time,
        "history": history
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"Saved metrics to {METRICS_PATH}", flush=True)


if __name__ == "__main__":
    run_training()
