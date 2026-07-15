/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { admintoken } from "../helper/notification_helper";

// ─── Axios Instance ────────────────────────────────────────────────────────
const http = axios.create({
  baseURL: "https://api.dmedia.in/api/staff-monitor",
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});
http.interceptors.request.use((config) => {
  // Real auth token lives at localStorage[admintoken] ("admin_token") —
  // see pages/Login.jsx. "token"/"adminToken" are never set.
  const token = localStorage.getItem(admintoken) || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


// Matches the Express router / controller exactly:
//   GET  /assigned-tasks/staff/:staffId
//   POST /assigned-tasks/:taskId/start
//   POST /assigned-tasks/:taskId/stop            body: { notes }  (required)
//   POST /assigned-tasks/:taskId/complete
//   POST /assigned-tasks/:taskId/request-resume
// There is intentionally NO staff-side resume call — only an admin can
// resume a stopped task (POST /assigned-tasks/:taskId/resume, admin only).
const api = {
  getMyTasks:        (staffId)        => http.get(`/assigned-tasks/staff/${staffId}`).then((r) => r.data),
  startTask:         (taskId)         => http.post(`/assigned-tasks/${taskId}/start`).then((r) => r.data),
  stopTask:          (taskId, notes)  => http.post(`/assigned-tasks/${taskId}/stop`, { notes }).then((r) => r.data),
  completeTask:      (taskId)         => http.post(`/assigned-tasks/${taskId}/complete`).then((r) => r.data),
  requestResumeTask: (taskId)         => http.post(`/assigned-tasks/${taskId}/request-resume`).then((r) => r.data),
};

// ─── Design Tokens ──────────────────────────────────────────────────────
const T = {
  ink: "#0C111D", ink2: "#374151", ink3: "#6B7280", ink4: "#9CA3AF",
  border: "#E5E7EB", border2: "#D1D5DB", surface: "#FFFFFF", bg: "#F4F5F7", bg2: "#F9FAFB",
  amber: "#E8840A", amberL: "#FEF3E2", amberM: "#FDE68A", amberD: "#B45309",
  green: "#16A34A", greenL: "#F0FDF4", greenM: "#86EFAC",
  blue: "#2563EB", blueL: "#EFF6FF",
  violet: "#7C3AED", violetL: "#F5F3FF", violetM: "#DDD6FE",
  red: "#DC2626", redL: "#FEF2F2", redM: "#FECACA",
  r: "10px", r2: "16px",
};

const TASK_STATUS_CFG = {
  pending:          { bg: T.bg2,     text: T.ink3,   border: T.border,  bar: T.border2, label: "Pending"          },
  in_progress:      { bg: T.amberL,  text: T.amberD, border: T.amberM,  bar: T.amber,   label: "In progress"      },
  stopped:          { bg: T.redL,    text: T.red,    border: T.redM,    bar: T.red,     label: "Stopped"          },
  resume_requested: { bg: T.violetL, text: T.violet, border: T.violetM, bar: T.violet,  label: "Resume requested" },
  completed:        { bg: T.greenL,  text: T.green,  border: T.greenM,  bar: T.green,   label: "Completed"        },
};

// ─── Utilities ────────────────────────────────────────────────────────────
const fmtD = (s) => {
  if (!s) return "0m";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtDT = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " · " + dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};
const fmtRelative = (d) => {
  if (!d) return "";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

function useLiveSeconds(base, hasOpen, openSince) {
  const [x, setX] = useState(() => {
    if (!hasOpen || !openSince) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(openSince).getTime()) / 1000));
  });
  useEffect(() => {
    if (!hasOpen || !openSince) { setX(0); return; }
    const tick = () => setX(Math.floor((Date.now() - new Date(openSince).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasOpen, openSince]);
  return base + x;
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3400);
  }, []);
  const dismiss = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  input, select, button, textarea { font-family: inherit; }
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes toastIn   { from { opacity:0; transform:translateX(-50%) translateY(16px) scale(.96); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
  @keyframes statusDot { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  @keyframes shimmer   { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
  @keyframes popIn     { from { opacity:0; transform:scale(.97) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 99px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
  }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; flex-shrink: 0; animation: statusDot 1.6s ease-in-out infinite; }
  .field-inp { width: 100%; border: 1px solid ${T.border}; border-radius: ${T.r}; padding: 10px 12px; font-size: 13.5px; color: ${T.ink}; background: ${T.surface}; transition: border-color .14s, box-shadow .14s; }
  .field-inp:focus-visible { border-color: ${T.amber}; outline: none; box-shadow: 0 0 0 3px rgba(232,132,10,.14); }
  .mt-tab { padding: 8px 14px; border-radius: 9px; border: 1px solid ${T.border}; font-weight: 600; font-size: 12.5px; cursor: pointer; transition: background .13s, border-color .13s, color .13s, transform .1s; background: ${T.surface}; color: ${T.ink3}; white-space: nowrap; flex-shrink: 0; }
  .mt-tab:active { transform: scale(.97); }
  .mt-tab.active { border-color: ${T.amber}; background: ${T.amberL}; color: ${T.amberD}; font-weight: 700; }
  .mt-tab:focus-visible, .mt-btn:focus-visible, .mt-icon-btn:focus-visible { outline: 2px solid ${T.amber}; outline-offset: 2px; }
  .mt-btn { transition: filter .12s, transform .1s, opacity .12s; }
  .mt-btn:active:not(:disabled) { transform: scale(.97); }
  .mt-btn:hover:not(:disabled) { filter: brightness(1.06); }
  .mt-icon-btn { transition: background .13s, transform .1s; }
  .mt-icon-btn:active { transform: scale(.94); }
  .mt-card { transition: border-color .15s, box-shadow .15s; }
  .mt-card:hover { box-shadow: 0 2px 10px rgba(12,17,29,.05); }
  .skeleton { background: linear-gradient(90deg, ${T.bg2} 25%, #F0F1F3 37%, ${T.bg2} 63%); background-size: 400px 100%; animation: shimmer 1.4s ease-in-out infinite; border-radius: 8px; }
`;

// ─── Icons (small, inline, no deps) ────────────────────────────────────────
const Icon = {
  Play:   (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z" /></svg>,
  Stop:   (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  Check:  (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>,
  Ask:    (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12l7-7 7 7" /></svg>,
  Refresh:(p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6" /></svg>,
  Lock:   (p) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M7 10V7a5 5 0 0 1 10 0v3" /></svg>,
  Inbox:  (p) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></svg>,
  Alert:  (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" /></svg>,
  Check2: (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>,
  X:      (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>,
};

// ─── Small pieces ──────────────────────────────────────────────────────────
function Spinner({ size = 30 }) {
  return <div style={{ width: size, height: size, border: `2.5px solid ${T.border}`, borderTopColor: T.amber, borderRadius: "50%", animation: "spin .7s linear infinite" }} />;
}

function Toast({ toasts, dismiss }) {
  return (
    <div aria-live="polite" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 7, width: "calc(100% - 32px)", maxWidth: 380 }}>
      {toasts.map((t) => {
        const isErr = t.type === "error";
        return (
          <div key={t.id} role="alert" onClick={() => dismiss(t.id)}
            style={{ background: isErr ? T.red : T.ink, color: "#fff", borderRadius: 12, padding: "11px 14px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,.22)", animation: "toastIn .26s cubic-bezier(.34,1.56,.64,1)", display: "flex", alignItems: "center", gap: 9, cursor: "pointer", pointerEvents: "auto" }}>
            {isErr ? <Icon.Alert style={{ flexShrink: 0 }} /> : <Icon.Check2 style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 20px", color: T.ink4, animation: "fadeIn .2s ease" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.bg2, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.ink4 }}>{icon}</div>
      {title && <div style={{ fontSize: 14, fontWeight: 700, color: T.ink2, marginBottom: 4 }}>{title}</div>}
      <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>{message}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const c = TASK_STATUS_CFG[status] ?? TASK_STATUS_CFG.pending;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: c.bg, color: c.text, border: `1px solid ${c.border}`, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}>
      {status === "in_progress" && <span className="live-dot" />}
      {c.label}
    </span>
  );
}

function LiveTimer({ baseSeconds, openSince }) {
  const total = useLiveSeconds(baseSeconds, !!openSince, openSince);
  const s = Math.max(0, Math.floor(total));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.amberD, background: T.amberL, borderRadius: 7, padding: "3px 9px", fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${T.amberM}` }}>
      <span className="live-dot" />{`${h}:${m}:${sec}`}
    </span>
  );
}

// Visual progress bar comparing elapsed time to the estimate
function EstimateBar({ liveTotal, estimatedSecs }) {
  if (!estimatedSecs) return null;
  const pct = Math.min(100, (liveTotal / estimatedSecs) * 100);
  const over = liveTotal > estimatedSecs;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: 5, borderRadius: 99, background: T.bg2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: over ? T.red : T.amber, transition: "width .6s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: T.ink4, fontWeight: 600 }}>Target {fmtD(estimatedSecs)}</span>
        {over && <span style={{ fontSize: 10.5, color: T.red, fontWeight: 700 }}>+{fmtD(liveTotal - estimatedSecs)} over</span>}
      </div>
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div style={{ background: T.surface, borderRadius: T.r2, border: `1px solid ${T.border}`, padding: "15px 16px 15px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="skeleton" style={{ height: 15, width: "55%" }} />
      <div className="skeleton" style={{ height: 11, width: "80%" }} />
      <div className="skeleton" style={{ height: 22, width: 110, borderRadius: 7 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div className="skeleton" style={{ height: 34, width: 90, borderRadius: T.r }} />
        <div className="skeleton" style={{ height: 34, width: 90, borderRadius: T.r }} />
      </div>
    </div>
  );
}

// ─── Stop-note modal ────────────────────────────────────────────────────────
function StopNoteModal({ open, onCancel, onSubmit }) {
  const [val, setVal] = useState("");
  const taRef = useRef(null);
  useEffect(() => {
    if (open) {
      setVal("");
      setTimeout(() => taRef.current?.focus(), 40);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  const canSubmit = val.trim().length > 0;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stop-modal-title" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(12,17,29,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn .16s ease" }}>
      <div style={{ background: T.surface, borderRadius: T.r2, width: "100%", maxWidth: 400, padding: 20, boxShadow: "0 24px 64px rgba(0,0,0,.24)", animation: "popIn .18s cubic-bezier(.2,.9,.3,1.1)" }}>
        <div id="stop-modal-title" style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>Why are you stopping this task?</div>
        <div style={{ fontSize: 12, color: T.ink4, marginBottom: 12, lineHeight: 1.5 }}>This note is required and your admin will see it before resuming the task.</div>
        <textarea
          ref={taRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit(val.trim()); }}
          placeholder="What happened, what's left to do…"
          rows={4}
          maxLength={500}
          className="field-inp"
          style={{ resize: "vertical" }}
        />
        <div style={{ fontSize: 10.5, color: T.ink4, textAlign: "right", marginTop: 4 }}>{val.length}/500</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="mt-btn" onClick={onCancel} style={{ flex: 1, padding: 11, borderRadius: T.r, border: `1px solid ${T.border}`, background: T.surface, color: T.ink3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button className="mt-btn" onClick={() => canSubmit && onSubmit(val.trim())} disabled={!canSubmit}
            style={{ flex: 1, padding: 11, borderRadius: T.r, border: "none", background: canSubmit ? T.red : T.border2, color: "#fff", fontWeight: 700, fontSize: 13, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            Stop task
          </button>
        </div>
      </div>
    </div>
  );
}

// Lightweight inline confirm for the destructive-ish "Complete" action, to
// avoid an accidental tap silently closing out a task.
function ConfirmComplete({ open, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(12,17,29,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn .16s ease" }}>
      <div style={{ background: T.surface, borderRadius: T.r2, width: "100%", maxWidth: 360, padding: 20, boxShadow: "0 24px 64px rgba(0,0,0,.24)", animation: "popIn .18s cubic-bezier(.2,.9,.3,1.1)", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.greenL, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Icon.Check2 width={20} height={20} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>Mark this task complete?</div>
        <div style={{ fontSize: 12, color: T.ink4, marginBottom: 16, lineHeight: 1.5 }}>The timer will stop and this can't be undone from here.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="mt-btn" onClick={onCancel} style={{ flex: 1, padding: 11, borderRadius: T.r, border: `1px solid ${T.border}`, background: T.surface, color: T.ink3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Not yet</button>
          <button className="mt-btn" onClick={onConfirm} style={{ flex: 1, padding: 11, borderRadius: T.r, border: "none", background: T.green, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Yes, complete</button>
        </div>
      </div>
    </div>
  );
}

// ─── MyTaskCard ─────────────────────────────────────────────────────────────
function MyTaskCard({ task, busy, onStart, onStop, onComplete, onRequestResume }) {
  const openSession = (task.sessions || []).find((s) => !s.end) || null;
  const estimatedSecs = (task.estimated_hours || 0) * 3600;
  const liveTotal = (task.total_seconds || 0) + (openSession ? Math.floor((Date.now() - new Date(openSession.start).getTime()) / 1000) : 0);
  const overEstimate = estimatedSecs > 0 && liveTotal > estimatedSecs;
  const lastStop = task.stop_history?.length ? task.stop_history[task.stop_history.length - 1] : (task.stop_notes ? { notes: task.stop_notes } : null);
  const cfg = TASK_STATUS_CFG[task.status] ?? TASK_STATUS_CFG.pending;

  return (
    <div className="mt-card" style={{ background: T.surface, borderRadius: T.r2, border: `1px solid ${task.status === "in_progress" ? T.amberM : T.border}`, borderLeft: `3px solid ${cfg.bar}`, padding: "15px 16px 15px 15px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: T.ink, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.3 }}>{task.title}</div>
          {task.description && <div style={{ fontSize: 12, color: T.ink3, marginTop: 3, lineHeight: 1.5 }}>{task.description}</div>}
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {task.status === "in_progress"
          ? <LiveTimer baseSeconds={task.total_seconds || 0} openSince={openSession?.start} />
          : <span style={{ fontSize: 12, fontWeight: 700, color: T.ink3, background: T.bg2, borderRadius: 7, padding: "3px 9px" }}>{fmtD(task.total_seconds || 0)}</span>}
        <span style={{ fontSize: 10.5, color: T.ink4 }}>Assigned {fmtRelative(task.assigned_at)}</span>
      </div>

      {estimatedSecs > 0 && task.status !== "completed" && <EstimateBar liveTotal={liveTotal} estimatedSecs={estimatedSecs} />}

      {lastStop && ["stopped", "resume_requested"].includes(task.status) && (
        <div style={{ background: T.redL, border: `1px solid ${T.redM}`, borderRadius: 8, padding: "9px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Your stop note</div>
          <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.45 }}>{lastStop.notes}</div>
        </div>
      )}

      {task.status === "stopped" && (
        <div style={{ fontSize: 12, color: T.ink3, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          Waiting on your admin to resume this task.
        </div>
      )}
      {task.status === "resume_requested" && (
        <div style={{ background: T.violetL, border: `1px solid ${T.violetM}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: T.violet, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span className="live-dot" /> Resume request sent · waiting for admin approval
        </div>
      )}
      {task.status === "completed" && (
        <div style={{ background: T.greenL, border: `1px solid ${T.greenM}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: .4, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon.Check2 width={12} height={12} /> Completed · {fmtDT(task.completed_at)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {task.status === "pending" && (
          <button className="mt-btn" disabled={busy} onClick={() => onStart(task._id)} style={{ flex: "1 1 auto", minHeight: 40, padding: "9px 16px", borderRadius: T.r, border: "none", background: T.amber, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {busy ? <Spinner size={13} /> : <Icon.Play />} Start
          </button>
        )}
        {task.status === "in_progress" && (
          <>
            <button className="mt-btn" disabled={busy} onClick={() => onStop(task._id)} style={{ flex: "1 1 0", minHeight: 40, padding: "9px 16px", borderRadius: T.r, border: `1px solid ${T.redM}`, background: T.redL, color: T.red, fontWeight: 700, fontSize: 12.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon.Stop /> Stop
            </button>
            <button className="mt-btn" disabled={busy} onClick={() => onComplete(task._id)} style={{ flex: "1 1 0", minHeight: 40, padding: "9px 16px", borderRadius: T.r, border: "none", background: T.green, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              {busy ? <Spinner size={13} /> : <Icon.Check />} Complete
            </button>
          </>
        )}
        {task.status === "stopped" && (
          <button className="mt-btn" disabled={busy} onClick={() => onRequestResume(task._id)} style={{ flex: "1 1 auto", minHeight: 40, padding: "9px 16px", borderRadius: T.r, border: "none", background: T.violet, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {busy ? <Spinner size={13} /> : <Icon.Ask />} Ask admin to resume
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MyTasksPage ────────────────────────────────────────────────────────────
// Staff-facing view. Pass the logged-in staff's _id as a prop; falls back to
// localStorage("userprofile") if you store it there at login time.
export default function MyTasksPage({ staffId: staffIdProp }) {
  const staffId = staffIdProp || (localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile"))._id : null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("active"); // active | pending | stopped | completed | all
  const [busyId, setBusyId] = useState(null);
  const [stopPrompt, setStopPrompt] = useState(null); // taskId
  const [completePrompt, setCompletePrompt] = useState(null); // taskId
  const { toasts, push, dismiss } = useToast();
  const pollRef = useRef(null);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!staffId) return;
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const res = await api.getMyTasks(staffId);
      setTasks(Array.isArray(res?.data ?? res) ? (res?.data ?? res) : []);
    } catch (err) {
      push(err?.response?.data?.message ?? "Couldn't load your tasks — check your connection", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchTasks(false);
    pollRef.current = setInterval(() => fetchTasks(true), 20000);
    return () => clearInterval(pollRef.current);
  }, [fetchTasks]);

  const replaceTask = (updated) => setTasks((ts) => ts.map((t) => (t._id === updated._id ? updated : t)));

  const run = async (fn, taskId, successMsg, extraArg) => {
    try {
      setBusyId(taskId);
      const res = extraArg !== undefined ? await fn(taskId, extraArg) : await fn(taskId);
      replaceTask(res?.data ?? res);
      push(successMsg);
    } catch (err) {
      push(err?.response?.data?.message ?? "That didn't go through — try again", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleStart         = (taskId) => run(api.startTask, taskId, "Task started");
  const handleRequestResume = (taskId) => run(api.requestResumeTask, taskId, "Resume request sent to admin");
  const handleStopConfirm   = (notes)  => { const taskId = stopPrompt; setStopPrompt(null); run(api.stopTask, taskId, "Task stopped", notes); };
  const handleCompleteConfirm = () => { const taskId = completePrompt; setCompletePrompt(null); run(api.completeTask, taskId, "Nice work — marked complete"); };

  if (!staffId) {
    return (
      <div style={{ background: T.bg, minHeight: "100%", fontFamily: "'Inter',system-ui,sans-serif", padding: 24 }}>
        <style>{CSS}</style>
        <EmptyState icon={<Icon.Lock />} title="Signed out" message="We couldn't find your staff ID. Please log in again to see your tasks." />
      </div>
    );
  }

  const counts = {
    active:    tasks.filter((t) => t.status === "in_progress").length,
    pending:   tasks.filter((t) => t.status === "pending").length,
    stopped:   tasks.filter((t) => ["stopped", "resume_requested"].includes(t.status)).length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };
  const TABS = [
    { key: "active",    label: "Active",    count: counts.active },
    { key: "pending",   label: "Pending",   count: counts.pending },
    { key: "stopped",   label: "Stopped",   count: counts.stopped },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "all",       label: "All",       count: tasks.length },
  ];
  const visible = tasks
    .filter((t) => {
      if (filter === "all") return true;
      if (filter === "active") return t.status === "in_progress";
      if (filter === "pending") return t.status === "pending";
      if (filter === "stopped") return ["stopped", "resume_requested"].includes(t.status);
      if (filter === "completed") return t.status === "completed";
      return true;
    })
    .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));

  const EMPTY_COPY = {
    active:    { icon: <Icon.Play />, title: "Nothing running", message: "Start a pending task and it'll show up here with a live timer." },
    pending:   { icon: <Icon.Inbox />, title: "All caught up", message: "No pending tasks waiting on you right now." },
    stopped:   { icon: <Icon.Stop />, title: "Nothing stopped", message: "Tasks you've paused or that are waiting on admin approval land here." },
    completed: { icon: <Icon.Check2 />, title: "No completions yet", message: "Finished tasks will show up here for your records." },
    all:       { icon: <Icon.Inbox />, title: "No tasks yet", message: "Your admin hasn't assigned you anything yet — check back soon." },
  };

  return (
    <div style={{ background: T.bg, minHeight: "100%", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 48px" }}>

        <div style={{ position: "sticky", top: 0, zIndex: 10, background: T.bg, paddingBottom: 4, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, color: T.ink, letterSpacing: -.4, fontFamily: "'DM Sans',sans-serif" }}>My Tasks</div>
              <div style={{ fontSize: 11.5, color: T.ink4, marginTop: 2 }}>
                {refreshing ? <span style={{ color: T.amber, fontWeight: 600 }}>Updating…</span> : "Updates automatically every 20s"}
              </div>
            </div>
            <button
              className="mt-icon-btn"
              onClick={() => fetchTasks(false)}
              disabled={loading}
              aria-label="Refresh tasks"
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: loading ? T.ink4 : T.ink2, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon.Refresh style={{ animation: (loading || refreshing) ? "spin 0.9s linear infinite" : "none" }} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {TABS.map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)} className={`mt-tab${filter === key ? " active" : ""}`}>
                {label}<span style={{ opacity: .65, marginLeft: 5 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && !tasks.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TaskCardSkeleton /><TaskCardSkeleton /><TaskCardSkeleton />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <EmptyState icon={EMPTY_COPY[filter].icon} title={EMPTY_COPY[filter].title} message={EMPTY_COPY[filter].message} />
        )}

        {!loading && visible.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((t) => (
              <MyTaskCard
                key={t._id}
                task={t}
                busy={busyId === t._id}
                onStart={handleStart}
                onStop={(taskId) => setStopPrompt(taskId)}
                onComplete={(taskId) => setCompletePrompt(taskId)}
                onRequestResume={handleRequestResume}
              />
            ))}
          </div>
        )}
      </div>

      <StopNoteModal open={!!stopPrompt} onCancel={() => setStopPrompt(null)} onSubmit={handleStopConfirm} />
      <ConfirmComplete open={!!completePrompt} onCancel={() => setCompletePrompt(null)} onConfirm={handleCompleteConfirm} />
      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  );
}