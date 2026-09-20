import { Sparkles, ShieldCheck, Zap, Lock } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-badge">
          <Sparkles size={13} className="hero-badge-icon" />
          <span>ConvNeXt-Tiny V10.0 • 3-Pass Test-Time Augmentation</span>
        </div>

        <h1 className="hero-title">
          Neural Media Forensics &<br />
          <span className="hero-title-gradient">Deepfake Verification</span>
        </h1>

        <p className="hero-subtitle">
          Detect face swaps, diffusion artifacts, and AI-generated synthesis with
          audited confidence scores, multi-signal edge residual analysis, and
          multi-face localization.
        </p>

        <div className="hero-highlights">
          <div className="highlight-item">
            <ShieldCheck size={16} className="highlight-icon text-emerald" />
            <span>96.6% Holdout Accuracy</span>
          </div>
          <div className="highlight-item">
            <Zap size={16} className="highlight-icon text-cyan" />
            <span>&lt; 45ms Latency</span>
          </div>
          <div className="highlight-item">
            <Lock size={16} className="highlight-icon text-muted" />
            <span>Pure In-Memory Processing</span>
          </div>
        </div>
      </div>
    </section>
  );
}
