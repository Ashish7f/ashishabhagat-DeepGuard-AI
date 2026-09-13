import { useState } from "react";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Image size must be smaller than 10 MB.");
      return;
    }

    setFile(selectedFile);
    setImage(URL.createObjectURL(selectedFile));
    setResult(null);
    setError("");
  };

  const handleImageChange = (event) => {
    processFile(event.target.files[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    processFile(event.dataTransfer.files[0]);
  };
  const formatFileSize = (bytes) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

  const analyzeImage = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const apiBaseUrl = import.meta.env.VITE_API_URL || "https://ashishabhagat-deepguard-ai.onrender.com";

    try {
      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prediction failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        "Could not connect to the AI backend. Make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setImage(null);
    setResult(null);
    setError("");
  };

  const fakeProbability = result
    ? Number(result.fake_probability)
    : 0;

  const realProbability = result
    ? Number(result.real_probability)
    : 0;

  const isFake = result?.prediction === "FAKE";

  return (
    <div className="app">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo">
          🛡️ DeepGuard AI
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>
        </div>
      </nav>

      {/* HERO */}
      <main id="home" className="hero">
        <div className="hero-content">

          <div className="badge">
            AI-POWERED DEEPFAKE DETECTION
          </div>

          <h1>
            Detect AI-generated
            <br />
            <span>faces with AI.</span>
          </h1>

          <p className="description">
            Upload an image and let our deep learning model analyze
            whether the face is real or artificially generated.
          </p>

          {/* UPLOAD CARD */}
          <div
  className="upload-card"
  onDragOver={(event) => {
    event.preventDefault();
    event.currentTarget.classList.add("drag-active");
  }}
  onDragLeave={(event) => {
    event.currentTarget.classList.remove("drag-active");
  }}
  onDrop={(event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-active");
    handleDrop(event);
  }}
>

            {/* INITIAL UPLOAD */}
            {!image && (
              <>
                <div className="upload-icon">↑</div>

                <h2>Upload an image</h2>

                <p>
                  Drag & drop an image here or choose a file
                </p>

                <label className="upload-button">
                  Choose Image

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageChange}
                  />
                </label>

                <small>
                  JPG, JPEG, PNG • Maximum 10 MB
                </small>
              </>
            )}

            {/* IMAGE SELECTED */}
            {image && !result && !loading && (
              <>
                <img
                  src={image}
                  alt="Selected"
                  className="preview-image"
                />

                <div className="file-info">
  <strong>{file?.name}</strong>

  <span>
    {file ? formatFileSize(file.size) : ""}
  </span>
</div>

<p className="selected-text">
  Image ready for analysis
</p>

                <button
                  className="analyze-button"
                  onClick={analyzeImage}
                >
                  Analyze Image
                </button>

                <button
                  className="remove-button"
                  onClick={resetAnalysis}
                >
                  Choose Another Image
                </button>
              </>
            )}

            {/* LOADING */}
            {loading && (
              <>
                <img
                  src={image}
                  alt="Analyzing"
                  className="preview-image"
                />

                <div className="loading-container">

                  <div className="loader"></div>

                  <p className="loading-text">
                    DeepGuard AI is analyzing the image...
                  </p>

                  <small>
                    Running deep learning inference
                  </small>

                </div>
              </>
            )}

            {/* RESULT */}
            {result && (
              <>
                <img
                  src={image}
                  alt="Analyzed"
                  className="preview-image"
                />

                <div className="analysis-complete">
                  ● ANALYSIS COMPLETE
                </div>

                <div
                  className={
                    isFake
                      ? "result-box result-fake"
                      : "result-box result-real"
                  }
                >

                  <div
                    className={
                      isFake
                        ? "result-label fake"
                        : "result-label real"
                    }
                  >
                    {isFake
                      ? "⚠️ FAKE IMAGE"
                      : "✓ REAL IMAGE"}
                  </div>

                  <div className="confidence">
                    {result.confidence}%
                  </div>

                  <div className="confidence-label">
                    Model Confidence
                  </div>

                  {/* PROBABILITIES */}
                  <div className="probability-section">

                    <div className="probability-header">
                      <span>Fake</span>

                      <strong>
                        {result.fake_probability}%
                      </strong>
                    </div>

                    <div className="probability-bar">
                      <div
                        className="fake-bar"
                        style={{
                          width: `${fakeProbability}%`,
                        }}
                      ></div>
                    </div>

                    <div className="probability-header">
                      <span>Real</span>

                      <strong>
                        {result.real_probability}%
                      </strong>
                    </div>

                    <div className="probability-bar">
                      <div
                        className="real-bar"
                        style={{
                          width: `${realProbability}%`,
                        }}
                      ></div>
                    </div>

                  </div>

                  <div className="result-note">
  {isFake
    ? "The model detected patterns associated with an AI-generated image."
    : "The model detected patterns more consistent with a real image."}
</div>

<div className="model-details">

  <div className="model-detail">
    <span>MODEL</span>
    <strong>ResNet18</strong>
  </div>
<div className="interpretation-panel">

  <div className="interpretation-title">
    <span>AI INTERPRETATION</span>
  </div>

  <div className="interpretation-content">

    <div className="interpretation-icon">
      {isFake ? "⚠️" : "✓"}
    </div>

    <div>
      <h3>
        {isFake
          ? "Patterns associated with synthetic imagery"
          : "Patterns more consistent with real imagery"}
      </h3>

      <p>
        {isFake
          ? `The model assigned a ${result.fake_probability}% probability to the fake class and a ${result.real_probability}% probability to the real class.`
          : `The model assigned a ${result.real_probability}% probability to the real class and a ${result.fake_probability}% probability to the fake class.`}
      </p>
    </div>

  </div>

  <div className="research-disclaimer">
    <strong>Research note:</strong>
    This prediction represents the output of the trained model.
    It should not be considered definitive proof of authenticity
    or manipulation.
  </div>

</div>
  <div className="model-detail">
    <span>TASK</span>
    <strong>Binary Classification</strong>
  </div>

  <div className="model-detail">
    <span>INPUT</span>
    <strong>Face Image</strong>
  </div>

  <div className="model-detail">
    <span>STATUS</span>
    <strong className="status-ready">● Ready</strong>
  </div>

</div>

                </div>

                <button
                  className="analyze-button"
                  onClick={resetAnalysis}
                >
                  Analyze Another Image
                </button>
              </>
            )}

            {/* ERROR */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

          </div>

          {/* PROJECT STATS */}
          <div className="stats">

            <div>
              <strong>ResNet18</strong>
              <span>Deep Learning Architecture</span>
            </div>

            <div>
              <strong>Image AI</strong>
              <span>Real vs Fake Classification</span>
            </div>

            <div>
              <strong>V8</strong>
              <span>Current Detector Version</span>
            </div>

          </div>

        </div>
      </main>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="info-section"
      >

        <div className="section-heading">

          <div className="section-badge">
            HOW IT WORKS
          </div>

          <h2>
            From image to
            <span> prediction.</span>
          </h2>

          <p>
            DeepGuard processes an uploaded face image through a
            trained deep learning pipeline before producing a
            real or fake prediction.
          </p>

        </div>

        <div className="steps">

          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">↑</div>

            <h3>Upload</h3>

            <p>
              Select a JPG or PNG image containing a face
              for analysis.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">◈</div>

            <h3>Preprocess</h3>

            <p>
              The image is prepared and transformed into the
              format required by the model.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">◎</div>

            <h3>Analyze</h3>

            <p>
              ResNet18 extracts visual features and evaluates
              patterns in the image.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">04</div>
            <div className="step-icon">✓</div>

            <h3>Predict</h3>

            <p>
              The system returns probabilities for real and
              AI-generated classifications.
            </p>
          </div>

        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        className="about-section"
      >

        <div className="about-content">

          <div>

            <div className="section-badge">
              ABOUT THE PROJECT
            </div>

            <h2>
              Built to study
              <span> synthetic faces.</span>
            </h2>

          </div>

          <div className="about-text">

            <p>
              DeepGuard AI is a research-oriented deepfake
              detection project designed to investigate whether
              deep learning can distinguish real human faces
              from AI-generated faces.
            </p>

            <p>
              The current system uses a ResNet18-based image
              classification model and produces both a predicted
              class and probability estimates.
            </p>

            <p className="important-note">
              <strong>Research note:</strong> Predictions are
              model outputs and should not be treated as definitive
              proof that an image is authentic or manipulated.
            </p>

          </div>

        </div>

        {/* TECHNOLOGY */}
        <div className="technology-grid">

          <div className="technology-card">
            <span>MODEL</span>
            <strong>ResNet18</strong>
          </div>

          <div className="technology-card">
            <span>TASK</span>
            <strong>Binary Classification</strong>
          </div>

          <div className="technology-card">
            <span>INPUT</span>
            <strong>Face Images</strong>
          </div>

          <div className="technology-card">
            <span>OUTPUT</span>
            <strong>Real / Fake</strong>
          </div>

        </div>

      </section>

      {/* FOOTER */}
      <footer>
        <p>
          DeepGuard AI • Research Project • Deepfake Detection
        </p>
      </footer>

    </div>
  );
}

export default App;
