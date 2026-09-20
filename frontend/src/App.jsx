import { useState, useEffect, useRef } from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import DetectorWorkspace from "./components/DetectorWorkspace";
import ForensicViewer from "./components/ForensicViewer";
import VerdictCard from "./components/VerdictCard";
import AuditLog from "./components/AuditLog";
import Benchmarks from "./components/Benchmarks";
import FaqSection from "./components/FaqSection";
import Footer from "./components/Footer";

const SAMPLES = [
  {
    id: "user-fake-1",
    name: "fake1.jpg",
    label: "Synthetic Portrait #1",
    type: "AI Deepfake",
    path: "/samples/fake1.jpg",
    expected: "FAKE",
    tag: "User Dataset"
  },
  {
    id: "user-real-1",
    name: "real1.jpg",
    label: "Authentic Human #1",
    type: "Real Photo",
    path: "/samples/real1.jpg",
    expected: "REAL",
    tag: "User Dataset"
  },
  {
    id: "user-fake-2",
    name: "fake2.jpg",
    label: "Synthetic Portrait #2",
    type: "AI Deepfake",
    path: "/samples/fake2.jpg",
    expected: "FAKE",
    tag: "User Dataset"
  },
  {
    id: "user-real-2",
    name: "real2.jpg",
    label: "Authentic Human #2",
    type: "Real Photo",
    path: "/samples/real2.jpg",
    expected: "REAL",
    tag: "User Dataset"
  },
  {
    id: "real-1",
    name: "real-portrait.jpg",
    label: "Studio Portrait",
    type: "Authentic Capture",
    path: "/samples/real-portrait.jpg",
    expected: "REAL",
    tag: "Studio Lighting"
  },
  {
    id: "fake-1",
    name: "deepfake-synth.jpg",
    label: "Face-Swap Deepfake",
    type: "Identity Swap",
    path: "/samples/deepfake-synth.jpg",
    expected: "FAKE",
    tag: "Boundary Blending"
  },
  {
    id: "fake-2",
    name: "ai-generated.jpg",
    label: "Diffusion Synthesis",
    type: "Diffusion / GAN",
    path: "/samples/ai-generated.jpg",
    expected: "FAKE",
    tag: "Generative Face"
  },
  {
    id: "fake-3",
    name: "celebdf-swap.jpg",
    label: "Celeb-DF Video Face",
    type: "Video Swap",
    path: "/samples/celebdf-swap.jpg",
    expected: "FAKE",
    tag: "Temporal Seam"
  },
  {
    id: "real-3",
    name: "real-candid.jpg",
    label: "Candid Selfie",
    type: "Authentic Capture",
    path: "/samples/real-candid.jpg",
    expected: "REAL",
    tag: "Natural Sensor"
  },
  {
    id: "real-4",
    name: "real-journalism.jpg",
    label: "Photojournalism",
    type: "Authentic Capture",
    path: "/samples/real-journalism.jpg",
    expected: "REAL",
    tag: "Press Lighting"
  }
];

export default function App() {
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("normal"); // "normal" | "forensic" | "thermal"
  const [copySuccess, setCopySuccess] = useState(false);

  // Backend connection telemetry
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
    }
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:10000";
      }
      return "/api";
    }
    return "/api";
  });

  const [backendStatus, setBackendStatus] = useState({
    state: "checking", // "online" | "offline" | "checking"
    latency: null,
    model: "ConvNeXt-Tiny V10.0 OmniShield",
    device: "cpu"
  });

  // Persistent Database state & scan history
  const [dbInfo, setDbInfo] = useState({
    status: "connected",
    engine: "SQLITE",
    is_sqlite: true,
    target: "Local File (deepguard.db)"
  });

  const [dbStats, setDbStats] = useState({
    total_scans: 0,
    fake_scans: 0,
    real_scans: 0,
    fake_percentage: 0,
    real_percentage: 0,
    average_confidence: 0,
    average_latency_ms: 0
  });

  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("ALL"); // ALL | FAKE | REAL
  const [historyLoading, setHistoryLoading] = useState(false);

  // Input states
  const [inputTab, setInputTab] = useState("file"); // "file" | "camera" | "url"
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [isCameraStreaming, setIsCameraStreaming] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cloudFileNoticeOpen, setCloudFileNoticeOpen] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [warmupProgress, setWarmupProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Fetch Database stats
  const fetchDbStats = async (url = apiBaseUrl) => {
    try {
      const res = await fetch(`${url}/stats`);
      if (res.ok) {
        const statsData = await res.json();
        setDbStats(statsData);
        if (statsData.database) {
          setDbInfo(statsData.database);
        }
      }
    } catch {
      // offline fallback
    }
  };

  // Fetch Database scan history
  const fetchHistory = async (filter = historyFilter, url = apiBaseUrl) => {
    setHistoryLoading(true);
    try {
      const query = filter !== "ALL" ? `?prediction=${filter}&limit=50` : "?limit=50";
      const res = await fetch(`${url}/history${query}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.records || []);
      }
    } catch {
      // offline fallback
    } finally {
      setHistoryLoading(false);
    }
  };

  // Delete single scan record
  const handleDeleteScan = async (scanId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/history/${scanId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== scanId));
        fetchDbStats(apiBaseUrl);
      }
    } catch {
      alert("Error deleting record from database.");
    }
  };

  // Clear all database history
  const handleClearHistory = async () => {
    if (!window.confirm("Purge all forensic scan records from the database?")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/history`, {
        method: "DELETE"
      });
      if (res.ok) {
        setHistory([]);
        fetchDbStats(apiBaseUrl);
      }
    } catch {
      alert("Error clearing database.");
    }
  };

  // Check backend health telemetry
  const checkBackendHealth = async (urlToTest = apiBaseUrl) => {
    const startTime = performance.now();
    const candidatePings = [urlToTest];
    if (urlToTest === "/api" || urlToTest.includes("onrender.com")) {
      if (!candidatePings.includes("https://ashishabhagat-deepguard-ai.onrender.com")) {
        candidatePings.push("https://ashishabhagat-deepguard-ai.onrender.com");
      }
    }

    for (const pingUrl of candidatePings) {
      try {
        const response = await fetch(`${pingUrl}/`, {
          method: "GET",
          signal: AbortSignal.timeout(8000)
        });
        const data = await response.json();
        const latency = Math.round(performance.now() - startTime);

        if (response.ok && data.status === "online") {
          setBackendStatus({
            state: "online",
            latency,
            model: data.model || "ConvNeXt-Tiny V10.0 OmniShield",
            device: data.device || "cpu"
          });
          if (data.database) {
            setDbInfo(data.database);
          }
          fetchDbStats(urlToTest);
          fetchHistory(historyFilter, urlToTest);
          return;
        }
      } catch {
        // try next candidate
      }
    }

    setBackendStatus({
      state: "offline",
      latency: null,
      model: "Engine Asleep",
      device: "N/A"
    });
  };

  // Active Cloud Container Wake-Up Handler
  const wakeUpCloudEngine = async (autoRetry = false) => {
    setWarmingUp(true);
    setWarmupProgress(15);
    let currentP = 15;
    const progressTimer = setInterval(() => {
      currentP = Math.min(92, currentP + 4);
      setWarmupProgress(currentP);
    }, 1000);

    const checkDirect = async () => {
      try {
        const res = await fetch("https://ashishabhagat-deepguard-ai.onrender.com/", {
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "online") {
            clearInterval(progressTimer);
            setWarmupProgress(100);
            setBackendStatus({
              state: "online",
              latency: 220,
              model: data.model || "ConvNeXt-Tiny V10.0 OmniShield",
              device: data.device || "cpu"
            });
            setTimeout(() => {
              setWarmingUp(false);
              setWarmupProgress(0);
              setError("");
              if (autoRetry && file) {
                analyzeImage();
              }
            }, 800);
            return true;
          }
        }
      } catch {
        // spinning up
      }
      return false;
    };

    for (let i = 0; i < 16; i++) {
      const isOnline = await checkDirect();
      if (isOnline) return;
      await new Promise((r) => setTimeout(r, 2500));
    }

    clearInterval(progressTimer);
    setWarmingUp(false);
  };

  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      if (!isMounted) return;
      await checkBackendHealth(apiBaseUrl);
    };

    runCheck();
    const interval = setInterval(() => {
      runCheck();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  // Client-side image payload optimizer
  async function optimizeImageForInference(inputFile) {
    if (!inputFile || typeof window === "undefined") return inputFile;
    if (inputFile.size && inputFile.size < 350 * 1024) return inputFile;

    return new Promise((resolve) => {
      try {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(inputFile);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const maxDim = 1024;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size > 0 && blob.size < (inputFile.size || Infinity)) {
                const optimizedFile = new File([blob], inputFile.name || "analyzed_photo.jpg", {
                  type: "image/jpeg"
                });
                resolve(optimizedFile);
              } else {
                resolve(inputFile);
              }
            },
            "image/jpeg",
            0.88
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(inputFile);
        };
        img.src = objectUrl;
      } catch {
        resolve(inputFile);
      }
    });
  }

  // Handle file selection
  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    const isImageMime = selectedFile.type && selectedFile.type.startsWith("image/");
    const isImageExt = /\.(jpe?g|png|webp|jfif|avif|bmp|tiff|heic)$/i.test(selectedFile.name || "");
    if (!isImageMime && !isImageExt) {
      setError("Please select a valid image file (JPG, PNG, WEBP, or AVIF).");
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("Image size exceeds 25 MB limit. Please select a smaller photo.");
      return;
    }

    if (selectedFile.size === 0) {
      setError(
        "Windows Cloud Error (0x8007016A): This photo is stored only in the cloud (OneDrive) and has 0 bytes locally. Please copy it to your Downloads folder first."
      );
      setCloudFileNoticeOpen(true);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        if (!dataUrl || dataUrl.length < 50) {
          setError("Could not read image data from your storage. Please copy this photo to your local Downloads folder.");
          setCloudFileNoticeOpen(true);
          return;
        }

        const testImg = new window.Image();
        testImg.onload = () => {
          setFile(selectedFile);
          setImage(dataUrl);
          setResult(null);
          setError("");
          setCloudFileNoticeOpen(false);
          setViewMode("normal");

          setTimeout(() => {
            analyzeImage(selectedFile);
          }, 50);
        };
        testImg.onerror = () => {
          setError(`Could not decode "${selectedFile.name}". Please verify the photo format.`);
        };
        testImg.src = dataUrl;
      };

      reader.onerror = () => {
        setError(
          `Windows Cloud Error (0x8007016A): Windows cannot read "${selectedFile.name}" directly from cloud storage. Please copy it to your local Downloads folder first.`
        );
        setCloudFileNoticeOpen(true);
      };

      reader.readAsDataURL(selectedFile);
    } catch {
      setError("Could not load the selected image.");
    }
  };

  // Live Camera Handlers
  const startWebcam = async () => {
    setCameraError("");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraStreaming(true);
    } catch {
      setCameraError(
        "Camera access was denied or not available. Please allow camera permissions in your browser bar."
      );
      setIsCameraStreaming(false);
    }
  };

  const stopWebcam = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraStreaming(false);
  };

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const snapWebcamPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const snapFile = new File([blob], `live_camera_${Date.now()}.jpg`, {
            type: "image/jpeg"
          });
          stopWebcam();
          setInputTab("file");
          processFile(snapFile);
        }
      },
      "image/jpeg",
      0.95
    );
  };

  // Clipboard Paste Handler
  const handleClipboardPasteClick = async () => {
    setError("");
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const pastedFile = new File([blob], `clipboard_${Date.now()}.${imageType.split("/")[1] || "png"}`, {
              type: imageType
            });
            processFile(pastedFile);
            return;
          }
        }
        setError("No image currently found in your clipboard. Copy any photo and click Paste again!");
      } else {
        setError("Clipboard reading is not supported directly in this browser. Press Ctrl + V on your keyboard.");
      }
    } catch {
      setError("Clipboard access was not granted. Press Ctrl + V to paste directly.");
    }
  };

  // Global Ctrl + V Paste Listener
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            processFile(pastedFile);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Multi-proxy Web Image URL Loader
  const handleUrlSubmit = async (e) => {
    e?.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      setError("Please provide a valid web image URL starting with http:// or https://");
      return;
    }

    setUrlLoading(true);
    setError("");

    const proxyCandidates = [
      cleanUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`
    ];

    let downloadedFile = null;

    for (const fetchCandidate of proxyCandidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(fetchCandidate, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 500 && (blob.type.startsWith("image/") || blob.type === "application/octet-stream")) {
            let filename = cleanUrl.split("?")[0].split("/").pop() || "web_image.jpg";
            if (!filename.includes(".")) filename += ".jpg";
            downloadedFile = new File([blob], filename, {
              type: blob.type.startsWith("image/") ? blob.type : "image/jpeg"
            });
            break;
          }
        }
      } catch {
        // try next proxy candidate
      }
    }

    if (downloadedFile) {
      processFile(downloadedFile);
    } else {
      setError("Could not load image from this web address. Please check the URL or try another link.");
    }
    setUrlLoading(false);
  };

  // 1-Click sample loader
  const loadSample = async (sample) => {
    stopWebcam();
    setError("");
    setCloudFileNoticeOpen(false);
    try {
      const response = await fetch(sample.path);
      const blob = await response.blob();
      const sampleFile = new File([blob], sample.name, {
        type: blob.type || "image/jpeg"
      });
      processFile(sampleFile);
    } catch {
      setError("Could not load preset sample. Please upload an image directly.");
    }
  };

  // Analyze image with dual-route fallback (Proxy & Direct)
  async function analyzeImage(explicitFile = null) {
    const targetFile = explicitFile || file;
    if (!targetFile) return;

    if (typeof window !== "undefined" && window.location.protocol === "https:" && apiBaseUrl.includes("localhost")) {
      setError(
        "Browser Security Policy: Web browsers block insecure 'http://localhost' requests from secure 'https://' websites. Switch to 'Cloud' above or open http://localhost:5173."
      );
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setResult(null);
    setError("");

    const stepTimer1 = setTimeout(() => setLoadingStep(2), 600);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 1200);

    const fileToUpload = await optimizeImageForInference(targetFile);
    const formData = new FormData();
    formData.append("file", fileToUpload);

    const candidateRoutes = [];
    if (apiBaseUrl === "/api") {
      candidateRoutes.push({
        url: "/api/predict",
        timeoutMs: 12000,
        name: "Edge Proxy"
      });
      candidateRoutes.push({
        url: "https://ashishabhagat-deepguard-ai.onrender.com/predict",
        timeoutMs: 65000,
        name: "Direct Render Cloud"
      });
    } else if (apiBaseUrl.includes("onrender.com")) {
      candidateRoutes.push({
        url: "https://ashishabhagat-deepguard-ai.onrender.com/predict",
        timeoutMs: 65000,
        name: "Direct Render Cloud"
      });
      candidateRoutes.push({
        url: "/api/predict",
        timeoutMs: 12000,
        name: "Edge Proxy"
      });
    } else {
      candidateRoutes.push({
        url: `${apiBaseUrl}/predict`,
        timeoutMs: 30000,
        name: "Local Backend"
      });
    }

    let success = false;
    let lastError = null;

    for (let i = 0; i < candidateRoutes.length; i++) {
      const route = candidateRoutes[i];
      const maxRetries = route.url.includes("onrender.com") ? 2 : 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1 || i > 0) {
            setLoadingStep(4);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), route.timeoutMs);

          const response = await fetch(route.url, {
            method: "POST",
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          let data;
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await response.json();
          } else {
            const rawText = await response.text();
            if (response.status === 504 || rawText.includes("Gateway Timeout")) {
              throw new Error("Cloud gateway timeout. Connecting directly to Render...");
            }
            throw new Error(`Server returned status ${response.status}`);
          }

          if (!response.ok) {
            throw new Error(data.detail || `Server responded with status ${response.status}`);
          }

          setResult(data);
          setError("");
          setBackendStatus((prev) => ({
            ...prev,
            state: "online",
            latency: data.latency_ms || prev.latency
          }));
          fetchDbStats(apiBaseUrl);
          fetchHistory(historyFilter, apiBaseUrl);
          success = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      if (success) break;
    }

    if (!success) {
      const isConnectionTimeout =
        lastError?.name === "AbortError" ||
        lastError?.message?.includes("Failed to fetch") ||
        lastError?.message?.includes("NetworkError") ||
        lastError?.message?.includes("Gateway Timeout");

      if (isConnectionTimeout) {
        setError(
          "Cloud instance notice: Free-tier cloud instances sleep when inactive and may take 30-45s to spin up. Click 'Retry Analysis' or 'Wake Up Cloud Server' below."
        );
        checkBackendHealth("https://ashishabhagat-deepguard-ai.onrender.com");
      } else {
        setError(`Analysis notice: ${lastError?.message || "Could not complete neural inference"}`);
      }
    }

    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    setLoading(false);
    setLoadingStep(0);
  }

  const resetAnalysis = () => {
    stopWebcam();
    setFile(null);
    setImage(null);
    setResult(null);
    setError("");
    setViewMode("normal");
  };

  const copyForensicSummary = () => {
    if (!result) return;
    const summary = `DeepGuard AI Forensic Report
Verdict: ${result.prediction === "FAKE" ? "SYNTHETIC / DEEPFAKE" : "AUTHENTIC HUMAN MEDIA"}
Certainty: ${result.confidence}%
Fake Probability: ${result.fake_probability}%
Real Probability: ${result.real_probability}%
Engine: ${result.model || "ConvNeXt-Tiny V10.0 OmniShield + 3-Pass TTA"}
Latency: ${result.latency_ms || "N/A"} ms
Verified via DeepGuard AI Platform`;

    navigator.clipboard.writeText(summary);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const downloadReportJson = () => {
    if (!result) return;
    const reportData = {
      timestamp: new Date().toISOString(),
      file_name: file?.name,
      file_size: file?.size,
      results: result
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deepguard-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      {/* NAVBAR */}
      <Navbar
        backendStatus={backendStatus}
        apiBaseUrl={apiBaseUrl}
        setApiBaseUrl={setApiBaseUrl}
        dbInfo={dbInfo}
        dbStats={dbStats}
        onPing={() => checkBackendHealth()}
      />

      {/* HERO SECTION */}
      <Hero />

      {/* WORKSPACE & INSPECTION STAGE */}
      <main id="detector" className="workspace-main">
        {!image ? (
          <DetectorWorkspace
            inputTab={inputTab}
            setInputTab={setInputTab}
            onFileSelected={processFile}
            onClipboardPaste={handleClipboardPasteClick}
            startWebcam={startWebcam}
            stopWebcam={stopWebcam}
            isCameraStreaming={isCameraStreaming}
            cameraError={cameraError}
            videoRef={videoRef}
            canvasRef={canvasRef}
            snapWebcamPhoto={snapWebcamPhoto}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            urlLoading={urlLoading}
            onUrlSubmit={handleUrlSubmit}
            samples={SAMPLES}
            onLoadSample={loadSample}
            cloudFileNoticeOpen={cloudFileNoticeOpen}
            setCloudFileNoticeOpen={setCloudFileNoticeOpen}
          />
        ) : (
          <div className="inspection-stage">
            <ForensicViewer
              image={image}
              file={file}
              result={result}
              loading={loading}
              loadingStep={loadingStep}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onAnalyze={() => analyzeImage()}
              onReset={resetAnalysis}
            />

            {result && (
              <VerdictCard
                result={result}
                dbInfo={dbInfo}
                onReset={resetAnalysis}
                onCopySummary={copyForensicSummary}
                copySuccess={copySuccess}
                onDownloadReport={downloadReportJson}
              />
            )}
          </div>
        )}

        {/* ERROR / NOTICE ALERT */}
        {error && !cloudFileNoticeOpen && !error.includes("0x8007016A") && (
          <div className="error-banner">
            <div className="error-body">
              <span className="error-title">Inference Advisory</span>
              <p className="error-text">{error}</p>

              {warmingUp && (
                <div className="cloud-warmup-bar">
                  <span>Waking up Render cloud container ({warmupProgress}%)...</span>
                  <div className="warmup-track">
                    <div className="warmup-fill" style={{ width: `${warmupProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="error-actions">
                {file && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={loading || warmingUp}
                    onClick={() => {
                      setError("");
                      analyzeImage();
                    }}
                  >
                    {loading ? "Analyzing..." : "Retry Analysis"}
                  </button>
                )}

                {backendStatus.state !== "online" && !warmingUp && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => wakeUpCloudEngine(true)}
                  >
                    Wake Up Cloud Server
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              className="error-dismiss-btn"
              onClick={() => setError("")}
            >
              ✕
            </button>
          </div>
        )}
      </main>

      {/* DATABASE AUDIT LOG EXPLORER */}
      <AuditLog
        dbInfo={dbInfo}
        dbStats={dbStats}
        history={history}
        historyFilter={historyFilter}
        setHistoryFilter={setHistoryFilter}
        historyLoading={historyLoading}
        onRefresh={() => {
          fetchHistory(historyFilter);
          fetchDbStats();
        }}
        onDeleteScan={handleDeleteScan}
        onClearHistory={handleClearHistory}
      />

      {/* BENCHMARKS & ARCHITECTURE */}
      <Benchmarks />

      {/* FAQ SECTION */}
      <FaqSection />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
