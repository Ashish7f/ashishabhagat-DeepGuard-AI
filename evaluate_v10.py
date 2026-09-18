import os
import sys
import torch
import torch.nn as nn
from torchvision import models, transforms, datasets
from PIL import Image
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best_deepfake_detector_v10.pth"

print("=" * 65, flush=True)
print("DEEPGUARD MODEL V10 (OMNISHIELD) COMPREHENSIVE BENCHMARK", flush=True)
print("=" * 65, flush=True)
print(f"Device: {DEVICE}", flush=True)

if not os.path.exists(MODEL_PATH):
    print(f"Error: {MODEL_PATH} not found!", flush=True)
    sys.exit(1)

# 1. Initialize ConvNeXt-Tiny Architecture
model = models.convnext_tiny(weights=None)
num_features = model.classifier[2].in_features
model.classifier = nn.Sequential(
    model.classifier[0],
    model.classifier[1],
    nn.Dropout(0.35),
    nn.Linear(num_features, 256),
    nn.GELU(),
    nn.Dropout(0.20),
    nn.Linear(256, 2)
)

checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
    saved_f1 = checkpoint.get("valid_f1", "N/A")
    saved_acc = checkpoint.get("valid_acc", "N/A")
    print(f"Loaded checkpoint saved from epoch {checkpoint.get('epoch', '?')} (Valid F1: {saved_f1}, Acc: {saved_acc})", flush=True)
else:
    model.load_state_dict(checkpoint)

model.to(DEVICE)
model.eval()

eval_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def predict_image(img: Image.Image):
    t = eval_transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        outputs = model(t)
        probs = torch.softmax(outputs, dim=1)[0]
    fake_prob = float(probs[0].item())
    real_prob = float(probs[1].item())
    verdict = "FAKE" if fake_prob >= 0.50 else "REAL"
    conf = max(fake_prob, real_prob) * 100.0
    return verdict, fake_prob, real_prob, conf

# 1. Benchmark Test Images
test_files = ["test.jpg", "test1.jpg", "test2.jpg"]
print("\n--- Showcase Sample Images ---", flush=True)
for tf in test_files:
    if os.path.exists(tf):
        img = Image.open(tf).convert("RGB")
        v, fp, rp, conf = predict_image(img)
        print(f"  {tf:12s} -> {v:5s} (Conf: {conf:5.1f}%, Fake: {fp*100:5.1f}%, Real: {rp*100:5.1f}%)", flush=True)

# 2. Benchmark Clean External Benchmark
ext_dir = "external_cropped"
if os.path.exists(ext_dir):
    print("\n--- Clean External Holdout Benchmark ---", flush=True)
    ext_ds = datasets.ImageFolder(ext_dir, transform=eval_transform)
    ext_loader = torch.utils.data.DataLoader(ext_ds, batch_size=32, shuffle=False)
    ext_preds, ext_targets = [], []
    with torch.no_grad():
        for x, y in ext_loader:
            x = x.to(DEVICE)
            out = model(x)
            ext_preds.extend(torch.argmax(out, dim=1).cpu().tolist())
            ext_targets.extend(y.tolist())
    ext_acc = accuracy_score(ext_targets, ext_preds) * 100.0
    ext_f1 = f1_score(ext_targets, ext_preds, zero_division=0)
    print(f"  Clean External Accuracy: {ext_acc:.2f}% | F1: {ext_f1:.4f} ({sum(p == t for p, t in zip(ext_preds, ext_targets))}/{len(ext_targets)})", flush=True)

# 3. Per-Domain Holdout Validation Breakdown
print("\n--- Per-Domain Holdout Validation Breakdown ---", flush=True)
valid_dir = "dataset_v10/valid"
if not os.path.exists(valid_dir):
    valid_dir = "dataset_v9/valid"

if os.path.exists(valid_dir):
    categories = {
        "Subtle Inpainting": ("fake", "inpaint"),
        "InsightFace Swap": ("fake", "insight"),
        "Diffusion Text2Img": ("fake", "text2img"),
        "StyleGAN Faces": ("fake", "stylegan"),
        "Celeb-DF Video Face": ("fake", "celebdf_fake"),
        "Authentic Real Wiki": ("real", "wiki"),
        "Authentic Real RVF": ("real", "rvf10k"),
        "Authentic Real Celeb": ("real", "celebdf_real")
    }

    results = {}
    for cat_name, (label, prefix) in categories.items():
        folder = os.path.join(valid_dir, label)
        if not os.path.exists(folder):
            continue
        matching_files = [os.path.join(folder, f) for f in os.listdir(folder) if f.startswith(prefix)][:300]
        if not matching_files:
            continue
        
        correct = 0
        expected_verdict = "FAKE" if label == "fake" else "REAL"
        for fp in matching_files:
            try:
                img = Image.open(fp).convert("RGB")
                v, _, _, _ = predict_image(img)
                if v == expected_verdict:
                    correct += 1
            except Exception:
                continue

        acc = (correct / len(matching_files)) * 100.0
        results[cat_name] = (acc, correct, len(matching_files))
        print(f"  {cat_name:24s} ({len(matching_files)} images): {acc:5.1f}% Accuracy ({correct}/{len(matching_files)})", flush=True)

print("\n" + "=" * 65, flush=True)
