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

// ─── Machine & Ink Configuration ─────────────────────────────────────────────
const MACHINES = [
  {
    id: "solvent",
    label: "Solvent",
    inks: [
      { key: "C",  label: "Cyan" },
      { key: "M",  label: "Magenta" },
      { key: "Y",  label: "Yellow" },
      { key: "K",  label: "Black" },
    ],
  },
  {
    id: "huv",
    label: "HUV",
    inks: [
      { key: "C",  label: "Cyan" },
      { key: "M",  label: "Magenta" },
      { key: "Y",  label: "Yellow" },
      { key: "K",  label: "Black" },
    ],
  },
  {
    id: "hp",
    label: "HP",
    inks: [
      { key: "C",  label: "Cyan" },
      { key: "M",  label: "Magenta" },
      { key: "Y",  label: "Yellow" },
      { key: "K",  label: "Black" },
      { key: "LC", label: "Light Cyan" },
      { key: "LM", label: "Light Magenta" },
      { key: "S",  label: "Solvent" },
    ],
  },
  {
    id: "flatbed",
    label: "Flatbed",
    inks: [
      { key: "C",  label: "Cyan" },
      { key: "M",  label: "Magenta" },
      { key: "Y",  label: "Yellow" },
      { key: "K",  label: "Black" },
      { key: "WV", label: "White Varnish" },
    ],
  },
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

// ─── Cart / Design-File Logic (mirrors Store Manager's material issuance) ────
// Production is driven by the SAME cart_items[].design_files[] structure the
// store manager uses to issue material — so "how many design files are in
// the cart" (and which of them actually need material) is computed exactly
// the same way here as it is there.
const NO_MATERIAL_LABELS = ["Cutting File"];

const FILE_TYPE_ICON = (ft = "") => {
  const t = (ft || "").toUpperCase();
  if (t === "PDF") return "📄";
  if (["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG"].includes(t)) return "🖼";
  if (["AI", "PSD", "EPS"].includes(t)) return "🎨";
  return "📎";
};

const LABEL_COLOR = (label) => {
  const map = {
    "Printing File": "bg-violet-100 text-violet-700 border-violet-200",
    "Cutting File":  "bg-slate-100 text-slate-500 border-slate-200",
    "Mockup":        "bg-sky-100 text-sky-700 border-sky-200",
    "Reference":     "bg-amber-100 text-amber-700 border-amber-200",
    "Final Artwork": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Other":         "bg-slate-100 text-slate-600 border-slate-200",
  };
  return map[label] || "bg-slate-100 text-slate-600 border-slate-200";
};

// A cutting file needs no material → "skip". A file assigned to an outside
// vendor needs no in-house production task → "outsource". Everything else
// is a real in-house production task that must be matched to an issue.
const getFileMode = (file) => {
  if (NO_MATERIAL_LABELS.includes(file?.label)) return "skip";
  if (file?.assigned_to?.role === "outsource" || file?.assigned_to?.name?.toLowerCase() === "outsource")
    return "outsource";
  return "inhouse";
};

// Cart items created before per-file design_files existed only have a single
// legacy design_file — fall back to treating the whole item as one file, the
// same fallback the store manager's IssuePanel uses.
const getItemFiles = (item, itemIdx) =>
  (item.design_files || []).length > 0
    ? item.design_files
    : [{ _id: `item_${itemIdx}`, file_name: item.product_name || "Item", file_type: "", label: "Other", assigned_to: item.issued_to }];

// Production only ever deals with in-house work (+ cutting files shown for
// context). Outsourced design files are handled entirely outside the
// production floor, so they're excluded here altogether.
const getProductionFiles = (item, itemIdx) =>
  getItemFiles(item, itemIdx).filter((f) => getFileMode(f) !== "outsource");

// Flatten every cart item's production-relevant design files into one list,
// tagging each with its mode and a stable key for matching against issues.
const flattenJobFiles = (job) => {
  const cartItems = job?.cart_items || [];
  const rows = [];
  cartItems.forEach((item, itemIdx) => {
    const files = getProductionFiles(item, itemIdx);
    files.forEach((file, fileIdx) => {
      rows.push({ item, itemIdx, file, fileIdx, mode: getFileMode(file) });
    });
  });
  return rows;
};

// Match a material issue to the design file it was issued against. Real
// design files match on design_file_id; legacy single-file items (whose
// placeholder id starts with "item_") match on cart_item_index instead —
// exactly how the store manager builds the issue payload (see
// Materialissuemanager.jsx `payload.design_file_id`).
const findIssueForFile = (issues, itemIdx, file) => {
  const isRealFile = file._id && !String(file._id).startsWith("item_");
  return issues.find((iss) => {
    if (isRealFile) return String(iss.design_file_id || "") === String(file._id);
    return !iss.design_file_id && Number(iss.cart_item_index) === Number(itemIdx);
  }) || null;
};

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
        <div key={t.id} className="bg-slate-900 text-white rounded-xl overflow-hidden shadow-2xl flex items-stretch animate-slide-up">
          <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />
          <div className="flex items-center gap-3 px-4 py-3 flex-1">
            <span className={`text-sm font-bold ${cfg.bar.replace("bg-", "text-")}`}>{cfg.icon}</span>
            <span className="text-sm flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-40 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin flex-shrink-0">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="30 62" />
  </svg>
);

// ─── Button ───────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, disabled, loading, variant = "primary", size = "md", className = "", type = "button", fullWidth }) => {
  const base = `inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed select-none ${fullWidth ? "w-full" : ""}`;
  const sizes = { xs: "px-2.5 py-1.5 text-xs", sm: "px-3.5 py-2 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-sm" };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200",
    ghost:   "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger:  "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
    purple:  "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200",
    amber:   "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-200",
    sky:     "bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-200",
    orange:  "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-200",
    teal:    "bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-200",
  };
  return (
    <button type={type} onClick={!disabled && !loading ? onClick : undefined} disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant] || variants.primary} ${className}`}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "", onClick, hoverable }) => (
  <div onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${hoverable ? "cursor-pointer hover:border-violet-200 hover:shadow-md transition-all duration-150" : ""} ${className}`}>
    {children}
  </div>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, badge }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">{icon}</div>
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
const SessionControls = ({ job, user, task, onSessionChange, show: showToast }) => {
  const [sessionStatus, setSessionStatus] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [notesInput,    setNotesInput]    = useState("");
  const [showNotes,     setShowNotes]     = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Stage key: use task id if task-based, else fall back to "production"
  const stage = task ? `production_task_${task._id}` : (job.current_stage?.stage || "production");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/jobs/${job._id}/session/status?stage=${stage}`);
      setSessionStatus(res.data || null);
    } catch (err) {
      console.warn("Session status fetch failed:", err.message);
      setSessionStatus(null);
    } finally {
      setLoading(false);
    }
  }, [job._id, stage]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const hasOpen      = sessionStatus?.has_open_session ?? false;
  const openSince    = hasOpen ? (sessionStatus?.open_since ?? null) : null;
  const stageAction  = sessionStatus?.stage_action ?? null;
  const totalDisplay = sessionStatus?.total_duration_display || "00:00:00";
  const totalSessions= sessionStatus?.total_sessions ?? 0;

  const { display: liveDisplay } = useLiveTimer(openSince);

  const sessionState = useMemo(() => {
    if (!sessionStatus) return "not_started";
    if (stageAction === "completed" || stageAction === "passed") return "completed";
    if (hasOpen) return "running";
    if (totalSessions > 0) return "paused";
    return "not_started";
  }, [sessionStatus, stageAction, hasOpen, totalSessions]);

  const execAction = async (action) => {
    setActionLoading(action);
    try {
      const handledBy = {
        user_id: user?._id  || "",
        name:    user?.name || "Production Team",
        role:    user?.role || "printing team",
      };
      if (action === "start") {
        await api(`/jobs/${job._id}/session/open`, {
          method: "POST",
          body: JSON.stringify({ stage, user: handledBy, notes: notesInput || undefined }),
        });
        showToast(`Session started`, "success");
      } else if (action === "pause") {
        await api(`/jobs/${job._id}/session/close`, {
          method: "POST",
          body: JSON.stringify({ stage, action: "on_hold", notes: notesInput || undefined }),
        });
        showToast(`Session paused`, "warning");
      } else if (action === "resume") {
        await api(`/jobs/${job._id}/session/open`, {
          method: "POST",
          body: JSON.stringify({ stage, user: { user_id: handledBy.user_id, name: handledBy.name, role: handledBy.role }, notes: notesInput || undefined }),
        });
        showToast(`Session resumed`, "success");
      } else if (action === "complete") {
        await api(`/jobs/${job._id}/session/close`, {
          method: "POST",
          body: JSON.stringify({ stage, action: "completed", notes: notesInput || undefined }),
        });
        showToast(`Stage marked complete`, "success");
      }
      setNotesInput("");
      setShowNotes(false);
      setPendingAction(null);
      await fetchStatus();
      onSessionChange?.(job._id, action);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const requestAction = (action) => {
    if (action === "pause" || action === "complete") { setPendingAction(action); setShowNotes(true); }
    else execAction(action);
  };
  const confirmAction = () => { if (pendingAction) execAction(pendingAction); };
  const cancelAction  = () => { setPendingAction(null); setShowNotes(false); setNotesInput(""); };

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-2"><Spinner size={13} /><span className="text-xs">Loading session…</span></div>
  );

  return (
    <div className="space-y-3">
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
               sessionState === "completed" ? "✓ Complete"       :
                                              "○ Not Started"}
            </span>
            {sessionState === "running" && (
              <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">{liveDisplay}</span>
            )}
            {(sessionState === "paused" || sessionState === "completed") && totalDisplay !== "00:00:00" && (
              <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">{totalDisplay} total</span>
            )}
          </div>
          {totalSessions > 0 && sessionState !== "not_started" && (
            <p className="text-[10px] text-slate-400 mt-0.5">{totalSessions} session{totalSessions > 1 ? "s" : ""} logged</p>
          )}
        </div>
        <button onClick={fetchStatus} className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold flex-shrink-0" title="Refresh">↻</button>
      </div>

      {sessionState !== "completed" && (
        <div className="flex gap-2 flex-wrap">
          {sessionState === "not_started" && (
            <Btn variant="success" size="sm" loading={actionLoading === "start"} disabled={!!actionLoading} onClick={() => requestAction("start")} className="flex-1">▶ Start</Btn>
          )}
          {sessionState === "running" && (
            <>
              <Btn variant="orange" size="sm" loading={actionLoading === "pause"} disabled={!!actionLoading} onClick={() => requestAction("pause")} className="flex-1">⏸ Pause</Btn>
              <Btn variant="primary" size="sm" loading={actionLoading === "complete"} disabled={!!actionLoading} onClick={() => requestAction("complete")} className="flex-1">✓ Done</Btn>
            </>
          )}
          {sessionState === "paused" && (
            <>
              <Btn variant="success" size="sm" loading={actionLoading === "resume"} disabled={!!actionLoading} onClick={() => requestAction("resume")} className="flex-1">▶ Resume</Btn>
              <Btn variant="primary" size="sm" loading={actionLoading === "complete"} disabled={!!actionLoading} onClick={() => requestAction("complete")} className="flex-1">✓ Done</Btn>
            </>
          )}
        </div>
      )}

      {showNotes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-slide-up">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            {pendingAction === "pause" ? "⏸ Pause Note" : "✓ Completion Note"}{" "}
            <span className="text-slate-400 normal-case font-normal">(optional)</span>
          </p>
          <textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} rows={2}
            placeholder={pendingAction === "pause" ? "Reason for pausing…" : "Completion notes…"}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 resize-none placeholder:text-slate-300" />
          <div className="flex gap-2">
            <Btn variant={pendingAction === "pause" ? "orange" : "success"} size="sm" loading={!!actionLoading} onClick={confirmAction} className="flex-1">
              {pendingAction === "pause" ? "⏸ Confirm Pause" : "✓ Confirm Complete"}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={cancelAction} className="flex-shrink-0">Cancel</Btn>
          </div>
        </div>
      )}

      {sessionState === "completed" && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2.5">
          <span className="text-sky-500 text-sm">✓</span>
          <p className="text-xs text-sky-700 font-semibold">Completed · {totalDisplay} logged</p>
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
      <button type="button" disabled={loading || disabled} onClick={() => !loading && !disabled && inputRef.current?.click()}
        className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-violet-500 flex-shrink-0">
        {loading ? (<><Spinner size={22} /><span className="text-[10px] font-medium">Uploading…</span></>) : (<><CameraIcon size={24} /><span className="text-[10px] font-semibold">Take photo</span></>)}
      </button>
    </>
  );
};

// ─── ImageThumb ───────────────────────────────────────────────────────────────
const ImageThumb = ({ url, index, onRemove }) => (
  <div className="relative group flex-shrink-0">
    <img src={url} alt={`Production photo ${index + 1}`} className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm" />
    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">#{index + 1}</span>
    <button type="button" onClick={() => onRemove(index)}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity leading-none">×</button>
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

// ─── DesignFileSection ────────────────────────────────────────────────────────
const DesignFileSection = ({ job }) => {
  const [lightbox, setLightbox] = useState(false);
  const designFile   = job.design_file    || "";
  const driveLink    = job.design_drive_link || "";
  const designStatus = job.design_status  || "pending";
  const jobNo        = job.job_no;
  const fileName     = designFile ? (designFile.split("/").pop()?.split("?")[0] || `design_${jobNo}`) : "";
  const isImage      = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  const isPdf        = /\.pdf$/i.test(fileName);

  const statusMap = {
    approved: { ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", badge: "✓ Approved",  dot: "bg-emerald-400" },
    uploaded: { ring: "border-sky-200 bg-sky-50",         text: "text-sky-700",     badge: "● Uploaded",  dot: "bg-sky-400" },
    pending:  { ring: "border-amber-200 bg-amber-50",     text: "text-amber-700",   badge: "◆ Pending",   dot: "bg-amber-400" },
    rejected: { ring: "border-rose-200 bg-rose-50",       text: "text-rose-700",    badge: "✕ Rejected",  dot: "bg-rose-400" },
  };
  const s = statusMap[designStatus] || statusMap.pending;

  const download = () => {
    if (!designFile) return;
    const a = document.createElement("a"); a.href = designFile; a.download = fileName; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <>
      <Card className="p-4">
        <SectionHeader icon="🎨" title="Design File" subtitle={`Reference design for ${jobNo}`}
          badge={
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.ring} ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.badge}
            </span>
          }
        />
        {designFile ? (
          <div className={`border rounded-xl overflow-hidden ${s.ring}`}>
            <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${s.ring}`}>
              <span className={`text-xs font-bold flex-shrink-0 ${s.text}`}>{s.badge}</span>
              <span className="text-[10px] text-slate-400 font-mono truncate">{fileName}</span>
            </div>
            {isImage && (
              <div className="bg-slate-100 relative">
                <img src={designFile} alt="Design" className="w-full max-h-52 object-contain cursor-zoom-in" onClick={() => setLightbox(true)} />
                <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm">Tap to enlarge</div>
              </div>
            )}
            {!isImage && (
              <div className="flex items-center gap-3 px-3 py-4 bg-white/60">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-2xl">{isPdf ? "📄" : "🎨"}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{fileName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{isPdf ? "PDF Document" : "Design File"}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2 px-3 py-2.5 bg-white/80 border-t border-white/60">
              <Btn variant="ghost" size="sm" onClick={() => window.open(designFile, "_blank")} className="flex-1">👁 Preview</Btn>
              <Btn variant="primary" size="sm" onClick={download} className="flex-1">⬇ Download</Btn>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
            <span className="text-2xl flex-shrink-0 opacity-40">🎨</span>
            <div>
              <p className="text-xs font-bold text-slate-500">No design file uploaded yet</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">The design team hasn't uploaded the print-ready file.</p>
            </div>
          </div>
        )}
        {driveLink ? <DriveFileBanner driveLink={driveLink} /> : (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <DriveIcon size={12} /><span>No original Drive file attached to this job.</span>
          </div>
        )}
      </Card>
      {lightbox && designFile && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={designFile} alt="Design full" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-700 shadow text-lg" onClick={() => setLightbox(false)}>×</button>
        </div>
      )}
    </>
  );
};

// ─── Machine Ink Entry ────────────────────────────────────────────────────────
// Each "print run" tracks: machine, printing time (mins), machine running time (mins), + per-ink quantities
const MachineInkEntry = ({ entry, index, onChange, onRemove }) => {
  const machine = MACHINES.find((m) => m.id === entry.machineId) || MACHINES[0];

  const update = (field, value) => onChange(index, { ...entry, [field]: value });
  const updateInk = (key, value) => onChange(index, { ...entry, inkUsage: { ...entry.inkUsage, [key]: value } });

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Machine header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900 text-white">
        <span className="text-[10px] font-black tracking-wider text-violet-300">MACHINE {index + 1}</span>
        <select value={entry.machineId}
          onChange={(e) => {
            const newMachine = MACHINES.find((m) => m.id === e.target.value) || MACHINES[0];
            const freshInks = {};
            newMachine.inks.forEach((ink) => { freshInks[ink.key] = ""; });
            onChange(index, { ...entry, machineId: newMachine.id, inkUsage: freshInks });
          }}
          className="flex-1 ml-2 bg-slate-800 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none border border-slate-700 focus:border-violet-500">
          {MACHINES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button type="button" onClick={() => onRemove(index)}
          className="w-6 h-6 bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-rose-500/40 transition-colors">×</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Time fields */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Print Time (min)</label>
            <input type="number" min={0} step={1} value={entry.printingTime}
              onChange={(e) => update("printingTime", e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Machine Run Time (min)</label>
            <input type="number" min={0} step={1} value={entry.machineRunTime}
              onChange={(e) => update("machineRunTime", e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 font-mono" />
          </div>
        </div>

        {/* Ink usage */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ink Usage (ml) — {machine.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {machine.inks.map((ink) => (
              <div key={ink.key} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
                  ink.key === "C"  ? "bg-cyan-500 text-white"    :
                  ink.key === "M"  ? "bg-pink-500 text-white"    :
                  ink.key === "Y"  ? "bg-yellow-400 text-slate-800" :
                  ink.key === "K"  ? "bg-slate-800 text-white"   :
                  ink.key === "LC" ? "bg-cyan-200 text-cyan-800" :
                  ink.key === "LM" ? "bg-pink-200 text-pink-800" :
                  ink.key === "S"  ? "bg-slate-400 text-white"   :
                  ink.key === "WV" ? "bg-white border border-slate-300 text-slate-600" :
                  "bg-slate-200 text-slate-600"
                }`}>{ink.key}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-slate-400 leading-none mb-0.5">{ink.label}</p>
                  <input type="number" min={0} step={0.1} value={entry.inkUsage?.[ink.key] ?? ""}
                    onChange={(e) => updateInk(ink.key, e.target.value)}
                    placeholder="—"
                    className="w-full text-xs font-mono bg-transparent outline-none placeholder:text-slate-300" />
                </div>
                <span className="text-[9px] text-slate-400 flex-shrink-0">ml</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Machine Notes <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
          <input type="text" value={entry.notes || ""} onChange={(e) => update("notes", e.target.value)}
            placeholder="e.g. Head cleaned mid-run, ICC profile adjusted"
            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 placeholder:text-slate-300" />
        </div>
      </div>
    </div>
  );
};

const makeMachineEntry = (machineId = "solvent") => {
  const machine = MACHINES.find((m) => m.id === machineId) || MACHINES[0];
  const inkUsage = {};
  machine.inks.forEach((ink) => { inkUsage[ink.key] = ""; });
  return { machineId, printingTime: "", machineRunTime: "", inkUsage, notes: "" };
};

// ─── Task Work Item ───────────────────────────────────────────────────────────
// Shows a single material issue as a "task" with its own session timer
const DesignFileProductionTask = ({ issue, job, user, show: showToast, onReturnClick, onProductionSaved }) => {
  const [expanded, setExpanded] = useState(false);
  const taskLabel = issue.design_file_label || issue.cart_item_name || issue.material?.product_name || issue.issue_no;
  const hasReturn = !!issue.return;
  const isPending = !hasReturn;
  const isCompleted = issue.production_status === "completed";

  // ── Per-design-file production state (own machines/inks, own photos, own notes) ──
  const [machineEntries, setMachineEntries] = useState(() =>
    issue.machines?.length
      ? issue.machines.map((m) => ({
          machineId: m.machine_id || "solvent",
          printingTime: m.printing_time_mins ? String(m.printing_time_mins) : "",
          machineRunTime: m.machine_run_time_mins ? String(m.machine_run_time_mins) : "",
          notes: m.notes || "",
          inkUsage: (m.inks || []).reduce((acc, ink) => {
            const machineDef = MACHINES.find((md) => md.id === (m.machine_id || "solvent")) || MACHINES[0];
            const key = machineDef.inks.find((i) => i.label === ink.color)?.key || ink.color;
            acc[key] = String(ink.quantity ?? "");
            return acc;
          }, {}),
        }))
      : [makeMachineEntry()]
  );
  const [photos, setPhotos]       = useState(issue.production_photos || []);
  const [notesText, setNotesText] = useState(issue.production_notes || "");
  const [saving, setSaving]       = useState(false);
  const [editing, setEditing]     = useState(!isCompleted);

  const addMachine    = ()  => setMachineEntries((p) => [...p, makeMachineEntry()]);
  const removeMachine = (i) => setMachineEntries((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);
  const updateMachine = (i, v) => setMachineEntries((p) => p.map((e, idx) => idx === i ? v : e));

  const handlePhotoUploaded = useCallback((url) => {
    if (url) setPhotos((prev) => prev.includes(url) ? prev : [...prev, url]);
  }, []);
  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const canSave = photos.length > 0 && notesText.trim().length > 0;

  const handleSaveProduction = async () => {
    if (!canSave) { showToast("Add at least one photo and a note for this design file first.", "error"); return; }
    setSaving(true);
    try {
      const machines = machineEntries.map((entry) => {
        const machine = MACHINES.find((m) => m.id === entry.machineId) || MACHINES[0];
        return {
          machine_id: machine.id,
          machine_name: machine.label,
          printing_time_mins: parseFloat(entry.printingTime) || 0,
          machine_run_time_mins: parseFloat(entry.machineRunTime) || 0,
          notes: entry.notes || "",
          inks: Object.entries(entry.inkUsage || {})
            .filter(([, qty]) => qty !== "" && parseFloat(qty) > 0)
            .map(([key, qty]) => ({
              color: machine.inks.find((i) => i.key === key)?.label || key,
              quantity: parseFloat(qty),
              unit: "ml",
            })),
        };
      });

      const res = await api(`/material/${issue._id}/production`, {
        method: "POST",
        body: JSON.stringify({ machines, production_photos: photos, production_notes: notesText.trim() }),
      });

      showToast("Production details saved for this design file.", "success");
      setEditing(false);
      onProductionSaved?.(issue._id, {
        machines, production_photos: photos, production_notes: notesText.trim(),
        production_status: "completed",
        ...(res.data || {}),
      });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? "border-violet-300" : isCompleted ? "border-emerald-200" : "border-slate-200"}`}>
      {/* Task header */}
      <div
        className={`flex items-center gap-3 px-3 py-3 cursor-pointer select-none ${expanded ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
        onClick={() => setExpanded((p) => !p)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-black tracking-wider ${expanded ? "bg-violet-500/30 text-violet-200" : isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
          {isCompleted ? "✓" : "TASK"}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black truncate ${expanded ? "text-white" : "text-slate-800"}`}>{taskLabel}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-mono font-bold ${expanded ? "text-white/40" : "text-slate-400"}`}>{issue.issue_no}</span>
            <span className={`text-[10px] font-bold ${expanded ? "text-violet-300" : "text-sky-600"}`}>{issue.issued_qty} {issue.material?.unit || "sqft"} issued</span>
            {isCompleted && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">✓ Production saved</span>}
            {hasReturn && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">✓ Returned</span>}
            {isPending && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">⏳ Return pending</span>}
          </div>
        </div>
        <span className={`text-xs font-bold flex-shrink-0 ${expanded ? "text-white/40 rotate-180" : "text-slate-300"} transition-transform duration-200`}>▾</span>
      </div>

      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200 p-3 space-y-3">
          {/* Issue details */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Issued",      `${issue.issued_qty} sqft`, "sky"],
              ["Suggested",   `${issue.suggested_qty || "—"} sqft`, "violet"],
              ["Issued To",   issue.issued_to?.name || "—", "slate"],
            ].map(([k, v, c]) => (
              <div key={k} className="bg-white border border-slate-100 rounded-xl px-2 py-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
                <p className={`text-xs font-black ${c === "sky" ? "text-sky-700" : c === "violet" ? "text-violet-700" : "text-slate-700"}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Work session timer for this task */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">⏱ Work Timer</p>
            <SessionControls job={job} user={user} task={issue} onSessionChange={() => {}} show={showToast} />
          </div>

          {/* Machine & Ink Log — scoped to this design file only */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">🖨 Machine & Ink Log — this file</p>
              {editing && (
                <button type="button" onClick={addMachine} className="text-[10px] font-bold text-violet-600 hover:text-violet-700">+ Add machine</button>
              )}
            </div>
            {!editing ? (
              <div className="space-y-1.5">
                {(issue.machines || []).map((m, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-xs font-bold text-emerald-800">{m.machine_name} · {m.printing_time_mins}min print / {m.machine_run_time_mins}min run</p>
                    {m.inks?.length > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">{m.inks.map((ink) => `${ink.color}: ${ink.quantity}ml`).join(" · ")}</p>}
                    {m.notes && <p className="text-[10px] text-emerald-500 mt-0.5 italic">{m.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {machineEntries.map((entry, i) => (
                  <MachineInkEntry key={i} entry={entry} index={i} onChange={updateMachine} onRemove={removeMachine} />
                ))}
              </div>
            )}
          </div>

          {/* Production photos — scoped to this design file only */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">📸 Production Photo — this file</p>
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, idx) => (
                <ImageThumb key={url + idx} url={url} index={idx} onRemove={editing ? removePhoto : () => {}} />
              ))}
              {editing && <CameraUpload onUploaded={handlePhotoUploaded} />}
            </div>
            {photos.length === 0 && <p className="text-[10px] text-slate-400">At least one photo of this printed/produced file is required.</p>}
          </div>

          {/* Production notes — scoped to this design file only */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">📝 Production Notes — this file</p>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              disabled={!editing}
              rows={3}
              placeholder="e.g. Printed 2 passes, color matched to sample, no misprints…"
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-400 placeholder:text-slate-300 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
            />
          </div>

          {/* Save this design file's production details */}
          {editing ? (
            <Btn variant="primary" size="sm" fullWidth loading={saving} disabled={!canSave} onClick={handleSaveProduction}>
              💾 Save Production Details
            </Btn>
          ) : (
            <Btn variant="ghost" size="sm" fullWidth onClick={() => setEditing(true)}>
              ✏️ Edit Production Details
            </Btn>
          )}

          {/* Return CTA */}
          {isPending ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <span className="text-amber-500 text-sm flex-shrink-0 mt-px">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">Record the leftover roll returned to store once printing is done.</p>
              </div>
              <Btn variant="amber" size="sm" fullWidth onClick={() => onReturnClick(issue)}>↩ Record Material Return</Btn>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Return Recorded</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Returned",     `${issue.return.returned_qty} sqft`],
                  ["Actually Used",`${issue.return.actual_used_qty} sqft`],
                  ["Wastage",      `${issue.return.actual_wastage_qty} sqft`],
                  ["Ratio",        `${issue.return.wastage_ratio_pct}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white rounded-lg px-2 py-1.5 border border-emerald-100">
                    <p className="text-[10px] text-slate-400">{k}</p>
                    <p className="text-xs font-bold text-slate-800">{v}</p>
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 text-xs font-bold rounded-lg px-2 py-1.5 ${
                issue.return.performance_rating === "good"         ? "text-emerald-700 bg-emerald-100" :
                issue.return.performance_rating === "acceptable"   ? "text-amber-700 bg-amber-100"     :
                                                                     "text-rose-700 bg-rose-100"
              }`}>
                <span>{issue.return.performance_rating === "good" ? "🌟" : issue.return.performance_rating === "acceptable" ? "✅" : "🚩"}</span>
                <span className="capitalize">{(issue.return.performance_rating || "").replace("_", " ")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ReturnModal ──────────────────────────────────────────────────────────────
const ReturnModal = ({ issue, user, onClose, onSaved, show: showToast }) => {
  const [returnedQty, setReturnedQty] = useState("");
  const [reason,      setReason]      = useState("margin_trim");
  const [reasonNotes, setReasonNotes] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);

  if (!issue) return null;

  const qty        = parseFloat(returnedQty) || 0;
  const issuedQty  = issue.issued_qty || 0;
  const jobSqft    = issue.calculation?.job_sqft || 0;
  const usedQty    = Math.max(0, issuedQty - qty);
  const wastageQty = Math.max(0, usedQty - jobSqft);
  const wastageRatio = issuedQty > 0 ? parseFloat(((wastageQty / issuedQty) * 100).toFixed(1)) : 0;

  const perfColor =
    wastageRatio <= 10 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    wastageRatio <= 20 ? "text-amber-600 bg-amber-50 border-amber-200"       :
                         "text-rose-600 bg-rose-50 border-rose-200";

  const handleSubmit = async () => {
    if (returnedQty === "") return showToast("Enter returned quantity (use 0 if nothing returned)", "error");
    if (qty > issuedQty)    return showToast(`Returned qty cannot exceed issued qty (${issuedQty} sqft)`, "error");
    setLoading(true);
    try {
      const res = await api(`/material/${issue._id}/return`, {
        method: "POST",
        body: JSON.stringify({
          returned_qty:          qty,
          wastage_reason:        reason,
          wastage_reason_notes:  reasonNotes,
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
                    ["Saved",            `${result.saved_qty} sqft`,            "emerald"],
                  ].map(([k, v, c]) => (
                    <div key={k} className="bg-white px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 mb-0.5">{k}</p>
                      <p className={`text-sm font-black ${c === "sky" ? "text-sky-700" : c === "violet" ? "text-violet-700" : c === "rose" ? "text-rose-600" : c === "amber" ? "text-amber-600" : c === "emerald" ? "text-emerald-600" : "text-slate-700"}`}>{v}</p>
                    </div>
                  ))}
                </div>
                {result.performance_rating && (
                  <div className={`px-4 py-3 flex items-center gap-2 border-t ${result.performance_rating === "good" ? "bg-emerald-50 border-emerald-100" : result.performance_rating === "acceptable" ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100"}`}>
                    <span className="text-lg">{result.performance_rating === "good" ? "🌟" : result.performance_rating === "acceptable" ? "✅" : "🚩"}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-black capitalize ${result.performance_rating === "good" ? "text-emerald-700" : result.performance_rating === "acceptable" ? "text-amber-700" : "text-rose-700"}`}>{result.performance_rating?.replace("_", " ")}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{result.summary?.verdict}</p>
                    </div>
                    {result.is_flagged && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">🚩 Flagged</span>}
                  </div>
                )}
              </div>
              <Btn variant="ghost" size="md" fullWidth onClick={onClose}>Close</Btn>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quantity Returned (sqft) <span className="text-rose-400">*</span></label>
                <div className="flex items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-400/30 focus-within:border-amber-400 transition-all">
                  <input type="number" min={0} max={issuedQty} step={0.1} value={returnedQty} onChange={(e) => setReturnedQty(e.target.value)} placeholder="0.00"
                    className="flex-1 px-3 py-3 text-sm bg-transparent outline-none min-w-0 font-mono" />
                  <span className="px-3 py-3 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center font-bold">sqft</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Enter <span className="font-bold">0</span> if nothing returned. Max: {issuedQty} sqft</p>
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
                  <select value={reason} onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all appearance-none pr-8">
                    {WASTAGE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▾</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Notes <span className="text-slate-300">(optional)</span></label>
                <textarea value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} rows={2}
                  placeholder="Additional context on wastage…"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all resize-none placeholder:text-slate-300" />
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

// ─── Skip / Awaiting file rows ────────────────────────────────────────────────
const SkipFileRow = ({ file }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
    <span className="text-base flex-shrink-0 opacity-50">{FILE_TYPE_ICON(file.file_type)}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-500 truncate">{file.label || file.file_name}</p>
      <p className="text-[10px] text-slate-400">No material needed — cutting file</p>
    </div>
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${LABEL_COLOR(file.label)}`}>{file.label}</span>
  </div>
);

const AwaitingFileRow = ({ file }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
    <span className="text-base flex-shrink-0">{FILE_TYPE_ICON(file.file_type)}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-amber-800 truncate">{file.label || file.file_name}</p>
      <p className="text-[10px] text-amber-600">Awaiting material issue from store</p>
    </div>
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-700 flex-shrink-0">⏳ Pending</span>
  </div>
);

// ─── Cart Item Production Card ────────────────────────────────────────────────
// One card per cart item — shows exactly how many design files it has and
// how many need material (outsource files are excluded entirely — they're
// not production's concern), then a row per file (skip / awaiting / task).
const CartItemProductionCard = ({ item, itemIdx, issues, job, user, show: showToast, onReturnClick, onProductionSaved }) => {
  const files = getProductionFiles(item, itemIdx);

  const rows = files.map((file, fileIdx) => {
    const mode  = getFileMode(file); // "inhouse" or "skip" only — outsource already filtered out
    const issue = mode === "skip" ? null : findIssueForFile(issues, itemIdx, file);
    return { file, fileIdx, mode, issue };
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.mode] = (acc[r.mode] || 0) + 1;
    return acc;
  }, {});

  if (files.length === 0) return null; // every file on this item is outsourced — nothing for production to do

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-sm text-white flex items-center gap-2">
            <span className="text-violet-400">▣</span>
            {item.product_name}
            {item.variation && <span className="text-white/40 font-normal text-xs"> · {item.variation}</span>}
          </div>
          <div className="text-xs text-white/50 mt-1 flex items-center gap-2 flex-wrap">
            <span>Qty: {item.quantity} {item.quantity_type}</span>
            {parseFloat(item.sq_ft) > 0 && <span className="text-violet-300 font-bold">· {item.sq_ft} sqft</span>}
            <span>· {files.length} design file{files.length > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {counts.inhouse > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">{counts.inhouse} in-house</span>}
          {counts.skip > 0    && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/60">{counts.skip} skip</span>}
        </div>
      </div>

      <div className="p-3 space-y-2 bg-slate-50/50">
        {rows.map(({ file, fileIdx, mode, issue }) => {
          if (mode === "skip") return <SkipFileRow key={file._id || fileIdx} file={file} />;
          if (!issue) return <AwaitingFileRow key={file._id || fileIdx} file={file} />;
          return (
            <DesignFileProductionTask
              key={issue._id}
              issue={issue}
              job={job}
              user={user}
              show={showToast}
              onReturnClick={onReturnClick}
              onProductionSaved={onProductionSaved}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── Production Tasks Section ─────────────────────────────────────────────────
// Groups every material issue under the cart item + design file it belongs
// to — the same "how many design files in the cart" logic the store manager
// uses to issue material — instead of showing a flat list of issues.
// Outsource files are excluded entirely: production only tracks in-house
// design-file work.
const ProductionTasksSection = ({ job, user, show: showToast, onReturnClick, returnVersion, onIssuesLoaded }) => {
  const [issues,  setIssues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!job._id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Prefer the job-scoped endpoint (accurate, not paginated). Fall back to
    // the global list (older backend deployments) filtered client-side.
    api(`/jobs/${job._id}/material`)
      .then((r) => r.data?.issues || [])
      .catch(() =>
        api(`/material?limit=1000`).then((r) => {
          const all = r.data?.issues || r.data || [];
          return all.filter((i) => String(i.job_id?._id || i.job_id) === String(job._id));
        })
      )
      .then((list) => {
        if (cancelled) return;
        setIssues(list);
        onIssuesLoaded?.(job._id, list);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [job._id, returnVersion]);

  // A design file's production was just saved — patch it into local state
  // immediately (no refetch needed) and bubble the fresh list up so the
  // job-level "ready to submit" gate updates right away.
  const handleProductionSaved = useCallback((issueId, patch) => {
    setIssues((prev) => {
      const next = prev.map((i) => (i._id === issueId ? { ...i, ...patch } : i));
      onIssuesLoaded?.(job._id, next);
      return next;
    });
  }, [job._id, onIssuesLoaded]);

  const fileRows = useMemo(() => flattenJobFiles(job), [job]);
  const requiredRows = fileRows.filter((r) => r.mode !== "skip");

  const matchedCount = useMemo(() => {
    return requiredRows.filter((r) => findIssueForFile(issues, r.itemIdx, r.file)).length;
  }, [requiredRows, issues]);

  if (loading) return (
    <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
      <Spinner size={16} /><span className="text-sm">Loading work tasks…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
      <span className="text-xl">❌</span><p className="text-xs text-rose-700 font-semibold">{error}</p>
    </div>
  );

  if (requiredRows.length === 0) return (
    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
      <span className="text-2xl flex-shrink-0 opacity-40">✂️</span>
      <div>
        <p className="text-xs font-bold text-slate-500">No material-requiring design files</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Every design file on this job's cart items is a cutting file — nothing to issue or produce.</p>
      </div>
    </div>
  );

  if (matchedCount === 0) return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
      <span className="text-2xl flex-shrink-0">🔒</span>
      <div>
        <p className="text-xs font-bold text-amber-800">No material issued yet</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          This job has {requiredRows.length} design file{requiredRows.length > 1 ? "s" : ""} awaiting material. Ask the store manager to issue material for job <span className="font-bold">{job.job_no}</span> first.
        </p>
      </div>
    </div>
  );

  const completedCount = useMemo(
    () => requiredRows.filter((r) => {
      const iss = findIssueForFile(issues, r.itemIdx, r.file);
      return iss?.production_status === "completed";
    }).length,
    [requiredRows, issues]
  );

  const pendingCount  = issues.filter((i) => !i.return).length;
  const returnedCount = issues.filter((i) =>  i.return).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">
          🎨 {matchedCount}/{requiredRows.length} design file{requiredRows.length > 1 ? "s" : ""} issued
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
          🖨 {completedCount}/{requiredRows.length} production saved
        </span>
        {returnedCount > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">✓ {returnedCount} returned</span>}
        {pendingCount  > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">⏳ {pendingCount} pending return</span>}
      </div>
      {(job.cart_items || []).map((item, itemIdx) => (
        <CartItemProductionCard
          key={item._id || item.item_id || itemIdx}
          item={item} itemIdx={itemIdx}
          issues={issues} job={job} user={user}
          show={showToast} onReturnClick={onReturnClick}
          onProductionSaved={handleProductionSaved}
        />
      ))}
    </div>
  );
};

// ─── JobCard ──────────────────────────────────────────────────────────────────
const JobCard = ({
  job, user, expanded, onSelect,
  onSubmit, submitting, show: showToast,
  returnModalIssue, setReturnModalIssue, returnVersion,
  hasMaterial, onIssuesLoaded,
}) => {
  // How many of this job's cart-item design files (in-house only — outsource
  // is excluded from production entirely) actually need material, how many
  // have been issued, and how many have had their OWN production details
  // (machine/ink log, photo, notes) saved. This is the same per-design-file
  // accounting the store manager does when issuing.
  const [jobIssues, setJobIssues] = useState([]);
  const handleIssuesLoaded = useCallback((jobId, list) => {
    setJobIssues(list);
    onIssuesLoaded?.(jobId, list);
  }, [onIssuesLoaded]);

  const requiredFileRows = useMemo(
    () => flattenJobFiles(job).filter((r) => r.mode !== "skip"),
    [job]
  );
  const issuedFileCount = useMemo(
    () => requiredFileRows.filter((r) => findIssueForFile(jobIssues, r.itemIdx, r.file)).length,
    [requiredFileRows, jobIssues]
  );
  const completedFileCount = useMemo(
    () => requiredFileRows.filter((r) => findIssueForFile(jobIssues, r.itemIdx, r.file)?.production_status === "completed").length,
    [requiredFileRows, jobIssues]
  );
  const allMaterialIssued  = requiredFileRows.length === 0 || issuedFileCount    >= requiredFileRows.length;
  const allProductionSaved = requiredFileRows.length === 0 || completedFileCount >= requiredFileRows.length;

  const canSubmit = hasMaterial && allMaterialIssued && allProductionSaved;

  const hasDesignFile  = !!job.design_file;
  const hasDriveLink   = !!job.design_drive_link;
  const designApproved = job.design_status === "approved";

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-200 ${expanded ? "border-violet-300 shadow-lg shadow-violet-100" : "border-slate-200 shadow-sm"}`}>

      {/* Job header */}
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
            {hasDesignFile && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${expanded ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" : "bg-emerald-100 border-emerald-200 text-emerald-700"}`}>
                🎨 Design{designApproved ? " ✓" : ""}
              </span>
            )}
            {hasDriveLink && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${expanded ? "bg-[#1a73e8]/20 border-[#1a73e8]/40 text-[#93bbf8]" : "bg-[#e8f0fe] border-[#c5d9f8] text-[#1a73e8]"}`}>
                <DriveIcon size={9} />Drive
              </span>
            )}
            {!hasMaterial && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${expanded ? "bg-rose-500/20 border-rose-400/40 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-600"}`}>
                🔒 No material
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

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200 space-y-4 p-4">

          {/* Design file */}
          <DesignFileSection job={job} />

          {/* Production Tasks — grouped by cart item / design file, same as the store manager */}
          <Card className="p-4">
            <SectionHeader
              icon="📋"
              title="Work Tasks"
              subtitle="Each design file has its own timer, Machine & Ink Log, photo, and notes"
              badge={
                requiredFileRows.length > 0
                  ? <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{issuedFileCount}/{requiredFileRows.length} files</span>
                  : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">No material needed</span>
              }
            />
            <ProductionTasksSection
              job={job} user={user}
              show={showToast}
              onReturnClick={setReturnModalIssue}
              returnVersion={returnVersion}
              onIssuesLoaded={handleIssuesLoaded}
            />
          </Card>

          {/* Final job-level gate — every required design file's own production
              details (machine/ink log, photo, notes) must be saved first */}
          <Card className="p-4">
            <SectionHeader icon="🚚" title="Submit to Quality Check" subtitle="Requires every in-house design file's production to be saved" />

            <div className={`rounded-xl p-4 border ${canSubmit ? "bg-violet-50 border-violet-100" : "bg-slate-50 border-slate-100"}`}>
              <p className={`text-xs font-bold mb-2.5 uppercase tracking-wide ${canSubmit ? "text-violet-600" : "text-slate-400"}`}>
                {canSubmit ? "✓ Ready to Submit" : "Checklist"}
              </p>
              <div className="space-y-1.5">
                {[
                  {
                    label: requiredFileRows.length > 0 ? "All design files' material issued" : "No material needed for this job",
                    done: allMaterialIssued,
                    detail: requiredFileRows.length > 0 ? `${issuedFileCount}/${requiredFileRows.length} files` : null,
                  },
                  {
                    label: requiredFileRows.length > 0 ? "All design files' production details saved" : "Nothing to produce",
                    done: allProductionSaved,
                    detail: requiredFileRows.length > 0 ? `${completedFileCount}/${requiredFileRows.length} files` : null,
                  },
                ].map(({ label, done, detail }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>{done ? "✓" : "○"}</span>
                    <span className={done ? "text-slate-700 font-semibold" : "text-slate-400"}>{label}</span>
                    {done && detail && <span className="text-slate-400 font-mono text-[10px] ml-auto">{detail}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              {!hasMaterial ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-700">🔒 Waiting for material</p>
                  <p className="text-xs text-amber-600 mt-1">Ask the store manager to issue material before submitting production.</p>
                </div>
              ) : !allMaterialIssued ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-700">🔒 {requiredFileRows.length - issuedFileCount} design file{requiredFileRows.length - issuedFileCount > 1 ? "s" : ""} still awaiting material</p>
                  <p className="text-xs text-amber-600 mt-1">All design files in the cart must have material issued before submitting.</p>
                </div>
              ) : !allProductionSaved ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-700">🔒 {requiredFileRows.length - completedFileCount} design file{requiredFileRows.length - completedFileCount > 1 ? "s" : ""} still need production details</p>
                  <p className="text-xs text-amber-600 mt-1">Open each task above and save its photo, notes, and machine/ink log.</p>
                </div>
              ) : (
                <Btn onClick={onSubmit} loading={submitting} variant="success" size="lg" fullWidth disabled={!canSubmit}>
                  🚚 Submit & Move to Quality Check
                </Btn>
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

  const [jobs,          setJobs]          = useState([]);
  const [jobsLoading,   setJobsLoading]   = useState(false);
  // Map of jobId -> array of material issues (to gate visibility)
  const [jobMaterials,  setJobMaterials]  = useState({});
  const [filter,        setFilter]        = useState("");
  const [expandedId,    setExpandedId]    = useState(null);
  const [submittingJobs, setSubmittingJobs] = useState({});
  const [returnModalIssue, setReturnModalIssue] = useState(null);
  const [returnVersion,    setReturnVersion]    = useState(0);
  const [submittedJobs,    setSubmittedJobs]    = useState([]);

  // Fetch production jobs
  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res  = await api(`/jobs?job_status=production&limit=100`);
      let list   = res.data?.jobs || res.data || [];
      if (!Array.isArray(list)) list = [];
      const productionJobs = list.filter((j) => j.job_status === "production");
      setJobs(productionJobs);

      // Fetch material issues for all jobs to determine which have material.
      // NOTE: `/material` defaults to a paginated 20-item page — without an
      // explicit limit, jobs could wrongly show as "no material" once more
      // than 20 issues exist system-wide. Always pass a high limit here.
      const allMaterialRes = await api(`/material?limit=1000`);
      const allIssues      = allMaterialRes.data?.issues || allMaterialRes.data || [];
      const materialMap    = {};
      productionJobs.forEach((j) => {
        materialMap[j._id] = allIssues.filter(
          (i) => String(i.job_id?._id || i.job_id) === String(j._id)
        );
      });
      setJobMaterials(materialMap);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setJobsLoading(false);
    }
  }, [show]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Once a job card is expanded, ProductionTasksSection fetches the accurate
  // job-scoped issue list — merge it in so jobMaterials stays the single
  // source of truth used both for list-gating and for handleSubmit below.
  const handleIssuesLoaded = useCallback((jobId, list) => {
    setJobMaterials((prev) => ({ ...prev, [jobId]: list }));
  }, []);

  // Only show jobs that have at least one material issue
  const filteredJobs = useMemo(() => {
    let list = jobs.filter((j) => (jobMaterials[j._id] || []).length > 0);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter((j) => j.job_no?.toLowerCase().includes(q) || j.customer_name?.toLowerCase().includes(q));
    }
    return list;
  }, [jobs, jobMaterials, filter]);

  // Jobs that exist but have no material yet (for info banner)
  const noMaterialJobs = useMemo(() => {
    return jobs.filter((j) => !(jobMaterials[j._id] || []).length);
  }, [jobs, jobMaterials]);

  const toggleExpand = (jobId) => setExpandedId((prev) => prev === jobId ? null : jobId);

  const handleSubmit = async (job) => {
    const requiredFileRows = flattenJobFiles(job).filter((r) => r.mode !== "skip");
    const issues = jobMaterials[job._id] || [];
    const allIssued    = requiredFileRows.every((r) => findIssueForFile(issues, r.itemIdx, r.file));
    const allCompleted = requiredFileRows.every((r) => findIssueForFile(issues, r.itemIdx, r.file)?.production_status === "completed");

    if (!allIssued)    return show("All design files must have material issued before submitting", "error");
    if (!allCompleted) return show("Save production details (photo, notes, machine/ink log) for every design file first", "error");

    setSubmittingJobs((prev) => ({ ...prev, [job._id]: true }));
    try {
      // Every design file's production data is already saved on its own
      // material issue — the only remaining step is moving the job forward.
      await api(`/jobs/${job._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ job_status: "quality_check" }),
      });

      show(`Production submitted for ${job.job_no}! Moved to quality check.`, "success");
      setSubmittedJobs((prev) => [...prev, { jobId: job._id, jobNo: job.job_no }]);
      setExpandedId(null);
      fetchJobs();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSubmittingJobs((prev) => ({ ...prev, [job._id]: false }));
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
                  <p className="text-xs text-slate-400 hidden sm:block">Tasks · photos · machine & ink log · material return</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {filteredJobs.length > 0 && (
                  <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2.5 py-1 rounded-full">
                    {filteredJobs.length} job{filteredJobs.length > 1 ? "s" : ""}
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
                  <p className="text-xs text-emerald-600 mt-0.5">Moved to quality check. Record any remaining material returns below.</p>
                </div>
                <Btn variant="ghost" size="xs" onClick={() => setSubmittedJobs((prev) => prev.filter((x) => x.jobId !== sj.jobId))}>Dismiss</Btn>
              </div>
            </div>
          ))}

          {/* Info: jobs awaiting material */}
          {noMaterialJobs.length > 0 && !jobsLoading && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0 mt-px">🔒</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800">
                  {noMaterialJobs.length} job{noMaterialJobs.length > 1 ? "s" : ""} waiting for material issue
                </p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {noMaterialJobs.map((j) => j.job_no).join(", ")} — these will appear once the store manager issues material.
                </p>
              </div>
            </div>
          )}

          {/* Jobs list */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                icon="🏭" title="Production Jobs"
                subtitle="Only jobs with issued material are shown"
                badge={<span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">Material gated</span>}
              />
            </div>

            {jobs.length > 3 && (
              <input
                value={filter} onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by job no or customer…"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all placeholder:text-slate-300 mb-4"
              />
            )}

            {jobsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                <Spinner size={16} /><span className="text-sm">Fetching production jobs…</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                icon="🏭"
                title={jobs.length > 0 ? "No jobs with material issued" : "No production jobs"}
                subtitle={jobs.length > 0 ? "Jobs appear here once the store manager issues material" : "Jobs appear here once they enter production stage"}
              />
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => {
                  const hasMaterial = (jobMaterials[job._id] || []).length > 0;
                  return (
                    <JobCard
                      key={job._id}
                      job={job}
                      user={user}
                      expanded={expandedId === job._id}
                      onSelect={() => toggleExpand(job._id)}
                      onSubmit={() => handleSubmit(job)}
                      submitting={!!submittingJobs[job._id]}
                      show={show}
                      returnModalIssue={returnModalIssue}
                      setReturnModalIssue={setReturnModalIssue}
                      returnVersion={returnVersion}
                      hasMaterial={hasMaterial}
                      onIssuesLoaded={handleIssuesLoaded}
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