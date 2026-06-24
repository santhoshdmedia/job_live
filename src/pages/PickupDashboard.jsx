import { useState, useEffect, useCallback, useRef } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "https://api.dmedia.in/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const DELIVERY_OPTIONS = [
  { id: "dmedia_office", label: "DMedia Office",     icon: "🏢", sub: "Main office reception"  },
  { id: "factory",       label: "Factory",           icon: "🏭", sub: "Production floor"        },
  { id: "customer",      label: "Customer Delivery", icon: "🚀", sub: "Direct to customer site" },
];

const TYPE_META = {
  cutting:    { icon: "✂️",  label: "Cutting",    color: "#7c3aed", bg: "#f5f3ff" },
  lamination: { icon: "🗂️", label: "Lamination", color: "#0284c7", bg: "#f0f9ff" },
  printing:   { icon: "🖨️", label: "Printing",   color: "#be123c", bg: "#fff1f2" },
  finishing:  { icon: "🔧", label: "Finishing",   color: "#c2410c", bg: "#fff7ed" },
};

const STATUS_META = {
  issued:         { label: "Issued",         ring: "#f59e0b", bg: "#fffbeb", text: "#92400e" },
  returned:       { label: "Returned",       ring: "#22c55e", bg: "#f0fdf4", text: "#14532d" },
  partial_return: { label: "Partial Return", ring: "#3b82f6", bg: "#eff6ff", text: "#1e3a5f" },
  no_return:      { label: "No Return",      ring: "#ef4444", bg: "#fef2f2", text: "#7f1d1d" },
};

const PICKUP_STATUS_META = {
  pending:   { label: "Pending",   color: "#f59e0b", bg: "#fffbeb" },
  collected: { label: "Collected", color: "#3b82f6", bg: "#eff6ff" },
  delivered: { label: "Delivered", color: "#22c55e", bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const countdown = (isoStr) => {
  const diff = new Date(isoStr) - Date.now();
  if (diff <= 0) return { label: "Past due", past: true };
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

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 20, color = "#6366f1" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0110 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </svg>
);

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }

  .fade-in { animation: fadeIn .2s ease both; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
  .scale-in { animation: scaleIn .18s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes scaleIn { from { opacity:0; transform:scale(.94) } to { opacity:1; transform:scale(1) } }

  .card {
    background:#fff; border-radius:16px; border:1px solid #e2e8f0;
    transition: box-shadow .18s, transform .18s, border-color .18s;
  }
  .card:hover { box-shadow:0 8px 32px rgba(0,0,0,.09); transform:translateY(-2px); border-color:#c7d2fe; }

  .btn-primary {
    background:#4f46e5; color:#fff; border:none; cursor:pointer;
    transition: background .15s, transform .1s, box-shadow .15s;
    border-radius: 10px;
  }
  .btn-primary:hover { background:#4338ca; box-shadow:0 4px 12px rgba(79,70,229,.35); }
  .btn-primary:active { transform:scale(.97); }
  .btn-primary:disabled { background:#a5b4fc; cursor:not-allowed; transform:none; box-shadow:none; }

  .btn-ghost {
    background:transparent; border:1.5px solid #e2e8f0; color:#64748b;
    cursor:pointer; transition:all .15s; border-radius:10px;
  }
  .btn-ghost:hover { border-color:#94a3b8; background:#f8fafc; color:#334155; }

  .btn-danger {
    background:#ef4444; color:#fff; border:none; cursor:pointer;
    transition: background .15s; border-radius:10px;
  }
  .btn-danger:hover { background:#dc2626; }

  .input {
    border:1.5px solid #e2e8f0; background:#fff; color:#1e293b;
    outline:none; transition:border .15s, box-shadow .15s;
    border-radius:10px;
  }
  .input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
  .input.err { border-color:#f87171; background:#fff7f7; }

  .opm-select {
    border:1.5px solid #e2e8f0; background:#fff;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    appearance:none; padding-right:32px; color:#1e293b;
    outline:none; transition:border .15s, box-shadow .15s; border-radius:10px;
  }
  .opm-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
  .opm-select.err { border-color:#f87171; }

  .dest-btn {
    background:#fff; border:1.5px solid #e2e8f0; cursor:pointer;
    transition:all .15s; border-radius:12px; text-align:center;
  }
  .dest-btn:hover { border-color:#c7d2fe; background:#fafafe; }
  .dest-btn.active { border-color:#6366f1; background:#eef2ff; box-shadow:0 0 0 3px rgba(99,102,241,.1); }

  .filter-pill {
    border:1.5px solid #e2e8f0; background:#fff; cursor:pointer;
    transition:all .15s; white-space:nowrap; border-radius:99px;
    font-size:12px; font-weight:600; padding:6px 14px; color:#64748b;
  }
  .filter-pill:hover { border-color:#94a3b8; color:#334155; }
  .filter-pill.active { background:#4f46e5; border-color:#4f46e5; color:#fff; }

  .tab-btn {
    background:none; border:none; cursor:pointer; padding:10px 16px;
    font-size:13px; font-weight:600; color:#94a3b8; border-bottom:2px solid transparent;
    transition:all .15s; white-space:nowrap;
  }
  .tab-btn.active { color:#4f46e5; border-bottom-color:#4f46e5; }
  .tab-btn:hover:not(.active) { color:#64748b; }

  .status-update-btn {
    flex:1; padding:8px 0; border:none; cursor:pointer; border-radius:8px;
    font-size:12px; font-weight:700; transition:all .15s;
  }

  .toast-enter { animation: toastIn .25s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes toastIn { from{opacity:0;transform:translate(-50%,16px)} to{opacity:1;transform:translate(-50%,0)} }
`;

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-enter" style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 300, display: "flex", alignItems: "center", gap: 10,
      padding: "13px 22px", borderRadius: 14,
      background: toast.ok ? "#0f172a" : "#ef4444",
      color: "#fff", fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,.22)", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 16 }}>{toast.ok ? "✓" : "✕"}</span>
      {toast.msg}
    </div>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
    {children} {required && <span style={{ color: "#f87171" }}>*</span>}
  </div>
);

// ─── FieldError ───────────────────────────────────────────────────────────────
const FieldErr = ({ msg }) => msg
  ? <div style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>{msg}</div>
  : null;

// ─── Assign / Re-assign Modal ─────────────────────────────────────────────────
function AssignModal({ issue, admins, onClose, onSaved, onError }) {
  const existing = issue.pickup_assignment;
  const [userId,     setUserId]   = useState(existing?.assigned_to?.user_id?._id || existing?.assigned_to?.user_id || "");
  const [deliveryTo, setDelivery] = useState(existing?.delivery_to || "");
  const [pickupTime, setTime]     = useState(
    existing?.pickup_time ? new Date(existing.pickup_time).toISOString().slice(0, 16) : ""
  );
  const [notes,  setNotes]  = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isReassign = !!existing;
  const minDT = new Date(Date.now() + 60000).toISOString().slice(0, 16);

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
      const data = await apiCall(`/material/${issue._id}/assign-pickup`, {
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

  const typeMeta = TYPE_META[issue.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc" };
  const dest = DELIVERY_OPTIONS.find(d => d.id === deliveryTo);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, background: "rgba(15,23,42,.65)", backdropFilter: "blur(6px)",
      }}
    >
      <div className="scale-in" style={{
        width: "100%", maxWidth: 490, background: "#fff", borderRadius: 22,
        boxShadow: "0 32px 80px rgba(0,0,0,.2)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14, background: typeMeta.bg,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
            }}>{typeMeta.icon}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>
                {isReassign ? "Re-assign Pickup" : "Assign Pickup"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{issue.issue_no}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
                {issue.job_no} · <strong style={{ color: "#334155" }}>{issue.cart_item_name}</strong>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 6,
            color: "#94a3b8", borderRadius: 8, lineHeight: 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Vendor pill */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 99, padding: "5px 12px", fontSize: 12, color: "#475569",
          }}>
            🏭 Vendor:&nbsp;
            <strong style={{ color: "#334155" }}>{issue.outsource_vendor || issue.issued_to?.name || "—"}</strong>
            <span style={{
              padding: "2px 8px", background: "#e0e7ff", borderRadius: 99,
              color: "#4f46e5", fontWeight: 700, textTransform: "capitalize", fontSize: 11,
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
                <button
                  key={opt.id}
                  onClick={() => { setDelivery(opt.id); setErrors(p => ({ ...p, deliveryTo: "" })); }}
                  className={`dest-btn ${deliveryTo === opt.id ? "active" : ""}`}
                  style={{ padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                >
                  <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: deliveryTo === opt.id ? "#4338ca" : "#475569" }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            {dest && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
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
              className={`input ${errors.pickupTime ? "err" : ""}`}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, display: "block" }}
            />
            <FieldErr msg={errors.pickupTime} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: "normal", color: "#94a3b8" }}>(optional)</span></Label>
            <textarea
              rows={2} placeholder="Special handling instructions…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="input"
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, resize: "none", display: "block" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: "12px 0", fontSize: 14, fontWeight: 600 }}>
            Cancel
          </button>
          <button
            onClick={handleSave} disabled={saving} className="btn-primary"
            style={{ flex: 2, padding: "12px 0", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {saving ? <><Spinner size={16} color="#fff" /> Saving…</> : `${isReassign ? "↻ Re-assign" : "✓ Confirm"} Pickup`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pickup Status Update Panel ───────────────────────────────────────────────
function PickupStatusPanel({ issue, onUpdated, onError }) {
  const pa = issue.pickup_assignment;
  const [updating, setUpdating] = useState(false);
  if (!pa) return null;

  const currentStatus = pa.status || "pending";
  const statusMeta = PICKUP_STATUS_META[currentStatus] || PICKUP_STATUS_META.pending;

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

  const dest = DELIVERY_OPTIONS.find(d => d.id === pa.delivery_to);
  const { label: timeLabel, past } = countdown(pa.pickup_time);
  const assigneeName = pa.assigned_to?.name || pa.assigned_to?.user_id?.name || "—";

  return (
    <div style={{
      marginTop: 10, borderRadius: 12, overflow: "hidden",
      border: `1px solid ${statusMeta.color}44`,
    }}>
      {/* Assignment info */}
      <div style={{ padding: "10px 12px", background: statusMeta.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            }}>👤</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{assigneeName}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{dest?.icon} {dest?.label}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-block", padding: "2px 8px", borderRadius: 99,
              background: "#fff", border: `1px solid ${statusMeta.color}55`,
              fontSize: 11, fontWeight: 700, color: statusMeta.color,
            }}>{statusMeta.label}</div>
            {currentStatus === "pending" && (
              <div style={{ fontSize: 11, color: past ? "#ef4444" : "#4f46e5", marginTop: 2, fontWeight: 600 }}>
                {timeLabel}
              </div>
            )}
          </div>
        </div>
        {pa.notes && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f040",
            fontSize: 11, color: "#64748b", fontStyle: "italic",
          }}>"{pa.notes}"</div>
        )}
      </div>

      {/* Status update buttons */}
      {!["delivered", "cancelled"].includes(currentStatus) && (
        <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
          {currentStatus === "pending" && (
            <button
              onClick={() => updateStatus("collected")}
              disabled={updating}
              className="status-update-btn"
              style={{ background: "#eff6ff", color: "#1d4ed8" }}
            >
              {updating ? "…" : "📦 Mark Collected"}
            </button>
          )}
          {currentStatus === "collected" && (
            <button
              onClick={() => updateStatus("delivered")}
              disabled={updating}
              className="status-update-btn"
              style={{ background: "#f0fdf4", color: "#15803d" }}
            >
              {updating ? "…" : "✅ Mark Delivered"}
            </button>
          )}
          <button
            onClick={() => updateStatus("cancelled")}
            disabled={updating}
            className="status-update-btn"
            style={{ background: "#fef2f2", color: "#dc2626", flex: "0 0 auto", padding: "8px 12px" }}
          >
            {updating ? "…" : "✕"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────
function IssueCard({ issue, onAssign, onStatusUpdated, onError }) {
  const status   = STATUS_META[issue.status]  || STATUS_META.issued;
  const typeMeta = TYPE_META[issue.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc" };
  const hasAssignment = !!issue.pickup_assignment;

  return (
    <div className="card fade-in" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
      {/* Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{issue.issue_no}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: status.bg, color: status.text, border: `1px solid ${status.ring}44`,
            }}>{status.label}</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
            <span style={{ fontWeight: 700, color: "#334155" }}>{issue.job_no}</span>
            {issue.cart_item_name && <> · {issue.cart_item_name}</>}
          </div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: typeMeta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{typeMeta.icon}</div>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {[
          ["Type", (
            <span style={{
              background: typeMeta.bg, color: typeMeta.color, padding: "1px 8px",
              borderRadius: 99, fontWeight: 700, fontSize: 11, textTransform: "capitalize",
            }}>{issue.outsource_type || "—"}</span>
          )],
          ["Vendor", issue.outsource_vendor || issue.issued_to?.name || "—"],
          ["Issued by", issue.issued_by?.name || "—"],
          ["Time", fmtTime(issue.issued_at)],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#f8fafc", borderRadius: 10, padding: "7px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Design file label */}
      {issue.design_file_label && issue.design_file_label !== "Other" && (
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
            background: "#fdf4ff", color: "#7e22ce", border: "1px solid #e9d5ff",
            padding: "3px 10px", borderRadius: 99,
          }}>📎 {issue.design_file_label}</span>
        </div>
      )}

      {/* Notes */}
      {issue.issue_notes && (
        <div style={{
          fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginBottom: 10,
          padding: "7px 10px", background: "#f8fafc", borderRadius: 8, borderLeft: "3px solid #e2e8f0",
        }}>{issue.issue_notes}</div>
      )}

      {/* Pickup section */}
      <div style={{ marginTop: "auto" }}>
        {hasAssignment ? (
          <>
            <PickupStatusPanel
              issue={issue}
              onUpdated={onStatusUpdated}
              onError={onError}
            />
            <button
              onClick={() => onAssign(issue)}
              className="btn-ghost"
              style={{ width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12, fontWeight: 600 }}
            >
              ↻ Re-assign Pickup
            </button>
          </>
        ) : (
          <button
            onClick={() => onAssign(issue)}
            className="btn-primary"
            style={{
              width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Assign Pickup
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty / Error state ──────────────────────────────────────────────────────
const Empty = ({ icon, title, sub, action }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "80px 24px", gap: 12, textAlign: "center",
  }}>
    <div style={{ fontSize: 52 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: "#334155" }}>{title}</div>
    <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 280 }}>{sub}</div>
    {action}
  </div>
);

// ─── Stat Badge ───────────────────────────────────────────────────────────────
const Stat = ({ label, value, color, bg }) => (
  <div style={{
    padding: "5px 14px", borderRadius: 99, background: bg,
    border: `1px solid ${color}22`, fontSize: 12, fontWeight: 700, color,
  }}>{value} {label}</div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function PickupDashboard() {
  const [issues,       setIssues]    = useState([]);
  const [admins,       setAdmins]    = useState([]);
  const [loadingIssues, setLI]       = useState(true);
  const [loadingAdmins, setLA]       = useState(true);
  const [issueErr,     setIssueErr]  = useState(null);
  const [selected,     setSelected]  = useState(null);  // issue being assigned
  const [toast,        setToast]     = useState(null);
  const toastTimer                   = useRef(null);

  // Filters
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickupFilter, setPickupFilter] = useState("all"); // all | unassigned | pending | collected | delivered
  const [search,       setSearch]       = useState("");
  const [activeTab,    setActiveTab]    = useState("board"); // board | list

  const showToast = useCallback((msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // ── Fetch outsource issues ─────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLI(true);
    setIssueErr(null);
    try {
      // Use the dedicated outsource endpoint for efficiency
      const data = await apiCall("/material/outsource?limit=200");
      const raw = data.data?.issues || data.issues || [];
      setIssues(raw.filter(i => !i.is_deleted));
    } catch (err) {
      // Fallback to general endpoint
      try {
        const data2 = await apiCall("/material?limit=200");
        const raw2 = data2.data?.issues || data2.issues || [];
        setIssues(raw2.filter(i => i.calc_mode === "outsource" && !i.is_deleted));
      } catch {
        setIssueErr(err.message);
      }
    } finally {
      setLI(false);
    }
  }, []);

  // ── Fetch admins ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await apiCall("/admin/get_admin");
        const list = data.data || data.admins || data.users || data.result || (Array.isArray(data) ? data : []);
        setAdmins(list);
      } catch {
        setAdmins([]);
      } finally {
        setLA(false);
      }
    })();
  }, []);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // ── Mutate issue in state after assignment ─────────────────────────────────
  const handleSaved = useCallback((savedData) => {
    // savedData has { issue_id, issue_no, pickup_assignment } from server
    const issueId = savedData.issue_id;
    const pa = savedData.pickup_assignment;
    setIssues(prev => prev.map(issue =>
      issue._id === issueId
        ? { ...issue, pickup_assignment: pa }
        : issue
    ));
    setSelected(null);
    showToast(`Pickup assigned — ${savedData.issue_no}`);
  }, [showToast]);

  // ── Mutate issue status in state ───────────────────────────────────────────
  const handleStatusUpdated = useCallback((issueId, serverData) => {
    setIssues(prev => prev.map(issue => {
      if (issue._id !== issueId || !issue.pickup_assignment) return issue;
      return {
        ...issue,
        pickup_assignment: {
          ...issue.pickup_assignment,
          status: serverData.pickup_status,
          collected_at: serverData.collected_at,
          delivered_at: serverData.delivered_at,
        },
      };
    }));
    showToast(`Status updated to "${serverData.pickup_status}"`);
  }, [showToast]);

  const handleError = useCallback((msg) => showToast(msg, false), [showToast]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = {
    total:     issues.length,
    unassigned: issues.filter(i => !i.pickup_assignment).length,
    pending:   issues.filter(i => i.pickup_assignment?.status === "pending").length,
    collected: issues.filter(i => i.pickup_assignment?.status === "collected").length,
    delivered: issues.filter(i => i.pickup_assignment?.status === "delivered").length,
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const allTypes = ["all", ...new Set(issues.map(i => i.outsource_type).filter(Boolean))];
  const allStatuses = ["all", ...new Set(issues.map(i => i.status).filter(Boolean))];

  const filtered = issues.filter(issue => {
    if (typeFilter !== "all" && issue.outsource_type !== typeFilter) return false;
    if (statusFilter !== "all" && issue.status !== statusFilter)     return false;
    if (pickupFilter === "unassigned" && issue.pickup_assignment)    return false;
    if (pickupFilter !== "all" && pickupFilter !== "unassigned" && issue.pickup_assignment?.status !== pickupFilter) return false;
    if (search) {
      const q   = search.toLowerCase();
      const hay = [
        issue.issue_no, issue.job_no, issue.cart_item_name,
        issue.outsource_vendor, issue.issued_to?.name, issue.issued_by?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const loading = loadingIssues || loadingAdmins;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
          {/* Title row */}
          <div style={{
            padding: "18px 0 14px", display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>🏭</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  Outsource Pickup
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                  Assign collection, destination & schedule
                </p>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Stat label="total"      value={stats.total}      color="#475569" bg="#f8fafc" />
              <Stat label="unassigned" value={stats.unassigned} color="#c2410c" bg="#fff7ed" />
              <Stat label="pending"    value={stats.pending}    color="#b45309" bg="#fffbeb" />
              <Stat label="collected"  value={stats.collected}  color="#0369a1" bg="#f0f9ff" />
              <Stat label="delivered"  value={stats.delivered}  color="#15803d" bg="#f0fdf4" />
            </div>
          </div>

          {/* Pickup status quick filter tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "none", overflowX: "auto" }}>
            {[
              { id: "all",        label: "All"        },
              { id: "unassigned", label: "Unassigned" },
              { id: "pending",    label: "Pending"    },
              { id: "collected",  label: "Collected"  },
              { id: "delivered",  label: "Delivered"  },
            ].map(t => (
              <button key={t.id} onClick={() => setPickupFilter(t.id)}
                className={`tab-btn ${pickupFilter === t.id ? "active" : ""}`}>
                {t.label}
                {t.id !== "all" && (
                  <span style={{
                    marginLeft: 6, padding: "1px 6px", borderRadius: 99, fontSize: 10,
                    background: pickupFilter === t.id ? "#4f46e5" : "#f1f5f9",
                    color: pickupFilter === t.id ? "#c7d2fe" : "#94a3b8", fontWeight: 700,
                  }}>
                    {t.id === "unassigned" ? stats.unassigned :
                     t.id === "pending"    ? stats.pending    :
                     t.id === "collected"  ? stats.collected  : stats.delivered}
                  </span>
                )}
              </button>
            ))}

            {/* Refresh button */}
            <button
              onClick={fetchIssues}
              disabled={loadingIssues}
              className="btn-ghost"
              style={{ marginLeft: "auto", padding: "7px 12px", fontSize: 12, fontWeight: 600, alignSelf: "center", marginBottom: 4 }}
            >
              {loadingIssues ? <Spinner size={14} /> : "↻ Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flexGrow: 1, minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search issue, job, vendor, person…"
              className="input"
              style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13 }}
            />
          </div>

          {/* Type filter */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {allTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`filter-pill ${typeFilter === t ? "active" : ""}`}>
                {t === "all" ? "All Types" : `${TYPE_META[t]?.icon || ""} ${t}`}
              </button>
            ))}
          </div>

          {/* Issue status filter */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {allStatuses.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`filter-pill ${statusFilter === s ? "active" : ""}`}>
                {s === "all" ? "All Status" : STATUS_META[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 0", gap: 14 }}>
            <Spinner size={36} />
            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500 }}>Loading outsource issues…</div>
          </div>
        ) : issueErr ? (
          <Empty
            icon="⚠️" title="Failed to load issues" sub={issueErr}
            action={
              <button onClick={fetchIssues} className="btn-primary"
                style={{ marginTop: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700 }}>
                Retry
              </button>
            }
          />
        ) : issues.length === 0 ? (
          <Empty icon="📭" title="No outsource issues" sub="Outsource issues will appear here once created." />
        ) : filtered.length === 0 ? (
          <Empty icon="🔍" title="No results" sub="Try adjusting your search or filters." />
        ) : (
          <>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 16,
            }}>
              {filtered.length} issue{filtered.length !== 1 ? "s" : ""}
              {(typeFilter !== "all" || statusFilter !== "all" || pickupFilter !== "all" || search) && " · filtered"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
              {filtered.map(issue => (
                <IssueCard
                  key={issue._id}
                  issue={issue}
                  onAssign={setSelected}
                  onStatusUpdated={handleStatusUpdated}
                  onError={handleError}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Assign Modal ── */}
      {selected && (
        <AssignModal
          issue={selected}
          admins={admins}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onError={handleError}
        />
      )}

      {/* ── Toast ── */}
      <Toast toast={toast} />
    </div>
  );
}

export default PickupDashboard;