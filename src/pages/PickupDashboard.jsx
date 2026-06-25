import { useState, useEffect, useCallback, useRef } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "https://api.dmedia.in/api";

// ─── Auth (replace with your actual Redux selector / context) ────────────────
// import { useSelector } from "react-redux";
// const currentUser = useSelector(s => s.auth.user);
// For demo — swap with real auth:
const useCurrentUser = () => ({
  _id: "675be0febb62992beaa0b1c0",
  name: "Danyi",
  role: "super admin", // "super admin" | "admin" | anything else
});

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isAdminRole = (role = "") =>
  ["super admin", "admin"].includes(role.toLowerCase().trim());

// ─── Constants ────────────────────────────────────────────────────────────────
const DELIVERY_OPTIONS = [
  { id: "dmedia_office", label: "DMedia Office",     icon: "🏢", sub: "Main office reception"  },
  { id: "factory",       label: "Factory",           icon: "🏭", sub: "Production floor"        },
  { id: "customer",      label: "Customer Delivery", icon: "🚀", sub: "Direct to customer site" },
];

const TYPE_META = {
  cutting:    { icon: "✂️",  label: "Cutting",    color: "#7c3aed", bg: "#f5f3ff", ring: "#ddd6fe" },
  lamination: { icon: "🗂️", label: "Lamination", color: "#0284c7", bg: "#f0f9ff", ring: "#bae6fd" },
  printing:   { icon: "🖨️", label: "Printing",   color: "#be123c", bg: "#fff1f2", ring: "#fecdd3" },
  finishing:  { icon: "🔧", label: "Finishing",   color: "#c2410c", bg: "#fff7ed", ring: "#fed7aa" },
};

const STATUS_META = {
  issued:         { label: "Issued",         ring: "#f59e0b", bg: "#fffbeb", text: "#92400e" },
  returned:       { label: "Returned",       ring: "#22c55e", bg: "#f0fdf4", text: "#14532d" },
  partial_return: { label: "Partial Return", ring: "#3b82f6", bg: "#eff6ff", text: "#1e3a5f" },
  no_return:      { label: "No Return",      ring: "#ef4444", bg: "#fef2f2", text: "#7f1d1d" },
};

const PICKUP_STATUS_META = {
  pending:   { label: "Pending",   color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  collected: { label: "Collected", color: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
  delivered: { label: "Delivered", color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }) +
  " " + new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const countdown = (isoStr) => {
  const diff = new Date(isoStr) - Date.now();
  if (diff <= 0) return { label: "Overdue", past: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { label: h > 0 ? `${h}h ${m}m` : `${m}m`, past: false };
};

const apiCall = async (url, options = {}) => {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);
  return data;
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f0f2f5; color: #0f172a; }
  input, select, textarea, button { font-family: inherit; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }

  /* ── Animations ── */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
  @keyframes scaleIn  { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
  @keyframes spin     { to   { transform: rotate(360deg) } }
  @keyframes pulse    { 0%,100% { opacity:1 } 50% { opacity:.5 } }
  @keyframes toastIn  { from { opacity:0; transform:translate(-50%,20px) } to { opacity:1; transform:translate(-50%,0) } }
  @keyframes shimmer  { from { background-position: -200% 0 } to { background-position: 200% 0 } }

  .fade-up  { animation: fadeUp .22s ease both; }
  .scale-in { animation: scaleIn .2s cubic-bezier(.34,1.4,.64,1) both; }

  /* ── Cards ── */
  .issue-card {
    background: #fff;
    border: 1px solid #e8edf3;
    border-radius: 16px;
    transition: box-shadow .2s, transform .2s, border-color .2s;
    position: relative;
    overflow: hidden;
  }
  .issue-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--card-accent, #e2e8f0);
    border-radius: 16px 16px 0 0;
  }
  .issue-card:hover {
    box-shadow: 0 10px 40px rgba(0,0,0,.1);
    transform: translateY(-3px);
    border-color: #c7d2fe;
  }

  /* ── Buttons ── */
  .btn-primary {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #fff; border: none; cursor: pointer;
    border-radius: 10px; font-weight: 700;
    transition: all .15s;
    box-shadow: 0 2px 8px rgba(79,70,229,.25);
  }
  .btn-primary:hover  { background: linear-gradient(135deg,#4338ca,#4f46e5); box-shadow: 0 4px 16px rgba(79,70,229,.4); transform: translateY(-1px); }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { background: #a5b4fc; box-shadow: none; cursor: not-allowed; transform: none; }

  .btn-ghost {
    background: transparent; border: 1.5px solid #e2e8f0;
    color: #64748b; cursor: pointer; border-radius: 10px;
    font-weight: 600; transition: all .15s;
  }
  .btn-ghost:hover { border-color: #94a3b8; background: #f8fafc; color: #334155; }

  .btn-sm-action {
    border: none; cursor: pointer; border-radius: 8px;
    font-size: 11px; font-weight: 700; padding: 6px 10px;
    transition: all .15s; white-space: nowrap;
  }

  /* ── Inputs ── */
  .opm-input {
    border: 1.5px solid #e2e8f0; background: #fff; color: #1e293b;
    outline: none; transition: border .15s, box-shadow .15s;
    border-radius: 10px;
  }
  .opm-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
  .opm-input.err   { border-color: #f87171; background: #fff8f8; }

  .opm-select {
    border: 1.5px solid #e2e8f0; background: #fff;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    appearance: none; padding-right: 32px; color: #1e293b;
    outline: none; transition: border .15s, box-shadow .15s; border-radius: 10px;
  }
  .opm-select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
  .opm-select.err  { border-color: #f87171; }

  /* ── Destination buttons ── */
  .dest-btn {
    background: #fafbfc; border: 1.5px solid #e2e8f0;
    cursor: pointer; transition: all .15s; border-radius: 12px; text-align: center;
  }
  .dest-btn:hover  { border-color: #c7d2fe; background: #fafaff; }
  .dest-btn.active { border-color: #6366f1; background: #eef2ff; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

  /* ── Filter pills ── */
  .filter-pill {
    border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer;
    transition: all .15s; white-space: nowrap; border-radius: 99px;
    font-size: 12px; font-weight: 600; padding: 5px 14px; color: #64748b;
  }
  .filter-pill:hover  { border-color: #94a3b8; color: #334155; background: #f8fafc; }
  .filter-pill.active { background: #4f46e5; border-color: #4f46e5; color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,.3); }

  /* ── Tab strip ── */
  .tab-btn {
    background: none; border: none; cursor: pointer;
    padding: 10px 16px; font-size: 13px; font-weight: 600;
    color: #94a3b8; border-bottom: 2px solid transparent;
    transition: all .15s; white-space: nowrap; line-height: 1;
  }
  .tab-btn.active         { color: #4f46e5; border-bottom-color: #4f46e5; }
  .tab-btn:hover:not(.active) { color: #64748b; }

  /* ── Role badge ── */
  .role-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 99px;
    font-size: 11px; font-weight: 700;
  }

  /* ── Skeleton ── */
  .skeleton {
    background: linear-gradient(90deg, #f1f5f9 25%, #e8eef4 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 8px;
  }

  /* ── Toast ── */
  .toast-wrap { animation: toastIn .25s cubic-bezier(.34,1.4,.64,1) both; }

  /* ── Status progress dots ── */
  .status-track { display: flex; align-items: center; gap: 0; }
  .status-node  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .status-line  { height: 2px; flex: 1; }

  /* ── My-task chip ── */
  .my-task-chip {
    position: absolute; top: 14px; right: 14px;
    background: linear-gradient(135deg,#4f46e5,#7c3aed);
    color: #fff; font-size: 9px; font-weight: 800;
    padding: 3px 8px; border-radius: 99px; letter-spacing: .06em;
    text-transform: uppercase;
  }
`;

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 20, color = "#6366f1" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ animation: "spin .8s linear infinite", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity=".2" />
    <path d="M12 2a10 10 0 0110 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-wrap" style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 400, display: "flex", alignItems: "center", gap: 10,
      padding: "12px 22px", borderRadius: 14,
      background: toast.ok ? "#0f172a" : "#dc2626",
      color: "#fff", fontSize: 13, fontWeight: 600,
      boxShadow: "0 12px 40px rgba(0,0,0,.25)", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 16 }}>{toast.ok ? "✓" : "✕"}</span>
      {toast.msg}
    </div>
  );
}

// ─── Label / FieldErr ─────────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>
    {children}{required && <span style={{ color: "#f87171", marginLeft: 2 }}>*</span>}
  </div>
);
const FieldErr = ({ msg }) => msg
  ? <div style={{ marginTop: 4, fontSize: 11.5, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
      <span>⚠</span>{msg}
    </div>
  : null;

// ─── Pickup Status Tracker ────────────────────────────────────────────────────
function StatusTrack({ status }) {
  const steps = ["pending", "collected", "delivered"];
  const cancelled = status === "cancelled";
  const idx = cancelled ? -1 : steps.indexOf(status);

  if (cancelled) return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
      Cancelled
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {steps.map((step, i) => {
        const done    = i < idx;
        const current = i === idx;
        const future  = i > idx;
        const color   = done || current ? PICKUP_STATUS_META[step].dot : "#e2e8f0";
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div title={PICKUP_STATUS_META[step].label} style={{
              width: current ? 10 : 8, height: current ? 10 : 8, borderRadius: "50%",
              background: color, transition: "all .2s",
              boxShadow: current ? `0 0 0 3px ${color}40` : "none",
            }} />
            {i < steps.length - 1 && (
              <div style={{ width: 18, height: 2, background: done ? color : "#e2e8f0", borderRadius: 99 }} />
            )}
          </div>
        );
      })}
      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: PICKUP_STATUS_META[status]?.color || "#64748b" }}>
        {PICKUP_STATUS_META[status]?.label}
      </span>
    </div>
  );
}

// ─── Assign / Re-assign Modal ─────────────────────────────────────────────────
function AssignModal({ issue, admins, onClose, onSaved, onError }) {
  const existing = issue.pickup_assignment;
  const [userId,     setUserId]   = useState(
    existing?.assigned_to?.user_id?._id || existing?.assigned_to?.user_id || ""
  );
  const [deliveryTo, setDelivery] = useState(existing?.delivery_to || "");
  const [pickupTime, setTime]     = useState(
    existing?.pickup_time ? new Date(existing.pickup_time).toISOString().slice(0, 16) : ""
  );
  const [notes,  setNotes]  = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isReassign = !!existing;
  const minDT      = new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const typeMeta   = TYPE_META[issue.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc" };
  const dest       = DELIVERY_OPTIONS.find(d => d.id === deliveryTo);

  const validate = () => {
    const e = {};
    if (!userId)     e.userId     = "Select a pickup person.";
    if (!deliveryTo) e.deliveryTo = "Choose a delivery destination.";
    if (!pickupTime) e.pickupTime = "Set a pickup time.";
    else if (new Date(pickupTime) <= new Date()) e.pickupTime = "Must be a future time.";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const admin = admins.find(a => a._id === userId);
      const data  = await apiCall(`/material/${issue._id}/assign-pickup`, {
        method: "POST",
        body: JSON.stringify({
          assigned_to: { user_id: userId, name: admin?.name || "", role: admin?.role || "" },
          delivery_to: deliveryTo,
          pickup_time: pickupTime,
          notes: notes.trim(),
        }),
      });
      onSaved(data.data || data);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, background: "rgba(15,23,42,.7)", backdropFilter: "blur(8px)",
    }}>
      <div className="scale-in" style={{
        width: "100%", maxWidth: 500, background: "#fff", borderRadius: 24,
        boxShadow: "0 40px 100px rgba(0,0,0,.22)", overflow: "hidden",
      }}>

        {/* ── Header strip ── */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: typeMeta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
            }}>{typeMeta.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
                {isReassign ? "Re-assign Pickup" : "Assign Pickup"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#f8fafc" }}>{issue.issue_no}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                {issue.job_no} · <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{issue.cart_item_name}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#ffffff18", border: "none", cursor: "pointer",
            padding: 8, borderRadius: 10, color: "#94a3b8", lineHeight: 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Vendor pill ── */}
        <div style={{ padding: "14px 24px 0" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 99, padding: "5px 12px", fontSize: 12, color: "#475569",
          }}>
            🏭 <strong style={{ color: "#334155" }}>{issue.outsource_vendor || issue.issued_to?.name || "—"}</strong>
            <span style={{
              padding: "2px 8px", background: typeMeta.bg, borderRadius: 99,
              color: typeMeta.color, fontWeight: 700, fontSize: 10, textTransform: "capitalize",
            }}>{issue.outsource_type}</span>
          </div>
        </div>

        <div style={{ padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Pickup person */}
          <div>
            <Label required>Pickup Person</Label>
            <select
              value={userId}
              onChange={e => { setUserId(e.target.value); setErrors(p => ({ ...p, userId: "" })); }}
              className={`opm-select ${errors.userId ? "err" : ""}`}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, cursor: "pointer" }}
            >
              <option value="">— Select person —</option>
              {admins.map(a => (
                <option key={a._id} value={a._id}>
                  {a.name}{a.role ? ` (${a.role})` : ""}
                </option>
              ))}
            </select>
            <FieldErr msg={errors.userId} />
          </div>

          {/* Delivery destination */}
          <div>
            <Label required>Deliver To</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {DELIVERY_OPTIONS.map(opt => (
                <button key={opt.id}
                  onClick={() => { setDelivery(opt.id); setErrors(p => ({ ...p, deliveryTo: "" })); }}
                  className={`dest-btn ${deliveryTo === opt.id ? "active" : ""}`}
                  style={{ padding: "14px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: deliveryTo === opt.id ? "#4338ca" : "#64748b" }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            {dest && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                {dest.icon} {dest.sub}
              </div>
            )}
            <FieldErr msg={errors.deliveryTo} />
          </div>

          {/* Pickup time */}
          <div>
            <Label required>Pickup Time</Label>
            <input
              type="datetime-local" min={minDT} value={pickupTime}
              onChange={e => { setTime(e.target.value); setErrors(p => ({ ...p, pickupTime: "" })); }}
              className={`opm-input ${errors.pickupTime ? "err" : ""}`}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, display: "block" }}
            />
            <FieldErr msg={errors.pickupTime} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: "normal", color: "#94a3b8", fontSize: 11 }}>(optional)</span></Label>
            <textarea
              rows={2} placeholder="Special handling instructions…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="opm-input"
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, resize: "none", display: "block" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10 }}>
          <button onClick={onClose} className="btn-ghost"
            style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary"
            style={{ flex: 2, padding: "12px 0", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Spinner size={16} color="#fff" /> Saving…</> : `${isReassign ? "↻ Re-assign" : "✓ Confirm"} Pickup`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Pickup Status Panel (inside card) ─────────────────────────────────
function PickupStatusPanel({ issue, isAdmin, onUpdated, onError }) {
  const pa = issue.pickup_assignment;
  const [updating, setUpdating] = useState(false);
  if (!pa) return null;

  const currentStatus = pa.status || "pending";
  const sm = PICKUP_STATUS_META[currentStatus] || PICKUP_STATUS_META.pending;

  const updateStatus = async (status) => {
    if (updating) return;
    setUpdating(true);
    try {
      const data = await apiCall(`/material/${issue._id}/pickup/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onUpdated(issue._id, data.data || data);
    } catch (err) {
      onError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const dest          = DELIVERY_OPTIONS.find(d => d.id === pa.delivery_to);
  const { label: tl, past } = countdown(pa.pickup_time);
  const assigneeName  = pa.assigned_to?.name || pa.assigned_to?.user_id?.name || "—";

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${sm.dot}30`, overflow: "hidden" }}>
      {/* Assignment row */}
      <div style={{ padding: "10px 12px", background: sm.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
              border: "1px solid #e2e8f0",
            }}>👤</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {assigneeName}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                {dest?.icon} {dest?.label}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <StatusTrack status={currentStatus} />
            {currentStatus === "pending" && (
              <div style={{ fontSize: 10, fontWeight: 700, color: past ? "#ef4444" : "#4f46e5", marginTop: 4 }}>
                ⏱ {tl}
              </div>
            )}
          </div>
        </div>

        {pa.notes && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f040", fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
            "{pa.notes}"
          </div>
        )}

        {pa.pickup_time && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            📅 {fmtDate(pa.pickup_time)}
          </div>
        )}
      </div>

      {/* Action buttons — only if admin or if the assigned person is current user */}
      {isAdmin && !["delivered", "cancelled"].includes(currentStatus) && (
        <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
          {currentStatus === "pending" && (
            <button onClick={() => updateStatus("collected")} disabled={updating}
              className="btn-sm-action"
              style={{ flex: 1, background: "#eff6ff", color: "#1d4ed8" }}>
              {updating ? "…" : "📦 Collected"}
            </button>
          )}
          {currentStatus === "collected" && (
            <button onClick={() => updateStatus("delivered")} disabled={updating}
              className="btn-sm-action"
              style={{ flex: 1, background: "#f0fdf4", color: "#15803d" }}>
              {updating ? "…" : "✅ Delivered"}
            </button>
          )}
          <button onClick={() => updateStatus("cancelled")} disabled={updating}
            className="btn-sm-action"
            style={{ background: "#fef2f2", color: "#dc2626", flexShrink: 0 }}>
            {updating ? "…" : "✕"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────
function IssueCard({ issue, isAdmin, currentUserId, onAssign, onStatusUpdated, onError }) {
  const status       = STATUS_META[issue.status]        || STATUS_META.issued;
  const typeMeta     = TYPE_META[issue.outsource_type]  || { icon: "📦", color: "#475569", bg: "#f8fafc", ring: "#e2e8f0" };
  const hasAssign    = !!issue.pickup_assignment;
  const pickupStatus = issue.pickup_assignment?.status || null;

  // Is this assigned to the current user?
  const assigneeId = issue.pickup_assignment?.assigned_to?.user_id?._id ||
                     issue.pickup_assignment?.assigned_to?.user_id || null;
  const isMyTask   = !isAdmin && assigneeId === currentUserId;

  return (
    <div className="issue-card fade-up" style={{ "--card-accent": typeMeta.color, padding: "18px 18px 16px" }}>
      {/* My task chip (non-admin) */}
      {isMyTask && <div className="my-task-chip">My Task</div>}

      {/* ── Top row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em" }}>
              {issue.issue_no}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
              background: status.bg, color: status.text, border: `1px solid ${status.ring}50`,
            }}>{status.label}</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <span style={{ fontWeight: 700, color: "#334155" }}>{issue.job_no}</span>
            {issue.cart_item_name && <span style={{ color: "#94a3b8" }}> · {issue.cart_item_name}</span>}
          </div>
        </div>

        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: typeMeta.bg, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 19, border: `1px solid ${typeMeta.ring}`,
        }}>{typeMeta.icon}</div>
      </div>

      {/* ── Info grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {[
          ["Type", (
            <span style={{ background: typeMeta.bg, color: typeMeta.color, padding: "1px 7px", borderRadius: 99, fontWeight: 700, fontSize: 11, textTransform: "capitalize" }}>
              {issue.outsource_type || "—"}
            </span>
          )],
          ["Vendor", issue.outsource_vendor || issue.issued_to?.name || "—"],
          ["By", issue.issued_by?.name || "—"],
          ["At", fmtTime(issue.issued_at)],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#f8fafc", borderRadius: 10, padding: "7px 10px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Design file label ── */}
      {issue.design_file_label && issue.design_file_label !== "Other" && (
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
            background: "#fdf4ff", color: "#7e22ce", border: "1px solid #e9d5ff",
            padding: "3px 9px", borderRadius: 99,
          }}>📎 {issue.design_file_label}</span>
        </div>
      )}

      {/* ── Notes ── */}
      {issue.issue_notes && (
        <div style={{
          fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginBottom: 10,
          padding: "7px 10px", background: "#f8fafc", borderRadius: 8, borderLeft: "3px solid #e2e8f0",
        }}>{issue.issue_notes}</div>
      )}

      {/* ── Pickup section ── */}
      <div style={{ marginTop: "auto" }}>
        {hasAssign ? (
          <>
            <PickupStatusPanel
              issue={issue}
              isAdmin={isAdmin}
              onUpdated={onStatusUpdated}
              onError={onError}
            />
            {isAdmin && (
              <button onClick={() => onAssign(issue)} className="btn-ghost"
                style={{ width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12, fontWeight: 600 }}>
                ↻ Re-assign Pickup
              </button>
            )}
          </>
        ) : isAdmin ? (
          <button onClick={() => onAssign(issue)} className="btn-primary"
            style={{
              width: "100%", padding: "10px 0", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Assign Pickup
          </button>
        ) : (
          <div style={{
            padding: "9px 12px", borderRadius: 10, background: "#fffbeb",
            border: "1px dashed #fcd34d", fontSize: 12, color: "#92400e", fontWeight: 500, textAlign: "center",
          }}>
            ⏳ Awaiting assignment
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="issue-card" style={{ padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
      <div>
        <div className="skeleton" style={{ width: 80, height: 15, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: 120, height: 12 }} />
      </div>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 11 }} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "7px 10px" }}>
          <div className="skeleton" style={{ width: 30, height: 9, marginBottom: 4 }} />
          <div className="skeleton" style={{ width: 70, height: 12 }} />
        </div>
      ))}
    </div>
    <div className="skeleton" style={{ width: "100%", height: 36, borderRadius: 10 }} />
  </div>
);

// ─── Empty / Error ────────────────────────────────────────────────────────────
const Empty = ({ icon, title, sub, action }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "80px 24px", gap: 10, textAlign: "center",
  }}>
    <div style={{ fontSize: 48 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>{title}</div>
    <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 280 }}>{sub}</div>
    {action}
  </div>
);

// ─── KPI Strip ────────────────────────────────────────────────────────────────
function KPIStrip({ stats, isAdmin }) {
  const chips = isAdmin
    ? [
        { label: "Total",      value: stats.total,      color: "#475569", bg: "#f1f5f9",  ring: "#cbd5e1" },
        { label: "Unassigned", value: stats.unassigned, color: "#c2410c", bg: "#fff7ed",  ring: "#fed7aa" },
        { label: "Pending",    value: stats.pending,    color: "#b45309", bg: "#fffbeb",  ring: "#fcd34d" },
        { label: "Collected",  value: stats.collected,  color: "#0369a1", bg: "#f0f9ff",  ring: "#bae6fd" },
        { label: "Delivered",  value: stats.delivered,  color: "#15803d", bg: "#f0fdf4",  ring: "#bbf7d0" },
      ]
    : [
        { label: "Assigned",  value: stats.total,     color: "#4f46e5", bg: "#eef2ff", ring: "#c7d2fe" },
        { label: "Pending",   value: stats.pending,   color: "#b45309", bg: "#fffbeb", ring: "#fcd34d" },
        { label: "Collected", value: stats.collected, color: "#0369a1", bg: "#f0f9ff", ring: "#bae6fd" },
        { label: "Delivered", value: stats.delivered, color: "#15803d", bg: "#f0fdf4", ring: "#bbf7d0" },
      ];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {chips.map(c => (
        <div key={c.label} style={{
          padding: "5px 14px", borderRadius: 99, background: c.bg,
          border: `1px solid ${c.ring}`, fontSize: 12, fontWeight: 700, color: c.color,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ fontSize: 15, fontWeight: 900 }}>{c.value}</span>
          <span style={{ fontWeight: 500, opacity: .85 }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function PickupDashboard() {
  const currentUser  = useCurrentUser();
  const isAdmin      = isAdminRole(currentUser?.role);

  const [issues,       setIssues]   = useState([]);
  const [admins,       setAdmins]   = useState([]);
  const [loadingIssues, setLI]      = useState(true);
  const [loadingAdmins, setLA]      = useState(true);
  const [issueErr,     setIssueErr] = useState(null);
  const [selected,     setSelected] = useState(null);
  const [toast,        setToast]    = useState(null);
  const toastTimer                  = useRef(null);

  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickupFilter, setPickupFilter] = useState("all");
  const [search,       setSearch]       = useState("");

  const showToast = useCallback((msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // ── Fetch issues ──────────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLI(true); setIssueErr(null);
    try {
      if (isAdmin) {
        // Admin: fetch all outsource issues
        const data = await apiCall("/material/outsource?limit=200");
        const raw  = data.data?.issues || data.issues || [];
        setIssues(raw.filter(i => !i.is_deleted));
      } else {
        // Non-admin: fetch only issues assigned to this user
        const data = await apiCall(`/material/pickups/user/${currentUser._id}?limit=200`);
        const raw  = data.data?.issues || data.issues || [];
        setIssues(raw.filter(i => !i.is_deleted));
      }
    } catch (err) {
      if (isAdmin) {
        try {
          const data2 = await apiCall("/material?limit=200");
          const raw2  = data2.data?.issues || data2.issues || [];
          setIssues(raw2.filter(i => i.calc_mode === "outsource" && !i.is_deleted));
        } catch {
          setIssueErr(err.message);
        }
      } else {
        setIssueErr(err.message);
      }
    } finally { setLI(false); }
  }, [isAdmin, currentUser._id]);

  // ── Fetch admins (for assign modal — only admins need this) ───────────────
  useEffect(() => {
    if (!isAdmin) { setLA(false); return; }
    (async () => {
      try {
        const data = await apiCall("/admin/get_admin");
        const list = data.data || data.admins || data.users || data.result || (Array.isArray(data) ? data : []);
        setAdmins(list);
      } catch { setAdmins([]); }
      finally  { setLA(false); }
    })();
  }, [isAdmin]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleSaved = useCallback((savedData) => {
    setIssues(prev => prev.map(issue =>
      issue._id === savedData.issue_id
        ? { ...issue, pickup_assignment: savedData.pickup_assignment }
        : issue
    ));
    setSelected(null);
    showToast(`Pickup assigned — ${savedData.issue_no}`);
  }, [showToast]);

  const handleStatusUpdated = useCallback((issueId, serverData) => {
    setIssues(prev => prev.map(issue => {
      if (issue._id !== issueId || !issue.pickup_assignment) return issue;
      return {
        ...issue,
        pickup_assignment: {
          ...issue.pickup_assignment,
          status:       serverData.pickup_status,
          collected_at: serverData.collected_at,
          delivered_at: serverData.delivered_at,
        },
      };
    }));
    showToast(`Status → "${serverData.pickup_status}"`);
  }, [showToast]);

  const handleError = useCallback((msg) => showToast(msg, false), [showToast]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const stats = {
    total:      issues.length,
    unassigned: issues.filter(i => !i.pickup_assignment).length,
    pending:    issues.filter(i => i.pickup_assignment?.status === "pending").length,
    collected:  issues.filter(i => i.pickup_assignment?.status === "collected").length,
    delivered:  issues.filter(i => i.pickup_assignment?.status === "delivered").length,
  };

  const allTypes    = ["all", ...new Set(issues.map(i => i.outsource_type).filter(Boolean))];
  const allStatuses = ["all", ...new Set(issues.map(i => i.status).filter(Boolean))];

  const filtered = issues.filter(issue => {
    if (typeFilter !== "all" && issue.outsource_type !== typeFilter)                    return false;
    if (statusFilter !== "all" && issue.status !== statusFilter)                        return false;
    if (pickupFilter === "unassigned" && issue.pickup_assignment)                       return false;
    if (pickupFilter !== "all" && pickupFilter !== "unassigned" &&
        issue.pickup_assignment?.status !== pickupFilter)                               return false;
    if (search) {
      const q   = search.toLowerCase();
      const hay = [
        issue.issue_no, issue.job_no, issue.cart_item_name,
        issue.outsource_vendor, issue.issued_to?.name, issue.issued_by?.name,
        issue.pickup_assignment?.assigned_to?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const loading = loadingIssues || loadingAdmins;

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs = isAdmin
    ? [
        { id: "all",        label: "All",        count: stats.total       },
        { id: "unassigned", label: "Unassigned",  count: stats.unassigned  },
        { id: "pending",    label: "Pending",     count: stats.pending     },
        { id: "collected",  label: "Collected",   count: stats.collected   },
        { id: "delivered",  label: "Delivered",   count: stats.delivered   },
      ]
    : [
        { id: "all",       label: "All Tasks",  count: stats.total     },
        { id: "pending",   label: "Pending",    count: stats.pending   },
        { id: "collected", label: "Collected",  count: stats.collected },
        { id: "delivered", label: "Delivered",  count: stats.delivered },
      ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e8edf3",
        position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 8px rgba(0,0,0,.06)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px" }}>

          {/* Title row */}
          <div style={{
            padding: "16px 0 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "linear-gradient(135deg,#0f172a,#334155)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>🏭</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>
                  {isAdmin ? "Outsource Pickup Manager" : "My Pickup Tasks"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>
                    {isAdmin
                      ? "Assign collection, destination & schedule"
                      : `Logged in as ${currentUser.name}`}
                  </p>
                  <span className="role-badge" style={{
                    background: isAdmin ? "#eef2ff" : "#f0fdf4",
                    color: isAdmin ? "#4f46e5" : "#16a34a",
                    border: `1px solid ${isAdmin ? "#c7d2fe" : "#bbf7d0"}`,
                  }}>
                    {isAdmin ? "🔑" : "👤"} {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            <KPIStrip stats={stats} isAdmin={isAdmin} />
          </div>

          {/* Tab strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setPickupFilter(t.id)}
                className={`tab-btn ${pickupFilter === t.id ? "active" : ""}`}>
                {t.label}
                <span style={{
                  marginLeft: 5, padding: "1px 6px", borderRadius: 99, fontSize: 10,
                  background: pickupFilter === t.id ? "#4f46e5" : "#f1f5f9",
                  color: pickupFilter === t.id ? "#c7d2fe" : "#94a3b8", fontWeight: 700,
                }}>{t.count}</span>
              </button>
            ))}

            <button onClick={fetchIssues} disabled={loadingIssues} className="btn-ghost"
              style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12, alignSelf: "center", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
              {loadingIssues ? <Spinner size={13} /> : "↻"} Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8edf3" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "10px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flexGrow: 1, minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search issue, job, vendor, person…"
              className="opm-input"
              style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13 }} />
          </div>

          {/* Type pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {allTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`filter-pill ${typeFilter === t ? "active" : ""}`}>
                {t === "all" ? "All Types" : `${TYPE_META[t]?.icon || ""} ${t}`}
              </button>
            ))}
          </div>

          {/* Status pills — only admin sees full status filter */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {allStatuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`filter-pill ${statusFilter === s ? "active" : ""}`}>
                  {s === "all" ? "All Status" : STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px 64px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : issueErr ? (
          <Empty icon="⚠️" title="Failed to load" sub={issueErr}
            action={
              <button onClick={fetchIssues} className="btn-primary"
                style={{ marginTop: 8, padding: "9px 20px", fontSize: 13 }}>
                Retry
              </button>
            }
          />
        ) : issues.length === 0 ? (
          <Empty
            icon={isAdmin ? "📭" : "🎉"}
            title={isAdmin ? "No outsource issues" : "No tasks assigned"}
            sub={isAdmin ? "Outsource issues appear here once created." : "You have no pickup tasks assigned yet."}
          />
        ) : filtered.length === 0 ? (
          <Empty icon="🔍" title="No results" sub="Try adjusting your filters or search." />
        ) : (
          <>
            {/* Result count bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16, flexWrap: "wrap", gap: 8,
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#94a3b8" }}>
                <span style={{ color: "#334155", fontWeight: 700 }}>{filtered.length}</span> issue{filtered.length !== 1 ? "s" : ""}
                {(typeFilter !== "all" || statusFilter !== "all" || pickupFilter !== "all" || search)
                  ? " · filtered" : ""}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
              {filtered.map((issue, idx) => (
                <IssueCard
                  key={issue._id}
                  issue={issue}
                  isAdmin={isAdmin}
                  currentUserId={currentUser._id}
                  onAssign={setSelected}
                  onStatusUpdated={handleStatusUpdated}
                  onError={handleError}
                  style={{ animationDelay: `${idx * 30}ms` }}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Assign Modal ── */}
      {selected && isAdmin && (
        <AssignModal
          issue={selected}
          admins={admins}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onError={handleError}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default PickupDashboard;