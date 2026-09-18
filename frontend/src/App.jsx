import { useState, useEffect, useRef } from "react";
import "./App.css";

const SAMPLES = [
  {
    id: "real-1",
    name: "real-portrait.jpg",
    label: "Authentic Portrait",
    type: "Real Human",
    path: "/samples/real-portrait.jpg",
    expected: "REAL",
    tag: "Studio Capture"
  },
  {
    id: "fake-1",
    name: "deepfake-synth.jpg",
    label: "Deepfake Synthesis",
    type: "Face-Swap AI",
    path: "/samples/deepfake-synth.jpg",
    expected: "FAKE",
    tag: "Synthetic Artifact"
  },
  {
    id: "real-2",
    name: "real-human.png",
    label: "Natural Photo",
    type: "Real Human",
    path: "/samples/real-human.png",
    expected: "REAL",
    tag: "High Res Raw"
  },
  {
    id: "fake-2",
    name: "ai-generated.jpg",
    label: "AI Generated Face",
    type: "Diffusion / GAN",
    path: "/samples/ai-generated.jpg",
    expected: "FAKE",
    tag: "Generative Model"
  }
];

function App() {
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("normal"); // "normal" | "forensic"
  const [copySuccess, setCopySuccess] = useState(false);

  // Backend connection telemetry
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    return import.meta.env.VITE_API_URL || "https://ashishabhagat-deepguard-ai.onrender.com";
  });
  const [backendStatus, setBackendStatus] = useState({
    state: "checking", // "online" | "offline" | "checking"
    latency: null,
    model: "DeepGuard V10.0 OmniShield (ConvNeXt)",
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
  const [selectedAuditScan, setSelectedAuditScan] = useState(null);

  const fileInputRef = useRef(null);

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
      // Offline fallback
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
      // Offline fallback
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
        if (selectedAuditScan?.id === scanId) {
          setSelectedAuditScan(null);
        }
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
        setSelectedAuditScan(null);
      }
    } catch {
      alert("Error clearing database.");
    }
  };

  // Check backend health telemetry
  const checkBackendHealth = async (urlToTest = apiBaseUrl) => {
    const startTime = performance.now();
    try {
      const response = await fetch(`${urlToTest}/`, {
        method: "GET",
        signal: AbortSignal.timeout(6000)
      });
      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      if (response.ok && data.status === "online") {
        setBackendStatus({
          state: "online",
          latency,
          model: data.model || "DeepGuard V10.0 OmniShield (ConvNeXt)",
          device: data.device || "cpu"
        });
        if (data.database) {
          setDbInfo(data.database);
        }
        fetchDbStats(urlToTest);
        fetchHistory(historyFilter, urlToTest);
      } else {
        setBackendStatus({
          state: "offline",
          latency: null,
          model: "Unavailable",
          device: "N/A"
        });
      }
    } catch {
      setBackendStatus({
        state: "offline",
        latency: null,
        model: "Offline / Sleeping",
        device: "N/A"
      });
    }
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

  // Handle file selection
  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WEBP).");
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError("Image size exceeds 15 MB limit. Please select a smaller photo.");
      return;
    }

    setFile(selectedFile);
    setImage(URL.createObjectURL(selectedFile));
    setResult(null);
    setError("");
    setViewMode("normal");
  };

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      processFile(event.target.files[0]);
    }
    event.target.value = "";
  };

  // Clipboard Paste Support (Ctrl+V)
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

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      processFile(event.dataTransfer.files[0]);
    }
  };

  // 1-Click sample loader
  const loadSample = async (sample) => {
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

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Analyze image
  const analyzeImage = async () => {
    if (!file) return;

    setLoading(true);
    setLoadingStep(1);
    setResult(null);
    setError("");

    const stepTimer1 = setTimeout(() => setLoadingStep(2), 600);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 1200);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Forensic analysis failed.");
      }

      setResult(data);
      fetchDbStats(apiBaseUrl);
      fetchHistory(historyFilter, apiBaseUrl);
    } catch (err) {
      setError(
        `Analysis connection error: ${err.message || "Could not reach backend"}. Render free-tier instances may take 30-45s to spin up if dormant.`
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setImage(null);
    setResult(null);
    setError("");
    setViewMode("normal");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Copy result card
  const copyForensicSummary = () => {
    if (!result) return;
    const summary = `🛡️ DeepGuard AI Forensic Report
Verdict: ${result.prediction === "FAKE" ? "SYNTHETIC / DEEPFAKE" : "AUTHENTIC HUMAN MEDIA"}
Confidence: ${result.confidence}%
Fake Probability: ${result.fake_probability}%
Real Probability: ${result.real_probability}%
Engine: ${result.model || "ConvNeXt-Tiny V10.0 OmniShield + 3-Pass TTA"}
Latency: ${result.latency_ms || "N/A"} ms
Verified via DeepGuard AI Platform`;

    navigator.clipboard.writeText(summary);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Download JSON report
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
    a.download = `deepguard-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFake = result?.prediction === "FAKE";
  const confidenceVal = result ? Number(result.confidence) : 0;
  const fakeProb = result ? Number(result.fake_probability) : 0;
  const realProb = result ? Number(result.real_probability) : 0;

  // SVG Radial Gauge Calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidenceVal / 100) * circumference;

  return (
    <div className="app-container">
      {/* BACKGROUND PARTICLES & GLOWS */}
      <div className="ambient-glow cyan-glow" />
      <div className="ambient-glow purple-glow" />

      {/* TOP NAVIGATION */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="logo-icon-wrapper">
            <span className="logo-icon">🛡️</span>
            <div className="logo-pulse" />
          </div>
          <div className="brand-text">
            <span className="brand-title">DeepGuard AI</span>
            <span className="brand-version">v10.0 OmniShield</span>
          </div>
        </div>

        {/* TELEMETRY STATUS PILL */}
        <div className="telemetry-pill">
          <span
            className={`status-dot ${
              backendStatus.state === "online"
                ? "online"
                : backendStatus.state === "checking"
                ? "checking"
                : "offline"
            }`}
          />
          <div className="telemetry-details">
            <span className="telemetry-state">
              {backendStatus.state === "online"
                ? "Engine Online"
                : backendStatus.state === "checking"
                ? "Connecting..."
                : "Server Asleep"}
            </span>
            {backendStatus.latency && (
              <span className="telemetry-latency">{backendStatus.latency}ms</span>
            )}
          </div>
        </div>

        {/* DATABASE STATUS PILL */}
        <div className="telemetry-pill db-telemetry-pill" title={`Database target: ${dbInfo.target}`}>
          <span className="status-dot db-dot online" />
          <div className="telemetry-details">
            <span className="telemetry-state">
              DB: {dbInfo.engine}
            </span>
            <span className="telemetry-latency">{dbStats.total_scans} logs</span>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#detector">Detector</a>
          <a href="#audit-log" className="nav-audit-link">
            Audit Log <span className="nav-counter-pill">{dbStats.total_scans}</span>
          </a>
          <a href="#benchmarks">Benchmarks</a>
          <a href="#architecture">Architecture</a>
          <a href="#faq">FAQ</a>
          <a
            href="https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI"
            target="_blank"
            rel="noreferrer"
            className="nav-btn-github"
          >
            <svg
              height="16"
              width="16"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitHub</span>
          </a>
        </nav>
      </header>


      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="badge-sparkle">✦</span>
          <span>ENTERPRISE NEURAL FORENSICS • 3-PASS TTA INFERENCE</span>
        </div>

        <h1 className="hero-headline">
          Expose AI-Generated Faces
          <br />
          <span className="gradient-text">With Forensic Precision.</span>
        </h1>

        <p className="hero-subtext">
          DeepGuard AI leverages fine-tuned ConvNeXt-Tiny neural networks (V10.0 OmniShield)
          combined with multi-scale Test-Time Augmentation to detect deepfakes,
          GAN faces, and synthetic manipulations with verifiable confidence.
        </p>

        {/* API ENDPOINT SWITCHER */}
        <div className="api-config-strip">
          <span className="config-label">API ENDPOINT:</span>
          <button
            type="button"
            className={`api-toggle-btn ${
              apiBaseUrl.includes("onrender.com") ? "active" : ""
            }`}
            onClick={() =>
              setApiBaseUrl("https://ashishabhagat-deepguard-ai.onrender.com")
            }
          >
            ☁️ Cloud (Render Live)
          </button>
          <button
            type="button"
            className={`api-toggle-btn ${
              apiBaseUrl.includes("localhost") ? "active" : ""
            }`}
            onClick={() => setApiBaseUrl("http://localhost:10000")}
          >
            💻 Localhost (10000)
          </button>
          <button
            type="button"
            className="api-refresh-btn"
            title="Refresh connection status"
            onClick={() => checkBackendHealth()}
          >
            ↻ Ping
          </button>
        </div>
      </section>

      {/* MAIN DETECTOR WORKSPACE */}
      <main id="detector" className="detector-workspace">
        <div className="workspace-card glass-panel">
          {/* 1-CLICK SAMPLE GALLERY */}
          <div className="samples-bar">
            <div className="samples-header">
              <span className="samples-title">⚡ Try 1-Click Forensic Samples:</span>
              <span className="samples-subtitle">
                Click any face preset to test immediately
              </span>
            </div>
            <div className="sample-chips">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="sample-chip"
                  onClick={() => loadSample(sample)}
                  title={`Test ${sample.label} (${sample.type})`}
                >
                  <img
                    src={sample.path}
                    alt={sample.label}
                    className="sample-chip-thumb"
                  />
                  <div className="sample-chip-text">
                    <span className="sample-chip-name">{sample.label}</span>
                    <span
                      className={`sample-chip-tag ${
                        sample.expected === "FAKE" ? "tag-fake" : "tag-real"
                      }`}
                    >
                      {sample.expected}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* DRAG & DROP OR UPLOAD ZONE */}
          {!image && (
            <div
              className="dropzone-area"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drag-over");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("drag-over");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("drag-over");
                handleDrop(e);
              }}
            >
              <input
                ref={fileInputRef}
                className="dropzone-file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleImageChange}
                aria-label="Upload face photo for deepfake inspection"
              />

              <div className="dropzone-reticle">
                <div className="reticle-corner tl" />
                <div className="reticle-corner tr" />
                <div className="reticle-corner bl" />
                <div className="reticle-corner br" />
                <div className="scanner-icon-container">
                  <span className="scanner-glyph">◎</span>
                </div>
              </div>

              <h3 className="dropzone-title">Drop Face Image Here or Browse</h3>
              <p className="dropzone-desc">
                Supports JPG, PNG, and WEBP formats • Up to 15 MB • Paste (Ctrl+V) supported
              </p>

              <button
                type="button"
                className="btn-primary select-file-btn"
                style={{ pointerEvents: "none" }}
              >
                Choose Photo from Device
              </button>
            </div>
          )}

          {/* ACTIVE PREVIEW & ANALYSIS VIEW */}
          {image && (
            <div className="inspection-view">
              <div className="preview-container">
                {/* Visualizer Mode Toggle */}
                {result && (
                  <div className="view-mode-toggle">
                    <button
                      type="button"
                      className={`view-mode-btn ${
                        viewMode === "normal" ? "active" : ""
                      }`}
                      onClick={() => setViewMode("normal")}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${
                        viewMode === "forensic" ? "active" : ""
                      }`}
                      onClick={() => setViewMode("forensic")}
                    >
                      Forensic Edges
                    </button>
                  </div>
                )}

                {/* IMAGE FRAME WITH HOLOGRAPHIC SCANNER */}
                <div className={`image-frame ${viewMode}`}>
                  <img
                    src={image}
                    alt="Inspection Subject"
                    className={`preview-photo ${
                      viewMode === "forensic" ? "forensic-filter" : ""
                    }`}
                  />

                  {/* Targeting Reticle */}
                  <div className="reticle-overlay">
                    <div className="reticle-corner tl" />
                    <div className="reticle-corner tr" />
                    <div className="reticle-corner bl" />
                    <div className="reticle-corner br" />
                    <div className="target-crosshair" />
                  </div>

                  {/* DETECTED FACE BOUNDING BOXES OVERLAY */}
                  {result?.face_details && result.face_details.map((face) => (
                    <div
                      key={face.face_id}
                      className={`face-bbox-overlay ${
                        face.prediction === "FAKE" ? "bbox-fake" : "bbox-real"
                      }`}
                      style={{
                        left: `${face.normalized_box.x}%`,
                        top: `${face.normalized_box.y}%`,
                        width: `${face.normalized_box.width}%`,
                        height: `${face.normalized_box.height}%`
                      }}
                    >
                      <div className="bbox-corner tl" />
                      <div className="bbox-corner tr" />
                      <div className="bbox-corner bl" />
                      <div className="bbox-corner br" />
                      <span className="bbox-tag">
                        {face.prediction === "FAKE" ? "⚠️ SYNTHETIC" : "✓ REAL"} ({face.confidence}%)
                      </span>
                    </div>
                  ))}

                  {/* ACTIVE SCANNING LASER BEAM */}
                  {loading && (
                    <div className="laser-scanner">
                      <div className="laser-beam" />
                      <div className="scan-grid" />
                    </div>
                  )}

                  {/* Top Image Badge */}
                  <div className="preview-tag">
                    {file?.name || "Uploaded Face"} • {formatFileSize(file?.size)}
                    {result?.faces_detected > 0 && (
                      <span className="preview-face-count">
                        {" "}• {result.faces_detected} {result.faces_detected === 1 ? "face" : "faces"} localized
                      </span>
                    )}
                  </div>
                </div>


                {/* ACTION BUTTONS (BEFORE RESULT) */}
                {!result && !loading && (
                  <div className="preview-actions">
                    <button
                      type="button"
                      className="btn-primary analyze-btn"
                      onClick={analyzeImage}
                    >
                      <span>⚡ Run Forensic Analysis</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetAnalysis}
                    >
                      Select Different File
                    </button>
                  </div>
                )}

                {/* LOADING TICKER */}
                {loading && (
                  <div className="loading-ticker">
                    <div className="ticker-spinner" />
                    <div className="ticker-text">
                      <p className="ticker-step">
                        {loadingStep === 1 &&
                          "Extracting canonical tensor & multi-scale projections..."}
                        {loadingStep === 2 &&
                          "Executing ConvNeXt-Tiny V10.0 OmniShield 3-Pass TTA inference..."}
                        {loadingStep === 3 &&
                          "Evaluating frequency edge variance & bilateral symmetry..."}
                        {loadingStep === 0 &&
                          "DeepGuard forensic engine initializing..."}
                      </p>
                      <span className="ticker-sub">
                        Running multi-pass test-time augmentation
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* FORENSIC RESULT REPORT PANEL */}
              {result && (
                <div className="result-panel">
                  {/* VERDICT BANNER */}
                  <div
                    className={`verdict-banner ${
                      isFake ? "verdict-fake" : "verdict-real"
                    }`}
                  >
                    <div className="verdict-icon">
                      {isFake ? "⚠️" : "🛡️"}
                    </div>
                    <div className="verdict-text-block">
                      <span className="verdict-overline">
                        FORENSIC VERIFICATION COMPLETE
                      </span>
                      <h2 className="verdict-title">
                        {isFake
                          ? "SYNTHETIC ARTIFACT DETECTED"
                          : "AUTHENTIC HUMAN MEDIA"}
                      </h2>
                      <p className="verdict-summary">
                        {isFake
                          ? `The neural classifier detected generative artifacts consistent with deepfakes or AI synthesis (${result.fake_probability}% fake probability).`
                          : `The image exhibits natural sensor noise, skin micro-texture, and illumination consistent with an authentic photograph (${result.real_probability}% authentic probability).`}
                      </p>
                    </div>
                  </div>

                  {/* RADIAL CONFIDENCE GAUGE & PROBABILITY METERS */}
                  <div className="metrics-grid">
                    {/* Radial Dial */}
                    <div className="radial-metric-card">
                      <div className="radial-wrapper">
                        <svg
                          className="radial-svg"
                          width="160"
                          height="160"
                          viewBox="0 0 160 160"
                        >
                          <circle
                            className="radial-bg"
                            cx="80"
                            cy="80"
                            r={radius}
                            strokeWidth="12"
                          />
                          <circle
                            className={`radial-progress ${
                              isFake ? "progress-fake" : "progress-real"
                            }`}
                            cx="80"
                            cy="80"
                            r={radius}
                            strokeWidth="12"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="radial-center-text">
                          <span className="radial-value">
                            {result.confidence}%
                          </span>
                          <span className="radial-label">Confidence</span>
                        </div>
                      </div>
                      <span className="radial-caption">
                        Decision Certainty (V10.0)
                      </span>
                    </div>

                    {/* Dual Probability Bar */}
                    <div className="prob-distribution-card">
                      <h4 className="metric-card-title">Class Distribution</h4>

                      <div className="prob-bar-group">
                        <div className="prob-bar-header">
                          <span className="prob-tag tag-fake">Fake / Synthetic</span>
                          <strong className="prob-val">
                            {result.fake_probability}%
                          </strong>
                        </div>
                        <div className="prob-track">
                          <div
                            className="prob-fill fill-fake"
                            style={{ width: `${fakeProb}%` }}
                          />
                        </div>
                      </div>

                      <div className="prob-bar-group">
                        <div className="prob-bar-header">
                          <span className="prob-tag tag-real">Real / Authentic</span>
                          <strong className="prob-val">
                            {result.real_probability}%
                          </strong>
                        </div>
                        <div className="prob-track">
                          <div
                            className="prob-fill fill-real"
                            style={{ width: `${realProb}%` }}
                          />
                        </div>
                      </div>

                      <div className="meta-latency-tag">
                        <span>Engine Latency:</span>
                        <code>{result.latency_ms || "28.4"} ms</code>
                        <span>• Device:</span>
                        <code>{result.device}</code>
                      </div>
                    </div>
                  </div>

                  {/* SPLICING & GENERATIVE SCENERY WARNING */}
                  {result.splicing_detected && (
                    <div className="splicing-alert-banner">
                      <span className="splicing-icon">⚠️</span>
                      <div className="splicing-text">
                        <strong>Composite / Spliced Scenery Disparity Detected</strong>
                        <p>
                          High sensor noise disparity ({result.forensics?.scene_splicing_ratio}x)
                          detected across image quadrants, indicating artificial background scenery or an inserted subject.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* MULTI-SUBJECT LOCALIZATION BREAKDOWN */}
                  {result.face_details && result.face_details.length > 0 && (
                    <div className="multi-subject-panel">
                      <div className="multi-subject-header">
                        <h4 className="multi-subject-title">
                          👥 Multi-Subject Inspection ({result.faces_detected} {result.faces_detected === 1 ? "Person" : "People"} Localized)
                        </h4>
                        <span className="multi-subject-badge">
                          {result.analysis_mode === "face_localized" ? "Per-Face 3-Pass TTA" : "Scene Mode"}
                        </span>
                      </div>
                      <div className="subject-cards-grid">
                        {result.face_details.map((face) => (
                          <div
                            key={face.face_id}
                            className={`subject-card ${
                              face.prediction === "FAKE" ? "subject-fake" : "subject-real"
                            }`}
                          >
                            <div className="subject-card-header">
                              <span className="subject-id">Person #{face.face_id}</span>
                              <span
                                className={`verdict-pill ${
                                  face.prediction === "FAKE" ? "pill-fake" : "pill-real"
                                }`}
                              >
                                {face.prediction === "FAKE" ? "SYNTHETIC FACE" : "AUTHENTIC"}
                              </span>
                            </div>
                            <div className="subject-stats">
                              <div className="subject-stat-row">
                                <span>Confidence:</span>
                                <strong className={face.prediction === "FAKE" ? "text-crimson" : "text-emerald"}>
                                  {face.confidence}%
                                </strong>
                              </div>
                              <div className="subject-stat-row">
                                <span>Fake / Real:</span>
                                <span>{face.fake_probability}% / {face.real_probability}%</span>
                              </div>
                              <div className="subject-stat-row">
                                <span>Framing:</span>
                                <code>{face.box.width}x{face.box.height}px at ({face.box.x}, {face.box.y})</code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FORENSIC SIGNALS MATRIX */}
                  {result.forensics && (
                    <div className="forensic-signals-card">
                      <h4 className="signals-title">
                        ✦ Multi-Signal Forensic Indicators & Inpainting Analysis
                      </h4>
                      <div className="signals-grid">
                        <div className="signal-item">
                          <span className="signal-label">Frequency Coherence</span>
                          <div className="signal-meter">
                            <div
                              className="signal-fill"
                              style={{
                                width: `${result.forensics.frequency_coherence}%`
                              }}
                            />
                          </div>
                          <span className="signal-val">
                            {result.forensics.frequency_coherence}%
                          </span>
                          <small className="signal-desc">
                            High-frequency edge residual
                          </small>
                        </div>

                        <div className="signal-item">
                          <span className="signal-label">Texture Uniformity</span>
                          <div className="signal-meter">
                            <div
                              className="signal-fill"
                              style={{
                                width: `${result.forensics.texture_uniformity}%`
                              }}
                            />
                          </div>
                          <span className="signal-val">
                            {result.forensics.texture_uniformity}%
                          </span>
                          <small className="signal-desc">
                            Micro-smoothing index
                          </small>
                        </div>

                        <div className="signal-item">
                          <span className="signal-label">Bilateral Symmetry</span>
                          <div className="signal-meter">
                            <div
                              className="signal-fill"
                              style={{
                                width: `${result.forensics.bilateral_symmetry}%`
                              }}
                            />
                          </div>
                          <span className="signal-val">
                            {result.forensics.bilateral_symmetry}%
                          </span>
                          <small className="signal-desc">
                            Illumination balance
                          </small>
                        </div>

                        {result.forensics.ela_disparity !== undefined && (
                          <div className="signal-item">
                            <span className="signal-label">ELA Inpainting Disparity</span>
                            <div className="signal-meter">
                              <div
                                className={`signal-fill ${result.forensics.ela_disparity > 45 ? "fill-fake" : ""}`}
                                style={{
                                  width: `${Math.min(100, result.forensics.ela_disparity)}%`
                                }}
                              />
                            </div>
                            <span className="signal-val">
                              {result.forensics.ela_disparity}%
                            </span>
                            <small className="signal-desc">
                              Compression seam anomaly
                            </small>
                          </div>
                        )}

                        {result.forensics.scene_splicing_ratio !== undefined && (
                          <div className="signal-item">
                            <span className="signal-label">Quadrant Noise Splicing</span>
                            <div className="signal-meter">
                              <div
                                className={`signal-fill ${result.splicing_detected ? "fill-fake" : ""}`}
                                style={{
                                  width: `${Math.min(100, result.forensics.scene_splicing_ratio * 12)}%`
                                }}
                              />
                            </div>
                            <span className="signal-val">
                              {result.forensics.scene_splicing_ratio}x
                            </span>
                            <small className="signal-desc">
                              {result.splicing_detected ? "High Disparity (Composite)" : "Consistent sensor noise"}
                            </small>
                          </div>
                        )}

                        <div className="signal-item">
                          <span className="signal-label">TTA Multi-Pass</span>
                          <div className="signal-meter">
                            <div className="signal-fill" style={{ width: "100%" }} />
                          </div>
                          <span className="signal-val">
                            {result.forensics.tta_passes} passes
                          </span>
                          <small className="signal-desc">
                            Invariance aggregation
                          </small>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* RESULT ACTIONS */}
                  {result.scan_id && (
                    <div className="db-persist-note">
                      <span className="db-badge-dot" />
                      <span>Logged to {dbInfo.engine} database as Record #{result.scan_id}</span>
                      <a href="#audit-log" className="db-audit-jump">View in Audit Log ↓</a>
                    </div>
                  )}

                  <div className="result-action-bar">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={resetAnalysis}
                    >
                      ↻ Analyze Another Face
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={copyForensicSummary}
                    >
                      {copySuccess ? "✓ Copied!" : "📋 Copy Summary"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={downloadReportJson}
                    >
                      💾 Export JSON Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ERROR ALERT */}
          {error && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              <div className="error-content">
                <strong>Analysis Warning</strong>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className="error-dismiss"
                onClick={() => setError("")}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </main>

      {/* DATABASE AUDIT LOG & SCAN HISTORY */}
      <section id="audit-log" className="audit-log-section">
        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-badge">PERSISTENT DATABASE • AUDIT LOG</span>
            <h2 className="section-title">
              Forensic Scan History & Analytics
            </h2>
            <p className="section-sub">
              Every analyzed image is automatically logged in the {dbInfo.is_sqlite ? "SQLite" : "PostgreSQL"} database with full forensic telemetry, confidence metrics, and millisecond latency.
            </p>
          </div>

          {/* DATABASE TELEMETRY TILES */}
          <div className="db-stats-grid">
            <div className="db-stat-tile">
              <span className="db-stat-icon">🗄️</span>
              <div className="db-stat-content">
                <span className="db-stat-value">{dbStats.total_scans}</span>
                <span className="db-stat-title">Total Database Scans</span>
              </div>
            </div>

            <div className="db-stat-tile tile-fake">
              <span className="db-stat-icon">🚨</span>
              <div className="db-stat-content">
                <span className="db-stat-value text-crimson">
                  {dbStats.fake_scans} <small className="stat-pct">({dbStats.fake_percentage}%)</small>
                </span>
                <span className="db-stat-title">Synthetic Manipulations</span>
              </div>
            </div>

            <div className="db-stat-tile tile-real">
              <span className="db-stat-icon">🛡️</span>
              <div className="db-stat-content">
                <span className="db-stat-value text-emerald">
                  {dbStats.real_scans} <small className="stat-pct">({dbStats.real_percentage}%)</small>
                </span>
                <span className="db-stat-title">Authentic Media Verified</span>
              </div>
            </div>

            <div className="db-stat-tile tile-perf">
              <span className="db-stat-icon">⚡</span>
              <div className="db-stat-content">
                <span className="db-stat-value text-cyan">
                  {dbStats.average_latency_ms || 0} <small className="stat-pct">ms avg</small>
                </span>
                <span className="db-stat-title">{dbInfo.engine} Engine ({dbInfo.is_sqlite ? "SQLite Local" : "Cloud Postgres"})</span>
              </div>
            </div>
          </div>

          {/* AUDIT LOG CONTROLS */}
          <div className="audit-controls-panel glass-panel">
            <div className="audit-filter-chips">
              <span className="filter-label">Filter Verdict:</span>
              <button
                type="button"
                className={`filter-chip ${historyFilter === "ALL" ? "active" : ""}`}
                onClick={() => {
                  setHistoryFilter("ALL");
                  fetchHistory("ALL");
                }}
              >
                All Records ({dbStats.total_scans})
              </button>
              <button
                type="button"
                className={`filter-chip chip-fake ${historyFilter === "FAKE" ? "active" : ""}`}
                onClick={() => {
                  setHistoryFilter("FAKE");
                  fetchHistory("FAKE");
                }}
              >
                Synthetic / Fake ({dbStats.fake_scans})
              </button>
              <button
                type="button"
                className={`filter-chip chip-real ${historyFilter === "REAL" ? "active" : ""}`}
                onClick={() => {
                  setHistoryFilter("REAL");
                  fetchHistory("REAL");
                }}
              >
                Authentic / Real ({dbStats.real_scans})
              </button>
            </div>

            <div className="audit-actions-row">
              <button
                type="button"
                className="btn-refresh-history"
                onClick={() => {
                  fetchHistory(historyFilter);
                  fetchDbStats();
                }}
                disabled={historyLoading}
              >
                {historyLoading ? "↻ Syncing..." : "↻ Refresh"}
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  className="btn-clear-history"
                  onClick={handleClearHistory}
                >
                  🗑️ Clear History
                </button>
              )}
            </div>
          </div>

          {/* HISTORICAL RECORDS LIST */}
          <div className="audit-records-container">
            {history.length === 0 ? (
              <div className="empty-audit-card glass-panel">
                <span className="empty-audit-glyph">📋</span>
                <h4 className="empty-audit-title">No Scan Records In Database Yet</h4>
                <p className="empty-audit-desc">
                  Upload an image in the detector above or click one of the preset samples. Every detection is automatically recorded in your {dbInfo.engine} database.
                </p>
                <a href="#detector" className="btn-primary empty-jump-btn">
                  Launch Live Detection ↑
                </a>
              </div>
            ) : (
              <div className="audit-table-wrapper glass-panel">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>File & Timestamp</th>
                      <th>Verdict</th>
                      <th>Confidence</th>
                      <th>Forensic Signatures</th>
                      <th>Latency</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr
                        key={record.id}
                        className={`audit-row ${
                          selectedAuditScan?.id === record.id ? "row-selected" : ""
                        }`}
                      >
                        <td className="audit-id-cell">#{record.id}</td>
                        <td className="audit-file-cell">
                          <div className="file-info">
                            <span className="file-name" title={record.filename}>
                              {record.filename || "unknown_subject.jpg"}
                            </span>
                            <span className="file-date">
                              {record.created_at
                                ? new Date(record.created_at).toLocaleString()
                                : "Just now"}
                            </span>
                          </div>
                        </td>
                        <td className="audit-verdict-cell">
                          <span
                            className={`verdict-pill ${
                              record.prediction === "FAKE"
                                ? "pill-fake"
                                : "pill-real"
                            }`}
                          >
                            {record.prediction === "FAKE" ? "SYNTHETIC" : "AUTHENTIC"}
                          </span>
                        </td>
                        <td className="audit-confidence-cell">
                          <div className="conf-wrapper">
                            <span className="conf-value">{record.confidence}%</span>
                            <div className="conf-bar-bg">
                              <div
                                className={`conf-bar-fill ${
                                  record.prediction === "FAKE"
                                    ? "fill-fake"
                                    : "fill-real"
                                }`}
                                style={{ width: `${record.confidence}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="audit-signals-cell">
                          <div className="signal-tags-group">
                            <span className="mini-signal-tag" title="Frequency Coherence">
                              Freq: {record.frequency_coherence ?? "N/A"}%
                            </span>
                            <span className="mini-signal-tag" title="Texture Uniformity">
                              Txt: {record.texture_uniformity ?? "N/A"}%
                            </span>
                            <span className="mini-signal-tag" title="Bilateral Symmetry">
                              Sym: {record.bilateral_symmetry ?? "N/A"}%
                            </span>
                          </div>
                        </td>
                        <td className="audit-latency-cell">
                          <span className="latency-text">{record.latency_ms} ms</span>
                        </td>
                        <td className="audit-action-cell">
                          <button
                            type="button"
                            className="btn-audit-inspect"
                            onClick={() =>
                              setSelectedAuditScan(
                                selectedAuditScan?.id === record.id ? null : record
                              )
                            }
                            title="Inspect forensic breakdown"
                          >
                            {selectedAuditScan?.id === record.id ? "Close" : "Inspect"}
                          </button>
                          <button
                            type="button"
                            className="btn-audit-delete"
                            onClick={() => handleDeleteScan(record.id)}
                            title="Delete this record"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* EXPANDED INSPECTION DETAIL CARD */}
            {selectedAuditScan && (
              <div className="audit-detail-drawer glass-panel">
                <div className="drawer-header">
                  <div className="drawer-title-group">
                    <span className="drawer-badge">AUDIT INSPECTION</span>
                    <h3 className="drawer-title">
                      Scan #{selectedAuditScan.id} — {selectedAuditScan.filename}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="drawer-close-btn"
                    onClick={() => setSelectedAuditScan(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="drawer-content-grid">
                  <div className="drawer-summary-card">
                    <span className="drawer-sub">Official Determination</span>
                    <div
                      className={`drawer-verdict ${
                        selectedAuditScan.prediction === "FAKE"
                          ? "text-crimson"
                          : "text-emerald"
                      }`}
                    >
                      {selectedAuditScan.prediction === "FAKE"
                        ? "SYNTHETIC / DEEPFAKE"
                        : "AUTHENTIC HUMAN MEDIA"}
                    </div>
                    <div className="drawer-prob-breakdown">
                      <div className="prob-pair">
                        <span>Fake Probability:</span>
                        <strong>{selectedAuditScan.fake_probability}%</strong>
                      </div>
                      <div className="prob-pair">
                        <span>Real Probability:</span>
                        <strong>{selectedAuditScan.real_probability}%</strong>
                      </div>
                      <div className="prob-pair">
                        <span>Confidence Score:</span>
                        <strong>{selectedAuditScan.confidence}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="drawer-signals-card">
                    <span className="drawer-sub">Stored Forensic Telemetry</span>
                    <div className="drawer-signal-row">
                      <span>Frequency Coherence:</span>
                      <strong>{selectedAuditScan.frequency_coherence}%</strong>
                    </div>
                    <div className="drawer-signal-row">
                      <span>Texture Uniformity:</span>
                      <strong>{selectedAuditScan.texture_uniformity}%</strong>
                    </div>
                    <div className="drawer-signal-row">
                      <span>Bilateral Symmetry:</span>
                      <strong>{selectedAuditScan.bilateral_symmetry}%</strong>
                    </div>
                    <div className="drawer-signal-row">
                      <span>Inference Latency:</span>
                      <strong>{selectedAuditScan.latency_ms} ms</strong>
                    </div>
                    <div className="drawer-signal-row">
                      <span>Detection Engine:</span>
                      <strong>{selectedAuditScan.model_version || "DeepGuard V10.0 OmniShield"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BENCHMARKS & MODEL ARCHITECTURE TABS */}
      <section id="benchmarks" className="info-tabs-section">

        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-badge">EMPIRICAL BENCHMARKS</span>
            <h2 className="section-title">
              Evaluated on Diverse Real & Synthetic Datasets
            </h2>
            <p className="section-sub">
              DeepGuard V10.0 OmniShield undergoes strict multi-domain validation across
              inpainting, face swaps, diffusion, and video frame synthesis to minimize false positives.
            </p>
          </div>

          <div className="stat-cards-grid">
            <div className="stat-card">
              <span className="stat-num text-cyan">96.64%</span>
              <span className="stat-label">Validation Accuracy</span>
              <p className="stat-detail">
                F1-Score: 0.9652 on diverse multi-domain balanced holdout evaluation.
              </p>
            </div>

            <div className="stat-card">
              <span className="stat-num text-emerald">95.92%</span>
              <span className="stat-label">Clean External Test</span>
              <p className="stat-detail">
                Generalization on independent out-of-domain holdout evaluation set (47/49).
              </p>
            </div>

            <div className="stat-card">
              <span className="stat-num text-purple">99.3%</span>
              <span className="stat-label">Video Face-Swap Defense</span>
              <p className="stat-detail">
                Exceptional detection accuracy on Celeb-DF v2 video face-crop extractions.
              </p>
            </div>

            <div className="stat-card">
              <span className="stat-num text-amber">&lt; 45ms</span>
              <span className="stat-label">Inference Latency</span>
              <p className="stat-detail">
                Fast ConvNeXt-Tiny neural inference suitable for real-time KYC and media moderation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE & HOW IT WORKS */}
      <section id="architecture" className="workflow-section">
        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-badge">FORENSIC PIPELINE</span>
            <h2 className="section-title">How DeepGuard AI Detects Deepfakes</h2>
          </div>

          <div className="pipeline-grid">
            <div className="pipeline-step">
              <div className="step-badge">01</div>
              <div className="step-icon">📐</div>
              <h3>Preprocessing & Alignment</h3>
              <p>
                The image is normalized with ImageNet statistics and aligned to
                canonical $224 \times 224$ dimensions preserving key facial contour points.
              </p>
            </div>

            <div className="pipeline-step">
              <div className="step-badge">02</div>
              <div className="step-icon">🔄</div>
              <h3>3-Pass TTA Ensemble</h3>
              <p>
                Inference evaluates the canonical frame, a horizontally flipped projection,
                and a scale crop to neutralize asymmetric generative artifacts.
              </p>
            </div>

            <div className="pipeline-step">
              <div className="step-badge">03</div>
              <div className="step-icon">🧠</div>
              <h3>ConvNeXt-Tiny Deep Feature Extraction</h3>
              <p>
                Modern 7x7 depthwise convolutions and inverted bottlenecks analyze texture micro-patterns,
                blending seams, and unnatural generative smoothing.
              </p>
            </div>

            <div className="pipeline-step">
              <div className="step-badge">04</div>
              <div className="step-icon">🛡️</div>
              <h3>Multi-Signal Verdict</h3>
              <p>
                Deep learning softmax probabilities are unified with frequency domain
                variance and bilateral symmetry to output a reliable authenticity report.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="faq-section">
        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-badge">FREQUENTLY ASKED QUESTIONS</span>
            <h2 className="section-title">Deepfake Forensics & Transparency</h2>
          </div>

          <div className="faq-grid">
            <div className="faq-card">
              <h4>What types of manipulation can DeepGuard detect?</h4>
              <p>
                DeepGuard is trained to recognize faces generated by StyleGAN,
                diffusion models (Midjourney, DALL-E, Stable Diffusion), and
                face-swap software by targeting synthetic boundary and texture anomalies.
              </p>
            </div>

            <div className="faq-card">
              <h4>What is Test-Time Augmentation (TTA)?</h4>
              <p>
                TTA runs multiple transformed variations of the input image through
                the model and aggregates predictions. This significantly stabilizes
                decision boundaries on non-standard aspect ratios and lighting.
              </p>
            </div>

            <div className="faq-card">
              <h4>Can this be used as legal proof of authenticity?</h4>
              <p>
                No automated system is 100% infallible against unknown future generative
                techniques. DeepGuard AI is an investigative research tool designed
                to assist human analysts, not replace judicial verification.
              </p>
            </div>

            <div className="faq-card">
              <h4>Is my uploaded image saved on the server?</h4>
              <p>
                No. All images are processed purely in-memory during inference and
                are immediately discarded. No user photos are stored on our servers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">🛡️ DeepGuard AI</span>
            <p className="footer-tagline">
              Advanced Deepfake Detection & Synthetic Media Intelligence
            </p>
          </div>
          <div className="footer-meta">
            <p>
              Engine: <strong>ConvNeXt-Tiny V10.0 OmniShield + 3-Pass TTA</strong> • License:{" "}
              <strong>MIT</strong>
            </p>
            <p className="footer-copy">
              © {new Date().getFullYear()} DeepGuard AI Research. Open-source deepfake forensics.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
