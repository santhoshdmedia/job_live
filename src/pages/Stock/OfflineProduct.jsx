/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback } from "react";
import {
  getAllStaff, createStaff, updateStaff, deleteStaff,
  toggleStaffAvail,
} from "../../api/staff.api";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = [
  "accounting team", "designing team", "quality check",
  "production team", "delivery team",
];

const ALL_PAGES = [
  "dashboard", "admin-job-management", "users", "my-jobs",
  "material-issue-manager", "admin-designer-job-dashboard", "production-panel", "staff",
  "quality-check-dashboard", "delivery-panel",
];

const ROLE_DEFAULT_PERMS = {
  "super admin": ALL_PAGES.map(p => ({ pageName: p, canView: true, canEdit: true, canDelete: true })),
  "Frontend admin": ALL_PAGES.map(p => ({ pageName: p, canView: true, canEdit: true, canDelete: false })),
  "Backend admin": ALL_PAGES.map(p => ({ pageName: p, canView: true, canEdit: true, canDelete: true })),
  "accounting team": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "admin-job-management", "my-jobs"].includes(p),
    canEdit: false, canDelete: false,
  })),
  "designing team": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "admin-designer-job-dashboard", "my-jobs"].includes(p),
    canEdit: ["admin-designer-job-dashboard", "my-jobs"].includes(p),
    canDelete: false,
  })),
  "quality check": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "quality-check-dashboard", "my-jobs"].includes(p),
    canEdit: ["quality-check-dashboard"].includes(p),
    canDelete: false,
  })),
  "production team": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "production-panel", "my-jobs", "material-issue-manager"].includes(p),
    canEdit: ["production-panel", "material-issue-manager"].includes(p),
    canDelete: false,
  })),
  "packing team": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "production-panel", "my-jobs"].includes(p),
    canEdit: ["production-panel"].includes(p),
    canDelete: false,
  })),
  "delivery team": ALL_PAGES.map(p => ({
    pageName: p,
    canView: ["dashboard", "delivery-panel", "my-jobs"].includes(p),
    canEdit: ["delivery-panel"].includes(p),
    canDelete: false,
  })),
};

const ROLE_COLORS = {
  "super admin":      { bg: "#1e293b", text: "#f8fafc", dot: "#94a3b8" },
  "Frontend admin":   { bg: "#ede9fe", text: "#5b21b6", dot: "#7c3aed" },
  "Backend admin":    { bg: "#dbeafe", text: "#1e40af", dot: "#2563eb" },
  "accounting team":  { bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  "designing team":   { bg: "#fce7f3", text: "#9d174d", dot: "#ec4899" },
  "quality check":    { bg: "#ffedd5", text: "#9a3412", dot: "#f97316" },
  "production team":  { bg: "#cffafe", text: "#164e63", dot: "#06b6d4" },
  "packing team":     { bg: "#f0fdf4", text: "#14532d", dot: "#22c55e" },
  "delivery team":    { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const initPerm = () => ALL_PAGES.map(p => ({ pageName: p, canView: false, canEdit: false, canDelete: false }));

const avatar = (name = "?") => name.trim()[0].toUpperCase();
const avatarColor = (name = "") => {
  const colors = ["#0d9488","#2563eb","#7c3aed","#db2777","#ea580c","#16a34a","#0891b2","#9333ea"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Global Styles ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  input, select, button, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; }

  :root {
    --primary: #0d9488;
    --primary-light: #f0fdf4;
    --primary-border: #99f6e4;
    --danger: #ef4444;
    --danger-light: #fff1f2;
    --warning: #f59e0b;
    --surface: #ffffff;
    --surface-2: #f8fafc;
    --surface-3: #f1f5f9;
    --border: #e8ecf0;
    --border-strong: #d1d9e0;
    --text-1: #0f172a;
    --text-2: #374151;
    --text-3: #64748b;
    --text-4: #94a3b8;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.10);
    --shadow-xl: 0 20px 60px rgba(0,0,0,0.12);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes sheetUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.92); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .staff-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1.5px solid var(--border);
    padding: 16px;
    transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s;
    cursor: pointer;
    display: block;
    width: 100%;
    text-align: left;
  }
  .staff-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  .staff-card:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 700;
    transition: all 0.15s;
  }
  .icon-btn:active { transform: scale(0.94); }

  .tab-btn {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: none;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-full);
    border: 1.5px solid var(--border);
    background: var(--surface);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-3);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .filter-chip.active {
    border-color: var(--primary);
    background: var(--primary-light);
    color: var(--primary);
  }
  .filter-chip:hover { border-color: var(--border-strong); }

  .perm-row {
    display: grid;
    grid-template-columns: 1fr 40px 40px 40px;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    transition: background 0.12s, border-color 0.12s;
  }
  .perm-row.active {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .perm-check {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: 2px solid;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 900;
    transition: all 0.15s;
    margin: 0 auto;
  }
  .perm-check:active { transform: scale(0.88); }

  /* Desktop table */
  .staff-table {
    width: 100%;
    border-collapse: collapse;
  }
  .staff-table thead tr {
    background: var(--surface-2);
    border-bottom: 1.5px solid var(--border);
  }
  .staff-table th {
    padding: 12px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 800;
    color: var(--text-4);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }
  .staff-table td {
    padding: 14px 16px;
    vertical-align: middle;
    border-bottom: 1px solid var(--border);
  }
  .staff-table tbody tr:last-child td { border-bottom: none; }
  .staff-table tbody tr {
    transition: background 0.12s;
  }
  .staff-table tbody tr:hover { background: var(--surface-2); }
  .staff-table .row-actions { opacity: 0; transition: opacity 0.15s; }
  .staff-table tbody tr:hover .row-actions { opacity: 1; }

  @media (max-width: 767px) {
    .hide-mobile { display: none !important; }
    .staff-table .row-actions { opacity: 1 !important; }
  }
  @media (min-width: 768px) {
    .hide-desktop { display: none !important; }
  }
`;

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 380,
    }}>
      {toasts.map(t => {
        const cfg = {
          error: { bg: "#ef4444", icon: "✕" },
          warn:  { bg: "#f59e0b", icon: "⚠" },
          success: { bg: "#0d9488", icon: "✓" },
        }[t.type] || { bg: "#0d9488", icon: "✓" };
        return (
          <div key={t.id} style={{
            background: cfg.bg, color: "#fff", borderRadius: 14,
            padding: "13px 18px", fontSize: 14, fontWeight: 700,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "toastIn 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{cfg.icon}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, color = "#0d9488", disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 46, height: 26, borderRadius: 13,
        background: value ? color : "#d1d9e0",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.22s", flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        boxShadow: value ? `0 0 0 3px ${color}30` : "none",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: value ? 23 : 3,
        transition: "left 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
      }} />
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function Confirm({ open, message, onOk, onCancel, loading }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      animation: "fadeIn 0.18s ease",
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, padding: "28px 24px",
        maxWidth: 340, width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.14)",
        animation: "slideUp 0.22s ease",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#fff1f2", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 26, margin: "0 auto 16px",
        }}>🗑️</div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 8, textAlign: "center" }}>Delete Staff Member?</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "13px", borderRadius: 14,
            border: "1.5px solid #e2e8f0", background: "#f8fafc",
            fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#475569",
          }}>Cancel</button>
          <button onClick={onOk} disabled={loading} style={{
            flex: 1, padding: "13px", borderRadius: 14, border: "none",
            background: loading ? "#fca5a5" : "#ef4444", color: "#fff",
            fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name = "?", src, size = 40, online }) {
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: avatarColor(name),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, fontWeight: 900, color: "#fff",
        overflow: "hidden",
      }}>
        {src
          ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : avatar(name)
        }
      </div>
      {online !== undefined && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.26, height: size * 0.26,
          borderRadius: "50%", border: "2px solid #fff",
          background: online ? "#22c55e" : "#d1d5db",
        }} />
      )}
    </div>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const rc = ROLE_COLORS[role] || { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "4px 10px",
      borderRadius: 999, background: rc.bg, color: rc.text,
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: rc.dot, display: "inline-block", flexShrink: 0 }} />
      {role}
    </span>
  );
}

// ─── Staff Modal ──────────────────────────────────────────────────────────────
function StaffModal({ open, onClose, onSaved, editData, toast }) {
  const isEdit = !!editData;
  const [tab, setTab] = useState("info");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "", profileImg: "", available: true });
  const [perms, setPerms] = useState(initPerm());
  const [permsCustomized, setPermsCustomized] = useState(false);

  useEffect(() => {
    if (!open) { setTab("info"); setPermsCustomized(false); return; }
    if (isEdit) {
      setForm({
        name: editData.name || "", email: editData.email || "",
        phone: editData.phone || "", password: "",
        role: editData.role || "", profileImg: editData.profileImg || "",
        available: editData.available !== false,
      });
      const merged = ALL_PAGES.map(p => {
        const existing = (editData.pagePermissions || []).find(x => x.pageName === p);
        return existing || { pageName: p, canView: false, canEdit: false, canDelete: false };
      });
      setPerms(merged);
      setPermsCustomized(true);
    } else {
      setForm({ name: "", email: "", phone: "", password: "", role: "", profileImg: "", available: true });
      setPerms(initPerm());
      setPermsCustomized(false);
    }
  }, [open, editData]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "role" && !permsCustomized) {
      const defaults = ROLE_DEFAULT_PERMS[v];
      if (defaults) setPerms(defaults.map(p => ({ ...p })));
      else setPerms(initPerm());
    }
  };

  const togglePerm = (page, field) => {
    setPermsCustomized(true);
    setPerms(p => p.map(x => x.pageName === page ? { ...x, [field]: !x[field] } : x));
  };

  const applyRoleDefaults = () => {
    const defaults = ROLE_DEFAULT_PERMS[form.role];
    if (defaults) { setPerms(defaults.map(p => ({ ...p }))); setPermsCustomized(false); }
  };

  const toggleAll = (field, value) => {
    setPermsCustomized(true);
    setPerms(p => p.map(x => ({ ...x, [field]: value })));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone || !form.role)
      return toast("Fill all required fields", "warn");
    if (!isEdit && !form.password.trim())
      return toast("Password is required for new staff", "warn");
    try {
      setLoading(true);
      const payload = { ...form, pagePermissions: perms };
      if (isEdit && !payload.password) delete payload.password;
      if (isEdit) { await updateStaff(editData._id, payload); toast("Staff updated"); }
      else { await createStaff(payload); toast("Staff created"); }
      onSaved(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || "Something went wrong", "error");
    } finally { setLoading(false); }
  };

  if (!open) return null;

  const activePermsCount = perms.filter(p => p.canView || p.canEdit || p.canDelete).length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "28px 28px 0 0",
        width: "100%", maxWidth: 600,
        maxHeight: "96vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -12px 60px rgba(0,0,0,0.15)",
        animation: "sheetUp 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Drag Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <div style={{ width: 44, height: 4, borderRadius: 99, background: "#e2e8f0" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 19, color: "#0f172a", letterSpacing: -0.3 }}>
              {isEdit ? "Edit Staff Member" : "Add New Staff"}
            </div>
            {isEdit && (
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{editData.email}</div>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: "#f1f5f9", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b",
            flexShrink: 0,
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", margin: "14px 20px 0", background: "#f1f5f9", borderRadius: 14, padding: 4, gap: 4 }}>
          {[
            ["info", "👤", "Info"],
            ["perms", "🔐", `Permissions${activePermsCount > 0 ? ` (${activePermsCount})` : ""}`],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="tab-btn"
              style={{
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#0f172a" : "#94a3b8",
                boxShadow: tab === key ? "0 2px 10px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "18px 20px" }}>
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Avatar Preview */}
              {(form.name || isEdit) && (
                <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
                  <Avatar name={form.name || "?"} src={form.profileImg} size={72} />
                </div>
              )}

              {/* Fields */}
              {[
                { key: "name",       label: "Full Name *",                    placeholder: "e.g. Ravi Kumar",                  type: "text" },
                { key: "email",      label: "Email Address *",                placeholder: "ravi@company.com",                 type: "email" },
                { key: "phone",      label: "Phone Number *",                 placeholder: "9876543210",                       type: "tel" },
                { key: "password",   label: isEdit ? "New Password" : "Password *", placeholder: isEdit ? "Leave blank to keep current" : "Min 6 characters", type: "password" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={styles.lbl}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    style={styles.inp}
                    autoComplete="off"
                  />
                </div>
              ))}

              {/* Role */}
              <div>
                <label style={styles.lbl}>Role *</label>
                <select value={form.role} onChange={e => set("role", e.target.value)} style={styles.inp}>
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {form.role && (
                  <div style={{
                    marginTop: 8, padding: "10px 14px", background: "#f0fdf4",
                    borderRadius: 10, border: "1px solid #bbf7d0",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 6,
                  }}>
                    <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>
                      ✓ Pre-filled for <strong>{form.role}</strong>
                      {permsCustomized && " (customized)"}
                    </span>
                    {permsCustomized && (
                      <button onClick={applyRoleDefaults} style={{
                        fontSize: 11, color: "#0d9488", fontWeight: 700,
                        background: "none", border: "none", cursor: "pointer", textDecoration: "underline",
                      }}>Reset defaults</button>
                    )}
                  </div>
                )}
              </div>

              {/* Available */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#f8fafc", borderRadius: 14, padding: "14px 16px",
                border: "1.5px solid #e8ecf0",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Available for Duty</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Can be assigned to tasks</div>
                </div>
                <Toggle value={form.available} onChange={v => set("available", v)} color="#0d9488" />
              </div>
            </div>
          )}

          {tab === "perms" && (
            <div>
              {form.role && (
                <div style={{
                  marginBottom: 14, padding: "10px 14px", background: "#eff6ff",
                  borderRadius: 10, border: "1px solid #bfdbfe",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
                    Role: <strong>{form.role}</strong> · {permsCustomized ? "Custom" : "Default"}
                  </span>
                  <button onClick={applyRoleDefaults} style={{
                    fontSize: 11, color: "#2563eb", fontWeight: 700,
                    background: "none", border: "none", cursor: "pointer", textDecoration: "underline", flexShrink: 0,
                  }}>Reset to defaults</button>
                </div>
              )}

              {/* Bulk buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  { label: "All View",   field: "canView",   color: "#2563eb" },
                  { label: "All Edit",   field: "canEdit",   color: "#0d9488" },
                  { label: "All Delete", field: "canDelete", color: "#ef4444" },
                ].map(({ label, field, color }) => (
                  <button key={field} onClick={() => toggleAll(field, true)} style={{
                    padding: "9px 4px", borderRadius: 10,
                    border: `1.5px solid ${color}44`,
                    background: `${color}12`,
                    color, fontWeight: 700, fontSize: 11, cursor: "pointer",
                  }}>{label} ✓</button>
                ))}
              </div>

              <button onClick={() => { setPerms(initPerm()); setPermsCustomized(true); }} style={{
                width: "100%", padding: "9px", borderRadius: 10,
                border: "1.5px solid #e2e8f0", background: "#f8fafc",
                color: "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 14,
              }}>Clear All Permissions</button>

              {/* Header row */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 40px 40px 40px", gap: 8,
                padding: "6px 12px", marginBottom: 6,
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Page</span>
                {["View", "Edit", "Del"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
                ))}
              </div>

              {/* Permission rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {perms.map(p => {
                  const any = p.canView || p.canEdit || p.canDelete;
                  return (
                    <div key={p.pageName} className={`perm-row${any ? " active" : ""}`}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: any ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pageName}</span>
                      </div>
                      {[
                        { field: "canView",   color: "#2563eb" },
                        { field: "canEdit",   color: "#0d9488" },
                        { field: "canDelete", color: "#ef4444" },
                      ].map(({ field, color }) => (
                        <button
                          key={field}
                          onClick={() => togglePerm(p.pageName, field)}
                          className="perm-check"
                          style={{
                            borderColor: p[field] ? color : "#d1d9e0",
                            background: p[field] ? color : "#fff",
                            color: p[field] ? "#fff" : "#d1d9e0",
                          }}
                        >
                          {p[field] ? "✓" : ""}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px 28px", borderTop: "1px solid #f1f5f9",
          display: "flex", gap: 10,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "14px", borderRadius: 16,
            border: "1.5px solid #e2e8f0", background: "#f8fafc",
            fontWeight: 700, fontSize: 15, cursor: "pointer", color: "#475569",
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: "14px", borderRadius: 16, border: "none",
            background: loading ? "#94a3b8" : "#0d9488", color: "#fff",
            fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Permission Viewer Sheet ──────────────────────────────────────────────────
function PermSheet({ open, staff, onClose }) {
  if (!open || !staff) return null;
  const perms = staff.pagePermissions || [];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: "#fff", borderRadius: "28px 28px 0 0",
        width: "100%", maxWidth: 540, maxHeight: "82vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -12px 60px rgba(0,0,0,0.14)",
        animation: "sheetUp 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <div style={{ width: 44, height: 4, borderRadius: 99, background: "#e2e8f0" }} />
        </div>
        <div style={{
          padding: "12px 20px 14px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>🔐 Access Permissions</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{staff.name}</div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: "#f1f5f9", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b",
          }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px 32px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 40px 40px 40px", gap: 8,
            padding: "0 12px 10px", borderBottom: "1px solid #f1f5f9", marginBottom: 8,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Page</span>
            {["View", "Edit", "Del"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ALL_PAGES.map(pg => {
              const p = perms.find(x => x.pageName === pg) || { canView: false, canEdit: false, canDelete: false };
              const any = p.canView || p.canEdit || p.canDelete;
              return (
                <div key={pg} className={`perm-row${any ? " active" : ""}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: any ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pg}</span>
                  </div>
                  {[p.canView, p.canEdit, p.canDelete].map((val, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <span style={{ fontSize: val ? 18 : 14, color: val ? "#16a34a" : "#d1d9e0" }}>
                        {val ? "✅" : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Staff Card ────────────────────────────────────────────────────────
function StaffCard({ s, onEdit, onDelete, onToggle, toggling, onViewPerms }) {
  const permCount = (s.pagePermissions || []).filter(p => p.canView || p.canEdit || p.canDelete).length;
  return (
    <div style={{
      background: "#fff", borderRadius: 18,
      border: "1.5px solid #e8ecf0", padding: "14px 16px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      animation: "slideUp 0.2s ease",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <Avatar name={s.name} src={s.profileImg} size={46} online={s.isOnline} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
        </div>
        <Toggle value={s.available} onChange={() => onToggle(s)} disabled={toggling} color="#0d9488" />
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <RoleBadge role={s.role} />
        {s.phone && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px",
            borderRadius: 999, background: "#f1f5f9", color: "#64748b",
          }}>📞 {String(s.phone)}</span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "4px 10px",
          borderRadius: 999,
          background: s.available ? "#f0fdf4" : "#f8fafc",
          color: s.available ? "#0d9488" : "#94a3b8",
        }}>
          {s.available ? "● On Duty" : "○ Off Duty"}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => onViewPerms(s)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "8px 12px", borderRadius: 10,
          border: "1.5px solid #bfdbfe", background: "#eff6ff",
          color: "#2563eb", fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}>
          🔐 {permCount} pages
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onEdit(s)} style={{
          padding: "8px 14px", borderRadius: 10,
          border: "1.5px solid #0d948844", background: "#f0fdf4",
          color: "#0d9488", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>✏️ Edit</button>
        <button onClick={() => onDelete(s)} style={{
          width: 36, height: 36, borderRadius: 10,
          border: "1.5px solid #ef444433", background: "#fff1f2",
          color: "#ef4444", fontWeight: 700, fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>🗑️</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState({ open: false, data: null });
  const [confirm, setConfirm] = useState({ open: false, staff: null, loading: false });
  const [permSheet, setPermSheet] = useState({ open: false, staff: null });
  const { toasts, push } = useToast();

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (availFilter) params.available = availFilter;
      if (search.trim()) params.search = search.trim();
      const res = await getAllStaff(params);
      setStaff(res.data.data || []);
    } catch (e) {
      push(e?.response?.data?.message || "Failed to load staff", "error");
    } finally { setLoading(false); }
  }, [search, roleFilter, availFilter]);

  useEffect(() => {
    const t = setTimeout(fetchStaff, 300);
    return () => clearTimeout(t);
  }, [fetchStaff]);

  const handleDelete = async () => {
    try {
      setConfirm(c => ({ ...c, loading: true }));
      await deleteStaff(confirm.staff._id);
      push("Staff member deleted");
      setConfirm({ open: false, staff: null, loading: false });
      fetchStaff();
    } catch (e) {
      push(e?.response?.data?.message || "Delete failed", "error");
      setConfirm(c => ({ ...c, loading: false }));
    }
  };

  const handleToggle = async (s) => {
    try {
      setTogglingId(s._id);
      await toggleStaffAvail(s._id);
      setStaff(prev => prev.map(x => x._id === s._id ? { ...x, available: !x.available } : x));
    } catch {
      push("Update failed", "error");
    } finally { setTogglingId(null); }
  };

  const onDuty  = staff.filter(s => s.available).length;
  const online  = staff.filter(s => s.isOnline).length;
  const hasFilters = roleFilter || availFilter;

  const stats = [
    { label: "Total",    value: staff.length, color: "#0d9488", bg: "#f0fdf4" },
    { label: "On Duty",  value: onDuty,        color: "#2563eb", bg: "#eff6ff" },
    { label: "Online",   value: online,         color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Off Duty", value: staff.length - onDuty, color: "#64748b", bg: "#f8fafc" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Sticky Header ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #eaecef",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 16px 0" }}>

          {/* Title + Add */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", letterSpacing: -0.4, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>👥</span> Staff
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                {staff.length} members · {onDuty} on duty
              </div>
            </div>
            <button
              onClick={() => setModal({ open: true, data: null })}
              style={{
                background: "#0d9488", border: "none", color: "#fff",
                borderRadius: 14, padding: "11px 18px",
                fontWeight: 800, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              <span className="hide-mobile">Add Staff</span>
            </button>
          </div>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
            {stats.map(({ label, value, color, bg }) => (
              <div key={label} style={{
                flexShrink: 0, background: bg, borderRadius: 12,
                padding: "8px 16px", display: "flex", alignItems: "center",
                gap: 7, border: `1px solid ${color}20`,
              }}>
                <span style={{ fontWeight: 900, fontSize: 18, color, lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div style={{ paddingBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
                <input
                  placeholder="Search name, email, phone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...styles.inp, paddingLeft: 38, background: "#f8fafc", fontSize: 13 }}
                />
              </div>
              {/* Filter toggle btn */}
              <button
                onClick={() => setShowFilters(f => !f)}
                style={{
                  padding: "10px 14px", borderRadius: 14,
                  border: `1.5px solid ${hasFilters ? "#0d9488" : "#e2e8f0"}`,
                  background: hasFilters ? "#f0fdf4" : "#f8fafc",
                  color: hasFilters ? "#0d9488" : "#64748b",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                }}
              >
                <span>⚙️</span>
                <span className="hide-mobile">Filter</span>
                {hasFilters && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0d9488", flexShrink: 0 }} />}
              </button>
            </div>

            {/* Expandable filters */}
            {showFilters && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", animation: "slideUp 0.18s ease" }}>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...styles.inp, flex: "1 1 160px", minWidth: 130, fontSize: 13, background: "#f8fafc" }}>
                  <option value="">All Roles</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={availFilter} onChange={e => setAvailFilter(e.target.value)} style={{ ...styles.inp, flex: "1 1 130px", minWidth: 110, fontSize: 13, background: "#f8fafc" }}>
                  <option value="">All Status</option>
                  <option value="true">On Duty</option>
                  <option value="false">Off Duty</option>
                </select>
                {hasFilters && (
                  <button onClick={() => { setRoleFilter(""); setAvailFilter(""); }} style={{
                    padding: "10px 14px", borderRadius: 14,
                    border: "1.5px solid #ef444433", background: "#fff1f2",
                    color: "#ef4444", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0,
                  }}>Clear filters</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 16px 32px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 20px", gap: 14 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
            <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Loading staff…</div>
          </div>
        )}

        {/* Empty */}
        {!loading && staff.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 20, padding: "64px 24px",
            textAlign: "center", border: "1.5px dashed #e2e8f0",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>👤</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b", marginBottom: 8 }}>No staff found</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28, maxWidth: 280, margin: "0 auto 28px" }}>
              {search || hasFilters ? "Try adjusting your search or filters" : "Add your first team member to get started"}
            </div>
            {!search && !hasFilters && (
              <button onClick={() => setModal({ open: true, data: null })} style={{
                background: "#0d9488", border: "none", color: "#fff",
                borderRadius: 16, padding: "13px 28px", fontWeight: 800,
                fontSize: 15, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(13,148,136,0.3)",
              }}>+ Add First Staff Member</button>
            )}
          </div>
        )}

        {/* Mobile Cards */}
        {!loading && staff.length > 0 && (
          <>
            {/* Mobile: card grid */}
            <div className="hide-desktop" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {staff.map(s => (
                <StaffCard
                  key={s._id}
                  s={s}
                  onEdit={s => setModal({ open: true, data: s })}
                  onDelete={s => setConfirm({ open: true, staff: s, loading: false })}
                  onToggle={handleToggle}
                  toggling={togglingId === s._id}
                  onViewPerms={s => setPermSheet({ open: true, staff: s })}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hide-mobile" style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8ecf0", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Permissions</th>
                      <th>Duty Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => {
                      const permCount = (s.pagePermissions || []).filter(p => p.canView || p.canEdit || p.canDelete).length;
                      return (
                        <tr key={s._id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <Avatar name={s.name} src={s.profileImg} size={40} online={s.isOnline} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{s.name}</div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                            {s.phone ? String(s.phone) : "—"}
                          </td>
                          <td><RoleBadge role={s.role} /></td>
                          <td>
                            <button
                              onClick={() => setPermSheet({ open: true, staff: s })}
                              style={{
                                fontSize: 11, fontWeight: 700, padding: "5px 12px",
                                borderRadius: 999, cursor: "pointer",
                                background: permCount > 0 ? "#eff6ff" : "#f8fafc",
                                color: permCount > 0 ? "#2563eb" : "#94a3b8",
                                border: `1.5px solid ${permCount > 0 ? "#bfdbfe" : "#e2e8f0"}`,
                              }}
                            >
                              🔐 {permCount} pages
                            </button>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <Toggle
                                value={s.available}
                                onChange={() => handleToggle(s)}
                                disabled={togglingId === s._id}
                                color="#0d9488"
                              />
                              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: s.available ? "#0d9488" : "#94a3b8" }}>
                                {togglingId === s._id ? "…" : s.available ? "ON DUTY" : "OFF DUTY"}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="row-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                onClick={() => setModal({ open: true, data: s })}
                                style={{
                                  padding: "7px 14px", borderRadius: 10,
                                  border: "1.5px solid #0d948833", background: "#f0fdf4",
                                  color: "#0d9488", fontWeight: 700, fontSize: 12, cursor: "pointer",
                                }}
                              >✏️ Edit</button>
                              <button
                                onClick={() => setConfirm({ open: true, staff: s, loading: false })}
                                style={{
                                  padding: "7px 10px", borderRadius: 10,
                                  border: "1.5px solid #ef444433", background: "#fff1f2",
                                  color: "#ef4444", fontWeight: 700, fontSize: 12, cursor: "pointer",
                                }}
                              >🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: "#c4cbd5", marginTop: 16, fontWeight: 600 }}>
              Showing {staff.length} staff member{staff.length !== 1 ? "s" : ""}
            </div>
          </>
        )}
      </div>

      {/* ── Modals / Sheets ── */}
      <StaffModal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        onSaved={fetchStaff}
        editData={modal.data}
        toast={push}
      />
      <PermSheet
        open={permSheet.open}
        staff={permSheet.staff}
        onClose={() => setPermSheet({ open: false, staff: null })}
      />
      <Confirm
        open={confirm.open}
        message={`This will permanently delete "${confirm.staff?.name}". This action cannot be undone.`}
        loading={confirm.loading}
        onOk={handleDelete}
        onCancel={() => setConfirm({ open: false, staff: null, loading: false })}
      />
      <Toast toasts={toasts} />
    </div>
  );
}

// ─── Micro-styles ─────────────────────────────────────────────────────────────
const styles = {
  lbl: {
    display: "block", fontSize: 11, fontWeight: 800, color: "#64748b",
    marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5,
  },
  inp: {
    width: "100%", border: "1.5px solid #e8ecf0", borderRadius: 12,
    padding: "11px 14px", fontSize: 14, color: "#1e293b",
    background: "#fff", fontFamily: "inherit", transition: "border-color 0.15s",
  },
};