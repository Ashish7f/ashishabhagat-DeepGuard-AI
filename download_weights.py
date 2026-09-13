import os
import shutil
import urllib.request
from pathlib import Path

def download_weights():
    candidates = [
        Path("backend/best_deepfake_detector_v8.pth"),
        Path("best_deepfake_detector_v8.pth"),
    ]
    for c in candidates:
        if c.exists() and c.stat().st_size > 40 * 1024 * 1024:
            print(f"Weights already present at {c} ({c.stat().st_size} bytes)")
            return

    target = Path("backend/best_deepfake_detector_v8.pth")
    target.parent.mkdir(parents=True, exist_ok=True)
    
    url = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v1.0.0/best_deepfake_detector_v8.pth"
    print(f"Downloading model weights from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req) as resp, open(target, "wb") as f_out:
        shutil.copyfileobj(resp, f_out)
    print(f"Successfully downloaded weights to {target} ({target.stat().st_size} bytes)")

if __name__ == "__main__":
    download_weights()
