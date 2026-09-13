import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

for path_dir in [str(ROOT_DIR), str(BACKEND_DIR)]:
    if path_dir not in sys.path:
        sys.path.insert(0, path_dir)

try:
    from app import app
except ModuleNotFoundError:
    from backend.app import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
