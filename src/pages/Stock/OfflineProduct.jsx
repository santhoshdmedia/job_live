/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback } from "react";
import {
  getAllStaff, createStaff, updateStaff, deleteStaff,
  toggleStaffAvail,
} from "../../api/staff.api";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = [
  "super admin", "Frontend admin", "Backend admin",
  "accounting team", "designing team", "quality check",
  "production team", "packing team", "delivery team",
];

const ALL_PAGES = [
  "dashboard", "admin-job-management", "users", "my-jobs",
  "material-issue-manager", "admin-designer-job-dashboard", "production-panel", "staff",
  "quality-check-dashboard", "delivery-panel",
];

// ─── Role → default permissions ───────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const avatar = (name = "?") => name.trim()[0].toUpperCase();
const avatarColor = (name = "") => {
  const colors = ["#0d9488","#2563eb","#7c3aed","#db2777","#ea580c","#16a34a","#0891b2","#9333ea"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 400 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? "#ef4444" : t.type === "warn" ? "#f59e0b" : "#0d9488",
          color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 32px #0004", display: "flex", alignItems: "center", gap: 8,
          animation: "slideUp 0.25s ease",
        }}>
          <span>{t.type === "error" ? "✕" : t.type === "warn" ? "⚠" : "✓"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, push };
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function Confirm({ open, message, onOk, onCancel, loading }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 320, width: "100%", boxShadow: "0 20px 60px #0003", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b", marginBottom: 8 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#475569" }}>Cancel</button>
          <button onClick={onOk} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, color = "#0d9488", disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 42, height: 22, borderRadius: 11,
        background: value ? color : "#e2e8f0",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.2s", flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: value ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 4px #0003",
      }} />
    </div>
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
    // Auto-apply role permissions when role changes (for new staff or if not manually customized)
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
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#00000077", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 560, maxHeight: "95vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px #0003" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "#e2e8f0" }} />
        </div>
        <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>{isEdit ? "Edit Staff" : "Add New Staff"}</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>×</button>
        </div>
        <div style={{ display: "flex", margin: "14px 20px 0", background: "#f1f5f9", borderRadius: 12, padding: 4, gap: 4 }}>
          {[["info", "👤 Info"], ["perms", `🔐 Permissions${activePermsCount > 0 ? ` (${activePermsCount})` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "none", fontWeight: 700, fontSize: 13,
              background: tab === key ? "#fff" : "transparent",
              color: tab === key ? "#0f172a" : "#94a3b8",
              cursor: "pointer", boxShadow: tab === key ? "0 2px 8px #0001" : "none", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 24px" }}>
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(form.name || isEdit) && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: avatarColor(form.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff", boxShadow: "0 4px 16px #0002" }}>
                    {form.profileImg ? <img src={form.profileImg} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : avatar(form.name || "?")}
                  </div>
                </div>
              )}
              {[
                { key: "name", label: "Full Name *", placeholder: "e.g. Ravi Kumar", type: "text" },
                { key: "email", label: "Email *", placeholder: "ravi@company.com", type: "email" },
                { key: "phone", label: "Phone *", placeholder: "9876543210", type: "tel" },
                { key: "password", label: isEdit ? "New Password (leave blank to keep)" : "Password *", placeholder: isEdit ? "Leave blank to keep current" : "Min 6 characters", type: "password" },
                { key: "profileImg", label: "Profile Image URL", placeholder: "https://...", type: "url" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={lbl}>{label}</label>
                  <input type={type} placeholder={placeholder} value={form[key]} onChange={e => set(key, e.target.value)} style={inp} autoComplete="off" />
                </div>
              ))}

              <div>
                <label style={lbl}>Role *</label>
                <select value={form.role} onChange={e => set("role", e.target.value)} style={inp}>
                  <option value="">Select role...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {form.role && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>
                      ✓ Permissions pre-filled for <strong>{form.role}</strong>
                      {permsCustomized && " (customized)"}
                    </span>
                    {permsCustomized && (
                      <button onClick={applyRoleDefaults} style={{ fontSize: 11, color: "#0d9488", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        Reset to defaults
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1.5px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Available</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Can be assigned to tasks</div>
                </div>
                <Toggle value={form.available} onChange={v => set("available", v)} color="#0d9488" />
              </div>
            </div>
          )}

          {tab === "perms" && (
            <div>
              {form.role && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>Role: <strong>{form.role}</strong>{permsCustomized ? " · Custom" : " · Default"}</span>
                  <button onClick={applyRoleDefaults} style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Reset to role defaults
                  </button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[{ label: "All View", field: "canView", color: "#2563eb" }, { label: "All Edit", field: "canEdit", color: "#0d9488" }, { label: "All Delete", field: "canDelete", color: "#ef4444" }].map(({ label, field, color }) => (
                  <button key={field} onClick={() => toggleAll(field, true)} style={{ padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${color}33`, background: `${color}11`, color, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                    {label} ✓
                  </button>
                ))}
              </div>
              <button onClick={() => { setPerms(initPerm()); setPermsCustomized(true); }} style={{ width: "100%", padding: "8px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 14 }}>
                Clear All Permissions
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 54px", gap: 6, padding: "6px 10px", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Page</span>
                  {["View", "Edit", "Del"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textAlign: "center", textTransform: "uppercase" }}>{h}</span>)}
                </div>
                {perms.map(p => {
                  const any = p.canView || p.canEdit || p.canDelete;
                  return (
                    <div key={p.pageName} style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 54px", gap: 6, padding: "10px 10px", borderRadius: 10, alignItems: "center", background: any ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${any ? "#bbf7d0" : "#f1f5f9"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: any ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textTransform: "capitalize" }}>{p.pageName}</span>
                      </div>
                      {[{ field: "canView", color: "#2563eb" }, { field: "canEdit", color: "#0d9488" }, { field: "canDelete", color: "#ef4444" }].map(({ field, color }) => (
                        <div key={field} style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(p.pageName, field)} style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${p[field] ? color : "#e2e8f0"}`, background: p[field] ? color : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: p[field] ? "#fff" : "#cbd5e1", transition: "all 0.15s" }}>
                            {p[field] ? "✓" : ""}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 24px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: 15, cursor: "pointer", color: "#475569" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: "13px", borderRadius: 14, border: "none", background: loading ? "#94a3b8" : "#0d9488", color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#00000066", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px #0003" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}><div style={{ width: 40, height: 4, borderRadius: 99, background: "#e2e8f0" }} /></div>
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>🔐 Permissions</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{staff.name}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 54px", gap: 6, padding: "0 10px 8px", borderBottom: "1px solid #f1f5f9", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Page</span>
            {["View", "Edit", "Del"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textAlign: "center", textTransform: "uppercase" }}>{h}</span>)}
          </div>
          {ALL_PAGES.map(pg => {
            const p = perms.find(x => x.pageName === pg) || { canView: false, canEdit: false, canDelete: false };
            const any = p.canView || p.canEdit || p.canDelete;
            return (
              <div key={pg} style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 54px", gap: 6, padding: "10px 10px", borderRadius: 10, background: any ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${any ? "#bbf7d0" : "#f1f5f9"}`, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: any ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textTransform: "capitalize" }}>{pg}</span>
                </div>
                {[p.canView, p.canEdit, p.canDelete].map((val, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                    <span style={{ fontSize: 16 }}>{val ? "✅" : "—"}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
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
      push("Staff deleted");
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
    } catch (e) {
      push("Update failed", "error");
    } finally { setTogglingId(null); }
  };

  const onDuty = staff.filter(s => s.available).length;
  const online = staff.filter(s => s.isOnline).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { outline: none; border-color: #0d9488 !important; }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .row-hover:hover { background: #f8fafc !important; }
        .action-btn { opacity: 0; transition: opacity 0.15s; }
        tr:hover .action-btn { opacity: 1; }
        @media (max-width: 768px) {
          .desktop-col { display: none !important; }
          .action-btn { opacity: 1 !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "16px 20px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#0f172a", letterSpacing: -0.5 }}>👥 Staff</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>{staff.length} members · {onDuty} on duty · {online} online</div>
            </div>
            <button onClick={() => setModal({ open: true, data: null })} style={{ background: "#0d9488", border: "none", color: "#fff", borderRadius: 12, padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              + Add Staff
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
            {[
              { label: "Total", value: staff.length, color: "#0d9488", bg: "#f0fdf4" },
              { label: "On Duty", value: onDuty, color: "#2563eb", bg: "#eff6ff" },
              { label: "Online", value: online, color: "#7c3aed", bg: "#f5f3ff" },
              { label: "Off Duty", value: staff.length - onDuty, color: "#64748b", bg: "#f8fafc" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ flexShrink: 0, background: bg, borderRadius: 10, padding: "6px 14px", display: "flex", gap: 6, alignItems: "center", border: `1px solid ${color}22` }}>
                <span style={{ fontWeight: 900, fontSize: 16, color }}>{value}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>🔍</span>
              <input placeholder="Search name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 36, background: "#f8fafc", fontSize: 13 }} />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inp, flex: "0 1 180px", fontSize: 13, background: "#f8fafc" }}>
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={availFilter} onChange={e => setAvailFilter(e.target.value)} style={{ ...inp, flex: "0 1 130px", fontSize: 13, background: "#f8fafc" }}>
              <option value="">All Status</option>
              <option value="true">On Duty</option>
              <option value="false">Off Duty</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ maxWidth: 1200, margin: "20px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", boxShadow: "0 2px 16px #0000000a", overflow: "hidden" }}>

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 56 }}>
              <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}

          {!loading && staff.length === 0 && (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>👤</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#1e293b", marginBottom: 6 }}>No staff found</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>Add your first team member to get started</div>
              <button onClick={() => setModal({ open: true, data: null })} style={{ background: "#0d9488", border: "none", color: "#fff", borderRadius: 14, padding: "13px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>+ Add Staff</button>
            </div>
          )}

          {!loading && staff.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #f0f0f0" }}>
                    <th style={th}>Staff</th>
                    <th style={{ ...th, minWidth: 80 }} className="desktop-col">Phone</th>
                    <th style={th}>Role</th>
                    <th style={{ ...th, minWidth: 80 }} className="desktop-col">Permissions</th>
                    <th style={{ ...th, minWidth: 80 }}>Status</th>
                    <th style={{ ...th, minWidth: 110, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s, idx) => {
                    const rc = ROLE_COLORS[s.role] || { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" };
                    const permCount = (s.pagePermissions || []).filter(p => p.canView || p.canEdit || p.canDelete).length;
                    return (
                      <tr key={s._id} className="row-hover" style={{ borderBottom: idx < staff.length - 1 ? "1px solid #f8fafc" : "none", background: "#fff", transition: "background 0.12s" }}>

                        {/* Staff info */}
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 38, height: 38, borderRadius: "50%", background: avatarColor(s.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff", flexShrink: 0, position: "relative" }}>
                              {s.profileImg ? <img src={s.profileImg} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : avatar(s.name)}
                              <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: s.isOnline ? "#22c55e" : "#d1d5db", border: "2px solid #fff" }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap" }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{s.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td style={{ ...td, color: "#64748b", fontSize: 13 }} className="desktop-col">
                          {s.phone ? String(s.phone) : "—"}
                        </td>

                        {/* Role */}
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: rc.bg, color: rc.text, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: rc.dot, display: "inline-block" }} />
                            {s.role}
                          </span>
                        </td>

                        {/* Permissions */}
                        <td style={td} className="desktop-col">
                          <button
                            onClick={() => setPermSheet({ open: true, staff: s })}
                            style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: permCount > 0 ? "#eff6ff" : "#f8fafc", color: permCount > 0 ? "#2563eb" : "#94a3b8", cursor: "pointer", border: `1px solid ${permCount > 0 ? "#bfdbfe" : "#e2e8f0"}`, whiteSpace: "nowrap" }}
                          >
                            🔐 {permCount} pages
                          </button>
                        </td>

                        {/* Available toggle */}
                        <td style={td}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                            <Toggle
                              value={s.available}
                              onChange={() => handleToggle(s)}
                              disabled={togglingId === s._id}
                              color="#0d9488"
                            />
                            <span style={{ fontSize: 9, color: s.available ? "#0d9488" : "#94a3b8", fontWeight: 700, letterSpacing: 0.4 }}>
                              {togglingId === s._id ? "…" : s.available ? "ON DUTY" : "OFF DUTY"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ ...td, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              className="action-btn"
                              onClick={() => setModal({ open: true, data: s })}
                              style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #0d948833", background: "#f0fdf4", color: "#0d9488", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => setConfirm({ open: true, staff: s, loading: false })}
                              style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #ef444433", background: "#fff1f2", color: "#ef4444", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Row count */}
        {!loading && staff.length > 0 && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 12, fontWeight: 600 }}>
            Showing {staff.length} staff member{staff.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <StaffModal open={modal.open} onClose={() => setModal({ open: false, data: null })} onSaved={fetchStaff} editData={modal.data} toast={push} />
      <PermSheet open={permSheet.open} staff={permSheet.staff} onClose={() => setPermSheet({ open: false, staff: null })} />
      <Confirm open={confirm.open} message={`This will permanently delete "${confirm.staff?.name}". This cannot be undone.`} loading={confirm.loading} onOk={handleDelete} onCancel={() => setConfirm({ open: false, staff: null, loading: false })} />
      <Toast toasts={toasts} />
    </div>
  );
}

// ─── Micro-styles ─────────────────────────────────────────────────────────────
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 };
const inp = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "#1e293b", background: "#fff", fontFamily: "inherit", transition: "border-color 0.15s" };
const th = { padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" };
const td = { padding: "13px 16px", verticalAlign: "middle" };