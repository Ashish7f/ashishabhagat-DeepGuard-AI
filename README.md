# 🛡️ DeepGuard AI — Production Deepfake Detection & Neural Forensic Platform

[![Backend Status](https://img.shields.io/badge/Render-Live-success?style=flat-square&logo=render)](https://ashishabhagat-deepguard-ai.onrender.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-ResNet18_V8.1_TTA-EE4C2C.svg?style=flat-square&logo=pytorch)](https://pytorch.org)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB.svg?style=flat-square&logo=react)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

DeepGuard AI is an enterprise-grade deepfake detection and neural forensic platform powered by a fine-tuned ResNet-18 architecture (**Model V8.1 Enhanced**) augmented with **3-Pass Test-Time Augmentation (TTA)** and multi-signal forensic analysis (high-frequency edge residuals, texture uniformity, and bilateral facial symmetry). Built with a high-performance FastAPI backend and a cyber-forensics React interface.

---

## 🌐 Live & Local Access

- **Local Interactive Interface:** [http://127.0.0.1:5173](http://127.0.0.1:5173) (Run `npm run dev` in `frontend/`)
- **Public Web Application:** [https://deep-fake-detector-ai.vercel.app](https://deep-fake-detector-ai.vercel.app)
- **Alternative Mirror:** [https://deepfake-detector-v8.vercel.app](https://deepfake-detector-v8.vercel.app)
- **Backend API (Render Cloud):** [`https://ashishabhagat-deepguard-ai.onrender.com`](https://ashishabhagat-deepguard-ai.onrender.com)
- **Interactive API Documentation:** [`https://ashishabhagat-deepguard-ai.onrender.com/docs`](https://ashishabhagat-deepguard-ai.onrender.com/docs)
- **Health Check:** [`https://ashishabhagat-deepguard-ai.onrender.com/`](https://ashishabhagat-deepguard-ai.onrender.com/)
- **Inference Endpoint:** [`https://ashishabhagat-deepguard-ai.onrender.com/predict`](https://ashishabhagat-deepguard-ai.onrender.com/predict)
- **Model Checkpoints:** Hosted via [GitHub Releases v1.0.0](https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/tag/v1.0.0)

---

## ✨ Key Platform Features

- **3-Pass Test-Time Augmentation (TTA):** Evaluates canonical, horizontally mirrored, and scaled tensor projections to neutralize directional generative artifacts and scale variance.
- **Multi-Signal Forensic Engine:** Analyzes high-frequency Laplacian edge residuals, micro-smoothing consistency, and bilateral lighting symmetry in parallel with deep learning inference.
- **1-Click Forensic Showcase:** Instant testing with built-in realistic sample faces (*Authentic Portrait*, *Deepfake Synthesis*, *Natural Photo*, *AI-Generated Face*) without needing to search for files.
- **Holographic Scanner:** Dynamic laser beam sweep, facial targeting reticle, and real-time inference ticker.
- **Radial SVG Confidence Dial:** Visual certainty gauge with dual class distribution meters (Fake % vs. Real %).
- **Dual Inspection Mode:** Instant toggle between original photo view and forensic edge visualizer.
- **Live Engine Telemetry:** Real-time health monitoring with millisecond latency ping and instant API switcher (Cloud Render vs. Localhost).

---

## ⚡ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Client Browser / UI     │
                          │   (React 19 + Vite 8)     │
                          │   http://127.0.0.1:5173   │
                          └─────────────┬─────────────┘
                                        │  POST /predict (multipart/form-data)
                                        ▼
                          ┌───────────────────────────┐
                          │   FastAPI Web Service     │
                          │   (Render Cloud / Local)  │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
               ┌───────────────────┐         ┌───────────────────┐
               │ 3-Pass TTA Batch  │         │ Forensic Analysis │
               │ • Canonical 224   │         │ • Edge Variance   │
               │ • Horizontal Flip │         │ • Micro-Texture   │
               │ • Scale Crop 235  │         │ • Color Symmetry  │
               └─────────┬─────────┘         └─────────┬─────────┘
                         │                             │
                         ▼                             │
               ┌───────────────────┐                   │
               │ ResNet-18 (V8.1)  │                   │
               │ Frozen Inference  │                   │
               └─────────┬─────────┘                   │
                         │ Softmax Voting              │
                         ▼                             ▼
               ┌─────────────────────────────────────────┐
               │  Aggregated Prediction, Confidence &   │
               │  Multi-Signal Forensic Report           │
               └─────────────────────────────────────────┘
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
  "model": "DeepGuard V8.1 Enhanced",
  "device": "cpu",
  "model_frozen": true,
  "tta_enabled": true
}
```

---

### Image Inference

```http
POST /predict
Content-Type: multipart/form-data
```

**Form Fields:**
- `file`: The image file (`.jpg`, `.jpeg`, `.png`, `.webp`, max 15MB).

**Example cURL:**
```bash
curl -X POST https://ashishabhagat-deepguard-ai.onrender.com/predict \
  -F "file=@face_sample.jpg"
```

**Response:**
```json
{
  "prediction": "REAL",
  "confidence": 100.0,
  "fake_probability": 0.0,
  "real_probability": 100.0,
  "model": "DeepGuard V8.1 Enhanced",
  "device": "cuda",
  "forensics": {
    "frequency_coherence": 60.6,
    "texture_uniformity": 50.4,
    "bilateral_symmetry": 49.1,
    "tta_passes": 3
  },
  "latency_ms": 51.6
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

The API will be running on `http://127.0.0.1:10000` (or configured `$PORT`).

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser. Click the **"💻 Localhost (10000)"** button to connect to your local backend, or use the **"☁️ Cloud (Render Live)"** button to test against the live cloud instance.

---

## 📊 Empirical Benchmarks

| Evaluation Dataset | Metric | Score | Detail |
| :--- | :--- | :--- | :--- |
| **RVF10K Holdout Test** | Accuracy | **97.60%** | Evaluated on 1,500 balanced test samples (733/750 fake, 731/750 real) |
| **Clean External Benchmark** | Accuracy | **100.00%** | Zero classification errors across holdout out-of-domain evaluation set |
| **Warm Inference Latency** | Speed | **~51.6 ms** | Real-time multi-pass evaluation suitable for media moderation & KYC |

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

---

## ⚖️ Ethical Research Disclaimer

DeepGuard AI is developed as a research and educational platform for investigating synthetic media artifacts. Model predictions represent probabilistic neural outputs and should be used to augment human forensic review, not as sole judicial proof of authenticity or manipulation.
