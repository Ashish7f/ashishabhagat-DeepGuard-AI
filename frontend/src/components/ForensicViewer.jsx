import { useState } from "react";
import {
  Maximize2,
  Sliders,
  Layers,
  Sparkles,
  Zap,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileImage,
  Loader2
} from "lucide-react";

export default function ForensicViewer({
  image,
  file,
  result,
  loading,
  loadingStep,
  viewMode,
  setViewMode,
  onAnalyze,
  onReset
}) {
  const [isZoomed, setIsZoomed] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="viewer-container">
      {/* VIEWER HEADER TOOLBAR */}
      <div className="viewer-toolbar">
        <div className="viewer-file-meta">
          <FileImage size={15} className="text-muted" />
          <span className="file-meta-name">{file?.name || "Target Image"}</span>
          {file?.size && (
            <span className="file-meta-size">{formatFileSize(file.size)}</span>
          )}
          {result?.faces_detected > 0 && (
            <span className="file-meta-faces">
              {result.faces_detected} {result.faces_detected === 1 ? "face localized" : "faces localized"}
            </span>
          )}
        </div>

        {result && (
          <div className="viewer-mode-selector">
            <button
              type="button"
              className={`mode-btn ${viewMode === "normal" ? "active" : ""}`}
              onClick={() => setViewMode("normal")}
            >
              Standard
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === "forensic" ? "active" : ""}`}
              onClick={() => setViewMode("forensic")}
              title="High-Pass Frequency Filter"
            >
              Edge Filter
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === "thermal" ? "active" : ""}`}
              onClick={() => setViewMode("thermal")}
              title="Thermal Disparity Visualizer"
            >
              Thermal ELA
            </button>
          </div>
        )}
      </div>

      {/* MEDIA STAGE */}
      <div className={`media-viewport ${isZoomed ? "zoomed" : ""}`}>
        <div className="media-canvas">
          <img
            src={image}
            alt="Subject Inspection"
            className={`media-image filter-${viewMode}`}
          />

          {/* DETECTED FACE BOUNDING BOXES */}
          {result?.face_details && result.face_details.map((face) => (
            <div
              key={face.face_id}
              className={`face-box ${face.prediction === "FAKE" ? "box-fake" : "box-real"}`}
              style={{
                left: `${face.normalized_box.x}%`,
                top: `${face.normalized_box.y}%`,
                width: `${face.normalized_box.width}%`,
                height: `${face.normalized_box.height}%`
              }}
            >
              <div className="box-tag">
                <span className="box-indicator" />
                <span>{face.prediction === "FAKE" ? "Synthetic" : "Authentic"}</span>
                <span className="box-conf">{face.confidence}%</span>
              </div>
            </div>
          ))}

          {/* ELEGANT SCANNING OVERLAY */}
          {loading && (
            <div className="scan-progress-curtain">
              <div className="scan-shimmer-sweep" />
              <div className="scan-stepper-card">
                <Loader2 size={24} className="spinner-icon text-accent" />
                <div className="stepper-details">
                  <span className="stepper-title">Neural Forensic Inference</span>
                  <span className="stepper-desc">
                    {loadingStep === 1 && "Preprocessing canonical tensor & multi-scale projections..."}
                    {loadingStep === 2 && "Executing ConvNeXt-Tiny V10.0 OmniShield 3-Pass TTA..."}
                    {loadingStep === 3 && "Evaluating frequency edge variance & bilateral symmetry..."}
                    {loadingStep === 4 && "Connecting to inference container..."}
                    {loadingStep === 0 && "Initializing neural forensic engine..."}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="viewer-zoom-toggle"
          onClick={() => setIsZoomed((prev) => !prev)}
          title={isZoomed ? "Fit to frame" : "100% View"}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* PRE-ANALYSIS ACTIONS */}
      {!result && !loading && (
        <div className="viewer-bottom-actions">
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={onAnalyze}
          >
            <Zap size={18} />
            <span>Run Forensic Analysis</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onReset}
          >
            <RotateCcw size={16} />
            <span>Choose Different Image</span>
          </button>
        </div>
      )}
    </div>
  );
}
