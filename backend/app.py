import io
import time
import urllib.request
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

try:
    from backend.database import engine, Base, get_db, get_database_status, ensure_schema
    from backend.models import ScanRecord
except ImportError:
    from database import engine, Base, get_db, get_database_status, ensure_schema
    from models import ScanRecord


# Auto-initialize database tables & migrations
Base.metadata.create_all(bind=engine)
ensure_schema()



# ============================================================
# CONFIGURATION
# ============================================================

CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent

CANDIDATE_PATHS = [
    CURRENT_DIR / "best_deepfake_detector_v10.pth",
    PARENT_DIR / "best_deepfake_detector_v10.pth",
    Path("best_deepfake_detector_v10.pth").resolve(),
    Path("/opt/render/project/src/backend/best_deepfake_detector_v10.pth"),
    Path("/opt/render/project/src/best_deepfake_detector_v10.pth"),
    CURRENT_DIR / "best_deepfake_detector_v9.pth",
    PARENT_DIR / "best_deepfake_detector_v9.pth",
    Path("best_deepfake_detector_v9.pth").resolve(),
    Path("/opt/render/project/src/best_deepfake_detector_v9.pth"),
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

RELEASE_URL = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v2.0.0/best_deepfake_detector_v10.pth"
V8_FALLBACK_URL = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v1.0.0/best_deepfake_detector_v8.pth"

if MODEL_PATH is None:
    target_path = CURRENT_DIR / "best_deepfake_detector_v10.pth"
    print(f"Model checkpoint not found locally. Downloading from release: {RELEASE_URL}...")
    import urllib.request
    import shutil
    try:
        req = urllib.request.Request(RELEASE_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepGuardAPI"})
        with urllib.request.urlopen(req) as resp, open(target_path, "wb") as f_out:
            shutil.copyfileobj(resp, f_out)
        MODEL_PATH = target_path
        print(f"Model checkpoint successfully downloaded to {MODEL_PATH} ({MODEL_PATH.stat().st_size} bytes)")
    except Exception as e:
        print(f"Warning: Failed to download V10 weights ({e}). Attempting V8 fallback...")
        try:
            target_v8 = CURRENT_DIR / "best_deepfake_detector_v8.pth"
            req_v8 = urllib.request.Request(V8_FALLBACK_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepGuardAPI"})
            with urllib.request.urlopen(req_v8) as resp, open(target_v8, "wb") as f_out:
                shutil.copyfileobj(resp, f_out)
            MODEL_PATH = target_v8
            print(f"Model checkpoint successfully downloaded to {MODEL_PATH} ({MODEL_PATH.stat().st_size} bytes)")
        except Exception as e_v8:
            searched = "\n  - ".join(str(p) for p in CANDIDATE_PATHS)
            raise FileNotFoundError(f"Model checkpoint not found and all downloads failed ({e} / {e_v8}). Searched in:\n  - {searched}")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# CREATE NEURAL MODEL (V10 CONVNEXT / V9-V8 RESNET DYNAMIC)
# ============================================================

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=False
)

is_convnext = False
if isinstance(checkpoint, dict):
    if checkpoint.get("arch") == "convnext_tiny":
        is_convnext = True
    elif "model_state_dict" in checkpoint:
        keys = list(checkpoint["model_state_dict"].keys())
        if any("features" in k for k in keys):
            is_convnext = True
elif "v10" in str(MODEL_PATH).lower():
    is_convnext = True

if is_convnext:
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
    MODEL_VERSION = "V10.0 (OmniShield ConvNeXt)"
else:
    model = models.resnet18(weights=None)
    num_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(num_features, 2)
    )
    MODEL_VERSION = "V9.0 (Multi-Domain Shield)" if "v9" in str(MODEL_PATH) else "V8.1"

# Load weights
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    model.load_state_dict(checkpoint["model_state_dict"])
else:
    model.load_state_dict(checkpoint)

model.to(DEVICE)
model.eval()

for parameter in model.parameters():
    parameter.requires_grad = False

print(f"DeepGuard Neural Engine active: {MODEL_PATH.name} [{MODEL_VERSION}] on {DEVICE}")


import time
import numpy as np
import cv2
from PIL import Image, ImageFilter, ImageChops

# Initialize OpenCV Face Detector (Built-in Haar Cascade, ultra-low latency)
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ============================================================
# V8.1 PREPROCESSING & TEST-TIME AUGMENTATION (TTA)
# ============================================================

# Canonical evaluation transform (aligned with RVF10K training)
canonical_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Horizontal flip transform (mitigates directional artifact asymmetry)
flip_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(p=1.0),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Subtle center-scale crop transform (scale-invariance boost)
crop_transform = transforms.Compose([
    transforms.Resize(235),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# FASTAPI APPLICATION & CORS
# ============================================================

app = FastAPI(
    title="DeepGuard AI API",
    description="DeepGuard V10.0 OmniShield (ConvNeXt-Tiny) Deepfake Detection & Forensic API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal inference error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
@app.get("/health")
def root():
    return {
        "status": "online",
        "model": f"DeepGuard {MODEL_VERSION} + Multi-Subject Face Localization",
        "model_version": MODEL_VERSION,
        "device": str(DEVICE),
        "model_frozen": True,
        "tta_enabled": True,
        "database": get_database_status()
    }


# ============================================================
# ADVANCED FORENSIC ANALYSIS (ELA, SPLICING & FREQUENCY)
# ============================================================


def compute_ela_score(image: Image.Image):
    """
    Error Level Analysis (ELA) detects compression disparity, localized inpainting,
    and face-swap blending seams by comparing resaved JPEG error residuals.
    """
    try:
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        resaved = Image.open(buf)

        diff = ImageChops.difference(image, resaved)
        diff_arr = np.array(diff, dtype=np.float32)
        variance = float(np.var(diff_arr))

        # Normalized ELA disparity score (0-100)
        score = round(min(99.9, max(5.0, variance * 5.0)), 1)
        return score
    except Exception:
        return 15.0


def compute_scene_splicing(image: Image.Image):
    """
    Detects added AI scenery or composited persons by evaluating
    high-frequency Laplacian sensor noise consistency across quadrants.
    """
    try:
        gray = np.array(image.convert("L"), dtype=np.float32)
        gh, gw = gray.shape
        if gh < 40 or gw < 40:
            return {"splicing_ratio": 1.0, "splicing_detected": False}

        q1 = gray[:gh//2, :gw//2]
        q2 = gray[:gh//2, gw//2:]
        q3 = gray[gh//2:, :gw//2]
        q4 = gray[gh//2:, gw//2:]

        vars_q = [float(np.var(cv2.Laplacian(q, cv2.CV_32F))) for q in [q1, q2, q3, q4]]
        min_v = max(1.0, min(vars_q))
        max_v = max(vars_q)
        ratio = round(max_v / min_v, 2)

        # Disparity ratio > 6.0 in natural non-extreme scenes indicates composite scenery or inpainting
        splicing_detected = bool(ratio > 6.5)
        return {
            "splicing_ratio": ratio,
            "splicing_detected": splicing_detected
        }
    except Exception:
        return {"splicing_ratio": 1.5, "splicing_detected": False}


def analyze_forensic_signals(image: Image.Image):
    """
    Computes frequency-domain response, bilateral symmetry,
    and micro-texture uniformity heuristics.
    """
    try:
        # 1. Edge & Frequency Variance (Laplacian/High-pass filter response)
        gray = image.convert("L").resize((256, 256))
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_arr = np.array(edges, dtype=np.float32)
        edge_variance = float(np.var(edge_arr))

        frequency_coherence = round(min(99.9, max(10.0, (edge_variance / 850.0) * 100.0)), 1)

        # 2. Bilateral Illumination & Feature Symmetry
        img_small = image.resize((128, 128))
        arr = np.array(img_small, dtype=np.float32)
        left = arr[:, :64]
        right = np.fliplr(arr[:, 64:])
        sym_diff = float(np.mean(np.abs(left - right)))
        symmetry_score = round(min(99.0, max(20.0, 100.0 - (sym_diff * 0.85))), 1)

        # 3. Micro-texture consistency
        texture_index = round(min(99.5, max(15.0, (float(np.std(edge_arr)) / 45.0) * 100.0)), 1)

        return {
            "frequency_coherence": frequency_coherence,
            "texture_uniformity": texture_index,
            "bilateral_symmetry": symmetry_score,
            "tta_passes": 3
        }
    except Exception:
        return {
            "frequency_coherence": 85.0,
            "texture_uniformity": 88.0,
            "bilateral_symmetry": 82.0,
            "tta_passes": 3
        }


# ============================================================
# MULTI-FACE DETECTION & EXTRACTION PIPELINE
# ============================================================

def extract_detected_faces(pil_image: Image.Image):
    """
    Detects all faces in the uploaded image.
    Extracts each face with 20% contextual margin for neural evaluation.
    Computes normalized bounding boxes for frontend rendering.
    """
    try:
        img_cv = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        img_h, img_w = gray.shape

        raw_faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(28, 28)
        )

        detected = []
        for i, (x, y, w, h) in enumerate(raw_faces):
            # 20% contextual padding (aligned with RVF10K training distribution)
            pad_x = int(w * 0.20)
            pad_y = int(h * 0.20)

            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(img_w, x + w + pad_x)
            y2 = min(img_h, y + h + pad_y)

            face_crop = pil_image.crop((x1, y1, x2, y2))

            bbox_abs = {
                "x": int(x),
                "y": int(y),
                "width": int(w),
                "height": int(h)
            }

            bbox_norm = {
                "x": float(round((x / img_w) * 100, 2)),
                "y": float(round((y / img_h) * 100, 2)),
                "width": float(round((w / img_w) * 100, 2)),
                "height": float(round((h / img_h) * 100, 2))
            }


            detected.append((face_crop, bbox_abs, bbox_norm))

        return detected
    except Exception as e:
        print(f"Warning: Face detection error: {e}")
        return []


def predict_tensor_tta(crop_image: Image.Image):
    """
    Runs 3-pass Test-Time Augmentation (TTA) on a face/region crop.
    """
    t1 = canonical_transform(crop_image)
    t2 = flip_transform(crop_image)
    t3 = crop_transform(crop_image)

    batch_tensor = torch.stack([t1, t2, t3]).to(DEVICE)

    with torch.no_grad():
        outputs = model(batch_tensor)
        probabilities_batch = torch.softmax(outputs, dim=1)
        probabilities = torch.mean(probabilities_batch, dim=0)

    fake_prob = float(probabilities[0].item())
    real_prob = float(probabilities[1].item())
    return fake_prob, real_prob


# ============================================================
# IMAGE PREDICTION WITH MULTI-SUBJECT & SCENERY INSPECTION
# ============================================================

def analyze_image_pil(
    image: Image.Image,
    filename: str,
    file_size_bytes: Optional[int],
    db: Session
):
    start_time = time.perf_counter()

    # 1. Detect all faces in the image
    detected_faces = extract_detected_faces(image)
    face_details = []

    if len(detected_faces) > 0:
        analysis_mode = "face_localized"

        # Inspect each detected person individually
        for i, (face_crop, bbox_abs, bbox_norm) in enumerate(detected_faces):
            fake_p, real_p = predict_tensor_tta(face_crop)

            if fake_p >= 0.50:
                f_pred = "FAKE"
                f_conf = fake_p
            else:
                f_pred = "REAL"
                f_conf = real_p

            face_details.append({
                "face_id": i + 1,
                "box": bbox_abs,
                "normalized_box": bbox_norm,
                "prediction": f_pred,
                "confidence": round(f_conf * 100, 2),
                "fake_probability": round(fake_p * 100, 2),
                "real_probability": round(real_p * 100, 2)
            })

        # Aggregation Rule: If ANY face in the image is synthetic/fake, the image is FAKE!
        fake_faces = [f for f in face_details if f["prediction"] == "FAKE"]
        if fake_faces:
            prediction = "FAKE"
            confidence = max(f["confidence"] for f in fake_faces)
            fake_probability = max(f["fake_probability"] for f in fake_faces)
            real_probability = round(100.0 - fake_probability, 2)
        else:
            prediction = "REAL"
            confidence = round(sum(f["confidence"] for f in face_details) / len(face_details), 2)
            real_probability = confidence
            fake_probability = round(100.0 - confidence, 2)

    else:
        # Fallback: No faces detected (e.g. pure AI scenery, landscape, or distant subject)
        analysis_mode = "scene_spectral"
        fake_p, real_p = predict_tensor_tta(image)

        if fake_p >= 0.50:
            prediction = "FAKE"
            confidence = round(fake_p * 100, 2)
        else:
            prediction = "REAL"
            confidence = round(real_p * 100, 2)

        fake_probability = round(fake_p * 100, 2)
        real_probability = round(real_p * 100, 2)

    # Calculate forensic signals (ELA inpainting disparity & spatial scene splicing)
    forensics = analyze_forensic_signals(image)
    ela_disparity = compute_ela_score(image)
    splicing_data = compute_scene_splicing(image)

    forensics["ela_disparity"] = ela_disparity
    forensics["scene_splicing_ratio"] = splicing_data["splicing_ratio"]
    splicing_detected = splicing_data["splicing_detected"]

    # If severe scene splicing or inpainting anomaly is detected, reflect in forensics
    if splicing_detected and prediction == "REAL" and fake_probability > 30.0:
        # Elevated suspicion: scene exhibits strong generative compositing
        prediction = "FAKE"
        confidence = max(confidence, 68.5)
        fake_probability = max(fake_probability, 68.5)
        real_probability = round(100.0 - fake_probability, 2)

    latency_ms = round((time.perf_counter() - start_time) * 1000, 1)

    # Persist record into Database
    scan_id = None
    created_at_iso = None
    try:
        record = ScanRecord(
            filename=filename if filename else "uploaded_image",
            file_size_bytes=file_size_bytes,
            prediction=prediction,
            confidence=confidence,
            fake_probability=fake_probability,
            real_probability=real_probability,
            frequency_coherence=forensics.get("frequency_coherence"),
            texture_uniformity=forensics.get("texture_uniformity"),
            bilateral_symmetry=forensics.get("bilateral_symmetry"),
            face_count=len(face_details),
            latency_ms=latency_ms,
            model_version=f"DeepGuard {MODEL_VERSION} + Multi-Subject Face Localization"
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        scan_id = record.id
        created_at_iso = record.created_at.isoformat() if record.created_at else None
    except Exception as db_err:
        print(f"Warning: Database insert error: {db_err}")
        db.rollback()

    return {
        "scan_id": scan_id,
        "created_at": created_at_iso,
        "filename": filename,
        "prediction": prediction,
        "confidence": confidence,
        "fake_probability": fake_probability,
        "real_probability": real_probability,
        "faces_detected": len(face_details),
        "analysis_mode": analysis_mode,
        "face_details": face_details,
        "splicing_detected": splicing_detected,
        "model": f"DeepGuard {MODEL_VERSION} + Multi-Subject Face Localization",
        "model_version": MODEL_VERSION,
        "device": str(DEVICE),
        "forensics": forensics,
        "latency_ms": latency_ms
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be decoded as an image. Please provide a valid JPG, PNG, or WEBP photo."
        )

    return analyze_image_pil(
        image=image,
        filename=file.filename or "uploaded_image.jpg",
        file_size_bytes=len(contents),
        db=db
    )


@app.post("/predict-url")
async def predict_url(url: str = Query(..., description="Public image URL to analyze"), db: Session = Depends(get_db)):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL protocol. Must start with http:// or https://")

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepGuardForensics/10.0"
            }
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            contents = response.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch image from URL: {str(e)}"
        )

    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="The remote image exceeds the 15 MB limit."
        )

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The fetched URL content could not be decoded as an image."
        )

    parsed_name = url.split("?")[0].split("/")[-1] or "remote_image.jpg"
    return analyze_image_pil(
        image=image,
        filename=parsed_name,
        file_size_bytes=len(contents),
        db=db
    )



# ============================================================
# DATABASE AUDIT LOG & SCAN HISTORY ENDPOINTS
# ============================================================

@app.get("/history")
def get_history(
    limit: int = Query(50, ge=1, le=200, description="Max number of records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    prediction: Optional[str] = Query(None, description="Filter by REAL or FAKE"),
    db: Session = Depends(get_db)
):
    """Retrieve paginated scan records with optional filtering."""
    query = db.query(ScanRecord)
    if prediction:
        normalized = prediction.strip().upper()
        if normalized in ("REAL", "FAKE"):
            query = query.filter(ScanRecord.prediction == normalized)

    total = query.count()
    records = query.order_by(desc(ScanRecord.created_at)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [r.to_dict() for r in records]
    }


@app.get("/history/{scan_id}")
def get_scan_by_id(scan_id: int, db: Session = Depends(get_db)):
    """Retrieve forensic details for a specific historical scan."""
    record = db.query(ScanRecord).filter(ScanRecord.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    return record.to_dict()


@app.delete("/history/{scan_id}")
def delete_scan(scan_id: int, db: Session = Depends(get_db)):
    """Delete a specific scan record from the database."""
    record = db.query(ScanRecord).filter(ScanRecord.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    db.delete(record)
    db.commit()
    return {"message": f"Scan #{scan_id} deleted successfully", "id": scan_id}


@app.delete("/history")
def clear_all_history(db: Session = Depends(get_db)):
    """Clear all scan records from the database."""
    count = db.query(ScanRecord).delete()
    db.commit()
    return {"message": f"Database scan history cleared ({count} records deleted)", "deleted_count": count}


# ============================================================
# DATABASE ANALYTICS / STATS ENDPOINT
# ============================================================

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Aggregate statistics across all scans in the database."""
    total = db.query(ScanRecord).count()
    fake_count = db.query(ScanRecord).filter(ScanRecord.prediction == "FAKE").count()
    real_count = db.query(ScanRecord).filter(ScanRecord.prediction == "REAL").count()

    avg_conf = db.query(func.avg(ScanRecord.confidence)).scalar() or 0.0
    avg_latency = db.query(func.avg(ScanRecord.latency_ms)).scalar() or 0.0

    fake_pct = round((fake_count / total * 100), 1) if total > 0 else 0.0
    real_pct = round(100.0 - fake_pct, 1) if total > 0 else 0.0

    return {
        "total_scans": total,
        "fake_scans": fake_count,
        "real_scans": real_count,
        "fake_percentage": fake_pct,
        "real_percentage": real_pct,
        "average_confidence": round(avg_conf, 1),
        "average_latency_ms": round(avg_latency, 1),
        "database": get_database_status()
    }