import os
import sys
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best_deepfake_detector_v9.pth"

# 1. Load Model V9
print("=" * 60)
print("DEEPGUARD MODEL V9 BENCHMARK & EVALUATION")
print("=" * 60)
print(f"Device: {DEVICE}")

model = models.resnet18(weights=None)
num_features = model.fc.in_features
model.fc = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(num_features, 2)
)

if not os.path.exists(MODEL_PATH):
    print(f"Error: {MODEL_PATH} not found!")
    sys.exit(1)

checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
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

# Benchmark Test Images
test_files = ["test.jpg", "test1.jpg", "test2.jpg"]
print("\n--- Testing Individual Images ---")
for tf in test_files:
    if os.path.exists(tf):
        img = Image.open(tf).convert("RGB")
        v, fp, rp, conf = predict_image(img)
        print(f"{tf:12s} -> {v:5s} (Conf: {conf:5.1f}%, Fake: {fp*100:5.1f}%, Real: {rp*100:5.1f}%)")

# Benchmark Per-Domain Validation Breakdown
print("\n--- Per-Domain Validation Accuracy Breakdown ---")
valid_dir = "dataset_v9/valid"
if os.path.exists(valid_dir):
    categories = {
        "Subtle Inpainting": ("fake", "inpaint"),
        "InsightFace Swap": ("fake", "insight"),
        "Diffusion Text2Img": ("fake", "text2img"),
        "StyleGAN Faces": ("fake", "stylegan"),
        "Authentic Real Wiki": ("real", "wiki"),
        "Authentic Real RVF": ("real", "rvf10k")
    }

    for cat_name, (label, prefix) in categories.items():
        folder = os.path.join(valid_dir, label)
        matching_files = [os.path.join(folder, f) for f in os.listdir(folder) if f.startswith(prefix)][:200]
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
        print(f"  {cat_name:22s} ({len(matching_files)} images): {acc:5.1f}% Accuracy ({correct}/{len(matching_files)})")

print("\n" + "=" * 60)
