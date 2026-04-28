import { useEffect, useState, useCallback, useRef } from "react";
import {
  Button, Tag, Modal, Input, Spin, Empty,
  Tooltip, Divider, message, Popconfirm, Image,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, EyeOutlined,
  FileImageOutlined, UserOutlined, CameraOutlined,
  ShoppingCartOutlined, CalendarOutlined, PhoneOutlined,
  ReloadOutlined, PauseCircleOutlined, HistoryOutlined, DeleteOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import CapUploadHelper from "../helper/CapUploadHelper"; // ← uses AWS via uploadImage API

dayjs.extend(duration);

const { TextArea } = Input;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad     = (n) => String(n).padStart(2, "0");
const fmtSecs = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const profile    = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); } catch { return {}; }
};
const BASE = "https://job-server-cocj.onrender.com/api/jobs";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  quality_check: { label: "QC Pending", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  in_progress:   { label: "In Progress",color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
  on_hold:       { label: "On Hold",    color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  passed:        { label: "Passed",     color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  failed:        { label: "Failed",     color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  completed:     { label: "Completed",  color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.quality_check;
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

// ─── Daily summary bar ────────────────────────────────────────────────────────
const DailySummaryBar = ({ dailySummary = [], totalSecs = 0, workedDays = 0 }) => {
  if (!dailySummary.length) return null;
  const maxSecs = Math.max(...dailySummary.map(d => d.seconds), 1);
  return (
    <div style={{
      background: "#f0f9ff", border: "1px solid #bae6fd",
      borderRadius: 10, padding: "10px 12px", marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#0369a1",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
        display: "flex", justifyContent: "space-between",
      }}>
        <span><HistoryOutlined style={{ marginRight: 4 }} />Inspection History ({workedDays} day{workedDays !== 1 ? "s" : ""})</span>
        <span style={{ color: "#1e40af" }}>Total: {fmtSecs(totalSecs)}</span>
      </div>
      {dailySummary.map((day, i) => {
        const pct = Math.round((day.seconds / maxSecs) * 100);
        return (
          <div key={day.date} style={{ marginBottom: i < dailySummary.length - 1 ? 6 : 0 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: "#374151", marginBottom: 2, fontWeight: 600,
            }}>
              <span>Day {i + 1} — {dayjs(day.date).format("DD MMM")}</span>
              <span style={{ color: "#0369a1" }}>{day.display}</span>
            </div>
            <div style={{ height: 6, background: "#e0f2fe", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: "linear-gradient(90deg,#3b82f6,#0ea5e9)",
                borderRadius: 4, transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Session status pill ──────────────────────────────────────────────────────
const SessionStatusPill = ({ sessionData }) => {
  if (!sessionData) return null;
  const hasOpen = sessionData.has_open_session;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 12,
      background: hasOpen ? "#dcfce7" : "#fef3c7",
      border: `1px solid ${hasOpen ? "#86efac" : "#fcd34d"}`,
      fontSize: 10, fontWeight: 700,
      color: hasOpen ? "#16a34a" : "#92400e",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: hasOpen ? "#16a34a" : "#f59e0b",
        animation: hasOpen ? "pulse 1.5s infinite" : "none",
      }} />
      {hasOpen
        ? "Inspecting Live"
        : `${sessionData.worked_days || 0} day${(sessionData.worked_days || 0) !== 1 ? "s" : ""} logged`}
    </div>
  );
};

// ─── Design file preview ──────────────────────────────────────────────────────
const DesignFilePreview = ({ fileUrl, label = "Reference Design" }) => {
  if (!fileUrl) return null;
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(fileUrl);
  const isPdf   = /\.pdf(\?.*)?$/i.test(fileUrl);

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob     = await response.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `design_${Date.now()}.${fileUrl.split(".").pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div style={{ border: "1px solid #c4b5fd", borderRadius: 10, overflow: "hidden", marginBottom: 14, background: "#faf5ff" }}>
      <div style={{
        padding: "8px 12px",
        background: "linear-gradient(135deg,#7c3aed,#9333ea)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5f3ff" }}>
          <FileImageOutlined style={{ marginRight: 5 }} />{label}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#e9d5ff", fontSize: 10 }}>
            <EyeOutlined /> Open
          </a>
          <span onClick={handleDownload} style={{ color: "#e9d5ff", fontSize: 10, cursor: "pointer" }}>
            <DownloadOutlined /> Download
          </span>
        </div>
      </div>
      {isImage ? (
        <div style={{ padding: 10, textAlign: "center", background: "#f5f3ff" }}>
          <img src={fileUrl} alt="Design preview" style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 6 }} />
        </div>
      ) : isPdf ? (
        <div style={{ padding: 10, fontSize: 12 }}>📄 PDF — <a href={fileUrl} target="_blank" rel="noopener noreferrer">Click to view</a></div>
      ) : (
        <div style={{ padding: 10, fontSize: 12 }}>📎 File — <a href={fileUrl} target="_blank" rel="noopener noreferrer">Download / View</a></div>
      )}
    </div>
  );
};

// ─── QC Image Gallery ─────────────────────────────────────────────────────────
const QCImageGallery = ({ images = [], onRemove, readonly = false }) => {
  if (!images.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {images.map((img, idx) => (
        <div key={idx} style={{ position: "relative", width: 80, height: 80, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <Image src={img} width={80} height={80} style={{ objectFit: "cover" }} />
          {!readonly && (
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              shape="circle"
              style={{ position: "absolute", top: 2, right: 2, opacity: 0.85 }}
              onClick={() => onRemove(idx)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// ─── QC Job Card ──────────────────────────────────────────────────────────────
const QCJobCard = ({ job, sessionData, onOpenSession, onCloseSession, onOpenQCModal }) => {
  const delivDate  = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
  const isOverdue  = delivDate && delivDate.isBefore(dayjs());
  const isLive     = sessionData?.has_open_session;
  const isOnHold   = job.job_status === "on_hold";
  const hasPhotos  = (job.qc_images || []).length > 0;
  const hasDesign  = !!(job.design_file || job.cart_items?.some((i) => i.design_file));

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: `1px solid ${isLive ? "#86efac" : "#e5e7eb"}`,
      boxShadow: isLive
        ? "0 0 0 2px #dcfce7, 0 4px 12px rgba(0,0,0,0.08)"
        : "0 2px 8px rgba(0,0,0,0.06)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Card header */}
      <div style={{
        padding: "10px 14px",
        background: isLive
          ? "linear-gradient(135deg,#14532d 0%,#16a34a 100%)"
          : "linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: isLive ? "#bbf7d0" : "#93c5fd" }}>
          {job.job_no}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isLive && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#bbf7d0", background: "rgba(255,255,255,0.15)", padding: "1px 7px", borderRadius: 10 }}>
              ● LIVE
            </span>
          )}
          <StatusBadge status={job.job_status} />
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* Customer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserOutlined style={{ color: "#3b82f6", fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{job.customer_name || "—"}</div>
            <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
              <PhoneOutlined style={{ fontSize: 10 }} />{job.customer_phone || "—"}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}><SessionStatusPill sessionData={sessionData} /></div>
        </div>

        {/* Cart items */}
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
            <ShoppingCartOutlined style={{ marginRight: 4 }} />Items
          </div>
          {(job.cart_items || []).slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>
                {item.product_name}
                {item.size && <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {item.size}</span>}
              </span>
            </div>
          ))}
          {(job.cart_items || []).length > 2 && (
            <div style={{ fontSize: 11, color: "#6b7280" }}>+{job.cart_items.length - 2} more</div>
          )}
        </div>

        {/* Time logged */}
        {sessionData && (sessionData.total_duration_seconds > 0 || sessionData.worked_days > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 11 }}>
            <span style={{ color: "#0369a1", fontWeight: 600 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />{fmtSecs(sessionData.total_duration_seconds)} logged
            </span>
            <span>{sessionData.worked_days} day{sessionData.worked_days !== 1 ? "s" : ""} · {sessionData.closed_sessions} session{sessionData.closed_sessions !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Delivery date */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#6b7280" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {delivDate ? delivDate.format("DD MMM YYYY") : "—"}
            {isOverdue && <span style={{ marginLeft: 4, fontWeight: 700 }}>⚠ Overdue</span>}
          </div>
        </div>

        {/* Tags */}
        {(hasDesign || hasPhotos) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {hasDesign && <Tag icon={<FileImageOutlined />} color="purple">Design provided</Tag>}
            {hasPhotos && <Tag icon={<CheckCircleOutlined />} color="green">{job.qc_images.length} photo(s)</Tag>}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isLive && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              size="small"
              onClick={() => onOpenSession(job)}
              style={{
                flex: 1, minWidth: 90, height: 32, fontWeight: 600, border: "none", borderRadius: 8,
                background: isOnHold ? "#d97706" : "#1e40af",
              }}
            >
              {isOnHold ? "Resume" : "Start Inspection"}
            </Button>
          )}
          {isLive && (
            <Button
              icon={<PauseCircleOutlined />}
              size="small"
              danger
              onClick={() => onCloseSession(job, "on_hold")}
              style={{ flex: 1, minWidth: 90, height: 32, fontWeight: 600, borderRadius: 8 }}
            >
              Pause
            </Button>
          )}
          <Tooltip title="Upload QC Photos / Inspect / Pass / Fail">
            <Button
              icon={<CameraOutlined />}
              size="small"
              onClick={() => onOpenQCModal(job)}
              style={{ flex: 1, height: 32, borderRadius: 8, color: "#7c3aed", borderColor: "#c4b5fd", background: "#faf5ff" }}
            >
              QC Inspection
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Main Quality Check Dashboard
// ═════════════════════════════════════════════════════════════════════════════
const QualityCheckDashboard = () => {
  const user     = profile();
  const userId   = user._id;
  const userName = user.name || user.fullName || user.username || "QC Inspector";

  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [sessionMap, setSessionMap]   = useState({});
  const [lastRefresh, setLastRefresh] = useState(dayjs());

  // QC inspection modal state
  const [qcModalOpen, setQcModalOpen]         = useState(false);
  const [currentJob, setCurrentJob]           = useState(null);
  const [existingImages, setExistingImages]   = useState([]); // already on the server / AWS
  const [newImageUrls, setNewImageUrls]       = useState([]); // AWS URLs returned by UploadHelper
  const [qcNotes, setQcNotes]                 = useState("");
  const [saving, setSaving]                   = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Session notes modal
  const [notesModal, setNotesModal]     = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes, setActionNotes]   = useState("");
  const [actioning, setActioning]       = useState(false);

  // Live timers
  const [liveTimers, setLiveTimers] = useState({});
  const timerRefs                   = useRef({});

  // ─── Load jobs ──────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}`, { headers: authHeader() });
      const data = await res.json();
      const rows = Array.isArray(data?.data?.jobs) ? data.data.jobs : [];

      const qcJobs = rows.filter(
        (j) => j.job_status === "quality_check" || j.current_stage?.stage === "quality_check"
      );
      setJobs(qcJobs);
      setLastRefresh(dayjs());

      const map = {};
      await Promise.all(
        qcJobs.map(async (j) => {
          try {
            const sr = await fetch(`${BASE}/${j._id}/session/status?stage=quality_check`, { headers: authHeader() });
            const sd = await sr.json();
            if (sd.success) map[j._id] = sd.data;
          } catch { /* ignore */ }
        })
      );
      setSessionMap(map);

      for (const [jobId, sess] of Object.entries(map)) {
        if (sess.has_open_session && sess.open_since && !timerRefs.current[jobId]) {
          startLiveTimer(jobId, new Date(sess.open_since), sess.total_duration_seconds || 0);
        }
      }
    } catch (err) {
      message.error("Failed to load QC jobs: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── Live timer helpers ──────────────────────────────────────────────────────
  const startLiveTimer = (jobId, sessionStartedAt, previousTotalSecs = 0) => {
    if (timerRefs.current[jobId]) return;
    setLiveTimers((prev) => ({ ...prev, [jobId]: { startedAt: sessionStartedAt, base: previousTotalSecs } }));
    timerRefs.current[jobId] = setInterval(() => {
      setLiveTimers((prev) => {
        const entry = prev[jobId];
        if (!entry) return prev;
        const sessionSecs = Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000);
        return { ...prev, [jobId]: { ...entry, currentSessionSecs: sessionSecs } };
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

  // ─── Session open / close ────────────────────────────────────────────────────
  const handleOpenSession = (job) => {
    setPendingAction({ job, action: "open" });
    setActionNotes("");
    setNotesModal(true);
  };

  const confirmOpenSession = async () => {
    const { job } = pendingAction;
    setActioning(true);
    try {
      const res = await fetch(`${BASE}/${job._id}/session/open`, {
        method: "POST",
        headers: jsonHeader(),
        body: JSON.stringify({
          stage:       "quality_check",
          stage_label: "Quality Check",
          user:        { user_id: userId, name: userName, role: "quality team" },
          notes:       actionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open session");
      message.success(`Inspection started for ${job.job_no}`);
      setNotesModal(false);
      startLiveTimer(job._id, new Date(), sessionMap[job._id]?.total_duration_seconds || 0);
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleCloseSession = (job, action) => {
    setPendingAction({ job, action });
    setActionNotes("");
    setNotesModal(true);
  };

  const confirmCloseSession = async () => {
    const { job, action } = pendingAction;
    setActioning(true);
    try {
      const res = await fetch(`${BASE}/${job._id}/session/close`, {
        method: "POST",
        headers: jsonHeader(),
        body: JSON.stringify({ stage: "quality_check", action, notes: actionNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to close session");
      const msgs = {
        on_hold: `Paused! ${data.data?.stage_summary?.total_duration_display || ""} logged.`,
        passed:  `Quality passed! Total: ${data.data?.stage_summary?.total_duration_display || ""} across ${data.data?.stage_summary?.worked_days || 0} days.`,
      };
      message.success(msgs[action] || data.message);
      setNotesModal(false);
      stopLiveTimer(job._id);
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    pendingAction.action === "open" ? confirmOpenSession() : confirmCloseSession();
  };

  // ─── QC Modal helpers ────────────────────────────────────────────────────────
  const openQCModal = (job) => {
    setCurrentJob(job);
    setExistingImages(job.qc_images || []);
    setNewImageUrls([]);
    setQcNotes(job.qc_notes || "");
    setShowRejectInput(false);
    setRejectReason("");
    setQcModalOpen(true);
  };

  const closeQCModal = () => {
    setQcModalOpen(false);
    setCurrentJob(null);
    setExistingImages([]);
    setNewImageUrls([]);
    setQcNotes("");
  };

  /**
   * UploadHelper calls setNewImageUrls with the full array each time.
   * We keep newImageUrls as an array of AWS URLs (strings).
   * UploadHelper's `multiple` prop appends; we pass the setter directly.
   *
   * Because UploadHelper in multiple mode pushes { key, path } objects we
   * normalise to plain URL strings here via a wrapper setter.
   */
  const handleNewImageAdded = (val) => {
    // UploadHelper in multiple mode sets [{ key, path }...]
    // In non-multiple mode it sets a plain string. Normalise:
    if (Array.isArray(val)) {
      setNewImageUrls(val.map((v) => (typeof v === "string" ? v : v.path)));
    } else if (typeof val === "string") {
      setNewImageUrls((prev) => [...prev, val]);
    }
  };

  const removeNewImage = (idx) => setNewImageUrls((prev) => prev.filter((_, i) => i !== idx));

  // Save QC data — all images are already on AWS; just send URLs to your API
  const saveQCData = async (passOrFail = null) => {
    if (!currentJob) return;
    setSaving(true);
    try {
      // 1) Save photos (AWS URLs) + notes via JSON
      const saveRes = await fetch(`${BASE}/${currentJob._id}/qc/update`, {
        method:  "POST",
        headers: jsonHeader(),
        body: JSON.stringify({
          qc_notes:         qcNotes,
          qc_images:        newImageUrls,          // array of AWS S3 URLs
          duration_seconds: getLiveDisplaySecs(currentJob._id),
          duration_display: fmtSecs(getLiveDisplaySecs(currentJob._id)),
          handled_by:       { user_id: userId, name: userName },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) throw new Error(saveData.message || "Failed to save QC data");

      // 2) Pass / fail
      if (passOrFail === "passed") {
        const passRes  = await fetch(`${BASE}/${currentJob._id}/qc/pass`, {
          method:  "POST",
          headers: jsonHeader(),
          body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: qcNotes }),
        });
        const passData = await passRes.json();
        if (!passRes.ok || !passData.success) throw new Error(passData.message || "Failed to pass QC");
        message.success("Quality passed! Job moved forward.");
        stopLiveTimer(currentJob._id);
      } else if (passOrFail === "failed") {
        const failRes  = await fetch(`${BASE}/${currentJob._id}/qc/fail`, {
          method:  "POST",
          headers: jsonHeader(),
          body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, reason: rejectReason, notes: qcNotes }),
        });
        const failData = await failRes.json();
        if (!failRes.ok || !failData.success) throw new Error(failData.message || "Failed to fail QC");
        message.success("QC failed — rejection recorded.");
        stopLiveTimer(currentJob._id);
      } else {
        message.success("QC data saved.");
      }

      closeQCModal();
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = () => saveQCData(null);
  const handleApprove  = () => saveQCData("passed");
  const handleReject   = () => {
    if (!rejectReason.trim()) { message.warning("Please provide a rejection reason."); return; }
    saveQCData("failed");
  };

  const currentSessionData = currentJob ? sessionMap[currentJob._id] : null;
  const currentLiveSecs    = currentJob ? getLiveDisplaySecs(currentJob._id) : 0;
  const designRef          = currentJob?.design_file || currentJob?.cart_items?.find((i) => i.design_file)?.design_file;
  const liveCount          = Object.values(sessionMap).filter((s) => s?.has_open_session).length;

  return (
    <div style={{ padding: 16, background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%,#faf5ff 100%)", minHeight: "100vh" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "14px 18px", marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#1e3a8a,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CameraOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>Quality Check Dashboard</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Hi <strong>{userName}</strong> · {jobs.length} job{jobs.length !== 1 ? "s" : ""} awaiting QC · Updated {lastRefresh.format("HH:mm:ss")}
            </p>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} />
        </Tooltip>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Pending QC",       value: jobs.length,                                                    color: "#3b82f6", bg: "#eff6ff" },
          { label: "Live Inspections", value: liveCount,                                                      color: "#16a34a", bg: "#f0fdf4" },
          { label: "On Hold",          value: jobs.filter((j) => j.job_status === "on_hold").length,         color: "#f97316", bg: "#fff7ed" },
          { label: "Photos Taken",     value: jobs.reduce((acc, j) => acc + (j.qc_images?.length || 0), 0), color: "#8b5cf6", bg: "#f5f3ff" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Job grid */}
      <Spin spinning={loading}>
        {!loading && jobs.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "60px 20px", textAlign: "center", border: "1px solid #e5e7eb" }}>
            <Empty
              description={
                <div>
                  <div style={{ fontWeight: 700 }}>No pending QC jobs</div>
                  <div style={{ fontSize: 13 }}>Jobs in the quality check stage will appear here</div>
                </div>
              }
            />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {jobs.map((job) => {
              const sessData    = sessionMap[job._id];
              const displaySess = sessData
                ? { ...sessData, total_duration_seconds: getLiveDisplaySecs(job._id) }
                : null;
              return (
                <QCJobCard
                  key={job._id}
                  job={job}
                  sessionData={displaySess}
                  onOpenSession={handleOpenSession}
                  onCloseSession={handleCloseSession}
                  onOpenQCModal={openQCModal}
                />
              );
            })}
          </div>
        )}
      </Spin>

      {/* ── Session Notes Modal ─────────────────────────────────────────────── */}
      <Modal
        open={notesModal}
        onCancel={() => !actioning && setNotesModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pendingAction?.action === "open"    && <PlayCircleOutlined  style={{ color: "#1e40af" }} />}
            {pendingAction?.action === "on_hold" && <PauseCircleOutlined style={{ color: "#f97316" }} />}
            {pendingAction?.action === "passed"  && <CheckCircleOutlined style={{ color: "#16a34a" }} />}
            <span>
              {pendingAction?.action === "open"    && "Start Inspection"}
              {pendingAction?.action === "on_hold" && "Pause Inspection"}
              {pendingAction?.action === "passed"  && "Mark as Passed"}
            </span>
            {pendingAction?.job && <Tag color="blue">{pendingAction.job.job_no}</Tag>}
          </div>
        }
        footer={[
          <Button key="c" onClick={() => setNotesModal(false)}>Cancel</Button>,
          <Button
            key="ok"
            type="primary"
            loading={actioning}
            onClick={handleConfirmAction}
            style={{ background: pendingAction?.action === "passed" ? "#16a34a" : "#1e40af", border: "none" }}
          >
            Confirm
          </Button>,
        ]}
      >
        {pendingAction?.job && (
          <div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <div style={{ fontWeight: 700 }}>{pendingAction.job.customer_name}</div>
              <div>Stage: <strong>Quality Check</strong></div>
            </div>
            {(pendingAction.action === "on_hold" || pendingAction.action === "passed") && currentSessionData && (
              <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <div><ClockCircleOutlined /> Time logged: <strong>{fmtSecs(getLiveDisplaySecs(pendingAction.job._id))}</strong></div>
                <div>{currentSessionData.worked_days} day(s) · {currentSessionData.closed_sessions} session(s)</div>
              </div>
            )}
            <label>Notes (optional)</label>
            <TextArea rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
          </div>
        )}
      </Modal>

      {/* ── QC Inspection Modal ─────────────────────────────────────────────── */}
      <Modal
        open={qcModalOpen}
        onCancel={closeQCModal}
        title={<span><CameraOutlined /> Quality Inspection — {currentJob?.job_no}</span>}
        footer={null}
        width={680}
        destroyOnClose
      >
        {currentJob && (
          <div>
            {/* Design reference */}
            {designRef && <DesignFilePreview fileUrl={`https://job-server-cocj.onrender.com${designRef}`} label="Reference Design" />}

            {/* Daily summary */}
            {currentSessionData && (
              <DailySummaryBar
                dailySummary={currentSessionData.daily_summary || []}
                totalSecs={currentLiveSecs}
                workedDays={currentSessionData.worked_days || 0}
              />
            )}

            {/* Existing (server-saved) QC images */}
            {existingImages.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                  Saved Photos ({existingImages.length})
                </div>
                <QCImageGallery
                  images={existingImages.map((p) => p.startsWith("http") ? p : `https://job-server-cocj.onrender.com${p}`)}
                  readonly
                />
              </>
            )}

            {/* ── Upload / Camera via UploadHelper ────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#374151" }}>
                Add QC Photos
              </div>

              {/*
                UploadHelper props:
                  - image_path / setImagePath → our newImageUrls state
                  - multiple=true             → accumulate URLs
                  - showCamera=true           → show "Camera" button
                Images are uploaded to AWS immediately; URLs stored in newImageUrls.
              */}
              <CapUploadHelper
                image_path={newImageUrls.map((url, i) => ({ key: i + 1, path: url }))}
                setImagePath={handleNewImageAdded}
                multiple
                max={20}
                showCamera
              />

              {/* Preview newly uploaded AWS images */}
              {newImageUrls.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6, color: "#374151" }}>
                    New Photos ({newImageUrls.length})
                  </div>
                  <QCImageGallery images={newImageUrls} onRemove={removeNewImage} />
                </>
              )}

              <TextArea
                rows={2}
                placeholder="Inspection notes, observations…"
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                style={{ marginTop: 12 }}
              />
            </div>

            {/* Timer */}
            <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13 }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              Total QC time: <strong>{fmtSecs(currentLiveSecs)}</strong>
            </div>

            <Divider style={{ margin: "12px 0" }} />

            {/* Save / Approve / Reject */}
            {!showRejectInput ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button loading={saving} onClick={handleSaveOnly} style={{ flex: 1 }}>
                  Save Photos & Notes
                </Button>
                <Popconfirm
                  title="Pass this job's quality check?"
                  onConfirm={handleApprove}
                  okText="Yes, Pass"
                  okButtonProps={{ style: { background: "#16a34a" } }}
                >
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    style={{ flex: 1, background: "#16a34a", border: "none" }}
                  >
                    Approve & Pass
                  </Button>
                </Popconfirm>
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={() => setShowRejectInput(true)}
                  style={{ flex: 1, color: "#ef4444", borderColor: "#fca5a5" }}
                >
                  Reject / Fail
                </Button>
              </div>
            ) : (
              <div style={{ background: "#fef2f2", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Rejection Reason *</div>
                <TextArea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why does this fail QC? (e.g. misprint, wrong size, damaged)"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button danger icon={<CloseCircleOutlined />} loading={saving} onClick={handleReject}>
                    Confirm Fail
                  </Button>
                  <Button onClick={() => { setShowRejectInput(false); setRejectReason(""); }}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>
              * "Save Photos" keeps the job in QC. "Approve" moves it to the next stage. "Reject" sends it back for rework.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QualityCheckDashboard;