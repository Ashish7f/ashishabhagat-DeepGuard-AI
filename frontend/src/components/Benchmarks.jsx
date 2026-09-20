import {
  BarChart3,
  ShieldCheck,
  Video,
  Zap,
  Layers,
  Crop,
  Cpu,
  CheckCircle2
} from "lucide-react";

export default function Benchmarks() {
  return (
    <section id="benchmarks" className="benchmarks-section">
      <div className="section-container">
        <div className="section-header">
          <span className="section-kicker">EMPIRICAL BENCHMARKS</span>
          <h2 className="section-title">Validated on Independent Holdout Datasets</h2>
          <p className="section-subtitle">
            DeepGuard V10.0 OmniShield undergoes rigorous multi-domain cross-validation
            across inpainting, face swaps, diffusion, and video frame synthesis.
          </p>
        </div>

        {/* BENTO BENCHMARK TILES */}
        <div className="bento-grid">
          <div className="bento-card card-accent-cyan">
            <div className="bento-top">
              <span className="bento-metric text-cyan">96.64%</span>
              <BarChart3 size={18} className="text-cyan" />
            </div>
            <h3 className="bento-title">Validation Accuracy</h3>
            <p className="bento-desc">
              Balanced F1-Score of 0.9652 on multi-domain holdout evaluation set comprising GAN, diffusion, and authentic portraits.
            </p>
          </div>

          <div className="bento-card card-accent-emerald">
            <div className="bento-top">
              <span className="bento-metric text-emerald">95.92%</span>
              <ShieldCheck size={18} className="text-emerald" />
            </div>
            <h3 className="bento-title">Out-of-Domain Generalization</h3>
            <p className="bento-desc">
              Strong generalization on independent external benchmark images (47/49 correct) without retraining or calibration.
            </p>
          </div>

          <div className="bento-card">
            <div className="bento-top">
              <span className="bento-metric text-purple">99.3%</span>
              <Video size={18} className="text-muted" />
            </div>
            <h3 className="bento-title">Video Face-Swap Defense</h3>
            <p className="bento-desc">
              Defends against temporal blending and deepfake seams on Celeb-DF v2 extracted face frames.
            </p>
          </div>

          <div className="bento-card">
            <div className="bento-top">
              <span className="bento-metric text-primary">&lt; 45ms</span>
              <Zap size={18} className="text-muted" />
            </div>
            <h3 className="bento-title">Inference Latency</h3>
            <p className="bento-desc">
              Optimized ConvNeXt-Tiny weights execute rapidly on standard CPU and GPU hardware for real-time KYC workflows.
            </p>
          </div>
        </div>

        {/* PIPELINE ARCHITECTURE */}
        <div id="architecture" className="pipeline-wrapper">
          <div className="pipeline-header">
            <span className="section-kicker">NEURAL PIPELINE</span>
            <h3 className="pipeline-heading">End-to-End Forensic Architecture</h3>
          </div>

          <div className="pipeline-steps">
            <div className="pipeline-step-card">
              <div className="step-count">01</div>
              <Crop size={18} className="step-icon text-cyan" />
              <h4 className="step-title">Preprocessing & Canonical Alignment</h4>
              <p className="step-desc">
                Input images are normalized with ImageNet statistics and aligned to canonical 224×224 tensors preserving micro-texture boundaries.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-count">02</div>
              <Layers size={18} className="step-icon text-accent" />
              <h4 className="step-title">3-Pass Test-Time Augmentation</h4>
              <p className="step-desc">
                Inference evaluates canonical frame, horizontal flip, and scale crops to neutralize asymmetric generative artifacts.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-count">03</div>
              <Cpu size={18} className="step-icon text-emerald" />
              <h4 className="step-title">ConvNeXt-Tiny Deep Feature Extraction</h4>
              <p className="step-desc">
                Modern 7×7 depthwise convolutions and inverted bottlenecks analyze high-frequency residuals, boundary seams, and generative smoothing.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-count">04</div>
              <CheckCircle2 size={18} className="step-icon text-cyan" />
              <h4 className="step-title">Multi-Signal Decision Integration</h4>
              <p className="step-desc">
                Softmax classification probabilities are consolidated with bilateral symmetry and frequency variance to produce an audited verdict.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
