import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = "Ashish7f/ashishabhagat-DeepGuard-AI"
TAG_NAME = "v2.0.0"
RELEASE_NAME = "DeepGuard AI v2.0.0 — Model V10 OmniShield (ConvNeXt-Tiny)"
RELEASE_BODY = """## 🛡️ DeepGuard AI v2.0.0 — Model V10 OmniShield Checkpoint

- **Architecture:** ConvNeXt-Tiny with forensic classification head
- **Validation Accuracy:** 96.64%
- **Validation F1 Score:** 0.9652
- **Clean External Holdout Accuracy:** 95.92% (47/49)
- **Multi-Domain Training Defense:**
  - Subtle Inpainting: 99.3%
  - Diffusion Text2Img: 99.0%
  - StyleGAN Faces: 99.0%
  - Celeb-DF Video Face Swaps: 99.3%
  - InsightFace Swaps: 91.3%
  - Authentic Human Portraits: 92.0%+
- **Forensic Pipeline:** 3-Pass Test-Time Augmentation (TTA), multi-subject Haar localization, Laplacian high-frequency edge analysis, ELA inpainting disparity, and SQLite audit trail.
"""

WEIGHTS_FILE = Path("best_deepfake_detector_v10.pth")

def main():
    if not WEIGHTS_FILE.exists():
        print(f"Error: {WEIGHTS_FILE} not found!")
        sys.exit(1)

    file_size = WEIGHTS_FILE.stat().st_size
    print(f"Weight file found: {WEIGHTS_FILE} ({file_size:,} bytes / {file_size / (1024*1024):.2f} MB)")

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "DeepGuard-Uploader"
    }

    # 1. Check if release v2.0.0 already exists
    print(f"Checking existing releases on {REPO}...")
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/releases", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            releases = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Failed to list releases: {e}")
        sys.exit(1)

    existing_release = None
    for r in releases:
        if r.get("tag_name") == TAG_NAME:
            existing_release = r
            break

    if existing_release:
        release_id = existing_release["id"]
        upload_url = existing_release["upload_url"].split("{")[0]
        print(f"Found existing release '{TAG_NAME}' (ID: {release_id})")
    else:
        # Create Release
        print(f"Creating new GitHub Release '{TAG_NAME}'...")
        payload = json.dumps({
            "tag_name": TAG_NAME,
            "target_commitish": "main",
            "name": RELEASE_NAME,
            "body": RELEASE_BODY,
            "draft": False,
            "prerelease": False
        }).encode("utf-8")

        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/releases",
            data=payload,
            headers={**headers, "Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                created = json.loads(resp.read().decode())
                release_id = created["id"]
                upload_url = created["upload_url"].split("{")[0]
                print(f"Release '{TAG_NAME}' created successfully! (ID: {release_id})")
        except urllib.error.HTTPError as he:
            print(f"Error creating release: {he.code} {he.read().decode()}")
            sys.exit(1)

    # 2. Check if asset already uploaded
    assets_req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/releases/{release_id}/assets", headers=headers)
    with urllib.request.urlopen(assets_req) as resp:
        assets = json.loads(resp.read().decode())

    asset_name = WEIGHTS_FILE.name
    for a in assets:
        if a["name"] == asset_name:
            print(f"Asset '{asset_name}' already exists in release (Size: {a['size']:,} bytes). Deleting old asset...")
            del_req = urllib.request.Request(a["url"], headers=headers, method="DELETE")
            with urllib.request.urlopen(del_req) as del_resp:
                print("Old asset deleted.")

    # 3. Upload asset
    upload_url_with_name = f"{upload_url}?name={asset_name}"
    print(f"Uploading {asset_name} ({file_size / (1024*1024):.2f} MB) to {upload_url_with_name}...")

    with open(WEIGHTS_FILE, "rb") as f:
        data = f.read()

    upload_headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Content-Type": "application/octet-stream",
        "Content-Length": str(file_size),
        "User-Agent": "DeepGuard-Uploader"
    }

    upload_req = urllib.request.Request(upload_url_with_name, data=data, headers=upload_headers)
    try:
        with urllib.request.urlopen(upload_req) as resp:
            uploaded_asset = json.loads(resp.read().decode())
            download_url = uploaded_asset.get("browser_download_url")
            print(f"\n[SUCCESS] Checkpoint uploaded successfully!")
            print(f"Direct download URL: {download_url}")
            print(f"Asset size: {uploaded_asset.get('size'):,} bytes")
    except urllib.error.HTTPError as he:
        print(f"Upload failed: {he.code} {he.read().decode()}")
        sys.exit(1)

if __name__ == "__main__":
    main()
