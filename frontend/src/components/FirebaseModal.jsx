import { useState, useEffect } from "react";
import {
  Flame,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  Trash2,
  Code2
} from "lucide-react";
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  isFirebaseActive
} from "../services/firebase";

export default function FirebaseModal({ isOpen, onClose, onConfigChanged }) {
  const [activeTab, setActiveTab] = useState("paste"); // "paste" | "fields"
  const [pasteText, setPasteText] = useState("");
  const [fields, setFields] = useState({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  });
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getFirebaseConfig();
      if (existing) {
        setFields(existing);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
      setStatusMsg({ type: "", text: "" });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseFirebaseSnippet = (text) => {
    try {
      // Try direct JSON parse
      return JSON.parse(text);
    } catch {
      // Parse JavaScript object literal (e.g. { apiKey: "...", projectId: "..." })
      const extracted = {};
      const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
      for (const k of keys) {
        const regex = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`, "i");
        const match = text.match(regex);
        if (match && match[1]) {
          extracted[k] = match[1];
        }
      }
      return extracted;
    }
  };

  const handleSavePaste = () => {
    setStatusMsg({ type: "", text: "" });
    if (!pasteText.trim()) {
      setStatusMsg({ type: "error", text: "Please paste your Firebase configuration code." });
      return;
    }

    const parsed = parseFirebaseSnippet(pasteText);
    if (!parsed.projectId || !parsed.apiKey) {
      setStatusMsg({
        type: "error",
        text: "Could not extract 'projectId' and 'apiKey'. Please check the pasted snippet."
      });
      return;
    }

    const saved = saveFirebaseConfig(parsed);
    if (saved) {
      setIsConnected(true);
      setFields(parsed);
      setStatusMsg({
        type: "success",
        text: `Successfully connected to Firebase project: ${parsed.projectId}`
      });
      onConfigChanged(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMsg({
        type: "error",
        text: "Failed to initialize Firebase with the provided configuration."
      });
    }
  };

  const handleSaveFields = (e) => {
    e.preventDefault();
    setStatusMsg({ type: "", text: "" });

    if (!fields.apiKey || !fields.projectId) {
      setStatusMsg({
        type: "error",
        text: "API Key and Project ID are required."
      });
      return;
    }

    const saved = saveFirebaseConfig(fields);
    if (saved) {
      setIsConnected(true);
      setStatusMsg({
        type: "success",
        text: `Connected to Firebase project: ${fields.projectId}`
      });
      onConfigChanged(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMsg({
        type: "error",
        text: "Could not connect to Firebase. Check your project credentials."
      });
    }
  };

  const handleDisconnect = () => {
    clearFirebaseConfig();
    setIsConnected(false);
    setFields({
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    });
    setPasteText("");
    setStatusMsg({
      type: "success",
      text: "Firebase disconnected. Reverted to backend SQLite database."
    });
    onConfigChanged(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-flame-icon">
              <Flame size={22} className="flame-svg text-amber" />
            </div>
            <div>
              <h3 className="modal-heading">Firebase Firestore Cloud Sync</h3>
              <span className="modal-subheading">
                {isConnected
                  ? "Connected • Real-time cloud synchronization active"
                  : "Connect Google Cloud Firestore for persistent cross-device audit logs"}
              </span>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* CONNECTION STATUS BANNER */}
        {isConnected && (
          <div className="firebase-status-banner connected">
            <CheckCircle2 size={16} className="text-emerald flex-shrink-0" />
            <div className="banner-text">
              <strong>Firebase Connected: {fields.projectId}</strong>
              <p>Forensic scans sync live to the <code>forensic_scans</code> Firestore collection.</p>
            </div>
            <button
              type="button"
              className="btn-disconnect"
              onClick={handleDisconnect}
              title="Disconnect Firebase and revert to SQLite"
            >
              <Trash2 size={13} />
              <span>Disconnect</span>
            </button>
          </div>
        )}

        {/* TABS */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === "paste" ? "active" : ""}`}
            onClick={() => setActiveTab("paste")}
          >
            <Code2 size={15} />
            <span>1-Click Paste Config</span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === "fields" ? "active" : ""}`}
            onClick={() => setActiveTab("fields")}
          >
            <Database size={15} />
            <span>Manual Input</span>
          </button>
        </div>

        {/* TAB 1: PASTE CONFIG */}
        {activeTab === "paste" && (
          <div className="modal-tab-body">
            <p className="tab-instructions">
              In the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="inline-link">Firebase Console <ExternalLink size={11} className="inline-icon" /></a>, open <strong>Project Settings → General → Your apps → SDK setup/configuration</strong>, copy the snippet, and paste it below:
            </p>

            <textarea
              className="config-textarea"
              rows={6}
              placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-project.firebaseapp.com",\n  projectId: "my-project",\n  storageBucket: "my-project.appspot.com",\n  messagingSenderId: "123456789",\n  appId: "1:123456789:web:abcdef"\n};`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSavePaste}
              >
                <Flame size={15} />
                <span>Connect & Save</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL FIELDS */}
        {activeTab === "fields" && (
          <form className="modal-tab-body" onSubmit={handleSaveFields}>
            <div className="fields-grid">
              <div className="input-group">
                <label>Project ID *</label>
                <input
                  type="text"
                  placeholder="e.g. deepguard-ai"
                  value={fields.projectId}
                  onChange={(e) => setFields({ ...fields, projectId: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label>API Key *</label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={fields.apiKey}
                  onChange={(e) => setFields({ ...fields, apiKey: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label>Auth Domain</label>
                <input
                  type="text"
                  placeholder="project.firebaseapp.com"
                  value={fields.authDomain}
                  onChange={(e) => setFields({ ...fields, authDomain: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>Storage Bucket</label>
                <input
                  type="text"
                  placeholder="project.appspot.com"
                  value={fields.storageBucket}
                  onChange={(e) => setFields({ ...fields, storageBucket: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="submit" className="btn-primary">
                <Flame size={15} />
                <span>Connect & Save</span>
              </button>
            </div>
          </form>
        )}

        {/* FEEDBACK STATUS */}
        {statusMsg.text && (
          <div className={`modal-alert ${statusMsg.type === "success" ? "alert-success" : "alert-error"}`}>
            {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* FOOTER NOTE */}
        <div className="modal-footer-note">
          <span>Security Note: Your configuration is stored locally in your browser and connects directly to Google Cloud Firestore via HTTPS.</span>
        </div>
      </div>
    </div>
  );
}
