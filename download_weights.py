import os
import shutil
import urllib.request
from pathlib import Path

V10_RELEASE_URL = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v2.0.0/best_deepfake_detector_v10.pth"
V8_FALLBACK_URL = "https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI/releases/download/v1.0.0/best_deepfake_detector_v8.pth"

def download_weights():
    candidates_v10 = [
        Path("backend/best_deepfake_detector_v10.pth"),
        Path("best_deepfake_detector_v10.pth"),
        Path("/opt/render/project/src/backend/best_deepfake_detector_v10.pth"),
        Path("/opt/render/project/src/best_deepfake_detector_v10.pth"),
    ]

    for c in candidates_v10:
        if c.exists() and c.stat().st_size > 100 * 1024 * 1024:
            print(f"DeepGuard Model V10 weights already present at {c} ({c.stat().st_size:,} bytes)")
            return

    target = Path("backend/best_deepfake_detector_v10.pth")
    target.parent.mkdir(parents=True, exist_ok=True)

    print(f"Downloading DeepGuard Model V10 OmniShield weights from {V10_RELEASE_URL}...")
    try:
        req = urllib.request.Request(
            V10_RELEASE_URL,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepGuardDeployer"}
        )
        with urllib.request.urlopen(req) as resp, open(target, "wb") as f_out:
            shutil.copyfileobj(resp, f_out)
        print(f"Successfully downloaded V10 weights to {target} ({target.stat().st_size:,} bytes)")
        return
    except Exception as e:
        print(f"Warning: Failed to download Model V10 weights ({e}). Attempting V8 fallback...")

    # Fallback to V8 if V10 network download encountered issues
    target_v8 = Path("backend/best_deepfake_detector_v8.pth")
    req_v8 = urllib.request.Request(
        V8_FALLBACK_URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepGuardDeployer"}
    )
    with urllib.request.urlopen(req_v8) as resp, open(target_v8, "wb") as f_out:
        shutil.copyfileobj(resp, f_out)
    print(f"Successfully downloaded fallback V8 weights to {target_v8} ({target_v8.stat().st_size:,} bytes)")

if __name__ == "__main__":
    download_weights()
