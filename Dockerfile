# ============================================================
# DeepGuard AI - Universal Production Dockerfile
# Optimized for Hugging Face Spaces (16GB RAM) & Railway / Cloud
# ============================================================

FROM python:3.11-slim

# Prevent Python from writing bytecode and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# Install system dependencies required by OpenCV and network fetching
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Create non-root user (required by Hugging Face Spaces UID 1000 security policy)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR /home/user/app

# Step 1: Pre-install CPU-only PyTorch wheels (drastically reduces image size & build time)
RUN pip install --no-cache-dir --user torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Step 2: Install application dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Step 3: Copy application source code
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user app.py .
COPY --chown=user:user download_weights.py .

# Step 4: Ensure model weights are cached inside image for zero-latency boots
RUN python download_weights.py

# Expose default port (Hugging Face Spaces uses 7860; Railway uses dynamic $PORT)
EXPOSE 7860

# Start server
CMD ["python", "app.py"]
