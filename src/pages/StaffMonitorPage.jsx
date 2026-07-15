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
  // NOTE: the real auth token is written to localStorage under the
  // `admintoken` key ("admin_token") at login — see pages/Login.jsx.
  // This previously looked for "token" / "adminToken", neither of which
  // is ever set, so every request from this page went out unauthenticated
  // and silently 401'd on any route that actually checks the token.
  const token = localStorage.getItem(admintoken) || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// NOTE: every path/body below is matched 1:1 against the Express router +
// controller you shared. In particular:
//   - assignTask expects { staffIds: [...], tasks: [{ title, description, estimated_hours, due_at }] }
//   - stopAssignedTask expects body key "notes" (not "note")
//   - the resume-request route is "/assigned-tasks/:taskId/request-resume"
//   - there is NO reject-resume-request or note-based cancel route on the
//     backend, so those calls have been removed instead of silently 404-ing
const api = {
  getMonitorList:  ()       => http.get("/monitor").then((r) => r.data),
  getStaffDetails: (id)     => http.get(`/monitor/${id}/details`).then((r) => r.data),
  getStaffJobTime: (id)     => http.get(`/monitor/${id}/job-time`).then((r) => r.data),
  submitTaskLog:   (p)      => http.post("/task-log", p).then((r) => r.data),
  deleteTaskLog:   (logId)  => http.delete(`/task-log/${logId}`).then((r) => r.data),
  recordLogin:     (staffId)=> http.post("/session/login",  { staffId }).then((r) => r.data),
  recordLogout:    (staffId)=> http.post("/session/logout", { staffId }).then((r) => r.data),

  // ── Force logout (super admin) — for staff who didn't log out correctly ──
  forceLogout: (staffId) => http.post("/session/force-logout", { staffId }).then((r) => r.data),

  // ── After-7-PM work permission requests ──────────────────────────────────
  getPendingPermissions: () => http.get("/session/permission/pending").then((r) => r.data),
  respondPermission: (staffId, status, permitted_until, note) =>
    http.post(`/session/permission/${staffId}/respond`, { status, permitted_until, note }).then((r) => r.data),

  // ── Admin-assigned tasks (e.g. "Stock checking — 2 hours") ──────────────
  // payload: { staffIds: string[], tasks: [{ title, description, estimated_hours, due_at }] }
  assignTask:            (payload)      => http.post("/assigned-tasks", payload).then((r) => r.data),
  getAllAssignedTasks:   (params = {})  => http.get("/assigned-tasks", { params }).then((r) => r.data),
  getStaffAssignedTasks: (staffId)      => http.get(`/assigned-tasks/staff/${staffId}`).then((r) => r.data),
  startAssignedTask:     (taskId)       => http.post(`/assigned-tasks/${taskId}/start`).then((r) => r.data),
  // notes are REQUIRED by the backend when stopping a task
  stopAssignedTask:      (taskId, notes)=> http.post(`/assigned-tasks/${taskId}/stop`, { notes }).then((r) => r.data),
  completeAssignedTask:  (taskId)       => http.post(`/assigned-tasks/${taskId}/complete`).then((r) => r.data),
  // staff can optionally ask; admin is the only one who can actually resume
  requestResumeTask:     (taskId)       => http.post(`/assigned-tasks/${taskId}/request-resume`).then((r) => r.data),
  resumeAssignedTask:    (taskId)       => http.post(`/assigned-tasks/${taskId}/resume`).then((r) => r.data), // super admin only
  deleteAssignedTask:    (taskId)       => http.delete(`/assigned-tasks/${taskId}`).then((r) => r.data),       // super admin only
};

// ─── Design Tokens ────────────────────────────────────────────────────────
const T = {
  // Core
  ink:      "#0C111D",
  ink2:     "#374151",
  ink3:     "#6B7280",
  ink4:     "#9CA3AF",
  border:   "#E5E7EB",
  border2:  "#D1D5DB",
  surface:  "#FFFFFF",
  bg:       "#F4F5F7",
  bg2:      "#F9FAFB",

  // Amber accent — the "heat" color
  amber:    "#E8840A",
  amberL:   "#FEF3E2",
  amberM:   "#FDE68A",
  amberD:   "#B45309",

  // Status
  green:    "#16A34A",
  greenL:   "#F0FDF4",
  greenM:   "#86EFAC",
  blue:     "#2563EB",
  blueL:    "#EFF6FF",
  violet:   "#7C3AED",
  violetL:  "#F5F3FF",
  red:      "#DC2626",

  // Radius
  r:  "10px",
  r2: "14px",
  r3: "20px",
};

// ─── Role badge config ────────────────────────────────────────────────────
const ROLE_CFG = {
  "super admin":     { bg: T.ink,      text: "#F9FAFB",  dot: "#9CA3AF" },
  "admin":           { bg: T.violetL,  text: T.violet,   dot: T.violet  },
  "accounting team": { bg: T.greenL,   text: T.green,    dot: T.green   },
  "designing team":  { bg: "#FDF2F8",  text: "#9D174D",  dot: "#EC4899" },
  "quality check":   { bg: T.amberL,   text: T.amberD,   dot: T.amber   },
  "production team": { bg: "#ECFEFF",  text: "#164E63",  dot: "#06B6D4" },
  "packing team":    { bg: T.greenL,   text: "#14532D",  dot: "#22C55E" },
  "delivery team":   { bg: "#FEF2F2",  text: "#991B1B",  dot: T.red     },
};

const STAGE_CFG = {
  design:          { bg: "#FDF2F8", text: "#9D174D", border: "#FBCFE8" },
  production:      { bg: "#ECFEFF", text: "#164E63", border: "#A5F3FC" },
  "quality check": { bg: T.amberL,  text: T.amberD,  border: "#FDE68A" },
  qc:              { bg: T.amberL,  text: T.amberD,  border: "#FDE68A" },
  packing:         { bg: T.greenL,  text: "#14532D", border: "#BBF7D0" },
  delivery:        { bg: T.blueL,   text: "#1E40AF", border: "#BFDBFE" },
  default:         { bg: T.bg2,     text: T.ink3,    border: T.border  },
};
const stageColor = (s = "") => STAGE_CFG[s.toLowerCase()] || STAGE_CFG.default;

// ── Assigned-task status config ────────────────────────────────────────────
// NOTE: these keys match the Mongoose enum exactly:
// ["pending", "in_progress", "stopped", "resume_requested", "completed"]
const TASK_STATUS_CFG = {
  pending:          { bg: T.bg2,     text: T.ink3,   border: T.border,  label: "Pending"          },
  in_progress:      { bg: T.amberL,  text: T.amberD, border: "#FDE68A", label: "In progress"      },
  stopped:          { bg: "#FEF2F2", text: T.red,    border: "#FECACA", label: "Stopped"          },
  resume_requested: { bg: T.violetL, text: T.violet, border: "#DDD6FE", label: "Resume requested" },
  completed:        { bg: T.greenL,  text: T.green,  border: "#86EFAC", label: "Completed"        },
};

// ─── Utilities ────────────────────────────────────────────────────────────
const fmtD  = (s) => { if (!s) return "0m"; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const fmtDL = (s) => { const v=Math.max(0,Math.floor(s||0)); return [Math.floor(v/3600),Math.floor((v%3600)/60),v%60].map(n=>String(n).padStart(2,"0")).join(":"); };
const fmtT  = (d) => { if (!d) return "—"; return new Date(d).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}); };
const fmtDate= (d) => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtDT = (d) => { if (!d) return "—"; const dt=new Date(d); return dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})+" · "+dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}); };
const mapsUrl=(lat,lng)=>`https://www.google.com/maps?q=${lat},${lng}`;

const avatarBg = (name="") => {
  const palette = [T.amber,"#0891B2","#7C3AED","#DB2777","#059669","#2563EB","#9333EA","#DC2626"];
  let h=0; for (let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h);
  return palette[Math.abs(h)%palette.length];
};

// ─── Hooks ───────────────────────────────────────────────────────────────
function useLiveElapsed(loginAt, active) {
  const [e, setE] = useState(() => {
    if (!active || !loginAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(loginAt).getTime()) / 1000));
  });
  useEffect(() => {
    if (!active || !loginAt) { setE(0); return; }
    const tick = () => setE(Math.floor((Date.now()-new Date(loginAt).getTime())/1000));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [loginAt, active]);
  return e;
}
function useLiveSeconds(base, hasOpen, openSince) {
  const [x, setX] = useState(() => {
    if (!hasOpen || !openSince) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(openSince).getTime()) / 1000));
  });
  useEffect(() => {
    if (!hasOpen || !openSince) { setX(0); return; }
    const tick = () => setX(Math.floor((Date.now()-new Date(openSince).getTime())/1000));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [hasOpen, openSince]);
  return base + x;
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type="success") => {
    const id = Date.now();
    setToasts(p => [...p, {id, message, type}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

// ─── Global CSS ──────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: ${T.bg}; }
  input, select, button, textarea { font-family: inherit; }

  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sheetUp  { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes toastIn  { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
  @keyframes lbIn     { from { opacity:0; } to { opacity:1; } }
  @keyframes lbImg    { from { opacity:0; transform:scale(.94); } to { opacity:1; transform:scale(1); } }
  @keyframes heatPulse {
    0%   { box-shadow: 0 0 0 0 rgba(232,132,10,.5); }
    70%  { box-shadow: 0 0 0 8px rgba(232,132,10,0); }
    100% { box-shadow: 0 0 0 0 rgba(232,132,10,0); }
  }
  @keyframes statusDot {
    0%,100% { opacity: 1; }
    50%      { opacity: .45; }
  }
  @keyframes barGrow { from { width: 0; } to { width: 100%; } }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 99px; }

  .sm-card {
    background: ${T.surface};
    border-radius: ${T.r2};
    border: 1px solid ${T.border};
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow .18s, border-color .18s, transform .18s;
  }
  .sm-card:hover  { box-shadow: 0 6px 24px rgba(0,0,0,.08); border-color: ${T.border2}; transform: translateY(-2px); }
  .sm-card:active { transform: translateY(0); }

  /* Left heat stripe */
  .sm-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: ${T.border};
    transition: background .25s;
  }
  .sm-card.online::before {
    background: ${T.amber};
    animation: heatPulse 2s cubic-bezier(0,0,.2,1) infinite;
  }

  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: ${T.amber}; display: inline-block; flex-shrink: 0;
    animation: statusDot 1.6s ease-in-out infinite;
  }

  .tab-btn {
    padding: 7px 16px; border-radius: 8px; border: 1px solid transparent;
    font-weight: 600; font-size: 12.5px; cursor: pointer;
    transition: all .14s; background: transparent; color: ${T.ink4};
    white-space: nowrap; font-family: 'DM Sans', sans-serif;
  }
  .tab-btn.active {
    background: ${T.amberL}; color: ${T.amberD};
    border-color: #FDE68A; font-weight: 700;
  }
  .tab-btn:not(.active):hover { background: ${T.bg2}; color: ${T.ink2}; border-color: ${T.border}; }

  .search-inp {
    width: 100%; border: 1px solid ${T.border}; border-radius: ${T.r};
    padding: 9px 12px 9px 36px; font-size: 13px; color: ${T.ink};
    background: ${T.surface}; transition: border-color .14s, box-shadow .14s;
  }
  .search-inp:focus {
    border-color: ${T.amber}; outline: none;
    box-shadow: 0 0 0 3px rgba(232,132,10,.12);
  }

  .field-inp {
    width: 100%; border: 1px solid ${T.border}; border-radius: ${T.r};
    padding: 9px 12px; font-size: 13px; color: ${T.ink};
    background: ${T.surface}; transition: border-color .14s, box-shadow .14s;
  }
  .field-inp:focus {
    border-color: ${T.amber}; outline: none;
    box-shadow: 0 0 0 3px rgba(232,132,10,.12);
  }

  .selfie-thumb {
    width: 42px; height: 42px; border-radius: 9px; object-fit: cover;
    transform: scaleX(-1); border: 1.5px solid ${T.border2};
    flex-shrink: 0; cursor: pointer; transition: opacity .14s;
  }
  .selfie-thumb:hover { opacity: .84; }

  .selfie-ph {
    width: 42px; height: 42px; border-radius: 9px; background: ${T.bg2};
    border: 1.5px dashed ${T.border}; display: flex; align-items: center;
    justify-content: center; font-size: 16px; flex-shrink: 0; color: ${T.ink4};
  }

  .ip-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; color: ${T.ink3};
    background: ${T.bg2}; border-radius: 6px; padding: 2px 7px;
    font-variant-numeric: tabular-nums; border: 1px solid ${T.border};
  }

  .loc-link {
    display: flex; align-items: flex-start; gap: 4px;
    font-size: 11px; color: ${T.ink3}; text-decoration: none; line-height: 1.4;
    font-weight: 500; transition: color .12s;
  }
  .loc-link:hover { color: ${T.amber}; }

  .job-row {
    border-radius: ${T.r}; border: 1px solid ${T.border};
    overflow: hidden; background: ${T.surface};
    transition: box-shadow .14s;
  }
  .job-row:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); }

  .session-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-radius: 8px; font-size: 12px;
  }

  .stat-tile {
    border-radius: ${T.r}; padding: 12px 14px;
    border: 1px solid ${T.border};
    background: ${T.surface};
  }

  .btn-primary {
    width: 100%; padding: 10px; border-radius: ${T.r}; border: none;
    font-weight: 700; font-size: 13px; cursor: pointer;
    background: ${T.amber}; color: #FFF;
    transition: background .14s, opacity .14s;
    font-family: 'DM Sans', sans-serif;
  }
  .btn-primary:hover:not(:disabled) { background: ${T.amberD}; }
  .btn-primary:disabled { background: ${T.border2}; color: ${T.ink4}; cursor: not-allowed; }

  .btn-card-assign {
    padding: 6px 11px; border-radius: 8px; border: 1px solid #FDE68A;
    background: ${T.amberL}; color: ${T.amberD}; font-weight: 700;
    font-size: 11.5px; cursor: pointer; transition: all .13s;
    display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
  }
  .btn-card-assign:hover { background: #FDE68A; }

  .filter-btn {
    padding: 8px 14px; border-radius: ${T.r}; border: 1px solid ${T.border};
    background: ${T.surface}; color: ${T.ink3}; font-weight: 600;
    font-size: 12px; cursor: pointer; transition: all .13s; white-space: nowrap;
  }
  .filter-btn.active {
    border-color: ${T.amber}; background: ${T.amberL}; color: ${T.amberD};
  }

  @media (max-width: 600px) {
    .hide-sm { display: none !important; }
  }
`;

// ─── SelfieLightbox ───────────────────────────────────────────────────────
function SelfieLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",animation:"lbIn .16s ease",cursor:"zoom-out" }}>
      <img src={src} alt="Check-in selfie" onClick={e=>e.stopPropagation()} style={{ maxWidth:"min(88vw,460px)",maxHeight:"78vh",borderRadius:16,objectFit:"contain",transform:"scaleX(-1)",boxShadow:"0 32px 80px rgba(0,0,0,.5)",animation:"lbImg .2s cubic-bezier(.32,.72,0,1)" }} />
      <button onClick={onClose} style={{ position:"absolute",top:16,right:16,width:38,height:38,borderRadius:"50%",border:"none",background:"rgba(255,255,255,.12)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>×</button>
    </div>
  );
}

// ─── SelfieThumb ─────────────────────────────────────────────────────────
function SelfieThumb({ url, onOpen, title="" }) {
  if (!url) return <div className="selfie-ph" title="No selfie">📷</div>;
  return <img src={url} alt="selfie" title={title} className="selfie-thumb" onClick={e=>{ e.stopPropagation(); onOpen(url); }} />;
}

// ─── LocationLine ─────────────────────────────────────────────────────────
function LocationLine({ location, compact=false }) {
  if (!location) return <span style={{fontSize:11,color:T.ink4}}>No location</span>;
  const { latitude, longitude, formatted_address, accuracy } = location;
  const hasCoords = latitude != null && longitude != null;
  const isDmedia  = hasCoords && Math.abs(latitude-10.8138772)<.0001 && Math.abs(longitude-78.6726903)<.0001;
  const text      = isDmedia ? "dmedia office vayalur" : formatted_address || (hasCoords ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : null);
  if (!text) return <span style={{fontSize:11,color:T.ink4}}>No location</span>;
  const inner = (
    <>
      <span style={{fontSize:11,flexShrink:0}}>📍</span>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:compact?1:2,WebkitBoxOrient:"vertical"}}>{text}</span>
      {!compact && accuracy!=null && accuracy<=300 && <span style={{flexShrink:0,fontSize:10,color:T.ink4,marginLeft:2}}>±{Math.round(accuracy)}m</span>}
    </>
  );
  if (hasCoords) return <a href={mapsUrl(latitude,longitude)} target="_blank" rel="noopener noreferrer" className="loc-link" onClick={e=>e.stopPropagation()} title={`Google Maps · ${text}`}>{inner}</a>;
  return <span className="loc-link" style={{cursor:"default"}}>{inner}</span>;
}

// ─── IpChip ──────────────────────────────────────────────────────────────
function IpChip({ ip }) {
  if (!ip) return null;
  return <span className="ip-chip" title={`Login IP: ${ip}`}>🌐 {ip}</span>;
}

// ─── Toast ───────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,display:"flex",flexDirection:"column",gap:7,pointerEvents:"none",width:"calc(100% - 32px)",maxWidth:360}}>
      {toasts.map(t => {
        const bg = {error:T.red,warn:"#D97706",success:T.green}[t.type]??T.green;
        return <div key={t.id} style={{background:bg,color:"#fff",borderRadius:12,padding:"11px 16px",fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,.18)",animation:"toastIn .26s cubic-bezier(.34,1.56,.64,1)"}}>{t.message}</div>;
      })}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ name="?", src, size=40, online }) {
  return (
    <div style={{position:"relative",flexShrink:0,width:size,height:size}}>
      <div style={{width:size,height:size,borderRadius:"50%",background:avatarBg(name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:800,color:"#fff",overflow:"hidden",fontFamily:"'DM Sans',sans-serif"}}>
        {src ? <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : (name.trim()[0]||"?").toUpperCase()}
      </div>
      {online !== undefined && (
        <div style={{position:"absolute",bottom:1,right:1,width:size*.24,height:size*.24,borderRadius:"50%",border:"2px solid #fff",background:online?T.green:"#D1D5DB"}} />
      )}
    </div>
  );
}

// ─── RoleBadge ───────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const rc = ROLE_CFG[role] ?? { bg:T.bg2, text:T.ink3, dot:T.ink4 };
  return (
    <span style={{fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:99,background:rc.bg,color:rc.text,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif",letterSpacing:.2}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:rc.dot,flexShrink:0}} />
      {role}
    </span>
  );
}

// ─── AssignedTaskStatusBadge ───────────────────────────────────────────────
function AssignedTaskStatusBadge({ status }) {
  const c = TASK_STATUS_CFG[status] ?? TASK_STATUS_CFG.pending;
  return (
    <span style={{fontSize:10.5,fontWeight:700,padding:"2px 9px",borderRadius:99,background:c.bg,color:c.text,border:`1px solid ${c.border}`,display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",flexShrink:0}}>
      {status==="in_progress" && <span className="live-dot" />}
      {c.label}
    </span>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────
function Spinner({ size=32 }) {
  return <div style={{width:size,height:size,border:`2.5px solid ${T.border}`,borderTopColor:T.amber,borderRadius:"50%",animation:"spin .7s linear infinite"}} />;
}

// ─── LiveTimer ───────────────────────────────────────────────────────────
function LiveTimer({ loginAt }) {
  const e = useLiveElapsed(loginAt, true);
  return (
    <span style={{fontSize:11.5,fontWeight:700,color:T.amberD,background:T.amberL,borderRadius:7,padding:"3px 9px",fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${T.amberM}`}}>
      <span className="live-dot" />{fmtD(e)}
    </span>
  );
}

// ─── LiveJobTimer ─────────────────────────────────────────────────────────
// Also reused for live-ticking assigned-task timers (same shape: base + open-since).
function LiveJobTimer({ baseSeconds, openSince }) {
  const total = useLiveSeconds(baseSeconds, !!openSince, openSince);
  return (
    <span style={{fontSize:11.5,fontWeight:700,color:T.amberD,background:T.amberL,borderRadius:7,padding:"3px 9px",fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${T.amberM}`}}>
      <span className="live-dot" />{fmtDL(total)}
    </span>
  );
}

// ─── StatTile ────────────────────────────────────────────────────────────
function StatTile({ label, value, color, bg, icon }) {
  return (
    <div className="stat-tile" style={{background:bg||T.surface,borderColor:color+"22"}}>
      <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
      <div style={{fontWeight:900,fontSize:22,color,lineHeight:1,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>
      <div style={{fontSize:10,color:T.ink4,fontWeight:600,marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
    </div>
  );
}

// ─── NotePromptModal ───────────────────────────────────────────────────────
// Generic confirm+note popup. Now only used for: stop (note required) and
// delete/cancel (confirm, no note needed by the backend).
function NotePromptModal({ open, title, description, placeholder="Add a note…", required=true, showTextarea=true, submitLabel="Submit", danger=false, onSubmit, onCancel }) {
  const [val, setVal] = useState("");
  useEffect(() => { if (open) setVal(""); }, [open]);
  if (!open) return null;
  const canSubmit = !required || val.trim().length > 0;
  return (
    <div onClick={e=>{ if (e.target===e.currentTarget) onCancel(); }} style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(12,17,29,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .16s ease"}}>
      <div style={{background:T.surface,borderRadius:T.r2,width:"100%",maxWidth:400,padding:20,boxShadow:"0 24px 64px rgba(0,0,0,.22)",animation:"slideUp .2s ease"}}>
        <div style={{fontWeight:800,fontSize:15,color:T.ink,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{title}</div>
        {description && <div style={{fontSize:12,color:T.ink4,marginBottom:12,lineHeight:1.5}}>{description}</div>}
        {showTextarea && (
          <>
            <textarea autoFocus value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} rows={4} className="field-inp" style={{resize:"vertical",marginTop:description?0:8}} />
            {required && <div style={{fontSize:10.5,color:T.ink4,marginTop:5}}>A note is required to continue.</div>}
          </>
        )}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={onCancel} style={{flex:1,padding:10,borderRadius:T.r,border:`1px solid ${T.border}`,background:T.surface,color:T.ink3,fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>canSubmit && onSubmit(val.trim())} disabled={!canSubmit} style={{flex:1,padding:10,borderRadius:T.r,border:"none",background:canSubmit?(danger?T.red:T.amber):T.border2,color:"#fff",fontWeight:700,fontSize:13,cursor:canSubmit?"pointer":"not-allowed"}}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── AssignedTaskCard ───────────────────────────────────────────────────────
// Fields here match the StaffAssignedTask mongoose schema exactly:
// status, sessions[{start,end,duration_seconds}], total_seconds, stop_notes,
// stop_history[{notes,stopped_at}], resume_requested_at, estimated_hours,
// assigned_at, completed_at.
function AssignedTaskCard({ task, isSuperAdmin, isOwner, onStart, onStop, onComplete, onRequestResume, onResume, onDelete }) {
  const openSession   = (task.sessions || []).find(s => !s.end) || null;
  const estimatedSecs = (task.estimated_hours || 0) * 3600;
  const liveTotal      = (task.total_seconds || 0) + (openSession ? Math.floor((Date.now()-new Date(openSession.start).getTime())/1000) : 0);
  const overEstimate   = estimatedSecs > 0 && liveTotal > estimatedSecs;
  const lastStop        = task.stop_history?.length ? task.stop_history[task.stop_history.length - 1] : (task.stop_notes ? { notes: task.stop_notes, stopped_at: task.assigned_at } : null);

  return (
    <div style={{background:T.surface,borderRadius:T.r2,border:`1px solid ${task.status==="in_progress"?"#FDE68A":T.border}`,padding:"13px 15px",display:"flex",flexDirection:"column",gap:9}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13.5,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{task.title}</div>
          {task.description && <div style={{fontSize:11.5,color:T.ink3,marginTop:2,lineHeight:1.45}}>{task.description}</div>}
        </div>
        <AssignedTaskStatusBadge status={task.status} />
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        {task.status==="in_progress"
          ? <LiveJobTimer baseSeconds={task.total_seconds || 0} openSince={openSession?.start} />
          : <span style={{fontSize:12,fontWeight:700,color:T.ink3,background:T.bg2,borderRadius:7,padding:"3px 9px"}}>{fmtD(task.total_seconds || 0)}</span>
        }
        {estimatedSecs>0 && (
          <span style={{fontSize:11,color:overEstimate?T.red:T.ink4,fontWeight:600}}>
            Target: {fmtD(estimatedSecs)}{overEstimate?" · over target":""}
          </span>
        )}
        <span style={{fontSize:10.5,color:T.ink4}}>Assigned {fmtDT(task.assigned_at)}</span>
      </div>

      {lastStop && ["stopped","resume_requested"].includes(task.status) && (
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"7px 10px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>Stop note · {fmtDT(lastStop.stopped_at)}</div>
          <div style={{fontSize:12,color:T.ink2,lineHeight:1.45}}>{lastStop.notes}</div>
        </div>
      )}

      {task.status==="stopped" && (
        <div style={{fontSize:12,color:T.ink3,fontWeight:600}}>
          {isSuperAdmin ? "Only you can resume this task." : "Stopped — only an admin can resume this task."}
        </div>
      )}

      {task.status==="resume_requested" && (
        <div style={{background:T.violetL,border:"1px solid #DDD6FE",borderRadius:8,padding:"7px 10px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.violet,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>Resume requested · {fmtDT(task.resume_requested_at)}</div>
          <div style={{fontSize:12,color:T.ink2}}>{isSuperAdmin ? "Waiting for your approval." : "Waiting for admin approval."}</div>
        </div>
      )}

      {task.status==="completed" && (
        <div style={{background:T.greenL,border:"1px solid #86EFAC",borderRadius:8,padding:"7px 10px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:.4}}>Completed · {fmtDT(task.completed_at)}</div>
        </div>
      )}

      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {/* pending -> start (staff owner or admin) */}
        {task.status==="pending" && (isOwner || isSuperAdmin) && (
          <button onClick={()=>onStart(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.amber,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>▶ Start</button>
        )}
        {/* in_progress -> stop / complete (staff owner or admin) */}
        {task.status==="in_progress" && (isOwner || isSuperAdmin) && (
          <>
            <button onClick={()=>onStop(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.red,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>■ Stop</button>
            <button onClick={()=>onComplete(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.green,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>✓ Complete</button>
          </>
        )}
        {/* stopped -> ONLY admin can resume; staff can just ask */}
        {task.status==="stopped" && (
          isSuperAdmin ? (
            <button onClick={()=>onResume(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.amber,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>↻ Resume</button>
          ) : isOwner ? (
            <button onClick={()=>onRequestResume(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.violet,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>Ask admin to resume</button>
          ) : null
        )}
        {task.status==="resume_requested" && isSuperAdmin && (
          <button onClick={()=>onResume(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:"none",background:T.amber,color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>✓ Approve &amp; Resume</button>
        )}
        {isSuperAdmin && task.status!=="completed" && (
          <button onClick={()=>onDelete(task._id)} style={{padding:"7px 14px",borderRadius:T.r,border:`1px solid ${T.border}`,background:T.surface,color:T.red,fontWeight:700,fontSize:12.5,cursor:"pointer"}}>Delete</button>
        )}
      </div>
    </div>
  );
}

// ─── AssignedTasksTab ───────────────────────────────────────────────────────
function AssignedTasksTab({ staffId, initialTasks, isSuperAdmin, push }) {
  const [tasks, setTasks]     = useState(initialTasks || []);
  const [prompt, setPrompt]   = useState(null); // { type: "stop"|"delete", taskId }
  const [busy, setBusy]       = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [aTitle, setATitle]   = useState("");
  const [aNotes, setANotes]   = useState("");
  const [aHours, setAHours]   = useState("");

  useEffect(() => { setTasks(initialTasks || []); }, [initialTasks]);

  const replaceTask = (updated) => setTasks(ts => ts.map(t => t._id === updated._id ? updated : t));
  const removeTask  = (taskId)  => setTasks(ts => ts.filter(t => t._id !== taskId));

  const runSimple = async (fn, taskId, successMsg, onOk) => {
    try { setBusy(true); const res = await fn(taskId); const updated = res?.data ?? res; onOk ? onOk(updated) : replaceTask(updated); push(successMsg); }
    catch (err) { push(err?.response?.data?.message ?? "Action failed", "error"); }
    finally { setBusy(false); }
  };

  const runWithNote = async (fn, taskId, note, successMsg) => {
    try { setBusy(true); const res = await fn(taskId, note); replaceTask(res?.data ?? res); push(successMsg); }
    catch (err) { push(err?.response?.data?.message ?? "Action failed", "error"); }
    finally { setBusy(false); }
  };

  const handleQuickAssign = async () => {
    if (!aTitle.trim()) return;
    try {
      setBusy(true);
      const res = await api.assignTask({
        staffIds: [staffId],
        tasks: [{ title: aTitle.trim(), description: aNotes.trim(), estimated_hours: aHours ? Number(aHours) : 0, due_at: null }],
      });
      const created = res?.data ?? res;
      setTasks(ts => [...(Array.isArray(created) ? created : [created]), ...ts]);
      setATitle(""); setANotes(""); setAHours(""); setShowAssign(false);
      push("Task assigned");
    } catch (err) { push(err?.response?.data?.message ?? "Failed to assign task", "error"); }
    finally { setBusy(false); }
  };

  const active = tasks.filter(t => ["pending","in_progress","stopped","resume_requested"].includes(t.status));
  const done   = tasks.filter(t => t.status === "completed");

  const promptCfg = {
    stop:   { title:"Why are you stopping this task?", description:"This note is required and will be visible to the admin.", required:true, showTextarea:true,  submitLabel:"Stop task",   danger:true  },
    delete: { title:"Delete this task?",                description:"This cannot be undone.",                                 required:false, showTextarea:false, submitLabel:"Delete task", danger:true  },
  };
  const activeCfg = prompt ? promptCfg[prompt.type] : null;

  return (
    <div>
      {isSuperAdmin && (
        <div style={{marginBottom:16}}>
          {!showAssign ? (
            <button onClick={()=>setShowAssign(true)} style={{fontSize:12,fontWeight:700,color:T.amberD,background:T.amberL,border:"1px solid #FDE68A",borderRadius:T.r,padding:"8px 14px",cursor:"pointer"}}>+ Assign new task</button>
          ) : (
            <div style={{background:T.bg2,borderRadius:T.r2,padding:14,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>New task for this staff member</div>
              <input value={aTitle} onChange={e=>setATitle(e.target.value)} placeholder="Task title (e.g. Stock checking)" className="field-inp" style={{marginBottom:8}} />
              <textarea value={aNotes} onChange={e=>setANotes(e.target.value)} placeholder="Instructions (optional)" rows={2} className="field-inp" style={{resize:"vertical",marginBottom:8}} />
              <input type="number" min="0" step="0.5" value={aHours} onChange={e=>setAHours(e.target.value)} placeholder="Estimated hours (optional, e.g. 2)" className="field-inp" style={{marginBottom:10}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowAssign(false)} style={{flex:1,padding:9,borderRadius:T.r,border:`1px solid ${T.border}`,background:T.surface,color:T.ink3,fontWeight:700,fontSize:12.5,cursor:"pointer"}}>Cancel</button>
                <button onClick={handleQuickAssign} disabled={!aTitle.trim()||busy} className="btn-primary" style={{flex:1}}>Assign</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tasks.length===0 ? (
        <EmptyState icon="🗂" message="No tasks assigned yet" />
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {active.length>0 && (
            <div>
              <div style={{fontWeight:700,fontSize:11,color:T.ink4,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Active / pending ({active.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {active.map(t => (
                  <AssignedTaskCard
                    key={t._id} task={t} isSuperAdmin={isSuperAdmin} isOwner={true}
                    onStart={(id)=>runSimple(api.startAssignedTask, id, "Task started")}
                    onStop={(id)=>setPrompt({ type:"stop", taskId:id })}
                    onComplete={(id)=>runSimple(api.completeAssignedTask, id, "Task completed")}
                    onRequestResume={(id)=>runSimple(api.requestResumeTask, id, "Resume request sent")}
                    onResume={(id)=>runSimple(api.resumeAssignedTask, id, "Task resumed")}
                    onDelete={(id)=>setPrompt({ type:"delete", taskId:id })}
                  />
                ))}
              </div>
            </div>
          )}
          {done.length>0 && (
            <div>
              <div style={{fontWeight:700,fontSize:11,color:T.ink4,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Completed ({done.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {done.map(t => (
                  <AssignedTaskCard
                    key={t._id} task={t} isSuperAdmin={isSuperAdmin} isOwner={true}
                    onStart={()=>{}} onStop={()=>{}} onComplete={()=>{}}
                    onRequestResume={()=>{}} onResume={()=>{}}
                    onDelete={(id)=>setPrompt({ type:"delete", taskId:id })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <NotePromptModal
        open={!!prompt}
        title={activeCfg?.title || ""}
        description={activeCfg?.description || ""}
        required={!!activeCfg?.required}
        showTextarea={activeCfg?.showTextarea !== false}
        danger={!!activeCfg?.danger}
        submitLabel={activeCfg?.submitLabel || "Submit"}
        onCancel={()=>setPrompt(null)}
        onSubmit={(note)=>{
          if (!prompt) return;
          const { type, taskId } = prompt;
          setPrompt(null);
          if (type==="stop")   runWithNote(api.stopAssignedTask, taskId, note, "Task stopped");
          if (type==="delete") runSimple(api.deleteAssignedTask, taskId, "Task deleted", ()=>removeTask(taskId));
        }}
      />
    </div>
  );
}

// ─── AssignTaskModal ────────────────────────────────────────────────────────
// Global "assign to one or many staff at once" modal (e.g. "Stock checking" for everyone).
// Accepts an optional preselectedStaffId so the per-card "Assign Task" button
// can open this modal with that staff member already checked.
function AssignTaskModal({ open, staffList, preselectedStaffId, onClose, push, onAssigned }) {
  const [selected, setSelected] = useState([]);
  const [title, setTitle]       = useState("");
  const [notes, setNotes]       = useState("");
  const [hours, setHours]       = useState("");
  const [search, setSearch]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(preselectedStaffId ? [preselectedStaffId] : []);
      setTitle(""); setNotes(""); setHours(""); setSearch("");
    }
  }, [open, preselectedStaffId]);

  if (!open) return null;

  const filtered = staffList.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const selectAll = () => setSelected(filtered.map(s => s._id));

  const submit = async () => {
    if (!title.trim() || !selected.length) return;
    try {
      setSubmitting(true);
      const res = await api.assignTask({
        staffIds: selected,
        tasks: [{ title: title.trim(), description: notes.trim(), estimated_hours: hours ? Number(hours) : 0, due_at: null }],
      });
      push(`Task assigned to ${selected.length} staff member${selected.length!==1?"s":""}`);
      onAssigned?.(res?.data ?? res);
      onClose();
    } catch (err) { push(err?.response?.data?.message ?? "Failed to assign task", "error"); }
    finally { setSubmitting(false); }
  };

  const preselectedStaff = preselectedStaffId ? staffList.find(s => s._id === preselectedStaffId) : null;

  return (
    <div onClick={e=>{ if (e.target===e.currentTarget) onClose(); }} style={{position:"fixed",inset:0,zIndex:800,background:"rgba(12,17,29,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .16s ease"}}>
      <div style={{background:T.surface,borderRadius:T.r2,width:"100%",maxWidth:480,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,.22)",animation:"slideUp .2s ease"}}>
        <div style={{padding:"18px 20px 0",flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:16,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>Assign a task</div>
          <div style={{fontSize:12,color:T.ink4,marginTop:2}}>
            {preselectedStaff ? `For ${preselectedStaff.name} — add more staff below if needed` : `e.g. "Stock checking" for one or more staff members`}
          </div>
        </div>
        <div style={{padding:"14px 20px",overflowY:"auto",flex:1}}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" className="field-inp" style={{marginBottom:8}} />
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Instructions (optional)" rows={2} className="field-inp" style={{resize:"vertical",marginBottom:8}} />
          <input type="number" min="0" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} placeholder="Estimated hours (optional, e.g. 2)" className="field-inp" style={{marginBottom:14}} />

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:700,color:T.ink3,textTransform:"uppercase",letterSpacing:.5}}>Assign to ({selected.length})</span>
            <button onClick={selectAll} style={{fontSize:11,fontWeight:700,color:T.amberD,background:"none",border:"none",cursor:"pointer"}}>Select all</button>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff…" className="field-inp" style={{marginBottom:8}} />
          <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:220,overflowY:"auto"}}>
            {filtered.map(s => (
              <label key={s._id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:8,background:selected.includes(s._id)?T.amberL:T.bg2,border:`1px solid ${selected.includes(s._id)?"#FDE68A":T.border}`,cursor:"pointer"}}>
                <input type="checkbox" checked={selected.includes(s._id)} onChange={()=>toggle(s._id)} style={{accentColor:T.amber}} />
                <Avatar name={s.name} src={s.profileImg} size={26} />
                <span style={{fontSize:12.5,fontWeight:600,color:T.ink,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                <span style={{fontSize:10,color:T.ink4}}>{s.role}</span>
              </label>
            ))}
            {filtered.length===0 && <div style={{textAlign:"center",fontSize:12,color:T.ink4,padding:16}}>No staff found</div>}
          </div>
        </div>
        <div style={{padding:"14px 20px 20px",display:"flex",gap:8,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:10,borderRadius:T.r,border:`1px solid ${T.border}`,background:T.surface,color:T.ink3,fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={submit} disabled={!title.trim()||!selected.length||submitting} className="btn-primary" style={{flex:1.4}}>
            {submitting ? "Assigning…" : `Assign${selected.length?` to ${selected.length}`:""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MonitorCard ─────────────────────────────────────────────────────────
function MonitorCard({ staff, onClick, onOpenSelfie, onAssignTask }) {
  const isOnline     = staff.isOnline;
  const ls           = staff.latestSelfie ?? null;
  const js           = staff.jobStats ?? {};
  const ats          = staff.assignedTaskStats ?? {};
  const todaySecs    = staff.todaySeconds ?? 0;
  const taskCount    = staff.taskLogsToday ?? 0;

  return (
    <div className={`sm-card${isOnline?" online":""}`} onClick={onClick} style={{paddingLeft:12}}>
      <div style={{padding:"16px 16px 14px 12px"}}>
        {/* Top row */}
        <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:12}}>
          <Avatar name={staff.name} src={staff.profileImg} size={44} online={isOnline} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14.5,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>{staff.name}</div>
            <div style={{fontSize:11,color:T.ink4,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{staff.email}</div>
          </div>
          <div style={{flexShrink:0}}>
            {isOnline
              ? <LiveTimer loginAt={staff.currentLoginAt} />
              : <span style={{fontSize:11,fontWeight:600,color:T.ink4,background:T.bg2,borderRadius:7,padding:"3px 9px",border:`1px solid ${T.border}`,display:"inline-block"}}>Offline</span>
            }
          </div>
        </div>

        {/* Last check-in block */}
        {ls && (
          <div style={{display:"flex",gap:10,alignItems:"flex-start",background:T.bg2,borderRadius:9,padding:"9px 11px",border:`1px solid ${T.border}`,marginBottom:12}}>
            <SelfieThumb url={ls.selfie_url} onOpen={onOpenSelfie} title={`Check-in · ${fmtT(ls.login_at)}`} />
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:9.5,fontWeight:700,color:T.ink4,textTransform:"uppercase",letterSpacing:.6}}>Last check-in · {fmtT(ls.login_at)}</div>
              <LocationLine location={ls.location} compact />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:12}}>
          {[
            {label:"Worked",  value:fmtD(staff.workingSecondsToday||todaySecs),  color:T.amber},
            {label:"Break",   value:fmtD(staff.breakSecondsToday||0),            color:"#D97706"},
            {label:"OT",      value:(staff.overtimeSecondsToday||0)>0?fmtD(staff.overtimeSecondsToday):"—", color:(staff.overtimeSecondsToday||0)>0?"#EA580C":T.ink4},
            {label:"Logs",    value:taskCount,                                    color:T.violet},
          ].map(({label,value,color})=>(
            <div key={label} style={{textAlign:"center",background:T.bg2,borderRadius:8,padding:"8px 4px",border:`1px solid ${T.border}`}}>
              <div style={{fontWeight:800,fontSize:15,color,lineHeight:1,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>
              <div style={{fontSize:9,color:T.ink4,fontWeight:600,marginTop:2,textTransform:"uppercase",letterSpacing:.4}}>{label}</div>
            </div>
          ))}
        </div>
        {/* Break status badge */}
        {staff.onBreak && (
          <div style={{background:T.amberL,borderRadius:8,padding:"7px 11px",border:`1px solid ${T.amberM}`,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>{staff.breakType==="lunch"?"🍽":"☕"}</span>
            <span style={{fontSize:12,fontWeight:700,color:T.amberD}}>{staff.breakType==="lunch"?"Lunch break":"Short break"} — currently paused</span>
          </div>
        )}

        {/* Didn't log out correctly — session carried over from a previous day */}
        {staff.staleOpenSession && (
          <div style={{background:"#FEF2F2",borderRadius:8,padding:"7px 11px",border:"1px solid #FECACA",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>⚠️</span>
            <span style={{fontSize:11.5,fontWeight:700,color:T.red}}>Didn't log out correctly — session still open from a previous day. Open details to force-logout.</span>
          </div>
        )}

        {/* After-7-PM permission request/approval */}
        {staff.permission?.status==="pending" && (
          <div style={{background:"#FFFBEB",borderRadius:8,padding:"7px 11px",border:"1px solid #FDE68A",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>⏳</span>
            <span style={{fontSize:11.5,fontWeight:700,color:T.amberD}}>Requested permission to work past 7 PM — needs your approval.</span>
          </div>
        )}
        {staff.permission?.status==="approved" && (
          <div style={{background:T.greenL,borderRadius:8,padding:"7px 11px",border:"1px solid #86EFAC",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>✓</span>
            <span style={{fontSize:11.5,fontWeight:700,color:T.green}}>Approved to work until {fmtT(staff.permission.permitted_until)}.</span>
          </div>
        )}

        {/* Job stats */}
        {(js.jobsAssignedTotal > 0 || js.activeJobs > 0) && (
          <div style={{background:js.activeJobs>0?T.amberL:T.bg2,borderRadius:8,padding:"9px 11px",border:`1px solid ${js.activeJobs>0?"#FDE68A":T.border}`,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:11.5,fontWeight:700,color:T.ink}}>
                <span style={{color:T.amber,fontWeight:800}}>{js.jobsAssignedTotal}</span>
                <span style={{color:T.ink4,marginLeft:3,fontSize:10}}>jobs</span>
              </span>
              {js.activeJobs > 0 && (
                <span style={{fontSize:11,fontWeight:700,color:T.amberD,display:"flex",alignItems:"center",gap:4}}>
                  <span className="live-dot" />{js.activeJobs} active
                </span>
              )}
            </div>
            <span style={{fontSize:11,fontWeight:700,color:js.activeJobs>0?T.amberD:T.ink3}}>Today: {js.totalJobDisplayToday||"0m"}</span>
          </div>
        )}

        {/* Assigned-task chips */}
        {(ats.active>0 || ats.pending>0 || ats.stopped>0 || ats.resumeRequested>0) && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {ats.active>0 && (
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:T.amberL,color:T.amberD,border:"1px solid #FDE68A",display:"inline-flex",alignItems:"center",gap:4}}>
                <span className="live-dot" />{ats.active} active task{ats.active!==1?"s":""}
              </span>
            )}
            {ats.resumeRequested>0 && (
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:T.violetL,color:T.violet,border:"1px solid #DDD6FE"}}>
                ⏳ {ats.resumeRequested} resume request{ats.resumeRequested!==1?"s":""}
              </span>
            )}
            {ats.stopped>0 && (
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"#FEF2F2",color:T.red,border:"1px solid #FECACA"}}>
                ■ {ats.stopped} stopped
              </span>
            )}
            {ats.pending>0 && (
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:T.bg2,color:T.ink3,border:`1px solid ${T.border}`}}>
                {ats.pending} pending
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span style={{fontSize:11,color:T.ink4,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {staff.lastActivity ? `Active ${fmtDT(staff.lastActivity)}` : "No activity yet"}
          </span>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <button className="btn-card-assign" onClick={(e)=>{ e.stopPropagation(); onAssignTask(staff); }}>🗂 Assign</button>
            <span style={{fontSize:11,color:T.amber,fontWeight:700}}>Details →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SessionTimeline ─────────────────────────────────────────────────────
function SessionTimeline({ sessions, onOpenSelfie }) {
  if (!sessions.length) return <div style={{textAlign:"center",padding:"48px 16px",color:T.ink4,fontSize:13}}>No sessions yet</div>;
  const byDate = {};
  for (const s of sessions) { const d=new Date(s.login_at).toDateString(); (byDate[d]=byDate[d]||[]).push(s); }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      {Object.entries(byDate).reverse().map(([date,ds])=>{
        const total=ds.reduce((a,s)=>a+(s.duration_seconds??0),0);
        return (
          <div key={date}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:13,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{new Date(date).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"})}</span>
              <span style={{fontSize:11.5,color:T.amber,fontWeight:700}}>Total: {fmtD(total)}</span>
            </div>
            {/* 24-hour bar */}
            <div style={{position:"relative",height:22,marginBottom:10,background:T.bg2,borderRadius:6,overflow:"hidden",border:`1px solid ${T.border}`}}>
              {ds.map((s,i)=>{
                const sh=new Date(s.login_at).getHours()+new Date(s.login_at).getMinutes()/60;
                const ed=s.logout_at?new Date(s.logout_at):new Date();
                const eh=ed.getHours()+ed.getMinutes()/60;
                const l=(sh/24)*100, w=Math.max(((eh-sh)/24)*100,.4);
                return <div key={i} title={`${fmtT(s.login_at)} – ${s.logout_at?fmtT(s.logout_at):"Active"}`} style={{position:"absolute",top:2,height:18,borderRadius:4,left:`${l}%`,width:`${w}%`,background:s.logout_at?`linear-gradient(90deg,${T.amber},#FBBF24)`:`linear-gradient(90deg,${T.amberD},${T.amber})`}} />;
              })}
              {[6,9,12,15,18,21].map(h=><div key={h} style={{position:"absolute",top:0,bottom:0,left:`${(h/24)*100}%`,width:1,background:T.border}} />)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {ds.map((s,i)=>(
                <div key={i} style={{borderRadius:10,background:s.logout_at?T.bg2:T.amberL,border:`1px solid ${s.logout_at?T.border:"#FDE68A"}`,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px"}}>
                    <SelfieThumb url={s.selfie_url} onOpen={onOpenSelfie} title={`Selfie · ${fmtT(s.login_at)}`} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12.5,fontWeight:600,color:T.ink}}>{fmtT(s.login_at)} — {s.logout_at?fmtT(s.logout_at):<span style={{color:T.amberD}}>Active now</span>}</div>
                      {s.login_ip && <div style={{marginTop:4}}><IpChip ip={s.login_ip} /></div>}
                    </div>
                    <div style={{flexShrink:0}}>
                      {s.logout_at
                        ? <span style={{fontSize:12,fontWeight:700,color:T.ink3,background:T.bg2,borderRadius:6,padding:"3px 8px"}}>{fmtD(s.duration_seconds)}</span>
                        : <LiveTimer loginAt={s.login_at} />
                      }
                    </div>
                  </div>
                  {s.location?.latitude!=null && (
                    <div style={{padding:"5px 12px 9px",borderTop:`1px solid ${s.logout_at?T.border:"#FDE68A"}`}}>
                      <LocationLine location={s.location} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TaskLogTimeline ─────────────────────────────────────────────────────
function TaskLogTimeline({ logs, onDelete, isSuperAdmin }) {
  if (!logs.length) return <div style={{textAlign:"center",padding:"48px 16px",color:T.ink4,fontSize:13}}>No task logs yet</div>;
  const byDate={};
  for (const l of logs) { const d=new Date(l.submitted_at).toDateString(); (byDate[d]=byDate[d]||[]).push(l); }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      {Object.entries(byDate).reverse().map(([date,dayLogs])=>(
        <div key={date}>
          <div style={{fontWeight:700,fontSize:13,color:T.ink,marginBottom:12,display:"flex",alignItems:"center",gap:8,fontFamily:"'DM Sans',sans-serif"}}>
            <span style={{width:3,height:14,borderRadius:2,background:T.violet,display:"inline-block"}} />
            {new Date(date).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"})}
            <span style={{fontSize:11,color:T.ink4,fontWeight:500}}>{dayLogs.length} log{dayLogs.length!==1?"s":""}</span>
          </div>
          <div style={{position:"relative",paddingLeft:28}}>
            <div style={{position:"absolute",left:9,top:0,bottom:0,width:1.5,background:`linear-gradient(to bottom,${T.violetL},transparent)`}} />
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {dayLogs.map((log,i)=>(
                <div key={log._id??i} style={{position:"relative"}}>
                  <div style={{position:"absolute",left:-20,top:12,width:9,height:9,borderRadius:"50%",background:T.violet,border:"2px solid #fff",boxShadow:`0 0 0 2px ${T.violetL}`}} />
                  <div style={{background:T.violetL,borderRadius:10,border:`1px solid #EDE9FE`,padding:"11px 13px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:6}}>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        <span style={{fontSize:10.5,fontWeight:700,color:T.violet,background:"#EDE9FE",borderRadius:5,padding:"2px 7px"}}>{log.hour_label||fmtT(log.submitted_at)}</span>
                        {log.job_ref && <span style={{fontSize:10.5,fontWeight:700,color:T.blue,background:T.blueL,borderRadius:5,padding:"2px 7px"}}>#{log.job_ref}</span>}
                        <span style={{fontSize:10,color:T.ink4,fontWeight:500}}>{fmtDate(log.submitted_at)}</span>
                      </div>
                      {isSuperAdmin && log._id && (
                        <button onClick={()=>onDelete(log._id)} title="Delete" style={{border:"none",background:"none",cursor:"pointer",fontSize:12,color:T.red,opacity:.5,padding:"2px 4px",lineHeight:1,flexShrink:0}}>✕</button>
                      )}
                    </div>
                    <p style={{fontSize:13,color:T.ink2,lineHeight:1.55,fontWeight:400}}>{log.message}</p>
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

// ─── JobTimeCard ──────────────────────────────────────────────────────────
function JobTimeCard({ job }) {
  const [exp, setExp] = useState(job.isCurrentlyActive);
  const openStage  = job.stages.find(s=>s.has_open_session);
  const openSess   = openStage?.sessions?.find(s=>s.is_open);
  const openSince  = openSess?.session_start || null;

  return (
    <div className="job-row" style={{borderColor:job.isCurrentlyActive?"#FDE68A":T.border,background:job.isCurrentlyActive?T.amberL:T.surface}}>
      <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setExp(p=>!p)}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}}>
            <span style={{fontWeight:800,fontSize:13.5,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{job.job_no}</span>
            {job.isCurrentlyActive && <span className="live-dot" />}
            <span style={{fontSize:11,color:T.ink3,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{job.customer_name}</span>
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,
              background:job.job_status==="completed"?"#F0FDF4":T.bg2,
              color:job.job_status==="completed"?T.green:T.ink3,
            }}>{job.job_status}</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {job.stages.map(s=>{ const sc=stageColor(s.stage); return <span key={s.stage} style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`}}>{s.stage_label||s.stage}</span>; })}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          {job.isCurrentlyActive
            ? <LiveJobTimer baseSeconds={job.totalSeconds} openSince={openSince} />
            : <span style={{fontSize:13,fontWeight:800,color:T.amber,fontFamily:"'DM Sans',sans-serif"}}>{job.totalDisplay}</span>
          }
          <span style={{fontSize:14,color:T.ink4,transition:"transform .18s",display:"inline-block",transform:exp?"rotate(180deg)":"none"}}>▾</span>
        </div>
      </div>
      {exp && (
        <div style={{padding:"0 14px 14px",borderTop:`1px solid ${job.isCurrentlyActive?"#FDE68A":T.border}`}}>
          {job.stages.map(stage=>{
            const sc=stageColor(stage.stage);
            return (
              <div key={stage.stage} style={{marginTop:10}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"9px 12px",borderRadius:8,background:sc.bg,border:`1px solid ${sc.border}`}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:12.5,color:sc.text}}>{stage.stage_label||stage.stage}</div>
                    <div style={{fontSize:11,color:T.ink3,marginTop:2}}>{stage.action} · {stage.sessions.length} session{stage.sessions.length!==1?"s":""}</div>
                  </div>
                  {stage.has_open_session
                    ? <LiveJobTimer baseSeconds={stage.total_duration_seconds} openSince={stage.sessions.find(s=>s.is_open)?.session_start} />
                    : <span style={{fontWeight:800,fontSize:13,color:sc.text}}>{stage.total_duration_display}</span>
                  }
                </div>
                {stage.sessions.length>0 && (
                  <div style={{paddingLeft:10,marginTop:5,display:"flex",flexDirection:"column",gap:4}}>
                    {stage.sessions.map((sess,idx)=>(
                      <div key={idx} className="session-row" style={{background:sess.is_open?T.amberL:T.bg2,border:`1px solid ${sess.is_open?"#FDE68A":T.border}`}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:sess.is_open?T.amber:"#D1D5DB",flexShrink:0}} />
                        <div style={{flex:1,fontSize:12,fontWeight:500,color:T.ink}}>
                          {fmtT(sess.session_start)} — {sess.session_end?fmtT(sess.session_end):<span style={{color:T.amberD}}>Active</span>}
                          {sess.work_date && <span style={{marginLeft:8,color:T.ink4,fontSize:10}}>{sess.work_date}</span>}
                        </div>
                        <span style={{fontSize:11.5,fontWeight:700,color:sess.is_open?T.amberD:T.ink3,flexShrink:0}}>
                          {sess.is_open?<LiveJobTimer baseSeconds={sess.duration_seconds} openSince={sess.session_start} />:fmtDL(sess.duration_seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{marginTop:12,paddingTop:10,borderTop:`1px dashed ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:T.ink4,textTransform:"uppercase",letterSpacing:.5}}>Total on this job</span>
            {job.isCurrentlyActive
              ? <LiveJobTimer baseSeconds={job.totalSeconds} openSince={openSince} />
              : <span style={{fontSize:14,fontWeight:800,color:T.amber,fontFamily:"'DM Sans',sans-serif"}}>{job.totalDisplay}</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JobTimeTab ───────────────────────────────────────────────────────────
function JobTimeTab({ staffId, push }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    setLoading(true);
    api.getStaffJobTime(staffId)
      .then(res=>setData(res?.data??res))
      .catch(err=>push(err?.response?.data?.message??"Failed to load job time","error"))
      .finally(()=>setLoading(false));
  },[staffId]);

  if (loading) return <div style={{display:"flex",justifyContent:"center",padding:48}}><Spinner /></div>;
  if (!data?.jobs?.length) return (
    <div style={{textAlign:"center",padding:"48px 16px",color:T.ink4}}>
      <div style={{fontSize:30,marginBottom:8}}>🗂</div>
      <div style={{fontWeight:700,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>No job assignments yet</div>
      <div style={{fontSize:12,marginTop:4}}>Time appears once a stage is assigned and worked on</div>
    </div>
  );
  const {summary,jobs}=data;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:9,marginBottom:18}}>
        {[
          {label:"Total Jobs",  value:summary.jobCount,      color:T.blue,  bg:T.blueL},
          {label:"Active Now",  value:summary.activeJobCount,color:T.green, bg:T.greenL},
          {label:"All-time",    value:summary.totalDisplay,  color:T.amber, bg:T.amberL},
        ].map(({label,value,color,bg})=>(
          <div key={label} style={{background:bg,borderRadius:10,padding:"11px 13px",border:`1px solid ${color}33`}}>
            <div style={{fontWeight:900,fontSize:19,color,lineHeight:1,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>
            <div style={{fontSize:9.5,color:T.ink4,fontWeight:600,marginTop:4,textTransform:"uppercase",letterSpacing:.4}}>{label}</div>
          </div>
        ))}
      </div>
      {jobs.some(j=>j.isCurrentlyActive) && (
        <div style={{marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:11,color:T.amberD,marginBottom:8,display:"flex",alignItems:"center",gap:6,textTransform:"uppercase",letterSpacing:.5}}>
            <span className="live-dot" /> Currently working on
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {jobs.filter(j=>j.isCurrentlyActive).map(job=><JobTimeCard key={job._id} job={job} />)}
          </div>
        </div>
      )}
      {jobs.some(j=>!j.isCurrentlyActive) && (
        <div>
          <div style={{fontWeight:700,fontSize:11,color:T.ink4,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Past / Completed</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {jobs.filter(j=>!j.isCurrentlyActive).map(job=><JobTimeCard key={job._id} job={job} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PickupStatusBadge ───────────────────────────────────────────────────
function PickupStatusBadge({ status }) {
  const cfg = {
    pending:   { bg:"#FEF3E2", text:"#B45309", border:"#FDE68A",  label:"Pending"   },
    collected: { bg:"#EFF6FF", text:"#1D4ED8", border:"#BFDBFE",  label:"Collected" },
    delivered: { bg:"#F0FDF4", text:"#15803D", border:"#86EFAC",  label:"Delivered" },
  }[status] ?? { bg:T.bg2, text:T.ink3, border:T.border, label:status };
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:cfg.bg,color:cfg.text,border:`1px solid ${cfg.border}`}}>{cfg.label}</span>;
}

// ─── MaterialStatusBadge ─────────────────────────────────────────────────
function MaterialStatusBadge({ status }) {
  const cfg = {
    issued:         { bg:"#FEF3E2", text:"#B45309", border:"#FDE68A",  label:"Issued"   },
    returned:       { bg:"#F0FDF4", text:"#15803D", border:"#86EFAC",  label:"Returned" },
    partial_return: { bg:"#EFF6FF", text:"#1D4ED8", border:"#BFDBFE",  label:"Partial"  },
  }[status] ?? { bg:T.bg2, text:T.ink3, border:T.border, label:status };
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:cfg.bg,color:cfg.text,border:`1px solid ${cfg.border}`}}>{cfg.label}</span>;
}

// ─── SectionHeader ───────────────────────────────────────────────────────
function SectionHeader({ icon, label, count, color=T.ink }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
      <span style={{width:3,height:13,borderRadius:2,background:color,display:"inline-block",flexShrink:0}} />
      <span style={{fontWeight:700,fontSize:12,color,fontFamily:"'DM Sans',sans-serif",textTransform:"uppercase",letterSpacing:.4}}>{icon} {label}</span>
      {count!=null && <span style={{fontSize:11,color:T.ink4,fontWeight:500}}>({count})</span>}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────
function EmptyState({ icon="📭", message }) {
  return (
    <div style={{textAlign:"center",padding:"28px 16px",color:T.ink4}}>
      <div style={{fontSize:28,marginBottom:7}}>{icon}</div>
      <div style={{fontSize:12,fontWeight:500}}>{message}</div>
    </div>
  );
}

// ─── MaterialsTab ─────────────────────────────────────────────────────────
function MaterialsTab({ issuedMaterials=[], pendingPickups=[], completedPickups=[], allTaskAssignments={} }) {
  const [section, setSection] = useState("issued");

  const SECTIONS = [
    { key:"issued",    label:`Issued (${issuedMaterials.length})` },
    { key:"pickups",   label:`Pickups (${pendingPickups.length+completedPickups.length})` },
  ];

  return (
    <div>
      {/* Summary row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[
          {label:"Issued",    value:allTaskAssignments.issuedMaterials??0,    color:"#B45309", bg:"#FEF3E2"},
          {label:"Pending",   value:allTaskAssignments.pendingMaterials??0,   color:T.red,     bg:"#FEF2F2"},
          {label:"Returned",  value:allTaskAssignments.returnedMaterials??0,  color:T.green,   bg:T.greenL},
        ].map(({label,value,color,bg})=>(
          <div key={label} style={{background:bg,borderRadius:9,padding:"10px 12px",border:`1px solid ${color}22`,textAlign:"center"}}>
            <div style={{fontWeight:900,fontSize:20,color,lineHeight:1,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>
            <div style={{fontSize:9.5,color:T.ink4,fontWeight:600,marginTop:3,textTransform:"uppercase",letterSpacing:.4}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {SECTIONS.map(({key,label})=>(
          <button key={key} onClick={()=>setSection(key)} className={`tab-btn${section===key?" active":""}`} style={{fontSize:11.5}}>{label}</button>
        ))}
      </div>

      {/* Issued Materials */}
      {section==="issued" && (
        issuedMaterials.length===0
          ? <EmptyState icon="📦" message="No materials issued to this staff member" />
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {issuedMaterials.map((m,i)=>(
                <div key={m._id??i} style={{background:T.bg2,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:7}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:13,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{m.cart_item_name||m.material?.product_name||"—"}</span>
                      <MaterialStatusBadge status={m.status} />
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:T.ink3,flexShrink:0}}>{m.issue_no}</span>
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Product:</span> {m.material?.product_name||"—"}</span>
                    <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Unit:</span> {m.material?.unit||"—"}</span>
                    <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Qty:</span> <strong style={{color:T.amber}}>{m.issued_qty}</strong></span>
                    {m.job_no && <span style={{fontSize:11.5,color:T.blue,fontWeight:600}}>#{m.job_no}</span>}
                  </div>
                  {m.return && (
                    <div style={{marginTop:6,fontSize:11,color:T.green,fontWeight:600}}>
                      ↩ Returned: {m.return?.returned_qty} {m.material?.unit}
                    </div>
                  )}
                </div>
              ))}
            </div>
      )}

      {/* Pickups */}
      {section==="pickups" && (
        (pendingPickups.length+completedPickups.length)===0
          ? <EmptyState icon="🚚" message="No pickup assignments found" />
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...pendingPickups,...completedPickups].map((p,i)=>{
                const pa = p.pickup_assignment??{};
                return (
                  <div key={p._id??i} style={{background:T.bg2,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:13,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{p.issue_no}</span>
                        <PickupStatusBadge status={pa.status} />
                        {p.job_no && <span style={{fontSize:10.5,color:T.blue,fontWeight:600}}>#{p.job_no}</span>}
                      </div>
                      <span style={{fontSize:11,color:T.ink4,flexShrink:0}}>{fmtDate(pa.assigned_at)}</span>
                    </div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {p.outsource_vendor && <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Vendor:</span> {p.outsource_vendor}</span>}
                      {pa.delivery_to && <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Deliver to:</span> {pa.delivery_to}</span>}
                      {pa.pickup_time && <span style={{fontSize:11.5,color:T.ink2}}><span style={{color:T.ink4}}>Pickup:</span> {fmtDT(pa.pickup_time)}</span>}
                    </div>
                    {(pa.collected_at||pa.delivered_at) && (
                      <div style={{marginTop:6,display:"flex",gap:10,flexWrap:"wrap"}}>
                        {pa.collected_at && <span style={{fontSize:11,color:T.blue,fontWeight:600}}>✓ Collected {fmtDT(pa.collected_at)}</span>}
                        {pa.delivered_at && <span style={{fontSize:11,color:T.green,fontWeight:600}}>✓ Delivered {fmtDT(pa.delivered_at)}</span>}
                      </div>
                    )}
                    {pa.notes && <div style={{marginTop:6,fontSize:11.5,color:T.ink3,fontStyle:"italic"}}>{pa.notes}</div>}
                  </div>
                );
              })}
            </div>
      )}
    </div>
  );
}

// ─── SiteVisitsTab ────────────────────────────────────────────────────────────
function SiteVisitsTab({ visits = [] }) {
  if (!visits.length) return <EmptyState icon="🏢" message="No site visits assigned to this staff member" />;
  const statusCfg = {
    pending:     { bg: T.amberL,  text: T.amberD, border: "#FDE68A", label: "Pending"     },
    in_progress: { bg: T.blueL,   text: T.blue,   border: "#BFDBFE", label: "In Progress" },
    completed:   { bg: T.greenL,  text: T.green,  border: "#86EFAC", label: "Completed"   },
    cancelled:   { bg: "#FEF2F2", text: T.red,    border: "#FECACA", label: "Cancelled"   },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visits.map((v, i) => {
        const sc = statusCfg[v.status] ?? { bg: T.bg2, text: T.ink3, border: T.border, label: v.status || "—" };
        return (
          <div key={v._id ?? i} style={{ background: T.bg2, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.ink, fontFamily: "'DM Sans',sans-serif" }}>{v.visit_no}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
              </div>
              <span style={{ fontSize: 11, color: T.ink4, flexShrink: 0 }}>{fmtDate(v.visit_date)}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{v.customer_name || "—"}</div>
            {(v.city || v.address_line1) && (
              <div style={{ fontSize: 11.5, color: T.ink3 }}>📍 {[v.address_line1, v.city].filter(Boolean).join(", ")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── StaffDetailModal ─────────────────────────────────────────────────────
function StaffDetailModal({ open, staff, onClose, push, isSuperAdmin, onChanged }) {
  const [tab,        setTab]        = useState("overview");
  const [details,    setDetails]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [logMsg,     setLogMsg]     = useState("");
  const [jobRef,     setJobRef]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightbox,   setLightbox]   = useState(null);
  const [forcingLogout, setForcingLogout] = useState(false);

  useEffect(()=>{
    if (!open||!staff) return;
    setTab("overview"); setDetails(null); setLogMsg(""); setJobRef(""); setLoading(true);
    api.getStaffDetails(staff._id)
      .then(res=>{
        const d = res?.data ?? res;
        setDetails({
          staff:               d.staff               ?? staff,
          sessions:            d.sessions            ?? [],
          taskLogs:            d.taskLogs            ?? [],
          jobAssignments:      d.jobAssignments      ?? [],
          jobTimeSummary:      d.jobTimeSummary      ?? {},
          assignedSiteVisits:  d.assignedSiteVisits  ?? [],
          pendingPickups:      d.pendingPickups       ?? [],
          completedPickups:    d.completedPickups     ?? [],
          issuedMaterials:     d.issuedMaterials      ?? [],
          assignedTasks:       d.assignedTasks        ?? [],
          allTaskAssignments:  d.allTaskAssignments   ?? {},
        });
      })
      .catch(err=>{
        push(err?.response?.data?.message??"Failed to load details","error");
        setDetails({ staff, sessions:[], taskLogs:[], jobAssignments:[], jobTimeSummary:{}, assignedSiteVisits:[], pendingPickups:[], completedPickups:[], issuedMaterials:[], assignedTasks:[], allTaskAssignments:{} });
      })
      .finally(()=>setLoading(false));
  },[open,staff?._id]);

  const handleDeleteLog = async (logId) => {
    try { await api.deleteTaskLog(logId); setDetails(d=>({...d,taskLogs:d.taskLogs.filter(l=>l._id!==logId)})); push("Log deleted"); }
    catch(err) { push(err?.response?.data?.message??"Delete failed","error"); }
  };

  // Super admin closes out a session for a staff member who "didn't log out
  // correctly" (forgot to log out, crashed tab, left it open overnight…).
  const handleForceLogout = async () => {
    if (!staff?._id || forcingLogout) return;
    if (!window.confirm(`Log out ${staff.name} now? Their active session will be closed immediately.`)) return;
    try {
      setForcingLogout(true);
      await api.forceLogout(staff._id);
      push(`${staff.name} has been logged out.`);
      setDetails(d => d ? {
        ...d,
        sessions: d.sessions.map(s => s.logout_at ? s : { ...s, logout_at: new Date().toISOString() }),
      } : d);
      onChanged?.();
    } catch (err) {
      push(err?.response?.data?.message ?? "Failed to force logout", "error");
    } finally {
      setForcingLogout(false);
    }
  };

  const handleSubmitLog = async () => {
    if (!logMsg.trim()) return;
    try {
      setSubmitting(true);
      const now=new Date();
      const hour_label=now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
      const res=await api.submitTaskLog({staffId:staff._id,message:logMsg.trim(),job_ref:jobRef.trim()||undefined,hour_label});
      const newLog=res?.data??{_id:Date.now(),message:logMsg.trim(),job_ref:jobRef.trim()||"",hour_label,submitted_at:now};
      setDetails(d=>({...d,taskLogs:[newLog,...(d?.taskLogs??[])]}));
      setLogMsg(""); setJobRef(""); push("Log added");
    } catch(err) { push(err?.response?.data?.message??"Failed to submit","error"); }
    finally { setSubmitting(false); }
  };

  if (!open||!staff) return null;

  const sessions            = details?.sessions            ?? [];
  const taskLogs            = details?.taskLogs            ?? [];
  const jobTimeSummary      = details?.jobTimeSummary      ?? {};
  const assignedSiteVisits  = details?.assignedSiteVisits  ?? [];
  const pendingPickups      = details?.pendingPickups       ?? [];
  const completedPickups    = details?.completedPickups     ?? [];
  const issuedMaterials     = details?.issuedMaterials      ?? [];
  const assignedTasks       = details?.assignedTasks        ?? [];
  const allTaskAssignments  = details?.allTaskAssignments   ?? {};
  const staffInfo           = details?.staff               ?? staff;

  // Compute totals from actual session data
  // Only count sessions with real duration (logout_at set) or live-compute open ones
  const totalAllSecs  = sessions.reduce((a,s)=>{
    if (s.logout_at) return a + (s.duration_seconds??0);
    return a + Math.floor((Date.now()-new Date(s.login_at).getTime())/1000);
  }, 0);

  // The most recent open session with a selfie — or just most recent open
  const currentSession = sessions.find(s=>!s.logout_at) ?? null;
  // Best selfie: current session first, otherwise most recent with one
  const selfieSession  = sessions.find(s=>s.selfie_url) ?? null;

  const pickupTotal = pendingPickups.length + completedPickups.length;

  const TABS = [
    {key:"overview",  label:"Overview"},
    {key:"sessions",  label:`Sessions (${sessions.length})`},
    {key:"jobtime",   label:`Jobs${jobTimeSummary.jobCount>0?` (${jobTimeSummary.jobCount})`:""}`},
    {key:"materials", label:`Materials${(issuedMaterials.length+pickupTotal)>0?` (${issuedMaterials.length+pickupTotal})`:""}`},
    {key:"tasks",     label:`Tasks${assignedTasks.length>0?` (${assignedTasks.length})`:""}`},
    {key:"logs",      label:`Logs${taskLogs.length>0?` (${taskLogs.length})`:""}`},
  ];

  return (
    <>
      <SelfieLightbox src={lightbox} onClose={()=>setLightbox(null)} />
      <div
        style={{position:"fixed",inset:0,zIndex:600,background:"rgba(12,17,29,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .18s ease"}}
        onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      >
        <div style={{background:T.surface,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:700,maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 -16px 60px rgba(0,0,0,.14)",animation:"sheetUp .28s cubic-bezier(.32,.72,0,1)"}}>

          {/* Drag handle */}
          <div style={{display:"flex",justifyContent:"center",paddingTop:10,flexShrink:0}}>
            <div style={{width:42,height:4,borderRadius:99,background:T.border}} />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{padding:"10px 18px 0",display:"flex",alignItems:"center",gap:13,flexShrink:0}}>
            <Avatar name={staffInfo.name} src={staffInfo.profileImg} size={52} online={staffInfo.isOnline} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:17,color:T.ink,letterSpacing:-.3,fontFamily:"'DM Sans',sans-serif"}}>{staffInfo.name}</div>
              <div style={{fontSize:11.5,color:T.ink4,marginTop:1}}>{staffInfo.email}{staffInfo.phone ? ` · ${staffInfo.phone}` : ""}</div>
              <div style={{marginTop:5,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <RoleBadge role={staffInfo.role} />
                {staffInfo.isOnline
                  ? <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color:T.green}}><span className="live-dot" style={{background:T.green}} />Online</span>
                  : <span style={{fontSize:11,fontWeight:600,color:T.ink4}}>● Offline</span>
                }
                {staffInfo.available===false && <span style={{fontSize:10.5,fontWeight:600,color:"#9D174D",background:"#FDF2F8",borderRadius:6,padding:"2px 7px",border:"1px solid #FBCFE8"}}>Unavailable</span>}
                {jobTimeSummary.activeJobCount>0 && (
                  <span style={{fontSize:10.5,fontWeight:700,color:T.amberD,background:T.amberL,borderRadius:6,padding:"2px 7px",border:`1px solid #FDE68A`}}>
                    🔨 {jobTimeSummary.activeJobCount} active job{jobTimeSummary.activeJobCount!==1?"s":""}
                  </span>
                )}
              </div>
            </div>
            {/* Best selfie thumbnail in header */}
            {selfieSession?.selfie_url && (
              <SelfieThumb url={selfieSession.selfie_url} onOpen={setLightbox} title={`Latest selfie · ${fmtT(selfieSession.login_at)}`} />
            )}
            <button onClick={onClose} style={{width:34,height:34,borderRadius:"50%",border:"none",background:T.bg2,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:T.ink3,flexShrink:0}}>×</button>
          </div>

          {/* ── Active session banner ────────────────────────────────── */}
          {currentSession && (
            <div style={{margin:"10px 18px 0",background:T.amberL,borderRadius:10,padding:"9px 13px",border:`1px solid #FDE68A`,display:"flex",alignItems:"flex-start",gap:9,flexShrink:0}}>
              <SelfieThumb url={currentSession.selfie_url} onOpen={setLightbox} title="Current session selfie" />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}}>
                  <span style={{fontSize:11,fontWeight:700,color:T.amberD,display:"flex",alignItems:"center",gap:5}}>
                    <span className="live-dot" /> Active since {fmtT(currentSession.login_at)}
                  </span>
                  <IpChip ip={currentSession.login_ip} />
                  <LiveTimer loginAt={currentSession.login_at} />
                </div>
                {currentSession.location?.latitude!=null
                  ? <LocationLine location={currentSession.location} compact />
                  : currentSession.location?.formatted_address
                    ? <span style={{fontSize:11,color:T.ink3}}>📍 {currentSession.location.formatted_address}</span>
                    : <span style={{fontSize:11,color:T.ink4}}>No location data</span>
                }
                {/* After-7-PM permission status, if any */}
                {currentSession.permission?.status && currentSession.permission.status!=="none" && (
                  <div style={{marginTop:6}}>
                    {currentSession.permission.status==="pending" && (
                      <span style={{fontSize:10.5,fontWeight:700,color:T.amberD,background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:6,padding:"2px 8px"}}>
                        ⏳ Asked to work late — waiting on your approval
                      </span>
                    )}
                    {currentSession.permission.status==="approved" && (
                      <span style={{fontSize:10.5,fontWeight:700,color:T.green,background:T.greenL,border:"1px solid #86EFAC",borderRadius:6,padding:"2px 8px"}}>
                        ✓ Approved to work until {fmtT(currentSession.permission.permitted_until)}
                      </span>
                    )}
                    {currentSession.permission.status==="rejected" && (
                      <span style={{fontSize:10.5,fontWeight:700,color:T.red,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:6,padding:"2px 8px"}}>
                        ✕ Late-work request declined
                      </span>
                    )}
                  </div>
                )}
              </div>
              {isSuperAdmin && (
                <button
                  onClick={handleForceLogout}
                  disabled={forcingLogout}
                  title="Force this staff member to log out now"
                  style={{
                    flexShrink:0, fontSize:11, fontWeight:700, color:forcingLogout?T.ink4:T.red,
                    background:forcingLogout?T.bg2:"#FEF2F2", border:`1px solid ${forcingLogout?T.border:"#FECACA"}`,
                    borderRadius:8, padding:"6px 10px", cursor:forcingLogout?"not-allowed":"pointer",
                    display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
                  }}
                >
                  {forcingLogout ? "…" : "⏻ Force logout"}
                </button>
              )}
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <div style={{display:"flex",gap:5,padding:"12px 18px 0",overflowX:"auto",scrollbarWidth:"none",flexShrink:0,borderBottom:`1px solid ${T.border}`,paddingBottom:0}}>
            {TABS.map(({key,label})=>(
              <button key={key} onClick={()=>setTab(key)} style={{
                padding:"8px 14px",borderRadius:"8px 8px 0 0",border:`1px solid ${T.border}`,borderBottom:"none",
                fontSize:12,fontWeight:tab===key?700:500,cursor:"pointer",whiteSpace:"nowrap",
                background:tab===key?T.surface:T.bg2,
                color:tab===key?T.amberD:T.ink3,
                marginBottom:tab===key?-1:0,
                borderBottomColor:tab===key?T.surface:"transparent",
                fontFamily:"'Inter',sans-serif",
                transition:"all .12s",
              }}>{label}</button>
            ))}
          </div>

          {/* ── Body ─────────────────────────────────────────────────── */}
          <div style={{overflowY:"auto",flex:1,padding:"18px 18px 32px"}}>

            {loading && <div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:60}}><Spinner /></div>}

            {/* ── OVERVIEW ── */}
            {!loading && tab==="overview" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>

                {/* 4 stat tiles */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <StatTile label="Login Time Today" value={fmtD(totalAllSecs)}           color={T.amber}  bg={T.amberL} icon="⏱" />
                  <StatTile label="Sessions Today"   value={sessions.filter(s=>s.date===new Date().toISOString().slice(0,10)).length||sessions.length} color={T.blue}   bg={T.blueL}  icon="🔄" />
                  <StatTile label="Jobs Worked"      value={jobTimeSummary.jobCount??0}   color={T.ink2}   bg={T.bg2}    icon="🗂" />
                  <StatTile label="Task Logs"        value={taskLogs.length}              color={T.violet} bg={T.violetL} icon="📝" />
                </div>

                {/* Assignments summary */}
                {(Object.keys(allTaskAssignments).length > 0) && (
                  <div style={{background:T.bg2,borderRadius:12,padding:"13px 15px",border:`1px solid ${T.border}`}}>
                    <SectionHeader icon="📋" label="All Assignments" color={T.ink3} />
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                      {[
                        {label:"Jobs",             value:allTaskAssignments.totalJobs??0,          color:T.ink2},
                        {label:"Active Jobs",      value:allTaskAssignments.activeJobs??0,         color:T.green},
                        {label:"Site Visits",      value:allTaskAssignments.totalSiteVisits??0,    color:T.blue},
                        {label:"Pending Pickups",  value:allTaskAssignments.pendingPickups??0,     color:"#B45309"},
                        {label:"Done Pickups",     value:allTaskAssignments.completedPickups??0,   color:T.green},
                        {label:"Materials Issued", value:allTaskAssignments.issuedMaterials??0,    color:T.amber},
                      ].map(({label,value,color})=>(
                        <div key={label} style={{background:T.surface,borderRadius:8,padding:"9px 10px",border:`1px solid ${T.border}`,textAlign:"center"}}>
                          <div style={{fontWeight:800,fontSize:18,color,lineHeight:1,fontFamily:"'DM Sans',sans-serif"}}>{value}</div>
                          <div style={{fontSize:9.5,color:T.ink4,fontWeight:600,marginTop:3,textTransform:"uppercase",letterSpacing:.3}}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Job time summary */}
                {(jobTimeSummary.totalSeconds??0) > 0 && (
                  <div style={{background:T.amberL,borderRadius:12,padding:"13px 15px",border:`1px solid #FDE68A`}}>
                    <SectionHeader icon="⏱" label="Job Time" color={T.amberD} />
                    <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:22,fontWeight:900,color:T.amber,fontFamily:"'DM Sans',sans-serif"}}>{jobTimeSummary.totalDisplay}</div>
                        <div style={{fontSize:10,color:T.ink4,fontWeight:600}}>TOTAL HOURS</div>
                      </div>
                      <div>
                        <div style={{fontSize:22,fontWeight:900,color:jobTimeSummary.activeJobCount>0?T.green:T.ink4,fontFamily:"'DM Sans',sans-serif"}}>{jobTimeSummary.activeJobCount}</div>
                        <div style={{fontSize:10,color:T.ink4,fontWeight:600}}>ACTIVE NOW</div>
                      </div>
                    </div>
                    <button onClick={()=>setTab("jobtime")} style={{marginTop:9,fontSize:12,color:T.amberD,fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0}}>View job breakdown →</button>
                  </div>
                )}

                {/* Assigned tasks summary */}
                {assignedTasks.length > 0 && (
                  <div style={{background:T.bg2,borderRadius:12,padding:"13px 15px",border:`1px solid ${T.border}`}}>
                    <SectionHeader icon="🗂" label="Assigned Tasks" color={T.ink3} />
                    <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:20,fontWeight:900,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>{assignedTasks.length}</div>
                        <div style={{fontSize:10,color:T.ink4,fontWeight:600}}>TOTAL</div>
                      </div>
                      <div>
                        <div style={{fontSize:20,fontWeight:900,color:T.green,fontFamily:"'DM Sans',sans-serif"}}>{assignedTasks.filter(t=>t.status==="in_progress").length}</div>
                        <div style={{fontSize:10,color:T.ink4,fontWeight:600}}>ACTIVE NOW</div>
                      </div>
                    </div>
                    <button onClick={()=>setTab("tasks")} style={{marginTop:9,fontSize:12,color:T.violet,fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0}}>View assigned tasks →</button>
                  </div>
                )}

                {/* Recent sessions */}
                {sessions.length > 0 && (
                  <div style={{background:T.bg2,borderRadius:12,padding:"13px 15px",border:`1px solid ${T.border}`}}>
                    <SectionHeader icon="🗓" label="Recent Sessions" color={T.ink3} />
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {sessions.slice(0,3).map((s,i)=>(
                        <div key={s._id??i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:9,background:s.logout_at?T.surface:T.amberL,border:`1px solid ${s.logout_at?T.border:"#FDE68A"}`}}>
                          <SelfieThumb url={s.selfie_url} onOpen={setLightbox} title={`Selfie · ${fmtT(s.login_at)}`} />
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:T.ink}}>
                              {fmtT(s.login_at)} — {s.logout_at?fmtT(s.logout_at):<span style={{color:T.amberD}}>Active</span>}
                            </div>
                            <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                              <IpChip ip={s.login_ip} />
                              {s.location?.formatted_address && !s.location?.latitude && (
                                <span style={{fontSize:10,color:T.ink3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>📍 {s.location.formatted_address}</span>
                              )}
                              {s.location?.latitude!=null && (
                                <LocationLine location={s.location} compact />
                              )}
                            </div>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:s.logout_at?T.ink3:T.amberD,flexShrink:0}}>
                            {s.logout_at ? fmtD(s.duration_seconds) : <LiveTimer loginAt={s.login_at} />}
                          </span>
                        </div>
                      ))}
                    </div>
                    {sessions.length>3 && (
                      <button onClick={()=>setTab("sessions")} style={{marginTop:9,fontSize:12,color:T.blue,fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0}}>
                        View all {sessions.length} sessions →
                      </button>
                    )}
                  </div>
                )}

                {/* Site visits summary */}
                {assignedSiteVisits.length > 0 && (
                  <div style={{background:T.blueL,borderRadius:12,padding:"13px 15px",border:`1px solid #BFDBFE`}}>
                    <SectionHeader icon="🏢" label="Site Visits" color={T.blue} count={assignedSiteVisits.length} />
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {assignedSiteVisits.slice(0,3).map((v,i)=>(
                        <div key={v._id??i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:T.ink}}>{v.visit_no} · {v.customer_name||"—"}</div>
                            <div style={{fontSize:11,color:T.ink4,marginTop:2}}>{v.city||v.address_line1||""} · {fmtDate(v.visit_date)}</div>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,
                            background:v.status==="completed"?"#F0FDF4":T.blueL,
                            color:v.status==="completed"?T.green:T.blue,
                            border:`1px solid ${v.status==="completed"?"#86EFAC":"#BFDBFE"}`,flexShrink:0}}>{v.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Materials summary */}
                {(issuedMaterials.length + pickupTotal) > 0 && (
                  <div style={{background:"#FEF3E2",borderRadius:12,padding:"13px 15px",border:`1px solid #FDE68A`}}>
                    <SectionHeader icon="📦" label="Materials & Pickups" color="#B45309" />
                    <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                      {issuedMaterials.length>0 && <span style={{fontSize:12,color:T.ink2}}><strong style={{color:T.amber}}>{issuedMaterials.length}</strong> material{issuedMaterials.length!==1?"s":""} issued</span>}
                      {pendingPickups.length>0 && <span style={{fontSize:12,color:T.ink2}}><strong style={{color:"#B45309"}}>{pendingPickups.length}</strong> pending pickup{pendingPickups.length!==1?"s":""}</span>}
                      {completedPickups.length>0 && <span style={{fontSize:12,color:T.ink2}}><strong style={{color:T.green}}>{completedPickups.length}</strong> completed pickup{completedPickups.length!==1?"s":""}</span>}
                    </div>
                    <button onClick={()=>setTab("materials")} style={{marginTop:9,fontSize:12,color:"#B45309",fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0}}>View materials & pickups →</button>
                  </div>
                )}

                {/* Recent task logs */}
                {taskLogs.length > 0 && (
                  <div>
                    <SectionHeader icon="📝" label="Recent Task Logs" color={T.violet} count={taskLogs.length} />
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {taskLogs.slice(0,3).map((l,i)=>(
                        <div key={l._id??i} style={{background:T.violetL,borderRadius:9,padding:"9px 12px",border:"1px solid #EDE9FE"}}>
                          <div style={{display:"flex",gap:5,marginBottom:4,flexWrap:"wrap"}}>
                            <span style={{fontSize:10.5,fontWeight:700,color:T.violet,background:"#EDE9FE",borderRadius:5,padding:"2px 7px"}}>{l.hour_label||fmtT(l.submitted_at)}</span>
                            {l.job_ref && <span style={{fontSize:10.5,fontWeight:700,color:T.blue,background:T.blueL,borderRadius:5,padding:"2px 7px"}}>#{l.job_ref}</span>}
                            <span style={{fontSize:10,color:T.ink4,marginLeft:"auto"}}>{fmtDate(l.submitted_at)}</span>
                          </div>
                          <p style={{fontSize:12.5,color:T.ink2,lineHeight:1.5}}>{l.message}</p>
                        </div>
                      ))}
                      {taskLogs.length>3 && <button onClick={()=>setTab("logs")} style={{fontSize:12,color:T.violet,fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0}}>View all {taskLogs.length} logs →</button>}
                    </div>
                  </div>
                )}

                {/* Add log (super admin) */}
                {isSuperAdmin && (
                  <div style={{background:T.bg2,borderRadius:12,padding:14,border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Add Log Entry</div>
                    <input value={jobRef} onChange={e=>setJobRef(e.target.value)} placeholder="Job # (optional)" className="field-inp" style={{marginBottom:8}} />
                    <textarea value={logMsg} onChange={e=>setLogMsg(e.target.value)} placeholder="Describe the task update…" rows={3} className="field-inp" style={{resize:"vertical"}} />
                    <button onClick={handleSubmitLog} disabled={!logMsg.trim()||submitting} className="btn-primary" style={{marginTop:8}}>
                      {submitting?"Saving…":"Add Log"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SESSIONS ── */}
            {!loading && tab==="sessions" && (
              <SessionTimeline sessions={sessions} onOpenSelfie={setLightbox} />
            )}

            {/* ── JOB TIME ── */}
            {!loading && tab==="jobtime" && (
              <JobTimeTab staffId={staffInfo._id} push={push} />
            )}

            {/* ── MATERIALS ── */}
            {!loading && tab==="materials" && (
              <MaterialsTab
                issuedMaterials={issuedMaterials}
                pendingPickups={pendingPickups}
                completedPickups={completedPickups}
                allTaskAssignments={allTaskAssignments}
              />
            )}

            {/* ── ASSIGNED TASKS ── */}
            {!loading && tab==="tasks" && (
              <AssignedTasksTab
                staffId={staffInfo._id}
                initialTasks={assignedTasks}
                isSuperAdmin={isSuperAdmin}
                push={push}
              />
            )}

            {/* ── TASK LOGS ── */}
            {!loading && tab==="logs" && (
              <div>
                {!isSuperAdmin && (
                  <div style={{marginBottom:16,background:T.bg2,borderRadius:12,padding:14,border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.ink3,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Submit Hourly Update</div>
                    <input value={jobRef} onChange={e=>setJobRef(e.target.value)} placeholder="Job # (optional)" className="field-inp" style={{marginBottom:8}} />
                    <textarea value={logMsg} onChange={e=>setLogMsg(e.target.value)} placeholder="What are you working on?" rows={2} className="field-inp" style={{resize:"vertical"}} />
                    <button onClick={handleSubmitLog} disabled={!logMsg.trim()||submitting} className="btn-primary" style={{marginTop:8}}>
                      {submitting?"Saving…":"Submit Update"}
                    </button>
                  </div>
                )}
                {taskLogs.length===0
                  ? <EmptyState icon="📝" message="No task logs yet" />
                  : <TaskLogTimeline logs={taskLogs} onDelete={handleDeleteLog} isSuperAdmin={isSuperAdmin} />
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PermissionRequestsPanel ────────────────────────────────────────────────
// Queue of staff asking to keep working past the 7 PM auto-logout cutoff.
// Super admin approves (choosing how long) or declines each request.
function PermissionRequestsPanel({ open, requests, loading, onClose, onRespond, push }) {
  const [busyId, setBusyId] = useState(null);
  const [customTime, setCustomTime] = useState({}); // { [staffId]: "HH:mm" }

  if (!open) return null;

  const approveWithMinutes = async (staffId, minutesFromNow) => {
    const until = new Date(Date.now() + minutesFromNow * 60000);
    await respond(staffId, "approved", until.toISOString());
  };

  const approveWithCustomTime = async (staffId) => {
    const t = customTime[staffId];
    if (!t) { push("Pick a time first", "error"); return; }
    const [h, m] = t.split(":").map(Number);
    const until = new Date();
    until.setHours(h, m, 0, 0);
    if (until <= new Date()) until.setDate(until.getDate() + 1);
    await respond(staffId, "approved", until.toISOString());
  };

  const respond = async (staffId, status, permitted_until) => {
    try {
      setBusyId(staffId);
      await onRespond(staffId, status, permitted_until);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:650,background:"rgba(12,17,29,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .18s ease"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:T.surface,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:600,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 -16px 60px rgba(0,0,0,.14)",animation:"sheetUp .28s cubic-bezier(.32,.72,0,1)"}}>
        <div style={{display:"flex",justifyContent:"center",paddingTop:10,flexShrink:0}}>
          <div style={{width:42,height:4,borderRadius:99,background:T.border}} />
        </div>
        <div style={{padding:"12px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:16,color:T.ink,fontFamily:"'DM Sans',sans-serif"}}>🌙 Late-work requests</div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",border:"none",background:T.bg2,cursor:"pointer",fontSize:17,color:T.ink3}}>×</button>
        </div>
        <div style={{padding:"12px 18px 24px",overflowY:"auto"}}>
          {loading && <div style={{textAlign:"center",padding:"30px 0"}}><Spinner /></div>}
          {!loading && requests.length===0 && (
            <div style={{textAlign:"center",padding:"36px 12px",color:T.ink4,fontSize:13}}>
              No pending requests right now.
            </div>
          )}
          {!loading && requests.map(r => {
            const staffInfo = r.staff_id || {};
            const busy = busyId === staffInfo._id;
            return (
              <div key={r._id} style={{border:`1px solid ${T.border}`,borderRadius:12,padding:12,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                  <Avatar name={staffInfo.name} src={staffInfo.profileImg} size={34} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13.5,color:T.ink}}>{staffInfo.name}</div>
                    <div style={{fontSize:11,color:T.ink4}}>{staffInfo.role}</div>
                  </div>
                  <span style={{fontSize:10.5,color:T.ink4}}>Asked at {fmtT(r.permission?.requested_at)}</span>
                </div>
                <div style={{fontSize:12.5,color:T.ink2,background:T.bg2,borderRadius:8,padding:"8px 10px",marginBottom:9,border:`1px solid ${T.border}`}}>
                  {r.permission?.reason || "No reason given."}
                  {r.permission?.requested_until && (
                    <div style={{fontSize:11,color:T.ink4,marginTop:4}}>Requested until ~{fmtT(r.permission.requested_until)}</div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {[["+1h",60],["+2h",120],["+3h",180]].map(([label,mins])=>(
                    <button key={label} disabled={busy} onClick={()=>approveWithMinutes(staffInfo._id, mins)}
                      style={{fontSize:11.5,fontWeight:700,padding:"6px 10px",borderRadius:8,border:"1px solid #86EFAC",background:T.greenL,color:T.green,cursor:busy?"not-allowed":"pointer"}}>
                      ✓ {label}
                    </button>
                  ))}
                  <input type="time" value={customTime[staffInfo._id]||""} onChange={e=>setCustomTime(c=>({...c,[staffInfo._id]:e.target.value}))}
                    style={{fontSize:11.5,padding:"5px 7px",borderRadius:8,border:`1px solid ${T.border}`}} />
                  <button disabled={busy} onClick={()=>approveWithCustomTime(staffInfo._id)}
                    style={{fontSize:11.5,fontWeight:700,padding:"6px 10px",borderRadius:8,border:"1px solid #86EFAC",background:T.greenL,color:T.green,cursor:busy?"not-allowed":"pointer"}}>
                    ✓ Until
                  </button>
                  <button disabled={busy} onClick={()=>respond(staffInfo._id, "rejected", null)}
                    style={{fontSize:11.5,fontWeight:700,padding:"6px 10px",borderRadius:8,border:"1px solid #FECACA",background:"#FEF2F2",color:T.red,cursor:busy?"not-allowed":"pointer",marginLeft:"auto"}}>
                    ✕ Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── StaffMonitorPage ─────────────────────────────────────────────────────
export default function StaffMonitorPage() {
  const [staffList,     setStaffList]     = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [lightbox,      setLightbox]      = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetId, setAssignTargetId]   = useState(null); // staff pre-selected via card button
  const [pendingPermissions, setPendingPermissions] = useState([]);
  const [permLoading, setPermLoading] = useState(false);
  const [showPermPanel, setShowPermPanel] = useState(false);
  const { toasts, push } = useToast();
  const pollRef = useRef(null);
  const permPollRef = useRef(null);
  const isSuperAdmin = true;

  const fetchList = useCallback(async (silent=false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const res  = await api.getMonitorList();
      const list = res?.data??res??[];
      setStaffList(Array.isArray(list)?list:[]);
    } catch(err) { push(err?.response?.data?.message??"Failed to load staff","error"); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  const fetchPendingPermissions = useCallback(async (silent=false) => {
    try {
      if (!silent) setPermLoading(true);
      const res = await api.getPendingPermissions();
      const list = res?.data ?? res ?? [];
      setPendingPermissions(Array.isArray(list) ? list : []);
    } catch (err) {
      if (!silent) push(err?.response?.data?.message ?? "Failed to load permission requests", "error");
    } finally {
      setPermLoading(false);
    }
  }, []);

  const handleRespondPermission = async (staffId, status, permitted_until) => {
    try {
      await api.respondPermission(staffId, status, permitted_until);
      push(status === "approved" ? "Permission approved" : "Permission declined");
      fetchPendingPermissions(true);
      fetchList(true);
    } catch (err) {
      push(err?.response?.data?.message ?? "Failed to respond", "error");
    }
  };

  useEffect(()=>{ fetchList(false); pollRef.current=setInterval(()=>fetchList(true),30000); return()=>clearInterval(pollRef.current); },[fetchList]);
  useEffect(()=>{ fetchPendingPermissions(false); permPollRef.current=setInterval(()=>fetchPendingPermissions(true),30000); return()=>clearInterval(permPollRef.current); },[fetchPendingPermissions]);

  const openAssignModal = (staff) => { setAssignTargetId(staff?._id ?? null); setShowAssignModal(true); };
  const closeAssignModal = () => { setShowAssignModal(false); setAssignTargetId(null); };

  const filtered = staffList.filter(s=>{
    const q=search.toLowerCase();
    return (!q||s.name?.toLowerCase().includes(q)||s.email?.toLowerCase().includes(q)||s.role?.toLowerCase().includes(q))
      && (!statusFilter||(statusFilter==="online"?s.isOnline:!s.isOnline));
  });

  const onlineCount    = staffList.filter(s=>s.isOnline).length;
  const totalTodaySecs = staffList.reduce((a,s)=>a+(s.todaySeconds??0),0);
  const activeJobs     = staffList.reduce((a,s)=>a+(s.jobStats?.activeJobs??0),0);
  const activeTasks    = staffList.reduce((a,s)=>a+(s.assignedTaskStats?.active??0),0);
  const pendingResumes = staffList.reduce((a,s)=>a+(s.assignedTaskStats?.resumeRequested??0),0);

  return (
    <div style={{background:T.bg,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{CSS}</style>
      <SelfieLightbox src={lightbox} onClose={()=>setLightbox(null)} />
      <AssignTaskModal
        open={showAssignModal}
        staffList={staffList}
        preselectedStaffId={assignTargetId}
        onClose={closeAssignModal}
        push={push}
        onAssigned={()=>fetchList(true)}
      />
      <PermissionRequestsPanel
        open={showPermPanel}
        requests={pendingPermissions}
        loading={permLoading}
        onClose={()=>setShowPermPanel(false)}
        onRespond={handleRespondPermission}
        push={push}
      />

      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,boxShadow:"0 1px 6px rgba(0,0,0,.04)"}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px"}}>

          {/* Top bar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0 12px",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:34,height:34,borderRadius:9,background:T.amberL,border:`1.5px solid #FDE68A`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>📡</div>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:T.ink,letterSpacing:-.4,fontFamily:"'DM Sans',sans-serif",lineHeight:1.1}}>Staff Monitor</div>
                  <div style={{fontSize:11,color:T.ink4,marginTop:1,display:"flex",alignItems:"center",gap:6}}>
                    Live · auto-refresh 30s
                    {refreshing && <span style={{color:T.amber,fontWeight:600}}>· updating…</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary chips + actions */}
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}} className="hide-sm">
              {[
                {label:`${staffList.length} total`,  color:T.ink3},
                {label:`${onlineCount} online`,       color:T.green},
                {label:`${activeJobs} active jobs`,   color:T.amber},
                {label:`${activeTasks} active tasks`, color:T.violet},
                ...(pendingResumes>0 ? [{label:`${pendingResumes} resume requests`, color:T.violet}] : []),
                {label:fmtD(totalTodaySecs)+" today", color:T.blue},
              ].map(({label,color})=>(
                <span key={label} style={{fontSize:11.5,fontWeight:600,color,background:T.bg2,borderRadius:7,padding:"5px 10px",border:`1px solid ${T.border}`}}>{label}</span>
              ))}
              {pendingPermissions.length>0 && (
                <button onClick={()=>setShowPermPanel(true)} style={{padding:"7px 14px",borderRadius:9,border:"1px solid #FDE68A",background:"#FFFBEB",color:T.amberD,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  🌙 {pendingPermissions.length} late-work request{pendingPermissions.length!==1?"s":""}
                </button>
              )}
              {isSuperAdmin && (
                <button onClick={()=>openAssignModal(null)} style={{padding:"7px 14px",borderRadius:9,border:`1px solid #FDE68A`,background:T.amberL,color:T.amberD,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  🗂 Assign Task
                </button>
              )}
              <button onClick={()=>fetchList(false)} disabled={loading} style={{padding:"7px 14px",borderRadius:9,border:`1px solid ${T.border}`,background:T.bg2,color:loading?T.ink4:T.ink2,fontWeight:600,fontSize:12,cursor:loading?"not-allowed":"pointer"}}>
                {loading?"…":"↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Search + filter row */}
          <div style={{display:"flex",gap:8,paddingBottom:12,flexWrap:"wrap"}}>
            <div style={{position:"relative",flex:1,minWidth:200}}>
              <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13,pointerEvents:"none",color:T.ink4}}>🔍</span>
              <input className="search-inp" placeholder="Search name, email, role…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <div style={{display:"flex",gap:6}}>
              {[["","All"],["online","🟢 Online"],["offline","⚫ Offline"]].map(([val,label])=>(
                <button key={val} onClick={()=>setStatusFilter(val)} className={`filter-btn${statusFilter===val?" active":""}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1280,margin:"0 auto",padding:"16px 16px 56px"}}>
        {loading && !staffList.length && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:14}}>
            <Spinner size={36} />
            <div style={{fontSize:13,color:T.ink4,fontWeight:500}}>Loading staff activity…</div>
          </div>
        )}

        {!loading && filtered.length===0 && staffList.length===0 && (
          <div style={{background:T.surface,borderRadius:T.r2,padding:"64px 24px",textAlign:"center",border:`1px dashed ${T.border}`}}>
            <div style={{fontSize:44,marginBottom:14}}>📡</div>
            <div style={{fontWeight:700,fontSize:17,color:T.ink,marginBottom:7,fontFamily:"'DM Sans',sans-serif"}}>No staff found</div>
            <div style={{fontSize:13,color:T.ink4}}>Staff appear here once they log in</div>
          </div>
        )}

        {!loading && filtered.length===0 && staffList.length>0 && (
          <div style={{background:T.surface,borderRadius:T.r2,padding:"48px 24px",textAlign:"center",border:`1px dashed ${T.border}`}}>
            <div style={{fontSize:36,marginBottom:10}}>🔍</div>
            <div style={{fontWeight:700,fontSize:15,color:T.ink,marginBottom:5,fontFamily:"'DM Sans',sans-serif"}}>No matches</div>
            <div style={{fontSize:13,color:T.ink4}}>Try adjusting the search or filter</div>
          </div>
        )}

        {/* Online */}
        {filtered.some(s=>s.isOnline) && (
          <div style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
              <span className="live-dot" />
              <span style={{fontWeight:700,fontSize:13,color:T.amberD,fontFamily:"'DM Sans',sans-serif"}}>Online Now</span>
              <span style={{fontSize:11,color:T.ink4}}>{filtered.filter(s=>s.isOnline).length} member{filtered.filter(s=>s.isOnline).length!==1?"s":""}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(296px,1fr))",gap:11}}>
              {filtered.filter(s=>s.isOnline).map(s=>(
                <MonitorCard key={s._id} staff={s} onClick={()=>setSelectedStaff(s)} onOpenSelfie={setLightbox} onAssignTask={openAssignModal} />
              ))}
            </div>
          </div>
        )}

        {/* Offline */}
        {filtered.some(s=>!s.isOnline) && statusFilter!=="online" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#D1D5DB",display:"inline-block"}} />
              <span style={{fontWeight:700,fontSize:13,color:T.ink3,fontFamily:"'DM Sans',sans-serif"}}>Offline</span>
              <span style={{fontSize:11,color:T.ink4}}>{filtered.filter(s=>!s.isOnline).length} member{filtered.filter(s=>!s.isOnline).length!==1?"s":""}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(296px,1fr))",gap:11}}>
              {filtered.filter(s=>!s.isOnline).map(s=>(
                <MonitorCard key={s._id} staff={s} onClick={()=>setSelectedStaff(s)} onOpenSelfie={setLightbox} onAssignTask={openAssignModal} />
              ))}
            </div>
          </div>
        )}

        {staffList.length>0 && (
          <div style={{textAlign:"center",fontSize:11,color:T.border2,marginTop:24,fontWeight:500}}>
            {filtered.length} of {staffList.length} staff shown
          </div>
        )}
      </div>

      <StaffDetailModal open={!!selectedStaff} staff={selectedStaff} onClose={()=>setSelectedStaff(null)} push={push} isSuperAdmin={isSuperAdmin} onChanged={()=>fetchList(true)} />
      <Toast toasts={toasts} />
    </div>
  );
}