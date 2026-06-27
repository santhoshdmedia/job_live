import { useState, useEffect, useCallback, useRef } from "react";

// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE = "https://api.dmedia.in/api";

// ─── Auth — swap with your real auth selector ──────────────────────────────
const useCurrentUser = () => ({
  _id: "675be0febb62992beaa0b1c0",
  name: "Danyi",
  role: "super admin", // "super admin" | "admin" | anything else
});

const isAdminRole = (role = "") =>
  ["super admin", "admin"].includes(role.toLowerCase().trim());

// ─── Constants ─────────────────────────────────────────────────────────────
const DELIVERY_OPTIONS = [
  { id: "dmedia_office", label: "DMedia Office",    icon: "🏢", sub: "Main office reception"  },
  { id: "factory",       label: "Factory",          icon: "🏭", sub: "Production floor"        },
  { id: "customer",      label: "Customer",         icon: "🚀", sub: "Direct to customer site" },
];

const TYPE_META = {
  cutting:      { icon: "✂️",  label: "Cutting",      color: "#7c3aed", bg: "#f5f3ff", ring: "#ddd6fe" },
  lamination:   { icon: "🗂️", label: "Lamination",   color: "#0284c7", bg: "#f0f9ff", ring: "#bae6fd" },
  printing:     { icon: "🖨️", label: "Printing",     color: "#be123c", bg: "#fff1f2", ring: "#fecdd3" },
  finishing:    { icon: "🔧", label: "Finishing",    color: "#c2410c", bg: "#fff7ed", ring: "#fed7aa" },
  installation: { icon: "🔩", label: "Installation", color: "#0f766e", bg: "#f0fdfa", ring: "#99f6e4" },
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

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
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

// Group issues by job_no + outsource_type
const groupIssues = (issues) => {
  const map = new Map();
  issues.forEach((issue) => {
    const key = `${issue.job_no}__${issue.outsource_type}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  });
  return Array.from(map.entries()).map(([key, items]) => ({
    groupKey: key,
    job_no: items[0].job_no,
    outsource_type: items[0].outsource_type,
    outsource_vendor: items[0].outsource_vendor,
    issues: items,
    // Use shared assignment from first assigned item
    pickup_assignment: items.find(i => i.pickup_assignment)?.pickup_assignment || null,
    // A group is fully assigned if all items have same assignee
    allAssigned: items.every(i => i.pickup_assignment),
    partiallyAssigned: items.some(i => i.pickup_assignment) && !items.every(i => i.pickup_assignment),
  }));
};

// ─── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f0f2f5; color: #0f172a; }
  input, select, textarea, button { font-family: inherit; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }

  @keyframes fadeUp  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
  @keyframes scaleIn { from { opacity:0; transform:scale(.95) } to { opacity:1; transform:scale(1) } }
  @keyframes spin    { to { transform: rotate(360deg) } }
  @keyframes shimmer { from { background-position: -200% 0 } to { background-position: 200% 0 } }
  @keyframes toastIn { from { opacity:0; transform:translate(-50%,16px) } to { opacity:1; transform:translate(-50%,0) } }

  .fade-up  { animation: fadeUp .2s ease both; }
  .scale-in { animation: scaleIn .2s cubic-bezier(.34,1.4,.64,1) both; }

  .group-card {
    background: #fff;
    border: 1px solid #e8edf3;
    border-radius: 16px;
    transition: box-shadow .2s, transform .2s, border-color .2s;
    position: relative;
    overflow: hidden;
  }
  .group-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--card-accent, #e2e8f0);
  }
  .group-card:hover {
    box-shadow: 0 8px 32px rgba(0,0,0,.09);
    transform: translateY(-2px);
    border-color: #c7d2fe;
  }

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

  .btn-sm {
    border: none; cursor: pointer; border-radius: 8px;
    font-size: 11px; font-weight: 700; padding: 6px 10px;
    transition: all .15s; white-space: nowrap;
  }

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

  .dest-btn {
    background: #fafbfc; border: 1.5px solid #e2e8f0;
    cursor: pointer; transition: all .15s; border-radius: 12px; text-align: center;
  }
  .dest-btn:hover  { border-color: #c7d2fe; background: #fafaff; }
  .dest-btn.active { border-color: #6366f1; background: #eef2ff; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

  .filter-pill {
    border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer;
    transition: all .15s; white-space: nowrap; border-radius: 99px;
    font-size: 12px; font-weight: 600; padding: 5px 14px; color: #64748b;
  }
  .filter-pill:hover  { border-color: #94a3b8; color: #334155; background: #f8fafc; }
  .filter-pill.active { background: #4f46e5; border-color: #4f46e5; color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,.3); }

  .tab-btn {
    background: none; border: none; cursor: pointer;
    padding: 10px 16px; font-size: 13px; font-weight: 600;
    color: #94a3b8; border-bottom: 2px solid transparent;
    transition: all .15s; white-space: nowrap; line-height: 1;
  }
  .tab-btn.active             { color: #4f46e5; border-bottom-color: #4f46e5; }
  .tab-btn:hover:not(.active) { color: #64748b; }

  .skeleton {
    background: linear-gradient(90deg, #f1f5f9 25%, #e8eef4 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 8px;
  }
  .toast-wrap { animation: toastIn .25s cubic-bezier(.34,1.4,.64,1) both; }

  .task-row {
    border-radius: 10px;
    background: #f8fafc;
    padding: 10px 12px;
    margin-bottom: 6px;
    border: 1px solid #f1f5f9;
    transition: background .15s;
  }
  .task-row:last-child { margin-bottom: 0; }
  .task-row:hover { background: #f1f5f9; }

  .checkbox-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 10px; cursor: pointer;
    border: 1.5px solid #e2e8f0; background: #fff;
    transition: all .15s; margin-bottom: 6px;
  }
  .checkbox-item:last-child { margin-bottom: 0; }
  .checkbox-item:hover { border-color: #c7d2fe; background: #fafaff; }
  .checkbox-item.checked { border-color: #6366f1; background: #eef2ff; }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 300;
    display: flex; align-items: center; justify-content: center;
    padding: 16px; background: rgba(15,23,42,.7); backdrop-filter: blur(8px);
  }
  .modal-box {
    width: 100%; max-width: 540px; background: #fff; border-radius: 24px;
    box-shadow: 0 40px 100px rgba(0,0,0,.22); overflow: hidden;
    max-height: 90vh; display: flex; flex-direction: column;
  }
  .modal-scroll { overflow-y: auto; flex: 1; }
`;

// ─── Small components ──────────────────────────────────────────────────────
const Spinner = ({ size = 20, color = "#6366f1" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ animation: "spin .8s linear infinite", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity=".2" />
    <path d="M12 2a10 10 0 0110 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

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

// ─── Status track dots ──────────────────────────────────────────────────────
function StatusTrack({ status }) {
  const steps = ["pending", "collected", "delivered"];
  if (status === "cancelled") return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
      Cancelled
    </div>
  );
  const idx = steps.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {steps.map((step, i) => {
        const done = i < idx, current = i === idx;
        const color = done || current ? PICKUP_STATUS_META[step].dot : "#e2e8f0";
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div title={PICKUP_STATUS_META[step].label} style={{
              width: current ? 10 : 8, height: current ? 10 : 8, borderRadius: "50%",
              background: color, transition: "all .2s",
              boxShadow: current ? `0 0 0 3px ${color}40` : "none",
            }} />
            {i < steps.length - 1 && <div style={{ width: 18, height: 2, background: done ? color : "#e2e8f0", borderRadius: 99 }} />}
          </div>
        );
      })}
      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: PICKUP_STATUS_META[status]?.color || "#64748b" }}>
        {PICKUP_STATUS_META[status]?.label}
      </span>
    </div>
  );
}

// ─── Delivered Handover Modal ───────────────────────────────────────────────
function DeliveredModal({ group, onClose, onConfirm, saving }) {
  const isCustomer = group.pickup_assignment?.delivery_to === "customer";
  const [receiverName, setReceiverName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!receiverName.trim()) e.receiverName = "Enter receiver name.";
    if (isCustomer) {
      if (!mobileNo.trim()) e.mobileNo = "Mobile number is required for customer delivery.";
      else if (!/^\+?[\d\s\-]{7,15}$/.test(mobileNo.trim())) e.mobileNo = "Enter a valid mobile number.";
    }
    return e;
  };

  const handleConfirm = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onConfirm({ receiverName: receiverName.trim(), mobileNo: mobileNo.trim() });
  };

  const destOpt = DELIVERY_OPTIONS.find(d => d.id === group.pickup_assignment?.delivery_to);
  const typeMeta = TYPE_META[group.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc" };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scale-in modal-box" style={{ maxWidth: 440 }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", padding: "20px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: typeMeta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {destOpt?.icon || "📦"}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Confirm Delivery</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{group.job_no} · {group.outsource_type}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{destOpt?.label} — {destOpt?.sub}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px 22px" }}>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18, lineHeight: 1.6 }}>
            Who received the items at <strong style={{ color: "#334155" }}>{destOpt?.label}</strong>?
            {isCustomer && <span style={{ color: "#be123c" }}> Mobile number is required for customer handover.</span>}
          </p>

          {/* Task summary */}
          <div style={{ marginBottom: 18, background: "#f8fafc", borderRadius: 12, padding: "10px 14px", border: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Tasks Being Delivered</div>
            {group.issues.map((issue, i) => (
              <div key={issue._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", padding: "3px 0", borderBottom: i < group.issues.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <span style={{ fontWeight: 600, color: "#334155" }}>{issue.issue_no}</span>
                <span>{issue.cart_item_name || "—"}</span>
                <span style={{ fontWeight: 600 }}>{issue.issued_qty || 0} sqft</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label required>Received By</Label>
              <input
                value={receiverName}
                onChange={e => { setReceiverName(e.target.value); setErrors(p => ({ ...p, receiverName: "" })); }}
                placeholder="Enter name of receiver"
                className={`opm-input ${errors.receiverName ? "err" : ""}`}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, display: "block" }}
              />
              <FieldErr msg={errors.receiverName} />
            </div>

            {isCustomer && (
              <div>
                <Label required>Customer Mobile Number</Label>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={e => { setMobileNo(e.target.value); setErrors(p => ({ ...p, mobileNo: "" })); }}
                  placeholder="+91 98765 43210"
                  className={`opm-input ${errors.mobileNo ? "err" : ""}`}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, display: "block" }}
                />
                <FieldErr msg={errors.mobileNo} />
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving} className="btn-primary"
            style={{ flex: 2, padding: "12px 0", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Spinner size={16} color="#fff" /> Saving…</> : "✅ Confirm Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Modal (multi-select issues) ────────────────────────────────────
function AssignModal({ groups, allIssues, admins, onClose, onSaved, onError }) {
  // Pre-select the first group's issues
  const [selectedIssueIds, setSelectedIssueIds] = useState(
    groups.length === 1 ? groups[0].issues.map(i => i._id) : []
  );
  const [userId,     setUserId]   = useState("");
  const [deliveryTo, setDelivery] = useState("");
  const [pickupTime, setTime]     = useState("");
  const [notes,      setNotes]    = useState("");
  const [saving,     setSaving]   = useState(false);
  const [errors,     setErrors]   = useState({});

  const isReassign = groups.length === 1 && !!groups[0].pickup_assignment;
  const minDT = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  // All unassigned issues (for multi-select)
  const eligibleIssues = allIssues.filter(i => !i.pickup_assignment && !i.is_deleted);

  // Group eligible issues by job+type for display
  const eligibleGroups = groupIssues(eligibleIssues);

  const toggleIssue = (id) => {
    setSelectedIssueIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleGroup = (grp) => {
    const ids = grp.issues.map(i => i._id);
    const allIn = ids.every(id => selectedIssueIds.includes(id));
    if (allIn) setSelectedIssueIds(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedIssueIds(prev => [...new Set([...prev, ...ids])]);
  };

  const validate = () => {
    const e = {};
    if (selectedIssueIds.length === 0) e.issues = "Select at least one task.";
    if (!userId)      e.userId      = "Select a pickup person.";
    if (!deliveryTo)  e.deliveryTo  = "Choose a delivery destination.";
    if (!pickupTime)  e.pickupTime  = "Set a pickup time.";
    else if (new Date(pickupTime) <= new Date()) e.pickupTime = "Must be a future time.";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const admin = admins.find(a => a._id === userId);
      const results = await Promise.all(
        selectedIssueIds.map(issueId =>
          apiCall(`/material/${issueId}/assign-pickup`, {
            method: "POST",
            body: JSON.stringify({
              assigned_to: { user_id: userId, name: admin?.name || "", role: admin?.role || "" },
              delivery_to: deliveryTo,
              pickup_time: pickupTime,
              notes: notes.trim(),
            }),
          })
        )
      );
      onSaved(results.map(r => r.data || r));
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const dest = DELIVERY_OPTIONS.find(d => d.id === deliveryTo);
  const selectedCount = selectedIssueIds.length;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scale-in modal-box">
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", padding: "20px 24px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>
              {isReassign ? "Re-assign Pickup" : "Assign Pickup Tasks"}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f8fafc" }}>
              {isReassign ? `${groups[0].job_no} · ${groups[0].outsource_type}` : "Select tasks to assign"}
            </div>
            {selectedCount > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
                {selectedCount} task{selectedCount !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "#ffffff18", border: "none", cursor: "pointer", padding: 8, borderRadius: 10, color: "#94a3b8" }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-scroll">
          <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Task selection (hidden in reassign mode for single group) */}
            {!isReassign && (
              <div>
                <Label required>Select Tasks</Label>
                {errors.issues && <FieldErr msg={errors.issues} />}
                {eligibleGroups.length === 0 ? (
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 10, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                    All tasks are already assigned
                  </div>
                ) : (
                  eligibleGroups.map(grp => {
                    const tm = TYPE_META[grp.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc" };
                    const allIn = grp.issues.every(i => selectedIssueIds.includes(i._id));
                    const someIn = grp.issues.some(i => selectedIssueIds.includes(i._id));
                    return (
                      <div key={grp.groupKey} style={{ marginBottom: 8 }}>
                        {/* Group header row */}
                        <div
                          onClick={() => toggleGroup(grp)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                            border: `1.5px solid ${allIn ? "#6366f1" : someIn ? "#c7d2fe" : "#e2e8f0"}`,
                            borderRadius: 10, cursor: "pointer",
                            background: allIn ? "#eef2ff" : someIn ? "#f5f3ff" : "#fff",
                            marginBottom: 4, transition: "all .15s",
                          }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5,
                            border: `2px solid ${allIn ? "#6366f1" : someIn ? "#818cf8" : "#cbd5e1"}`,
                            background: allIn ? "#6366f1" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, transition: "all .15s",
                          }}>
                            {(allIn || someIn) && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d={allIn ? "M2 6l3 3 5-5" : "M2 6h8"} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: 14 }}>{tm.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                              {grp.job_no} · <span style={{ textTransform: "capitalize", color: tm.color }}>{grp.outsource_type}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {grp.outsource_vendor} · {grp.issues.length} task{grp.issues.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                            {grp.issues.filter(i => selectedIssueIds.includes(i._id)).length}/{grp.issues.length}
                          </span>
                        </div>
                        {/* Individual issues within group */}
                        <div style={{ paddingLeft: 16 }}>
                          {grp.issues.map(issue => {
                            const checked = selectedIssueIds.includes(issue._id);
                            return (
                              <div key={issue._id}
                                onClick={() => { toggleIssue(issue._id); setErrors(p => ({ ...p, issues: "" })); }}
                                className={`checkbox-item ${checked ? "checked" : ""}`}
                                style={{ marginBottom: 4 }}>
                                <div style={{
                                  width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "#6366f1" : "#cbd5e1"}`,
                                  background: checked ? "#6366f1" : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                                }}>
                                  {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{issue.issue_no}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>{issue.issued_qty || 0} sqft</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                                    {issue.cart_item_name || "—"}
                                    {issue.design_file_label && issue.design_file_label !== "Other" &&
                                      <span style={{ marginLeft: 6, color: "#7e22ce" }}>· {issue.design_file_label}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Pickup person */}
            <div>
              <Label required>Pickup Person</Label>
              <select
                value={userId}
                onChange={e => { setUserId(e.target.value); setErrors(p => ({ ...p, userId: "" })); }}
                className={`opm-select ${errors.userId ? "err" : ""}`}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, cursor: "pointer" }}>
                <option value="">— Select person —</option>
                {admins.map(a => (
                  <option key={a._id} value={a._id}>{a.name}{a.role ? ` (${a.role})` : ""}</option>
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
                    <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: deliveryTo === opt.id ? "#4338ca" : "#64748b" }}>{opt.label}</span>
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
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px 22px", display: "flex", gap: 10, flexShrink: 0, borderTop: "1px solid #f1f5f9" }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary"
            style={{ flex: 2, padding: "12px 0", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving
              ? <><Spinner size={16} color="#fff" /> Assigning…</>
              : `${isReassign ? "↻ Re-assign" : "✓ Assign"} ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pickup Status Panel ────────────────────────────────────────────────────
function PickupStatusPanel({ group, isAdmin, currentUserId, onUpdated, onError, onDeliveredClick }) {
  const pa = group.pickup_assignment;
  const [updating, setUpdating] = useState(false);
  if (!pa) return null;

  const currentStatus = pa.status || "pending";
  const sm = PICKUP_STATUS_META[currentStatus] || PICKUP_STATUS_META.pending;
  const dest = DELIVERY_OPTIONS.find(d => d.id === pa.delivery_to);
  const { label: tl, past } = countdown(pa.pickup_time);
  const assigneeName = pa.assigned_to?.name || pa.assigned_to?.user_id?.name || "—";
  const assigneeId = pa.assigned_to?.user_id?._id || pa.assigned_to?.user_id || null;
  const isMyTask = assigneeId === currentUserId;

  const updateStatus = async (status) => {
    if (status === "delivered") { onDeliveredClick(group); return; }
    if (updating) return;
    setUpdating(true);
    try {
      const results = await Promise.all(
        group.issues.map(issue =>
          apiCall(`/material/${issue._id}/pickup/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          })
        )
      );
      onUpdated(group.groupKey, results.map(r => r.data || r), status);
    } catch (err) {
      onError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const canAct = isAdmin || isMyTask;

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${sm.dot}30`, overflow: "hidden" }}>
      {/* Assignment info */}
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
                {isMyTask && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", padding: "1px 6px", borderRadius: 99 }}>YOU</span>}
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

        {/* Timestamps */}
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            📋 Assigned: <span style={{ fontWeight: 600, color: "#64748b" }}>{fmtDate(pa.assigned_at)}</span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            🕐 Pickup: <span style={{ fontWeight: 600, color: "#64748b" }}>{fmtDate(pa.pickup_time)}</span>
          </div>
          {pa.collected_at && (
            <div style={{ fontSize: 10, color: "#0369a1" }}>
              📦 Collected: <span style={{ fontWeight: 600 }}>{fmtDate(pa.collected_at)}</span>
            </div>
          )}
          {pa.delivered_at && (
            <div style={{ fontSize: 10, color: "#15803d" }}>
              ✅ Delivered: <span style={{ fontWeight: 600 }}>{fmtDate(pa.delivered_at)}</span>
            </div>
          )}
        </div>

        {/* Receiver info (stored after delivery) */}
        {pa.received_by && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f040" }}>
            <div style={{ fontSize: 11, color: "#334155" }}>
              🤝 Received by: <strong>{pa.received_by}</strong>
              {pa.receiver_mobile && (
                <span style={{ marginLeft: 8, color: "#0284c7" }}>📱 {pa.receiver_mobile}</span>
              )}
            </div>
          </div>
        )}

        {pa.notes && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
            "{pa.notes}"
          </div>
        )}
      </div>

      {/* Action buttons */}
      {canAct && !["delivered", "cancelled"].includes(currentStatus) && (
        <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
          {currentStatus === "pending" && (
            <button onClick={() => updateStatus("collected")} disabled={updating}
              className="btn-sm"
              style={{ flex: 1, background: "#eff6ff", color: "#1d4ed8" }}>
              {updating ? "…" : "📦 Mark Collected"}
            </button>
          )}
          {currentStatus === "collected" && (
            <button onClick={() => updateStatus("delivered")} disabled={updating}
              className="btn-sm"
              style={{ flex: 1, background: "#f0fdf4", color: "#15803d" }}>
              {updating ? "…" : "✅ Mark Delivered"}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => updateStatus("cancelled")} disabled={updating}
              className="btn-sm"
              style={{ background: "#fef2f2", color: "#dc2626", flexShrink: 0 }}>
              {updating ? "…" : "✕"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Group Card ─────────────────────────────────────────────────────────────
function GroupCard({ group, isAdmin, currentUserId, onAssign, onStatusUpdated, onError, onDeliveredClick }) {
  const [expanded, setExpanded] = useState(false);
  const typeMeta = TYPE_META[group.outsource_type] || { icon: "📦", color: "#475569", bg: "#f8fafc", ring: "#e2e8f0" };
  const totalQty = group.issues.reduce((s, i) => s + (i.issued_qty || 0), 0);
  const assigneeName = group.pickup_assignment?.assigned_to?.name || null;
  const assigneeId = group.pickup_assignment?.assigned_to?.user_id?._id || group.pickup_assignment?.assigned_to?.user_id || null;
  const isMyTask = !isAdmin && assigneeId === currentUserId;

  return (
    <div className="group-card fade-up" style={{ "--card-accent": typeMeta.color }}>
      {/* Card header */}
      <div style={{ padding: "16px 18px 14px" }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em" }}>
                {group.job_no}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.ring}`,
                textTransform: "capitalize",
              }}>{typeMeta.icon} {group.outsource_type}</span>
              {isMyTask && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99,
                  background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", letterSpacing: ".06em",
                }}>MY TASK</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              🏭 <strong style={{ color: "#334155" }}>{group.outsource_vendor || "—"}</strong>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <div style={{ textAlign: "center", background: "#f8fafc", borderRadius: 10, padding: "6px 10px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{group.issues.length}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>TASKS</div>
            </div>
            {totalQty > 0 && (
              <div style={{ textAlign: "center", background: "#f8fafc", borderRadius: 10, padding: "6px 10px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{totalQty}</div>
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>SQFT</div>
              </div>
            )}
          </div>
        </div>

        {/* Task list (collapsed / expanded) */}
        <div style={{ marginBottom: 12 }}>
          {group.issues.slice(0, expanded ? group.issues.length : 2).map((issue) => {
            const sm = STATUS_META[issue.status] || STATUS_META.issued;
            return (
              <div key={issue._id} className="task-row">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{issue.issue_no}</span>
                    <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {issue.cart_item_name || "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {issue.issued_qty > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>{issue.issued_qty} sqft</span>
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
                      background: sm.bg, color: sm.text, border: `1px solid ${sm.ring}40`,
                    }}>{sm.label}</span>
                  </div>
                </div>
                {issue.design_file_label && issue.design_file_label !== "Other" && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "#7e22ce" }}>📎 {issue.design_file_label}</div>
                )}
                {issue.issue_notes && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>"{issue.issue_notes}"</div>
                )}
              </div>
            );
          })}

          {group.issues.length > 2 && (
            <button onClick={() => setExpanded(p => !p)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6366f1", fontWeight: 600, padding: "4px 0" }}>
              {expanded ? "▲ Show less" : `▼ Show ${group.issues.length - 2} more task${group.issues.length - 2 !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {/* Pickup section */}
        {group.pickup_assignment ? (
          <>
            <PickupStatusPanel
              group={group}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onUpdated={onStatusUpdated}
              onError={onError}
              onDeliveredClick={onDeliveredClick}
            />
            {isAdmin && !["delivered", "cancelled"].includes(group.pickup_assignment?.status) && (
              <button onClick={() => onAssign([group])} className="btn-ghost"
                style={{ width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12, fontWeight: 600 }}>
                ↻ Re-assign Pickup
              </button>
            )}
          </>
        ) : isAdmin ? (
          <button onClick={() => onAssign([group])} className="btn-primary"
            style={{ width: "100%", padding: "10px 0", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Assign Pickup
          </button>
        ) : (
          <div style={{ padding: "9px 12px", borderRadius: 10, background: "#fffbeb", border: "1px dashed #fcd34d", fontSize: 12, color: "#92400e", fontWeight: 500, textAlign: "center" }}>
            ⏳ Awaiting assignment
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="group-card" style={{ padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
      <div><div className="skeleton" style={{ width: 80, height: 15, marginBottom: 6 }} /><div className="skeleton" style={{ width: 120, height: 12 }} /></div>
      <div className="skeleton" style={{ width: 50, height: 50, borderRadius: 10 }} />
    </div>
    {[1,2].map(i => <div key={i} className="skeleton" style={{ width: "100%", height: 44, borderRadius: 10, marginBottom: 6 }} />)}
    <div className="skeleton" style={{ width: "100%", height: 36, borderRadius: 10 }} />
  </div>
);

// ─── Empty ──────────────────────────────────────────────────────────────────
const Empty = ({ icon, title, sub, action }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 10, textAlign: "center" }}>
    <div style={{ fontSize: 48 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>{title}</div>
    <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 280 }}>{sub}</div>
    {action}
  </div>
);

// ─── KPI Strip ──────────────────────────────────────────────────────────────
function KPIStrip({ stats, isAdmin }) {
  const chips = isAdmin
    ? [
        { label: "Groups",    value: stats.totalGroups, color: "#475569", bg: "#f1f5f9", ring: "#cbd5e1" },
        { label: "Unassigned",value: stats.unassigned,  color: "#c2410c", bg: "#fff7ed", ring: "#fed7aa" },
        { label: "Pending",   value: stats.pending,     color: "#b45309", bg: "#fffbeb", ring: "#fcd34d" },
        { label: "Collected", value: stats.collected,   color: "#0369a1", bg: "#f0f9ff", ring: "#bae6fd" },
        { label: "Delivered", value: stats.delivered,   color: "#15803d", bg: "#f0fdf4", ring: "#bbf7d0" },
      ]
    : [
        { label: "Assigned",  value: stats.totalGroups, color: "#4f46e5", bg: "#eef2ff", ring: "#c7d2fe" },
        { label: "Pending",   value: stats.pending,     color: "#b45309", bg: "#fffbeb", ring: "#fcd34d" },
        { label: "Collected", value: stats.collected,   color: "#0369a1", bg: "#f0f9ff", ring: "#bae6fd" },
        { label: "Delivered", value: stats.delivered,   color: "#15803d", bg: "#f0fdf4", ring: "#bbf7d0" },
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

// ─── Main Dashboard ─────────────────────────────────────────────────────────
function PickupDashboard() {
  const currentUser = useCurrentUser();
  const isAdmin = isAdminRole(currentUser?.role);

  const [issues,        setIssues]   = useState([]);
  const [admins,        setAdmins]   = useState([]);
  const [loadingIssues, setLI]       = useState(true);
  const [loadingAdmins, setLA]       = useState(true);
  const [issueErr,      setIssueErr] = useState(null);
  const [toast,         setToast]    = useState(null);
  const toastTimer = useRef(null);

  // Modals
  const [assignGroups,   setAssignGroups]   = useState(null); // groups[] for AssignModal
  const [deliveredGroup, setDeliveredGroup] = useState(null); // group for DeliveredModal
  const [deliverSaving,  setDeliverSaving]  = useState(false);

  // Filters
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [pickupFilter, setPickupFilter] = useState("all");
  const [search,       setSearch]       = useState("");

  const showToast = useCallback((msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLI(true); setIssueErr(null);
    try {
      let raw = [];
      if (isAdmin) {
        const data = await apiCall("/material/outsource?limit=200");
        raw = data.data?.issues || data.issues || [];
      } else {
        const data = await apiCall(`/material/pickups/user/${currentUser._id}?limit=200`);
        raw = data.data?.issues || data.issues || [];
      }
      setIssues(raw.filter(i => !i.is_deleted));
    } catch (err) {
      if (isAdmin) {
        try {
          const data2 = await apiCall("/material?limit=200");
          const raw2 = data2.data?.issues || data2.issues || [];
          setIssues(raw2.filter(i => i.calc_mode === "outsource" && !i.is_deleted));
        } catch { setIssueErr(err.message); }
      } else {
        setIssueErr(err.message);
      }
    } finally { setLI(false); }
  }, [isAdmin, currentUser._id]);

  useEffect(() => {
    if (!isAdmin) { setLA(false); return; }
    (async () => {
      try {
        const data = await apiCall("/admin/get_admin");
        const list = data.data || data.admins || data.users || data.result || (Array.isArray(data) ? data : []);
        setAdmins(list);
      } catch { setAdmins([]); }
      finally { setLA(false); }
    })();
  }, [isAdmin]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaved = useCallback((results) => {
    setIssues(prev => {
      const map = new Map(prev.map(i => [i._id, i]));
      results.forEach(r => {
        const existing = map.get(r.issue_id);
        if (existing) map.set(r.issue_id, { ...existing, pickup_assignment: r.pickup_assignment });
      });
      return Array.from(map.values());
    });
    setAssignGroups(null);
    showToast(`${results.length} task${results.length !== 1 ? "s" : ""} assigned successfully`);
  }, [showToast]);

  const handleStatusUpdated = useCallback((groupKey, results, newStatus) => {
    setIssues(prev => {
      const resultMap = new Map();
      results.forEach(r => {
        // Match by issue_no or find all from the group
        if (r.issue_no) resultMap.set(r.issue_no, r);
      });
      return prev.map(issue => {
        if (!issue.pickup_assignment) return issue;
        const matchedResult = resultMap.get(issue.issue_no);
        if (!matchedResult) return issue;
        return {
          ...issue,
          pickup_assignment: {
            ...issue.pickup_assignment,
            status:       matchedResult.pickup_status || newStatus,
            collected_at: matchedResult.collected_at,
            delivered_at: matchedResult.delivered_at,
          },
        };
      });
    });
    showToast(`Status updated → ${newStatus}`);
  }, [showToast]);

  const handleDeliveredConfirm = useCallback(async ({ receiverName, mobileNo }) => {
    if (!deliveredGroup) return;
    setDeliverSaving(true);
    try {
      const results = await Promise.all(
        deliveredGroup.issues.map(issue =>
          apiCall(`/material/${issue._id}/pickup/status`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "delivered",
              received_by: receiverName,
              receiver_mobile: mobileNo || undefined,
            }),
          })
        )
      );
      // Update state with receiver info
      setIssues(prev => prev.map(issue => {
        const matched = deliveredGroup.issues.find(gi => gi._id === issue._id);
        if (!matched || !issue.pickup_assignment) return issue;
        const r = results.find(res => (res.data || res).issue_no === issue.issue_no);
        const data = r?.data || r || {};
        return {
          ...issue,
          pickup_assignment: {
            ...issue.pickup_assignment,
            status:          "delivered",
            delivered_at:    data.delivered_at || new Date().toISOString(),
            received_by:     receiverName,
            receiver_mobile: mobileNo || null,
          },
        };
      }));
      setDeliveredGroup(null);
      showToast(`Delivered — received by ${receiverName}`);
    } catch (err) {
      showToast(err.message, false);
    } finally {
      setDeliverSaving(false);
    }
  }, [deliveredGroup, showToast]);

  const handleError = useCallback((msg) => showToast(msg, false), [showToast]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const allGroups = groupIssues(issues);

  const stats = {
    totalGroups: allGroups.length,
    unassigned:  allGroups.filter(g => !g.pickup_assignment).length,
    pending:     allGroups.filter(g => g.pickup_assignment?.status === "pending").length,
    collected:   allGroups.filter(g => g.pickup_assignment?.status === "collected").length,
    delivered:   allGroups.filter(g => g.pickup_assignment?.status === "delivered").length,
  };

  const allTypes = ["all", ...new Set(issues.map(i => i.outsource_type).filter(Boolean))];

  const filtered = allGroups.filter(group => {
    if (typeFilter !== "all" && group.outsource_type !== typeFilter) return false;
    if (pickupFilter === "unassigned" && group.pickup_assignment) return false;
    if (pickupFilter !== "all" && pickupFilter !== "unassigned" &&
        group.pickup_assignment?.status !== pickupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        group.job_no, group.outsource_type, group.outsource_vendor,
        group.pickup_assignment?.assigned_to?.name,
        ...group.issues.map(i => `${i.issue_no} ${i.cart_item_name}`),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const loading = loadingIssues || loadingAdmins;

  const tabs = isAdmin
    ? [
        { id: "all",        label: "All",        count: stats.totalGroups },
        { id: "unassigned", label: "Unassigned",  count: stats.unassigned  },
        { id: "pending",    label: "Pending",     count: stats.pending     },
        { id: "collected",  label: "Collected",   count: stats.collected   },
        { id: "delivered",  label: "Delivered",   count: stats.delivered   },
      ]
    : [
        { id: "all",       label: "All Tasks",  count: stats.totalGroups },
        { id: "pending",   label: "Pending",    count: stats.pending     },
        { id: "collected", label: "Collected",  count: stats.collected   },
        { id: "delivered", label: "Delivered",  count: stats.delivered   },
      ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <style>{CSS}</style>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8edf3", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ padding: "16px 0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#0f172a,#334155)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏭</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>
                  {isAdmin ? "Outsource Pickup Manager" : "My Pickup Tasks"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>
                    {isAdmin ? "Assign collection, destination & schedule" : `Logged in as ${currentUser.name}`}
                  </p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99,
                    fontSize: 11, fontWeight: 700,
                    background: isAdmin ? "#eef2ff" : "#f0fdf4",
                    color: isAdmin ? "#4f46e5" : "#16a34a",
                    border: `1px solid ${isAdmin ? "#c7d2fe" : "#bbf7d0"}`,
                  }}>
                    {isAdmin ? "🔑" : "👤"} {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <KPIStrip stats={stats} isAdmin={isAdmin} />
              {isAdmin && (
                <button onClick={() => setAssignGroups(allGroups.filter(g => !g.pickup_assignment))}
                  className="btn-primary"
                  style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                  + Bulk Assign
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
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

      {/* Filter bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8edf3" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "10px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flexGrow: 1, minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search job, type, vendor, person, issue no…"
              className="opm-input"
              style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {allTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill ${typeFilter === t ? "active" : ""}`}>
                {t === "all" ? "All Types" : `${TYPE_META[t]?.icon || ""} ${t}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px 64px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : issueErr ? (
          <Empty icon="⚠️" title="Failed to load" sub={issueErr}
            action={<button onClick={fetchIssues} className="btn-primary" style={{ marginTop: 8, padding: "9px 20px", fontSize: 13 }}>Retry</button>} />
        ) : allGroups.length === 0 ? (
          <Empty
            icon={isAdmin ? "📭" : "🎉"}
            title={isAdmin ? "No outsource issues" : "No tasks assigned"}
            sub={isAdmin ? "Outsource issues appear here once created." : "You have no pickup tasks assigned yet."} />
        ) : filtered.length === 0 ? (
          <Empty icon="🔍" title="No results" sub="Try adjusting your filters or search." />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#94a3b8" }}>
                <span style={{ color: "#334155", fontWeight: 700 }}>{filtered.length}</span> group{filtered.length !== 1 ? "s" : ""}
                {" "}({filtered.reduce((s, g) => s + g.issues.length, 0)} tasks)
                {(typeFilter !== "all" || pickupFilter !== "all" || search) ? " · filtered" : ""}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {filtered.map((group) => (
                <GroupCard
                  key={group.groupKey}
                  group={group}
                  isAdmin={isAdmin}
                  currentUserId={currentUser._id}
                  onAssign={(grps) => setAssignGroups(grps)}
                  onStatusUpdated={handleStatusUpdated}
                  onError={handleError}
                  onDeliveredClick={setDeliveredGroup}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Assign Modal */}
      {assignGroups && isAdmin && (
        <AssignModal
          groups={assignGroups}
          allIssues={issues}
          admins={admins}
          onClose={() => setAssignGroups(null)}
          onSaved={handleSaved}
          onError={handleError}
        />
      )}

      {/* Delivered / Handover Modal */}
      {deliveredGroup && (
        <DeliveredModal
          group={deliveredGroup}
          onClose={() => setDeliveredGroup(null)}
          onConfirm={handleDeliveredConfirm}
          saving={deliverSaving}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default PickupDashboard;