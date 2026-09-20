import { useState } from "react";
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RefreshCw,
  Trash2,
  Eye,
  X,
  FileText,
  Clock,
  ChevronRight
} from "lucide-react";

export default function AuditLog({
  dbInfo,
  dbStats,
  history,
  historyFilter,
  setHistoryFilter,
  historyLoading,
  onRefresh,
  onDeleteScan,
  onClearHistory
}) {
  const [selectedScan, setSelectedScan] = useState(null);

  return (
    <section id="audit-log" className="audit-section">
      <div className="section-container">
        {/* SECTION HEADER */}
        <div className="section-header">
          <span className="section-kicker">PERSISTENT DATABASE • AUDIT LOG</span>
          <h2 className="section-title">Forensic Audit & Telemetry Explorer</h2>
          <p className="section-subtitle">
            Every analyzed face is permanently stored in your {dbInfo.engine} database with
            confidence values, frequency metrics, and inference latency.
          </p>
        </div>

        {/* KPI TELEMETRY CARDS */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Total Audited Scans</span>
              <Database size={16} className="kpi-icon text-muted" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{dbStats.total_scans}</span>
              <span className="kpi-subtext">in {dbInfo.is_sqlite ? "SQLite local" : "Cloud DB"}</span>
            </div>
          </div>

          <div className="kpi-card kpi-fake">
            <div className="kpi-top">
              <span className="kpi-label">Synthetic Media</span>
              <AlertTriangle size={16} className="kpi-icon text-crimson" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value text-crimson">{dbStats.fake_scans}</span>
              <span className="kpi-badge badge-fake">{dbStats.fake_percentage}%</span>
            </div>
          </div>

          <div className="kpi-card kpi-real">
            <div className="kpi-top">
              <span className="kpi-label">Authentic Verified</span>
              <ShieldCheck size={16} className="kpi-icon text-emerald" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value text-emerald">{dbStats.real_scans}</span>
              <span className="kpi-badge badge-real">{dbStats.real_percentage}%</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Average Latency</span>
              <Zap size={16} className="kpi-icon text-cyan" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value text-cyan">{dbStats.average_latency_ms || 0} ms</span>
              <span className="kpi-subtext">ConvNeXt inference</span>
            </div>
          </div>
        </div>

        {/* AUDIT CONTROLS BAR */}
        <div className="audit-controls">
          <div className="audit-filters">
            <button
              type="button"
              className={`filter-btn ${historyFilter === "ALL" ? "active" : ""}`}
              onClick={() => setHistoryFilter("ALL")}
            >
              All Records ({dbStats.total_scans})
            </button>
            <button
              type="button"
              className={`filter-btn ${historyFilter === "FAKE" ? "active" : ""}`}
              onClick={() => setHistoryFilter("FAKE")}
            >
              Synthetic ({dbStats.fake_scans})
            </button>
            <button
              type="button"
              className={`filter-btn ${historyFilter === "REAL" ? "active" : ""}`}
              onClick={() => setHistoryFilter("REAL")}
            >
              Authentic ({dbStats.real_scans})
            </button>
          </div>

          <div className="audit-actions">
            <button
              type="button"
              className="btn-control"
              onClick={onRefresh}
              disabled={historyLoading}
              title="Refresh audit records"
            >
              <RefreshCw size={14} className={historyLoading ? "spin-icon" : ""} />
              <span>{historyLoading ? "Syncing..." : "Sync"}</span>
            </button>

            {history.length > 0 && (
              <button
                type="button"
                className="btn-control btn-danger"
                onClick={onClearHistory}
                title="Clear all stored records"
              >
                <Trash2 size={14} />
                <span>Purge</span>
              </button>
            )}
          </div>
        </div>

        {/* AUDIT RECORDS TABLE */}
        <div className="table-wrapper">
          {history.length === 0 ? (
            <div className="empty-state">
              <FileText size={32} className="empty-icon text-muted" />
              <h4 className="empty-title">No Audit Records in Database</h4>
              <p className="empty-desc">
                Evaluate an image in the studio above. Each inspection is automatically
                logged to {dbInfo.target}.
              </p>
            </div>
          ) : (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Image & Timestamp</th>
                  <th>Determination</th>
                  <th>Certainty</th>
                  <th>Signals</th>
                  <th>Latency</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr
                    key={record.id}
                    className={`audit-row ${selectedScan?.id === record.id ? "row-selected" : ""}`}
                  >
                    <td className="cell-id">#{record.id}</td>
                    <td className="cell-file">
                      <div className="file-info-col">
                        <span className="file-title" title={record.filename}>
                          {record.filename || "subject.jpg"}
                        </span>
                        <span className="file-timestamp">
                          <Clock size={11} className="inline-icon" />
                          {record.created_at
                            ? new Date(record.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })
                            : "Just now"}
                        </span>
                      </div>
                    </td>
                    <td className="cell-verdict">
                      <span className={`pill-verdict ${record.prediction === "FAKE" ? "verdict-fake" : "verdict-real"}`}>
                        {record.prediction === "FAKE" ? "Synthetic" : "Authentic"}
                      </span>
                    </td>
                    <td className="cell-confidence">
                      <div className="confidence-track-wrap">
                        <span className="conf-digit">{record.confidence}%</span>
                        <div className="conf-track">
                          <div
                            className={`conf-bar ${record.prediction === "FAKE" ? "fill-fake" : "fill-real"}`}
                            style={{ width: `${record.confidence}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="cell-signals">
                      <div className="signals-chip-group">
                        <span className="mini-chip" title="Frequency Coherence">
                          Freq: {record.frequency_coherence ?? "—"}%
                        </span>
                        <span className="mini-chip" title="Texture Uniformity">
                          Txt: {record.texture_uniformity ?? "—"}%
                        </span>
                        <span className="mini-chip" title="Bilateral Symmetry">
                          Sym: {record.bilateral_symmetry ?? "—"}%
                        </span>
                      </div>
                    </td>
                    <td className="cell-latency">{record.latency_ms} ms</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={() => setSelectedScan(selectedScan?.id === record.id ? null : record)}
                        title="Inspect Scan Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-table-action btn-table-del"
                        onClick={() => onDeleteScan(record.id)}
                        title="Delete Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* EXPANDED INSPECTION DRAWER */}
        {selectedScan && (
          <div className="audit-detail-drawer">
            <div className="drawer-header">
              <div className="drawer-heading-wrap">
                <span className="drawer-kicker">AUDIT RECORD INSPECTION</span>
                <h3 className="drawer-title">
                  Record #{selectedScan.id} — {selectedScan.filename}
                </h3>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setSelectedScan(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="drawer-grid">
              <div className="drawer-card">
                <span className="drawer-card-label">Classification Verdict</span>
                <div className={`drawer-verdict-banner ${selectedScan.prediction === "FAKE" ? "text-crimson" : "text-emerald"}`}>
                  {selectedScan.prediction === "FAKE" ? "SYNTHETIC / MANIPULATED" : "AUTHENTIC PHOTOGRAPH"}
                </div>
                <div className="drawer-metric-rows">
                  <div className="metric-row">
                    <span>Certainty Score</span>
                    <strong>{selectedScan.confidence}%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Fake Probability</span>
                    <span>{selectedScan.fake_probability}%</span>
                  </div>
                  <div className="metric-row">
                    <span>Real Probability</span>
                    <span>{selectedScan.real_probability}%</span>
                  </div>
                </div>
              </div>

              <div className="drawer-card">
                <span className="drawer-card-label">Stored Forensic Signals</span>
                <div className="drawer-metric-rows">
                  <div className="metric-row">
                    <span>Frequency Residual</span>
                    <strong>{selectedScan.frequency_coherence}%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Texture Smoothing</span>
                    <strong>{selectedScan.texture_uniformity}%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Bilateral Symmetry</span>
                    <strong>{selectedScan.bilateral_symmetry}%</strong>
                  </div>
                  <div className="metric-row">
                    <span>Inference Latency</span>
                    <strong>{selectedScan.latency_ms} ms</strong>
                  </div>
                  <div className="metric-row">
                    <span>Model Checkpoint</span>
                    <code>{selectedScan.model_version || "ConvNeXt-Tiny V10.0"}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
