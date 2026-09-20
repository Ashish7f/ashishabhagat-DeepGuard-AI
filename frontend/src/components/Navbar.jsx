import { Shield, Database, Activity, RefreshCw, Flame } from "lucide-react";

export default function Navbar({
  backendStatus,
  apiBaseUrl,
  setApiBaseUrl,
  dbInfo,
  dbStats,
  onPing,
  onOpenFirebaseModal
}) {
  const isFirebase = dbInfo.engine === "FIREBASE";

  return (
    <header className="navbar">
      <div className="nav-brand">
        <a href="#detector" className="brand-link">
          <div className="brand-logo-mark">
            <Shield className="brand-shield-icon" size={20} />
            <span className="brand-logo-glow" />
          </div>
          <div className="brand-titles">
            <span className="brand-name">DeepGuard <span className="brand-name-light">AI</span></span>
            <span className="brand-version-badge">V10 OmniShield</span>
          </div>
        </a>
      </div>

      <div className="nav-center">
        {/* Engine Telemetry */}
        <div className="status-pill" title={`Active API: ${apiBaseUrl}`}>
          <span
            className={`status-indicator-dot ${
              backendStatus.state === "online"
                ? "online"
                : backendStatus.state === "checking"
                ? "checking"
                : "offline"
            }`}
          />
          <span className="status-pill-text">
            {backendStatus.state === "online"
              ? "Engine Active"
              : backendStatus.state === "checking"
              ? "Connecting..."
              : "Engine Offline"}
          </span>
          {backendStatus.latency && (
            <span className="status-latency-badge">{backendStatus.latency}ms</span>
          )}
          <button
            type="button"
            className="status-refresh-btn"
            onClick={onPing}
            title="Ping API Server"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Database Telemetry / Firebase Switcher */}
        <button
          type="button"
          className={`status-pill db-pill ${isFirebase ? "pill-firebase" : ""}`}
          onClick={onOpenFirebaseModal}
          title={isFirebase ? "Connected to Google Cloud Firestore (Click to manage)" : "Active: Local SQLite (Click to connect Firebase Firestore)"}
        >
          {isFirebase ? (
            <Flame size={13} className="pill-icon text-amber" />
          ) : (
            <Database size={13} className="pill-icon text-muted" />
          )}
          <span className="status-pill-text">
            {isFirebase ? "DB: FIREBASE" : `DB: ${dbInfo.engine}`}
          </span>
          <span className={`status-count-badge ${isFirebase ? "badge-firebase-live" : ""}`}>
            {isFirebase ? "Live Sync" : `${dbStats.total_scans} logs`}
          </span>
        </button>
      </div>

      <nav className="nav-actions">
        <div className="nav-links">
          <a href="#detector" className="nav-item">Studio</a>
          <a href="#audit-log" className="nav-item">
            Audit Log
            {dbStats.total_scans > 0 && (
              <span className="nav-counter">{dbStats.total_scans}</span>
            )}
          </a>
          <a href="#benchmarks" className="nav-item">Benchmarks</a>
          <a href="#architecture" className="nav-item">Pipeline</a>
          <a href="#faq" className="nav-item">FAQ</a>
        </div>

        {/* Environment toggle */}
        <div className="env-selector">
          <button
            type="button"
            className={`env-btn ${apiBaseUrl === "/api" || apiBaseUrl.includes("onrender.com") ? "active" : ""}`}
            onClick={() => setApiBaseUrl("/api")}
            title="Render Cloud Production Inference"
          >
            Cloud
          </button>
          <button
            type="button"
            className={`env-btn ${apiBaseUrl.includes("localhost") ? "active" : ""}`}
            onClick={() => setApiBaseUrl("http://localhost:10000")}
            title="Localhost Port 10000"
          >
            Local
          </button>
        </div>

        <a
          href="https://github.com/Ashish7f/ashishabhagat-DeepGuard-AI"
          target="_blank"
          rel="noreferrer"
          className="btn-github"
          aria-label="View Source on GitHub"
        >
          <svg height="15" width="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>GitHub</span>
        </a>
      </nav>
    </header>
  );
}
