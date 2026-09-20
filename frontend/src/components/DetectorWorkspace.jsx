import { useRef, useState } from "react";
import {
  UploadCloud,
  Camera,
  Globe,
  Clipboard,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Image as ImageIcon,
  ArrowRight
} from "lucide-react";

export default function DetectorWorkspace({
  inputTab,
  setInputTab,
  onFileSelected,
  onClipboardPaste,
  startWebcam,
  stopWebcam,
  isCameraStreaming,
  cameraError,
  videoRef,
  canvasRef,
  snapWebcamPhoto,
  urlInput,
  setUrlInput,
  urlLoading,
  onUrlSubmit,
  samples,
  onLoadSample,
  cloudFileNoticeOpen,
  setCloudFileNoticeOpen
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="detector-card">
      {/* INPUT MODE SEGMENTED CONTROL */}
      <div className="tab-control-bar">
        <div className="segmented-tabs">
          <button
            type="button"
            className={`tab-btn ${inputTab === "file" ? "active" : ""}`}
            onClick={() => {
              stopWebcam();
              setInputTab("file");
            }}
          >
            <UploadCloud size={16} />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${inputTab === "camera" ? "active" : ""}`}
            onClick={() => {
              setInputTab("camera");
              startWebcam();
            }}
          >
            <Camera size={16} />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${inputTab === "url" ? "active" : ""}`}
            onClick={() => {
              stopWebcam();
              setInputTab("url");
            }}
          >
            <Globe size={16} />
            <span>Web URL</span>
          </button>
          <button
            type="button"
            className="tab-btn"
            onClick={onClipboardPaste}
            title="Paste image directly from clipboard (Ctrl+V)"
          >
            <Clipboard size={16} />
            <span>Paste Clipboard</span>
          </button>
        </div>

        <button
          type="button"
          className={`tab-helper-link ${cloudFileNoticeOpen ? "active" : ""}`}
          onClick={() => setCloudFileNoticeOpen((prev) => !prev)}
          title="Resolve Windows OneDrive 0x8007016A error"
        >
          <HelpCircle size={14} />
          <span>OneDrive Help</span>
        </button>
      </div>

      {/* PANEL 1: FILE UPLOAD / DRAG & DROP */}
      {inputTab === "file" && (
        <div className="upload-container">
          <div
            className={`dropzone ${isDragOver ? "drag-active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.jfif,.avif"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
              aria-label="Upload face photo for deepfake inspection"
            />

            <div className="dropzone-icon-box">
              <UploadCloud size={32} className="dropzone-icon" />
            </div>

            <div className="dropzone-text">
              <h3 className="dropzone-heading">
                Drop your photo here, or <span className="text-accent">browse</span>
              </h3>
              <p className="dropzone-sub">
                Supports JPG, PNG, WEBP, and AVIF up to 25 MB • Auto-analyzes on drop
              </p>
            </div>

            <div className="dropzone-footer">
              <button
                type="button"
                className="btn-select-file"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose File
              </button>
              <span className="dropzone-kbd-hint">
                <kbd>Ctrl</kbd> + <kbd>V</kbd> to paste from clipboard
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 2: LIVE WEBCAM SCANNER */}
      {inputTab === "camera" && (
        <div className="camera-panel">
          <div className="camera-viewport">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div className="camera-overlay">
              <div className="camera-face-guide" />
              <div className="camera-status-tag">
                <span className="camera-ping-dot" /> Live Biometric Feed
              </div>
            </div>
          </div>

          {cameraError ? (
            <div className="camera-error">
              <AlertCircle size={18} className="text-crimson" />
              <span>{cameraError}</span>
              <div className="camera-error-buttons">
                <button type="button" className="btn-secondary btn-sm" onClick={startWebcam}>
                  Retry Camera
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setInputTab("file")}>
                  Use File Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="camera-controls">
              <button
                type="button"
                className="btn-primary camera-capture-btn"
                onClick={snapWebcamPhoto}
              >
                <Camera size={16} />
                <span>Capture & Analyze</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  stopWebcam();
                  setInputTab("file");
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* PANEL 3: WEB IMAGE URL */}
      {inputTab === "url" && (
        <div className="url-panel">
          <div className="url-panel-header">
            <Globe size={20} className="text-accent" />
            <div>
              <h4 className="url-panel-title">Analyze Web Image via Remote URL</h4>
              <p className="url-panel-desc">
                Paste any publicly accessible image link. The system fetches and evaluates the image directly.
              </p>
            </div>
          </div>

          <form className="url-input-form" onSubmit={onUrlSubmit}>
            <div className="url-field-wrap">
              <input
                type="url"
                className="url-input-field"
                placeholder="https://example.com/suspect-portrait.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
              />
              {urlInput && (
                <button
                  type="button"
                  className="url-clear-btn"
                  onClick={() => setUrlInput("")}
                  title="Clear input"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading ? "Fetching & Analyzing..." : "Inspect Remote Image"}
            </button>
          </form>

          <div className="url-quick-suggestions">
            <span className="suggestions-label">Try test URLs:</span>
            <button
              type="button"
              className="suggestion-chip"
              onClick={() => setUrlInput("https://raw.githubusercontent.com/Ashish7f/ashishabhagat-DeepGuard-AI/main/frontend/public/samples/deepfake-synth.jpg")}
            >
              Face-Swap Deepfake
            </button>
            <button
              type="button"
              className="suggestion-chip"
              onClick={() => setUrlInput("https://raw.githubusercontent.com/Ashish7f/ashishabhagat-DeepGuard-AI/main/frontend/public/samples/real-portrait.jpg")}
            >
              Authentic Portrait
            </button>
            <button
              type="button"
              className="suggestion-chip"
              onClick={() => setUrlInput("https://raw.githubusercontent.com/Ashish7f/ashishabhagat-DeepGuard-AI/main/frontend/public/samples/ai-generated.jpg")}
            >
              Diffusion Face
            </button>
          </div>
        </div>
      )}

      {/* ONEDRIVE TROUBLESHOOTING DRAWER */}
      {cloudFileNoticeOpen && (
        <div className="onedrive-advisory">
          <div className="advisory-header">
            <div className="advisory-title-wrap">
              <AlertCircle size={16} className="text-warning" />
              <span className="advisory-title">Windows OneDrive 0x8007016A Fix</span>
            </div>
            <button
              type="button"
              className="advisory-close"
              onClick={() => setCloudFileNoticeOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="advisory-body">
            If Windows displays <em>"The cloud file provider is not running"</em>, your selected file is stored on OneDrive without a local offline copy.
          </p>
          <div className="advisory-steps">
            <div className="advisory-step">
              <span className="step-num">1</span>
              <span>Right-click the photo in Windows Explorer and select <strong>"Always keep on this device"</strong>.</span>
            </div>
            <div className="advisory-step">
              <span className="step-num">2</span>
              <span>Or drag & drop the photo directly into this window, or press <strong>Ctrl + V</strong> to paste.</span>
            </div>
            <div className="advisory-step">
              <span className="step-num">3</span>
              <span>Or click one of the instant 1-click test photos below.</span>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK TEST SAMPLES GALLERY */}
      <div className="samples-section">
        <div className="samples-header">
          <div className="samples-title-group">
            <ImageIcon size={15} className="text-muted" />
            <span className="samples-title">1-Click Test Library</span>
            <span className="samples-badge">Instant Evaluation</span>
          </div>
          <span className="samples-hint">Click any photo to run full forensic verification</span>
        </div>

        <div className="samples-grid">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="sample-card"
              onClick={() => onLoadSample(sample)}
              title={`Test ${sample.label} (${sample.type})`}
            >
              <div className="sample-thumb-wrap">
                <img
                  src={sample.path}
                  alt={sample.label}
                  className="sample-thumb"
                  loading="lazy"
                />
                <span
                  className={`sample-tag ${
                    sample.expected === "FAKE" ? "tag-fake" : "tag-real"
                  }`}
                >
                  {sample.expected === "FAKE" ? "Synthetic" : "Authentic"}
                </span>
              </div>
              <div className="sample-info">
                <span className="sample-name">{sample.label}</span>
                <span className="sample-type">{sample.type}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
