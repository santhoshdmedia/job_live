/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// Axios Instance
// Full route map:
//   POST   /api/staff-monitor/session/login
//   POST   /api/staff-monitor/session/logout
//   GET    /api/staff-monitor/monitor
//   GET    /api/staff-monitor/monitor/:id/details
//   GET    /api/staff-monitor/monitor/:id/job-time      ← NEW
//   POST   /api/staff-monitor/task-log
//   DELETE /api/staff-monitor/task-log/:logId
// ─────────────────────────────────────────────────────────────────────────────
const http = axios.create({
  baseURL: "https://api.dmedia.in/api/staff-monitor",
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const api = {
  getMonitorList:  ()        => http.get("/monitor").then((r) => r.data),
  getStaffDetails: (id)      => http.get(`/monitor/${id}/details`).then((r) => r.data),
  getStaffJobTime: (id)      => http.get(`/monitor/${id}/job-time`).then((r) => r.data),  // NEW
  submitTaskLog:   (payload) => http.post("/task-log", payload).then((r) => r.data),
  deleteTaskLog:   (logId)   => http.delete(`/task-log/${logId}`).then((r) => r.data),
  recordLogin:     (staffId) => http.post("/session/login",  { staffId }).then((r) => r.data),
  recordLogout:    (staffId) => http.post("/session/logout", { staffId }).then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  "super admin":     { bg: "#1e293b", text: "#f8fafc", dot: "#94a3b8" },
  "accounting team": { bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  "designing team":  { bg: "#fce7f3", text: "#9d174d", dot: "#ec4899" },
  "quality check":   { bg: "#ffedd5", text: "#9a3412", dot: "#f97316" },
  "production team": { bg: "#cffafe", text: "#164e63", dot: "#06b6d4" },
  "packing team":    { bg: "#f0fdf4", text: "#14532d", dot: "#22c55e" },
  "delivery team":   { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "admin":           { bg: "#ede9fe", text: "#5b21b6", dot: "#7c3aed" },
};

const STAGE_COLORS = {
  design:        { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
  production:    { bg: "#cffafe", text: "#164e63", border: "#a5f3fc" },
  "quality check": { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
  qc:            { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
  packing:       { bg: "#f0fdf4", text: "#14532d", border: "#bbf7d0" },
  delivery:      { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  default:       { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

const stageColor = (stage = "") => STAGE_COLORS[stage.toLowerCase()] || STAGE_COLORS.default;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
const fmtDuration = (seconds) => {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtDurationLong = (seconds) => {
  if (!seconds) return "00:00:00";
  const s   = Math.max(0, Math.floor(seconds));
  const h   = String(Math.floor(s / 3600)).padStart(2, "0");
  const m   = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const fmtTime = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const fmtDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDateTime = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
};

const avatarColor = (name = "") => {
  const colors = ["#0d9488","#2563eb","#7c3aed","#db2777","#ea580c","#16a34a","#0891b2","#9333ea"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────
function useLiveElapsed(loginAt, active) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !loginAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(loginAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [loginAt, active]);
  return elapsed;
}

function useLiveSeconds(baseSeconds, hasOpen, openSince) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!hasOpen || !openSince) { setExtra(0); return; }
    const tick = () => setExtra(Math.floor((Date.now() - new Date(openSince).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasOpen, openSince]);
  return baseSeconds + extra;
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  input, select, button, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; }

  :root {
    --teal: #0d9488; --teal-light: #f0fdf4;
    --blue: #2563eb; --violet: #7c3aed;
    --danger: #ef4444;
    --surface: #ffffff; --surface-2: #f8fafc; --surface-3: #f1f5f9;
    --border: #e8ecf0; --border-strong: #d1d9e0;
    --text-1: #0f172a; --text-2: #374151; --text-3: #64748b; --text-4: #94a3b8;
    --radius-md: 12px; --radius-lg: 16px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,.06);
    --shadow-md: 0 4px 16px rgba(0,0,0,.08);
    --shadow-lg: 0 8px 32px rgba(0,0,0,.10);
  }

  @keyframes fadeIn   { from{opacity:0}             to{opacity:1} }
  @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sheetUp  { from{transform:translateY(100%)}           to{transform:translateY(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes toastIn  { from{opacity:0;transform:translateX(-50%) translateY(20px) scale(.92)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
  @keyframes ping     {
    0%   { box-shadow: 0 0 0 0   rgba(34,197,94,.55); }
    70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0);  }
    100% { box-shadow: 0 0 0 0   rgba(34,197,94,0);   }
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

  .monitor-card {
    background: var(--surface); border-radius: var(--radius-lg);
    border: 1.5px solid var(--border); padding: 18px;
    transition: box-shadow .18s, border-color .18s, transform .18s;
    cursor: pointer;
  }
  .monitor-card:hover  { box-shadow: var(--shadow-md); border-color: var(--border-strong); transform: translateY(-1px); }
  .monitor-card:active { transform: translateY(0); }
  .monitor-card.online { border-color: #86efac; background: linear-gradient(135deg,#f0fdf4,#fff); }

  .live-dot {
    width:8px; height:8px; border-radius:50%; background:#22c55e;
    display:inline-block; flex-shrink:0;
    animation: ping 1.4s cubic-bezier(0,0,.2,1) infinite;
  }

  .tab-pill {
    padding: 8px 18px; border-radius: 99px; border: 1.5px solid transparent;
    font-weight: 700; font-size: 13px; cursor: pointer;
    transition: all .15s; background: transparent; color: var(--text-4);
    white-space: nowrap;
  }
  .tab-pill.active { background:#0d9488; color:#fff; border-color:#0d9488; }
  .tab-pill:not(.active):hover { border-color:var(--border-strong); color:var(--text-2); }

  .search-inp {
    width:100%; border:1.5px solid var(--border); border-radius:12px;
    padding:10px 14px 10px 38px; font-size:13px; color:var(--text-1);
    background:var(--surface-2); font-family:inherit; transition:border-color .15s;
  }
  .search-inp:focus { border-color:#0d9488; background:#fff; }

  .stat-chip {
    display:flex; align-items:center; gap:7px;
    background:var(--surface); border:1.5px solid var(--border);
    border-radius:12px; padding:10px 16px; flex-shrink:0;
  }

  .field-label {
    display:block; font-size:11px; font-weight:800; color:#64748b;
    margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px;
  }
  .field-inp {
    width:100%; border:1.5px solid var(--border); border-radius:12px;
    padding:10px 13px; font-size:13px; color:var(--text-1);
    background:#fff; font-family:inherit; transition:border-color .15s;
  }
  .field-inp:focus { border-color:#7c3aed; }

  .job-card {
    border-radius: 14px; border: 1.5px solid #e2e8f0;
    overflow: hidden; background: #fff;
    transition: box-shadow .15s;
  }
  .job-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); }

  .job-card-header {
    padding: 14px 16px; display: flex; align-items: center;
    justify-content: space-between; gap: 10; cursor: pointer;
  }

  .stage-row {
    display: flex; align-items: center; gap: 10; padding: 10px 14px;
    border-radius: 10px; margin-bottom: 6px;
  }

  .session-pill {
    display: flex; align-items: center; gap: 8; padding: 8px 12px;
    border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9;
    font-size: 12px;
  }

  @media (max-width:640px) {
    .hide-sm { display:none !important; }
    .detail-grid { grid-template-columns: 1fr !important; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none", width:"calc(100% - 32px)", maxWidth:360 }}>
      {toasts.map((t) => {
        const bg = { error:"#ef4444", warn:"#f59e0b", success:"#0d9488" }[t.type] ?? "#0d9488";
        return (
          <div key={t.id} style={{ background:bg, color:"#fff", borderRadius:14, padding:"12px 16px", fontSize:13, fontWeight:700, boxShadow:"0 8px 32px rgba(0,0,0,.18)", animation:"toastIn .28s cubic-bezier(.34,1.56,.64,1)" }}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

function Avatar({ name = "?", src, size = 40, online }) {
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:avatarColor(name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.42, fontWeight:900, color:"#fff", overflow:"hidden" }}>
        {src ? <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : name.trim()[0].toUpperCase()}
      </div>
      {online !== undefined && (
        <div style={{ position:"absolute", bottom:1, right:1, width:size*.27, height:size*.27, borderRadius:"50%", border:"2px solid #fff", background: online ? "#22c55e" : "#d1d5db" }} />
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  const rc = ROLE_COLORS[role] ?? { bg:"#f1f5f9", text:"#475569", dot:"#94a3b8" };
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:999, background:rc.bg, color:rc.text, display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:rc.dot, flexShrink:0 }} />
      {role}
    </span>
  );
}

function Spinner({ size = 36 }) {
  return <div style={{ width:size, height:size, border:"3px solid #e2e8f0", borderTopColor:"#0d9488", borderRadius:"50%", animation:"spin .75s linear infinite" }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveTimer  — ticking badge for active login sessions
// ─────────────────────────────────────────────────────────────────────────────
function LiveTimer({ loginAt }) {
  const elapsed = useLiveElapsed(loginAt, true);
  return (
    <span style={{ fontSize:12, fontWeight:800, color:"#16a34a", background:"#dcfce7", borderRadius:999, padding:"3px 10px", fontVariantNumeric:"tabular-nums", display:"inline-flex", alignItems:"center", gap:5 }}>
      <span className="live-dot" />
      {fmtDuration(elapsed)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveJobTimer  — ticking job-level timer (counts up from baseSeconds)
// ─────────────────────────────────────────────────────────────────────────────
function LiveJobTimer({ baseSeconds, openSince }) {
  const total = useLiveSeconds(baseSeconds, !!openSince, openSince);
  return (
    <span style={{ fontSize:12, fontWeight:800, color:"#16a34a", background:"#dcfce7", borderRadius:999, padding:"3px 10px", fontVariantNumeric:"tabular-nums", display:"inline-flex", alignItems:"center", gap:5 }}>
      <span className="live-dot" />
      {fmtDurationLong(total)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MonitorCard  — compact staff tile
// ─────────────────────────────────────────────────────────────────────────────
function MonitorCard({ staff, onClick }) {
  const isOnline      = staff.isOnline;
  const todaySeconds  = staff.todaySeconds   ?? 0;
  const taskLogsToday = staff.taskLogsToday  ?? 0;
  const todaySessions = staff.todaySessions  ?? 0;
  const js            = staff.jobStats       ?? {};

  return (
    <div className={`monitor-card${isOnline ? " online" : ""}`} onClick={onClick}>
      {/* Top row */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
        <Avatar name={staff.name} src={staff.profileImg} size={48} online={isOnline} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:15, color:"#0f172a", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{staff.name}</div>
          <div style={{ fontSize:11, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{staff.email}</div>
          <div style={{ marginTop:5 }}><RoleBadge role={staff.role} /></div>
        </div>
        {isOnline
          ? <LiveTimer loginAt={staff.currentLoginAt} />
          : <span style={{ fontSize:11, fontWeight:700, color:"#94a3b8", background:"#f1f5f9", borderRadius:999, padding:"3px 10px", whiteSpace:"nowrap" }}>Offline</span>
        }
      </div>

      {/* Login stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
        {[
          { label:"Login Time",  value:fmtDuration(todaySeconds), color:"#0d9488" },
          { label:"Task Logs",   value:taskLogsToday,             color:"#7c3aed" },
          { label:"Sessions",    value:todaySessions,             color:"#2563eb" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign:"center", background:"#f8fafc", borderRadius:10, padding:"8px 4px", border:"1px solid #f1f5f9" }}>
            <div style={{ fontWeight:900, fontSize:17, color, lineHeight:1 }}>{value}</div>
            <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, marginTop:2, textTransform:"uppercase", letterSpacing:.4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Job stats row — NEW */}
      {(js.jobsAssignedTotal > 0 || js.activeJobs > 0) && (
        <div style={{ background: js.activeJobs > 0 ? "#f0fdf4" : "#f8fafc", borderRadius:10, padding:"10px 12px", border:`1.5px solid ${js.activeJobs > 0 ? "#bbf7d0" : "#f1f5f9"}`, marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Job Work</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:12 }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>
                <span style={{ color:"#0d9488", fontWeight:900 }}>{js.jobsAssignedTotal}</span>
                <span style={{ color:"#94a3b8", marginLeft:3 }}>jobs</span>
              </span>
              {js.activeJobs > 0 && (
                <span style={{ fontSize:12, fontWeight:700, color:"#16a34a", display:"flex", alignItems:"center", gap:4 }}>
                  <span className="live-dot" />{js.activeJobs} active
                </span>
              )}
            </div>
            <span style={{ fontSize:12, fontWeight:800, color: js.activeJobs > 0 ? "#16a34a" : "#64748b" }}>
              Today: {js.totalJobDisplayToday || "0m"}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12 }}>
        <span style={{ color:"#94a3b8", fontWeight:600 }}>
          {staff.lastActivity ? `Last active: ${fmtDateTime(staff.lastActivity)}` : "No activity yet"}
        </span>
        <span style={{ color:"#0d9488", fontWeight:700, fontSize:11 }}>View →</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionTimeline  — daily grouped login session list
// ─────────────────────────────────────────────────────────────────────────────
function SessionTimeline({ sessions }) {
  if (!sessions.length) return (
    <div style={{ textAlign:"center", padding:"40px 16px", color:"#94a3b8", fontSize:13 }}>No sessions recorded yet</div>
  );

  const byDate = {};
  for (const s of sessions) {
    const d = new Date(s.login_at).toDateString();
    (byDate[d] = byDate[d] || []).push(s);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {Object.entries(byDate).reverse().map(([date, ds]) => {
        const totalSecs = ds.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
        return (
          <div key={date}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#0f172a" }}>
                {new Date(date).toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short" })}
              </div>
              <div style={{ fontSize:12, color:"#0d9488", fontWeight:700 }}>Total: {fmtDuration(totalSecs)}</div>
            </div>

            {/* Hour bar */}
            <div style={{ position:"relative", height:28, marginBottom:10, background:"#f8fafc", borderRadius:8, overflow:"hidden" }}>
              {ds.map((s, i) => {
                const startH = new Date(s.login_at).getHours() + new Date(s.login_at).getMinutes() / 60;
                const endDate = s.logout_at ? new Date(s.logout_at) : new Date();
                const endH   = endDate.getHours() + endDate.getMinutes() / 60;
                const left   = (startH / 24) * 100;
                const width  = Math.max(((endH - startH) / 24) * 100, 0.5);
                return (
                  <div key={i}
                    title={`${fmtTime(s.login_at)} – ${s.logout_at ? fmtTime(s.logout_at) : "Active"}`}
                    style={{ position:"absolute", top:3, height:22, borderRadius:6, left:`${left}%`, width:`${width}%`,
                      background: s.logout_at ? "linear-gradient(90deg,#0d9488,#2dd4bf)" : "linear-gradient(90deg,#16a34a,#4ade80)",
                    }}
                  />
                );
              })}
              {[6,9,12,15,18,21].map((h) => (
                <div key={h} style={{ position:"absolute", top:0, bottom:0, left:`${(h/24)*100}%`, width:1, background:"#e2e8f0" }} />
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {ds.map((s, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
                  background: s.logout_at ? "#f8fafc" : "#f0fdf4",
                  border: `1px solid ${s.logout_at ? "#f1f5f9" : "#bbf7d0"}`,
                }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: s.logout_at ? "#94a3b8" : "#22c55e", flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>
                      {fmtTime(s.login_at)} — {s.logout_at ? fmtTime(s.logout_at) : <span style={{ color:"#16a34a" }}>Active now</span>}
                    </div>
                    {s.login_ip && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>IP: {s.login_ip}</div>}
                  </div>
                  <div style={{ fontSize:12, fontWeight:800, borderRadius:8, padding:"3px 9px",
                    color: s.logout_at ? "#64748b" : "#16a34a",
                    background: s.logout_at ? "#f1f5f9" : "#dcfce7",
                  }}>
                    {s.logout_at ? fmtDuration(s.duration_seconds) : <LiveTimer loginAt={s.login_at} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskLogTimeline  — purple vertical timeline
// ─────────────────────────────────────────────────────────────────────────────
function TaskLogTimeline({ logs, onDelete, isSuperAdmin }) {
  if (!logs.length) return (
    <div style={{ textAlign:"center", padding:"40px 16px", color:"#94a3b8", fontSize:13 }}>No task logs yet</div>
  );

  const byDate = {};
  for (const l of logs) {
    const d = new Date(l.submitted_at).toDateString();
    (byDate[d] = byDate[d] || []).push(l);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {Object.entries(byDate).reverse().map(([date, dayLogs]) => (
        <div key={date}>
          <div style={{ fontWeight:800, fontSize:13, color:"#0f172a", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:3, height:14, borderRadius:2, background:"#7c3aed", display:"inline-block" }} />
            {new Date(date).toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short" })}
            <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>{dayLogs.length} log{dayLogs.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ position:"relative", paddingLeft:32 }}>
            <div style={{ position:"absolute", left:11, top:0, bottom:0, width:2, background:"linear-gradient(to bottom,#7c3aed22,#7c3aed08)" }} />
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {dayLogs.map((log, i) => (
                <div key={log._id ?? i} style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left:-21, top:13, width:10, height:10, borderRadius:"50%", background:"#7c3aed", border:"2px solid #fff", boxShadow:"0 0 0 2px #ede9fe" }} />
                  <div style={{ background:"#faf8ff", borderRadius:12, border:"1.5px solid #ede9fe", padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        <span style={{ fontSize:11, fontWeight:800, color:"#7c3aed", background:"#ede9fe", borderRadius:6, padding:"2px 8px" }}>
                          {log.hour_label || fmtTime(log.submitted_at)}
                        </span>
                        {log.job_ref && (
                          <span style={{ fontSize:11, fontWeight:700, color:"#2563eb", background:"#eff6ff", borderRadius:6, padding:"2px 8px" }}>
                            #{log.job_ref}
                          </span>
                        )}
                        <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>{fmtDate(log.submitted_at)}</span>
                      </div>
                      {isSuperAdmin && log._id && (
                        <button onClick={() => onDelete(log._id)} title="Delete log"
                          style={{ border:"none", background:"none", cursor:"pointer", fontSize:13, color:"#ef4444", opacity:.6, padding:"2px 4px", flexShrink:0, lineHeight:1 }}>
                          ✕
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize:13, color:"#374151", lineHeight:1.55, fontWeight:500 }}>{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JobTimeCard  — expandable card for one job inside the Job Time tab (NEW)
// ─────────────────────────────────────────────────────────────────────────────
function JobTimeCard({ job }) {
  const [expanded, setExpanded] = useState(job.isCurrentlyActive);

  // Find the open session start (for live ticking)
  const openStage    = job.stages.find((s) => s.has_open_session);
  const openSession  = openStage?.sessions?.find((s) => s.is_open);
  const openSince    = openSession?.session_start || null;

  return (
    <div className="job-card" style={{ borderColor: job.isCurrentlyActive ? "#86efac" : "#e2e8f0", background: job.isCurrentlyActive ? "linear-gradient(135deg,#f0fdf4,#fff)" : "#fff" }}>
      {/* Header */}
      <div className="job-card-header" onClick={() => setExpanded((p) => !p)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:900, fontSize:14, color:"#0f172a" }}>{job.job_no}</span>
            {job.isCurrentlyActive && <span className="live-dot" />}
            <span style={{ fontSize:11, color:"#64748b", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{job.customer_name}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6,
              background: job.job_status === "completed" ? "#dcfce7" : job.job_status === "design" ? "#fce7f3" : "#f8fafc",
              color:      job.job_status === "completed" ? "#16a34a" : job.job_status === "design" ? "#9d174d" : "#64748b",
            }}>{job.job_status}</span>
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            {/* Stage badges */}
            {job.stages.map((s) => {
              const sc = stageColor(s.stage);
              return (
                <span key={s.stage} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6, background:sc.bg, color:sc.text, border:`1px solid ${sc.border}` }}>
                  {s.stage_label || s.stage}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          {job.isCurrentlyActive
            ? <LiveJobTimer baseSeconds={job.totalSeconds} openSince={openSince} />
            : <span style={{ fontSize:13, fontWeight:800, color:"#0d9488" }}>{job.totalDisplay}</span>
          }
          <span style={{ fontSize:16, color:"#94a3b8", transition:"transform .2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding:"0 16px 16px", borderTop:"1px solid #f1f5f9" }}>
          {job.stages.map((stage) => {
            const sc = stageColor(stage.stage);
            return (
              <div key={stage.stage} style={{ marginTop:12 }}>
                {/* Stage header */}
                <div className="stage-row" style={{ background:sc.bg, border:`1px solid ${sc.border}` }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:13, color:sc.text }}>{stage.stage_label || stage.stage}</div>
                    <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, color:"#64748b", fontWeight:600 }}>
                        {stage.action} · {stage.sessions.length} session{stage.sessions.length !== 1 ? "s" : ""}
                      </span>
                      {stage.assigned_at && (
                        <span style={{ fontSize:11, color:"#94a3b8" }}>Assigned: {fmtDate(stage.assigned_at)}</span>
                      )}
                      {stage.completed_at && (
                        <span style={{ fontSize:11, color:"#94a3b8" }}>Completed: {fmtDate(stage.completed_at)}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    {stage.has_open_session ? (
                      <LiveJobTimer
                        baseSeconds={stage.total_duration_seconds}
                        openSince={stage.sessions.find((s) => s.is_open)?.session_start}
                      />
                    ) : (
                      <span style={{ fontWeight:900, fontSize:14, color:sc.text }}>{stage.total_duration_display}</span>
                    )}
                  </div>
                </div>

                {/* Individual sessions */}
                {stage.sessions.length > 0 && (
                  <div style={{ paddingLeft:12, display:"flex", flexDirection:"column", gap:5 }}>
                    {stage.sessions.map((sess, idx) => (
                      <div key={idx} className="session-pill" style={{ background: sess.is_open ? "#f0fdf4" : "#f8fafc", border: `1px solid ${sess.is_open ? "#bbf7d0" : "#f1f5f9"}` }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background: sess.is_open ? "#22c55e" : "#94a3b8", flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <span style={{ fontWeight:700, color:"#374151" }}>
                            {fmtTime(sess.session_start)} — {sess.session_end ? fmtTime(sess.session_end) : <span style={{ color:"#16a34a" }}>Active</span>}
                          </span>
                          {sess.work_date && (
                            <span style={{ marginLeft:8, color:"#94a3b8", fontSize:11 }}>{sess.work_date}</span>
                          )}
                        </div>
                        <span style={{ fontWeight:800, color: sess.is_open ? "#16a34a" : "#64748b", fontSize:12 }}>
                          {sess.is_open
                            ? <LiveJobTimer baseSeconds={sess.duration_seconds} openSince={sess.session_start} />
                            : fmtDurationLong(sess.duration_seconds)
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Total row */}
          <div style={{ marginTop:14, paddingTop:10, borderTop:"1px dashed #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, fontWeight:800, color:"#64748b" }}>TOTAL TIME ON THIS JOB</span>
            {job.isCurrentlyActive
              ? <LiveJobTimer baseSeconds={job.totalSeconds} openSince={openSince} />
              : <span style={{ fontSize:15, fontWeight:900, color:"#0d9488" }}>{job.totalDisplay}</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JobTimeTab  — full tab rendered inside the detail modal (NEW)
// ─────────────────────────────────────────────────────────────────────────────
function JobTimeTab({ staffId, push }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getStaffJobTime(staffId)
      .then((res) => setData(res?.data ?? res))
      .catch((err) => push(err?.response?.data?.message ?? "Failed to load job time", "error"))
      .finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", padding:48 }}><Spinner /></div>
  );

  if (!data || !data.jobs?.length) return (
    <div style={{ textAlign:"center", padding:"48px 16px", color:"#94a3b8" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>🗂</div>
      <div style={{ fontWeight:700, fontSize:14 }}>No job assignments yet</div>
      <div style={{ fontSize:12, marginTop:4 }}>Time will appear here once a job stage is assigned and worked on</div>
    </div>
  );

  const { summary, jobs } = data;

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Total Jobs",    value:summary.jobCount,      color:"#2563eb", bg:"#eff6ff" },
          { label:"Active Now",    value:summary.activeJobCount, color:"#16a34a", bg:"#f0fdf4" },
          { label:"All-time Time", value:summary.totalDisplay,  color:"#0d9488", bg:"#f0fdf4" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background:bg, borderRadius:12, padding:"12px 14px", border:`1.5px solid ${color}22` }}>
            <div style={{ fontWeight:900, fontSize:20, color, lineHeight:1 }}>{value}</div>
            <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:.4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Active jobs first */}
      {jobs.some((j) => j.isCurrentlyActive) && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:12, color:"#16a34a", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            <span className="live-dot" /> CURRENTLY WORKING ON
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {jobs.filter((j) => j.isCurrentlyActive).map((job) => <JobTimeCard key={job._id} job={job} />)}
          </div>
        </div>
      )}

      {/* Past jobs */}
      {jobs.some((j) => !j.isCurrentlyActive) && (
        <div>
          <div style={{ fontWeight:800, fontSize:12, color:"#64748b", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>
            Past / Completed Jobs
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {jobs.filter((j) => !j.isCurrentlyActive).map((job) => <JobTimeCard key={job._id} job={job} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StaffDetailModal  — slide-up sheet (4 tabs now: Overview / Sessions / Task Logs / Job Time)
// ─────────────────────────────────────────────────────────────────────────────
function StaffDetailModal({ open, staff, onClose, push, isSuperAdmin }) {
  const [tab,        setTab]        = useState("overview");
  const [details,    setDetails]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [logMsg,     setLogMsg]     = useState("");
  const [jobRef,     setJobRef]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting,   setDeleting]   = useState(null);

  useEffect(() => {
    if (!open || !staff) return;
    setTab("overview");
    setDetails(null);
    setLogMsg("");
    setJobRef("");
    setLoading(true);

    api.getStaffDetails(staff._id)
      .then((res) => {
        const d = res?.data ?? res;
        setDetails({
          staff:          d.staff          ?? staff,
          sessions:       d.sessions       ?? [],
          taskLogs:       d.taskLogs       ?? [],
          jobAssignments: d.jobAssignments ?? [],
          jobTimeSummary: d.jobTimeSummary ?? {},
        });
      })
      .catch((err) => {
        push(err?.response?.data?.message ?? "Failed to load staff details", "error");
        setDetails({ staff, sessions: [], taskLogs: [], jobAssignments: [], jobTimeSummary: {} });
      })
      .finally(() => setLoading(false));
  }, [open, staff?._id]);

  const handleDeleteLog = async (logId) => {
    try {
      setDeleting(logId);
      await api.deleteTaskLog(logId);
      setDetails((d) => ({ ...d, taskLogs: d.taskLogs.filter((l) => l._id !== logId) }));
      push("Log deleted");
    } catch (err) {
      push(err?.response?.data?.message ?? "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmitLog = async () => {
    if (!logMsg.trim()) return;
    try {
      setSubmitting(true);
      const now        = new Date();
      const hour_label = now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
      const res        = await api.submitTaskLog({
        staffId:   staff._id,
        message:   logMsg.trim(),
        job_ref:   jobRef.trim() || undefined,
        hour_label,
      });
      const newLog = res?.data ?? { _id: Date.now(), message:logMsg.trim(), job_ref:jobRef.trim()||"", hour_label, submitted_at:now };
      setDetails((d) => ({ ...d, taskLogs: [newLog, ...(d?.taskLogs ?? [])] }));
      setLogMsg(""); setJobRef("");
      push("Log added");
    } catch (err) {
      push(err?.response?.data?.message ?? "Failed to submit log", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !staff) return null;

  const sessions       = details?.sessions       ?? [];
  const taskLogs       = details?.taskLogs       ?? [];
  const jobTimeSummary = details?.jobTimeSummary ?? {};
  const totalAllSecs   = sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const currentSession = sessions.find((s) => !s.logout_at) ?? null;

  const TABS = [
    { key:"overview",  label:"Overview" },
    { key:"jobtime",   label:`Job Time ${jobTimeSummary.jobCount > 0 ? `(${jobTimeSummary.jobCount})` : ""}` },
    { key:"sessions",  label:`Sessions (${sessions.length})` },
    { key:"logs",      label:`Task Logs (${taskLogs.length})` },
  ];

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", animation:"fadeIn .2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background:"#fff", borderRadius:"28px 28px 0 0", width:"100%", maxWidth:680, maxHeight:"94vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 60px rgba(0,0,0,.15)", animation:"sheetUp .3s cubic-bezier(.32,.72,0,1)" }}>

        {/* Drag handle */}
        <div style={{ display:"flex", justifyContent:"center", paddingTop:12 }}>
          <div style={{ width:44, height:4, borderRadius:99, background:"#e2e8f0" }} />
        </div>

        {/* Header */}
        <div style={{ padding:"12px 20px 0", display:"flex", alignItems:"center", gap:14 }}>
          <Avatar name={staff.name} src={staff.profileImg} size={52} online={staff.isOnline} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:18, color:"#0f172a", letterSpacing:-.3 }}>{staff.name}</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:1 }}>{staff.email}</div>
            <div style={{ marginTop:5, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <RoleBadge role={staff.role} />
              {staff.isOnline
                ? <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#16a34a" }}><span className="live-dot" />Online</span>
                : <span style={{ fontSize:11, fontWeight:700, color:"#94a3b8" }}>● Offline</span>
              }
              {jobTimeSummary.activeJobCount > 0 && (
                <span style={{ fontSize:11, fontWeight:700, color:"#0d9488", background:"#f0fdf4", borderRadius:6, padding:"2px 8px" }}>
                  🔨 {jobTimeSummary.activeJobCount} job{jobTimeSummary.activeJobCount !== 1 ? "s" : ""} in progress
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:"#f1f5f9", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", color:"#64748b", flexShrink:0 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, padding:"14px 20px 0", overflowX:"auto", scrollbarWidth:"none" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} className={`tab-pill${tab === key ? " active" : ""}`}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY:"auto", flex:1, padding:"18px 20px 28px" }}>

          {loading && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:60 }}>
              <Spinner />
            </div>
          )}

          {/* ── Overview ── */}
          {!loading && tab === "overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Summary tiles */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }} className="detail-grid">
                {[
                  { label:"Login Hours",   value:fmtDuration(totalAllSecs),          color:"#0d9488", bg:"#f0fdf4", icon:"⏱" },
                  { label:"Task Logs",     value:taskLogs.length,                    color:"#7c3aed", bg:"#faf8ff", icon:"📝" },
                  { label:"Login Sessions", value:sessions.length,                   color:"#2563eb", bg:"#eff6ff", icon:"🔄" },
                  { label:"Jobs Worked",   value:jobTimeSummary.jobCount ?? 0,       color:"#ea580c", bg:"#fff7ed", icon:"🗂" },
                ].map(({ label, value, color, bg, icon }) => (
                  <div key={label} style={{ background:bg, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${color}22` }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
                    <div style={{ fontWeight:900, fontSize:22, color, lineHeight:1 }}>{value}</div>
                    <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:.4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Job time summary — NEW */}
              {jobTimeSummary.totalSeconds > 0 && (
                <div style={{ background:"#fff7ed", borderRadius:14, padding:"14px 16px", border:"1.5px solid #fed7aa" }}>
                  <div style={{ fontWeight:800, fontSize:12, color:"#9a3412", marginBottom:10, textTransform:"uppercase", letterSpacing:.5 }}>
                    📊 Job Time Summary
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:900, color:"#ea580c" }}>{jobTimeSummary.totalDisplay}</div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700 }}>TOTAL JOB HOURS</div>
                    </div>
                    <div>
                      <div style={{ fontSize:22, fontWeight:900, color:jobTimeSummary.activeJobCount > 0 ? "#16a34a" : "#94a3b8" }}>
                        {jobTimeSummary.activeJobCount}
                      </div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700 }}>ACTIVE JOBS NOW</div>
                    </div>
                  </div>
                  <button onClick={() => setTab("jobtime")} style={{ marginTop:10, fontSize:12, color:"#ea580c", fontWeight:700, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                    View full job breakdown →
                  </button>
                </div>
              )}

              {/* Active session banner */}
              {currentSession && (
                <div style={{ background:"#f0fdf4", borderRadius:14, padding:"14px 16px", border:"1.5px solid #bbf7d0" }}>
                  <div style={{ fontWeight:800, fontSize:13, color:"#166534", marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
                    <span className="live-dot" /> Current Login Session
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:"#374151" }}>Started at <strong>{fmtTime(currentSession.login_at)}</strong></span>
                    <LiveTimer loginAt={currentSession.login_at} />
                  </div>
                </div>
              )}

              {/* Recent task logs */}
              {taskLogs.length > 0 && (
                <div>
                  <div style={{ fontWeight:800, fontSize:13, color:"#0f172a", marginBottom:10 }}>Recent Task Logs</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {taskLogs.slice(0, 4).map((l, i) => (
                      <div key={l._id ?? i} style={{ background:"#faf8ff", borderRadius:10, padding:"10px 12px", border:"1px solid #ede9fe" }}>
                        <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ fontSize:10, fontWeight:800, color:"#7c3aed", background:"#ede9fe", borderRadius:6, padding:"2px 7px" }}>{l.hour_label || fmtTime(l.submitted_at)}</span>
                          {l.job_ref && <span style={{ fontSize:10, fontWeight:700, color:"#2563eb", background:"#eff6ff", borderRadius:6, padding:"2px 7px" }}>#{l.job_ref}</span>}
                          <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>{fmtDate(l.submitted_at)}</span>
                        </div>
                        <p style={{ fontSize:12, color:"#374151", lineHeight:1.5 }}>{l.message}</p>
                      </div>
                    ))}
                    {taskLogs.length > 4 && (
                      <button onClick={() => setTab("logs")} style={{ fontSize:12, color:"#7c3aed", fontWeight:700, background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}>
                        View all {taskLogs.length} logs →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Add log (super admin) */}
              {isSuperAdmin && (
                <div style={{ background:"#f8fafc", borderRadius:14, padding:14, border:"1.5px solid #e8ecf0" }}>
                  <label className="field-label">Add Log Entry</label>
                  <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job # (optional)" className="field-inp" style={{ marginBottom:8 }} />
                  <textarea value={logMsg} onChange={(e) => setLogMsg(e.target.value)} placeholder="Describe the task update…" rows={3} className="field-inp" style={{ resize:"vertical" }} />
                  <button onClick={handleSubmitLog} disabled={!logMsg.trim() || submitting}
                    style={{ marginTop:8, width:"100%", padding:"11px", borderRadius:12, border:"none", fontWeight:800, fontSize:13,
                      cursor: logMsg.trim() && !submitting ? "pointer" : "not-allowed",
                      background: logMsg.trim() && !submitting ? "#7c3aed" : "#d1d9e0", color:"#fff",
                    }}>
                    {submitting ? "Saving…" : "Add Log"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Job Time tab — NEW ── */}
          {!loading && tab === "jobtime" && <JobTimeTab staffId={staff._id} push={push} />}

          {/* ── Sessions tab ── */}
          {!loading && tab === "sessions" && <SessionTimeline sessions={sessions} />}

          {/* ── Task Logs tab ── */}
          {!loading && tab === "logs" && (
            <div>
              {!isSuperAdmin && (
                <div style={{ marginBottom:18, background:"#f8fafc", borderRadius:14, padding:14, border:"1.5px solid #e8ecf0" }}>
                  <label className="field-label">Submit Hourly Update</label>
                  <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Job # (optional)" className="field-inp" style={{ marginBottom:8 }} />
                  <textarea value={logMsg} onChange={(e) => setLogMsg(e.target.value)} placeholder="What are you working on?" rows={2} className="field-inp" style={{ resize:"vertical" }} />
                  <button onClick={handleSubmitLog} disabled={!logMsg.trim()||submitting}
                    style={{ marginTop:8, width:"100%", padding:"10px", borderRadius:12, border:"none", fontWeight:800, fontSize:13, cursor:"pointer",
                      background: logMsg.trim()&&!submitting?"#7c3aed":"#d1d9e0", color:"#fff",
                    }}>
                    {submitting ? "Saving…" : "Submit Update"}
                  </button>
                </div>
              )}
              <TaskLogTimeline logs={taskLogs} onDelete={handleDeleteLog} isSuperAdmin={isSuperAdmin} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StaffMonitorPage  — main page
// ─────────────────────────────────────────────────────────────────────────────
export default function StaffMonitorPage() {
  const [staffList,     setStaffList]     = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const { toasts, push } = useToast();
  const pollRef = useRef(null);

  // Replace with your actual auth: read role from context/localStorage
  const isSuperAdmin = true;

  const fetchList = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const res  = await api.getMonitorList();
      const list = res?.data ?? res ?? [];
      setStaffList(Array.isArray(list) ? list : []);
    } catch (err) {
      push(err?.response?.data?.message ?? "Failed to load staff", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchList(false);
    pollRef.current = setInterval(() => fetchList(true), 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchList]);

  const filtered = staffList.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.role?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || (statusFilter === "online" ? s.isOnline : !s.isOnline);
    return matchSearch && matchStatus;
  });

  const onlineCount    = staffList.filter((s) => s.isOnline).length;
  const offlineCount   = staffList.length - onlineCount;
  const totalTodaySecs = staffList.reduce((a, s) => a + (s.todaySeconds ?? 0), 0);
  const activeJobs     = staffList.reduce((a, s) => a + (s.jobStats?.activeJobs ?? 0), 0);

  return (
    <div style={{ minHeight:"100vh", background:"#f4f6f9", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{CSS}</style>

      {/* Sticky Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #eaecef", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 8px rgba(0,0,0,.05)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"14px 16px 0" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:"#0f172a", letterSpacing:-.4, display:"flex", alignItems:"center", gap:8 }}>
                <span>📡</span> Staff Monitor
              </div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:1 }}>
                Live activity · auto-refresh every 30s
                {refreshing && <span style={{ marginLeft:8, color:"#0d9488" }}>↻ Updating…</span>}
              </div>
            </div>
            <button onClick={() => fetchList(false)} disabled={loading}
              style={{ padding:"9px 16px", borderRadius:12, border:"1.5px solid #e2e8f0", background:"#f8fafc", color: loading ? "#94a3b8" : "#64748b", fontWeight:700, fontSize:12, cursor: loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", gap:6 }}>
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {/* Stats bar */}
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:14, scrollbarWidth:"none" }}>
            {[
              { label:"Total Staff",   value:staffList.length,          color:"#0f172a", bg:"#f8fafc" },
              { label:"Online Now",    value:onlineCount,               color:"#16a34a", bg:"#f0fdf4" },
              { label:"Offline",       value:offlineCount,              color:"#94a3b8", bg:"#f8fafc" },
              { label:"Login Hours",   value:fmtDuration(totalTodaySecs), color:"#0d9488", bg:"#f0fdf4" },
              { label:"Active Jobs",   value:activeJobs,                color:"#ea580c", bg:"#fff7ed" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="stat-chip" style={{ background:bg }}>
                <span style={{ fontWeight:900, fontSize:18, color, lineHeight:1 }}>{value}</span>
                <span style={{ fontSize:11, color:"#94a3b8", fontWeight:700 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ paddingBottom:14, display:"flex", gap:8, flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:1, minWidth:200 }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, pointerEvents:"none" }}>🔍</span>
              <input className="search-inp" placeholder="Search name, email, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[["","All"],["online","🟢 Online"],["offline","⚫ Offline"]].map(([val, label]) => (
                <button key={val} onClick={() => setStatusFilter(val)} style={{
                  padding:"9px 14px", borderRadius:12, border:"1.5px solid",
                  borderColor: statusFilter === val ? "#0d9488" : "#e2e8f0",
                  background:  statusFilter === val ? "#f0fdf4" : "#f8fafc",
                  color:       statusFilter === val ? "#0d9488" : "#64748b",
                  fontWeight:700, fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:1280, margin:"0 auto", padding:"16px 16px 48px" }}>

        {loading && !staffList.length && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 20px", gap:16 }}>
            <Spinner />
            <div style={{ fontSize:13, color:"#94a3b8", fontWeight:600 }}>Loading staff activity…</div>
          </div>
        )}

        {!loading && filtered.length === 0 && staffList.length === 0 && (
          <div style={{ background:"#fff", borderRadius:20, padding:"64px 24px", textAlign:"center", border:"1.5px dashed #e2e8f0" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📡</div>
            <div style={{ fontWeight:800, fontSize:18, color:"#1e293b", marginBottom:8 }}>No staff found</div>
            <div style={{ fontSize:13, color:"#94a3b8" }}>Staff will appear here once they log in</div>
          </div>
        )}

        {!loading && filtered.length === 0 && staffList.length > 0 && (
          <div style={{ background:"#fff", borderRadius:20, padding:"48px 24px", textAlign:"center", border:"1.5px dashed #e2e8f0" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e293b", marginBottom:6 }}>No matches</div>
            <div style={{ fontSize:13, color:"#94a3b8" }}>Try adjusting the search or filter</div>
          </div>
        )}

        {/* Online section */}
        {filtered.some((s) => s.isOnline) && (
          <div style={{ marginBottom:28 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span className="live-dot" />
              <span style={{ fontWeight:800, fontSize:14, color:"#166534" }}>Online Now</span>
              <span style={{ fontSize:12, color:"#94a3b8" }}>{filtered.filter((s) => s.isOnline).length} member{filtered.filter((s) => s.isOnline).length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
              {filtered.filter((s) => s.isOnline).map((s) => <MonitorCard key={s._id} staff={s} onClick={() => setSelectedStaff(s)} />)}
            </div>
          </div>
        )}

        {/* Offline section */}
        {filtered.some((s) => !s.isOnline) && statusFilter !== "online" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#d1d5db", display:"inline-block" }} />
              <span style={{ fontWeight:800, fontSize:14, color:"#64748b" }}>Offline</span>
              <span style={{ fontSize:12, color:"#94a3b8" }}>{filtered.filter((s) => !s.isOnline).length} member{filtered.filter((s) => !s.isOnline).length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
              {filtered.filter((s) => !s.isOnline).map((s) => <MonitorCard key={s._id} staff={s} onClick={() => setSelectedStaff(s)} />)}
            </div>
          </div>
        )}

        {staffList.length > 0 && (
          <div style={{ textAlign:"center", fontSize:11, color:"#c4cbd5", marginTop:28, fontWeight:600 }}>
            Showing {filtered.length} of {staffList.length} staff members
          </div>
        )}
      </div>

      <StaffDetailModal
        open={!!selectedStaff}
        staff={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        push={push}
        isSuperAdmin={isSuperAdmin}
      />

      <Toast toasts={toasts} />
    </div>
  );
}