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
# SETTINGS & HYPERPARAMETERS
# ============================================================

DATA_ROOT = "dataset_v9"
TRAIN_DIR = os.path.join(DATA_ROOT, "train")
VALID_DIR = os.path.join(DATA_ROOT, "valid")

BATCH_SIZE = 64
EPOCHS = 15
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
PATIENCE = 4

MODEL_PATH = "best_deepfake_detector_v9.pth"
METRICS_PATH = "v9_training_metrics.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("=" * 60)
print("DEEPGUARD MODEL V9 TRAINING PIPELINE")
print("=" * 60)
print("Device:", DEVICE)
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print(f"Total VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")


# ============================================================
# DATA AUGMENTATION & TRANSFORMS
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
    ], p=0.20),
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


def run_training():
    if not os.path.exists(TRAIN_DIR) or not os.path.exists(VALID_DIR):
        print(f"Error: Dataset directories not found: {TRAIN_DIR} or {VALID_DIR}")
        sys.exit(1)

    train_dataset = datasets.ImageFolder(TRAIN_DIR, transform=train_transform)
    valid_dataset = datasets.ImageFolder(VALID_DIR, transform=eval_transform)

    print(f"\nClasses: {train_dataset.classes}")
    print(f"Class mapping: {train_dataset.class_to_idx}")
    print(f"Training samples:   {len(train_dataset)}")
    print(f"Validation samples: {len(valid_dataset)}")

    # Ensure class mapping is fake=0, real=1
    assert train_dataset.class_to_idx.get("fake") == 0, "Expected 'fake' to map to 0"
    assert train_dataset.class_to_idx.get("real") == 1, "Expected 'real' to map to 1"

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=4,
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
    # ARCHITECTURE
    # ============================================================
    print("\nInitializing ResNet-18 with ImageNet-1K pretrained backbone...")
    weights = models.ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)
    num_features = model.fc.in_features

    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(num_features, 2)
    )
    model = model.to(DEVICE)

    # Loss with mild label smoothing to improve generalization
    criterion = nn.CrossEntropyLoss(label_smoothing=0.04)

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
    # TRAINING LOOP WITH MIXED PRECISION
    # ============================================================
    best_model_weights = copy.deepcopy(model.state_dict())
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
    print("\nStarting Model V9 Training...")

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

        print(f"Epoch [{epoch:02d}/{EPOCHS:02d}] ({epoch_time:.1f}s, lr: {current_lr:.6f}):")
        print(f"  Train Loss: {epoch_train_loss:.4f} | Train Acc: {epoch_train_acc * 100:.2f}%")
        print(f"  Valid Loss: {epoch_val_loss:.4f} | Valid Acc: {epoch_val_acc * 100:.2f}% | F1: {epoch_val_f1:.4f} | Prec: {epoch_val_prec:.4f} | Rec: {epoch_val_rec:.4f}")

        # Checkpoint if F1 improved
        if epoch_val_f1 > best_f1:
            best_f1 = epoch_val_f1
            best_epoch = epoch
            patience_counter = 0
            best_model_weights = copy.deepcopy(model.state_dict())
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  --> Saved new best checkpoint to {MODEL_PATH} (F1: {best_f1:.4f})")
        else:
            patience_counter += 1
            print(f"  Patience: {patience_counter}/{PATIENCE}")
            if patience_counter >= PATIENCE:
                print(f"\nEarly stopping triggered after {epoch} epochs.")
                break

    total_training_time = time.time() - start_training_time
    print("\n" + "=" * 60)
    print("TRAINING FINISHED")
    print(f"Total time: {total_training_time / 60:.2f} minutes")
    print(f"Best Epoch: {best_epoch} with Validation F1: {best_f1:.4f}")
    print(f"Model saved to: {MODEL_PATH}")
    print("=" * 60)

    # Save metrics log
    metrics_summary = {
        "best_epoch": best_epoch,
        "best_valid_f1": best_f1,
        "total_training_time_sec": total_training_time,
        "history": history
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    run_training()
