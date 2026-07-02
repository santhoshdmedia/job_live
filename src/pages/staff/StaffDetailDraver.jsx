/* eslint-disable react-hooks/exhaustive-deps */
/**
 * StaffAdminPanel.jsx
 * Full staff management page for super admin:
 *  - Staff list with roles/status
 *  - Individual staff monitor: login time, jobs, materials, break/lunch, OT
 *  - Create / edit / toggle availability
 *  - Attendance export to Excel (in-time / out-time / break / OT)
 */

import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import * as XLSX from "xlsx";
import { smApi } from "../../api/staffmonitor.api";
import { admintoken } from "../../helper/notification_helper";

// ─── Axios for staff CRUD ─────────────────────────────────────────────────────
const staffHttp = axios.create({ baseURL: "https://api.dmedia.in/api", timeout: 12000 });
staffHttp.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(admintoken);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  ink: "#0C111D", ink2: "#374151", ink3: "#6B7280", ink4: "#9CA3AF",
  border: "#E5E7EB", surface: "#FFFFFF", bg: "#F4F5F7", bg2: "#F9FAFB",
  primary: "#2563EB", primaryL: "#EFF6FF",
  amber: "#E8840A", amberL: "#FEF3E2", amberM: "#FDE68A", amberD: "#B45309",
  green: "#16A34A", greenL: "#F0FDF4", greenD: "#15803D",
  red: "#DC2626", redL: "#FEF2F2",
  violet: "#7C3AED", violetL: "#F5F3FF",
  r: "10px", r2: "14px",
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmtD  = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const fmtDL = (s) => { const v = Math.max(0, Math.floor(s || 0)); return [Math.floor(v / 3600), Math.floor((v % 3600) / 60), v % 60].map(n => String(n).padStart(2, "0")).join(":"); };
const fmtT  = (d) => { if (!d) return "—"; return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); };
const fmtDate = (d) => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
const STANDARD = 10 * 3600;

const avatarColor = (name = "") => {
  const pal = [C.amber, "#0891B2", "#7C3AED", "#DB2777", "#059669", "#2563EB"];
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return pal[Math.abs(h) % pal.length];
};

const ROLE_COLORS = {
  "super admin":     { bg: "#111827", text: "#F9FAFB" },
  "admin":           { bg: C.violetL, text: C.violet },
  "accounting team": { bg: C.greenL,  text: C.green },
  "designing team":  { bg: "#FDF2F8", text: "#9D174D" },
  "quality check":   { bg: C.amberL,  text: C.amberD },
  "production team": { bg: "#ECFEFF", text: "#164E63" },
  "packing team":    { bg: C.greenL,  text: "#14532D" },
  "delivery team":   { bg: C.redL,    text: "#991B1B" },
  "store manager":   { bg: "#FEF9C3", text: "#713F12" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sheetRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  .staff-card { background:${C.surface}; border:1px solid ${C.border}; border-radius:${C.r2}; cursor:pointer; transition:box-shadow .18s, border-color .18s, transform .16s; overflow:hidden; }
  .staff-card:hover { box-shadow:0 4px 20px rgba(0,0,0,.08); border-color:#D1D5DB; transform:translateY(-2px); }
  .inp { width:100%; border:1px solid ${C.border}; border-radius:${C.r}; padding:9px 12px; font-size:13px; color:${C.ink}; background:${C.surface}; font-family:inherit; outline:none; transition:border-color .14s, box-shadow .14s; }
  .inp:focus { border-color:${C.primary}; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
  .btn-primary { padding:10px 18px; border-radius:${C.r}; border:none; font-weight:700; font-size:13px; cursor:pointer; background:${C.primary}; color:#fff; font-family:inherit; transition:background .14s; }
  .btn-primary:hover:not(:disabled) { background:#1D4ED8; }
  .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
  .btn-ghost { padding:8px 14px; border-radius:${C.r}; border:1px solid ${C.border}; font-weight:600; font-size:12px; cursor:pointer; background:${C.surface}; color:${C.ink3}; font-family:inherit; transition:all .13s; white-space:nowrap; }
  .btn-ghost:hover:not(:disabled) { background:${C.bg2}; color:${C.ink2}; }
  .btn-ghost:disabled { opacity:.5; cursor:not-allowed; }
  .btn-export { padding:8px 14px; border-radius:${C.r}; border:1px solid #BBF7D0; font-weight:700; font-size:12px; cursor:pointer; background:${C.greenL}; color:${C.greenD}; font-family:inherit; transition:all .13s; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .btn-export:hover:not(:disabled) { background:#DCFCE7; border-color:#86EFAC; }
  .btn-export:disabled { opacity:.5; cursor:not-allowed; }
  .tab { padding:7px 14px; border-radius:8px; border:none; font-weight:600; font-size:12px; cursor:pointer; background:transparent; color:${C.ink4}; font-family:inherit; transition:all .14s; }
  .tab.active { background:${C.primaryL}; color:${C.primary}; }
  .tab:not(.active):hover { background:${C.bg2}; color:${C.ink2}; }
  ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#D1D5DB; border-radius:99px; }
  .live-dot { width:7px; height:7px; border-radius:50%; background:${C.green}; display:inline-block; animation:pulse 1.6s infinite; }
  .break-dot { width:7px; height:7px; border-radius:50%; background:${C.amber}; display:inline-block; animation:pulse 1.2s infinite; }
`;

// ─── Components ───────────────────────────────────────────────────────────────

function Spinner({ size = 28 }) {
  return <div style={{ width: size, height: size, border: `2.5px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin .7s linear infinite" }} />;
}

function Avatar({ name = "?", src, size = 40, online, onBreak: isOnBreak }) {
  const color = src ? "transparent" : avatarColor(name);
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * .38, fontWeight: 800, color: "#fff", overflow: "hidden" }}>
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name.trim()[0] || "?").toUpperCase()}
      </div>
      {online !== undefined && (
        <div style={{ position: "absolute", bottom: 1, right: 1, width: size * .26, height: size * .26, borderRadius: "50%", border: "2px solid #fff", background: isOnBreak ? C.amber : online ? C.green : "#D1D5DB" }} />
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role?.toLowerCase?.()] ?? { bg: C.bg2, text: C.ink3 };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {role}
    </span>
  );
}

function StatBox({ label, value, color, bg }) {
  return (
    <div style={{ background: bg || C.bg2, borderRadius: C.r, padding: "10px 12px", border: `1px solid ${color}22`, textAlign: "center" }}>
      <div style={{ fontWeight: 900, fontSize: 18, color, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.ink4, fontWeight: 600, marginTop: 3, textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
    </div>
  );
}

// ─── Staff Detail Drawer ──────────────────────────────────────────────────────
function StaffDetailDrawer({ staff, onClose }) {
  const [tab,      setTab]     = useState("overview");
  const [details,  setDetails] = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    if (!staff) return;
    setLoading(true);
    smApi.getStaffDetails(staff._id)
      .then(res => setDetails(res?.data?.data ?? res?.data ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [staff?._id]);

  if (!staff) return null;

  const sessions  = details?.sessions ?? [];
  const taskLogs  = details?.taskLogs ?? [];
  const jobAssign = details?.jobAssignments ?? [];
  const attSum    = details?.attendanceSummary ?? {};
  const jobSum    = details?.jobTimeSummary ?? {};

  // Today's sessions
  const todayStr  = new Date().toISOString().slice(0, 10);
  const todaySess = sessions.filter(s => s.date === todayStr);
  const todaySecs = todaySess.reduce((a, s) => {
    if (s.logout_at) return a + (s.duration_seconds || 0);
    return a + Math.floor((Date.now() - new Date(s.login_at)) / 1000);
  }, 0);
  const breakSecsToday = todaySess.reduce((a, s) => a + (s.break_seconds || 0), 0);
  const workSecsToday  = Math.max(0, todaySecs - breakSecsToday);
  const otSecsToday    = Math.max(0, workSecsToday - STANDARD);

  const isOnline   = staff.isOnline;
  const isOnBreak  = staff.onBreak;
  const breakType  = staff.breakType;

  const TABS = [
    { key: "overview",  label: "Overview" },
    { key: "sessions",  label: `Sessions (${sessions.length})` },
    { key: "jobs",      label: `Jobs (${jobAssign.length})` },
    { key: "logs",      label: `Logs (${taskLogs.length})` },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", background: "rgba(0,0,0,.5)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ marginLeft: "auto", width: "min(520px, 100vw)", height: "100vh", background: C.surface, display: "flex", flexDirection: "column", animation: "sheetRight .28s cubic-bezier(.32,.72,0,1)", boxShadow: "-8px 0 32px rgba(0,0,0,.12)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Avatar name={staff.name} src={staff.profileImg} size={48} online={isOnline} onBreak={isOnBreak} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.ink, fontFamily: "'DM Sans',sans-serif" }}>{staff.name}</div>
            <div style={{ fontSize: 11.5, color: C.ink4 }}>{staff.email}</div>
            <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <RoleBadge role={staff.role} />
              {isOnline && !isOnBreak && <span style={{ fontSize: 11, fontWeight: 600, color: C.green, display: "flex", alignItems: "center", gap: 4 }}><span className="live-dot" />Online</span>}
              {isOnBreak && <span style={{ fontSize: 11, fontWeight: 600, color: C.amberD, display: "flex", alignItems: "center", gap: 4 }}><span className="break-dot" />{breakType === "lunch" ? "🍽 Lunch" : "☕ Break"}</span>}
              {!isOnline && !isOnBreak && <span style={{ fontSize: 11, fontWeight: 600, color: C.ink4 }}>Offline</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.bg2, cursor: "pointer", fontSize: 18, color: C.ink3 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: "auto" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px" }}>
          {loading && <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner /></div>}

          {/* Overview */}
          {!loading && tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <StatBox label="Worked Today" value={fmtD(workSecsToday)}  color={C.primary} bg={C.primaryL} />
                <StatBox label="Break Today"  value={fmtD(breakSecsToday)} color={C.amberD}  bg={C.amberL} />
                <StatBox label="OT Today"     value={otSecsToday > 0 ? fmtD(otSecsToday) : "—"} color={otSecsToday > 0 ? "#EA580C" : C.ink4} bg={otSecsToday > 0 ? "#FFF7ED" : C.bg2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <StatBox label="Total OT"     value={attSum.overtimeDisplay || "—"}  color="#EA580C" bg="#FFF7ED" />
                <StatBox label="Job Hours"    value={jobSum.totalDisplay || "—"}      color={C.primary} bg={C.primaryL} />
              </div>

              {/* Today sessions summary */}
              {todaySess.length > 0 && (
                <div style={{ background: C.bg2, borderRadius: C.r2, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: C.ink3, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Today's Activity</div>
                  {todaySess.map((s, i) => {
                    const dur = s.logout_at ? s.duration_seconds : Math.floor((Date.now() - new Date(s.login_at)) / 1000);
                    const brk = s.break_seconds || 0;
                    const work = Math.max(0, dur - brk);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < todaySess.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                            {fmtT(s.login_at)} — {s.logout_at ? fmtT(s.logout_at) : <span style={{ color: C.green }}>Active</span>}
                          </div>
                          <div style={{ fontSize: 11, color: C.ink4, marginTop: 2 }}>
                            Work: {fmtD(work)} · Break: {fmtD(brk)}{s.overtime_seconds > 0 ? ` · OT: ${fmtD(s.overtime_seconds)}` : ""}
                          </div>
                          {/* Break breakdown */}
                          {(s.breaks || []).length > 0 && (
                            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {s.breaks.map((b, bi) => (
                                <span key={bi} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: b.type === "lunch" ? "#FEF9C3" : C.redL, color: b.type === "lunch" ? "#713F12" : C.red }}>
                                  {b.type === "lunch" ? "🍽" : "☕"} {b.end ? fmtD(b.duration_seconds) : "ongoing"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {!s.logout_at && <span className="live-dot" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sessions */}
          {!loading && tab === "sessions" && (
            sessions.length === 0
              ? <div style={{ textAlign: "center", padding: "48px 0", color: C.ink4 }}>No sessions yet</div>
              : sessions.map((s, i) => (
                <div key={i} style={{ borderRadius: C.r, border: `1px solid ${s.logout_at ? C.border : C.green + "44"}`, background: s.logout_at ? C.surface : C.greenL, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: C.ink }}>
                      {fmtT(s.login_at)} — {s.logout_at ? fmtT(s.logout_at) : <span style={{ color: C.green }}>Active</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{fmtD(s.duration_seconds || 0)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.ink3 }}>
                    Date: {fmtDate(s.login_at)} · Break: {fmtD(s.break_seconds || 0)} · Work: {fmtD(s.working_seconds || 0)}
                    {s.overtime_seconds > 0 ? ` · OT: ${fmtD(s.overtime_seconds)}` : ""}
                  </div>
                  {(s.breaks || []).length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {s.breaks.map((b, bi) => (
                        <span key={bi} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: b.type === "lunch" ? "#FEF9C3" : "#FEE2E2", color: b.type === "lunch" ? "#713F12" : C.red }}>
                          {b.type === "lunch" ? "🍽" : "☕"} {fmtT(b.start)} → {b.end ? fmtT(b.end) : "…"} ({fmtD(b.duration_seconds)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}

          {/* Jobs */}
          {!loading && tab === "jobs" && (
            jobAssign.length === 0
              ? <div style={{ textAlign: "center", padding: "48px 0", color: C.ink4 }}>No jobs assigned</div>
              : jobAssign.map((j, i) => (
                <div key={i} style={{ borderRadius: C.r, border: `1px solid ${j.isCurrentlyActive ? C.amberM : C.border}`, background: j.isCurrentlyActive ? C.amberL : C.surface, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: C.ink, fontFamily: "'DM Sans',sans-serif" }}>{j.job_no}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: j.isCurrentlyActive ? C.amberD : C.ink3 }}>{j.totalDisplay}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.ink3 }}>{j.customer_name} · {j.job_status}</div>
                  {j.isCurrentlyActive && <div style={{ marginTop: 4, fontSize: 11, color: C.amberD, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><span className="break-dot" style={{ background: C.amber }} />Currently working</div>}
                </div>
              ))
          )}

          {/* Logs */}
          {!loading && tab === "logs" && (
            taskLogs.length === 0
              ? <div style={{ textAlign: "center", padding: "48px 0", color: C.ink4 }}>No task logs</div>
              : taskLogs.map((l, i) => (
                <div key={i} style={{ background: C.violetL, borderRadius: C.r, padding: "10px 12px", marginBottom: 8, border: "1px solid #EDE9FE" }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.violet, background: "#EDE9FE", borderRadius: 5, padding: "2px 7px" }}>{l.hour_label || fmtT(l.submitted_at)}</span>
                    {l.job_ref && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.primary, background: C.primaryL, borderRadius: 5, padding: "2px 7px" }}>#{l.job_ref}</span>}
                    <span style={{ fontSize: 10, color: C.ink4, marginLeft: "auto" }}>{fmtDate(l.submitted_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>{l.message}</p>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────
function StaffCard({ staff, onClick }) {
  const isOnline  = staff.isOnline;
  const isOnBreak = staff.onBreak;
  const ot        = staff.overtimeSecondsToday || 0;
  const work      = staff.workingSecondsToday  || 0;
  const breakSec  = staff.breakSecondsToday    || 0;
  const workPct   = Math.min(100, Math.round((work / STANDARD) * 100));

  return (
    <div className="staff-card" onClick={onClick} style={{ borderLeft: `4px solid ${isOnBreak ? C.amber : isOnline ? C.green : C.border}` }}>
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <Avatar name={staff.name} src={staff.profileImg} size={44} online={isOnline} onBreak={isOnBreak} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif" }}>{staff.name}</div>
            <div style={{ fontSize: 11, color: C.ink4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staff.email}</div>
            <div style={{ marginTop: 4 }}><RoleBadge role={staff.role} /></div>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            {isOnBreak && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amberD, background: C.amberL, borderRadius: 6, padding: "2px 8px", display: "block", marginBottom: 3 }}>
                {staff.breakType === "lunch" ? "🍽 Lunch" : "☕ Break"}
              </span>
            )}
            {isOnline && !isOnBreak && <span className="live-dot" />}
            {!isOnline && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D1D5DB", display: "inline-block" }} />}
          </div>
        </div>

        {/* Work progress bar */}
        <div style={{ height: 4, background: C.bg2, borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${workPct}%`, background: ot > 0 ? "#F97316" : isOnline ? `linear-gradient(90deg,${C.green},#4ADE80)` : C.primary, borderRadius: 99, transition: "width .4s" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "Worked",  value: fmtD(work),    color: C.primary },
            { label: "Break",   value: fmtD(breakSec), color: C.amberD },
            { label: "OT",      value: ot > 0 ? fmtD(ot) : "—", color: ot > 0 ? "#EA580C" : C.ink4 },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center", background: C.bg2, borderRadius: 7, padding: "7px 4px", border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 800, fontSize: 14, color, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>{value}</div>
              <div style={{ fontSize: 9, color: C.ink4, fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.ink4 }}>
            {staff.todaySessions || 0} session{staff.todaySessions !== 1 ? "s" : ""} · {staff.taskLogsToday || 0} logs
          </span>
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>Details →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 7, pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 340 }}>
      {toasts.map(t => {
        const bg = { error: C.red, warn: "#D97706", success: C.green }[t.type] ?? C.green;
        return <div key={t.id} style={{ background: bg, color: "#fff", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(0,0,0,.18)", animation: "fadeUp .24s ease" }}>{t.message}</div>;
      })}
    </div>
  );
}

// ─── Monthly Attendance Excel export ───────────────────────────────────────────
// One row per staff member for the selected month:
//   Name, In Time, Out Time, Total Time Worked, Break Taken,
//   Total Working Days, Present, Leave, Total OT Hours
// Pulls from GET /monitor/attendance-summary — see the backend add-on file
// (monthly-attendance-summary.addon.js) for the aggregation this expects.
function buildMonthlyAttendanceRows(staffRows) {
  return staffRows.map((s, i) => ({
    "S.No": i + 1,
    "Name": s.name || "",
    "Role": s.role || "",
    "In Time": s.avgInTime || "—",
    "Out Time": s.avgOutTime || "—",
    "Total Time Worked": fmtD(s.totalWorkingSeconds || 0),
    "Break Taken": fmtD(s.totalBreakSeconds || 0),
    "Total Working Days": s.workingDaysInMonth ?? "—",
    "Present": s.presentDays ?? 0,
    "Leave": s.leaveDays ?? 0,
    "Total OT Hours": fmtD(s.totalOvertimeSeconds || 0),
  }));
}

async function exportMonthlyAttendanceToExcel({ monthValue, smApi, pushToast }) {
  // monthValue comes from an <input type="month"> → "YYYY-MM"
  const [yearStr, monthStr] = (monthValue || "").split("-");
  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!year || !month) {
    pushToast?.("Pick a month first", "warn");
    return;
  }

  const res  = await smApi.getMonthlyAttendanceSummary({ month, year });
  const data = res?.data?.data ?? res?.data ?? res;
  const staffRows = data?.staff ?? [];

  if (!staffRows.length) {
    pushToast?.("No attendance data for that month", "warn");
    return;
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const rows = buildMonthlyAttendanceRows(staffRows);
  const cols = ["S.No", "Name", "Role", "In Time", "Out Time", "Total Time Worked", "Break Taken", "Total Working Days", "Present", "Leave", "Total OT Hours"];

  // Title + subtitle rows so the sheet reads like a proper monthly register.
  const aoa = [
    [`Monthly Attendance Report — ${monthLabel}`],
    [`Working days this month: ${data?.workingDaysInMonth ?? "—"}`],
    [],
    cols,
    ...rows.map((r) => cols.map((c) => r[c])),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols.length - 1 } },
  ];
  ws["!cols"] = [
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 11 }, { wch: 11 },
    { wch: 17 }, { wch: 12 }, { wch: 16 }, { wch: 9 }, { wch: 8 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Monthly Attendance");
  XLSX.writeFile(wb, `monthly-attendance-${yearStr}-${monthStr}.xlsx`);

  pushToast?.(`Exported ${rows.length} staff record${rows.length !== 1 ? "s" : ""} for ${monthLabel}`, "success");
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffAdminPanel() {
  const { user } = useSelector(s => s.authSlice);

  const [staffList,      setStaffList]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [exporting,      setExporting]      = useState(false);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("");
  const [selectedStaff,  setSelectedStaff]  = useState(null);
  const [toasts,         setToasts]         = useState([]);

  const pushToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  const fetchStaff = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const res  = await smApi.getMonitorList();
      const list = res?.data?.data ?? res?.data ?? [];
      setStaffList(Array.isArray(list) ? list : []);
    } catch (err) {
      pushToast(err?.response?.data?.message || "Failed to load staff", "error");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchStaff(); const id = setInterval(() => fetchStaff(true), 30000); return () => clearInterval(id); }, [fetchStaff]);

  const filtered = staffList.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.role?.toLowerCase().includes(q);
    const matchF = !statusFilter || (statusFilter === "online" ? s.isOnline : statusFilter === "break" ? s.onBreak : !s.isOnline && !s.onBreak);
    return matchQ && matchF;
  });

  const onlineCount  = staffList.filter(s => s.isOnline && !s.onBreak).length;
  const breakCount   = staffList.filter(s => s.onBreak).length;
  const offlineCount = staffList.filter(s => !s.isOnline).length;
  const totalOT      = staffList.reduce((a, s) => a + (s.overtimeSecondsToday || 0), 0);
  const totalWork    = staffList.reduce((a, s) => a + (s.workingSecondsToday || 0), 0);

  const handleExport = () => {
    setExporting(true);
    try {
      // Exports whatever is currently visible (search + status filter applied)
      // so "Export Excel" matches what the admin is actually looking at.
      exportAttendanceToExcel(filtered, pushToast);
    } catch (err) {
      console.error("[exportAttendance]", err);
      pushToast("Export failed — please try again", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{  background: C.bg, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{CSS}</style>
      <Toast toasts={toasts} />

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 12px", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.ink, fontFamily: "'DM Sans',sans-serif" }}>👥 Staff Management</div>
              <div style={{ fontSize: 11, color: C.ink4, marginTop: 1 }}>
                Real-time attendance · Break tracking · OT monitoring
                {refreshing && <span style={{ color: C.primary, marginLeft: 8 }}>· Updating…</span>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { label: `${onlineCount} online`,     color: C.green },
                { label: `${breakCount} on break`,    color: C.amberD },
                { label: `${offlineCount} offline`,   color: C.ink4 },
                { label: `${fmtD(totalWork)} worked`, color: C.primary },
                totalOT > 0 ? { label: `OT: ${fmtD(totalOT)}`, color: "#EA580C" } : null,
              ].filter(Boolean).map(({ label, color }) => (
                <span key={label} style={{ fontSize: 11.5, fontWeight: 600, color, background: C.bg2, borderRadius: 7, padding: "4px 10px", border: `1px solid ${C.border}` }}>{label}</span>
              ))}
              <button
                onClick={handleExport}
                disabled={exporting || loading || !filtered.length}
                className="btn-export"
                title="Download an attendance-style spreadsheet (in time, out time, break, OT) for the staff currently shown"
              >
                {exporting ? "…" : "⬇"} Export Excel
              </button>
              <button onClick={() => fetchStaff()} disabled={loading} className="btn-ghost">
                {loading ? "…" : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Search + filters */}
          <div style={{ display: "flex", gap: 8, paddingBottom: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.ink4, pointerEvents: "none" }}>🔍</span>
              <input className="inp" style={{ paddingLeft: 34 }} placeholder="Search name, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["", "All"], ["online", "🟢 Online"], ["break", "☕ Break"], ["offline", "⚫ Offline"]].map(([val, label]) => (
                <button key={val} onClick={() => setStatusFilter(val)} className={`btn-ghost${statusFilter === val ? " !border-blue-400 !text-blue-600 !bg-blue-50" : ""}`} style={{ fontSize: 11.5 }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 16px 56px" }}>

        {loading && !staffList.length && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 12 }}>
            <Spinner size={36} /><div style={{ fontSize: 13, color: C.ink4 }}>Loading staff activity…</div>
          </div>
        )}

        {/* Group: Online */}
        {filtered.some(s => s.isOnline && !s.onBreak) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span className="live-dot" />
              <span style={{ fontWeight: 700, fontSize: 13, color: C.green, fontFamily: "'DM Sans',sans-serif" }}>Working Now</span>
              <span style={{ fontSize: 11, color: C.ink4 }}>{filtered.filter(s => s.isOnline && !s.onBreak).length} staff</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
              {filtered.filter(s => s.isOnline && !s.onBreak).map(s => (
                <StaffCard key={s._id} staff={s} onClick={() => setSelectedStaff(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Group: On Break */}
        {filtered.some(s => s.onBreak) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span className="break-dot" />
              <span style={{ fontWeight: 700, fontSize: 13, color: C.amberD, fontFamily: "'DM Sans',sans-serif" }}>On Break</span>
              <span style={{ fontSize: 11, color: C.ink4 }}>{filtered.filter(s => s.onBreak).length} staff</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
              {filtered.filter(s => s.onBreak).map(s => (
                <StaffCard key={s._id} staff={s} onClick={() => setSelectedStaff(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Group: Offline */}
        {filtered.some(s => !s.isOnline && !s.onBreak) && statusFilter !== "online" && statusFilter !== "break" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#D1D5DB", display: "inline-block" }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: C.ink3, fontFamily: "'DM Sans',sans-serif" }}>Offline</span>
              <span style={{ fontSize: 11, color: C.ink4 }}>{filtered.filter(s => !s.isOnline && !s.onBreak).length} staff</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
              {filtered.filter(s => !s.isOnline && !s.onBreak).map(s => (
                <StaffCard key={s._id} staff={s} onClick={() => setSelectedStaff(s)} />
              ))}
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ background: C.surface, borderRadius: C.r2, padding: "64px 24px", textAlign: "center", border: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>No staff found</div>
            <div style={{ fontSize: 13, color: C.ink4 }}>Try adjusting search or filter</div>
          </div>
        )}
      </div>

      {/* Staff Detail Drawer */}
      {selectedStaff && (
        <StaffDetailDrawer staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
      )}
    </div>
  );
}