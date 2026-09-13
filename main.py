import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

for path_dir in [str(ROOT_DIR), str(BACKEND_DIR)]:
    if path_dir not in sys.path:
        sys.path.insert(0, path_dir)

try:
    from backend.app import app
except ModuleNotFoundError:
    from app import app

if __name__ == "__main__":
    import uvicorn
    raw_port = os.environ.get("PORT", "10000")
    try:
        port = int(raw_port)
    except (ValueError, TypeError):
        port = 10000
    uvicorn.run(app, host="0.0.0.0", port=port)
