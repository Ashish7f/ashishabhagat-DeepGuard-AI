import io
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# CONFIGURATION
# ============================================================

CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent

CANDIDATE_PATHS = [
    CURRENT_DIR / "best_deepfake_detector_v8.pth",
    PARENT_DIR / "best_deepfake_detector_v8.pth",
    Path("best_deepfake_detector_v8.pth").resolve(),
    Path("/opt/render/project/src/best_deepfake_detector_v8.pth"),
]

MODEL_PATH = None
for candidate in CANDIDATE_PATHS:
    if candidate.exists():
        MODEL_PATH = candidate
        break

RELEASE_URL = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v1.0.0/best_deepfake_detector_v8.pth"

if MODEL_PATH is None:
    target_path = CURRENT_DIR / "best_deepfake_detector_v8.pth"
    print(f"Model checkpoint not found locally. Downloading from release: {RELEASE_URL}...")
    import urllib.request
    import shutil
    try:
        req = urllib.request.Request(RELEASE_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req) as resp, open(target_path, "wb") as f_out:
            shutil.copyfileobj(resp, f_out)
        MODEL_PATH = target_path
        print(f"Model checkpoint successfully downloaded to {MODEL_PATH} ({MODEL_PATH.stat().st_size} bytes)")
    except Exception as e:
        searched = "\n  - ".join(str(p) for p in CANDIDATE_PATHS)
        raise FileNotFoundError(f"Model checkpoint not found and download failed ({e}). Searched in:\n  - {searched}")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# CREATE V8 MODEL
# ============================================================

model = models.resnet18(weights=None)

num_features = model.fc.in_features

model.fc = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(num_features, 2)
)

# Load frozen V8 checkpoint
checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=False
)

if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
else:
    model.load_state_dict(checkpoint)

model.to(DEVICE)
model.eval()

for parameter in model.parameters():
    parameter.requires_grad = False


# ============================================================
# V8 PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Resize(224),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# Confirmed V8 mapping:
# class 0 = FAKE
# class 1 = REAL


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="DeepGuard AI API",
    description="V8 Deepfake Detection API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "model": "DeepGuard V8",
        "device": str(DEVICE),
        "model_frozen": True
    }


# ============================================================
# IMAGE PREDICTION
# ============================================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Validate file type
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/jpg"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, JPEG, or PNG image."
        )

    try:
        contents = await file.read()

        image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image."
        )

    # Preprocess exactly like V8 evaluation
    tensor = transform(image)

    tensor = tensor.unsqueeze(0).to(DEVICE)

    # Inference only
    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)

    fake_probability = probabilities[0, 0].item()
    real_probability = probabilities[0, 1].item()

    # Frozen threshold
    if fake_probability >= 0.5:
        prediction = "FAKE"
        confidence = fake_probability
    else:
        prediction = "REAL"
        confidence = real_probability

    return {
        "prediction": prediction,
        "confidence": round(confidence * 100, 2),
        "fake_probability": round(fake_probability * 100, 2),
        "real_probability": round(real_probability * 100, 2),
        "model": "DeepGuard V8",
        "device": str(DEVICE)
    }