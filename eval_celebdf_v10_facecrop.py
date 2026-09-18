import csv
import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from collections import defaultdict
import statistics

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 65, flush=True)
    print("CELEB-DF V2 FACE-LOCALIZED BENCHMARK (MODEL V10 OMNISHIELD)", flush=True)
    print("=" * 65, flush=True)
    print(f"Device: {device}", flush=True)

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

    checkpoint = torch.load("best_deepfake_detector_v10.pth", map_location=device, weights_only=False)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    manifest_path = "celebdf_v2_eval/frame_manifest.csv"
    with open(manifest_path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    def get_face_crop(img_path):
        bgr = cv2.imread(img_path)
        if bgr is None:
            return Image.open(img_path).convert("RGB")
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
            mx, my = int(w * 0.20), int(h * 0.20)
            x1 = max(0, x - mx)
            y1 = max(0, y - my)
            x2 = min(bgr.shape[1], x + w + mx)
            y2 = min(bgr.shape[0], y + h + my)
            crop = bgr[y1:y2, x1:x2]
            if crop.size > 0:
                rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                return Image.fromarray(rgb)
        # Fallback to center region
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    class CelebTestDataset(Dataset):
        def __init__(self, rows):
            self.rows = rows
        def __len__(self):
            return len(self.rows)
        def __getitem__(self, idx):
            row = self.rows[idx]
            img = get_face_crop(row["frame_path"])
            label_val = 0 if row["label"].strip().lower() == "fake" else 1
            return transform(img), row["video_id"], row["video_path"], label_val

    loader = DataLoader(CelebTestDataset(rows), batch_size=64, shuffle=False, num_workers=0)

    video_predictions = defaultdict(list)
    video_sources = {}
    video_actuals = {}

    with torch.no_grad():
        for imgs, vids, paths, labels in loader:
            imgs = imgs.to(device)
            outputs = model(imgs)
            probs = torch.softmax(outputs, dim=1)  # 0=fake, 1=real
            fake_probs = probs[:, 0].cpu().tolist()
            
            for vid, vpath, label, fp in zip(vids, paths, labels, fake_probs):
                video_predictions[vid].append(fp)
                video_actuals[vid] = label
                if "\\Celeb-real\\" in vpath or "/Celeb-real/" in vpath:
                    video_sources[vid] = "Celeb-real"
                elif "\\YouTube-real\\" in vpath or "/YouTube-real/" in vpath:
                    video_sources[vid] = "YouTube-real"
                elif "\\Celeb-synthesis\\" in vpath or "/Celeb-synthesis/" in vpath:
                    video_sources[vid] = "Celeb-synthesis"
                else:
                    video_sources[vid] = "Unknown"

    print("\n" + "="*65, flush=True)
    print("CELEB-DF V2 FACE-LOCALIZED EVALUATION SUMMARY", flush=True)
    print("="*65, flush=True)

    groups = defaultdict(list)
    for vid, f_probs in video_predictions.items():
        mean_fp = statistics.mean(f_probs)
        pred_label = 0 if mean_fp >= 0.50 else 1
        actual = video_actuals[vid]
        source = video_sources[vid]
        groups[source].append({
            "video_id": vid,
            "actual": actual,
            "pred": pred_label,
            "mean_fake_prob": mean_fp
        })

    for source in ["Celeb-real", "YouTube-real", "Celeb-synthesis"]:
        items = groups[source]
        if not items:
            continue
        correct = sum(1 for x in items if x["actual"] == x["pred"])
        acc = correct / len(items) * 100
        mean_prob = statistics.mean(x["mean_fake_prob"] for x in items) * 100
        print(f"\n{source}:", flush=True)
        print(f"  Videos: {len(items)}", flush=True)
        print(f"  Accuracy: {acc:.2f}% ({correct}/{len(items)})", flush=True)
        print(f"  Mean Fake Probability: {mean_prob:.2f}%", flush=True)

    total_videos = sum(len(g) for g in groups.values())
    total_correct = sum(sum(1 for x in g if x["actual"] == x["pred"]) for g in groups.values())
    print(f"\nOVERALL ACCURACY: {total_correct / total_videos * 100:.2f}% ({total_correct}/{total_videos})", flush=True)

if __name__ == "__main__":
    main()
