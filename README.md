# 🛡️ DeepGuard AI — Production Deepfake Detection Platform

[![Backend Status](https://img.shields.io/badge/Render-Live-success?style=flat-square&logo=render)](https://ashishabhagat-deepguard-ai.onrender.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-ResNet18_V8-EE4C2C.svg?style=flat-square&logo=pytorch)](https://pytorch.org)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB.svg?style=flat-square&logo=react)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

DeepGuard AI is a state-of-the-art deepfake detection system powered by a fine-tuned ResNet-18 architecture (Model V8) optimized for generalization across diverse synthetic artifacts. Built with a high-performance FastAPI backend and a modern React interface.

---

## 🌐 Live Deployment

- **Backend API:** [`https://ashishabhagat-deepguard-ai.onrender.com`](https://ashishabhagat-deepguard-ai.onrender.com)
- **Health Check:** [`https://ashishabhagat-deepguard-ai.onrender.com/`](https://ashishabhagat-deepguard-ai.onrender.com/)
- **Inference Endpoint:** [`https://ashishabhagat-deepguard-ai.onrender.com/predict`](https://ashishabhagat-deepguard-ai.onrender.com/predict)
- **Model Checkpoints:** Hosted via [GitHub Releases v1.0.0](https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/tag/v1.0.0)

---

## ⚡ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Client Browser / UI     │
                          │   (React 19 + Vite 8)     │
                          └─────────────┬─────────────┘
                                        │  POST /predict (multipart/form-data)
                                        ▼
                          ┌───────────────────────────┐
                          │   FastAPI Web Service     │
                          │   (Render Cloud Hosting)  │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
               ┌───────────────────┐         ┌───────────────────┐
               │ Image Transform   │         │ ResNet-18 (V8)    │
               │ (Resize/Crop/Norm)│ ──────> │ Frozen Inference  │
               └───────────────────┘         └─────────┬─────────┘
                                                       │ Softmax
                                                       ▼
                                             ┌───────────────────┐
                                             │ Prediction &      │
                                             │ Confidence Score  │
                                             └───────────────────┘
```

---

## 📡 API Reference

### Health Check

```http
GET /
```

**Response:**
```json
{
  "status": "online",
  "model": "DeepGuard V8",
  "device": "cpu",
  "model_frozen": true
}
```

---

### Image Inference

```http
POST /predict
Content-Type: multipart/form-data
```

**Form Fields:**
- `file`: The image file (`.jpg`, `.jpeg`, `.png`, max 10MB).

**Example cURL:**
```bash
curl -X POST https://ashishabhagat-deepguard-ai.onrender.com/predict \
  -F "file=@face_sample.jpg"
```

**Response:**
```json
{
  "prediction": "REAL",
  "confidence": 99.94,
  "fake_probability": 0.06,
  "real_probability": 99.94,
  "model": "DeepGuard V8",
  "device": "cpu"
}
```

---

## 🚀 Local Development

### 1. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download model weights (if not already local)
python download_weights.py

# Run FastAPI dev server
python app.py
```

API will be running on `http://127.0.0.1:10000` (or configured `$PORT`).

### 2. Frontend Setup

```bash
cd frontend

# Install npm packages
npm install

# Start local dev server
npm run dev
```

Frontend will open at `http://localhost:5173`.

---

## 📦 Deployment Guides

### Deploying Backend to Render
The backend is configured with `render.yaml` for 1-click or automated Git deployment:
- **Build Command:** `pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt && python download_weights.py`
- **Start Command:** `python app.py`

### Deploying Frontend to Vercel
1. Import repository into [Vercel](https://vercel.com/new).
2. Set Root Directory to `frontend` (or leave default root with provided `vercel.json`).
3. Set Environment Variable `VITE_API_URL` to `https://ashishabhagat-deepguard-ai.onrender.com`.
4. Click **Deploy**.
