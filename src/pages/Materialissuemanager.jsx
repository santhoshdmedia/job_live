import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = "https://api.dmedia.in/api";

const WASTAGE_REASONS = [
  { value: "margin_trim", label: "Margin trim (top/bottom)" },
  { value: "misprint", label: "Misprint" },
  { value: "roll_end", label: "End of roll" },
  { value: "color_calibration", label: "Color calibration" },
  { value: "customer_change", label: "Customer spec change" },
  { value: "equipment_fault", label: "Equipment fault" },
  { value: "other", label: "Other" },
];

const OUTSOURCE_TYPES = [
  { value: "none", label: "In-House (No Outsource)" },
  { value: "printing", label: "Printing" },
  { value: "lamination", label: "Lamination" },
  { value: "fabrication", label: "Fabrication" },
  { value: "installation", label: "Installation" },
  { value: "cutting", label: "Cutting / Finishing" },
  { value: "full_job", label: "Full Job Outsource" },
  { value: "other", label: "Other" },
];

const UNIT_OPTIONS = [
  { value: "ft", label: "ft" },
  { value: "in", label: "in" },
  { value: "m", label: "m" },
  { value: "cm", label: "cm" },
];

const toFeet = (val, unit) => {
  const v = parseFloat(val) || 0;
  switch (unit) {
    case "in": return v / 12;
    case "m":  return v * 3.28084;
    case "cm": return v / 30.48;
    default:   return v;
  }
};

// ─── API helper ───────────────────────────────────────────────────────────────
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

// ─── PDF Slip ─────────────────────────────────────────────────────────────────
const generateSlipPDF = (issue, user) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const outsourceLabel = OUTSOURCE_TYPES.find(o => o.value === issue?.outsource_type)?.label || "In-House";
  const isOut = issue?.outsource_type && issue?.outsource_type !== "none";
  const p = issue?.printing_dimensions;
  const m = issue?.media_dimensions;
  const pSqFt = p ? (toFeet(p.width, p.unit) * toFeet(p.height, p.unit)).toFixed(2) : null;
  const mSqFt = m ? (toFeet(m.width, m.unit) * toFeet(m.height, m.unit)).toFixed(2) : null;
  const wastage = pSqFt && mSqFt ? (parseFloat(mSqFt) - parseFloat(pSqFt)).toFixed(2) : null;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Material Issue Slip - ${issue?.issue_no || "SLIP"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;background:#fff;color:#111;font-size:12px}
  .slip{width:80mm;margin:0 auto;padding:8mm;border:1px dashed #999}
  .header{text-align:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
  .brand{font-size:18px;font-weight:900;letter-spacing:2px}
  .sub{font-size:10px;color:#555;margin-top:2px}
  .slip-no{font-size:13px;font-weight:700;margin-top:6px;letter-spacing:1px}
  .meta{font-size:10px;color:#666}
  .section{margin:10px 0}
  .section-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px}
  .row{display:flex;justify-content:space-between;margin:4px 0}
  .label{color:#555;font-size:11px}
  .value{font-weight:700;font-size:11px;text-align:right;max-width:55%;word-break:break-word}
  .highlight{background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:8px;margin:8px 0;text-align:center}
  .big{font-size:22px;font-weight:900}
  .unit{font-size:11px;color:#555}
  .wastage-box{background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:6px;margin:6px 0;text-align:center}
  .footer{text-align:center;border-top:1px dashed #999;padding-top:8px;margin-top:10px;font-size:9px;color:#888}
  .sig-box{border:1px solid #ddd;height:30px;margin-top:8px;border-radius:3px}
  .sig-label{font-size:9px;color:#999;text-align:center;margin-top:2px}
  @media print{body{-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="slip">
  <div class="header">
    <div class="brand">DMEDIA</div>
    <div class="sub">Material Issuance System</div>
    <div class="slip-no">${issue?.issue_no || "MIS-XXXXXX"}</div>
    <div class="meta">${dateStr} | ${timeStr}</div>
  </div>
  <div class="section">
    <div class="section-title">Job Details</div>
    <div class="row"><span class="label">Job No</span><span class="value">${issue?.job_no || "—"}</span></div>
    <div class="row"><span class="label">Item</span><span class="value">${issue?.cart_item_name || `#${(issue?.cart_item_index ?? 0) + 1}`}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Material</div>
    <div class="row"><span class="label">Product</span><span class="value">${issue?.material?.product_name || "—"}</span></div>
    <div class="row"><span class="label">Out Source</span><span class="value">${outsourceLabel}</span></div>
    ${isOut && issue?.outsource_vendor ? `<div class="row"><span class="label">Vendor</span><span class="value">${issue.outsource_vendor}</span></div>` : ""}
  </div>
  ${p ? `<div class="section">
    <div class="section-title">Printing Dimensions</div>
    <div class="row"><span class="label">W × H</span><span class="value">${p.width} ${p.unit} × ${p.height} ${p.unit}</span></div>
    <div class="row"><span class="label">Printing sq.ft</span><span class="value">${pSqFt} sqft</span></div>
  </div>` : ""}
  ${m ? `<div class="section">
    <div class="section-title">Media Dimensions</div>
    <div class="row"><span class="label">W × H</span><span class="value">${m.width} ${m.unit} × ${m.height} ${m.unit}</span></div>
    <div class="row"><span class="label">Media sq.ft</span><span class="value">${mSqFt} sqft</span></div>
  </div>` : ""}
  ${wastage ? `<div class="wastage-box"><div class="unit">Material Wastage</div><div class="big">${wastage}</div><div class="unit">sq.ft wasted (Media - Printing)</div></div>` : ""}
  <div class="highlight">
    <div class="unit">Issued Quantity (Media)</div>
    <div class="big">${issue?.issued_qty ?? "—"}</div>
    <div class="unit">sq.ft</div>
  </div>
  <div class="section">
    <div class="section-title">Personnel</div>
    <div class="row">
      <span class="label">Issued By</span>
      <span class="label">${isOut ? "Vendor" : "Issued To"}</span>
    </div>
    <div class="row">
      <span class="value">${issue?.issued_by?.name || user?.name || "Store Manager"}</span>
      <span class="value">${isOut ? issue?.outsource_vendor || "—" : issue?.issued_to?.name || "—"}</span>
    </div>
  </div>
  ${!isOut ? `<div class="section"><div class="section-title">Employee Signature</div><div class="sig-box"></div><div class="sig-label">Received by / Date</div></div>` : ""}
  <div class="footer">
    <div>This slip is system generated</div>
    <div style="margin-top:2px">Keep this slip until job completion</div>
    <div style="margin-top:4px;font-weight:700">DMEDIA © ${now.getFullYear()}</div>
  </div>
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) win.onload = () => setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);
  const dismiss = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
};

const ToastContainer = ({ toasts, dismiss }) => (
  <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 md:left-auto md:right-6 md:w-80 md:bottom-6">
    {toasts.map(t => {
      const cfg = {
        info:    { bar: "bg-sky-400",     icon: "ℹ" },
        success: { bar: "bg-emerald-400", icon: "✓" },
        error:   { bar: "bg-rose-400",    icon: "✕" },
        warning: { bar: "bg-amber-400",   icon: "⚠" },
      }[t.type] || { bar: "bg-sky-400", icon: "ℹ" };
      return (
        <div key={t.id} className="bg-slate-800 text-white rounded-xl overflow-hidden shadow-2xl flex items-stretch animate-slide-up">
          <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />
          <div className="flex items-center gap-3 px-4 py-3 flex-1">
            <span className={`text-sm font-bold ${cfg.bar.replace("bg-", "text-")}`}>{cfg.icon}</span>
            <span className="text-sm flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-40 hover:opacity-100 text-lg leading-none ml-1">×</button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Design Atoms ─────────────────────────────────────────────────────────────
const Badge = ({ children, variant = "default" }) => {
  const v = {
    default: "bg-slate-100 text-slate-600",
    blue:    "bg-sky-100 text-sky-700",
    green:   "bg-emerald-100 text-emerald-700",
    amber:   "bg-amber-100 text-amber-700",
    red:     "bg-rose-100 text-rose-700",
    indigo:  "bg-indigo-100 text-indigo-700",
    violet:  "bg-violet-100 text-violet-700",
    teal:    "bg-teal-100 text-teal-700",
  }[variant] || "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${v}`}>{children}</span>;
};

const StatusBadge = ({ status }) => {
  const map = {
    issued:         ["blue",  "● Issued"],
    returned:       ["green", "✓ Returned"],
    partial_return: ["amber", "◑ Partial"],
    no_return:      ["red",   "✕ No Return"],
  };
  const [variant, label] = map[status] || ["default", status];
  return <Badge variant={variant}>{label}</Badge>;
};

const PerfBadge = ({ rating }) => {
  const map = {
    good:         ["green", "▲ Good"],
    acceptable:   ["amber", "◆ Acceptable"],
    high_wastage: ["red",   "▼ High Wastage"],
  };
  const [variant, label] = map[rating] || ["default", "—"];
  return <Badge variant={variant}>{label}</Badge>;
};

const Avatar = ({ name = "?", size = "md" }) => {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const sz = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" }[size];
  const colors = ["bg-sky-100 text-sky-700","bg-violet-100 text-violet-700","bg-emerald-100 text-emerald-700","bg-rose-100 text-rose-700","bg-amber-100 text-amber-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>{initials}</div>;
};

const WastageBar = ({ pct = 0 }) => {
  const color = pct <= 10 ? "bg-emerald-500" : pct <= 20 ? "bg-amber-500" : "bg-rose-500";
  const textColor = pct <= 10 ? "text-emerald-600" : pct <= 20 ? "text-amber-600" : "text-rose-600";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct.toFixed(1)}%</span>
    </div>
  );
};

const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="30 62" />
  </svg>
);

const Btn = ({ children, onClick, disabled, loading, variant = "primary", size = "md", className = "", type = "button", fullWidth }) => {
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed select-none ${fullWidth ? "w-full" : ""}`;
  const sizes = { xs: "px-2.5 py-1.5 text-xs", sm: "px-3.5 py-2 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-sm" };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-sm",
    danger:  "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
    ghost:   "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200",
    accent:  "bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-200",
    indigo:  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200",
    violet:  "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200",
    teal:    "bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-200",
  };
  return (
    <button type={type} onClick={!disabled && !loading ? onClick : undefined} disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
};

const InputField = ({ label, suffix, prefix, error, className = "", ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>}
    <div className={`flex items-stretch bg-white border rounded-xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 ${error ? "border-rose-300" : "border-slate-200"}`}>
      {prefix && <span className="px-3 py-2.5 text-xs text-slate-400 border-r border-slate-200 bg-slate-50 flex items-center">{prefix}</span>}
      <input className={`flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder:text-slate-300 min-w-0 ${className}`} {...props} />
      {suffix && <span className="px-3 py-2.5 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center whitespace-nowrap">{suffix}</span>}
    </div>
    {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
  </div>
);

const DimensionInput = ({ label, value, onChange, unit, onUnitChange, placeholder = "0.00" }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>}
    <div className="flex items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 transition-all">
      <input
        type="number" min="0" step="0.01" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none min-w-0"
      />
      <select value={unit} onChange={e => onUnitChange(e.target.value)}
        className="px-2 py-2.5 text-xs bg-slate-50 border-l border-slate-200 outline-none text-slate-600 font-semibold">
        {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options = [], placeholder, required, disabled }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}{required && <span className="text-rose-400 ml-0.5">*</span>}</label>}
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all appearance-none pr-8 disabled:opacity-60">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▾</span>
    </div>
  </div>
);

const Card = ({ children, className = "", onClick, hoverable }) => (
  <div onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${hoverable ? "cursor-pointer hover:border-sky-200 hover:shadow-md transition-all duration-150" : ""} ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">{icon}</div>
    <div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  </div>
);

const Divider = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-slate-100" />
    {label && <span className="text-xs text-slate-400 font-medium">{label}</span>}
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

const StatTile = ({ label, value, suffix, color = "default" }) => {
  const colors = { default: "bg-slate-50 border-slate-100", sky: "bg-sky-50 border-sky-100", emerald: "bg-emerald-50 border-emerald-100", rose: "bg-rose-50 border-rose-100", amber: "bg-amber-50 border-amber-100" };
  const textColors = { default: "text-slate-800", sky: "text-sky-700", emerald: "text-emerald-700", rose: "text-rose-700", amber: "text-amber-700" };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className={`text-2xl font-black ${textColors[color]}`}>{value}{suffix && <span className="text-sm font-medium text-slate-400 ml-1">{suffix}</span>}</p>
    </div>
  );
};

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4 opacity-30">{icon}</div>
    <p className="text-sm font-semibold text-slate-400">{title}</p>
    {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ open, title, onClose, children, size = "md" }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const sizeClass = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white w-full ${sizeClass} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-sm text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg leading-none transition-colors">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
};

// ─── Material Search Select ───────────────────────────────────────────────────
// Searches by product name AND any product_code in product_codes array
const MaterialSearchSelect = ({ products, value, onChange, label, required }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedProduct = products.find(p => p._id === value);

  // Highlight matching text
  const highlight = (text, q) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => {
      // Match name
      if (p.name?.toLowerCase().includes(q)) return true;
      // Match product_code (primary)
      if (p.product_code?.toLowerCase().includes(q)) return true;
      // Match any code in product_codes array
      if (Array.isArray(p.product_codes) && p.product_codes.some(c => c.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [products, query]);

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (product) => {
    onChange(product._id);
    setQuery("");
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  const stockColor = (count) => {
    if (count > 50) return "text-emerald-600 bg-emerald-50";
    if (count > 10) return "text-amber-600 bg-amber-50";
    return "text-rose-600 bg-rose-50";
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
          {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger / Search input */}
      <div
        className={`flex items-center bg-white border rounded-xl overflow-hidden transition-all cursor-pointer ${open ? "ring-2 ring-sky-500/20 border-sky-400" : "border-slate-200 hover:border-slate-300"}`}
        onClick={() => { setOpen(true); }}
      >
        {/* Search icon */}
        <span className="pl-3 text-slate-400 flex-shrink-0 text-sm">🔍</span>

        {open || !selectedProduct ? (
          <input
            autoFocus={open}
            className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder:text-slate-300 min-w-0"
            placeholder={selectedProduct ? selectedProduct.name : "Search by name or code (e.g. V, DMVM3)…"}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        ) : (
          <div className="flex-1 px-3 py-2.5 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{selectedProduct.name}</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">{selectedProduct.product_code}</p>
          </div>
        )}

        {selectedProduct && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2.5 text-slate-400 hover:text-rose-500 transition-colors text-sm flex-shrink-0"
            title="Clear selection"
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-64 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              {query && <span className="ml-1 text-sky-500">for "{query}"</span>}
            </span>
            {query && (
              <button onClick={() => setQuery("")} className="text-[10px] text-slate-400 hover:text-slate-600">Clear</button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-400">No products match "{query}"</p>
              <p className="text-xs text-slate-300 mt-1">Try a name or product code like DMVM3</p>
            </div>
          ) : (
            filtered.map(p => {
              const isSelected = p._id === value;
              // Find which codes match the query for display
              const matchingCodes = query.trim()
                ? (p.product_codes || []).filter(c => c.toLowerCase().includes(query.toLowerCase()))
                : [];

              return (
                <div
                  key={p._id}
                  onClick={() => handleSelect(p)}
                  className={`px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${isSelected ? "bg-sky-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Product name */}
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {highlight(p.name || "", query)}
                        {isSelected && <span className="ml-2 text-sky-500 text-[10px]">✓ selected</span>}
                      </p>

                      {/* Primary product code */}
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {highlight(p.product_code || "", query)}
                      </p>

                      {/* Size */}
                      {p.size && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {p.size.width}{p.size.width_unit} × {p.size.height}{p.size.height_unit}
                          {p.calculated_area ? ` · ${p.calculated_area} sqft/unit` : ""}
                          {p.product_quantity > 1 ? ` · Qty: ${p.product_quantity}` : ""}
                        </p>
                      )}

                      {/* Matching product codes */}
                      {matchingCodes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {matchingCodes.slice(0, 5).map(c => (
                            <span key={c} className="text-[10px] font-mono bg-yellow-50 border border-yellow-200 text-yellow-800 rounded px-1.5 py-0.5">
                              {highlight(c, query)}
                            </span>
                          ))}
                          {matchingCodes.length > 5 && (
                            <span className="text-[10px] text-slate-400">+{matchingCodes.length - 5} more</span>
                          )}
                        </div>
                      )}

                      {/* All codes preview when not searching */}
                      {/* {!query.trim() && p.product_codes && p.product_codes.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.product_codes.slice(0, 3).map(c => (
                            <span key={c} className="text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{c}</span>
                          ))}
                          {p.product_codes.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{p.product_codes.length - 3} codes</span>
                          )}
                        </div>
                      )} */}
                    </div>

                    {/* Stock badge */}
                    <div className={`flex-shrink-0 text-right`}>
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${stockColor(p.stock_count || 0)}`}>
                        {p.stock_count || 0} sqft
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">{p.stocks_status || "—"}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Dimension Calculator Card ────────────────────────────────────────────────
const DimensionCalcCard = ({ printW, printWUnit, printH, printHUnit, mediaW, mediaWUnit, mediaH, mediaHUnit, bufferPct }) => {
  const printFtW = toFeet(printW, printWUnit);
  const printFtH = toFeet(printH, printHUnit);
  const mediaFtW = toFeet(mediaW, mediaWUnit);
  const mediaFtH = toFeet(mediaH, mediaHUnit);

  const printSqFt = printFtW * printFtH;
  const mediaSqFt = mediaFtW * mediaFtH;
  const wastageSqFt = mediaSqFt - printSqFt;
  const wastageBuffer = mediaSqFt * ((parseFloat(bufferPct) || 0) / 100);
  const totalRequired = mediaSqFt + wastageBuffer;
  const wastageRatio = mediaSqFt > 0 ? (wastageSqFt / mediaSqFt) * 100 : 0;

  const hasPrint = printFtW > 0 && printFtH > 0;
  const hasMedia = mediaFtW > 0 && mediaFtH > 0;

  if (!hasPrint && !hasMedia) return null;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-sky-50 border border-sky-100 rounded-2xl p-4 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-sky-700 uppercase tracking-wide">Dimension Breakdown</p>
        <Badge variant="blue">Live Calc</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl p-3 border text-center ${hasPrint ? "bg-violet-50 border-violet-100" : "bg-slate-50 border-slate-100 opacity-50"}`}>
          <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1">🖨 Printing</p>
          <p className="text-xs text-slate-500">{hasPrint ? `${parseFloat(printW || 0).toFixed(2)}${printWUnit} × ${parseFloat(printH || 0).toFixed(2)}${printHUnit}` : "—"}</p>
          <p className="text-xl font-black text-violet-700 mt-1">{hasPrint ? printSqFt.toFixed(2) : "—"}</p>
          <p className="text-[10px] text-slate-400">sq.ft</p>
        </div>
        <div className={`rounded-xl p-3 border text-center ${hasMedia ? "bg-sky-50 border-sky-100" : "bg-slate-50 border-slate-100 opacity-50"}`}>
          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wide mb-1">📐 Media</p>
          <p className="text-xs text-slate-500">{hasMedia ? `${parseFloat(mediaW || 0).toFixed(2)}${mediaWUnit} × ${parseFloat(mediaH || 0).toFixed(2)}${mediaHUnit}` : "—"}</p>
          <p className="text-xl font-black text-sky-700 mt-1">{hasMedia ? mediaSqFt.toFixed(2) : "—"}</p>
          <p className="text-[10px] text-slate-400">sq.ft</p>
        </div>
      </div>
      {hasPrint && hasMedia && (
        <div className={`rounded-xl border p-3 ${wastageSqFt > 0 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Material Wastage</p>
              <p className="text-xs text-slate-400 mt-0.5">Media − Printing</p>
            </div>
            <div className="text-right">
              <p className={`text-xl font-black ${wastageSqFt > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {wastageSqFt > 0 ? `+${wastageSqFt.toFixed(2)}` : wastageSqFt.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400">sq.ft ({wastageRatio.toFixed(1)}%)</p>
            </div>
          </div>
          <WastageBar pct={Math.max(0, wastageRatio)} />
        </div>
      )}
      {hasMedia && (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white/60">Total to Issue</p>
            <p className="text-[10px] text-white/40">Media + {bufferPct || 0}% buffer</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{totalRequired.toFixed(2)}</p>
            <p className="text-xs text-white/50">sq.ft</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Job Lookup ───────────────────────────────────────────────────────────────
const JobLookup = ({ onJobSelected }) => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const { toasts, show, dismiss } = useToast();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/jobs?job_status=production&limit=100`);
      const list = res.data?.jobs || res.data || [];
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) { show(err.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return jobs;
    const q = filter.toLowerCase();
    return jobs.filter(j => j.job_no?.toLowerCase().includes(q) || j.customer_name?.toLowerCase().includes(q));
  }, [jobs, filter]);

  const selectJob = job => { setSelected(job); onJobSelected(job); };
  const clearJob  = ()  => { setSelected(null); onJobSelected(null); };

  return (
    <div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {!selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">
                {loading ? "Loading…" : `${filtered.length} production job${filtered.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            <Btn variant="ghost" size="xs" onClick={fetchJobs} loading={loading}>↻ Refresh</Btn>
          </div>
          {jobs.length > 3 && (
            <InputField value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by job no or customer…" />
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Spinner size={16} /><span className="text-sm">Fetching production jobs…</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="🏭" title="No production jobs" subtitle="No jobs found with status: production" />
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {filtered.map((job, idx) => (
                <div key={job._id} onClick={() => selectJob(job)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-violet-50 transition-colors ${idx < filtered.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-600">
                    <span className="text-[9px] font-black text-white tracking-wider">PROD</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{job.job_no}</p>
                    <p className="text-xs text-slate-400 truncate">{job.customer_name} · {job.cart_items?.length || 0} item(s)</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Production</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/30">
                <span className="text-[9px] font-black text-violet-200 tracking-wider">PROD</span>
              </div>
              <div>
                <p className="text-sm font-bold">{selected.job_no}</p>
                <p className="text-xs text-white/50">{selected.customer_name}</p>
              </div>
            </div>
            <button onClick={clearJob} className="text-xs text-violet-400 font-semibold hover:text-violet-300">Change</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[["Status","Production"],["Stage", selected.current_stage?.stage || "—"],["Items", selected.cart_items?.length || 0]].map(([k,v]) => (
              <div key={k} className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-white/40 mb-0.5">{k}</p>
                <p className="text-xs font-bold truncate">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Per-Item Material Panel ──────────────────────────────────────────────────
const ItemMaterialPanel = ({ item, itemIdx, products, employees, user, onItemIssued }) => {
  const { toasts, show, dismiss } = useToast();

  const [mode, setMode] = useState("insource");
  const isOut = mode === "outsource";

  const [submitted, setSubmitted]     = useState(false);
  const [submitLoad, setSubmitLoad]   = useState(false);

  const [productId, setProductId]   = useState("");
  const [empId, setEmpId]           = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [buffer, setBuffer]         = useState(20);
  const [issuedQty, setIssuedQty]   = useState("");

  const [printW,     setPrintW]     = useState("");
  const [printWUnit, setPrintWUnit] = useState("ft");
  const [printH,     setPrintH]     = useState("");
  const [printHUnit, setPrintHUnit] = useState("ft");

  const [mediaW,     setMediaW]     = useState("");
  const [mediaWUnit, setMediaWUnit] = useState("ft");
  const [mediaH,     setMediaH]     = useState("");
  const [mediaHUnit, setMediaHUnit] = useState("ft");

  const [outType,   setOutType]   = useState("");
  const [outVendor, setOutVendor] = useState("");
  const [outQty,    setOutQty]    = useState("");
  const [outNotes,  setOutNotes]  = useState("");

  useEffect(() => {
    if (item?.size) {
      const m = item.size.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (m) {
        setPrintW(m[1]); setPrintH(m[2]);
        setMediaW(m[1]); setMediaH(m[2]);
      }
    }
  }, [item]);

  const printSqFt = useMemo(() => {
    const w = toFeet(printW, printWUnit);
    const h = toFeet(printH, printHUnit);
    return w > 0 && h > 0 ? w * h : 0;
  }, [printW, printWUnit, printH, printHUnit]);

  const mediaSqFt = useMemo(() => {
    const w = toFeet(mediaW, mediaWUnit);
    const h = toFeet(mediaH, mediaHUnit);
    return w > 0 && h > 0 ? w * h : 0;
  }, [mediaW, mediaWUnit, mediaH, mediaHUnit]);

  const bufferSqFt    = mediaSqFt * ((parseFloat(buffer) || 0) / 100);
  const totalRequired = mediaSqFt + bufferSqFt;
  const wastageSqFt   = mediaSqFt - printSqFt;

  useEffect(() => {
    if (!isOut && mediaSqFt > 0) {
      setIssuedQty(totalRequired.toFixed(2));
    }
  }, [mediaSqFt, buffer, isOut]);

  const selectedProduct = products.find(p => p._id === productId);
  const selectedEmp     = employees.find(e => e._id === empId);

  const handleInSourceSubmit = async job => {
    if (!productId) return show("Select a material product", "error");
    if (!empId)     return show("Select an employee to issue to", "error");
    const qty = parseFloat(issuedQty);
    if (!qty || qty <= 0) return show("Issued quantity must be > 0", "error");
    if (mediaSqFt <= 0) return show("Media dimensions are required", "error");
    if (selectedProduct && selectedProduct.stock_count < qty)
      return show(`Insufficient stock — available: ${selectedProduct.stock_count} sqft`, "error");

    setSubmitLoad(true);
    try {
      const payload = {
        cart_item_index: itemIdx,
        material: { product_id: productId, product_name: selectedProduct?.name, unit: "sqft" },
        issued_qty: qty,
        sq_ft: printSqFt || null,
        calc_mode: "dimensions",
        wastage_buffer_pct: parseFloat(buffer) || 0,
        outsource_type: "none",
        outsource_vendor: "",
        printing_dimensions: {
          width: parseFloat(printW) || 0, width_unit: printWUnit,
          height: parseFloat(printH) || 0, height_unit: printHUnit,
          sqft: printSqFt,
        },
        media_dimensions: {
          width: parseFloat(mediaW) || 0, width_unit: mediaWUnit,
          height: parseFloat(mediaH) || 0, height_unit: mediaHUnit,
          sqft: mediaSqFt,
        },
        wastage_sqft: wastageSqFt,
        issued_to: { user_id: empId, name: selectedEmp?.name || "", role: selectedEmp?.role || "" },
        issued_by: { user_id: user?._id, name: user?.name || "Store Manager", role: user?.role || "store manager" },
        issue_notes: issueNotes,
      };

      const res = await api(`/jobs/${job._id}/material/issue`, { method: "POST", body: JSON.stringify(payload) });
      show(res.message || "Material issued!", "success");

      const newIssue = {
        _id: res.data?.issue_id,
        issue_no: res.data?.issue_no,
        job_id: job._id,
        job_no: res.data?.job_no || job.job_no,
        cart_item_index: itemIdx,
        cart_item_name: item?.product_name || "",
        material: { product_id: productId, product_name: selectedProduct?.name, unit: "sqft" },
        issued_qty: qty,
        suggested_qty: res.data?.suggested_qty || totalRequired,
        issued_to: { user_id: empId, name: selectedEmp?.name || "", role: selectedEmp?.role || "" },
        issued_by: { user_id: user?._id, name: user?.name || "", role: user?.role || "" },
        printing_dimensions: { width: parseFloat(printW), unit: printWUnit, height: parseFloat(printH), sqft: printSqFt },
        media_dimensions: { width: parseFloat(mediaW), unit: mediaWUnit, height: parseFloat(mediaH), sqft: mediaSqFt },
        wastage_sqft: wastageSqFt,
        calculation: { print_sqft: printSqFt, media_sqft: mediaSqFt, wastage_sqft: wastageSqFt, buffer_sqft: bufferSqFt, required_sqft: totalRequired, wastage_buffer_pct: parseFloat(buffer) || 0 },
        outsource_type: "none",
        outsource_vendor: "",
        wastage_buffer_pct: parseFloat(buffer) || 0,
        issue_notes: issueNotes,
        status: "issued",
        return: null,
        createdAt: new Date().toISOString(),
      };

      setSubmitted(true);
      onItemIssued(newIssue, productId, qty, false);
      generateSlipPDF(newIssue, user);
    } catch (err) { show(err.message, "error"); }
    finally { setSubmitLoad(false); }
  };

  const handleOutsourceSubmit = async job => {
    if (!outVendor.trim()) return show("Vendor / Party name is required", "error");
    setSubmitLoad(true);
    try {
      const effectiveQty  = parseFloat(outQty) || 0;
      const effectiveType = outType.trim() || "other";

      const payload = {
        cart_item_index: itemIdx,
        material: { product_id: null, product_name: "Outsourced", unit: "sqft" },
        issued_qty: effectiveQty,
        sq_ft: printSqFt || null,
        calc_mode: "outsource",
        wastage_buffer_pct: 0,
        outsource_type: effectiveType,
        outsource_vendor: outVendor.trim(),
        printing_dimensions: printW && printH ? { width: parseFloat(printW), width_unit: printWUnit, height: parseFloat(printH), height_unit: printHUnit, sqft: printSqFt } : null,
        media_dimensions: mediaW && mediaH ? { width: parseFloat(mediaW), width_unit: mediaWUnit, height: parseFloat(mediaH), height_unit: mediaHUnit, sqft: mediaSqFt } : null,
        issued_to: { user_id: null, name: outVendor.trim(), role: "outsource" },
        issued_by: { user_id: user?._id, name: user?.name || "Store Manager", role: user?.role || "store manager" },
        issue_notes: outNotes,
      };

      const res = await api(`/jobs/${job._id}`, { method: "PUT", body: JSON.stringify(payload) });
      show(res.message || "Item sent to outsource!", "success");

      const newIssue = {
        _id: res.data?._id || `outsource_${Date.now()}_${itemIdx}`,
        issue_no: `OS-${job.job_no}-${itemIdx + 1}`,
        job_id: job._id, job_no: job.job_no,
        cart_item_index: itemIdx, cart_item_name: item?.product_name || "",
        material: { product_id: null, product_name: "Outsourced", unit: "sqft" },
        issued_qty: effectiveQty, suggested_qty: 0,
        issued_to: { user_id: null, name: outVendor.trim(), role: "outsource" },
        issued_by: { user_id: user?._id, name: user?.name || "", role: user?.role || "" },
        printing_dimensions: printW ? { width: parseFloat(printW), unit: printWUnit, height: parseFloat(printH), sqft: printSqFt } : null,
        media_dimensions: mediaW ? { width: parseFloat(mediaW), unit: mediaWUnit, height: parseFloat(mediaH), sqft: mediaSqFt } : null,
        calculation: {},
        outsource_type: effectiveType, outsource_vendor: outVendor.trim(),
        wastage_buffer_pct: 0, issue_notes: outNotes,
        status: "issued", return: null, createdAt: new Date().toISOString(),
      };

      setSubmitted(true);
      onItemIssued(newIssue, null, effectiveQty, true);
      generateSlipPDF(newIssue, user);
    } catch (err) { show(err.message, "error"); }
    finally { setSubmitLoad(false); }
  };

  if (submitted) {
    return (
      <div className="border border-emerald-200 rounded-2xl p-4 mb-4 bg-emerald-50 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-emerald-800">{item?.product_name}</div>
          <div className="text-xs text-emerald-600 mt-0.5">
            {isOut ? `Outsourced to ${outVendor}` : `Issued to ${selectedEmp?.name || empId}`}
            {!isOut && mediaSqFt > 0 && <span className="ml-2">· {totalRequired.toFixed(2)} sqft</span>}
          </div>
        </div>
        <button onClick={() => setSubmitted(false)} className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">Edit</button>
      </div>
    );
  }

  const cartSqFt = parseFloat(item?.sq_ft) || 0;

  return (
    <div className="border border-slate-200 rounded-2xl mb-4 overflow-hidden bg-white">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Item header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-sm text-slate-800">
            <span className="text-violet-600 mr-2">▣</span>
            {item?.product_name}
            {item?.variation && <span className="text-slate-400 font-normal"> · {item.variation}</span>}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            {item?.size && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{item.size}</span>}
            <span>Qty: {item?.quantity} {item?.quantity_type}</span>
            {cartSqFt > 0 && <span className="text-violet-600 font-bold">· {cartSqFt} sqft</span>}
          </div>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-bold">
          <button onClick={() => setMode("insource")}
            className={`px-3 py-2 transition-all ${mode === "insource" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            🏠 In-House
          </button>
          <button onClick={() => setMode("outsource")}
            className={`px-3 py-2 border-l border-slate-200 transition-all ${mode === "outsource" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            🔗 Outsource
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── OUTSOURCE FORM ── */}
        {isOut && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
              <span className="text-indigo-500">🔗</span>
              <span className="text-xs font-semibold text-indigo-700">This item will be sent to an external vendor</span>
            </div>
            <InputField label="Work Type" value={outType} onChange={e => setOutType(e.target.value)} placeholder="e.g. Printing, Lamination, Cutting…" />
            <InputField label="Vendor / Party Name *" value={outVendor} onChange={e => setOutVendor(e.target.value)} placeholder="e.g. Sri Murugan Printers…" />
            {outVendor.trim() && (
              <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center"><span className="text-base">🏭</span></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-indigo-800 truncate">{outVendor.trim()}</p>
                  <p className="text-xs text-indigo-500">{outType.trim() || "Outsource"} · External vendor</p>
                </div>
                <Badge variant="indigo">Outsource</Badge>
              </div>
            )}
            <Divider label="Dimensions (optional)" />
            <div className="grid grid-cols-2 gap-3">
              <DimensionInput label="Print Width" value={printW} onChange={setPrintW} unit={printWUnit} onUnitChange={setPrintWUnit} />
              <DimensionInput label="Print Height" value={printH} onChange={setPrintH} unit={printHUnit} onUnitChange={setPrintHUnit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DimensionInput label="Media Width" value={mediaW} onChange={setMediaW} unit={mediaWUnit} onUnitChange={setMediaWUnit} />
              <DimensionInput label="Media Height" value={mediaH} onChange={setMediaH} unit={mediaHUnit} onUnitChange={setMediaHUnit} />
            </div>
            <DimensionCalcCard
              printW={printW} printWUnit={printWUnit} printH={printH} printHUnit={printHUnit}
              mediaW={mediaW} mediaWUnit={mediaWUnit} mediaH={mediaH} mediaHUnit={mediaHUnit}
              bufferPct={0}
            />
            <InputField label="Quantity (optional)" value={outQty} onChange={e => setOutQty(e.target.value)} type="number" min="0" step="0.1" suffix="sqft" placeholder="0.00" />
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Notes</label>
              <textarea value={outNotes} onChange={e => setOutNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all resize-none placeholder:text-slate-300"
                placeholder="Special instructions for vendor…" />
            </div>
          </div>
        )}

        {/* ── IN-SOURCE FORM ── */}
        {!isOut && (
          <div className="space-y-4">
            {/* Material Search Select */}
            <MaterialSearchSelect
              products={products}
              value={productId}
              onChange={setProductId}
              label="Material Product"
              required
            />

            {selectedProduct && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${selectedProduct.stock_count > 50 ? "bg-emerald-50 text-emerald-700" : selectedProduct.stock_count > 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                <span>{selectedProduct.stock_count > 50 ? "●" : selectedProduct.stock_count > 10 ? "◆" : "▲"}</span>
                <span>{selectedProduct.stock_count} sqft in stock</span>
                <span className="text-slate-400 font-normal mx-1">·</span>
                <span className="font-mono text-slate-500">{selectedProduct.product_code}</span>
                {selectedProduct.product_codes?.length > 1 && (
                  <span className="text-slate-400 font-normal">· {selectedProduct.product_codes.length} codes</span>
                )}
              </div>
            )}

            {/* Printing Dimensions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-black">P</span>
                </div>
                <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Printing Dimensions</p>
                <span className="text-[10px] text-slate-400">Actual artwork size</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DimensionInput label="Width" value={printW} onChange={setPrintW} unit={printWUnit} onUnitChange={setPrintWUnit} />
                <DimensionInput label="Height" value={printH} onChange={setPrintH} unit={printHUnit} onUnitChange={setPrintHUnit} />
              </div>
              {printSqFt > 0 && (
                <p className="text-xs font-bold text-violet-600 mt-1.5">Printing area: {printSqFt.toFixed(2)} sq.ft</p>
              )}
            </div>

            {/* Media Dimensions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-sky-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-black">M</span>
                </div>
                <p className="text-xs font-bold text-sky-700 uppercase tracking-wide">Media Dimensions</p>
                <span className="text-[10px] text-slate-400">Roll / sheet to cut from</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DimensionInput label="Width" value={mediaW} onChange={setMediaW} unit={mediaWUnit} onUnitChange={setMediaWUnit} />
                <DimensionInput label="Height" value={mediaH} onChange={setMediaH} unit={mediaHUnit} onUnitChange={setMediaHUnit} />
              </div>
              {mediaSqFt > 0 && (
                <p className="text-xs font-bold text-sky-600 mt-1.5">Media area: {mediaSqFt.toFixed(2)} sq.ft</p>
              )}
            </div>

            {/* Live Dimension Breakdown */}
            <DimensionCalcCard
              printW={printW} printWUnit={printWUnit} printH={printH} printHUnit={printHUnit}
              mediaW={mediaW} mediaWUnit={mediaWUnit} mediaH={mediaH} mediaHUnit={mediaHUnit}
              bufferPct={buffer}
            />

            {/* Issued Qty */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">Total media + buffer pre-filled. Override if needed.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Actual Qty to Issue *</label>
                <div className="flex items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 transition-all">
                  <input type="number" min="0.01" step="0.01" value={issuedQty}
                    onChange={e => setIssuedQty(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
                  <span className="px-3 py-2.5 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center">sqft</span>
                </div>
                {totalRequired > 0 && issuedQty !== "" && Math.abs(parseFloat(issuedQty) - totalRequired) > 0.01 && (
                  <p className="text-xs text-amber-500 font-medium mt-1.5">⚠ Manual override (calculated: {totalRequired.toFixed(2)} sqft)</p>
                )}
              </div>
            </div>

            {/* Personnel */}
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Issue To" required value={empId} onChange={setEmpId}
                placeholder="Select employee…"
                options={employees.map(e => ({ value: e._id, label: e.name }))}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Issued By</label>
                <div className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium truncate">{user?.name || "—"}</div>
              </div>
            </div>
            {selectedEmp && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <Avatar name={selectedEmp.name} size="md" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{selectedEmp.name}</p>
                  <p className="text-xs text-slate-400">{selectedEmp.role}</p>
                </div>
              </div>
            )}

            <InputField label="Issue Notes" value={issueNotes} onChange={e => setIssueNotes(e.target.value)} placeholder="Special instructions…" />
          </div>
        )}

        {/* Submit */}
        <Btn variant={isOut ? "indigo" : "primary"} size="md" fullWidth loading={submitLoad}
          onClick={() => {
            if (window.__currentIssueJob) {
              isOut ? handleOutsourceSubmit(window.__currentIssueJob) : handleInSourceSubmit(window.__currentIssueJob);
            }
          }}>
          {isOut ? "🔗 Send to Outsource & Print Slip" : "📋 Issue Material & Print Slip"}
        </Btn>
      </div>
    </div>
  );
};

// ─── Issue Panel ──────────────────────────────────────────────────────────────
const IssuePanel = ({ products, employees, onIssued }) => {
  const { user } = useSelector(s => s.authSlice);
  const [job, setJob] = useState(null);
  const { toasts, show, dismiss } = useToast();

  useEffect(() => { window.__currentIssueJob = job; }, [job]);

  const handleJobSelected   = useCallback(selected => setJob(selected), []);
  const handleItemIssued    = useCallback((newIssue, productId, qty, isOutsourced) => {
    onIssued(newIssue, productId, qty, newIssue.job_id, isOutsourced);
  }, [onIssued]);

  const cartItems = job?.cart_items || [];

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <Card className="p-5">
        <SectionHeader icon="🏭" title="Production Jobs" subtitle="Select a job to assign materials per item" />
        <JobLookup onJobSelected={handleJobSelected} />
        {job && cartItems.length > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <span className="text-emerald-500">✓</span>
            <span className="text-xs font-semibold text-emerald-700">
              {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} — assign material to each below
            </span>
          </div>
        )}
      </Card>

      {job && cartItems.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Per-Item Assignment ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          {cartItems.map((item, idx) => (
            <ItemMaterialPanel
              key={item.item_id || item._id || `item_${idx}`}
              item={item} itemIdx={idx}
              products={products} employees={employees} user={user}
              onItemIssued={handleItemIssued}
            />
          ))}
        </div>
      )}

      {!job && (
        <EmptyState icon="🔍" title="No job selected" subtitle="Search and select a production job above to continue" />
      )}
    </div>
  );
};

// ─── Issues Panel ─────────────────────────────────────────────────────────────
const IssuesPanel = ({ issues, onViewIssue, onRefresh, loading }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = useMemo(() => {
    let list = issues;
    if (statusFilter === "flagged") list = list.filter(i => i.return?.is_flagged && !i.return?.manager_reviewed);
    else if (statusFilter) list = list.filter(i => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.issue_no?.toLowerCase().includes(q) || i.job_no?.toLowerCase().includes(q) || i.issued_to?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [issues, statusFilter, search]);

  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <InputField value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by issue no, job, employee…" className="flex-1" />
        <div className="flex gap-2">
          <div className="flex-1 sm:w-36">
            <SelectField value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
              placeholder="All statuses"
              options={[{ value:"issued",label:"Issued" },{ value:"returned",label:"Returned" },{ value:"no_return",label:"No Return" },{ value:"flagged",label:"🚩 Flagged" }]}
            />
          </div>
          <Btn variant="ghost" onClick={onRefresh} loading={loading} size="md" className="flex-shrink-0">↻</Btn>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
        {filtered.length !== issues.length && (
          <button onClick={() => { setStatusFilter(""); setSearch(""); }} className="text-xs text-sky-500 font-semibold">Clear filters</button>
        )}
      </div>

      {paginated.length === 0 ? (
        <EmptyState icon="📭" title="No records found" subtitle="Try adjusting your filters" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {paginated.map(issue => {
            const outsourceLabelCard = OUTSOURCE_TYPES.find(o => o.value === issue.outsource_type)?.label || issue.outsource_type;
            const isOutCard = issue.outsource_type && issue.outsource_type !== "none";
            const calc = issue.calculation;
            return (
              <Card key={issue._id} hoverable className="p-4" onClick={() => onViewIssue(issue, "view")}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-sky-600 font-mono tracking-wide">{issue.issue_no}</span>
                      {issue.return?.is_flagged && !issue.return?.manager_reviewed && <Badge variant="red">🚩 Review</Badge>}
                      {isOutCard && <Badge variant="indigo">🔗 {outsourceLabelCard}</Badge>}
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{issue.job_no}</p>
                    {issue.cart_item_name && <p className="text-xs text-slate-400 mt-0.5">Item: {issue.cart_item_name}</p>}
                  </div>
                  <StatusBadge status={issue.status} />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={issue.issued_to?.name || "?"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{issue.issued_to?.name}</p>
                    <p className="text-xs text-slate-400">{isOutCard ? "External vendor" : issue.issued_to?.role}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">{issue.material?.product_name}</p>
                    <p className="text-xs text-slate-400">{issue.issued_qty} sqft</p>
                  </div>
                </div>
                {calc && !isOutCard && (calc.print_sqft || calc.media_sqft) && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[["🖨 Print", calc.print_sqft], ["📐 Media", calc.media_sqft], ["⚠ Waste", calc.wastage_sqft]].map(([k,v]) => (
                      <div key={k} className="bg-slate-50 rounded-lg p-1.5 text-center">
                        <p className="text-[9px] text-slate-400">{k}</p>
                        <p className="text-xs font-bold text-slate-700">{parseFloat(v||0).toFixed(1)}<span className="text-[9px] font-normal text-slate-400 ml-0.5">sqft</span></p>
                      </div>
                    ))}
                  </div>
                )}
                {isOutCard && (
                  <div className="bg-indigo-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                    <span className="text-indigo-400 text-xs">🏭</span>
                    <span className="text-xs font-semibold text-indigo-700 truncate">{issue.outsource_vendor || "External vendor"}</span>
                    <Badge variant="indigo">{outsourceLabelCard}</Badge>
                  </div>
                )}
                {issue.return ? <WastageBar pct={issue.return.wastage_ratio_pct || 0} /> : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100" />Pending return
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                  <Btn size="xs" variant="ghost" onClick={e => { e.stopPropagation(); onViewIssue(issue, "view"); }}>View Details</Btn>
                  {issue.return?.is_flagged && !issue.return?.manager_reviewed && (
                    <Btn size="xs" variant="danger" onClick={e => { e.stopPropagation(); onViewIssue(issue, "review"); }}>Review</Btn>
                  )}
                  <Btn size="xs" variant="ghost" className="ml-auto" onClick={e => { e.stopPropagation(); generateSlipPDF(issue, null); }}>📄 Slip</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 pt-2 pb-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.min(Math.max(page - 2 + i, 1), totalPages - Math.min(4, totalPages - 1) + i);
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === page ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{p}</button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
        </div>
      )}
    </div>
  );
};

// ─── Report Panel ─────────────────────────────────────────────────────────────
const ReportPanel = () => {
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const { toasts, show, dismiss } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo)   params.append("to", dateTo);
      const res = await api(`/material/report/wastage${params.toString() ? "?" + params : ""}`);
      setReport(res.data);
    } catch (e) { show(e.message, "error"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const o = report?.overall;
  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <Card className="p-5">
        <SectionHeader icon="📊" title="Wastage Report" subtitle="Filter by date range" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <InputField label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <InputField label="To"   type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
        </div>
        <Btn variant="primary" onClick={fetchReport} loading={loading} fullWidth>Apply Filter</Btn>
      </Card>
      {o && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Total Issued"  value={parseFloat((o.total_issued_qty || 0).toFixed(1))} suffix="sqft" color="sky" />
            <StatTile label="Avg Wastage"   value={(o.avg_wastage_ratio || 0).toFixed(1)} suffix="%" color="amber" />
            <StatTile label="Total Wastage" value={parseFloat((o.total_actual_wastage || 0).toFixed(1))} suffix="sqft" />
            <StatTile label="Needs Review"  value={o.flagged_count || 0} color={o.flagged_count > 0 ? "rose" : "emerald"} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["✓ Good",o.good_count,"emerald"],["◆ Acceptable",o.acceptable_count,"amber"],["▼ High Wastage",o.high_wastage_count,"rose"]].map(([l,count,color]) => (
              <StatTile key={l} label={l} value={count || 0} color={color} />
            ))}
          </div>
        </>
      )}
      {report?.by_employee?.length > 0 && (
        <Card className="p-5">
          <SectionHeader icon="👥" title="Employee Performance" />
          <div className="space-y-3">
            {report.by_employee.map(emp => (
              <div key={emp._id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <Avatar name={emp.employee_name || "?"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{emp.employee_name}</p>
                  <p className="text-xs text-slate-400">{emp.total_issues} issues</p>
                </div>
                <div className="w-24 flex-shrink-0"><WastageBar pct={emp.avg_wastage_ratio || 0} /></div>
                <PerfBadge rating={emp.overall_rating || "acceptable"} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {report?.by_outsource_type?.length > 0 && (
        <Card className="p-5">
          <SectionHeader icon="🔗" title="Outsource Breakdown" />
          <div className="space-y-3">
            {report.by_outsource_type.map(r => {
              const label = OUTSOURCE_TYPES.find(o => o.value === r._id)?.label || r._id || "Unknown";
              const max = Math.max(...report.by_outsource_type.map(x => x.count));
              return (
                <div key={r._id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="text-slate-400 font-semibold">{r.count}× · {parseFloat((r.total_issued || 0).toFixed(1))} sqft</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {!o && !loading && <EmptyState icon="📊" title="No report data" subtitle="Issue some materials first to see analytics" />}
    </div>
  );
};

// ─── Issue Detail Modal ───────────────────────────────────────────────────────
const IssueDetailModal = ({ issue, mode, onClose, onReviewSaved }) => {
  const { user } = useSelector(s => s.authSlice);
  const { toasts, show, dismiss } = useToast();
  const [override, setOverride] = useState("");
  const [manNotes, setManNotes] = useState("");
  const [loading, setLoading]   = useState(false);
  if (!issue) return null;

  const handleReview = async () => {
    setLoading(true);
    try {
      const payload = {
        manager_by: { user_id: user?._id || "unknown", name: user?.name || "Store Manager" },
        manager_notes: manNotes,
        override_rating: override || null,
      };
      const method = issue.return?.manager_reviewed ? "PUT" : "POST";
      const res = await api(`/material/${issue._id}/review`, { method, body: JSON.stringify(payload) });
      show(res.message || "Review saved", "success");
      onReviewSaved(issue._id, { manager_notes: manNotes, override_rating: override });
      onClose();
    } catch (err) { show(err.message, "error"); }
    finally { setLoading(false); }
  };

  const r = issue.return;
  const calc = issue.calculation;
  const isOutModal = issue.outsource_type && issue.outsource_type !== "none";
  const outsideLabel = OUTSOURCE_TYPES.find(o => o.value === issue.outsource_type)?.label || issue.outsource_type;

  return (
    <Modal open title={`${issue.issue_no} · ${issue.job_no}`} onClose={onClose} size="md">
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="space-y-5">
        {issue.cart_item_name && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
            <span className="text-violet-500">▣</span>
            <span className="text-xs font-semibold text-violet-700">Item: {issue.cart_item_name}</span>
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Issue Summary</p>
          <div className="space-y-1">
            {[
              ["Material",    issue.material?.product_name],
              ["Issued Qty",  `${issue.issued_qty} sqft`],
              ["Recommended", `${issue.suggested_qty || calc?.required_sqft || "—"} sqft`],
              ["Status",      null],
            ].map(([k, v]) => k === "Status" ? (
              <div key={k} className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-xs text-slate-400">{k}</span>
                <StatusBadge status={issue.status} />
              </div>
            ) : (
              <div key={k} className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-xs text-slate-400">{k}</span>
                <span className="text-sm font-semibold text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-400">{isOutModal ? "Vendor" : "Employee"}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{issue.issued_to?.name || "—"}</span>
                {isOutModal && <Badge variant="indigo">External</Badge>}
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-slate-400">Out Source</span>
              {isOutModal ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-indigo-700">{outsideLabel}</span>
                  <Badge variant="indigo">External</Badge>
                </div>
              ) : <span className="text-sm font-semibold text-slate-800">In-House</span>}
            </div>
          </div>
        </div>
        {calc && (calc.print_sqft || calc.media_sqft) && (
          <div>
            <Divider label="Dimension Breakdown" />
            <div className="grid grid-cols-3 gap-2">
              {[
                ["🖨 Printing",  calc.print_sqft,   "bg-violet-50 border-violet-100 text-violet-700"],
                ["📐 Media",     calc.media_sqft,    "bg-sky-50 border-sky-100 text-sky-700"],
                ["⚠ Wastage",   calc.wastage_sqft,  "bg-amber-50 border-amber-100 text-amber-700"],
                ["⚡ Buffer",    calc.buffer_sqft,   "bg-slate-50 border-slate-100 text-slate-700"],
                ["✅ Required",  calc.required_sqft, "bg-emerald-50 border-emerald-100 text-emerald-700"],
              ].map(([k, v, cls]) => (
                <div key={k} className={`${cls} border rounded-xl p-2.5 text-center`}>
                  <p className="text-[10px] text-slate-400 mb-0.5">{k}</p>
                  <p className="text-sm font-black">{parseFloat(v || 0).toFixed(2)}<span className="text-[9px] font-normal text-slate-400 ml-0.5">sqft</span></p>
                </div>
              ))}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-400 mb-0.5">Buffer %</p>
                <p className="text-sm font-black text-slate-700">{calc.wastage_buffer_pct || 0}<span className="text-[9px] font-normal text-slate-400 ml-0.5">%</span></p>
              </div>
            </div>
          </div>
        )}
        <Btn variant="ghost" size="sm" fullWidth onClick={() => generateSlipPDF(issue, user)}>📄 Download / Print Slip</Btn>
        {r && (
          <div>
            <Divider label="Return Details" />
            <div className="space-y-1">
              {[
                ["Returned", `${r.returned_qty} sqft`],
                ["Used",     `${r.actual_used_qty} sqft`],
                ["Wastage",  `${r.actual_wastage_qty} sqft`],
                ["Ratio",    `${r.wastage_ratio_pct}%`],
                ["Reason",   WASTAGE_REASONS.find(x => x.value === r.wastage_reason)?.label || r.wastage_reason],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-xs text-slate-400">{k}</span>
                  <span className="text-sm font-semibold text-slate-800">{v}</span>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <span className="text-xs text-slate-400">Performance</span>
                <PerfBadge rating={r.performance_rating} />
              </div>
            </div>
            {r.is_flagged && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${r.manager_reviewed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {r.manager_reviewed ? "✓ Reviewed by manager" : "🚩 Flagged · pending review"}
              </div>
            )}
          </div>
        )}
        {mode === "review" && r && (
          <div>
            <Divider label="Manager Review" />
            <div className="space-y-3">
              <SelectField label="Override Rating" value={override} onChange={setOverride}
                placeholder="Keep auto-rating"
                options={[{ value:"good",label:"Good" },{ value:"acceptable",label:"Acceptable" },{ value:"high_wastage",label:"High Wastage" }]}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Manager Notes</label>
                <textarea value={manNotes} onChange={e => setManNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all resize-none"
                  placeholder="Explain the override rationale…" />
              </div>
              <Btn variant="primary" onClick={handleReview} loading={loading} fullWidth>Save Review</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function MaterialIssueManager() {
  const { user }   = useSelector(s => s.authSlice);
  const navigate   = useNavigate();

  const [tab, setTab]             = useState("issue");
  const [issues, setIssues]       = useState([]);
  const [products, setProducts]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [issLoading, setIssLoading] = useState(false);
  const [modalIssue, setModalIssue] = useState(null);
  const [modalMode,  setModalMode]  = useState("view");
  const { toasts, show, dismiss }   = useToast();

  const fetchProducts  = useCallback(async () => {
    try { const res = await api("/product/get_product"); setProducts(res.data || []); } catch {}
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api("/admin/get_admin");
      setEmployees((res.data || []).filter(e => e.role === "production team"));
    } catch {}
  }, []);

  const fetchIssues = useCallback(async () => {
    setIssLoading(true);
    try { const res = await api("/material?limit=100"); setIssues(res.data?.issues || []); }
    catch (e) { show(e.message, "error"); }
    finally { setIssLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); fetchEmployees(); fetchIssues(); }, []);

  const handleIssued = useCallback((newIssue, productId, qty, _jobId, isOutsourced) => {
    setIssues(prev => [newIssue, ...prev]);
    if (!isOutsourced && productId) {
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, stock_count: Math.max(0, (p.stock_count || 0) - qty) } : p));
    }
    setTab("issues");
  }, []);

  const handleReviewSaved = (issueId, data) => {
    setIssues(prev => prev.map(i => i._id === issueId && i.return
      ? { ...i, return: { ...i.return, manager_reviewed: true, manager_notes: data.manager_notes, performance_rating: data.override_rating || i.return.performance_rating } }
      : i
    ));
  };

  const stats = useMemo(() => ({
    pending:     issues.filter(i => i.status === "issued").length,
    flagged:     issues.filter(i => i.return?.is_flagged && !i.return?.manager_reviewed).length,
    totalIssued: parseFloat(issues.reduce((s, i) => s + (i.issued_qty || 0), 0).toFixed(1)),
    avgWaste:    (() => {
      const ret = issues.filter(i => i.return);
      return ret.length ? parseFloat((ret.reduce((s, i) => s + (i.return.wastage_ratio_pct || 0), 0) / ret.length).toFixed(1)) : 0;
    })(),
  }), [issues]);

  const TABS = [
    { key: "issue",  label: "Issue",   icon: "📋" },
    { key: "issues", label: "Records", icon: "📦", badge: issues.length },
    { key: "report", label: "Report",  icon: "📊" },
  ];

  return (
    <>
      <style>{`
        @keyframes slide-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .animate-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ToastContainer toasts={toasts} dismiss={dismiss} />

        {/* Header */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">DM</span>
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 leading-tight tracking-tight">Material Issuance</h1>
                  <p className="text-xs text-slate-400 hidden sm:block">Print · Media · Wastage tracking</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {stats.flagged > 0 && (
                  <button onClick={() => setTab("issues")} className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-full px-3 py-1.5 hover:bg-rose-100 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-xs font-bold text-rose-600">{stats.flagged} to review</span>
                  </button>
                )}
                <button onClick={() => navigate("/add-product")}
                  className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-3 py-2 hover:bg-slate-700 active:scale-95 transition-all shadow-sm">
                  <span className="text-sm leading-none font-bold">+</span>
                  <span className="text-xs font-bold hidden sm:inline">Add Product</span>
                  <span className="text-xs font-bold sm:hidden">Add</span>
                </button>
                {user?.name && (
                  <div className="hidden sm:flex items-center gap-2">
                    <Avatar name={user.name} size="sm" />
                    <span className="text-xs font-semibold text-slate-600">{user.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-2 pb-3">
              {[
                { label: "Issued",   value: stats.totalIssued, suffix: "sqft", color: "text-sky-600" },
                { label: "Pending",  value: stats.pending,    suffix: "",     color: stats.pending > 0 ? "text-amber-600" : "text-slate-700" },
                { label: "Avg Waste",value: `${stats.avgWaste}%`, suffix:"",  color: stats.avgWaste > 20 ? "text-rose-600" : "text-slate-700" },
                { label: "Review",   value: stats.flagged,    suffix: "",     color: stats.flagged > 0 ? "text-rose-600" : "text-slate-700" },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-2 text-center border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                  <p className={`text-sm font-black ${s.color}`}>{s.value}<span className="text-[10px] font-normal text-slate-400 ml-0.5">{s.suffix}</span></p>
                </div>
              ))}
            </div>

            {/* Desktop tabs */}
            <div className="hidden sm:flex gap-1 pb-0">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all relative border-b-2 ${tab === t.key ? "text-slate-900 border-slate-900 bg-slate-50" : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50"}`}>
                  <span>{t.icon}</span><span>{t.label}</span>
                  {t.badge > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{t.badge > 99 ? "99+" : t.badge}</span>}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 pb-24 sm:pb-6">
          {tab === "issue"  && <IssuePanel products={products} employees={employees} onIssued={handleIssued} />}
          {tab === "issues" && <IssuesPanel issues={issues} onViewIssue={(i, m) => { setModalIssue(i); setModalMode(m); }} onRefresh={fetchIssues} loading={issLoading} />}
          {tab === "report" && <ReportPanel />}
        </main>

        {/* Mobile nav */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-30 shadow-[0_-1px_20px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-3 max-w-md mx-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1 py-3 px-2 relative transition-all ${tab === t.key ? "text-slate-900" : "text-slate-400"}`}>
                {tab === t.key && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-900 rounded-full" />}
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="text-[10px] font-bold">{t.label}</span>
                {t.badge > 0 && <span className="absolute top-2 right-3 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 bg-slate-200 text-slate-600">{t.badge > 9 ? "9+" : t.badge}</span>}
              </button>
            ))}
          </div>
        </nav>

        <IssueDetailModal issue={modalIssue} mode={modalMode} onClose={() => setModalIssue(null)} onReviewSaved={handleReviewSaved} />
      </div>
    </>
  );
}