import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  RotateCcw,
  Cpu,
  Layers,
  Activity,
  Users,
  Database
} from "lucide-react";

export default function VerdictCard({
  result,
  dbInfo,
  onReset,
  onCopySummary,
  copySuccess,
  onDownloadReport
}) {
  const isFake = result.prediction === "FAKE";
  const confidenceVal = Number(result.confidence) || 0;
  const fakeProb = Number(result.fake_probability) || 0;
  const realProb = Number(result.real_probability) || 0;

  // SVG Radial Gauge Calculations
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidenceVal / 100) * circumference;

  return (
    <div className={`verdict-card ${isFake ? "card-fake" : "card-real"}`}>
      {/* VERDICT HERO BANNER */}
      <div className="verdict-banner">
        <div className="verdict-status-icon">
          {isFake ? (
            <AlertTriangle size={28} className="icon-fake" />
          ) : (
            <CheckCircle2 size={28} className="icon-real" />
          )}
        </div>
        <div className="verdict-status-text">
          <span className="verdict-label">Forensic Determination</span>
          <h2 className="verdict-title">
            {isFake ? "Synthetic Media Detected" : "Authentic Human Media"}
          </h2>
          <p className="verdict-explanation">
            {isFake
              ? `The neural ensemble detected generative facial artifacts consistent with synthetic generation or identity manipulation (${result.fake_probability}% synthetic probability).`
              : `The image exhibits natural sensor noise, micro-textures, and optical illumination consistent with authentic photographic capture (${result.real_probability}% authentic probability).`}
          </p>
        </div>
      </div>

      {/* METRICS & RADIAL GAUGE */}
      <div className="verdict-metrics-grid">
        {/* Radial Dial */}
        <div className="radial-metric-panel">
          <div className="radial-gauge-wrap">
            <svg className="radial-svg" width="140" height="140" viewBox="0 0 140 140">
              <circle
                className="radial-track"
                cx="70"
                cy="70"
                r={radius}
                strokeWidth="10"
              />
              <circle
                className={`radial-fill ${isFake ? "stroke-fake" : "stroke-real"}`}
                cx="70"
                cy="70"
                r={radius}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="radial-inner">
              <span className="radial-value">{confidenceVal}%</span>
              <span className="radial-tag">Certainty</span>
            </div>
          </div>
          <span className="radial-caption">Decision Confidence (V10)</span>
        </div>

        {/* Probability Split Bar */}
        <div className="prob-distribution-panel">
          <h4 className="panel-subheading">Class Distribution</h4>

          <div className="prob-row">
            <div className="prob-labels">
              <span className="prob-label-name">Synthetic / Manipulated</span>
              <span className="prob-label-val">{fakeProb}%</span>
            </div>
            <div className="prob-track">
              <div className="prob-bar-fill fill-fake" style={{ width: `${fakeProb}%` }} />
            </div>
          </div>

          <div className="prob-row">
            <div className="prob-labels">
              <span className="prob-label-name">Authentic / Unaltered</span>
              <span className="prob-label-val">{realProb}%</span>
            </div>
            <div className="prob-track">
              <div className="prob-bar-fill fill-real" style={{ width: `${realProb}%` }} />
            </div>
          </div>

          <div className="telemetry-bar">
            <span className="telemetry-item">
              <Cpu size={12} className="text-muted" /> {result.device?.toUpperCase() || "CPU"}
            </span>
            <span className="telemetry-item">
              <Activity size={12} className="text-muted" /> {result.latency_ms || "28"} ms
            </span>
            <span className="telemetry-item">
              <Layers size={12} className="text-muted" /> 3-Pass TTA
            </span>
          </div>
        </div>
      </div>

      {/* SPLICING ANOMALY ALERT */}
      {result.splicing_detected && (
        <div className="splicing-warning-card">
          <AlertTriangle size={18} className="text-warning flex-shrink-0" />
          <div>
            <strong>Composite / Spliced Scenery Disparity Detected</strong>
            <p>
              High sensor noise disparity ({result.forensics?.scene_splicing_ratio}x)
              found across image quadrants, indicating spliced background scenery or inserted subjects.
            </p>
          </div>
        </div>
      )}

      {/* MULTI-SUBJECT LOCALIZATION */}
      {result.face_details && result.face_details.length > 0 && (
        <div className="subjects-section">
          <div className="subjects-header">
            <Users size={15} className="text-muted" />
            <span className="subjects-title">
              Biometric Localization ({result.faces_detected} {result.faces_detected === 1 ? "Subject" : "Subjects"})
            </span>
          </div>

          <div className="subjects-grid">
            {result.face_details.map((face) => (
              <div
                key={face.face_id}
                className={`subject-tile ${face.prediction === "FAKE" ? "tile-fake" : "tile-real"}`}
              >
                <div className="subject-tile-top">
                  <span className="subject-index">Subject #{face.face_id}</span>
                  <span className={`subject-badge ${face.prediction === "FAKE" ? "badge-fake" : "badge-real"}`}>
                    {face.prediction === "FAKE" ? "Synthetic" : "Authentic"}
                  </span>
                </div>
                <div className="subject-tile-metrics">
                  <div className="tile-metric">
                    <span>Confidence</span>
                    <strong>{face.confidence}%</strong>
                  </div>
                  <div className="tile-metric">
                    <span>Fake / Real</span>
                    <span>{face.fake_probability}% / {face.real_probability}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORENSIC SIGNALS MATRIX */}
      {result.forensics && (
        <div className="signals-matrix">
          <h4 className="signals-heading">Forensic Diagnostic Telemetry</h4>
          <div className="signals-grid">
            <div className="signal-card">
              <div className="signal-top">
                <span className="signal-name">Frequency Residual</span>
                <span className="signal-pct">{result.forensics.frequency_coherence}%</span>
              </div>
              <div className="signal-bar">
                <div className="signal-fill" style={{ width: `${result.forensics.frequency_coherence}%` }} />
              </div>
              <span className="signal-desc">High-frequency edge sharpness</span>
            </div>

            <div className="signal-card">
              <div className="signal-top">
                <span className="signal-name">Texture Uniformity</span>
                <span className="signal-pct">{result.forensics.texture_uniformity}%</span>
              </div>
              <div className="signal-bar">
                <div className="signal-fill" style={{ width: `${result.forensics.texture_uniformity}%` }} />
              </div>
              <span className="signal-desc">Generative surface smoothing</span>
            </div>

            <div className="signal-card">
              <div className="signal-top">
                <span className="signal-name">Bilateral Symmetry</span>
                <span className="signal-pct">{result.forensics.bilateral_symmetry}%</span>
              </div>
              <div className="signal-bar">
                <div className="signal-fill" style={{ width: `${result.forensics.bilateral_symmetry}%` }} />
              </div>
              <span className="signal-desc">Illumination balance & shading</span>
            </div>

            <div className="signal-card">
              <div className="signal-top">
                <span className="signal-name">ELA Compression Seam</span>
                <span className="signal-pct">{result.forensics.ela_disparity ?? 24}%</span>
              </div>
              <div className="signal-bar">
                <div
                  className={`signal-fill ${(result.forensics.ela_disparity ?? 24) > 45 ? "fill-fake" : ""}`}
                  style={{ width: `${Math.min(100, result.forensics.ela_disparity ?? 24)}%` }}
                />
              </div>
              <span className="signal-desc">Inpainting boundary disparity</span>
            </div>
          </div>
        </div>
      )}

      {/* DB AUDIT LOG NOTE */}
      {result.scan_id && (
        <div className="audit-persistence-tag">
          <Database size={13} className="text-muted" />
          <span>Logged to {dbInfo.engine} database as Record #{result.scan_id}</span>
          <a href="#audit-log" className="audit-jump-link">View in Audit Explorer ↓</a>
        </div>
      )}

      {/* ACTION BAR */}
      <div className="verdict-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onReset}
        >
          <RotateCcw size={16} />
          <span>Analyze Another Image</span>
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={onCopySummary}
        >
          {copySuccess ? (
            <>
              <Check size={16} className="text-emerald" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span>Copy Summary</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={onDownloadReport}
        >
          <Download size={16} />
          <span>Export JSON</span>
        </button>
      </div>
    </div>
  );
}
