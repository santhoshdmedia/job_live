import { useEffect, useState, useCallback, useRef } from "react";
import {
  Button, Tag, Modal, Input, Spin, Empty, Tooltip, Divider,
  message, Popconfirm, Progress,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined,
  PlayCircleOutlined, EyeOutlined, FileImageOutlined, UserOutlined,
  ShoppingCartOutlined, CalendarOutlined, PhoneOutlined, ReloadOutlined,
  PauseCircleOutlined, HistoryOutlined, DownloadOutlined, CloudUploadOutlined,
  WarningOutlined, LinkOutlined, PictureOutlined, LockOutlined, UnlockOutlined,
  SendOutlined, InfoCircleOutlined, HourglassOutlined, TeamOutlined, StarOutlined,
  DeleteOutlined, PaperClipOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

const { TextArea } = Input;

const pad = (n) => String(n).padStart(2, "0");
const fmtSecs = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const profile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};

const BASE = "https://api.dmedia.in/api/jobs";
const INFO_BASE = "https://api.dmedia.in/api/info-requests";
const DRIVE_FOLDER_ID = "118wOyN-T0N9IZbiQUER7khCOaEH9GfRQ";

// ─── Filter keys ──────────────────────────────────────────────────────────────
const FILTER_ALL             = "all";
const FILTER_LIVE            = "live";
const FILTER_ON_HOLD         = "on_hold";
const FILTER_DESIGN_UPLOADED = "design_uploaded";
const FILTER_ACCESS_PENDING  = "access_pending";
const FILTER_APPROVED_DESIGN = "approved_design";

// ─── Image compression ────────────────────────────────────────────────────────
const compressImage = (file, maxSizeBytes = 900 * 1024) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 2400;
        const scale = img.width > MAX_DIM || img.height > MAX_DIM
          ? MAX_DIM / Math.max(img.width, img.height) : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const tryCompress = (q) => canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          if (blob.size <= maxSizeBytes || q <= 0.2) {
            resolve({ blob, dataUrl: URL.createObjectURL(blob), sizeKB: Math.round(blob.size / 1024) });
          } else { tryCompress(Math.max(q - 0.12, 0.2)); }
        }, "image/jpeg", q);
        tryCompress(0.85);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  accepted:    { label: "Accepted",    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  on_hold:     { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  rejected:    { label: "Rejected",    color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  design:      { label: "Design",      color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.design;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
};

const InfoRequestBadge = ({ requestStatus }) => {
  if (!requestStatus || requestStatus === "none") return null;
  const cfg = {
    pending:  { label: "Access Pending", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", icon: <HourglassOutlined /> },
    approved: { label: "Access Granted", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", icon: <UnlockOutlined /> },
    rejected: { label: "Access Denied",  color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", icon: <CloseCircleOutlined /> },
  }[requestStatus] || null;
  if (!cfg) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 10,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: 10, fontWeight: 700,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const CustomerInfoBlock = ({ job, requestStatus, hasAccess, onRequestInfo, requesting, isSuperAdmin, userEmail }) => {
  const isSpecialUser = userEmail?.toLowerCase().trim() === "hari@dmedia.in";
  if (isSuperAdmin || isSpecialUser || hasAccess) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#f0fdf4",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, border: "2px solid #86efac",
        }}>
          <UserOutlined style={{ color: "#16a34a", fontSize: 14 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", lineHeight: 1.2 }}>{job.customer_name || "—"}</div>
          <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
            <PhoneOutlined style={{ fontSize: 10 }} />{job.customer_phone || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            <TeamOutlined style={{ marginRight: 3, fontSize: 15 }} />Created by: {job.created_by || "—"}
          </div>
          {hasAccess && !isSuperAdmin && !isSpecialUser && (
            <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>
              <UnlockOutlined style={{ marginRight: 3 }} />Access granted
            </div>
          )}
          {isSpecialUser && (
            <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600, marginTop: 2 }}>
              <StarOutlined style={{ marginRight: 3 }} />Special access: hari@dmedia.in
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{
      background: requestStatus === "pending" ? "#fffbeb" : "#f8fafc",
      border: `1px solid ${requestStatus === "pending" ? "#fcd34d" : "#e5e7eb"}`,
      borderRadius: 10, padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: "#eff6ff",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1.5px solid #bfdbfe", flexShrink: 0,
        }}>
          <TeamOutlined style={{ color: "#3b82f6", fontSize: 12 }} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: "#6b7280", fontWeight: 600 }}>Created by</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>{job.created_by || "—"}</div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#f1f5f9", borderRadius: 8, padding: "8px 10px", border: "1px dashed #cbd5e1",
      }}>
        <LockOutlined style={{ color: "#94a3b8", fontSize: 16, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em" }}>●●●●● ●●●●●●●</div>
          <div style={{ fontSize: 11, color: "#b0bec5", letterSpacing: "0.12em" }}>+91 ●●●●●●●●●●</div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {requestStatus === "none" || requestStatus === "rejected" ? (
            <Button size="small" icon={<SendOutlined />} loading={requesting} onClick={onRequestInfo}
              style={{
                height: 28, fontSize: 11, fontWeight: 700,
                background: requestStatus === "rejected" ? "#fef2f2" : "#eff6ff",
                color: requestStatus === "rejected" ? "#ef4444" : "#1e40af",
                border: `1px solid ${requestStatus === "rejected" ? "#fca5a5" : "#bfdbfe"}`,
                borderRadius: 8,
              }}>
              {requestStatus === "rejected" ? "Re-request" : "Request Info"}
            </Button>
          ) : requestStatus === "pending" ? (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fffbeb",
              padding: "3px 8px", border: "1px solid #fcd34d", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <HourglassOutlined style={{ animation: "spin 2s linear infinite" }} />Pending…
            </span>
          ) : null}
        </div>
      </div>
      {requestStatus === "rejected" && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
          <CloseCircleOutlined style={{ marginRight: 4 }} />Previous request was denied. You may submit a new request.
        </div>
      )}
    </div>
  );
};

const DailySummaryBar = ({ dailySummary = [], totalSecs = 0, workedDays = 0 }) => {
  if (!dailySummary.length) return null;
  const maxSecs = Math.max(...dailySummary.map((d) => d.seconds), 1);
  return (
    <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#0369a1",
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 8, display: "flex", justifyContent: "space-between",
      }}>
        <span><HistoryOutlined style={{ marginRight: 4 }} />Work History ({workedDays} day{workedDays !== 1 ? "s" : ""})</span>
        <span style={{ color: "#1e40af" }}>Total: {fmtSecs(totalSecs)}</span>
      </div>
      {dailySummary.map((day, i) => {
        const pct = Math.round((day.seconds / maxSecs) * 100);
        return (
          <div key={day.date} style={{ marginBottom: i < dailySummary.length - 1 ? 6 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#374151", marginBottom: 2, fontWeight: 600 }}>
              <span>Day {i + 1} — {dayjs(day.date).format("DD MMM")}</span>
              <span style={{ color: "#0369a1" }}>{day.display}</span>
            </div>
            <div style={{ height: 6, background: "#e0f2fe", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#3b82f6,#0ea5e9)", borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SessionStatusPill = ({ sessionData }) => {
  if (!sessionData) return null;
  const hasOpen = sessionData.has_open_session;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 12,
      background: hasOpen ? "#dcfce7" : "#fef3c7", border: `1px solid ${hasOpen ? "#86efac" : "#fcd34d"}`,
      fontSize: 10, fontWeight: 700, color: hasOpen ? "#16a34a" : "#92400e",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: hasOpen ? "#16a34a" : "#f59e0b", animation: hasOpen ? "pulse 1.5s infinite" : "none" }} />
      {hasOpen ? "Session Live" : `${sessionData.worked_days || 0} day${(sessionData.worked_days || 0) !== 1 ? "s" : ""} logged`}
    </div>
  );
};

const DesignFilePreview = ({ fileUrl, label = "Uploaded Design", isSample = false }) => {
  if (!fileUrl) return null;
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(fileUrl);
  const isPdf = /\.pdf(\?.*)?$/i.test(fileUrl);
  const handleDownload = async () => {
    try {
      const blob = await fetch(fileUrl).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const ext = fileUrl.split("?")[0].split(".").pop() || "file";
      const a = Object.assign(document.createElement("a"), { href: url, download: `design_${Date.now()}.${ext}` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(fileUrl, "_blank"); }
  };
  return (
    <div style={{ border: `1px solid ${isSample ? "#a5b4fc" : "#c4b5fd"}`, borderRadius: 10, overflow: "hidden", marginBottom: 14, background: isSample ? "#f0f0ff" : "#faf5ff" }}>
      <div style={{ padding: "8px 12px", background: isSample ? "linear-gradient(135deg,#4f46e5,#6366f1)" : "linear-gradient(135deg,#7c3aed,#9333ea)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5f3ff", letterSpacing: "0.05em" }}>
          {isSample ? <><PictureOutlined style={{ marginRight: 5 }} />Sample Preview (≤1 MB)</> : <><FileImageOutlined style={{ marginRight: 5 }} />{label}</>}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#e9d5ff", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            <EyeOutlined /> Open
          </a>
          <span onClick={handleDownload} style={{ fontSize: 10, color: "#e9d5ff", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <DownloadOutlined /> Download
          </span>
        </div>
      </div>
      {isImage ? (
        <div style={{ padding: 10, textAlign: "center", background: isSample ? "#eef0ff" : "#f5f3ff" }}>
          <img src={fileUrl} alt="Design preview" style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 6, boxShadow: "0 2px 8px rgba(124,58,237,0.15)" }} />
          {isSample && <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 600, marginTop: 6 }}>ℹ Compressed preview — upload original via Google Drive below</div>}
        </div>
      ) : isPdf ? (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>📄 PDF — <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>Click to view</a></div>
      ) : (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>📎 File — <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>Download / View</a></div>
      )}
    </div>
  );
};

const DriveUploadSection = ({ jobNo, driveLinkValue, onDriveLinkChange }) => {
  const driveUrl = DRIVE_FOLDER_ID !== "YOUR_GOOGLE_DRIVE_FOLDER_ID"
    ? `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}` : "https://drive.google.com";
  return (
    <div style={{ border: "1px solid #fbbf24", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,#d97706,#f59e0b)", display: "flex", alignItems: "center", gap: 8 }}>
        <CloudUploadOutlined style={{ color: "#fffbeb", fontSize: 16 }} />
        <span style={{ fontWeight: 800, color: "#fffbeb", fontSize: 12, letterSpacing: "0.04em" }}>Original Quality — Google Drive Upload</span>
      </div>
      <div style={{ padding: "12px 14px", background: "#fffbeb" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
          <WarningOutlined style={{ color: "#ef4444", fontSize: 13, marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}><strong>Auto-cleanup in 48 hours.</strong> Files in the shared Drive folder are deleted after 48 hours. Download or move originals before then.</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          {[
            { n: "1", text: "Click the button below to open the shared Drive folder" },
            { n: "2", text: `Upload your original high-quality design for job ${jobNo}` },
            { n: "3", text: 'Right-click the file → "Get link" → paste it below' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{n}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{text}</span>
            </div>
          ))}
        </div>
        <Button icon={<CloudUploadOutlined />} onClick={() => window.open(driveUrl, "_blank")}
          style={{ width: "100%", height: 36, marginBottom: 10, background: "#1a73e8", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Open Shared Drive Folder
        </Button>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <LinkOutlined style={{ marginRight: 4 }} />Paste Drive Share Link (optional)
        </label>
        <Input placeholder="https://drive.google.com/file/d/..." value={driveLinkValue} onChange={(e) => onDriveLinkChange(e.target.value)}
          style={{ borderRadius: 8, borderColor: "#fcd34d", fontSize: 12 }} prefix={<LinkOutlined style={{ color: "#f59e0b" }} />} />
        {driveLinkValue && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircleOutlined /> Drive link recorded.
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 10, color: "#92400e", textAlign: "center", fontStyle: "italic" }}>⏱ Drive files auto-deleted 48 hrs after upload.</div>
      </div>
    </div>
  );
};

const SampleUploadPanel = ({ onSampleReady, onFileSelected, sampleInfo }) => {
  const [compressing, setCompressing] = useState(false);
  const inputRef = useRef();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelected(file);
    if (file.type.startsWith("image/")) {
      setCompressing(true);
      try {
        const result = await compressImage(file, 900 * 1024);
        onSampleReady(result);
        message.success(`Sample compressed to ${result.sizeKB} KB`);
      } catch (err) { message.error("Compression failed: " + err.message); }
      finally { setCompressing(false); }
    } else { onSampleReady(null); }
    e.target.value = "";
  };
  return (
    <div style={{ border: "2px dashed #c4b5fd", borderRadius: 10, padding: "14px", background: "#faf5ff", marginBottom: 10, textAlign: "center", cursor: "pointer" }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleFileChange({ target: { files: [file] } }); }}>
      <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
      {compressing ? (
        <div style={{ color: "#7c3aed", fontSize: 12 }}><Spin size="small" style={{ marginRight: 8 }} />Compressing…</div>
      ) : sampleInfo ? (
        <div style={{ color: "#16a34a", fontSize: 12, fontWeight: 600 }}><CheckCircleOutlined style={{ marginRight: 6 }} />Sample ready ({sampleInfo.sizeKB} KB) — click to replace</div>
      ) : (
        <div>
          <UploadOutlined style={{ fontSize: 22, color: "#7c3aed", marginBottom: 6 }} />
          <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>Click or drag design file here</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Images auto-compressed to ≤1 MB · PDF accepted as-is</div>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MultiFileUploader  — drop-in replacement for <UploadHelper />
//
// Props (matching the original UploadHelper interface + multi-file extras):
//   setImagePath(path: string)  — called with the FIRST successfully uploaded
//                                 URL, keeping backward-compat with callers that
//                                 read a single designFilePath string.
//   image_path(string)          — current value (shows "already uploaded" state).
//   onAllPaths(paths: string[]) — optional: called with the full array each time
//                                 a file finishes uploading or is removed.
//
// Supported formats: PDF · JPG/JPEG · PNG · WEBP · CDR · DXF
// Multiple files can be selected at once or dropped individually.
// Each file shows a real XHR progress bar and a retry button on failure.
// ═════════════════════════════════════════════════════════════════════════════

// Accepted MIME types + extensions that the browser's file picker should allow.
const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.cdr,.CDR,.dxf,.DXF";

// Map extension → display badge config
const EXT_CFG = {
  pdf:  { label: "PDF",  color: "#ef4444", bg: "#fef2f2", icon: "📄" },
  jpg:  { label: "JPG",  color: "#f59e0b", bg: "#fffbeb", icon: "🖼️" },
  jpeg: { label: "JPG",  color: "#f59e0b", bg: "#fffbeb", icon: "🖼️" },
  png:  { label: "PNG",  color: "#3b82f6", bg: "#eff6ff", icon: "🖼️" },
  webp: { label: "WEBP", color: "#8b5cf6", bg: "#f5f3ff", icon: "🖼️" },
  cdr:  { label: "CDR",  color: "#f97316", bg: "#fff7ed", icon: "🎨" },
  dxf:  { label: "DXF",  color: "#10b981", bg: "#f0fdf4", icon: "📐" },
};

const getExtCfg = (filename) => {
  const ext = (filename || "").split(".").pop().toLowerCase();
  return EXT_CFG[ext] || { label: ext.toUpperCase() || "FILE", color: "#6b7280", bg: "#f8fafc", icon: "📎" };
};

const isImageExt = (filename) =>
  /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(filename || "");

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};

const MultiFileUploader = ({ setImagePath, image_path, onAllPaths }) => {
  // Each entry: { id, name, size, status, progress, url, error, preview }
  // status: "uploading" | "done" | "error"
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const idRef = useRef(0);
  const pathsRef = useRef([]); // keeps in sync with state for callbacks

  // ── Sync pathsRef whenever files state changes ────────────────────────────
  const syncPaths = (updatedFiles) => {
    const paths = updatedFiles.filter((f) => f.status === "done" && f.url).map((f) => f.url);
    pathsRef.current = paths;
    if (paths.length > 0) setImagePath(paths[0]);        // backward-compat: first URL
    else if (image_path) setImagePath("");                // clear if all removed
    onAllPaths?.(paths);
  };

  const makeId = () => `mfu_${++idRef.current}_${Date.now()}`;

  // ── Generate a local preview for image files ──────────────────────────────
  const makePreview = (file) =>
    new Promise((res) => {
      if (!file.type.startsWith("image/")) { res(null); return; }
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = () => res(null);
      r.readAsDataURL(file);
    });

  // ── Upload a single file entry via XHR (real progress) ───────────────────
  const uploadEntry = async (entry) => {
    const { id, file } = entry;

    const setEntryState = (patch) =>
      setFiles((prev) => {
        const next = prev.map((f) => (f.id === id ? { ...f, ...patch } : f));
        syncPaths(next);
        return next;
      });

    setEntryState({ status: "uploading", progress: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // ── Change this endpoint to match your upload API ─────────────────
        xhr.open("POST", "https://api.dmedia.in/api/upload");
        const token = localStorage.getItem("authToken");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setEntryState({ progress: Math.round((e.loaded / e.total) * 100) });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              // Accept the most common response shapes from image-upload APIs:
              const uploaded =
                data?.url || data?.data?.url || data?.path ||
                data?.file_url || data?.filePath || data?.imageUrl || data?.link;
              if (uploaded) resolve(uploaded);
              else reject(new Error("No URL in server response"));
            } catch { reject(new Error("Could not parse server response")); }
          } else {
            reject(new Error(`Server error ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error — check your connection"));
        xhr.send(formData);
      });

      setEntryState({ status: "done", progress: 100, url });
      message.success(`✓ ${file.name} uploaded`);
    } catch (err) {
      setEntryState({ status: "error", error: err.message });
      message.error(`✕ ${file.name}: ${err.message}`);
    }
  };

  // ── Validate extension before accepting a file ────────────────────────────
  const isAllowed = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    return ["pdf", "jpg", "jpeg", "png", "webp", "cdr", "dxf"].includes(ext);
  };

  // ── Add new File objects (from input or drop) ─────────────────────────────
  const addFiles = async (rawFiles) => {
    const allowed = [];
    for (const f of rawFiles) {
      if (!isAllowed(f)) {
        message.warning(`"${f.name}" — unsupported format. Allowed: PDF, JPG, PNG, WEBP, CDR, DXF`);
        continue;
      }
      allowed.push(f);
    }
    if (!allowed.length) return;

    const entries = await Promise.all(
      allowed.map(async (file) => ({
        id: makeId(),
        file,
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 0,
        url: null,
        error: null,
        preview: await makePreview(file),
      }))
    );

    setFiles((prev) => [...prev, ...entries]);
    entries.forEach(uploadEntry);
  };

  const handleInputChange = (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const retryEntry = (entry) => {
    setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "uploading", progress: 0, url: null, error: null } : f));
    uploadEntry({ ...entry, status: "uploading" });
  };

  const removeEntry = (id) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      syncPaths(next);
      return next;
    });
  };

  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div style={{ marginBottom: 8 }}>

      {/* ── Supported-format badges ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {Object.entries({
          PDF: "#ef4444", JPG: "#f59e0b", PNG: "#3b82f6",
          WEBP: "#8b5cf6", CDR: "#f97316", DXF: "#10b981",
        }).map(([fmt, color]) => (
          <span key={fmt} style={{
            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
            background: `${color}12`, color, border: `1px solid ${color}33`,
            letterSpacing: "0.05em",
          }}>{fmt}</span>
        ))}
        <span style={{ fontSize: 10, color: "#9ca3af", alignSelf: "center", marginLeft: 2 }}>
          · Multiple files supported
        </span>
      </div>

      {/* ── Drop zone ── */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? "#7c3aed" : "#c4b5fd"}`,
          borderRadius: 10, padding: "16px 14px", background: dragging ? "#f3e8ff" : "#faf5ff",
          textAlign: "center", cursor: "pointer", transition: "all 0.18s ease",
          transform: dragging ? "scale(1.01)" : "none",
          marginBottom: files.length ? 12 : 0,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
        <div style={{ fontSize: 24, marginBottom: 5 }}>{dragging ? "📂" : "🗂️"}</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: dragging ? "#7c3aed" : "#6d28d9", marginBottom: 3 }}>
          {dragging ? "Drop files here!" : "Click or drag files to upload"}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>
          PDF · JPG · PNG · WEBP · CDR · DXF — pick multiple at once
        </div>
      </div>

      {/* ── File list ── */}
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((entry) => {
            const cfg = getExtCfg(entry.name);
            return (
              <div key={entry.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: entry.status === "done" ? "#f0fdf4"
                  : entry.status === "error" ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${entry.status === "done" ? "#86efac"
                  : entry.status === "error" ? "#fca5a5" : "#e5e7eb"}`,
                borderRadius: 10, padding: "10px 12px",
              }}>

                {/* Preview thumbnail or icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: 8, flexShrink: 0,
                  overflow: "hidden", background: "#f1f5f9",
                  border: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {entry.preview
                    ? <img src={entry.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                  }
                </div>

                {/* Info + progress */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{
                      fontWeight: 700, fontSize: 12, color: "#111827",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "72%",
                    }}>{entry.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`,
                      letterSpacing: "0.05em", flexShrink: 0,
                    }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 5 }}>{fmtBytes(entry.size)}</div>

                  {entry.status === "uploading" && (
                    <>
                      <Progress
                        percent={entry.progress}
                        size="small"
                        strokeColor={{ from: "#7c3aed", to: "#a855f7" }}
                        trailColor="#e9d5ff"
                        showInfo={false}
                        style={{ marginBottom: 2 }}
                      />
                      <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600 }}>
                        Uploading… {entry.progress}%
                      </div>
                    </>
                  )}

                  {entry.status === "done" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircleOutlined style={{ color: "#16a34a", fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>Uploaded</span>
                      {entry.url && (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, color: "#0369a1", display: "flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
                          <EyeOutlined /> View
                        </a>
                      )}
                    </div>
                  )}

                  {entry.status === "error" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
                        ✕ {entry.error || "Upload failed"}
                      </span>
                      <Button size="small" onClick={() => retryEntry(entry)}
                        style={{ height: 20, fontSize: 10, padding: "0 6px", borderRadius: 4, color: "#ef4444", borderColor: "#fca5a5" }}>
                        Retry
                      </Button>
                    </div>
                  )}
                </div>

                {/* Remove */}
                <Button
                  type="text" size="small" icon={<DeleteOutlined />}
                  onClick={() => removeEntry(entry.id)}
                  style={{ color: "#9ca3af", padding: 4, height: 24, flexShrink: 0, marginTop: 2 }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Summary when all done ── */}
      {doneCount > 0 && files.every((f) => f.status !== "uploading") && (
        <div style={{
          marginTop: 8, background: "#f0fdf4", border: "1px solid #86efac",
          borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#16a34a",
          fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
        }}>
          <CheckCircleOutlined />
          {doneCount} file{doneCount !== 1 ? "s" : ""} ready — click "Save Sample" below to attach.
        </div>
      )}
    </div>
  );
};

const JobCard = ({
  job, sessionData, infoRequestStatus, hasInfoAccess, isSuperAdmin,
  onOpenSession, onCloseSession, onViewUpload, onRequestInfo, requestingInfo, userEmail,
}) => {
  const delivDate = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
  const isOverdue = delivDate && delivDate.isBefore(dayjs());
  const isLive = sessionData?.has_open_session;
  const hasDesign = !!(job.design_file || job.cart_items?.some((i) => i.design_file));
  const isDesignApproved = job.design_status === "approved";

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: `1px solid ${isDesignApproved ? "#f9a8d4" : isLive ? "#86efac" : "#e5e7eb"}`,
      boxShadow: isDesignApproved
        ? "0 0 0 2px #fce7f3, 0 4px 12px rgba(0,0,0,0.08)"
        : isLive
          ? "0 0 0 2px #dcfce7, 0 4px 12px rgba(0,0,0,0.08)"
          : "0 2px 8px rgba(0,0,0,0.06)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      <div style={{
        padding: "10px 14px",
        background: isDesignApproved
          ? "linear-gradient(135deg,rgb(20, 83, 45) 0%,rgb(22, 163, 74) 100%)"
          : isLive
            ? "linear-gradient(135deg,#14532d 0%,#16a34a 100%)"
            : "linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: isDesignApproved ? "#fbcfe8" : isLive ? "#bbf7d0" : "#93c5fd", letterSpacing: "0.05em" }}>
          {job.job_no}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isDesignApproved && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fbcfe8", background: "rgba(255,255,255,0.15)", padding: "1px 7px", borderRadius: 10 }}>✓ APPROVED</span>
          )}
          {isLive && !isDesignApproved && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#bbf7d0", background: "rgba(255,255,255,0.15)", padding: "1px 7px", borderRadius: 10 }}>● LIVE</span>
          )}
          <StatusBadge status={job.job_status} />
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <CustomerInfoBlock job={job} requestStatus={infoRequestStatus} hasAccess={hasInfoAccess}
          onRequestInfo={() => onRequestInfo(job)} requesting={requestingInfo === job._id}
          isSuperAdmin={isSuperAdmin} userEmail={userEmail} />
        <div style={{ marginBottom: 8 }}>
          <SessionStatusPill sessionData={sessionData} />
          {!isSuperAdmin && <span style={{ marginLeft: 6 }}><InfoRequestBadge requestStatus={infoRequestStatus} /></span>}
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
            <ShoppingCartOutlined style={{ marginRight: 4 }} />Items
          </div>
          {(job.cart_items || []).slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>
                {item.product_name} ({item.variation} | {item.printing_type})
                {item.size && <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {item.size}</span>}
              </span>
            </div>
          ))}
          {(job.cart_items || []).length > 2 && (
            <div style={{ fontSize: 11, color: "#6b7280" }}>+{job.cart_items.length - 2} more items</div>
          )}
        </div>
        {sessionData && (sessionData.total_duration_seconds > 0 || sessionData.worked_days > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 11 }}>
            <span style={{ color: "#0369a1", fontWeight: 600 }}><ClockCircleOutlined style={{ marginRight: 4 }} />{fmtSecs(sessionData.total_duration_seconds)} logged</span>
            <span style={{ color: "#374151" }}>{sessionData.worked_days} day{sessionData.worked_days !== 1 ? "s" : ""} · {sessionData.closed_sessions} session{sessionData.closed_sessions !== 1 ? "s" : ""}</span>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#6b7280" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {delivDate ? delivDate.format("DD MMM YYYY") : "—"}
            {isOverdue && <span style={{ marginLeft: 4, fontWeight: 700 }}>⚠ Overdue</span>}
          </div>
        </div>
        {hasDesign && (
          <div style={{
            fontSize: 11, fontWeight: 600, marginBottom: 10,
            background: isDesignApproved ? "#fce7f3" : "#faf5ff",
            border: `1px solid ${isDesignApproved ? "#f9a8d4" : "#c4b5fd"}`,
            color: isDesignApproved ? "#be185d" : "#7c3aed",
            borderRadius: 6, padding: "4px 8px", display: "inline-block",
          }}>
            {isDesignApproved
              ? <><CheckCircleOutlined style={{ marginRight: 4 }} />Design Approved</>
              : <><FileImageOutlined style={{ marginRight: 4 }} />Design Uploaded</>}
            {job.design_status === "rejected" && <span style={{ color: "#ef4444", marginLeft: 6 }}>· Rejected</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isLive && (
            <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={() => onOpenSession(job)}
              style={{ flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12, background: job.job_status === "on_hold" ? "#d97706" : "#1e40af", border: "none", borderRadius: 8 }}>
              {job.job_status === "on_hold" ? "Resume" : "Start"}
            </Button>
          )}
          {isLive && (
            <Button icon={<PauseCircleOutlined />} size="small" danger onClick={() => onCloseSession(job, "on_hold")}
              style={{ flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12, borderRadius: 8 }}>Pause</Button>
          )}
          {isLive && (
            <Popconfirm title="Mark design stage as complete?" onConfirm={() => onCloseSession(job, "completed")} okText="Complete" okButtonProps={{ style: { background: "#16a34a", border: "none" } }}>
              <Button icon={<CheckCircleOutlined />} size="small"
                style={{ flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12, borderRadius: 8, color: "#16a34a", borderColor: "#86efac", background: "#f0fdf4" }}>Complete</Button>
            </Popconfirm>
          )}
          <Tooltip title="Upload / View Design">
            <Button icon={<UploadOutlined />} size="small" onClick={() => onViewUpload(job)}
              style={{ height: 32, borderRadius: 8, color: "#7c3aed", borderColor: "#c4b5fd", background: "#faf5ff" }}>Design</Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════
const DesignerJobDashboard = () => {
  const user = profile();
  const userId = user._id;
  const userName = user.name || user.fullName || user.username || "Designer";
  const isSuperAdmin = user.role === "super_admin";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionMap, setSessionMap] = useState({});
  const [lastRefresh, setLastRefresh] = useState(dayjs());

  // ── Active filter for summary strip ──────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);

  const [infoRequestMap, setInfoRequestMap] = useState({});
  const [requestingInfo, setRequestingInfo] = useState(null);
  const [requestModal, setRequestModal] = useState(false);
  const [requestJob, setRequestJob] = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  const [notesModal, setNotesModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actioning, setActioning] = useState(false);

  const [designModal, setDesignModal] = useState(false);
  const [designJob, setDesignJob] = useState(null);
  const [designFilePath, setDesignFilePath] = useState("");   // first uploaded URL (backward-compat)
  const [designNotes, setDesignNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [sampleInfo, setSampleInfo] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [driveLink, setDriveLink] = useState("");
  const [samplePreviewUrl, setSamplePreviewUrl] = useState("");

  const [liveTimers, setLiveTimers] = useState({});
  const timerRefs = useRef({});

  // ─── Load jobs + sessions ─────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let myJobs = [];
      if (isSuperAdmin) {
        const res = await fetch(`${BASE}`, { headers: authHeader() });
        const data = await res.json();
        const rows = Array.isArray(data?.data?.jobs) ? data.data.jobs : Array.isArray(data?.data) ? data.data : [];
        myJobs = rows.filter(
          (j) => j.current_stage?.stage === "design" || j.design_status === "approved"
        );
      } else {
        const res = await fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() });
        const data = await res.json();
        const rows = Array.isArray(data?.data) ? data.data : [];
        myJobs = rows.filter(
          (j) => j.current_stage?.stage === "design" || j.design_status === "approved"
        );
      }
      setJobs(myJobs);
      setLastRefresh(dayjs());

      const sessMap = {};
      await Promise.all(myJobs.map(async (j) => {
        try {
          const sr = await fetch(`${BASE}/${j._id}/session/status?stage=design`, { headers: authHeader() });
          const sd = await sr.json();
          if (sd.success) sessMap[j._id] = sd.data;
        } catch { /* ignore */ }
      }));
      setSessionMap(sessMap);

      for (const [jobId, sess] of Object.entries(sessMap)) {
        if (sess.has_open_session && sess.open_since && !timerRefs.current[jobId]) {
          startLiveTimer(jobId, new Date(sess.open_since), sess.total_duration_seconds || 0);
        }
      }

      if (!isSuperAdmin) {
        const reqMap = {};
        await Promise.all(myJobs.map(async (j) => {
          try {
            const r = await fetch(`${INFO_BASE}/job/${j._id}?userId=${userId}`, { headers: authHeader() });
            const d = await r.json();
            if (d.success) reqMap[j._id] = d.data;
          } catch { /* ignore */ }
        }));
        setInfoRequestMap(reqMap);
      }
    } catch (err) {
      message.error("Failed to load jobs: " + (err.message || "Network error"));
    } finally { setLoading(false); }
  }, [userId, isSuperAdmin]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── Live timer helpers ───────────────────────────────────────────────────
  const startLiveTimer = (jobId, sessionStartedAt, previousTotalSecs = 0) => {
    if (timerRefs.current[jobId]) return;
    setLiveTimers((prev) => ({ ...prev, [jobId]: { startedAt: sessionStartedAt, base: previousTotalSecs } }));
    timerRefs.current[jobId] = setInterval(() => {
      setLiveTimers((prev) => {
        const entry = prev[jobId];
        if (!entry) return prev;
        return { ...prev, [jobId]: { ...entry, currentSessionSecs: Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000) } };
      });
    }, 1000);
  };

  const stopLiveTimer = (jobId) => {
    clearInterval(timerRefs.current[jobId]);
    delete timerRefs.current[jobId];
    setLiveTimers((prev) => { const next = { ...prev }; delete next[jobId]; return next; });
  };

  useEffect(() => () => { Object.values(timerRefs.current).forEach(clearInterval); }, []);

  const getLiveDisplaySecs = (jobId) => {
    const entry = liveTimers[jobId];
    if (!entry) return sessionMap[jobId]?.total_duration_seconds || 0;
    return (entry.base || 0) + (entry.currentSessionSecs || 0);
  };

  // ─── Open / Close session ─────────────────────────────────────────────────
  const handleOpenSession = (job) => { setPendingAction({ job, action: "open" }); setActionNotes(""); setNotesModal(true); };
  const handleCloseSession = (job, action) => { setPendingAction({ job, action }); setActionNotes(""); setNotesModal(true); };

  const confirmOpenSession = async () => {
    const { job } = pendingAction;
    setActioning(true);
    try {
      const res = await fetch(`${BASE}/${job._id}/session/open`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "design", stage_label: "Design", user: { user_id: userId, name: userName, role: "designing team" }, notes: actionNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open session");
      message.success(`Session started for ${job.job_no}!`);
      setNotesModal(false);
      startLiveTimer(job._id, new Date(), sessionMap[job._id]?.total_duration_seconds || 0);
      await loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setActioning(false); }
  };

  const confirmCloseSession = async () => {
    const { job, action } = pendingAction;
    setActioning(true);
    try {
      const res = await fetch(`${BASE}/${job._id}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "design", action, notes: actionNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to close session");
      const msgs = {
        on_hold: `Paused! ${data.data?.stage_summary?.total_duration_display || ""} logged.`,
        completed: `Design complete! Total: ${data.data?.stage_summary?.total_duration_display || ""} across ${data.data?.stage_summary?.worked_days || 0} days.`,
        rejected: "Design stage rejected.",
      };
      message.success(msgs[action] || data.message);
      setNotesModal(false);
      stopLiveTimer(job._id);
      await loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setActioning(false); }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.action === "open") confirmOpenSession();
    else confirmCloseSession();
  };

  // ─── Request Info flow ────────────────────────────────────────────────────
  const openRequestModal = (job) => { setRequestJob(job); setRequestReason(""); setRequestModal(true); };

  const submitInfoRequest = async () => {
    if (!requestJob) return;
    setSubmittingReq(true);
    try {
      const res = await fetch(INFO_BASE, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ job_id: requestJob._id, requested_by: { user_id: userId, name: userName, role: user.role || "designing team" }, request_reason: requestReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Request failed");
      message.success("Request submitted! Waiting for admin approval.");
      setRequestModal(false);
      setInfoRequestMap((prev) => ({ ...prev, [requestJob._id]: { status: "pending", has_access: false, request: data.data } }));
    } catch (err) { message.error(err.message); }
    finally { setSubmittingReq(false); }
  };

  // ─── Design modal ─────────────────────────────────────────────────────────
  const openDesignModal = (job) => {
    setDesignJob(job); setDesignFilePath(job.design_file || ""); setDesignNotes("");
    setShowRejectInput(false); setRejectReason(""); setSampleInfo(null);
    setOriginalFile(null); setDriveLink(job.design_drive_link || ""); setSamplePreviewUrl(""); setDesignModal(true);
  };

  const closeDesignModal = () => {
    if (sampleInfo?.dataUrl) URL.revokeObjectURL(sampleInfo.dataUrl);
    setDesignModal(false); setDesignJob(null); setDesignFilePath(""); setSampleInfo(null);
    setOriginalFile(null); setDriveLink(""); setSamplePreviewUrl("");
  };

  const handleSampleReady = (info) => {
    if (sampleInfo?.dataUrl) URL.revokeObjectURL(sampleInfo.dataUrl);
    setSampleInfo(info); setSamplePreviewUrl(info?.dataUrl || "");
  };

  const handleUploadDesign = async () => {
    if (!designFilePath && !samplePreviewUrl) { message.warning("Please upload a design file first"); return; }
    setUploading(true);
    try {
      const liveSecs = getLiveDisplaySecs(designJob._id);
      const res = await fetch(`${BASE}/${designJob._id}/upload_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ design_file: designFilePath, design_drive_link: driveLink || null, notes: designNotes, duration_seconds: liveSecs, duration_display: fmtSecs(liveSecs), handled_by: { user_id: userId, name: userName }, stage: designJob.current_stage?.stage || "design", is_sample: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");
      message.success("Design saved!");
      stopLiveTimer(designJob._id);
      closeDesignModal();
      loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setUploading(false); }
  };

  const updateStatusAfterDesignUpload = async (newStatus) => {
    try {
      const res = await fetch(`${BASE}/${designJob._id}/status`, { method: "PATCH", headers: jsonHeader(), body: JSON.stringify({ job_status: newStatus }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    } catch (err) { message.error("Failed to update design status: " + err.message); }
  };

  const handleApproveDesign = async () => {
    setApproving(true);
    try {
      const res = await fetch(`${BASE}/${designJob._id}/approve_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, design_file: designFilePath, drive_link: `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`, notes: designNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      await updateStatusAfterDesignUpload("production");
      message.success("Design approved!");
      closeDesignModal(); loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setApproving(false); }
  };

  const handleRejectDesign = async () => {
    if (!rejectReason.trim()) { message.warning("Please provide a rejection reason"); return; }
    setRejecting(true);
    try {
      const res = await fetch(`${BASE}/${designJob._id}/reject_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Rejection failed");
      message.success("Design rejected with feedback.");
      closeDesignModal(); loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setRejecting(false); }
  };

  // ─── Derived counts ───────────────────────────────────────────────────────
  const jobHasDesign = (j) =>
    !!(j.design_file || j.cart_items?.some((i) => i.design_file));

  const jobIsDesignDone = (j) =>
    jobHasDesign(j) || j.design_status === "approved";

  const activeJobsCount     = jobs.filter((j) => !jobIsDesignDone(j)).length;
  const liveCount           = Object.values(sessionMap).filter((s) => s?.has_open_session).length;
  const onHoldCount         = jobs.filter((j) => j.job_status === "on_hold" && !jobIsDesignDone(j)).length;
  const designUploadedCount = jobs.filter((j) => jobHasDesign(j) && j.design_status !== "approved").length;
  const approvedDesignCount = jobs.filter((j) => j.design_status === "approved").length;
  const accessPendingCount  = Object.values(infoRequestMap).filter((r) => r?.status === "pending").length;

  // ─── Filtered jobs ────────────────────────────────────────────────────────
  const filteredJobs = jobs.filter((job) => {
    const sessData = sessionMap[job._id];
    switch (activeFilter) {
      case FILTER_LIVE:
        return sessData?.has_open_session === true;
      case FILTER_ON_HOLD:
        return job.job_status === "on_hold" && !jobIsDesignDone(job);
      case FILTER_DESIGN_UPLOADED:
        return jobHasDesign(job) && job.design_status !== "approved";
      case FILTER_ACCESS_PENDING:
        return infoRequestMap[job._id]?.status === "pending";
      case FILTER_APPROVED_DESIGN:
        return job.design_status === "approved";
      default:
        return !jobIsDesignDone(job);
    }
  });

  // ─── Summary strip config ─────────────────────────────────────────────────
  const summaryItems = [
    { key: FILTER_ALL,             label: "Total Assigned",  value: activeJobsCount,         color: "#3b82f6", bg: "#eff6ff", activeBg: "#dbeafe", border: "#bfdbfe" },
    { key: FILTER_LIVE,            label: "Live Sessions",   value: liveCount,               color: "#16a34a", bg: "#f0fdf4", activeBg: "#dcfce7", border: "#86efac" },
    { key: FILTER_ON_HOLD,         label: "On Hold",         value: onHoldCount,             color: "#f97316", bg: "#fff7ed", activeBg: "#ffedd5", border: "#fdba74" },
    { key: FILTER_DESIGN_UPLOADED, label: "Design Uploaded", value: designUploadedCount,     color: "#8b5cf6", bg: "#f5f3ff", activeBg: "#ede9fe", border: "#c4b5fd" },
    { key: FILTER_APPROVED_DESIGN, label: "Design Approved", value: approvedDesignCount,     color: "#be185d", bg: "#fce7f3", activeBg: "#fbcfe8", border: "#f9a8d4" },
    ...(!isSuperAdmin ? [
      { key: FILTER_ACCESS_PENDING, label: "Access Pending", value: accessPendingCount,      color: "#d97706", bg: "#fffbeb", activeBg: "#fef3c7", border: "#fcd34d" },
    ] : []),
  ];

  const existingDesignFile = designJob?.design_file;
  const cartDesignFile = designJob?.cart_items?.find((i) => i.design_file)?.design_file;
  const hasExistingDesign = !!(existingDesignFile || cartDesignFile);
  const designSessData = designJob ? sessionMap[designJob._id] : null;
  const designLiveSecs = designJob ? getLiveDisplaySecs(designJob._id) : 0;

  return (
    <div style={{ padding: "16px", background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%,#faf5ff 100%)", minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "14px 18px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#1e3a8a,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileImageOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>My Design Jobs</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Hi <strong>{userName}</strong> · {jobs.length} job{jobs.length !== 1 ? "s" : ""} · Updated {lastRefresh.format("HH:mm:ss")} ·{" "}
              <span style={{ color: "#16a34a", fontWeight: 600 }}>{isSuperAdmin ? "All design jobs" : `Assigned to ${userName}`}</span>
            </p>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} style={{ borderRadius: 8 }} />
        </Tooltip>
      </div>

      {/* ── Summary strip (CLICKABLE FILTERS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${summaryItems.length}, minmax(0, 1fr))`, gap: 10, marginBottom: 16 }}>
        {summaryItems.map(({ key, label, value, color, bg, activeBg, border }) => {
          const isActive = activeFilter === key;
          return (
            <div
              key={key}
              onClick={() => setActiveFilter(isActive ? FILTER_ALL : key)}
              style={{
                background: isActive ? activeBg : bg,
                borderRadius: 10, padding: "10px 10px",
                border: `${isActive ? "2px" : "1px"} solid ${isActive ? color : `${color}33`}`,
                cursor: "pointer",
                transition: "all 0.18s ease",
                boxShadow: isActive ? `0 0 0 3px ${color}22, 0 2px 8px ${color}22` : "none",
                transform: isActive ? "translateY(-1px)" : "none",
                position: "relative",
              }}
            >
              {isActive && (
                <div style={{
                  position: "absolute", top: 6, right: 8,
                  width: 7, height: 7, borderRadius: "50%",
                  background: color, animation: "pulse 1.5s infinite",
                }} />
              )}
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: isActive ? color : "#6b7280", fontWeight: isActive ? 700 : 600 }}>{label}</div>
              {isActive && (
                <div style={{ fontSize: 8, color, fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  ● Filtering
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active filter banner ── */}
      {activeFilter !== FILTER_ALL && (
        <div style={{
          background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
          padding: "8px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, color: "#0369a1", fontWeight: 600 }}>
            Showing <strong>{filteredJobs.length}</strong> job{filteredJobs.length !== 1 ? "s" : ""} for filter: <strong>{summaryItems.find((s) => s.key === activeFilter)?.label}</strong>
          </span>
          <Button size="small" onClick={() => setActiveFilter(FILTER_ALL)}
            style={{ fontSize: 11, height: 24, borderRadius: 6, color: "#0369a1", borderColor: "#bae6fd" }}>
            Clear Filter ×
          </Button>
        </div>
      )}

      {/* ── Privacy notice for designers ── */}
      {!isSuperAdmin && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <LockOutlined style={{ color: "#0369a1", fontSize: 16, marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: "#0c4a6e" }}>
            <strong>Privacy Policy:</strong> Customer names and phone numbers are hidden by default.
            To view contact details for a specific job, click <strong>"Request Info"</strong> on the job card.
            An admin will review and grant access within your work session.
          </div>
        </div>
      )}

      {/* ── Job Grid ── */}
      <Spin spinning={loading}>
        {filteredJobs.length === 0 && !loading ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "60px 20px", textAlign: "center", border: "1px solid #e5e7eb" }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 4 }}>
                  {activeFilter === FILTER_ALL ? "No jobs assigned" : `No jobs match this filter`}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {activeFilter === FILTER_ALL
                    ? "Jobs assigned to you that are pending design work will appear here."
                    : `No jobs currently in "${summaryItems.find((s) => s.key === activeFilter)?.label}" state.`}
                </div>
                {activeFilter !== FILTER_ALL && (
                  <Button size="small" onClick={() => setActiveFilter(FILTER_ALL)} style={{ marginTop: 10, borderRadius: 8 }}>Show All Jobs</Button>
                )}
              </div>
            } />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
            {filteredJobs.map((job) => {
              const sessData = sessionMap[job._id];
              const displaySess = sessData ? { ...sessData, total_duration_seconds: getLiveDisplaySecs(job._id) } : null;
              const reqInfo = infoRequestMap[job._id] || { status: "none", has_access: false };
              return (
                <JobCard key={job._id} job={job} sessionData={displaySess}
                  infoRequestStatus={reqInfo.status} hasInfoAccess={reqInfo.has_access}
                  isSuperAdmin={isSuperAdmin}
                  onOpenSession={handleOpenSession} onCloseSession={handleCloseSession}
                  onViewUpload={openDesignModal} onRequestInfo={openRequestModal}
                  requestingInfo={requestingInfo} userEmail={user?.email} />
              );
            })}
          </div>
        )}
      </Spin>

      {/* ════ REQUEST INFO MODAL ════ */}
      <Modal open={requestModal} onCancel={() => !submittingReq && setRequestModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InfoCircleOutlined style={{ color: "#0369a1" }} />
            <span style={{ fontWeight: 700 }}>Request Customer Info Access</span>
            {requestJob && <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>{requestJob.job_no}</Tag>}
          </div>
        }
        footer={[
          <Button key="c" onClick={() => setRequestModal(false)} disabled={submittingReq}>Cancel</Button>,
          <Button key="ok" type="primary" loading={submittingReq} onClick={submitInfoRequest} style={{ background: "#0369a1", border: "none" }}>Send Request</Button>,
        ]}
        width={440} destroyOnClose>
        <div>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <LockOutlined style={{ color: "#0369a1", fontSize: 14 }} />
              <span style={{ fontWeight: 700, color: "#0c4a6e", fontSize: 13 }}>Why is this required?</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#0c4a6e", lineHeight: 1.6 }}>
              Customer contact details are protected to safeguard privacy. Your request will be reviewed by an admin. Once approved, you'll be able to see the customer's name and phone number for this job.
            </p>
          </div>
          {requestJob && (
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Requesting access for:</div>
              <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{requestJob.job_no}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{(requestJob.cart_items || []).map((i) => i.product_name).join(", ")}</div>
            </div>
          )}
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Reason for Request (optional)
          </label>
          <TextArea rows={3} placeholder="e.g. Need to coordinate delivery timing with customer…" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} style={{ borderRadius: 8 }} />
          <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280" }}>
            <HourglassOutlined style={{ marginRight: 4 }} />An admin will review your request. You'll see the status update on the job card.
          </div>
        </div>
      </Modal>

      {/* ════ SESSION NOTES MODAL ════ */}
      <Modal open={notesModal} onCancel={() => !actioning && setNotesModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pendingAction?.action === "open" ? <PlayCircleOutlined style={{ color: "#1e40af" }} /> : pendingAction?.action === "on_hold" ? <PauseCircleOutlined style={{ color: "#f97316" }} /> : <CheckCircleOutlined style={{ color: "#16a34a" }} />}
            <span style={{ fontWeight: 700 }}>
              {pendingAction?.action === "open" && "Start / Resume Session"}
              {pendingAction?.action === "on_hold" && "Pause Session (On Hold)"}
              {pendingAction?.action === "completed" && "Complete Design Stage"}
            </span>
            {pendingAction?.job && <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>{pendingAction.job.job_no}</Tag>}
          </div>
        }
        footer={[
          <Button key="c" onClick={() => setNotesModal(false)} disabled={actioning}>Cancel</Button>,
          <Button key="ok" type="primary" loading={actioning} onClick={handleConfirmAction}
            style={{ background: pendingAction?.action === "on_hold" ? "#f97316" : pendingAction?.action === "completed" ? "#16a34a" : "#1e40af", border: "none" }}>
            Confirm
          </Button>,
        ]}
        width={440} destroyOnClose>
        {pendingAction?.job && (() => {
          const sessData = sessionMap[pendingAction.job._id];
          return (
            <div>
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 14, border: "1px solid #e5e7eb" }}>
                <div style={{ fontWeight: 700, color: "#111827" }}>{pendingAction.job.job_no}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Stage: <strong>{pendingAction.job.current_stage?.stage_label || "Design"}</strong></div>
              </div>
              {(pendingAction.action === "on_hold" || pendingAction.action === "completed") && sessData && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}><ClockCircleOutlined style={{ marginRight: 4 }} />Time Logged So Far</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1e40af", fontFamily: "monospace" }}>{fmtSecs(getLiveDisplaySecs(pendingAction.job._id))}</div>
                  {sessData.worked_days > 0 && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sessData.worked_days} day{sessData.worked_days !== 1 ? "s" : ""} worked · {sessData.closed_sessions} session{sessData.closed_sessions !== 1 ? "s" : ""} closed</div>
                  )}
                  {sessData.daily_summary?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {sessData.daily_summary.map((d, i) => (
                        <div key={d.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#374151", padding: "2px 0", borderTop: i > 0 ? "1px solid #e0f2fe" : undefined }}>
                          <span>Day {i + 1} — {dayjs(d.date).format("DD MMM")}</span>
                          <span style={{ fontWeight: 700, color: "#0369a1" }}>{d.display}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes (optional)</label>
              <TextArea rows={3}
                placeholder={pendingAction.action === "open" ? "Starting Day 1 / resuming work…" : pendingAction.action === "on_hold" ? "Done for today, resuming tomorrow…" : "Final notes for design completion…"}
                value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} style={{ borderRadius: 8 }} />
            </div>
          );
        })()}
      </Modal>

      {/* ════ DESIGN UPLOAD + REVIEW MODAL ════ */}
      <Modal open={designModal} onCancel={closeDesignModal}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileImageOutlined style={{ color: "#7c3aed" }} />
            <span style={{ fontWeight: 700 }}>Design Workspace</span>
            {designJob && <Tag color="purple" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>{designJob.job_no}</Tag>}
          </div>
        }
        footer={null} width={600} destroyOnClose styles={{ body: { maxHeight: "82vh", overflowY: "auto", padding: "16px 20px" } }}>
        {designJob && (
          <div>
            <div style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1px solid #ddd6fe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{designJob.job_no}</div>
                  <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>Created by: <strong>{designJob.created_by || "—"}</strong></div>
                  {(isSuperAdmin || infoRequestMap[designJob._id]?.has_access || user?.email === "hari@dmedia.in") && (
                    <div style={{ fontSize: 14, color: "#374151", marginTop: 4 }}>
                      <UserOutlined style={{ marginRight: 4 }} /><strong>{designJob.customer_name}</strong>
                      {designJob.customer_phone && <span style={{ marginLeft: 8, color: "#6b7280" }}><PhoneOutlined style={{ marginRight: 3 }} />{designJob.customer_phone}</span>}
                    </div>
                  )}
                </div>
                <StatusBadge status={designJob.job_status} />
              </div>
              <div style={{ marginTop: 10 }}>
                {(designJob.cart_items || []).map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#374151", display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: i > 0 ? "1px solid #e9d5ff" : undefined }}>
                    <span><strong>{item.product_name}</strong>{item.size && <span style={{ color: "#9ca3af" }}> · {item.size}</span>}{item.notes && <span style={{ color: "#7c3aed" }}> · {item.notes}</span>}</span>
                    <span style={{ fontWeight: 700, color: "#1e40af" }}>₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: liveTimers[designJob._id] ? "#eff6ff" : "#f9fafb", border: `1px solid ${liveTimers[designJob._id] ? "#bfdbfe" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />Accumulated Design Time
                {liveTimers[designJob._id] && <span style={{ marginLeft: 8, color: "#16a34a", background: "#dcfce7", padding: "1px 6px", borderRadius: 8, fontSize: 10 }}>● LIVE</span>}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: liveTimers[designJob._id] ? "#1e40af" : "#9ca3af", letterSpacing: "0.08em" }}>{fmtSecs(designLiveSecs)}</div>
              {designSessData && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {designSessData.worked_days || 0} day{(designSessData.worked_days || 0) !== 1 ? "s" : ""} · {designSessData.closed_sessions || 0} session{(designSessData.closed_sessions || 0) !== 1 ? "s" : ""} closed
                </div>
              )}
            </div>

            {designSessData?.daily_summary?.length > 0 && (
              <DailySummaryBar dailySummary={designSessData.daily_summary} totalSecs={designLiveSecs} workedDays={designSessData.worked_days || 0} />
            )}

            {(designJob.cart_items || []).some((i) => i.design_file) && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  <EyeOutlined style={{ marginRight: 4 }} />Reference Design(s) from Order
                </div>
                {(designJob.cart_items || []).filter((i) => i.design_file).map((item, idx) => (
                  <DesignFilePreview key={idx} fileUrl={item.design_file} label={`${item.product_name} — Reference`} />
                ))}
              </>
            )}

            <Divider style={{ margin: "4px 0 14px" }}><span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Design Upload</span></Divider>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#5b21b6" }}>
                <strong style={{ display: "block", marginBottom: 3 }}><PictureOutlined style={{ marginRight: 4 }} />Sample (stored in system)</strong>
                Compressed JPEG ≤ 1 MB for quick preview inside the app.
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#78350f" }}>
                <strong style={{ display: "block", marginBottom: 3 }}><CloudUploadOutlined style={{ marginRight: 4 }} />Original (Google Drive)</strong>
                Full-quality file on Drive. Auto-deleted after 48 hrs.
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <PictureOutlined style={{ marginRight: 4 }} />{existingDesignFile ? "Update Sample File" : "Upload Sample File"} (auto-compressed ≤ 1 MB)
              </div>
              {existingDesignFile && !samplePreviewUrl && <DesignFilePreview fileUrl={existingDesignFile} label="Current Sample" isSample />}
              {samplePreviewUrl && <DesignFilePreview fileUrl={samplePreviewUrl} label="New Sample Preview" isSample />}
              <SampleUploadPanel onSampleReady={handleSampleReady} onFileSelected={setOriginalFile} sampleInfo={sampleInfo} />

              {/* ── REPLACED: <UploadHelper> → <MultiFileUploader> ── */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontStyle: "italic" }}>
                  Upload one or more design files below (PDF · JPG · PNG · WEBP · CDR · DXF). The first successful upload is used as the sample path.
                </div>
                <MultiFileUploader
                  setImagePath={(path) => setDesignFilePath(path)}
                  image_path={designFilePath}
                />
              </div>

              <div style={{ marginTop: 6 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Upload Notes</label>
                <TextArea rows={2} placeholder="Describe the design, version notes…" value={designNotes} onChange={(e) => setDesignNotes(e.target.value)} style={{ borderRadius: 8 }} />
              </div>
              <Button type="primary" icon={<UploadOutlined />} loading={uploading} disabled={!designFilePath && !samplePreviewUrl} onClick={handleUploadDesign}
                style={{ marginTop: 10, width: "100%", height: 38, background: "#7c3aed", border: "none", borderRadius: 8, fontWeight: 600 }}>
                {existingDesignFile ? "Update Sample" : "Save Sample"}{designLiveSecs > 0 && ` (${fmtSecs(designLiveSecs)} logged)`}
              </Button>
            </div>

            <div style={{ marginTop: 16 }}>
              <DriveUploadSection jobNo={designJob.job_no} driveLinkValue={driveLink} onDriveLinkChange={setDriveLink} />
            </div>

            {driveLink && existingDesignFile && (
              <Button icon={<LinkOutlined />}
                onClick={async () => {
                  try {
                    const res = await fetch(`${BASE}/${designJob._id}/upload_design`, {
                      method: "POST", headers: jsonHeader(),
                      body: JSON.stringify({ design_file: designJob.design_file, design_drive_link: driveLink, handled_by: { user_id: userId, name: userName }, stage: designJob.current_stage?.stage || "design" }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.message);
                    message.success("Drive link saved!"); loadJobs();
                  } catch (err) { message.error(err.message); }
                }}
                style={{ width: "100%", height: 34, marginBottom: 14, borderRadius: 8, fontWeight: 600, fontSize: 12, color: "#d97706", borderColor: "#fcd34d", background: "#fffbeb" }}>
                Save Drive Link (without re-uploading sample)
              </Button>
            )}

            {hasExistingDesign && (
              <>
                <Divider style={{ margin: "12px 0" }}><span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Design Review</span></Divider>
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>
                   A design file has been uploaded. You can approve or reject it below.
                  {designJob.design_status === "rejected" && designJob.design_rejection_reason && (
                    <div style={{ marginTop: 6, color: "#ef4444", fontWeight: 600 }}>⚠ Previously rejected: "{designJob.design_rejection_reason}"</div>
                  )}
                </div>
                {!showRejectInput ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    <Popconfirm title="Approve this design?" description="This will mark the design as approved and move the job forward." onConfirm={handleApproveDesign} okText="Approve" okButtonProps={{ style: { background: "#16a34a", border: "none" } }}>
                      <Button type="primary" icon={<CheckCircleOutlined />} loading={approving}
                        style={{ flex: 1, height: 38, background: "#16a34a", border: "none", borderRadius: 8, fontWeight: 600 }}>Approve Design</Button>
                    </Popconfirm>
                    <Button icon={<CloseCircleOutlined />} onClick={() => setShowRejectInput(true)}
                      style={{ flex: 1, height: 38, color: "#ef4444", borderColor: "#fca5a5", borderRadius: 8, fontWeight: 600 }}>Reject Design</Button>
                  </div>
                ) : (
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Rejection Reason <span style={{ color: "#ef4444" }}>*</span>
                    </div>
                    <TextArea rows={3} placeholder="Explain what needs to be fixed…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ borderRadius: 8, borderColor: "#fca5a5", marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button danger icon={<CloseCircleOutlined />} loading={rejecting} onClick={handleRejectDesign} style={{ flex: 1, borderRadius: 8, fontWeight: 600 }}>Confirm Reject</Button>
                      <Button onClick={() => { setShowRejectInput(false); setRejectReason(""); }} style={{ borderRadius: 8 }}>Back</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DesignerJobDashboard;

