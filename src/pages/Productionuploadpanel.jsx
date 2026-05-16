import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import { uploadImage } from "../api/index";

// ─── API ──────────────────────────────────────────────────────────────────────
const API_BASE = "https://api.dmedia.in/api";

const api = async (url, opts = {}) => {
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const INK_COLORS = [
  "Cyan", "Magenta", "Yellow", "Black", "White",
  "Light Cyan", "Light Magenta", "Orange", "Green", "Other",
];

const WASTAGE_REASONS = [
  { value: "margin_trim",       label: "Margin trim (top/bottom)" },
  { value: "misprint",          label: "Misprint" },
  { value: "roll_end",          label: "End of roll" },
  { value: "color_calibration", label: "Color calibration" },
  { value: "customer_change",   label: "Customer spec change" },
  { value: "equipment_fault",   label: "Equipment fault" },
  { value: "other",             label: "Other" },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismiss = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    []
  );
  return { toasts, show, dismiss };
};

const ToastContainer = ({ toasts, dismiss }) => (
  <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
    {toasts.map((t) => {
      const cfg = {
        info:    { bar: "bg-sky-400",     icon: "ℹ" },
        success: { bar: "bg-emerald-400", icon: "✓" },
        error:   { bar: "bg-rose-400",    icon: "✕" },
        warning: { bar: "bg-amber-400",   icon: "⚠" },
      }[t.type] || { bar: "bg-sky-400", icon: "ℹ" };
      return (
        <div
          key={t.id}
          className="bg-slate-900 text-white rounded-xl overflow-hidden shadow-2xl flex items-stretch animate-slide-up"
        >
          <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />
          <div className="flex items-center gap-3 px-4 py-3 flex-1">
            <span className={`text-sm font-bold ${cfg.bar.replace("bg-", "text-")}`}>
              {cfg.icon}
            </span>
            <span className="text-sm flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-40 hover:opacity-100 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin flex-shrink-0">
    <circle
      cx="12" cy="12" r="10"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="30 62"
    />
  </svg>
);

// ─── Button ───────────────────────────────────────────────────────────────────
const Btn = ({
  children, onClick, disabled, loading,
  variant = "primary", size = "md", className = "",
  type = "button", fullWidth,
}) => {
  const base = `inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed select-none ${fullWidth ? "w-full" : ""}`;
  const sizes = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-3.5 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200",
    ghost:   "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger:  "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
    purple:  "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200",
    amber:   "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-200",
    sky:     "bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-200",
    orange:  "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-200",
  };
  return (
    <button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant] || variants.primary} ${className}`}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "", onClick, hoverable }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${
      hoverable
        ? "cursor-pointer hover:border-violet-200 hover:shadow-md transition-all duration-150"
        : ""
    } ${className}`}
  >
    {children}
  </div>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, badge }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-4xl mb-3 opacity-30">{icon}</div>
    <p className="text-sm font-semibold text-slate-400">{title}</p>
    {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
  </div>
);

// ─── StatusDot ────────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    draft:         ["bg-slate-300",  "Draft"],
    accepted:      ["bg-sky-400",    "Accepted"],
    in_progress:   ["bg-amber-400",  "In Progress"],
    production:    ["bg-violet-500", "Production"],
    on_hold:       ["bg-orange-400", "On Hold"],
    completed:     ["bg-emerald-400","Completed"],
    delivery:      ["bg-blue-400",   "Delivery"],
    rejected:      ["bg-rose-400",   "Rejected"],
    quality_check: ["bg-teal-400",   "Quality Check"],
  };
  const [color, label] = map[status] || ["bg-slate-300", status || "—"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const CameraIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const DriveIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28.35 52H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="M43.65 25L29.05 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5A9.06 9.06 0 0 0 0 52h28.35z" fill="#00ac47"/>
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L85.1 56.5c.8-1.4 1.2-2.95 1.2-4.5H57.95l6.2 11.55z" fill="#ea4335"/>
    <path d="M43.65 25L58.25 0H29.05z" fill="#00832d"/>
    <path d="M57.95 52H87.3L73.55 27.3 58.95 2.6l-15.3 22.4z" fill="#2684fc"/>
    <path d="M28.35 52l15.3-27H57.95L43.65 25z" fill="#ffba00"/>
  </svg>
);

// ─── Live Session Timer ───────────────────────────────────────────────────────
const useLiveTimer = (openSince) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!openSince) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(openSince)) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [openSince]);

  const display = useMemo(() => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [elapsed]);

  return { elapsed, display };
};

// ─── Session Controls ─────────────────────────────────────────────────────────
//
// API URL FIX SUMMARY (matched to your backend controller routes):
//   GET  session status  →  /jobs/:id/session/status?stage=...   (was /session-status)
//   POST start session   →  /jobs/:id/start                      (unchanged ✓)
//   POST pause session   →  /jobs/:id/session/close              (was /close-session)
//   POST resume session  →  /jobs/:id/session/open               (was /open-session)
//   POST complete stage  →  /jobs/:id/session/close              (was /close-session)
//
const SessionControls = ({ job, user, onSessionChange, show: showToast }) => {
  const [sessionStatus, setSessionStatus] = useState(null); // raw API data
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // "start"|"pause"|"resume"|"complete"
  const [notesInput,    setNotesInput]    = useState("");
  const [showNotes,     setShowNotes]     = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const stage = job.current_stage?.stage || "production";

  // ── Fetch session status from backend ──────────────────────────────────────
  // FIXED: was /jobs/${id}/session-status  →  now /jobs/${id}/session/status
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/jobs/${job._id}/session/status?stage=${stage}`);
      // res.data contains: has_open_session, open_since, stage_action,
      // total_duration_display, total_sessions, etc.
      setSessionStatus(res.data || null);
    } catch (err) {
      console.warn("Session status fetch failed:", err.message);
      setSessionStatus(null);
    } finally {
      setLoading(false);
    }
  }, [job._id, stage]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Derive display values from sessionStatus ───────────────────────────────
  const hasOpen      = sessionStatus?.has_open_session ?? false;
  const openSince    = hasOpen ? (sessionStatus?.open_since ?? null) : null;
  const stageAction  = sessionStatus?.stage_action ?? null;
  const totalDisplay = sessionStatus?.total_duration_display || "00:00:00";
  const totalSessions= sessionStatus?.total_sessions ?? 0;

  const { display: liveDisplay } = useLiveTimer(openSince);

  // ── Derive session state from API response ─────────────────────────────────
  // Logic:
  //   "completed" / "passed"  →  stage is done
  //   has_open_session = true →  currently running
  //   total_sessions > 0 but no open session → paused
  //   otherwise → not started
  const sessionState = useMemo(() => {
    if (!sessionStatus) return "not_started";
    if (stageAction === "completed" || stageAction === "passed") return "completed";
    if (hasOpen) return "running";
    if (totalSessions > 0) return "paused";
    return "not_started";
  }, [sessionStatus, stageAction, hasOpen, totalSessions]);

  // ── Execute a session action ───────────────────────────────────────────────
  const execAction = async (action) => {
    setActionLoading(action);
    try {
      const handledBy = {
        user_id: user?._id  || "",
        name:    user?.name || "Production Team",
        role:    user?.role || "printing team",
      };

      if (action === "start") {
        // POST /api/jobs/:id/start  — opens a new session for the stage
        await api(`/jobs/${job._id}/start`, {
          method: "POST",
          body: JSON.stringify({
            stage,
            handled_by: handledBy,
            notes: notesInput || undefined,
          }),
        });
        showToast(`Session started for ${job.job_no}`, "success");

      } else if (action === "pause") {
        // FIXED: was /close-session  →  now /session/close
        await api(`/jobs/${job._id}/session/close`, {
          method: "POST",
          body: JSON.stringify({
            stage,
            action: "on_hold",
            notes: notesInput || undefined,
          }),
        });
        showToast(`Session paused for ${job.job_no}`, "warning");

      } else if (action === "resume") {
        // FIXED: was /open-session  →  now /session/open
        await api(`/jobs/${job._id}/session/open`, {
          method: "POST",
          body: JSON.stringify({
            stage,
            user: {
              user_id: handledBy.user_id,
              name:    handledBy.name,
              role:    handledBy.role,
            },
            notes: notesInput || undefined,
          }),
        });
        showToast(`Session resumed for ${job.job_no}`, "success");

      } else if (action === "complete") {
        // FIXED: was /close-session  →  now /session/close
        await api(`/jobs/${job._id}/session/close`, {
          method: "POST",
          body: JSON.stringify({
            stage,
            action: "completed",
            notes: notesInput || undefined,
          }),
        });
        showToast(`Stage completed for ${job.job_no}! 🎉`, "success");
      }

      // Reset notes UI
      setNotesInput("");
      setShowNotes(false);
      setPendingAction(null);

      // Re-fetch to get fresh state from backend → triggers re-render with correct buttons
      await fetchStatus();
      onSessionChange?.(job._id, action);

    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const requestAction = (action) => {
    // Pause and complete prompt for optional notes before executing
    if (action === "pause" || action === "complete") {
      setPendingAction(action);
      setShowNotes(true);
    } else {
      execAction(action);
    }
  };

  const confirmAction = () => { if (pendingAction) execAction(pendingAction); };
  const cancelAction  = () => { setPendingAction(null); setShowNotes(false); setNotesInput(""); };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-2">
      <Spinner size={13} />
      <span className="text-xs">Loading session…</span>
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Status banner ── */}
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
        sessionState === "running"   ? "bg-emerald-50 border-emerald-200" :
        sessionState === "paused"    ? "bg-orange-50 border-orange-200"   :
        sessionState === "completed" ? "bg-sky-50 border-sky-200"         :
                                       "bg-slate-50 border-slate-200"
      }`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          sessionState === "running"   ? "bg-emerald-500 animate-pulse" :
          sessionState === "paused"    ? "bg-orange-400"                :
          sessionState === "completed" ? "bg-sky-500"                   :
                                         "bg-slate-300"
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-black ${
              sessionState === "running"   ? "text-emerald-700" :
              sessionState === "paused"    ? "text-orange-700"  :
              sessionState === "completed" ? "text-sky-700"     :
                                             "text-slate-500"
            }`}>
              {sessionState === "running"   ? "● Running"        :
               sessionState === "paused"    ? "⏸ Paused"        :
               sessionState === "completed" ? "✓ Stage Complete" :
                                              "○ Not Started"}
            </span>

            {sessionState === "running" && (
              <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                {liveDisplay}
              </span>
            )}

            {(sessionState === "paused" || sessionState === "completed") && totalDisplay !== "00:00:00" && (
              <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                {totalDisplay} total
              </span>
            )}
          </div>

          {totalSessions > 0 && sessionState !== "not_started" && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {totalSessions} session{totalSessions > 1 ? "s" : ""} logged
            </p>
          )}
        </div>

        <button
          onClick={fetchStatus}
          className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold flex-shrink-0"
          title="Refresh session status"
        >
          ↻
        </button>
      </div>

      {/* ── Action buttons — driven purely by sessionState ── */}
      {sessionState !== "completed" && (
        <div className="flex gap-2 flex-wrap">

          {sessionState === "not_started" && (
            <Btn
              variant="success" size="sm"
              loading={actionLoading === "start"}
              disabled={!!actionLoading}
              onClick={() => requestAction("start")}
              className="flex-1"
            >
              ▶ Start Session
            </Btn>
          )}

          {sessionState === "running" && (
            <>
              <Btn
                variant="orange" size="sm"
                loading={actionLoading === "pause"}
                disabled={!!actionLoading}
                onClick={() => requestAction("pause")}
                className="flex-1"
              >
                ⏸ Pause
              </Btn>
              <Btn
                variant="primary" size="sm"
                loading={actionLoading === "complete"}
                disabled={!!actionLoading}
                onClick={() => requestAction("complete")}
                className="flex-1"
              >
                ✓ Complete Stage
              </Btn>
            </>
          )}

          {sessionState === "paused" && (
            <>
              <Btn
                variant="success" size="sm"
                loading={actionLoading === "resume"}
                disabled={!!actionLoading}
                onClick={() => requestAction("resume")}
                className="flex-1"
              >
                ▶ Resume
              </Btn>
              <Btn
                variant="primary" size="sm"
                loading={actionLoading === "complete"}
                disabled={!!actionLoading}
                onClick={() => requestAction("complete")}
                className="flex-1"
              >
                ✓ Complete Stage
              </Btn>
            </>
          )}
        </div>
      )}

      {/* ── Notes prompt (for pause / complete) ── */}
      {showNotes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-slide-up">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            {pendingAction === "pause" ? "⏸ Pause Note" : "✓ Completion Note"}{" "}
            <span className="text-slate-400 normal-case font-normal">(optional)</span>
          </p>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            rows={2}
            placeholder={
              pendingAction === "pause"
                ? "Reason for pausing (e.g. lunch break, media change)…"
                : "Completion notes (e.g. quality checked, ready for next stage)…"
            }
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 resize-none placeholder:text-slate-300"
          />
          <div className="flex gap-2">
            <Btn
              variant={pendingAction === "pause" ? "orange" : "success"}
              size="sm"
              loading={!!actionLoading}
              onClick={confirmAction}
              className="flex-1"
            >
              {pendingAction === "pause" ? "⏸ Confirm Pause" : "✓ Confirm Complete"}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={cancelAction} className="flex-shrink-0">
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {/* ── Completed banner ── */}
      {sessionState === "completed" && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2.5">
          <span className="text-sky-500 text-sm">✓</span>
          <p className="text-xs text-sky-700 font-semibold">
            Stage completed · {totalDisplay} total time logged
          </p>
        </div>
      )}
    </div>
  );
};

// ─── CameraUpload ─────────────────────────────────────────────────────────────
const CameraUpload = ({ onUploaded, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) { alert(`"${file.name}" is not a supported image type.`); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await uploadImage(formData);
      const url    = result?.data?.data?.url || "";
      if (!url) throw new Error("No URL returned from upload");
      onUploaded(url);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
      <button
        type="button"
        disabled={loading || disabled}
        onClick={() => !loading && !disabled && inputRef.current?.click()}
        className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-violet-500 flex-shrink-0"
      >
        {loading ? (
          <><Spinner size={22} /><span className="text-[10px] font-medium">Uploading…</span></>
        ) : (
          <><CameraIcon size={24} /><span className="text-[10px] font-semibold">Take photo</span></>
        )}
      </button>
    </>
  );
};

// ─── ImageThumb ───────────────────────────────────────────────────────────────
const ImageThumb = ({ url, index, onRemove }) => (
  <div className="relative group flex-shrink-0">
    <img src={url} alt={`Production photo ${index + 1}`} className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm" />
    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">#{index + 1}</span>
    <button
      type="button" onClick={() => onRemove(index)}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity leading-none"
    >×</button>
  </div>
);

// ─── DriveFileBanner ──────────────────────────────────────────────────────────
const DriveFileBanner = ({ driveLink }) => {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(driveLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-amber-200">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
        <DriveIcon size={13} />
        <span className="text-xs font-bold text-amber-800 flex-1">Original File — Google Drive</span>
        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 flex-shrink-0">⏱ 48 hr cleanup</span>
      </div>
      <div className="bg-white px-3 py-3 space-y-2.5">
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          <span className="text-rose-500 text-sm flex-shrink-0 mt-px">⚠</span>
          <p className="text-[11px] leading-relaxed text-rose-700">
            <span className="font-bold">Auto-deleted after 48 hours.</span> Download or move to permanent storage before it is removed.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <DriveIcon size={12} />
          <span className="text-[11px] text-slate-500 font-mono truncate flex-1">{driveLink.length > 52 ? driveLink.slice(0, 52) + "…" : driveLink}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(driveLink, "_blank")} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.97] text-white text-xs font-bold py-2 rounded-lg transition-all">
            <DriveIcon size={12} />Open in Drive
          </button>
          <button onClick={copyLink} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] text-slate-700 text-xs font-bold py-2 rounded-lg transition-all border border-slate-200">
            {copied ? "✓ Copied!" : "⎘ Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DesignFileCard ───────────────────────────────────────────────────────────
const DesignFileCard = ({ designFile, designDriveLink, designStatus, jobNo }) => {
  const [lightbox, setLightbox] = useState(false);
  const fileName = designFile?.split("/").pop()?.split("?")[0] || `design_${jobNo}`;
  const isImage  = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  const isPdf    = /\.pdf$/i.test(fileName);
  const statusMap = {
    approved: { ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", badge: "✓ Approved" },
    uploaded: { ring: "border-sky-200 bg-sky-50",         text: "text-sky-700",     badge: "● Uploaded" },
    pending:  { ring: "border-amber-200 bg-amber-50",     text: "text-amber-700",   badge: "◆ Pending" },
    rejected: { ring: "border-rose-200 bg-rose-50",       text: "text-rose-700",    badge: "✕ Rejected" },
  };
  const s = statusMap[designStatus] || statusMap.pending;
  const download = () => { const a = document.createElement("a"); a.href = designFile; a.download = fileName; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); };
  return (
    <>
      <div className={`border rounded-xl overflow-hidden ${s.ring}`}>
        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${s.ring}`}>
          <span className={`text-xs font-bold flex-shrink-0 ${s.text}`}>{s.badge}</span>
          <div className="flex items-center gap-2 min-w-0">
            {designDriveLink && (
              <span className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#1a73e8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#c5d9f8] flex-shrink-0">
                <DriveIcon size={10} />Original on Drive
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono truncate">{fileName}</span>
          </div>
        </div>
        {isImage && (
          <div className="bg-slate-100 relative">
            <img src={designFile} alt="Design" className="w-full max-h-52 object-contain cursor-zoom-in" onClick={() => setLightbox(true)} />
            <div className="absolute top-2 left-2 bg-violet-600/80 text-white text-[9px] font-black px-2 py-0.5 rounded-md tracking-wider uppercase backdrop-blur-sm">Sample · ≤1 MB</div>
          </div>
        )}
        {!isImage && (
          <div className="flex items-center gap-3 px-3 py-4 bg-white/60">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-2xl">{isPdf ? "📄" : "🎨"}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{fileName}</div>
              <div className="text-xs text-slate-400 mt-0.5">{isPdf ? "PDF Document" : "Design File"} — tap Preview to open</div>
            </div>
          </div>
        )}
        <div className="flex gap-2 px-3 py-2.5 bg-white/80 border-t border-white/60">
          <Btn variant="ghost" size="sm" onClick={() => window.open(designFile, "_blank")} className="flex-1">Preview Sample</Btn>
          <Btn variant="primary" size="sm" onClick={download} className="flex-1">Download Sample</Btn>
        </div>
        <div className="px-3 pb-3">
          {designDriveLink ? (
            <DriveFileBanner driveLink={designDriveLink} />
          ) : (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <DriveIcon size={12} />
              <span>No original Drive file attached to this job.</span>
            </div>
          )}
        </div>
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={designFile} alt="Design full" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-700 shadow text-lg" onClick={() => setLightbox(false)}>×</button>
        </div>
      )}
    </>
  );
};

// ─── InkEntry ─────────────────────────────────────────────────────────────────
const InkEntry = ({ ink, index, onChange, onRemove }) => (
  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
    <div className="flex-1 grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Color</label>
        <select value={ink.color} onChange={(e) => onChange(index, "color", e.target.value)} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 appearance-none">
          {INK_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Qty (ml)</label>
        <input type="number" min={0} step={1} value={ink.quantity} onChange={(e) => onChange(index, "quantity", parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 min-w-0" />
      </div>
    </div>
    <button type="button" onClick={() => onRemove(index)} className="w-6 h-6 flex-shrink-0 bg-rose-50 border border-rose-200 text-rose-500 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-rose-100 transition-colors ml-1">×</button>
  </div>
);

// ─── ReturnModal ──────────────────────────────────────────────────────────────
const ReturnModal = ({ issue, user, onClose, onSaved, show: showToast }) => {
  const [returnedQty, setReturnedQty] = useState("");
  const [reason,      setReason]      = useState("margin_trim");
  const [reasonNotes, setReasonNotes] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);

  if (!issue) return null;

  const qty          = parseFloat(returnedQty) || 0;
  const issuedQty    = issue.issued_qty || 0;
  const jobSqft      = issue.calculation?.job_sqft || 0;
  const usedQty      = Math.max(0, issuedQty - qty);
  const wastageQty   = Math.max(0, usedQty - jobSqft);
  const wastageRatio = issuedQty > 0 ? parseFloat(((wastageQty / issuedQty) * 100).toFixed(1)) : 0;

  const perfColor =
    wastageRatio <= 10 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    wastageRatio <= 20 ? "text-amber-600 bg-amber-50 border-amber-200" :
                         "text-rose-600 bg-rose-50 border-rose-200";

  const handleSubmit = async () => {
    if (returnedQty === "") return showToast("Enter returned quantity (use 0 if nothing returned)", "error");
    if (qty > issuedQty)    return showToast(`Returned qty cannot exceed issued qty (${issuedQty} sqft)`, "error");
    setLoading(true);
    try {
      const res = await api(`/material/${issue._id}/return`, {
        method: "POST",
        body: JSON.stringify({
          returned_qty:         qty,
          wastage_reason:       reason,
          wastage_reason_notes: reasonNotes,
          returned_by: { user_id: user?._id || "", name: user?.name || "Production Team", role: user?.role || "printing team" },
        }),
      });
      setResult(res.data);
      showToast(res.message || "Return recorded successfully.", "success");
      onSaved(res.data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-sm text-slate-800">Record Material Return</h2>
            <p className="text-xs text-slate-400 mt-0.5">{issue.issue_no} · Issued: <span className="font-bold text-slate-600">{issuedQty} sqft</span>{issue.material?.product_name && ` · ${issue.material.product_name}`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg leading-none transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {result ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <div>
                  <p className="text-sm font-bold text-emerald-700">Return recorded!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{result.issue_no} · {result.status}</p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-3"><p className="text-xs font-bold tracking-wide">Return Summary</p></div>
                <div className="grid grid-cols-2 gap-px bg-slate-100">
                  {[
                    ["Issued",           `${result.issued_qty} sqft`,          "slate"],
                    ["Returned",         `${result.returned_qty} sqft`,         "sky"],
                    ["Actually Used",    `${result.actual_used_qty} sqft`,      "violet"],
                    ["Expected Used",    `${result.expected_used_qty} sqft`,    "slate"],
                    ["Actual Wastage",   `${result.actual_wastage_qty} sqft`,   "rose"],
                    ["Expected Waste",   `${result.expected_wastage_qty} sqft`, "slate"],
                    ["Wastage Ratio",    `${result.wastage_ratio_pct}%`,        "amber"],
                    ["Saved (Returned)", `${result.saved_qty} sqft`,            "emerald"],
                  ].map(([k, v, c]) => (
                    <div key={k} className="bg-white px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 mb-0.5">{k}</p>
                      <p className={`text-sm font-black ${c === "sky" ? "text-sky-700" : c === "violet" ? "text-violet-700" : c === "rose" ? "text-rose-600" : c === "amber" ? "text-amber-600" : c === "emerald" ? "text-emerald-600" : "text-slate-700"}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className={`px-4 py-3 flex items-center gap-2 border-t ${result.performance_rating === "good" ? "bg-emerald-50 border-emerald-100" : result.performance_rating === "acceptable" ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100"}`}>
                  <span className="text-lg">{result.performance_rating === "good" ? "🌟" : result.performance_rating === "acceptable" ? "✅" : "🚩"}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-black capitalize ${result.performance_rating === "good" ? "text-emerald-700" : result.performance_rating === "acceptable" ? "text-amber-700" : "text-rose-700"}`}>{result.performance_rating?.replace("_", " ")}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{result.summary?.verdict}</p>
                  </div>
                  {result.is_flagged && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">🚩 Flagged for review</span>}
                </div>
              </div>
              <Btn variant="ghost" size="md" fullWidth onClick={onClose}>Close</Btn>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quantity Returned to Store (sqft) <span className="text-rose-400">*</span></label>
                <div className="flex items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-400/30 focus-within:border-amber-400 transition-all">
                  <input type="number" min={0} max={issuedQty} step={0.1} value={returnedQty} onChange={(e) => setReturnedQty(e.target.value)} placeholder="0.00" className="flex-1 px-3 py-3 text-sm bg-transparent outline-none min-w-0 font-mono" />
                  <span className="px-3 py-3 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center font-bold">sqft</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Enter <span className="font-bold">0</span> if no material is being returned. Max: {issuedQty} sqft</p>
              </div>

              {returnedQty !== "" && (
                <div className={`rounded-xl border p-3 space-y-2 ${perfColor}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2 opacity-70">Live Estimate</p>
                  <div className="space-y-1.5">
                    {[
                      ["Issued",        `${issuedQty} sqft`],
                      ["Returning",     `${qty} sqft`],
                      ["Will be used",  `${usedQty.toFixed(2)} sqft`],
                      ["Print area",    `${jobSqft} sqft`],
                      ["Wastage est.",  `${wastageQty.toFixed(2)} sqft`],
                      ["Wastage ratio", `${wastageRatio}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="opacity-70">{k}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-current/10 text-xs font-bold">
                    {wastageRatio <= 10 ? "🌟 Excellent efficiency" : wastageRatio <= 20 ? "✅ Within acceptable range" : "🚩 High wastage — will be flagged"}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Wastage Reason <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all appearance-none pr-8">
                    {WASTAGE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▾</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Notes <span className="text-slate-300">(optional)</span></label>
                <textarea value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} rows={2} placeholder="Additional context on wastage…" className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all resize-none placeholder:text-slate-300" />
              </div>

              <Btn variant="amber" size="lg" fullWidth onClick={handleSubmit} loading={loading} disabled={returnedQty === ""}>
                ↩ Confirm Return — {qty} sqft
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MaterialIssueCard ────────────────────────────────────────────────────────
const MaterialIssueCard = ({ issue, onRecordReturn }) => {
  const ret       = issue.return;
  const hasReturn = !!ret;
  const perfColor = {
    good:         "text-emerald-600 bg-emerald-50 border-emerald-100",
    acceptable:   "text-amber-600 bg-amber-50 border-amber-100",
    high_wastage: "text-rose-600 bg-rose-50 border-rose-100",
  }[ret?.performance_rating] || "";

  const statusBadge = {
    returned:       "bg-emerald-500/20 text-emerald-300",
    no_return:      "bg-rose-500/20 text-rose-300",
    issued:         "bg-amber-500/20 text-amber-300",
    partial_return: "bg-sky-500/20 text-sky-300",
  }[issue.status] || "bg-slate-500/20 text-slate-300";

  const statusLabel = {
    returned:       "✓ Returned",
    no_return:      "✕ No Return",
    issued:         "● Pending Return",
    partial_return: "◑ Partial Return",
  }[issue.status] || issue.status;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
        <div>
          <p className="text-xs font-black tracking-wide font-mono">{issue.issue_no}</p>
          <p className="text-[10px] text-white/40 mt-0.5">{issue.material?.product_name}{issue.cart_item_name ? ` · ${issue.cart_item_name}` : ""}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-slate-100">
        {[
          ["Issued",      `${issue.issued_qty} sqft`,    "sky"],
          ["Recommended", `${issue.suggested_qty} sqft`, "violet"],
          ["Issued To",   issue.issued_to?.name || "—",  "slate"],
        ].map(([k, v, c]) => (
          <div key={k} className="bg-white px-3 py-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
            <p className={`text-sm font-black ${c === "sky" ? "text-sky-700" : c === "violet" ? "text-violet-700" : "text-slate-700"}`}>{v}</p>
          </div>
        ))}
      </div>

      {hasReturn ? (
        <div className="px-4 py-3 border-t border-slate-100 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Return Details</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Returned",         `${ret.returned_qty} sqft`],
              ["Actually Used",    `${ret.actual_used_qty} sqft`],
              ["Expected Used",    `${ret.expected_used_qty} sqft`],
              ["Actual Wastage",   `${ret.actual_wastage_qty} sqft`],
              ["Expected Wastage", `${ret.expected_wastage_qty} sqft`],
              ["Wastage Ratio",    `${ret.wastage_ratio_pct}%`],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-400">{k}</p>
                <p className="text-xs font-bold text-slate-800">{v}</p>
              </div>
            ))}
          </div>
          {ret.performance_rating && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold ${perfColor}`}>
              <span className="text-base">{ret.performance_rating === "good" ? "🌟" : ret.performance_rating === "acceptable" ? "✅" : "🚩"}</span>
              <span className="capitalize">{ret.performance_rating.replace("_", " ")}</span>
              {ret.is_flagged && !ret.manager_reviewed && <span className="ml-auto text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">🚩 Flagged</span>}
              {ret.manager_reviewed && <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">✓ Reviewed</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-3 mb-3">
            <span className="text-amber-500 text-sm flex-shrink-0 mt-px">⚠</span>
            <p className="text-xs text-amber-700 leading-relaxed">No return recorded yet. Once printing is complete, record the leftover roll returned to the store.</p>
          </div>
          <Btn variant="amber" size="sm" fullWidth onClick={() => onRecordReturn(issue)}>↩ Record Material Return</Btn>
        </div>
      )}
    </div>
  );
};

// ─── MaterialSummaryCard ──────────────────────────────────────────────────────
const MaterialSummaryCard = ({ jobId, jobNo, onRecordReturn }) => {
  const [issues,  setIssues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    api(`/material`)
      .then((r) => { const all = r.data?.issues || r.data || []; setIssues(all.filter((i) => i.job_id === jobId)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <div className="flex items-center justify-center py-8 gap-2 text-slate-400"><Spinner size={16} /><span className="text-sm">Loading material records…</span></div>;
  if (error)   return <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3"><span className="text-xl">❌</span><p className="text-xs text-rose-700 font-semibold">{error}</p></div>;
  if (!issues.length) return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
      <span className="text-xl">⚠️</span>
      <p className="text-xs text-amber-700 font-semibold">No material issue record found for job {jobNo}. Ask the store manager to issue material before recording a return.</p>
    </div>
  );

  const pendingCount  = issues.filter((i) => !i.return).length;
  const returnedCount = issues.filter((i) =>  i.return).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">📦 {issues.length} issue{issues.length > 1 ? "s" : ""}</span>
        {returnedCount > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">✓ {returnedCount} returned</span>}
        {pendingCount  > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">⏳ {pendingCount} pending return</span>}
      </div>
      {issues.map((issue) => <MaterialIssueCard key={issue._id} issue={issue} onRecordReturn={onRecordReturn} />)}
    </div>
  );
};

// ─── JobCard ──────────────────────────────────────────────────────────────────
const JobCard = ({
  job, user, expanded, onSelect, onSessionChange,
  productionImages, notes, machineName, inkEntries, inkNotes,
  onImagesChange, onNotesChange, onMachineNameChange,
  onInkEntriesChange, onInkNotesChange,
  onSubmit, submitting, show: showToast,
  returnModalIssue, setReturnModalIssue, returnVersion,
  showPreSubmitReturn, setShowPreSubmitReturn,
}) => {
  const addInk    = ()         => onInkEntriesChange((p) => [...p, { color: "Cyan", quantity: 0 }]);
  const removeInk = (i)        => onInkEntriesChange((p) => p.filter((_, idx) => idx !== i));
  const updateInk = (i, f, v) => onInkEntriesChange((p) => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e));
  const handleImageUploaded = useCallback((url) => { if (url) onImagesChange((prev) => prev.includes(url) ? prev : [...prev, url]); }, [onImagesChange]);
  const removeImage = (idx) => onImagesChange((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = productionImages.length > 0 && notes.trim().length > 0 && machineName.trim().length > 0;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-200 ${expanded ? "border-violet-300 shadow-lg shadow-violet-100" : "border-slate-200 shadow-sm"}`}>

      {/* ── Job header ── */}
      <div
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors ${expanded ? "bg-slate-900" : "bg-white hover:bg-slate-50"}`}
        onClick={onSelect}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${expanded ? "bg-violet-500/30" : "bg-violet-100"}`}>
          <span className={`text-[9px] font-black tracking-wider ${expanded ? "text-violet-200" : "text-violet-700"}`}>PROD</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${expanded ? "text-white" : "text-slate-800"}`}>{job.job_no}</p>
            {job.design_drive_link && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${expanded ? "bg-[#1a73e8]/20 border-[#1a73e8]/40 text-[#93bbf8]" : "bg-[#e8f0fe] border-[#c5d9f8] text-[#1a73e8]"}`}>
                <DriveIcon size={9} />Drive
              </span>
            )}
          </div>
          <p className={`text-xs truncate mt-0.5 ${expanded ? "text-white/50" : "text-slate-400"}`}>
            {job.customer_name} · {job.cart_items?.length || 0} item(s)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusDot status={job.job_status} />
          <span className={`text-xs font-bold transition-transform duration-200 ${expanded ? "rotate-180 text-white/60" : "text-slate-300"}`}>▾</span>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200 space-y-4 p-4">

          {/* Session Controls */}
          <Card className="p-4">
            <SectionHeader
              icon="⏱"
              title="Session Log"
              subtitle={`Track work time for ${job.job_no} — start, pause, resume, or complete`}
              badge={<span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">Live</span>}
            />
            <SessionControls
              job={job}
              user={user}
              onSessionChange={onSessionChange}
              show={showToast}
            />
          </Card>

          {/* Material Return */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <SectionHeader
                icon="📦"
                title="Material Return"
                subtitle={`Issued material for ${job.job_no}`}
                badge={<span className="text-[10px] font-bold bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">Available now</span>}
              />
            </div>
            {!showPreSubmitReturn ? (
              <div className="flex items-start gap-3 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <span className="text-sky-500 text-lg flex-shrink-0">📦</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-sky-800">Record return anytime</p>
                  <p className="text-xs text-sky-600 mt-0.5 leading-relaxed">View issued material and record leftover before or after submitting production.</p>
                </div>
                <Btn variant="sky" size="sm" className="flex-shrink-0" onClick={() => setShowPreSubmitReturn(true)}>View Issues</Btn>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Tap <span className="font-bold text-amber-600">↩ Record Material Return</span> on any pending issue.</p>
                  <button onClick={() => setShowPreSubmitReturn(false)} className="text-xs text-slate-400 hover:text-slate-600 font-semibold flex-shrink-0 ml-2">Hide ▲</button>
                </div>
                <MaterialSummaryCard key={`pre-${returnVersion}`} jobId={job._id} jobNo={job.job_no} onRecordReturn={setReturnModalIssue} />
              </div>
            )}
          </Card>

          {/* Design File */}
          {job.design_file && (
            <Card className="p-4">
              <SectionHeader
                icon="🎨" title="Design File" subtitle="Reference design for this job"
                badge={job.design_drive_link && (
                  <span className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#1a73e8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#c5d9f8]">
                    <DriveIcon size={10} />Original on Drive
                  </span>
                )}
              />
              <DesignFileCard designFile={job.design_file} designDriveLink={job.design_drive_link || null} designStatus={job.design_status} jobNo={job.job_no} />
            </Card>
          )}

          {/* Photos */}
          <Card className="p-4">
            <SectionHeader
              icon="📸" title="Production Photos" subtitle="Photograph the finished print output"
              badge={
                productionImages.length > 0
                  ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{productionImages.length} captured</span>
                  : <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Required</span>
              }
            />
            {productionImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {productionImages.map((url, idx) => <ImageThumb key={`${url}-${idx}`} url={url} index={idx} onRemove={removeImage} />)}
              </div>
            )}
            <div className="flex items-center gap-4">
              <CameraUpload onUploaded={handleImageUploaded} />
              <div className="text-xs text-slate-400 leading-relaxed">
                {productionImages.length === 0
                  ? <><span>Tap to open camera</span><br /><span className="text-slate-300">PNG · JPG · WebP supported</span></>
                  : <><span className="font-bold text-violet-600">{productionImages.length} photo{productionImages.length > 1 ? "s" : ""} captured</span><br /><span>Tap again to add more</span></>}
              </div>
            </div>
          </Card>

          {/* Machine & Ink */}
          <Card className="p-4">
            <SectionHeader
              icon="🖨" title="Machine & Ink" subtitle="Log the printer and ink consumption"
              badge={machineName.trim() ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Set</span> : <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Required</span>}
            />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Machine Name <span className="text-rose-400">*</span></label>
                <input type="text" value={machineName} onChange={(e) => onMachineNameChange(e.target.value)} placeholder="e.g. HP Latex 360, Roland VG-540…" className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all placeholder:text-slate-300" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ink Used</label>
                  <Btn variant="ghost" size="xs" onClick={addInk}>+ Add Color</Btn>
                </div>
                <div className="space-y-2">
                  {inkEntries.map((ink, i) => <InkEntry key={i} ink={ink} index={i} onChange={updateInk} onRemove={removeInk} />)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Ink Notes <span className="text-slate-300">(optional)</span></label>
                <input type="text" value={inkNotes} onChange={(e) => onInkNotesChange(e.target.value)} placeholder="e.g. Ran out of Cyan mid-job, switched to refill" className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all placeholder:text-slate-300" />
              </div>
            </div>
          </Card>

          {/* Notes & Submit */}
          <Card className="p-4">
            <SectionHeader
              icon="📝" title="Production Notes" subtitle="Describe the completed output"
              badge={notes.trim().length > 0 ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Added</span> : <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Required</span>}
            />
            <textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} placeholder="e.g. Printed on 13oz flex, colour adjusted for brightness. Ready for lamination and dispatch." className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all resize-none placeholder:text-slate-300" />

            <div className={`rounded-xl p-4 mt-3 border ${canSubmit ? "bg-violet-50 border-violet-100" : "bg-slate-50 border-slate-100"}`}>
              <p className={`text-xs font-bold mb-2.5 uppercase tracking-wide ${canSubmit ? "text-violet-600" : "text-slate-400"}`}>
                {canSubmit ? "✓ Ready to Submit" : "Checklist"}
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "Photo(s) captured", done: productionImages.length > 0, detail: productionImages.length > 0 ? `${productionImages.length} photo${productionImages.length > 1 ? "s" : ""}` : null },
                  { label: "Machine name set",  done: machineName.trim().length > 0, detail: machineName || null },
                  { label: "Notes added",       done: notes.trim().length > 0, detail: null },
                ].map(({ label, done, detail }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>{done ? "✓" : "○"}</span>
                    <span className={done ? "text-slate-700 font-semibold" : "text-slate-400"}>{label}</span>
                    {done && detail && <span className="text-slate-400 font-mono text-[10px] ml-auto truncate max-w-[100px]">{detail}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Btn onClick={onSubmit} loading={submitting} variant="success" size="lg" fullWidth disabled={!canSubmit}>
                🚚 Submit & Move to Quality Check
              </Btn>
              {!canSubmit && (
                <p className="text-xs text-center text-slate-400 mt-2">
                  {productionImages.length === 0 ? "Capture at least one photo" : !machineName.trim() ? "Enter the machine name" : "Add production notes to continue"}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProductionUploadPanel = () => {
  const { user } = useSelector((state) => state.authSlice);
  const { toasts, show, dismiss } = useToast();

  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [filter,      setFilter]      = useState("");
  const [expandedId,  setExpandedId]  = useState(null);
  const [formByJob,   setFormByJob]   = useState({});

  const getForm = (jobId) => formByJob[jobId] || {
    productionImages: [], notes: "", machineName: "",
    inkEntries: [{ color: "Cyan", quantity: 0 }], inkNotes: "",
    submitting: false, submittedAt: null,
    showPreSubmitReturn: false,
  };

  const setForm = (jobId, updater) =>
    setFormByJob((prev) => ({
      ...prev,
      [jobId]: typeof updater === "function"
        ? updater(prev[jobId] || getForm(jobId))
        : { ...getForm(jobId), ...updater },
    }));

  const [returnModalIssue, setReturnModalIssue] = useState(null);
  const [returnVersion,    setReturnVersion]    = useState(0);
  const [submittedJobs,    setSubmittedJobs]    = useState([]);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res  = await api(`/jobs?job_status=production&limit=100`);
      let list   = res.data?.jobs || res.data || [];
      if (!Array.isArray(list)) list = [];
      setJobs(list.filter((j) => j.job_status === "production"));
    } catch (err) {
      show(err.message, "error");
    } finally {
      setJobsLoading(false);
    }
  }, [show]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    if (!filter.trim()) return jobs;
    const q = filter.toLowerCase();
    return jobs.filter((j) => j.job_no?.toLowerCase().includes(q) || j.customer_name?.toLowerCase().includes(q));
  }, [jobs, filter]);

  const toggleExpand = (jobId) => setExpandedId((prev) => prev === jobId ? null : jobId);

  const handleSubmit = async (job) => {
    const form = getForm(job._id);
    if (!form.notes.trim())       return show("Add production notes before submitting", "error");
    if (!form.machineName.trim()) return show("Enter the machine name used for printing", "error");

    setForm(job._id, { submitting: true });
    try {
      const handledBy = {
        user_id: user?._id  || "",
        name:    user?.name || "Production Team",
        role:    user?.role || "printing team",
      };

      await api(`/jobs/${job._id}/approve_production`, {
        method: "POST",
        body: JSON.stringify({ handled_by: handledBy, productionimg: form.productionImages[0] }),
      });

      await api(`/jobs/${job._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ job_status: "quality_check" }),
      });

      await api(`/jobs/${job._id}/complete-stage`, {
        method: "POST",
        body: JSON.stringify({
          stage:       job.current_stage?.stage || "production",
          handled_by:  handledBy,
          notes:       form.notes,
          next_stage:  "quality_check",
        }),
      });

      try {
        const issueRes    = await api(`/material/job/${job._id}`);
        const issues      = issueRes.data?.issues || issueRes.data || [];
        const latestIssue = issues.find((i) => i.status === "issued") || issues[0];
        if (latestIssue) {
          await api(`/material/${latestIssue._id}/production`, {
            method: "POST",
            body: JSON.stringify({
              machine_name: form.machineName.trim(),
              ink_used:     form.inkEntries.filter((e) => e.quantity > 0),
              ink_notes:    form.inkNotes,
            }),
          });
        }
      } catch {
        show("Production submitted, but material metadata not saved — contact store manager.", "warning");
      }

      show(`Production submitted for ${job.job_no}! Moved to quality check.`, "success");
      setSubmittedJobs((prev) => [...prev, { jobId: job._id, jobNo: job.job_no }]);
      setFormByJob((prev) => { const next = { ...prev }; delete next[job._id]; return next; });
      setExpandedId(null);
      fetchJobs();
    } catch (err) {
      show(err.message, "error");
      setForm(job._id, { submitting: false });
    }
  };

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ToastContainer toasts={toasts} dismiss={dismiss} />

        {/* Header */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-200">
                  <span className="text-xl">🖨️</span>
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 tracking-tight">Production Upload</h1>
                  <p className="text-xs text-slate-400 hidden sm:block">Session tracking · photos · ink log · material return</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {jobs.length > 0 && (
                  <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2.5 py-1 rounded-full">
                    {jobs.length} job{jobs.length > 1 ? "s" : ""} in production
                  </span>
                )}
                <Btn variant="ghost" size="xs" onClick={fetchJobs} loading={jobsLoading}>↻ Refresh</Btn>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 pb-24 sm:pb-8 space-y-4">

          {/* Post-submit banners */}
          {submittedJobs.map((sj) => (
            <div key={sj.jobId} className="space-y-4 animate-slide-up">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="text-3xl flex-shrink-0">✅</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-emerald-700">Production submitted — {sj.jobNo}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Moved to quality check. Record material return below if any roll remains.</p>
                </div>
                <Btn variant="ghost" size="xs" onClick={() => setSubmittedJobs((prev) => prev.filter((x) => x.jobId !== sj.jobId))}>Dismiss</Btn>
              </div>
              <Card className="p-5">
                <SectionHeader
                  icon="📦" title="Material Return"
                  subtitle={`Material issued for job ${sj.jobNo} — record leftover roll returned to store`}
                  badge={<span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Action required</span>}
                />
                <MaterialSummaryCard key={`post-${sj.jobId}-${returnVersion}`} jobId={sj.jobId} jobNo={sj.jobNo} onRecordReturn={setReturnModalIssue} />
              </Card>
            </div>
          ))}

          {/* Jobs list */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                icon="🏭" title="Production Jobs"
                subtitle="Tap a job to expand session controls and submit production"
                badge={<span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">Auto-loaded</span>}
              />
            </div>

            {jobs.length > 3 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by job no or customer…"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all placeholder:text-slate-300 mb-4"
              />
            )}

            {jobsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                <Spinner size={16} /><span className="text-sm">Fetching production jobs…</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState icon="🏭" title="No production jobs" subtitle="Jobs appear here once they enter production stage" />
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => {
                  const form = getForm(job._id);
                  return (
                    <JobCard
                      key={job._id}
                      job={job}
                      user={user}
                      expanded={expandedId === job._id}
                      onSelect={() => toggleExpand(job._id)}
                      onSessionChange={() => {}}
                      productionImages={form.productionImages}
                      notes={form.notes}
                      machineName={form.machineName}
                      inkEntries={form.inkEntries}
                      inkNotes={form.inkNotes}
                      onImagesChange={(updater) => setForm(job._id, (f) => ({ ...f, productionImages: typeof updater === "function" ? updater(f.productionImages || []) : updater }))}
                      onNotesChange={(v) => setForm(job._id, { notes: v })}
                      onMachineNameChange={(v) => setForm(job._id, { machineName: v })}
                      onInkEntriesChange={(updater) => setForm(job._id, (f) => ({ ...f, inkEntries: typeof updater === "function" ? updater(f.inkEntries || []) : updater }))}
                      onInkNotesChange={(v) => setForm(job._id, { inkNotes: v })}
                      onSubmit={() => handleSubmit(job)}
                      submitting={form.submitting}
                      show={show}
                      returnModalIssue={returnModalIssue}
                      setReturnModalIssue={setReturnModalIssue}
                      returnVersion={returnVersion}
                      showPreSubmitReturn={form.showPreSubmitReturn}
                      setShowPreSubmitReturn={(v) => setForm(job._id, { showPreSubmitReturn: v })}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Return Modal */}
      {returnModalIssue && (
        <ReturnModal
          issue={returnModalIssue}
          user={user}
          onClose={() => setReturnModalIssue(null)}
          show={show}
          onSaved={() => {
            setReturnModalIssue(null);
            setReturnVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
};

export default ProductionUploadPanel;