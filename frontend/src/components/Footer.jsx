import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-brand-col">
          <div className="footer-brand">
            <Shield size={18} className="footer-shield" />
            <span className="footer-title">DeepGuard AI</span>
          </div>
          <p className="footer-desc">
            Open-source neural media integrity & synthetic face forensics.
          </p>
        </div>

        <div className="footer-meta-col">
          <span className="footer-meta-text">
            Engine: <strong>ConvNeXt-Tiny V10.0 OmniShield</strong> (3-Pass TTA)
          </span>
          <span className="footer-meta-text">
            License: <strong>MIT Open Source</strong>
          </span>
          <span className="footer-copyright">
            © {new Date().getFullYear()} DeepGuard AI Research.
          </span>
        </div>
      </div>
    </footer>
  );
}
