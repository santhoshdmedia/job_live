import { useEffect, useState, useCallback, useRef } from "react";
import {
  Button, Tag, Modal, Input, Spin, Empty,
  Tooltip, Divider, message, Popconfirm,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UploadOutlined, PlayCircleOutlined, EyeOutlined,
  FileImageOutlined, UserOutlined,
  ShoppingCartOutlined, CalendarOutlined, PhoneOutlined,
  ReloadOutlined, PauseCircleOutlined,
  HistoryOutlined, DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import UploadHelper from "../helper/UploadHelper";

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
const BASE = "http://localhost:8000/api/jobs";

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  accepted:    { label: "Accepted",    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  in_progress: { label: "In Progress", color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  on_hold:     { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  completed:   { label: "Completed",   color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
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

// ─── Daily summary bar ─────────────────────────────────────────────────────────
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
        <span><HistoryOutlined style={{ marginRight: 4 }} />Work History ({workedDays} day{workedDays !== 1 ? "s" : ""})</span>
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

// ─── Session status indicator ─────────────────────────────────────────────────
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
      {hasOpen ? "Session Live" : `${sessionData.worked_days || 0} day${(sessionData.worked_days || 0) !== 1 ? "s" : ""} logged`}
    </div>
  );
};

// ─── Design File Preview ───────────────────────────────────────────────────────
const DesignFilePreview = ({ fileUrl, label = "Uploaded Design" }) => {
  if (!fileUrl) return null;

  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(fileUrl);
  const isPdf   = /\.pdf(\?.*)?$/i.test(fileUrl);

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob     = await response.blob();
      const url      = URL.createObjectURL(blob);
      const ext      = fileUrl.split("?")[0].split(".").pop() || "file";
      const filename = `design_${Date.now()}.${ext}`;
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open in new tab
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div style={{
      border: "1px solid #c4b5fd", borderRadius: 10,
      overflow: "hidden", marginBottom: 14,
      background: "#faf5ff",
    }}>
      <div style={{
        padding: "8px 12px",
        background: "linear-gradient(135deg,#7c3aed,#9333ea)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5f3ff", letterSpacing: "0.05em" }}>
          <FileImageOutlined style={{ marginRight: 5 }} />{label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, color: "#e9d5ff", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              textDecoration: "none",
            }}
          >
            <EyeOutlined /> Open
          </a>
          <span
            onClick={handleDownload}
            style={{
              fontSize: 10, color: "#e9d5ff", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              cursor: "pointer",
            }}
          >
            <DownloadOutlined /> Download
          </span>
        </div>
      </div>

      {isImage ? (
        <div style={{ padding: 10, textAlign: "center", background: "#f5f3ff" }}>
          <img
            src={fileUrl}
            alt="Design preview"
            style={{
              maxWidth: "100%", maxHeight: 220,
              objectFit: "contain", borderRadius: 6,
              boxShadow: "0 2px 8px rgba(124,58,237,0.15)",
            }}
          />
        </div>
      ) : isPdf ? (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
          📄 PDF file —{" "}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>
            Click to view
          </a>
        </div>
      ) : (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
          📎 File attached —{" "}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>
            Download / View
          </a>
        </div>
      )}
    </div>
  );
};

// ─── Job Card ─────────────────────────────────────────────────────────────────
const JobCard = ({ job, sessionData, onOpenSession, onCloseSession, onViewUpload }) => {
  const delivDate  = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
  const isOverdue  = delivDate && delivDate.isBefore(dayjs());
  const isLive     = sessionData?.has_open_session;
  const isOnHold   = job.job_status === "on_hold";
  const isAccepted = job.job_status === "accepted";
  const hasDesign  = !!(job.design_file || job.cart_items?.some(i => i.design_file));

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: `1px solid ${isLive ? "#86efac" : "#e5e7eb"}`,
      boxShadow: isLive ? "0 0 0 2px #dcfce7, 0 4px 12px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Top bar */}
      <div style={{
        padding: "10px 14px",
        background: isLive
          ? "linear-gradient(135deg,#14532d 0%,#16a34a 100%)"
          : "linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontFamily: "monospace", fontWeight: 800, fontSize: 13,
          color: isLive ? "#bbf7d0" : "#93c5fd", letterSpacing: "0.05em",
        }}>
          {job.job_no}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isLive && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#bbf7d0",
              background: "rgba(255,255,255,0.15)", padding: "1px 7px", borderRadius: 10,
            }}>● LIVE</span>
          )}
          <StatusBadge status={job.job_status} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        {/* Customer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "#eff6ff", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0, border: "2px solid #bfdbfe",
          }}>
            <UserOutlined style={{ color: "#3b82f6", fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", lineHeight: 1.2 }}>
              {job.customer_name || "—"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
              <PhoneOutlined style={{ fontSize: 10 }} />
              {job.customer_phone || "—"}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <SessionStatusPill sessionData={sessionData} />
          </div>
        </div>

        {/* Items */}
        <div style={{
          background: "#f8fafc", borderRadius: 8,
          padding: "8px 10px", marginBottom: 10, border: "1px solid #e5e7eb",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5,
          }}>
            <ShoppingCartOutlined style={{ marginRight: 4 }} />Items
          </div>
          {(job.cart_items || []).slice(0, 2).map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, color: "#374151", marginBottom: 3,
            }}>
              <span style={{ fontWeight: 600 }}>
                {item.product_name}
                {item.size && <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {item.size}</span>}
              </span>
            </div>
          ))}
          {(job.cart_items || []).length > 2 && (
            <div style={{ fontSize: 11, color: "#6b7280" }}>+{job.cart_items.length - 2} more items</div>
          )}
        </div>

        {/* Time logged */}
        {sessionData && (sessionData.total_duration_seconds > 0 || sessionData.worked_days > 0) && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            background: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 11,
          }}>
            <span style={{ color: "#0369a1", fontWeight: 600 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {fmtSecs(sessionData.total_duration_seconds)} logged
            </span>
            <span style={{ color: "#374151" }}>
              {sessionData.worked_days} day{sessionData.worked_days !== 1 ? "s" : ""}
              · {sessionData.closed_sessions} session{sessionData.closed_sessions !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Delivery */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#6b7280" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {delivDate ? delivDate.format("DD MMM YYYY") : "—"}
            {isOverdue && <span style={{ marginLeft: 4, fontWeight: 700 }}>⚠ Overdue</span>}
          </div>
        </div>

        {/* Design status badge if exists */}
        {hasDesign && (
          <div style={{
            fontSize: 11, color: "#7c3aed", fontWeight: 600,
            marginBottom: 10,
            background: "#faf5ff", border: "1px solid #c4b5fd",
            borderRadius: 6, padding: "4px 8px",
            display: "inline-block",
          }}>
            <FileImageOutlined style={{ marginRight: 4 }} />
            Design Uploaded
            {job.design_status === "rejected" && (
              <span style={{ color: "#ef4444", marginLeft: 6 }}>· Rejected</span>
            )}
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
                flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12,
                background: isOnHold ? "#d97706" : "#1e40af",
                border: "none", borderRadius: 8,
              }}
            >
              {isOnHold ? "Resume" : "Start"}
            </Button>
          )}

          {isLive && (
            <Button
              icon={<PauseCircleOutlined />}
              size="small"
              danger
              onClick={() => onCloseSession(job, "on_hold")}
              style={{ flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12, borderRadius: 8 }}
            >
              Pause
            </Button>
          )}

          {isLive && (
            <Popconfirm
              title="Mark design stage as complete?"
              onConfirm={() => onCloseSession(job, "completed")}
              okText="Complete"
              okButtonProps={{ style: { background: "#16a34a", border: "none" } }}
            >
              <Button
                icon={<CheckCircleOutlined />}
                size="small"
                style={{
                  flex: 1, minWidth: 90, height: 32, fontWeight: 600, fontSize: 12,
                  borderRadius: 8, color: "#16a34a", borderColor: "#86efac", background: "#f0fdf4",
                }}
              >
                Complete
              </Button>
            </Popconfirm>
          )}

          <Tooltip title="Upload / View Design">
            <Button
              icon={<UploadOutlined />}
              size="small"
              onClick={() => onViewUpload(job)}
              style={{
                height: 32, borderRadius: 8,
                color: "#7c3aed", borderColor: "#c4b5fd", background: "#faf5ff",
              }}
            >
              Design
            </Button>
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
  const user     = profile();
  const userId   = user._id;
  const userName = user.name || user.fullName || user.username || "Designer";

  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [sessionMap, setSessionMap]   = useState({});
  const [lastRefresh, setLastRefresh] = useState(dayjs());

  // Notes modal
  const [notesModal, setNotesModal]       = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes, setActionNotes]     = useState("");
  const [actioning, setActioning]         = useState(false);

  // Design modal
  const [designModal, setDesignModal]         = useState(false);
  const [designJob, setDesignJob]             = useState(null);
  const [designFilePath, setDesignFilePath]   = useState("");   // path from UploadHelper
  const [designNotes, setDesignNotes]         = useState("");
  const [uploading, setUploading]             = useState(false);
  const [approving, setApproving]             = useState(false);
  const [rejecting, setRejecting]             = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Live timers
  const [liveTimers, setLiveTimers] = useState({});
  const timerRefs = useRef({});

  // ─── Load jobs ────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() });
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      const myJobs = rows.filter(j =>
        j.current_stage?.stage === "design" && j.design_status !== "approved"
      );
      setJobs(myJobs);
      setLastRefresh(dayjs());

      const map = {};
      await Promise.all(
        myJobs.map(async (j) => {
          try {
            const sr = await fetch(`${BASE}/${j._id}/session/status?stage=design`, { headers: authHeader() });
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
      message.error("Failed to load jobs: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── Live timer helpers ───────────────────────────────────────────────────
  const startLiveTimer = (jobId, sessionStartedAt, previousTotalSecs = 0) => {
    if (timerRefs.current[jobId]) return;
    setLiveTimers(prev => ({ ...prev, [jobId]: { startedAt: sessionStartedAt, base: previousTotalSecs } }));
    timerRefs.current[jobId] = setInterval(() => {
      setLiveTimers(prev => {
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
    setLiveTimers(prev => { const next = { ...prev }; delete next[jobId]; return next; });
  };

  useEffect(() => () => { Object.values(timerRefs.current).forEach(clearInterval); }, []);

  const getLiveDisplaySecs = (jobId) => {
    const entry = liveTimers[jobId];
    if (!entry) return sessionMap[jobId]?.total_duration_seconds || 0;
    return (entry.base || 0) + (entry.currentSessionSecs || 0);
  };

  // ─── Open session ─────────────────────────────────────────────────────────
  const handleOpenSession = (job) => {
    setPendingAction({ job, action: "open" });
    setActionNotes("");
    setNotesModal(true);
  };

  const confirmOpenSession = async () => {
    const { job } = pendingAction;
    setActioning(true);
    try {
      const res  = await fetch(`${BASE}/${job._id}/session/open`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          stage: "design", stage_label: "Design",
          user: { user_id: userId, name: userName, role: "designing team" },
          notes: actionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open session");
      message.success(`Session started for ${job.job_no}!`);
      setNotesModal(false);
      startLiveTimer(job._id, new Date(), sessionMap[job._id]?.total_duration_seconds || 0);
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setActioning(false);
    }
  };

  // ─── Close session ────────────────────────────────────────────────────────
  const handleCloseSession = (job, action) => {
    setPendingAction({ job, action });
    setActionNotes("");
    setNotesModal(true);
  };

  const confirmCloseSession = async () => {
    const { job, action } = pendingAction;
    setActioning(true);
    try {
      const res  = await fetch(`${BASE}/${job._id}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "design", action, notes: actionNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to close session");
      const msgs = {
        on_hold:   `Paused! ${data.data?.stage_summary?.total_duration_display || ""} logged.`,
        completed: `Design complete! Total: ${data.data?.stage_summary?.total_duration_display || ""} across ${data.data?.stage_summary?.worked_days || 0} days.`,
        rejected:  "Design stage rejected.",
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
    if (pendingAction.action === "open") confirmOpenSession();
    else confirmCloseSession();
  };

  // ─── Design modal ─────────────────────────────────────────────────────────
  const openDesignModal = (job) => {
    setDesignJob(job);
    setDesignFilePath(job.design_file || "");
    setDesignNotes("");
    setShowRejectInput(false);
    setRejectReason("");
    setDesignModal(true);
  };

  const closeDesignModal = () => {
    setDesignModal(false);
    setDesignJob(null);
    setDesignFilePath("");
  };

  // ─── Upload design (path already set by UploadHelper) ────────────────────
  const handleUploadDesign = async () => {
    if (!designFilePath) { message.warning("Please upload a design file first"); return; }
    setUploading(true);
    try {
      const liveSecs = getLiveDisplaySecs(designJob._id);
      const res = await fetch(`${BASE}/${designJob._id}/upload_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          design_file:       designFilePath,
          notes:             designNotes,
          duration_seconds:  liveSecs,
          duration_display:  fmtSecs(liveSecs),
          handled_by:        { user_id: userId, name: userName },
          stage:             designJob.current_stage?.stage || "design",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");
      message.success("Design saved successfully!");
      stopLiveTimer(designJob._id);
      closeDesignModal();
      loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const updateStutusAfterDesignUpload = async (newStatus) => {
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/status`, {
        method: "PATCH", headers: jsonHeader(),
        body: JSON.stringify({ job_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Status update failed");
    } catch (err) {
      message.error("Failed to update design status: " + err.message);
    }
  };

  const handleApproveDesign = async () => {
    setApproving(true);
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/approve_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: designNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      await updateStutusAfterDesignUpload("production");
      message.success("Design approved!");
      closeDesignModal();
      loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectDesign = async () => {
    if (!rejectReason.trim()) { message.warning("Please provide a rejection reason"); return; }
    setRejecting(true);
    try {
      const res  = await fetch(`${BASE}/${designJob._id}/reject_design`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Rejection failed");
      message.success("Design rejected with feedback.");
      closeDesignModal();
      loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setRejecting(false);
    }
  };

  // Derived values for design modal
  const existingDesignFile = designJob?.design_file;
  const cartDesignFile     = designJob?.cart_items?.find(i => i.design_file)?.design_file;
  const hasExistingDesign  = !!(existingDesignFile || cartDesignFile);
  const designSessData     = designJob ? sessionMap[designJob._id] : null;
  const designLiveSecs     = designJob ? getLiveDisplaySecs(designJob._id) : 0;

  const liveCount = Object.values(sessionMap).filter(s => s?.has_open_session).length;

  return (
    <div style={{
      padding: "16px",
      background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%,#faf5ff 100%)",
      minHeight: "100vh",
    }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "14px 18px", marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg,#1e3a8a,#3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileImageOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>My Design Jobs</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Hi <strong>{userName}</strong> · {jobs.length} active job{jobs.length !== 1 ? "s" : ""}
              · Updated {lastRefresh.format("HH:mm:ss")}
              · <span style={{ color: "#16a34a", fontWeight: 600 }}>Approved jobs hidden</span>
            </p>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} style={{ borderRadius: 8 }} />
        </Tooltip>
      </div>

      {/* Summary strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
        gap: 10, marginBottom: 16,
      }}>
        {[
          { label: "Total Assigned",  value: jobs.length,                                                                        color: "#3b82f6", bg: "#eff6ff" },
          { label: "Live Sessions",   value: liveCount,                                                                          color: "#16a34a", bg: "#f0fdf4" },
          { label: "On Hold",         value: jobs.filter(j => j.job_status === "on_hold").length,                                color: "#f97316", bg: "#fff7ed" },
          { label: "Design Uploaded", value: jobs.filter(j => j.design_file || j.cart_items?.some(i => i.design_file)).length,  color: "#8b5cf6", bg: "#f5f3ff" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Job Grid */}
      <Spin spinning={loading}>
        {jobs.length === 0 && !loading ? (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "60px 20px",
            textAlign: "center", border: "1px solid #e5e7eb",
          }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 4 }}>No jobs assigned</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Jobs assigned to you in the design stage will appear here.</div>
                </div>
              }
            />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
            {jobs.map(job => {
              const sessData    = sessionMap[job._id];
              const displaySess = sessData
                ? { ...sessData, total_duration_seconds: getLiveDisplaySecs(job._id) }
                : null;
              return (
                <JobCard
                  key={job._id}
                  job={job}
                  sessionData={displaySess}
                  onOpenSession={handleOpenSession}
                  onCloseSession={handleCloseSession}
                  onViewUpload={openDesignModal}
                />
              );
            })}
          </div>
        )}
      </Spin>

      {/* ════ SESSION NOTES MODAL ════ */}
      <Modal
        open={notesModal}
        onCancel={() => !actioning && setNotesModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pendingAction?.action === "open"
              ? <PlayCircleOutlined style={{ color: "#1e40af" }} />
              : pendingAction?.action === "on_hold"
                ? <PauseCircleOutlined style={{ color: "#f97316" }} />
                : <CheckCircleOutlined style={{ color: "#16a34a" }} />
            }
            <span style={{ fontWeight: 700 }}>
              {pendingAction?.action === "open"      && "Start / Resume Session"}
              {pendingAction?.action === "on_hold"   && "Pause Session (On Hold)"}
              {pendingAction?.action === "completed" && "Complete Design Stage"}
            </span>
            {pendingAction?.job && (
              <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>
                {pendingAction.job.job_no}
              </Tag>
            )}
          </div>
        }
        footer={[
          <Button key="c" onClick={() => setNotesModal(false)} disabled={actioning}>Cancel</Button>,
          <Button
            key="ok" type="primary" loading={actioning} onClick={handleConfirmAction}
            style={{
              background:
                pendingAction?.action === "on_hold"   ? "#f97316" :
                pendingAction?.action === "completed" ? "#16a34a" : "#1e40af",
              border: "none",
            }}
          >
            Confirm
          </Button>,
        ]}
        width={440}
        destroyOnClose
      >
        {pendingAction?.job && (() => {
          const sessData = sessionMap[pendingAction.job._id];
          return (
            <div>
              <div style={{
                background: "#f8fafc", borderRadius: 8, padding: "10px 12px",
                marginBottom: 14, border: "1px solid #e5e7eb",
              }}>
                <div style={{ fontWeight: 700, color: "#111827" }}>{pendingAction.job.customer_name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Stage: <strong>{pendingAction.job.current_stage?.stage_label || "Design"}</strong>
                </div>
              </div>

              {(pendingAction.action === "on_hold" || pendingAction.action === "completed") && sessData && (
                <div style={{
                  background: "#f0f9ff", border: "1px solid #bae6fd",
                  borderRadius: 8, padding: "10px 12px", marginBottom: 14,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />Time Logged So Far
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1e40af", fontFamily: "monospace" }}>
                    {fmtSecs(getLiveDisplaySecs(pendingAction.job._id))}
                  </div>
                  {sessData.worked_days > 0 && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {sessData.worked_days} day{sessData.worked_days !== 1 ? "s" : ""} worked
                      · {sessData.closed_sessions} session{sessData.closed_sessions !== 1 ? "s" : ""} closed
                    </div>
                  )}
                  {sessData.daily_summary?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {sessData.daily_summary.map((d, i) => (
                        <div key={d.date} style={{
                          display: "flex", justifyContent: "space-between",
                          fontSize: 11, color: "#374151", padding: "2px 0",
                          borderTop: i > 0 ? "1px solid #e0f2fe" : undefined,
                        }}>
                          <span>Day {i + 1} — {dayjs(d.date).format("DD MMM")}</span>
                          <span style={{ fontWeight: 700, color: "#0369a1" }}>{d.display}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label style={{
                display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                Notes (optional)
              </label>
              <TextArea
                rows={3}
                placeholder={
                  pendingAction.action === "open"      ? "Starting Day 1 / resuming work…" :
                  pendingAction.action === "on_hold"   ? "Done for today, resuming tomorrow…" :
                                                         "Final notes for design completion…"
                }
                value={actionNotes}
                onChange={e => setActionNotes(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>
          );
        })()}
      </Modal>

      {/* ════ DESIGN UPLOAD + REVIEW MODAL ════ */}
      <Modal
        open={designModal}
        onCancel={closeDesignModal}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileImageOutlined style={{ color: "#7c3aed" }} />
            <span style={{ fontWeight: 700 }}>Design Workspace</span>
            {designJob && (
              <Tag color="purple" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>
                {designJob.job_no}
              </Tag>
            )}
          </div>
        }
        footer={null}
        width={580}
        destroyOnClose
        styles={{ body: { maxHeight: "80vh", overflowY: "auto", padding: "16px 20px" } }}
      >
        {designJob && (
          <div>
            {/* Job Summary */}
            <div style={{
              background: "linear-gradient(135deg,#f5f3ff,#eff6ff)",
              borderRadius: 10, padding: "12px 14px", marginBottom: 14,
              border: "1px solid #ddd6fe",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{designJob.customer_name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    <PhoneOutlined style={{ marginRight: 4 }} />{designJob.customer_phone}
                  </div>
                </div>
                <StatusBadge status={designJob.job_status} />
              </div>
              <div style={{ marginTop: 10 }}>
                {(designJob.cart_items || []).map((item, i) => (
                  <div key={i} style={{
                    fontSize: 12, color: "#374151", display: "flex",
                    justifyContent: "space-between", padding: "3px 0",
                    borderTop: i > 0 ? "1px solid #e9d5ff" : undefined,
                  }}>
                    <span>
                      <strong>{item.product_name}</strong>
                      {item.size  && <span style={{ color: "#9ca3af" }}> · {item.size}</span>}
                      {item.notes && <span style={{ color: "#7c3aed" }}> · {item.notes}</span>}
                    </span>
                    <span style={{ fontWeight: 700, color: "#1e40af" }}>₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live timer */}
            <div style={{
              background: liveTimers[designJob._id] ? "#eff6ff" : "#f9fafb",
              border: `1px solid ${liveTimers[designJob._id] ? "#bfdbfe" : "#e5e7eb"}`,
              borderRadius: 10, padding: "12px 14px", marginBottom: 14,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
              }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                Accumulated Design Time
                {liveTimers[designJob._id] && (
                  <span style={{
                    marginLeft: 8, color: "#16a34a", background: "#dcfce7",
                    padding: "1px 6px", borderRadius: 8, fontSize: 10,
                  }}>● LIVE</span>
                )}
              </div>
              <div style={{
                fontFamily: "monospace", fontSize: 28, fontWeight: 800,
                color: liveTimers[designJob._id] ? "#1e40af" : "#9ca3af",
                letterSpacing: "0.08em",
              }}>
                {fmtSecs(designLiveSecs)}
              </div>
              {designSessData && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {designSessData.worked_days || 0} day{(designSessData.worked_days || 0) !== 1 ? "s" : ""}
                  · {designSessData.closed_sessions || 0} session{(designSessData.closed_sessions || 0) !== 1 ? "s" : ""} closed
                </div>
              )}
            </div>

            {/* Daily summary */}
            {designSessData?.daily_summary?.length > 0 && (
              <DailySummaryBar
                dailySummary={designSessData.daily_summary}
                totalSecs={designLiveSecs}
                workedDays={designSessData.worked_days || 0}
              />
            )}

            {/* ── Reference / cart design files preview ── */}
            {(designJob.cart_items || []).some(i => i.design_file) && (
              <>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
                }}>
                  <EyeOutlined style={{ marginRight: 4 }} />Reference Design(s) from Order
                </div>
                {(designJob.cart_items || []).filter(i => i.design_file).map((item, idx) => (
                  <DesignFilePreview
                    key={idx}
                    fileUrl={item.design_file}
                    label={`${item.product_name} — Reference`}
                  />
                ))}
              </>
            )}

            {/* ── Upload Design section using UploadHelper ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
              }}>
                <UploadOutlined style={{ marginRight: 4 }} />
                {existingDesignFile ? "Update Design File" : "Upload Design File"}
              </div>

              {/* Show existing uploaded design preview */}
              {existingDesignFile && (
                <DesignFilePreview fileUrl={existingDesignFile} label="Current Uploaded Design" />
              )}

              {/* UploadHelper replaces old Upload.Dragger */}
              <UploadHelper
                setImagePath={(path) => setDesignFilePath(path)}
                image_path={designFilePath}
              />

              <div style={{ marginTop: 10 }}>
                <label style={{
                  display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280",
                  marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  Upload Notes
                </label>
                <TextArea
                  rows={2}
                  placeholder="Describe the design, version notes…"
                  value={designNotes}
                  onChange={e => setDesignNotes(e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </div>

              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
                disabled={!designFilePath}
                onClick={handleUploadDesign}
                style={{
                  marginTop: 10, width: "100%", height: 38,
                  background: "#7c3aed", border: "none",
                  borderRadius: 8, fontWeight: 600,
                }}
              >
                {existingDesignFile ? "Update Design" : "Save Design"}
                {designLiveSecs > 0 && ` (${fmtSecs(designLiveSecs)} logged)`}
              </Button>
            </div>

            {/* ── Approve / Reject ── */}
            {hasExistingDesign && (
              <>
                <Divider style={{ margin: "12px 0" }}>
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Design Review</span>
                </Divider>
                <div style={{
                  background: "#fefce8", border: "1px solid #fde68a",
                  borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                  fontSize: 12, color: "#92400e",
                }}>
                  ✅ A design file has been uploaded. You can approve or reject it below.
                  {designJob.design_status === "rejected" && designJob.design_rejection_reason && (
                    <div style={{ marginTop: 6, color: "#ef4444", fontWeight: 600 }}>
                      ⚠ Previously rejected: "{designJob.design_rejection_reason}"
                    </div>
                  )}
                </div>

                {!showRejectInput ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    <Popconfirm
                      title="Approve this design?"
                      description="This will mark the design as approved and move the job forward."
                      onConfirm={handleApproveDesign}
                      okText="Approve"
                      okButtonProps={{ style: { background: "#16a34a", border: "none" } }}
                    >
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        loading={approving}
                        style={{ flex: 1, height: 38, background: "#16a34a", border: "none", borderRadius: 8, fontWeight: 600 }}
                      >
                        Approve Design
                      </Button>
                    </Popconfirm>
                    <Button
                      icon={<CloseCircleOutlined />}
                      onClick={() => setShowRejectInput(true)}
                      style={{ flex: 1, height: 38, color: "#ef4444", borderColor: "#fca5a5", borderRadius: 8, fontWeight: 600 }}
                    >
                      Reject Design
                    </Button>
                  </div>
                ) : (
                  <div style={{
                    background: "#fef2f2", border: "1px solid #fca5a5",
                    borderRadius: 10, padding: "12px",
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#ef4444",
                      marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      Rejection Reason <span style={{ color: "#ef4444" }}>*</span>
                    </div>
                    <TextArea
                      rows={3}
                      placeholder="Explain what needs to be fixed…"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      style={{ borderRadius: 8, borderColor: "#fca5a5", marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        danger icon={<CloseCircleOutlined />}
                        loading={rejecting}
                        onClick={handleRejectDesign}
                        style={{ flex: 1, borderRadius: 8, fontWeight: 600 }}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                        style={{ borderRadius: 8 }}
                      >
                        Back
                      </Button>
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