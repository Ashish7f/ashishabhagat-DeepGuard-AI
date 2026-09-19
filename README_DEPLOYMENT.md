# DeepGuard AI - High-Performance Deployment Guide

> **Why migrate from Render & Vercel?**
> - **Render Free Tier**: Capped at 512MB RAM, frequently causing PyTorch `Out-Of-Memory (Exit 137)` crashes and 1-2 minute cold boot delays.
> - **Vercel**: Serverless architecture with strict 250MB bundle limits and short timeouts, unsuitable for hosting PyTorch deep learning models.

Below are the two recommended production solutions to deploy the **DeepGuard AI Model**:

---

## Option 1: Hugging Face Spaces (Top Free ML Pick ⭐)
Hugging Face Spaces is engineered specifically for hosting machine learning and PyTorch applications.

- **Specs**: **16 GB RAM**, 2 vCPUs, 50 GB persistent disk.
- **Cost**: **$0 / 100% Free** forever.
- **Uptime**: Free spaces sleep when inactive, but wake up in seconds without OOM crashes.

### Step-by-Step Deployment:
1. **Create an Account / Log in**: Go to [huggingface.co](https://huggingface.co).
2. **Create a New Space**:
   - Click **New Space** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
   - Set **Space name** (e.g., `deepguard-ai-api`).
   - Select **License** (e.g., `mit` or `apache-2.0`).
   - Space SDK: Choose **Docker** -> **Blank**.
   - Space hardware: **CPU basic • 2 vCPU • 16 GB RAM • Free**.
   - Privacy: **Public**.
   - Click **Create Space**.
3. **Push the repository to Hugging Face**:
   In your terminal, clone the space repo or add it as a git remote:
   ```bash
   # Add Hugging Face Space as a git remote (replace with your HF username and space name)
   git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/deepguard-ai-api

   # Push your code (the Dockerfile will build automatically)
   git push hf main
   ```
4. **Get your API URL**:
   Once the build completes (usually ~3-4 minutes on first build):
   - Your API will be live at: `https://<YOUR_HF_USERNAME>-deepguard-ai-api.hf.space`
   - Test health endpoint: `https://<YOUR_HF_USERNAME>-deepguard-ai-api.hf.space/health`
   - Predict endpoint: `https://<YOUR_HF_USERNAME>-deepguard-ai-api.hf.space/predict`

---

## Option 2: Railway (Top 24/7 Production PaaS Pick 🚀)
Railway is the premier modern developer platform for running continuous APIs with zero spin-downs.

- **Specs**: Up to **8 GB RAM**, 8 vCPUs per container, fast SSD.
- **Uptime**: **24/7 Always-On** (Never sleeps, 0s latency on requests).
- **Cost**: Generous free trial ($5 credit), then usage-based (~$3-$5/mo for low-medium traffic).

### Step-by-Step Deployment:
1. Go to [railway.app](https://railway.app) and log in with GitHub.
2. Click **+ New Project** -> **Deploy from GitHub repo**.
3. Select your repository: `Ashish7f/ashishabhagat-DeepGuard-AI`.
4. Railway automatically detects `railway.toml` and `Dockerfile`.
5. Under **Settings** -> **Networking**, click **Generate Domain** (e.g. `deepguard-production.up.railway.app`).
6. Your backend will deploy and stay online 24/7!

---

## Option 3: Connect Your Frontend

Once your backend is deployed to either **Hugging Face Spaces** or **Railway**:

1. In your frontend repository or Vercel dashboard:
   - Go to your Vercel Project -> **Settings** -> **Environment Variables**.
   - Add/Update:
     ```env
     VITE_API_URL=https://your-app-name.hf.space
     # OR for Railway:
     # VITE_API_URL=https://deepguard-production.up.railway.app
     ```
   - Redeploy the frontend in Vercel.
2. Alternatively, update `vercel.json` rewrites:
   ```json
   {
     "source": "/api/:match*",
     "destination": "https://your-app-name.hf.space/:match*"
   }
   ```
