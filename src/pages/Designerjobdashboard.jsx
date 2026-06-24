import { useEffect, useState, useCallback, useRef } from "react";
import {
  Button, Tag, Modal, Input, Spin, Empty, Tooltip, Divider,
  message, Popconfirm, Progress, Table, Space, Select,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UploadOutlined, PlayCircleOutlined, EyeOutlined, FileImageOutlined,
  UserOutlined, PhoneOutlined, ReloadOutlined, PauseCircleOutlined,
  HistoryOutlined, CloudUploadOutlined, WarningOutlined, LinkOutlined,
  PictureOutlined, LockOutlined, UnlockOutlined, SendOutlined,
  InfoCircleOutlined, HourglassOutlined, TeamOutlined, FilePdfOutlined,
  FileOutlined, DeleteOutlined, LoadingOutlined, TagOutlined, AppstoreOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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



// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const BASE            = "https://api.dmedia.in/api/jobs";
const INFO_BASE       = "https://api.dmedia.in/api/info-requests";
const DRIVE_FOLDER_ID = "118wOyN-T0N9IZbiQUER7khCOaEH9GfRQ";

const FILTER_ALL             = "all";
const FILTER_LIVE            = "live";
const FILTER_ON_HOLD         = "on_hold";
const FILTER_DESIGN_UPLOADED = "design_uploaded";
const FILTER_ACCESS_PENDING  = "access_pending";
const FILTER_APPROVED_DESIGN = "approved_design";

const DESIGN_FILE_LABELS = [
  "Cutting File", "Printing File", "Mockup", "Reference", "Final Artwork", "Other",
];

const OUTSOURCE_OPTION = { _id: "outsource", name: "Outsource", role: "outsource" };

// ─────────────────────────────────────────────────────────────────────────────
// Helper: is a job a "design stage" job?
// ─────────────────────────────────────────────────────────────────────────────
const isDesignJob = (j) =>
  j.job_status === "design" ||
  j.current_stage?.stage === "design" ||
  j.design_status === "rejected" ||
  j.design_status === "approved" ||
  !!j.design_file ||
  j.cart_items?.some(
    (i) =>
      i.design_files?.length ||
      i.design_file ||
      i.design_status === "uploaded" ||
      i.design_status === "approved" ||
      i.design_status === "rejected",
  );

// ─────────────────────────────────────────────────────────────────────────────
// File type helpers
// ─────────────────────────────────────────────────────────────────────────────
const MIME_MAP = {
  "image/jpeg": { label: "JPEG", compressible: true },
  "image/jpg":  { label: "JPG",  compressible: true },
  "image/png":  { label: "PNG",  compressible: true },
  "image/webp": { label: "WEBP", compressible: true },
  "application/pdf": { label: "PDF", compressible: false },
};
const EXT_MAP = {
  jpg:  { label: "JPG",  compressible: true  },
  jpeg: { label: "JPEG", compressible: true  },
  png:  { label: "PNG",  compressible: true  },
  webp: { label: "WEBP", compressible: true  },
  pdf:  { label: "PDF",  compressible: false },
  cdr:  { label: "CDR",  compressible: false },
  dxf:  { label: "DXF",  compressible: false },
};

const getExt          = (file) => file.name.split(".").pop()?.toLowerCase() || "";
const getFileTypeMeta = (file) => MIME_MAP[file.type] || EXT_MAP[getExt(file)] || null;
const isFileSupported = (file) => !!getFileTypeMeta(file);

// ─────────────────────────────────────────────────────────────────────────────
// Design file normalizer
// ─────────────────────────────────────────────────────────────────────────────
const normalizeDesignFile = (file) => {
  if (!file) return null;
  if (typeof file === "string")
    return {
      url: file, file_name: file.split("/").pop() || file,
      file_type: file.split(".").pop() || "", label: "Other",
      caption: "", uploaded_by: null, uploaded_at: null, _id: null,
      isLegacySingleFile: true,
    };
  return {
    url:       file.url,
    file_name: file.file_name || file.url?.split("/").pop() || "Untitled",
    file_type: file.file_type || file.url?.split(".").pop() || "",
    label:     file.label    || "Other",
    caption:   file.caption  || "",
    uploaded_by:  file.uploaded_by  || null,
    assigned_to:  file.assigned_to  || null,
    uploaded_at:  file.uploaded_at  || null,
    _id:          file._id          || null,
    isLegacySingleFile: false,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Image compression
// ─────────────────────────────────────────────────────────────────────────────
const MAX_COMPRESSED_BYTES = 500 * 1024;
const MAX_DIMENSION        = 2400;

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload  = (evt) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload  = () => {
        const scale =
          img.width > MAX_DIMENSION || img.height > MAX_DIMENSION
            ? MAX_DIMENSION / Math.max(img.width, img.height) : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const tryQ = (q) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("canvas.toBlob failed")); return; }
            if (blob.size <= MAX_COMPRESSED_BYTES || q <= 0.1) {
              const outName = file.name.replace(/\.[^.]+$/, ".jpg");
              resolve({
                file: new File([blob], outName, { type: "image/jpeg" }),
                previewUrl:       URL.createObjectURL(blob),
                originalSizeKB:   Math.round(file.size / 1024),
                compressedSizeKB: Math.round(blob.size / 1024),
              });
            } else { tryQ(Math.max(q - 0.1, 0.1)); }
          }, "image/jpeg", q);
        };
        tryQ(0.85);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Upload file to server with retry
// ─────────────────────────────────────────────────────────────────────────────
const uploadFileToServer = async (file, onProgress = null) => {
  const maxRetries = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("image", file, file.name);
      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      return await new Promise((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              const url = result?.data?.data?.url || result?.data?.url || result?.url || "";
              if (!url) reject(new Error("Upload succeeded but no URL returned"));
              else resolve(url);
            } catch { reject(new Error("Invalid response format: " + xhr.responseText)); }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        });
        xhr.addEventListener("error",   () => reject(new Error(`Network error (attempt ${attempt}/${maxRetries})`)));
        xhr.addEventListener("abort",   () => reject(new Error("Upload aborted")));
        xhr.timeout = 60000;
        xhr.addEventListener("timeout", () => reject(new Error(`Upload timeout (attempt ${attempt}/${maxRetries})`)));
        xhr.open("POST", `${BASE.replace("/api/jobs", "/api/upload_images")}`);
        xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("authToken")}`);
        xhr.send(formData);
      });
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// UI components
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  accepted:    { label: "Accepted",    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  on_hold:     { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  rejected:    { label: "Rejected",    color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  design:      { label: "Design",      color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  production:  { label: "Production",  color: "#7c3aed", bg: "#faf5ff", border: "#c4b5fd" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.design;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:20, background:s.bg, border:`1px solid ${s.border}`, color:s.color,
      fontSize:11, fontWeight:700, letterSpacing:"0.04em" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.color }} />
      {s.label}
    </span>
  );
};

const ITEM_DESIGN_CFG = {
  pending:  { label:"Pending",  color:"#9ca3af", bg:"#f9fafb", border:"#e5e7eb" },
  uploaded: { label:"Uploaded", color:"#7c3aed", bg:"#faf5ff", border:"#c4b5fd" },
  approved: { label:"Approved", color:"#16a34a", bg:"#f0fdf4", border:"#86efac" },
  rejected: { label:"Rejected", color:"#ef4444", bg:"#fef2f2", border:"#fca5a5" },
};

const ItemDesignBadge = ({ status }) => {
  const cfg = ITEM_DESIGN_CFG[status] || ITEM_DESIGN_CFG.pending;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px",
      borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.border}`,
      color:cfg.color, fontSize:10, fontWeight:700 }}>
      {status === "approved" && <CheckCircleOutlined />}
      {status === "rejected" && <CloseCircleOutlined />}
      {status === "uploaded" && <FileImageOutlined />}
      {cfg.label}
    </span>
  );
};

const InfoRequestBadge = ({ requestStatus }) => {
  if (!requestStatus || requestStatus === "none") return null;
  const cfg = {
    pending:  { label:"Access Pending", color:"#d97706", bg:"#fffbeb", border:"#fcd34d", icon:<HourglassOutlined /> },
    approved: { label:"Access Granted", color:"#16a34a", bg:"#f0fdf4", border:"#86efac", icon:<UnlockOutlined /> },
    rejected: { label:"Access Denied",  color:"#ef4444", bg:"#fef2f2", border:"#fca5a5", icon:<CloseCircleOutlined /> },
  }[requestStatus];
  if (!cfg) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px",
      borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.border}`,
      color:cfg.color, fontSize:10, fontWeight:700 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const DailySummaryBar = ({ dailySummary = [], totalSecs = 0, workedDays = 0 }) => {
  if (!dailySummary.length) return null;
  const maxSecs = Math.max(...dailySummary.map((d) => d.seconds), 1);
  return (
    <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#0369a1", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8, display:"flex", justifyContent:"space-between" }}>
        <span><HistoryOutlined style={{ marginRight:4 }} />Work History ({workedDays} day{workedDays !== 1 ? "s" : ""})</span>
        <span style={{ color:"#1e40af" }}>Total: {fmtSecs(totalSecs)}</span>
      </div>
      {dailySummary.map((day, i) => {
        const pct = Math.round((day.seconds / maxSecs) * 100);
        return (
          <div key={day.date} style={{ marginBottom: i < dailySummary.length - 1 ? 6 : 0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#374151", marginBottom:2, fontWeight:600 }}>
              <span>Day {i + 1} — {dayjs(day.date).format("DD MMM")}</span>
              <span style={{ color:"#0369a1" }}>{day.display}</span>
            </div>
            <div style={{ height:6, background:"#e0f2fe", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#3b82f6,#0ea5e9)", borderRadius:4, transition:"width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FILE_TYPE_COLORS = {
  JPEG:{ bg:"#eff6ff", color:"#1e40af", border:"#bfdbfe" },
  JPG: { bg:"#eff6ff", color:"#1e40af", border:"#bfdbfe" },
  PNG: { bg:"#f0fdf4", color:"#166534", border:"#86efac" },
  WEBP:{ bg:"#f5f3ff", color:"#5b21b6", border:"#c4b5fd" },
  PDF: { bg:"#fef2f2", color:"#991b1b", border:"#fca5a5" },
  CDR: { bg:"#fffbeb", color:"#92400e", border:"#fcd34d" },
  DXF: { bg:"#f0f9ff", color:"#0c4a6e", border:"#bae6fd" },
};

const FileTypeBadge = ({ label }) => {
  const c = FILE_TYPE_COLORS[label?.toUpperCase()] || { bg:"#f8fafc", color:"#374151", border:"#e5e7eb" };
  return (
    <span style={{ fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:4,
      background:c.bg, color:c.color, border:`1px solid ${c.border}`,
      textTransform:"uppercase", letterSpacing:"0.06em" }}>
      {label}
    </span>
  );
};

const LABEL_COLORS = {
  "Cutting File":  { bg:"#fff7ed", color:"#c2410c", border:"#fdba74" },
  "Printing File": { bg:"#eff6ff", color:"#1e40af", border:"#bfdbfe" },
  "Mockup":        { bg:"#f5f3ff", color:"#5b21b6", border:"#c4b5fd" },
  "Reference":     { bg:"#f0fdf4", color:"#166534", border:"#86efac" },
  "Final Artwork": { bg:"#fce7f3", color:"#be185d", border:"#f9a8d4" },
  "Other":         { bg:"#f8fafc", color:"#374151", border:"#e5e7eb" },
};

const LabelBadge = ({ label }) => {
  const c = LABEL_COLORS[label] || LABEL_COLORS.Other;
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:8,
      background:c.bg, color:c.color, border:`1px solid ${c.border}`,
      display:"inline-flex", alignItems:"center", gap:4 }}>
      <TagOutlined style={{ fontSize:10 }} />{label}
    </span>
  );
};

const DESIGNER_STATUS_CFG = {
  assigned:    { color:"#6b7280", bg:"#f9fafb", border:"#e5e7eb" },
  in_progress: { color:"#d97706", bg:"#fffbeb", border:"#fcd34d" },
  uploaded:    { color:"#7c3aed", bg:"#faf5ff", border:"#c4b5fd" },
  approved:    { color:"#16a34a", bg:"#f0fdf4", border:"#86efac" },
  rejected:    { color:"#ef4444", bg:"#fef2f2", border:"#fca5a5" },
};

const DesignersStrip = ({ designers = [] }) => {
  if (!designers.length) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
      {designers.map((d) => {
        const cfg = DESIGNER_STATUS_CFG[d.status] || DESIGNER_STATUS_CFG.assigned;
        return (
          <span key={d._id || d.user_id} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 8px", borderRadius:20, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, fontSize:11, fontWeight:600 }}>
            <UserOutlined style={{ fontSize:10 }} />{d.name}
            <span style={{ fontSize:10, opacity:0.8 }}>· {d.status}</span>
          </span>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QueuedFileItem
// ─────────────────────────────────────────────────────────────────────────────
const QueuedFileItem = ({ item, onRemove, onLabelChange, onAssigneeChange, designers = [], canManage }) => {
  const isImage = item.previewUrl && item.compressible;
  const isPdf   = item.fileTypeLabel === "PDF";
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10,
      background: item.uploading ? "#f0f9ff" : item.error ? "#fef2f2" : item.uploaded ? "#f0fdf4" : "#fafafa",
      border:`1px solid ${item.error ? "#fca5a5" : item.uploaded ? "#86efac" : "#e5e7eb"}`,
      borderRadius:10, padding:"10px 10px", marginBottom:8 }}>
      <div style={{ width:44, height:44, borderRadius:8, overflow:"hidden", flexShrink:0,
        background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #e5e7eb" }}>
        {isImage
          ? <img src={item.previewUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : isPdf
            ? <FilePdfOutlined style={{ fontSize:22, color:"#ef4444" }} />
            : <FileOutlined style={{ fontSize:22, color:"#6b7280" }} />
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, fontWeight:600, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>
            {item.name}
          </span>
          <FileTypeBadge label={item.fileTypeLabel} />
        </div>
        {canManage ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:4 }}>
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:2 }}>File Type</label>
              <Select size="small" value={item.captionLabel} onChange={(val) => onLabelChange(item.id, val)}
                style={{ width:"100%" }} options={DESIGN_FILE_LABELS.map((l) => ({ value:l, label:l }))}
                disabled={item.uploading || item.uploaded} />
            </div>
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:2 }}>Assign To</label>
              <Select size="small" placeholder="Select designer" value={item.assignedTo || undefined}
                onChange={(val) => onAssigneeChange(item.id, val)} style={{ width:"100%" }}
                options={designers.map((d) => ({ value:d._id, label: d._id === "outsource" ? "Outsource" : `${d.name} (${d.role})` }))}
                disabled={item.uploading || item.uploaded} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize:10, color:"#9ca3af", marginBottom:4 }}>
            Admin will label & assign this after upload
          </div>
        )}
        <div style={{ fontSize:10, color:"#6b7280", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {item.compressible && item.originalSizeKB
            ? <span>{item.originalSizeKB} KB → <strong style={{ color:"#16a34a" }}>{item.compressedSizeKB} KB</strong> compressed</span>
            : item.originalSizeKB ? <span>{item.originalSizeKB} KB</span> : null
          }
          {item.uploading && <span style={{ color:"#0369a1", fontWeight:600 }}><LoadingOutlined spin /> Uploading…</span>}
          {item.uploaded  && <span style={{ color:"#16a34a", fontWeight:600 }}><CheckCircleOutlined style={{ marginRight:3 }} />Saved</span>}
          {item.error     && <span style={{ color:"#ef4444", fontWeight:600 }}><CloseCircleOutlined style={{ marginRight:3 }} />{item.error}</span>}
        </div>
        {item.uploading && (
          <Progress percent={item.progress || 0} size="small" showInfo strokeColor="#3b82f6" style={{ marginTop:6, marginBottom:0 }} />
        )}
      </div>
      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
        {item.uploadedUrl && (
          <Tooltip title="Preview uploaded file">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => window.open(item.uploadedUrl, "_blank")}
              style={{ color:"#7c3aed", padding:"0 4px" }} />
          </Tooltip>
        )}
        <Tooltip title="Remove">
          <Button size="small" type="text" icon={<DeleteOutlined />}
            onClick={() => onRemove(item.id)}
            style={{ color:"#ef4444", padding:"0 4px" }} disabled={item.uploading} />
        </Tooltip>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ExistingDesignFileItem
// Handles both legacy (isLegacySingleFile) and array design files.
// For legacy files, reassign/approve/reject trigger migration first via the
// onReassign / onApprove / onReject callbacks (which call the migrate endpoint
// internally, then use the returned migrated file ID for the real operation).
// ─────────────────────────────────────────────────────────────────────────────
const ExistingDesignFileItem = ({
  file, onRemove, canManage, designers = [], onReassign, reassigning,
  showApproveReject, onApprove, onReject, approving, rejecting,
}) => {
  const f = normalizeDesignFile(file);
  if (!f) return null;
  const ftLabel = (f.file_type || "unknown").toUpperCase();
  const isImage = ["JPG", "JPEG", "PNG", "WEBP"].includes(ftLabel);
  const isPdf   = ftLabel === "PDF";

  const currentAssigneeValue =
    f.assigned_to?.role === "outsource" ? "outsource" : (f.assigned_to?.user_id || undefined);

  const [reassignOpen,  setReassignOpen]  = useState(false);
  const [reassignValue, setReassignValue] = useState(currentAssigneeValue);
  const [reassignLabel, setReassignLabel] = useState(f.label || "Other");
  const [showReject,    setShowReject]    = useState(false);
  const [rejectReason,  setRejectReason]  = useState("");

  const handleReassignSave = async () => {
    const ok = await onReassign(file, reassignValue, reassignLabel);
    if (ok) setReassignOpen(false);
  };

  const handleRejectConfirm = async () => {
    const ok = await onReject(rejectReason);
    if (ok) { setShowReject(false); setRejectReason(""); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, background:"#f0fdf4",
      border:"1px solid #86efac", borderRadius:10, padding:"8px 10px", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:44, height:44, borderRadius:8, overflow:"hidden", flexShrink:0,
          background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #e5e7eb" }}>
          {isImage
            ? <img src={f.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : isPdf
              ? <FilePdfOutlined style={{ fontSize:22, color:"#ef4444" }} />
              : <FileOutlined style={{ fontSize:22, color:"#6b7280" }} />
          }
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
            <LabelBadge label={f.label} />
            {ftLabel && <FileTypeBadge label={ftLabel} />}
            {f.isLegacySingleFile && (
              <span style={{ fontSize:9, fontWeight:700, color:"#9ca3af", textTransform:"uppercase",
                letterSpacing:"0.04em", background:"#fef3c7", border:"1px solid #fcd34d",
                borderRadius:4, padding:"1px 6px" }}>Legacy — will migrate on action</span>
            )}
          </div>
          <div style={{ fontSize:11, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.file_name}</div>
          {f.caption && <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>{f.caption}</div>}
          {f.assigned_to?.name && (
            <div style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>
              <UserOutlined style={{ marginRight:3 }} />{f.assigned_to.name}
              {f.uploaded_at && <span> · {dayjs(f.uploaded_at).format("DD MMM HH:mm")}</span>}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
          <Tooltip title="View file">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => window.open(f.url, "_blank")} style={{ color:"#7c3aed", padding:"0 4px" }} />
          </Tooltip>
          {/* Reassign shown for both legacy and array files when canManage */}
          {canManage && onReassign && !reassignOpen && (
            <Tooltip title={f.isLegacySingleFile ? "Assign designer (will migrate file)" : "Re-assign / Outsource"}>
              <Button size="small" type="text" icon={<SwapOutlined />}
                onClick={() => setReassignOpen(true)} style={{ color:"#1e40af", padding:"0 4px" }} />
            </Tooltip>
          )}
          {/* Remove only for array files (non-legacy) */}
          {canManage && onRemove && !f.isLegacySingleFile && (
            <Tooltip title="Remove">
              <Popconfirm title="Remove this design file?" onConfirm={() => onRemove(file)} okText="Remove" okButtonProps={{ danger:true }}>
                <Button size="small" type="text" icon={<DeleteOutlined />} style={{ color:"#ef4444", padding:"0 4px" }} />
              </Popconfirm>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Reassign panel — same UI for both legacy and array files */}
      {canManage && reassignOpen && (
        <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"8px 8px" }}>
          {f.isLegacySingleFile && (
            <div style={{ fontSize:10, color:"#d97706", fontWeight:600, marginBottom:6,
              background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6, padding:"4px 8px" }}>
              <WarningOutlined style={{ marginRight:4 }} />
              This legacy file will be migrated to the design files list, then assigned.
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:2 }}>
                {f.isLegacySingleFile ? "Assign To" : "Re-assign To"}
              </label>
              <Select size="small" placeholder="Choose designer or Outsource" value={reassignValue}
                onChange={setReassignValue} style={{ width:"100%" }}
                options={designers.map((d) => ({ value:d._id, label: d._id === "outsource" ? "Outsource" : `${d.name} (${d.role})` }))} />
            </div>
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", display:"block", marginBottom:2 }}>File Type Label</label>
              <Select size="small" value={reassignLabel} onChange={setReassignLabel}
                style={{ width:"100%" }} options={DESIGN_FILE_LABELS.map((l) => ({ value:l, label:l }))} />
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <Button size="small" type="primary" loading={reassigning} disabled={!reassignValue}
              onClick={handleReassignSave}
              style={{ flex:1, background:"#1e40af", border:"none" }}>
              {f.isLegacySingleFile ? "Migrate & Assign" : "Save"}
            </Button>
            <Button size="small" onClick={() => { setReassignOpen(false); setReassignValue(currentAssigneeValue); setReassignLabel(f.label || "Other"); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Approve / Reject — available for both legacy and array files */}
      {canManage && showApproveReject && (
        !showReject ? (
          <div>
            {f.isLegacySingleFile && (
              <div style={{ fontSize:10, color:"#d97706", fontWeight:600, marginBottom:6,
                background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6, padding:"4px 8px" }}>
                <WarningOutlined style={{ marginRight:4 }} />
                Approving/rejecting will first migrate this file to the design files list.
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <Popconfirm
                title={f.isLegacySingleFile ? "Migrate & approve this design?" : "Approve this design file?"}
                onConfirm={onApprove} okText="Approve"
                okButtonProps={{ style:{ background:"#16a34a", border:"none" } }}>
                <Button type="primary" size="small" icon={<CheckCircleOutlined />} loading={!!approving}
                  style={{ flex:1, height:30, background:"#16a34a", border:"none", borderRadius:8, fontWeight:600, fontSize:11 }}>
                 Approve
                </Button>
              </Popconfirm>
              <Button size="small" icon={<CloseCircleOutlined />} onClick={() => setShowReject(true)}
                style={{ flex:1, height:30, color:"#ef4444", borderColor:"#fca5a5", borderRadius:8, fontWeight:600, fontSize:11 }}>
                {f.isLegacySingleFile ? "Migrate & Reject" : "Reject"}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:10 }}>
            {f.isLegacySingleFile && (
              <div style={{ fontSize:10, color:"#d97706", fontWeight:600, marginBottom:6,
                background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6, padding:"4px 8px" }}>
                <WarningOutlined style={{ marginRight:4 }} />
                File will be migrated first, then rejected with this reason.
              </div>
            )}
            <Input.TextArea rows={2} placeholder="Explain what needs to be fixed…"
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              style={{ borderRadius:8, borderColor:"#fca5a5", marginBottom:8, fontSize:12 }} />
            <div style={{ display:"flex", gap:8 }}>
              <Button danger size="small" icon={<CloseCircleOutlined />} loading={!!rejecting}
                onClick={handleRejectConfirm}
                style={{ flex:1, borderRadius:8, fontWeight:600, fontSize:11 }}>
                Confirm Reject
              </Button>
              <Button size="small" onClick={() => { setShowReject(false); setRejectReason(""); }} style={{ borderRadius:8, fontSize:11 }}>Back</Button>
            </div>
          </div>
        )
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MultiFileUploadPanel
// ─────────────────────────────────────────────────────────────────────────────
const MultiFileUploadPanel = ({ files, onFilesAdded, onRemoveFile, onLabelChange, onAssigneeChange, processing, designers = [], canManage }) => {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleRawFiles = (rawFiles) => {
    const valid = [], invalid = [];
    for (const f of rawFiles) {
      if (isFileSupported(f)) valid.push(f); else invalid.push(f.name);
    }
    if (invalid.length) message.warning(`⚠️ Unsupported: ${invalid.join(", ")}`);
    if (valid.length) onFilesAdded(valid);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleRawFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => !processing && inputRef.current?.click()}
        style={{ border:`2px dashed ${dragging ? "#7c3aed" : "#c4b5fd"}`, borderRadius:12, padding:"16px 14px",
          background: dragging ? "#f5f0ff" : "#faf5ff", textAlign:"center",
          cursor: processing ? "default" : "pointer", transition:"all 0.2s", marginBottom:10 }}>
        <input ref={inputRef} type="file" multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf,.cdr,.dxf"
          style={{ display:"none" }}
          onChange={(e) => { handleRawFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        {processing
          ? <div style={{ color:"#7c3aed", fontSize:13 }}><Spin size="small" style={{ marginRight:8 }} />Processing files…</div>
          : <>
              <div style={{ fontSize:22, marginBottom:4 }}>📁</div>
              <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed", marginBottom:2 }}>Click or drag & drop files</div>
              <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:4, marginTop:6 }}>
                {["JPG","PNG","WEBP","PDF","CDR","DXF"].map((fmt) => (
                  <span key={fmt} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6, background:"#ede9fe", color:"#6d28d9", border:"1px solid #c4b5fd" }}>{fmt}</span>
                ))}
              </div>
            </>
        }
      </div>
      {files.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8, display:"flex", justifyContent:"space-between" }}>
            <span>{files.length} file{files.length !== 1 ? "s" : ""} queued</span>
            <span style={{ color:"#16a34a" }}>{files.filter((f) => f.uploaded).length} uploaded</span>
          </div>
          {files.map((item) => (
            <QueuedFileItem key={item.id} item={item} onRemove={onRemoveFile}
              onLabelChange={onLabelChange} onAssigneeChange={onAssigneeChange} designers={designers}
              canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DriveUploadSection
// ─────────────────────────────────────────────────────────────────────────────
const DriveUploadSection = ({ driveLinkValue, onDriveLinkChange }) => {
  const driveUrl = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;
  return (
    <div style={{ border:"1px solid #fbbf24", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
      <div style={{ padding:"10px 14px", background:"linear-gradient(135deg,#d97706,#f59e0b)", display:"flex", alignItems:"center", gap:8 }}>
        <CloudUploadOutlined style={{ color:"#fffbeb", fontSize:16 }} />
        <span style={{ fontWeight:800, color:"#fffbeb", fontSize:12, letterSpacing:"0.04em" }}>Original Quality — Google Drive Upload</span>
      </div>
      <div style={{ padding:"12px 14px", background:"#fffbeb" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 10px", marginBottom:12 }}>
          <WarningOutlined style={{ color:"#ef4444", fontSize:13, marginTop:1, flexShrink:0 }} />
          <div style={{ fontSize:11, color:"#991b1b", lineHeight:1.5 }}><strong>Auto-cleanup in 48 hours.</strong> Files in the shared Drive folder are deleted after 48 hours.</div>
        </div>
        <Button icon={<CloudUploadOutlined />} onClick={() => window.open(driveUrl, "_blank")}
          style={{ width:"100%", height:36, marginBottom:10, background:"#1a73e8", border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          Open Shared Drive Folder
        </Button>
        <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#6b7280", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          <LinkOutlined style={{ marginRight:4 }} />Paste Drive Share Link (optional)
        </label>
        <Input placeholder="https://drive.google.com/file/d/..." value={driveLinkValue}
          onChange={(e) => onDriveLinkChange(e.target.value)}
          style={{ borderRadius:8, borderColor:"#fcd34d", fontSize:12 }}
          prefix={<LinkOutlined style={{ color:"#f59e0b" }} />} />
        {driveLinkValue && (
          <div style={{ marginTop:6, fontSize:11, color:"#16a34a", display:"flex", alignItems:"center", gap:4 }}>
            <CheckCircleOutlined /> Drive link recorded.
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Per-Item Design Panel
// ═════════════════════════════════════════════════════════════════════════════
const ItemDesignPanel = ({
  item, itemId, canManage,
  queuedFiles, processingFiles,
  onFilesAdded, onRemoveQueuedFile, onLabelChange, onAssigneeChange,
  onSaveItem, savingItem,
  onRemoveExistingFile,
  // Handlers for array files
  onReassignExistingFile, reassigningFileId,
  // Handlers for legacy single file (migrate + action)
  onMigrateAndReassignLegacy, migratingLegacyReassign,
  onMigrateAndApproveLegacy,  migratingLegacyApprove,
  onMigrateAndRejectLegacy,   migratingLegacyReject,
  // Item-level approve/reject (for array files)
  onApproveItem, onRejectItem,
  approvingItem, rejectingItem,
  showRejectInput, onToggleRejectInput, rejectReason, onRejectReasonChange,
  availableDesigners = [],
}) => {
  const existingFiles = item.design_files || [];
  const singleFile    = item.design_file;  // legacy string or null
  const designers     = item.designers || [];
  const hasExisting   = existingFiles.length > 0;
  const pendingCount  = queuedFiles.filter((f) => !f.uploaded && !f.error).length;
  const allUploaded   = queuedFiles.length > 0 && queuedFiles.every((f) => f.uploaded);

  return (
    <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:14, marginBottom:14, background:"#fff" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:6 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:13, color:"#111827" }}>
            <AppstoreOutlined style={{ marginRight:6, color:"#7c3aed" }} />
            {item.product_name}
            {item.variation && <span style={{ color:"#9ca3af", fontWeight:500 }}> · {item.variation}</span>}
          </div>
          <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>
            {item.size && <span>{item.size} · </span>}Qty: {item.quantity} {item.quantity_type}
          </div>
        </div>
        <ItemDesignBadge status={item.design_status || "pending"} />
      </div>

      {/* Assigned designers */}
      {designers.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
            <TeamOutlined style={{ marginRight:4 }} />Assigned Designers ({designers.length})
          </div>
          <DesignersStrip designers={designers} />
        </div>
      )}

      {/*
        ── Legacy single file ──────────────────────────────────────────────
        Shown only when design_file exists AND it hasn't been migrated yet
        (i.e. no array files exist yet OR we still have the legacy string).
        Once the file is migrated, it disappears from here and appears in the
        existingFiles list below automatically (backend removes design_file,
        adds to design_files[]).
      */}
      {singleFile && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
            <FileImageOutlined style={{ marginRight:4 }} />Legacy Design File
            <span style={{ marginLeft:6, fontSize:9, color:"#d97706", fontWeight:600,
              background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:4, padding:"1px 5px" }}>
              Actions below will migrate this file
            </span>
          </div>
          <ExistingDesignFileItem
            file={singleFile}
            canManage={canManage}
            designers={availableDesigners}
            // Migrate + reassign
            onReassign={(file, designerId, label) => onMigrateAndReassignLegacy(itemId, file, designerId, label)}
            reassigning={migratingLegacyReassign}
            // Migrate + approve/reject at item level
            showApproveReject={canManage}
            onApprove={() => onMigrateAndApproveLegacy(itemId)}
            onReject={(reason) => onMigrateAndRejectLegacy(itemId, reason)}
            approving={migratingLegacyApprove}
            rejecting={migratingLegacyReject}
          />
        </div>
      )}

      {/* Existing design files (array) */}
      {hasExisting && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
            Uploaded Files ({existingFiles.length})
          </div>
          {existingFiles.map((f) => (
            <ExistingDesignFileItem
              key={f._id || f.url}
              file={f}
              canManage={canManage}
              designers={availableDesigners}
              onRemove={(file) => onRemoveExistingFile(itemId, file)}
              onReassign={(file, designerId, label) => onReassignExistingFile(itemId, file, designerId, label)}
              reassigning={!!f._id && reassigningFileId === f._id}
            />
          ))}
        </div>
      )}

      {/* Rejection banner */}
      {item.design_status === "rejected" && item.design_rejection_reason && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 10px", marginBottom:10, fontSize:11, color:"#ef4444", fontWeight:600 }}>
          <WarningOutlined style={{ marginRight:6 }} />Rejected: "{item.design_rejection_reason}"
        </div>
      )}

      {/* Upload panel */}
      <MultiFileUploadPanel
        files={queuedFiles}
        onFilesAdded={(rawFiles) => onFilesAdded(itemId, rawFiles)}
        onRemoveFile={(fileId) => onRemoveQueuedFile(itemId, fileId)}
        onLabelChange={(fileId, label) => onLabelChange(itemId, fileId, label)}
        onAssigneeChange={(fileId, designerId) => onAssigneeChange(itemId, fileId, designerId)}
        processing={!!processingFiles}
        designers={availableDesigners}
        canManage={canManage}
      />

      {/* Save button */}
      <Button type="primary"
        icon={savingItem ? <LoadingOutlined /> : <UploadOutlined />}
        loading={!!savingItem}
        disabled={!queuedFiles.length || queuedFiles.some((f) => f.uploading)}
        onClick={() => onSaveItem(itemId)}
        style={{ width:"100%", height:38, background:"#7c3aed", border:"none", borderRadius:10, fontWeight:700, fontSize:12, marginTop:4 }}>
        {savingItem ? "Uploading…"
          : pendingCount ? `Upload ${pendingCount} File${pendingCount > 1 ? "s" : ""} for this item`
          : allUploaded  ? "Saved"
          : "Add files to upload"}
      </Button>

      {/* Item-level Approve / Reject — only for array files, not legacy */}
      {canManage && hasExisting && (
        <div style={{ marginTop:12 }}>
          {!showRejectInput ? (
            <div style={{ display:"flex", gap:8 }}>
              <Popconfirm title="Approve design for this item?" onConfirm={() => onApproveItem(itemId)} okText="Approve"
                okButtonProps={{ style:{ background:"#16a34a", border:"none" } }}>
                <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                  loading={!!approvingItem} disabled={item.design_status === "approved"}
                  style={{ flex:1, height:32, background:"#16a34a", border:"none", borderRadius:8, fontWeight:600, fontSize:11 }}>
                  {item.design_status === "approved" ? "✓ Approved" : "Approve Item"}
                </Button>
              </Popconfirm>
              <Button size="small" icon={<CloseCircleOutlined />}
                onClick={() => onToggleRejectInput(itemId, true)}
                style={{ flex:1, height:32, color:"#ef4444", borderColor:"#fca5a5", borderRadius:8, fontWeight:600, fontSize:11 }}>
                Reject Item
              </Button>
            </div>
          ) : (
            <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:10 }}>
              <Input.TextArea rows={2} placeholder="Explain what needs to be fixed…"
                value={rejectReason} onChange={(e) => onRejectReasonChange(itemId, e.target.value)}
                style={{ borderRadius:8, borderColor:"#fca5a5", marginBottom:8, fontSize:12 }} />
              <div style={{ display:"flex", gap:8 }}>
                <Button danger size="small" icon={<CloseCircleOutlined />} loading={!!rejectingItem}
                  onClick={() => onRejectItem(itemId)}
                  style={{ flex:1, borderRadius:8, fontWeight:600, fontSize:11 }}>
                  Confirm Reject
                </Button>
                <Button size="small" onClick={() => onToggleRejectInput(itemId, false)} style={{ borderRadius:8, fontSize:11 }}>Back</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Main component – DesignerJobDashboard
// ═════════════════════════════════════════════════════════════════════════════
const { TextArea } = Input;

const DesignerJobDashboard = () => {
  const user            = profile();
  const userId          = user._id;
  const userName        = user.name || user.fullName || user.username || "Designer";
  const isSuperAdmin    = user.role === "super admin";
  const isAdmin         = user.role === "admin";
  const canManageDesign = isSuperAdmin || isAdmin;
  const isSpecialUser   = user?.email?.toLowerCase().trim() === "hari@dmedia.in";

  const [jobs,               setJobs]               = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [sessionMap,         setSessionMap]         = useState({});
  const [lastRefresh,        setLastRefresh]        = useState(dayjs());
  const [activeFilter,       setActiveFilter]       = useState(FILTER_ALL);
  const [availableDesigners, setAvailableDesigners] = useState([]);
  const [infoRequestMap,     setInfoRequestMap]     = useState({});

  // Info request modal
  const [requestModal,  setRequestModal]  = useState(false);
  const [requestJob,    setRequestJob]    = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // Session modal
  const [notesModal,    setNotesModal]    = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes,   setActionNotes]   = useState("");
  const [actioning,     setActioning]     = useState(false);

  // Design modal
  const [designModal,      setDesignModal]      = useState(false);
  const [designJob,        setDesignJob]        = useState(null);
  const [driveLink,        setDriveLink]        = useState("");
  const [processingFiles,  setProcessingFiles]  = useState(false);
  const [itemQueuedFiles,  setItemQueuedFiles]  = useState({});
  const [savingItemId,     setSavingItemId]     = useState(null);
  const [approvingItemId,  setApprovingItemId]  = useState(null);
  const [rejectingItemId,  setRejectingItemId]  = useState(null);
  const [reassigningFileId, setReassigningFileId] = useState(null);
  const [rejectInputMap,   setRejectInputMap]   = useState({});
  const [rejectReasonMap,  setRejectReasonMap]  = useState({});

  // Legacy migration trackers — track which itemId is currently being migrated
  const [migratingLegacyReassignItemId, setMigratingLegacyReassignItemId] = useState(null);
  const [migratingLegacyApproveItemId,  setMigratingLegacyApproveItemId]  = useState(null);
  const [migratingLegacyRejectItemId,   setMigratingLegacyRejectItemId]   = useState(null);

  // Live timers
  const [liveTimers, setLiveTimers] = useState({});
  const timerRefs   = useRef({});

  const designerSelectOptions = [...availableDesigners, OUTSOURCE_OPTION];

  // Central sync — updates both the jobs list and the open design modal
  const syncJob = useCallback((refreshedJob) => {
    if (!refreshedJob) return;
    setJobs((prev) => prev.map((j) => (j._id === refreshedJob._id ? refreshedJob : j)));
    setDesignJob((prev) => (prev?._id === refreshedJob._id ? refreshedJob : prev));
  }, []);

  // ─── Load designers ────────────────────────────────────────────────────────
  const loadDesigners = useCallback(async () => {
    try {
      const res  = await fetch("https://api.dmedia.in/api/admin/get_admin", { headers: authHeader() });
      const data = await res.json();
      if      (Array.isArray(data?.data))  setAvailableDesigners(data.data);
      else if (Array.isArray(data?.users)) setAvailableDesigners(data.users);
    } catch (err) { console.error("Failed to load designers:", err); }
  }, []);

  // ─── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let myJobs = [];
      if (isSuperAdmin) {
        const res  = await fetch(BASE, { headers: authHeader() });
        const data = await res.json();
        const rows = Array.isArray(data?.data?.jobs) ? data.data.jobs
          : Array.isArray(data?.data) ? data.data
          : Array.isArray(data?.jobs) ? data.jobs : [];
        myJobs = rows.filter(isDesignJob);
      } else {
        const [jobRes, itemRes] = await Promise.all([
          fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() }),
          fetch(`${BASE}?designer_user_id=${userId}`, { headers: authHeader() }),
        ]);
        const jobData  = await jobRes.json();
        const itemData = await itemRes.json();
        const fromJob  = Array.isArray(jobData?.data)       ? jobData.data : [];
        const fromItem = Array.isArray(itemData?.data?.jobs) ? itemData.data.jobs
          : Array.isArray(itemData?.data) ? itemData.data : [];
        const seen = new Set();
        for (const j of [...fromJob, ...fromItem]) {
          if (!seen.has(j._id)) { seen.add(j._id); myJobs.push(j); }
        }
        myJobs = myJobs.filter(
          (j) => isDesignJob(j) ||
            j.cart_items?.some((i) => i.designers?.some((d) => d.user_id?.toString() === userId)),
        );
      }

      setJobs(myJobs);
      setLastRefresh(dayjs());
      setDesignJob((prev) => {
        if (!prev) return prev;
        const refreshed = myJobs.find((j) => j._id === prev._id);
        return refreshed || prev;
      });

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
        if (sess.has_open_session && sess.open_since && !timerRefs.current[jobId])
          startLiveTimer(jobId, new Date(sess.open_since), sess.total_duration_seconds || 0);
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
    } finally {
      setLoading(false);
    }
  }, [userId, isSuperAdmin]);

  useEffect(() => { loadDesigners(); loadJobs(); }, [loadJobs, loadDesigners]);

  // ─── Timer helpers ─────────────────────────────────────────────────────────
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

  // ─── Session handlers ──────────────────────────────────────────────────────
  const handleOpenSession  = (job) => { setPendingAction({ job, action:"open" }); setActionNotes(""); setNotesModal(true); };
  const handleCloseSession = (job, action) => { setPendingAction({ job, action }); setActionNotes(""); setNotesModal(true); };

  const confirmOpenSession = async () => {
    const { job } = pendingAction;
    setActioning(true);
    try {
      const res  = await fetch(`${BASE}/${job._id}/session/open`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ stage:"design", stage_label:"Design", user:{ user_id:userId, name:userName, role:"designing team" }, notes:actionNotes }),
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
      const res  = await fetch(`${BASE}/${job._id}/session/close`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ stage:"design", action, notes:actionNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to close session");
      message.success(`Session ${action === "on_hold" ? "paused" : "completed"}!`);
      setNotesModal(false);
      stopLiveTimer(job._id);
      await loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setActioning(false); }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    pendingAction.action === "open" ? confirmOpenSession() : confirmCloseSession();
  };

  // ─── Info request ──────────────────────────────────────────────────────────
  const openRequestModal = (job) => { setRequestJob(job); setRequestReason(""); setRequestModal(true); };

  const submitInfoRequest = async () => {
    if (!requestJob) return;
    setSubmittingReq(true);
    try {
      const res  = await fetch(INFO_BASE, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ job_id:requestJob._id, requested_by:{ user_id:userId, name:userName, role:user.role || "designing team" }, request_reason:requestReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Request failed");
      message.success("Request submitted!");
      setRequestModal(false);
      setInfoRequestMap((prev) => ({ ...prev, [requestJob._id]:{ status:"pending", has_access:false, request:data.data } }));
    } catch (err) { message.error(err.message); }
    finally { setSubmittingReq(false); }
  };

  // ─── Design modal ──────────────────────────────────────────────────────────
  const openDesignModal = (job) => {
    setDesignJob(job);
    setDriveLink(job.design_drive_link || "");
    setItemQueuedFiles({});
    setRejectInputMap({});
    setRejectReasonMap({});
    setDesignModal(true);
  };

  const closeDesignModal = () => {
    Object.values(itemQueuedFiles).forEach((files) =>
      files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); }),
    );
    setDesignModal(false);
    setDesignJob(null);
    setItemQueuedFiles({});
    setDriveLink("");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE MIGRATION HELPER
  // Calls POST /:id/items/:itemId/design-file/migrate to move the legacy
  // design_file string into the design_files[] array.
  // Returns the migrated file's _id (string) on success, or null on failure.
  // ─────────────────────────────────────────────────────────────────────────────
  const migrateLegacyFile = async (jobId, itemId, { assigned_to = null, label = "Other" } = {}) => {
    const body = {
      label,
      handled_by: { user_id: userId, name: userName, role: user.role },
    };
    if (assigned_to) body.assigned_to = assigned_to;

    const res  = await fetch(`${BASE}/${jobId}/items/${itemId}/design-file/migrate`, {
      method: "POST",
      headers: jsonHeader(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Migration failed");

    const migratedFileId = data.data?.migrated_file_id || data.data?.file_id || null;
    const refreshedJob   = data.data?.job || null;
    if (refreshedJob) syncJob(refreshedJob);

    return migratedFileId;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REASSIGN EXISTING ARRAY FILE
  // PATCH /:id/items/:itemId/design-files/:fileId/reassign
  // ─────────────────────────────────────────────────────────────────────────────
  const handleReassignExistingItemFile = async (itemId, file, designerId, label) => {
    if (!designJob) return false;
    const fileId = file?._id;
    if (!fileId) {
      message.warning("Cannot reassign — no file ID found.");
      return false;
    }
    if (!designerId) {
      message.warning("Pick a designer or Outsource first.");
      return false;
    }

    const isOutsource = designerId === "outsource";
    const designer    = isOutsource ? null : availableDesigners.find((d) => d._id === designerId);
    const assigned_to = isOutsource
      ? { user_id: null, name: "Outsource", role: "outsource" }
      : { user_id: designer?._id, name: designer?.name || "", role: designer?.role || "designing team" };

    setReassigningFileId(fileId);
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/design-files/${fileId}/reassign`, {
        method: "PATCH",
        headers: jsonHeader(),
        body: JSON.stringify({
          label:       label || "Other",
          assigned_to,
          handled_by: { user_id: userId, name: userName, role: user.role },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Reassign failed");

      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);
      message.success(`Reassigned to ${assigned_to.name}.`);
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    } finally {
      setReassigningFileId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY FILE: MIGRATE THEN REASSIGN
  // 1. POST migrate  → get migrated_file_id
  // 2. PATCH reassign with that file ID
  // ─────────────────────────────────────────────────────────────────────────────
  const handleMigrateAndReassignLegacy = async (itemId, _file, designerId, label) => {
    if (!designJob) return false;
    if (!designerId) { message.warning("Pick a designer or Outsource first."); return false; }

    const isOutsource = designerId === "outsource";
    const designer    = isOutsource ? null : availableDesigners.find((d) => d._id === designerId);
    const assigned_to = isOutsource
      ? { user_id: null, name: "Outsource", role: "outsource" }
      : { user_id: designer?._id, name: designer?.name || "", role: designer?.role || "designing team" };

    setMigratingLegacyReassignItemId(itemId);
    try {
      // Step 1: migrate
      const migratedFileId = await migrateLegacyFile(designJob._id, itemId, {
        assigned_to,
        label: label || "Other",
      });
      if (!migratedFileId) throw new Error("Migration did not return a file ID.");

      // Step 2: reassign (the backend already sets assigned_to during migration,
      // but we call reassign too to be explicit and keep the audit trail)
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/design-files/${migratedFileId}/reassign`, {
        method: "PATCH",
        headers: jsonHeader(),
        body: JSON.stringify({
          label:       label || "Other",
          assigned_to,
          handled_by: { user_id: userId, name: userName, role: user.role },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Reassign after migration failed");
      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);

      message.success(`Legacy file migrated & assigned to ${assigned_to.name}.`);
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    } finally {
      setMigratingLegacyReassignItemId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY FILE: MIGRATE THEN APPROVE ITEM
  // 1. POST migrate
  // 2. POST approve-design (item level)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleMigrateAndApproveLegacy = async (itemId) => {
    if (!designJob) return;
    setMigratingLegacyApproveItemId(itemId);
    try {
      // Step 1: migrate
      await migrateLegacyFile(designJob._id, itemId);

      // Step 2: approve item
      await handleApproveItemDesign(itemId);
    } catch (err) {
      message.error(err.message);
    } finally {
      setMigratingLegacyApproveItemId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY FILE: MIGRATE THEN REJECT ITEM
  // 1. POST migrate
  // 2. POST reject-design (item level) with reason
  // ─────────────────────────────────────────────────────────────────────────────
  const handleMigrateAndRejectLegacy = async (itemId, reason) => {
    if (!designJob) return false;
    if (!reason?.trim()) { message.warning("Please provide a rejection reason."); return false; }

    setMigratingLegacyRejectItemId(itemId);
    try {
      // Step 1: migrate
      await migrateLegacyFile(designJob._id, itemId);

      // Step 2: set reason then reject
      setRejectReasonMap((prev) => ({ ...prev, [itemId]: reason }));
      await handleRejectItemDesign(itemId, reason);
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    } finally {
      setMigratingLegacyRejectItemId(null);
    }
  };

  // ─── Per-item: add files to queue ─────────────────────────────────────────
  const handleItemFilesAdded = async (itemId, rawFiles) => {
    setProcessingFiles(true);
    const newItems = [];
    for (const file of rawFiles) {
      const meta           = getFileTypeMeta(file);
      const ext            = getExt(file);
      const id             = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const originalSizeKB = Math.round(file.size / 1024);
      let processedFile    = file;
      let previewUrl       = null;
      let compressedSizeKB = originalSizeKB;

      if (meta?.compressible && file.type.startsWith("image/")) {
        try {
          const result = await compressImage(file);
          processedFile    = result.file;
          previewUrl       = result.previewUrl;
          compressedSizeKB = result.compressedSizeKB;
        } catch (err) {
          console.warn(`Compression failed for ${file.name}:`, err.message);
          try { previewUrl = URL.createObjectURL(file); } catch { /* ignore */ }
        }
      } else {
        try { previewUrl = URL.createObjectURL(file); } catch { /* ignore */ }
      }

      newItems.push({
        id, name: file.name,
        fileTypeLabel:   meta?.label || ext.toUpperCase() || "FILE",
        compressible:    meta?.compressible || false,
        file:            processedFile,
        previewUrl,
        originalSizeKB,
        compressedSizeKB,
        uploading:false, uploaded:false, uploadedUrl:null,
        error:null, progress:0, captionLabel:"Other", assignedTo:null,
      });
    }
    setItemQueuedFiles((prev) => ({ ...prev, [itemId]: [...(prev[itemId] || []), ...newItems] }));
    setProcessingFiles(false);
    if (newItems.length)
      message.success(`${newItems.length} file${newItems.length > 1 ? "s" : ""} ready.${canManageDesign ? " Assign designer then upload." : ""}`);
  };

  const handleRemoveQueuedFile = (itemId, fileId) => {
    setItemQueuedFiles((prev) => {
      const list = prev[itemId] || [];
      const file = list.find((f) => f.id === fileId);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return { ...prev, [itemId]: list.filter((f) => f.id !== fileId) };
    });
  };

  const handleQueuedFileLabelChange = (itemId, fileId, label) =>
    setItemQueuedFiles((prev) => ({
      ...prev, [itemId]: (prev[itemId] || []).map((f) => f.id === fileId ? { ...f, captionLabel:label } : f),
    }));

  const handleQueuedFileAssigneeChange = (itemId, fileId, designerId) =>
    setItemQueuedFiles((prev) => ({
      ...prev, [itemId]: (prev[itemId] || []).map((f) => f.id === fileId ? { ...f, assignedTo:designerId } : f),
    }));

  // ─── Per-item: upload + save ───────────────────────────────────────────────
  const handleSaveItemDesign = async (itemId) => {
    if (!designJob) return;
    const queued = (itemQueuedFiles[itemId] || []).filter((f) => !f.uploaded);
    if (!queued.length) { message.warning("No files to upload"); return; }

    setSavingItemId(itemId);
    setItemQueuedFiles((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((f) => f.uploaded ? f : { ...f, uploading:true, progress:0, error:null }),
    }));

    const uploadedFiles = [];
    let anyFailed = false;

    for (const item of queued) {
      try {
        const url = await uploadFileToServer(item.file, (progress) => {
          setItemQueuedFiles((prev) => ({
            ...prev,
            [itemId]: (prev[itemId] || []).map((f) => f.id === item.id ? { ...f, progress } : f),
          }));
        });
        setItemQueuedFiles((prev) => ({
          ...prev,
          [itemId]: (prev[itemId] || []).map((f) =>
            f.id === item.id ? { ...f, uploading:false, uploaded:true, uploadedUrl:url, progress:100 } : f),
        }));

        const isOutsource = item.assignedTo === "outsource";
        const designer    = isOutsource ? null : availableDesigners.find((d) => d._id === item.assignedTo);
        const assigned_to = isOutsource
          ? { user_id: null, name: "Outsource", role: "outsource" }
          : item.assignedTo
            ? { user_id: item.assignedTo, name: designer?.name || "", role: designer?.role || "designing team" }
            : null;

        uploadedFiles.push({
          label:     item.captionLabel,
          caption:   "",
          url,
          file_name: item.name,
          file_type: item.fileTypeLabel,
          assigned_to,
        });
      } catch (uploadErr) {
        anyFailed = true;
        setItemQueuedFiles((prev) => ({
          ...prev,
          [itemId]: (prev[itemId] || []).map((f) =>
            f.id === item.id ? { ...f, uploading:false, error: uploadErr.message || "Upload failed" } : f),
        }));
        message.error(`Failed to upload ${item.name}: ${uploadErr.message || "Unknown error"}`);
      }
    }

    if (!uploadedFiles.length) { setSavingItemId(null); return; }

    try {
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/design-files`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ files:uploadedFiles, handled_by:{ user_id:userId, name:userName, role:user.role } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Save failed");

      message.success(`${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""} saved!${anyFailed ? " (some failed)" : ""}`);
      setItemQueuedFiles((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || []).filter((f) => !!f.error),
      }));

      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);
      else await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  // ─── Per-item: remove existing array file ─────────────────────────────────
  const handleRemoveExistingItemFile = async (itemId, file) => {
    const fileId = typeof file === "string" ? null : file?._id;
    if (!fileId) { message.warning("Legacy file — cannot remove directly."); return; }
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/design-files/${fileId}`, {
        method:"DELETE", headers:jsonHeader(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Delete failed");
      message.success("Design file removed");
      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);
      else await loadJobs();
    } catch (err) {
      message.error(err.message);
    }
  };

  // ─── Per-item: approve ─────────────────────────────────────────────────────
  const handleApproveItemDesign = async (itemId) => {
    setApprovingItemId(itemId);
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/approve-design`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ handled_by:{ user_id:userId, name:userName, role:user.role } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      message.success("Item design approved!");

      const refreshedJob = data.data?.job || null;
      if (refreshedJob) {
        syncJob(refreshedJob);
        const allApproved = (refreshedJob.cart_items || []).every((i) => i.design_status === "approved");
        if (allApproved) {
          await Promise.all([
            fetch(`${BASE}/${designJob._id}/approve_design`, {
              method:"POST", headers:jsonHeader(),
              body: JSON.stringify({ handled_by:{ user_id:userId, name:userName, role:user.role }, notes:"All item designs approved" }),
            }),
            fetch(`${BASE}/${designJob._id}/status`, {
              method:"PATCH", headers:jsonHeader(),
              body: JSON.stringify({ job_status:"production" }),
            }),
          ]);
          message.success("All items approved — job moved to production!");
          closeDesignModal();
        }
      } else {
        await loadJobs();
      }
    } catch (err) { message.error(err.message); }
    finally { setApprovingItemId(null); }
  };

  // ─── Per-item: reject ──────────────────────────────────────────────────────
  // Accepts optional `directReason` so legacy-migrate path can pass the reason
  // without relying on the state map being updated before the call.
  const handleRejectItemDesign = async (itemId, directReason) => {
    const reason = (directReason || rejectReasonMap[itemId] || "").trim();
    if (!reason) { message.warning("Please provide a rejection reason"); return; }
    setRejectingItemId(itemId);
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/items/${itemId}/reject-design`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({ handled_by:{ user_id:userId, name:userName, role:user.role }, notes:reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Rejection failed");
      message.success("Item design rejected with feedback.");
      setRejectInputMap((prev) => ({ ...prev, [itemId]:false }));
      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);
      else await loadJobs();
    } catch (err) { message.error(err.message); }
    finally { setRejectingItemId(null); }
  };

  const toggleRejectInput   = (itemId, show) => {
    setRejectInputMap((prev) => ({ ...prev, [itemId]:show }));
    if (!show) setRejectReasonMap((prev) => ({ ...prev, [itemId]:"" }));
  };
  const setRejectReasonForItem = (itemId, value) =>
    setRejectReasonMap((prev) => ({ ...prev, [itemId]:value }));

  // ─── Save drive link ───────────────────────────────────────────────────────
  const handleSaveDriveLink = async () => {
    if (!designJob) return;
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/upload_design`, {
        method:"POST", headers:jsonHeader(),
        body: JSON.stringify({
          design_drive_link: driveLink.trim() || null,
          handled_by:        { user_id:userId, name:userName },
          stage:             designJob.current_stage?.stage || "design",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Save failed");
      message.success("Drive link saved!");
      const refreshedJob = data.data?.job || null;
      if (refreshedJob) syncJob(refreshedJob);
    } catch (err) { message.error(err.message); }
  };

  // ─── Filter logic ──────────────────────────────────────────────────────────
  const jobHasDesign        = (j) => !!(j.design_file || j.cart_items?.some((i) => i.design_file || i.design_files?.length));
  const jobIsDesignDone     = (j) => jobHasDesign(j) || j.design_status === "approved";
  const liveCount           = Object.values(sessionMap).filter((s) => s?.has_open_session).length;
  const onHoldCount         = jobs.filter((j) => j.job_status === "on_hold" && !jobIsDesignDone(j)).length;
  const designUploadedCount = jobs.filter((j) => jobHasDesign(j) && j.design_status !== "approved").length;
  const approvedDesignCount = jobs.filter((j) => j.design_status === "approved").length;
  const accessPendingCount  = Object.values(infoRequestMap).filter((r) => r?.status === "pending").length;

  const filteredJobs = jobs.filter((job) => {
    const sess = sessionMap[job._id];
    switch (activeFilter) {
      case FILTER_LIVE:            return sess?.has_open_session === true;
      case FILTER_ON_HOLD:         return job.job_status === "on_hold" && !jobIsDesignDone(job);
      case FILTER_DESIGN_UPLOADED: return jobHasDesign(job) && job.design_status !== "approved";
      case FILTER_ACCESS_PENDING:  return infoRequestMap[job._id]?.status === "pending";
      case FILTER_APPROVED_DESIGN: return job.design_status === "approved";
      default:                     return true;
    }
  });

  const summaryItems = [
    { key:FILTER_ALL,             label:"All Jobs",        value:jobs.length,           color:"#3b82f6", bg:"#eff6ff", activeBg:"#dbeafe", border:"#bfdbfe" },
    { key:FILTER_LIVE,            label:"Live Sessions",   value:liveCount,             color:"#16a34a", bg:"#f0fdf4", activeBg:"#dcfce7", border:"#86efac" },
    { key:FILTER_ON_HOLD,         label:"On Hold",         value:onHoldCount,           color:"#f97316", bg:"#fff7ed", activeBg:"#ffedd5", border:"#fdba74" },
    { key:FILTER_DESIGN_UPLOADED, label:"Design Uploaded", value:designUploadedCount,   color:"#8b5cf6", bg:"#f5f3ff", activeBg:"#ede9fe", border:"#c4b5fd" },
    { key:FILTER_APPROVED_DESIGN, label:"Design Approved", value:approvedDesignCount,   color:"#be185d", bg:"#fce7f3", activeBg:"#fbcfe8", border:"#f9a8d4" },
    ...(!isSuperAdmin ? [{ key:FILTER_ACCESS_PENDING, label:"Access Pending", value:accessPendingCount, color:"#d97706", bg:"#fffbeb", activeBg:"#fef3c7", border:"#fcd34d" }] : []),
  ];

  const canSeeCustomer = (job) => isSuperAdmin || isSpecialUser || infoRequestMap[job._id]?.has_access;

  const itemDesignSummary = (job) => {
    const items = job.cart_items || [];
    if (!items.length) return null;
    return {
      total:    items.length,
      approved: items.filter((i) => i.design_status === "approved").length,
      uploaded: items.filter((i) => i.design_status === "uploaded").length,
      rejected: items.filter((i) => i.design_status === "rejected").length,
    };
  };

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title:"S.No", key:"sno", width:55, fixed:"left",
      render:(_,__,index) => <span style={{ fontSize:12, fontWeight:700, color:"#9ca3af" }}>{index + 1}</span>,
    },
    {
      title:"Job No", dataIndex:"job_no", key:"job_no", width:130, fixed:"left",
      render:(val, job) => {
        const isLive     = sessionMap[job._id]?.has_open_session;
        const isApproved = job.design_status === "approved";
        return (
          <div>
            <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color: isApproved ? "#be185d" : isLive ? "#16a34a" : "#1e40af" }}>{val}</span>
            {isLive     && <div style={{ marginTop:3 }}><span style={{ fontSize:9, fontWeight:700, background:"#dcfce7", color:"#16a34a", padding:"1px 6px", borderRadius:8, border:"1px solid #86efac" }}>● LIVE</span></div>}
            {isApproved && <div style={{ marginTop:3 }}><span style={{ fontSize:9, fontWeight:700, background:"#fce7f3", color:"#be185d", padding:"1px 6px", borderRadius:8, border:"1px solid #f9a8d4" }}>✓ APPROVED</span></div>}
          </div>
        );
      },
    },
    {
      title:"Customer", key:"customer", width:170,
      render:(_, job) => {
        const show    = canSeeCustomer(job);
        const reqInfo = infoRequestMap[job._id] || { status:"none", has_access:false };
        if (show) return (
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:"#111827" }}>{job.customer_name || "—"}</div>
            <div style={{ fontSize:11, color:"#6b7280" }}><PhoneOutlined style={{ marginRight:3 }} />{job.customer_phone || "—"}</div>
            {job.created_by && <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}><TeamOutlined style={{ marginRight:3 }} />{job.created_by}</div>}
          </div>
        );
        return (
          <div>
            <div style={{ fontWeight:600, fontSize:12, color:"#94a3b8", letterSpacing:"0.1em" }}>●●●●● ●●●</div>
            <div style={{ fontSize:11, color:"#b0bec5" }}>+91 ●●●●●●●●●●</div>
            {job.created_by && <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}><TeamOutlined style={{ marginRight:3 }} />{job.created_by}</div>}
            {!isSuperAdmin && (
              <div style={{ marginTop:4 }}>
                {reqInfo.status === "none" || reqInfo.status === "rejected"
                  ? <Button size="small" icon={<SendOutlined />} onClick={() => openRequestModal(job)}
                      style={{ height:22, fontSize:10, fontWeight:700, background:"#eff6ff", color:"#1e40af", border:"1px solid #bfdbfe", borderRadius:6, padding:"0 6px" }}>Request</Button>
                  : reqInfo.status === "pending"
                    ? <span style={{ fontSize:10, fontWeight:700, color:"#d97706" }}><HourglassOutlined /> Pending</span>
                    : null}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title:"Items", key:"items", width:220,
      render:(_, job) => {
        const items = job.cart_items || [];
        return (
          <div>
            {items.slice(0, 3).map((item, i) => (
              <div key={i} style={{ fontSize:11, color:"#374151", lineHeight:1.6, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontWeight:600 }}>{item.product_name}</span>
                {item.variation && <span style={{ color:"#9ca3af" }}>· {item.variation}</span>}
                {item.size      && <span style={{ color:"#9ca3af" }}>· {item.size}</span>}
                <ItemDesignBadge status={item.design_status || "pending"} />
              </div>
            ))}
            {items.length > 3 && <span style={{ fontSize:10, color:"#6b7280" }}>+{items.length - 3} more items</span>}
          </div>
        );
      },
    },
    {
      title:"Status", key:"status", width:130,
      render:(_, job) => (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <StatusBadge status={job.job_status} />
          {!isSuperAdmin && <InfoRequestBadge requestStatus={infoRequestMap[job._id]?.status} />}
        </div>
      ),
    },
    {
      title:"Design", key:"design", width:160,
      render:(_, job) => {
        const summary = itemDesignSummary(job);
        if (!summary) return <span style={{ fontSize:11, color:"#9ca3af" }}>—</span>;
        if (summary.approved === summary.total)
          return (
            <span style={{ fontSize:11, fontWeight:700, color:"#16a34a", background:"#f0fdf4", padding:"3px 8px", borderRadius:8, border:"1px solid #86efac", display:"inline-flex", alignItems:"center", gap:4 }}>
              <CheckCircleOutlined />All {summary.total} Approved
            </span>
          );
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {summary.approved > 0 && <span style={{ fontSize:10, fontWeight:700, color:"#16a34a" }}><CheckCircleOutlined style={{ marginRight:3 }} />{summary.approved} approved</span>}
            {summary.uploaded > 0 && <span style={{ fontSize:10, fontWeight:700, color:"#7c3aed" }}><FileImageOutlined style={{ marginRight:3 }} />{summary.uploaded} uploaded</span>}
            {summary.rejected > 0 && <span style={{ fontSize:10, fontWeight:700, color:"#ef4444" }}><CloseCircleOutlined style={{ marginRight:3 }} />{summary.rejected} rejected</span>}
            {summary.total - summary.approved - summary.uploaded - summary.rejected > 0 && (
              <span style={{ fontSize:10, color:"#9ca3af" }}>{summary.total - summary.approved - summary.uploaded - summary.rejected} pending</span>
            )}
          </div>
        );
      },
    },
    {
      title:"Time", key:"time", width:120,
      render:(_, job) => {
        const secs = getLiveDisplaySecs(job._id);
        const sess = sessionMap[job._id];
        if (!secs && !sess) return <span style={{ fontSize:11, color:"#9ca3af" }}>—</span>;
        return (
          <div>
            <div style={{ fontFamily:"monospace", fontWeight:700, fontSize:13, color: liveTimers[job._id] ? "#1e40af" : "#374151" }}>{fmtSecs(secs)}</div>
            {sess && <div style={{ fontSize:10, color:"#6b7280" }}>{sess.worked_days || 0}d · {sess.closed_sessions || 0} sess</div>}
          </div>
        );
      },
    },
    {
      title:"Delivery", key:"delivery", width:110,
      render:(_, job) => {
        const delivDate = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
        const isOverdue = delivDate && delivDate.isBefore(dayjs());
        if (!delivDate) return <span style={{ fontSize:11, color:"#9ca3af" }}>—</span>;
        return (
          <span style={{ fontSize:12, fontWeight:600, color: isOverdue ? "#ef4444" : "#374151" }}>
            {isOverdue && <WarningOutlined style={{ marginRight:4 }} />}
            {delivDate.format("DD MMM YY")}
          </span>
        );
      },
    },
    {
      title:"Actions", key:"actions", width:170, fixed:"right",
      render:(_, job) => {
        const isLive = sessionMap[job._id]?.has_open_session;
        return (
          <Space size={4} wrap>
            {!isLive && (
              <Tooltip title={job.job_status === "on_hold" ? "Resume" : "Start session"}>
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleOpenSession(job)}
                  style={{ height:28, fontSize:11, fontWeight:600, background: job.job_status === "on_hold" ? "#d97706" : "#1e40af", border:"none", borderRadius:6 }}>
                  {job.job_status === "on_hold" ? "Resume" : "Start"}
                </Button>
              </Tooltip>
            )}
            {isLive && (
              <>
                <Tooltip title="Pause">
                  <Button size="small" danger icon={<PauseCircleOutlined />} onClick={() => handleCloseSession(job, "on_hold")}
                    style={{ height:28, fontSize:11, fontWeight:600, borderRadius:6 }}>Pause</Button>
                </Tooltip>
                <Popconfirm title="Mark design stage as complete?" onConfirm={() => handleCloseSession(job, "completed")} okText="Complete"
                  okButtonProps={{ style:{ background:"#16a34a", border:"none" } }}>
                  <Tooltip title="Complete design">
                    <Button size="small" icon={<CheckCircleOutlined />}
                      style={{ height:28, fontSize:11, fontWeight:600, borderRadius:6, color:"#16a34a", borderColor:"#86efac", background:"#f0fdf4" }}>Done</Button>
                  </Tooltip>
                </Popconfirm>
              </>
            )}
            <Tooltip title="Upload / View Designs">
              <Button size="small" icon={<UploadOutlined />} onClick={() => openDesignModal(job)}
                style={{ height:28, fontSize:11, fontWeight:600, borderRadius:6, color:"#7c3aed", borderColor:"#c4b5fd", background:"#faf5ff" }}>Design</Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const designSessData = designJob ? sessionMap[designJob._id] : null;
  const designLiveSecs = designJob ? getLiveDisplaySecs(designJob._id) : 0;
  const cartItems      = designJob?.cart_items || [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:16, background:"linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%,#faf5ff 100%)", minHeight:"100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .design-table .ant-table-thead > tr > th { background:#f8fafc !important; font-size:11px !important; font-weight:700 !important; color:#6b7280 !important; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #e5e7eb !important; padding:10px 12px !important; }
        .design-table .ant-table-tbody > tr > td { padding:10px 12px !important; border-bottom:1px solid #f1f5f9 !important; vertical-align:top; }
        .design-table .ant-table-tbody > tr:hover > td { background:#f5f3ff !important; }
        .design-table .ant-table-tbody > tr.live-row > td { background:#f0fdf4 !important; }
        .design-table .ant-table-tbody > tr.approved-row > td { background:#fdf4ff !important; }
      `}</style>

      {/* Header */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e5e7eb", padding:"14px 18px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#1e3a8a,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <FileImageOutlined style={{ color:"#fff", fontSize:18 }} />
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#111827" }}>
              {isSuperAdmin ? "All Design Jobs" : "My Design Jobs"}
            </h2>
            <p style={{ margin:0, fontSize:12, color:"#6b7280" }}>
              {isSuperAdmin ? "Super Admin" : <strong>{userName}</strong>}
              {" · "}{jobs.length} job{jobs.length !== 1 ? "s" : ""} · Updated {lastRefresh.format("HH:mm:ss")}
            </p>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} style={{ borderRadius:8 }} />
        </Tooltip>
      </div>

      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${summaryItems.length}, minmax(0,1fr))`, gap:10, marginBottom:16 }}>
        {summaryItems.map(({ key, label, value, color, bg, activeBg }) => {
          const isActive = activeFilter === key;
          return (
            <div key={key} onClick={() => setActiveFilter(isActive ? FILTER_ALL : key)}
              style={{ background: isActive ? activeBg : bg, borderRadius:10, padding:10,
                border:`${isActive ? "2px" : "1px"} solid ${isActive ? color : `${color}33`}`,
                cursor:"pointer", transition:"all 0.18s ease",
                boxShadow: isActive ? `0 0 0 3px ${color}22` : "none",
                transform: isActive ? "translateY(-1px)" : "none", position:"relative" }}>
              {isActive && <div style={{ position:"absolute", top:6, right:8, width:7, height:7, borderRadius:"50%", background:color, animation:"pulse 1.5s infinite" }} />}
              <div style={{ fontSize:18, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:10, color: isActive ? color : "#6b7280", fontWeight: isActive ? 700 : 600 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Privacy notice */}
      {!isSuperAdmin && (
        <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"flex-start", gap:10 }}>
          <LockOutlined style={{ color:"#0369a1", fontSize:16, marginTop:1, flexShrink:0 }} />
          <div style={{ fontSize:12, color:"#0c4a6e" }}>
            <strong>Privacy Policy:</strong> Customer names and phone numbers are hidden. Click <strong>"Request"</strong> for access.
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e5e7eb", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <Spin spinning={loading}>
          <Table className="design-table" dataSource={filteredJobs} columns={columns} rowKey="_id"
            scroll={{ x:1100 }}
            pagination={{ pageSize:20, showSizeChanger:true, showTotal:(total) => `${total} job${total !== 1 ? "s" : ""}`, style:{ padding:"12px 16px" } }}
            locale={{ emptyText:<Empty description="No jobs match this filter" style={{ padding:"40px 0" }} /> }}
            rowClassName={(job) => {
              if (job.design_status === "approved") return "approved-row";
              if (sessionMap[job._id]?.has_open_session) return "live-row";
              return "";
            }} />
        </Spin>
      </div>

      {/* Info request modal */}
      <Modal open={requestModal} onCancel={() => !submittingReq && setRequestModal(false)}
        title={<div style={{ display:"flex", alignItems:"center", gap:8 }}><InfoCircleOutlined style={{ color:"#0369a1" }} /><span style={{ fontWeight:700 }}>Request Customer Info Access</span></div>}
        footer={[
          <Button key="c" onClick={() => setRequestModal(false)} disabled={submittingReq}>Cancel</Button>,
          <Button key="ok" type="primary" loading={submittingReq} onClick={submitInfoRequest} style={{ background:"#0369a1", border:"none" }}>Send Request</Button>,
        ]} width={440} destroyOnClose>
        <TextArea rows={3} placeholder="Reason for request (optional)…" value={requestReason}
          onChange={(e) => setRequestReason(e.target.value)} style={{ borderRadius:8, marginTop:12 }} />
      </Modal>

      {/* Session notes modal */}
      <Modal open={notesModal} onCancel={() => !actioning && setNotesModal(false)}
        title={<span style={{ fontWeight:700 }}>
          {pendingAction?.action === "open"      && "Start / Resume Session"}
          {pendingAction?.action === "on_hold"   && "Pause Session"}
          {pendingAction?.action === "completed" && "Complete Design Stage"}
          {pendingAction?.job && <Tag color="blue" style={{ marginLeft:8, fontFamily:"monospace", fontWeight:700, fontSize:11 }}>{pendingAction.job.job_no}</Tag>}
        </span>}
        footer={[
          <Button key="c" onClick={() => setNotesModal(false)} disabled={actioning}>Cancel</Button>,
          <Button key="ok" type="primary" loading={actioning} onClick={handleConfirmAction}
            style={{ background: pendingAction?.action === "on_hold" ? "#f97316" : pendingAction?.action === "completed" ? "#16a34a" : "#1e40af", border:"none" }}>
            Confirm
          </Button>,
        ]} width={440} destroyOnClose>
        <TextArea rows={3} placeholder="Notes (optional)…" value={actionNotes}
          onChange={(e) => setActionNotes(e.target.value)} style={{ borderRadius:8, marginTop:12 }} />
      </Modal>

      {/* Design workspace modal */}
      <Modal open={designModal} onCancel={closeDesignModal}
        title={<div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <FileImageOutlined style={{ color:"#7c3aed" }} />
          <span style={{ fontWeight:700 }}>Design Workspace</span>
          {designJob && <Tag color="purple" style={{ fontFamily:"monospace", fontWeight:700, fontSize:11 }}>{designJob.job_no}</Tag>}
        </div>}
        footer={null} width={700} destroyOnClose
        styles={{ body:{ maxHeight:"84vh", overflowY:"auto", padding:"16px 20px" } }}>
        {designJob && (
          <div>
            {/* Job info banner */}
            <div style={{ background:"linear-gradient(135deg,#f5f3ff,#eff6ff)", borderRadius:10, padding:"12px 14px", marginBottom:14, border:"1px solid #ddd6fe" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:"#111827" }}>{designJob.job_no}</div>
                  <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>Created by: <strong>{designJob.created_by || "—"}</strong></div>
                  {canSeeCustomer(designJob) && (
                    <div style={{ fontSize:14, color:"#374151", marginTop:4 }}>
                      <UserOutlined style={{ marginRight:4 }} /><strong>{designJob.customer_name}</strong>
                      {designJob.customer_phone && <span style={{ marginLeft:8, color:"#6b7280" }}><PhoneOutlined style={{ marginRight:3 }} />{designJob.customer_phone}</span>}
                    </div>
                  )}
                </div>
                <StatusBadge status={designJob.job_status} />
              </div>
            </div>

            {/* Timer */}
            <div style={{ background: liveTimers[designJob._id] ? "#eff6ff" : "#f9fafb", border:`1px solid ${liveTimers[designJob._id] ? "#bfdbfe" : "#e5e7eb"}`, borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
                <ClockCircleOutlined style={{ marginRight:4 }} />Design Time
                {liveTimers[designJob._id] && <span style={{ marginLeft:8, color:"#16a34a", background:"#dcfce7", padding:"1px 6px", borderRadius:8, fontSize:10 }}>● LIVE</span>}
              </div>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:800, color: liveTimers[designJob._id] ? "#1e40af" : "#9ca3af" }}>{fmtSecs(designLiveSecs)}</div>
            </div>

            {designSessData?.daily_summary?.length > 0 && (
              <DailySummaryBar dailySummary={designSessData.daily_summary} totalSecs={designLiveSecs} workedDays={designSessData.worked_days || 0} />
            )}

            {/* Formats info */}
            <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", marginBottom:6 }}>
                <PictureOutlined style={{ marginRight:6 }} />Supported Formats & Labels
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {[{fmt:"JPEG",compress:true},{fmt:"PNG",compress:true},{fmt:"WEBP",compress:true},{fmt:"PDF",compress:false},{fmt:"CDR",compress:false},{fmt:"DXF",compress:false}].map(({ fmt, compress }) => (
                  <div key={fmt} style={{ padding:"4px 10px", borderRadius:8, background: compress ? "#ede9fe" : "#f0fdf4", border:`1px solid ${compress ? "#c4b5fd" : "#86efac"}`, fontSize:11, fontWeight:700, color: compress ? "#6d28d9" : "#166534" }}>
                    {fmt}{compress && <span style={{ fontSize:9, color:"#8b5cf6", marginLeft:4 }}>auto-compressed</span>}
                  </div>
                ))}
              </div>
              {canManageDesign && (
                <div style={{ fontSize:10, color:"#7c3aed", fontWeight:600 }}>
                  <TagOutlined style={{ marginRight:4 }} />Label each file: {DESIGN_FILE_LABELS.join(", ")}
                </div>
              )}
            </div>

            <Divider style={{ margin:"4px 0 14px" }}>
              <span style={{ fontSize:11, color:"#6b7280", fontWeight:600 }}>
                Per-Item Design Files ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})
              </span>
            </Divider>

            {cartItems.length === 0
              ? <Empty description="No items in this job" style={{ padding:"20px 0" }} />
              : cartItems.map((item, idx) => {
                  const itemId = item.item_id?.toString() || item._id?.toString() || `idx_${idx}`;
                  return (
                    <ItemDesignPanel
                      key={itemId}
                      item={item}
                      itemId={itemId}
                      canManage={canManageDesign}
                      queuedFiles={itemQueuedFiles[itemId] || []}
                      processingFiles={processingFiles}
                      onFilesAdded={handleItemFilesAdded}
                      onRemoveQueuedFile={handleRemoveQueuedFile}
                      onLabelChange={handleQueuedFileLabelChange}
                      onAssigneeChange={handleQueuedFileAssigneeChange}
                      onSaveItem={handleSaveItemDesign}
                      savingItem={savingItemId === itemId}
                      onRemoveExistingFile={handleRemoveExistingItemFile}
                      // Array file reassign
                      onReassignExistingFile={handleReassignExistingItemFile}
                      reassigningFileId={reassigningFileId}
                      // Legacy file: migrate + action
                      onMigrateAndReassignLegacy={handleMigrateAndReassignLegacy}
                      migratingLegacyReassign={migratingLegacyReassignItemId === itemId}
                      onMigrateAndApproveLegacy={handleMigrateAndApproveLegacy}
                      migratingLegacyApprove={migratingLegacyApproveItemId === itemId}
                      onMigrateAndRejectLegacy={handleMigrateAndRejectLegacy}
                      migratingLegacyReject={migratingLegacyRejectItemId === itemId}
                      // Item-level approve/reject (for array files)
                      onApproveItem={handleApproveItemDesign}
                      onRejectItem={handleRejectItemDesign}
                      approvingItem={approvingItemId === itemId}
                      rejectingItem={rejectingItemId === itemId}
                      showRejectInput={!!rejectInputMap[itemId]}
                      onToggleRejectInput={toggleRejectInput}
                      rejectReason={rejectReasonMap[itemId] || ""}
                      onRejectReasonChange={setRejectReasonForItem}
                      availableDesigners={designerSelectOptions}
                    />
                  );
                })
            }

            <Divider style={{ margin:"14px 0" }}>
              <span style={{ fontSize:11, color:"#6b7280", fontWeight:600 }}>Original Quality Files (Whole Job)</span>
            </Divider>

            <DriveUploadSection driveLinkValue={driveLink} onDriveLinkChange={setDriveLink} />

            <Button onClick={handleSaveDriveLink} style={{ width:"100%", borderRadius:8, marginTop:-8, marginBottom:8 }}>
              Save Drive Link
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DesignerJobDashboard;