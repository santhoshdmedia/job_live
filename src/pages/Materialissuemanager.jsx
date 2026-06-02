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
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const outsourceLabel =
    OUTSOURCE_TYPES.find((o) => o.value === issue?.outsource_type)?.label ||
    "In-House";
  const isOutsourced =
    issue?.outsource_type && issue?.outsource_type !== "none";

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
    <div class="row"><span class="label">Cart Item</span><span class="value">#${(issue?.cart_item_index ?? 0) + 1}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Material</div>
    <div class="row"><span class="label">Product</span><span class="value">${issue?.material?.product_name || "—"}</span></div>
    <div class="row"><span class="label">Unit</span><span class="value">${issue?.material?.unit || "sqft"}</span></div>
    <div class="row"><span class="label">Out Source</span><span class="value">${outsourceLabel}</span></div>
    ${isOutsourced && issue?.outsource_vendor ? `<div class="row"><span class="label">Vendor</span><span class="value">${issue.outsource_vendor}</span></div>` : ""}
  </div>
  <div class="highlight">
    <div class="unit">Issued Quantity</div>
    <div class="big">${issue?.issued_qty ?? "—"}</div>
    <div class="unit">sq.ft</div>
  </div>
  <div class="section">
    <div class="section-title">Dimensions</div>
    <div class="row"><span class="label">Width</span><span class="value">${issue?.dimensions?.width ?? "—"} ft</span></div>
    <div class="row"><span class="label">Height</span><span class="value">${issue?.dimensions?.height ?? "—"} ft</span></div>
    <div class="row"><span class="label">Buffer</span><span class="value">${issue?.wastage_buffer_pct ?? 20}%</span></div>
  </div>
  <div class="section">
    <div class="section-title">Personnel</div>
    <div class="row">
      <span class="label">Issued By</span>
      <span class="label">${isOutsourced ? "Vendor" : "Issued To"}</span>
    </div>
    <div class="row">
      <span class="value">${issue?.issued_by?.name || user?.name || "Store Manager"}</span>
      <span class="value">${isOutsourced ? issue?.outsource_vendor || "—" : issue?.issued_to?.name || "—"}</span>
    </div>
  </div>
  ${
    !isOutsourced
      ? `
  <div class="section">
    <div class="section-title">Employee Signature</div>
    <div class="sig-box"></div>
    <div class="sig-label">Received by / Date</div>
  </div>`
      : ""
  }
  <div class="footer">
    <div>This slip is system generated</div>
    <div style="margin-top:2px">Keep this slip until job completion</div>
    <div style="margin-top:4px;font-weight:700">DMEDIA © ${now.getFullYear()}</div>
  </div>
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win)
    win.onload = () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 500);
    };
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismiss = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );
  return { toasts, show, dismiss };
};

const ToastContainer = ({ toasts, dismiss }) => (
  <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 md:left-auto md:right-6 md:w-80 md:bottom-6">
    {toasts.map((t) => {
      const cfg = {
        info: { bar: "bg-sky-400", icon: "ℹ" },
        success: { bar: "bg-emerald-400", icon: "✓" },
        error: { bar: "bg-rose-400", icon: "✕" },
        warning: { bar: "bg-amber-400", icon: "⚠" },
      }[t.type] || { bar: "bg-sky-400", icon: "ℹ" };
      return (
        <div
          key={t.id}
          className="bg-slate-800 text-white rounded-xl overflow-hidden shadow-2xl flex items-stretch animate-slide-up"
        >
          <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />
          <div className="flex items-center gap-3 px-4 py-3 flex-1">
            <span
              className={`text-sm font-bold ${cfg.bar.replace("bg-", "text-")}`}
            >
              {cfg.icon}
            </span>
            <span className="text-sm flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-40 hover:opacity-100 text-lg leading-none ml-1"
            >
              ×
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Design Atoms ─────────────────────────────────────────────────────────────
const Badge = ({ children, variant = "default" }) => {
  const v =
    {
      default: "bg-slate-100 text-slate-600",
      blue: "bg-sky-100 text-sky-700",
      green: "bg-emerald-100 text-emerald-700",
      amber: "bg-amber-100 text-amber-700",
      red: "bg-rose-100 text-rose-700",
      indigo: "bg-indigo-100 text-indigo-700",
    }[variant] || "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${v}`}
    >
      {children}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    issued: ["blue", "● Issued"],
    returned: ["green", "✓ Returned"],
    partial_return: ["amber", "◑ Partial"],
    no_return: ["red", "✕ No Return"],
  };
  const [variant, label] = map[status] || ["default", status];
  return <Badge variant={variant}>{label}</Badge>;
};

const PerfBadge = ({ rating }) => {
  const map = {
    good: ["green", "▲ Good"],
    acceptable: ["amber", "◆ Acceptable"],
    high_wastage: ["red", "▼ High Wastage"],
  };
  const [variant, label] = map[rating] || ["default", "—"];
  return <Badge variant={variant}>{label}</Badge>;
};

const Avatar = ({ name = "?", size = "md" }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sz = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-11 h-11 text-sm",
  }[size];
  const colors = [
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`${sz} ${color} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

const WastageBar = ({ pct = 0 }) => {
  const color =
    pct <= 10 ? "bg-emerald-500" : pct <= 20 ? "bg-amber-500" : "bg-rose-500";
  const textColor =
    pct <= 10
      ? "text-emerald-600"
      : pct <= 20
        ? "text-amber-600"
        : "text-rose-600";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
};

const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
    <circle
      cx="12"
      cy="12"
      r="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeDasharray="30 62"
    />
  </svg>
);

const Btn = ({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  fullWidth,
}) => {
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed select-none ${fullWidth ? "w-full" : ""}`;
  const sizes = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-3.5 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-sm",
    danger: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
    ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200",
    accent: "bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-200",
  };
  return (
    <button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
};

const Input = ({ label, suffix, prefix, error, className = "", ...props }) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
    )}
    <div
      className={`flex items-stretch bg-white border rounded-xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 ${error ? "border-rose-300" : "border-slate-200"}`}
    >
      {prefix && (
        <span className="px-3 py-2.5 text-xs text-slate-400 border-r border-slate-200 bg-slate-50 flex items-center">
          {prefix}
        </span>
      )}
      <input
        className={`flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder:text-slate-300 min-w-0 ${className}`}
        {...props}
      />
      {suffix && (
        <span className="px-3 py-2.5 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center whitespace-nowrap">
          {suffix}
        </span>
      )}
    </div>
    {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
  </div>
);

const NumberInput = ({
  value,
  onChange,
  suffix,
  min = 0,
  step = 0.1,
  label,
  disabled,
}) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
    )}
    <div
      className={`flex items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 transition-all ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
        }
        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none min-w-0"
      />
      {suffix && (
        <span className="px-2.5 py-2.5 text-xs text-slate-400 border-l border-slate-200 bg-slate-50 flex items-center whitespace-nowrap">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  required,
}) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
    )}
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all appearance-none pr-8"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
        ▾
      </span>
    </div>
  </div>
);

const Card = ({ children, className = "", onClick, hoverable }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${hoverable ? "cursor-pointer hover:border-sky-200 hover:shadow-md transition-all duration-150" : ""} ${className}`}
  >
    {children}
  </div>
);

const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  </div>
);

const Divider = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-slate-100" />
    {label && (
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    )}
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

const StatTile = ({ label, value, suffix, color = "default" }) => {
  const colors = {
    default: "bg-slate-50 border-slate-100",
    sky: "bg-sky-50 border-sky-100",
    emerald: "bg-emerald-50 border-emerald-100",
    rose: "bg-rose-50 border-rose-100",
    amber: "bg-amber-50 border-amber-100",
  };
  const textColors = {
    default: "text-slate-800",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className={`text-2xl font-black ${textColors[color]}`}>
        {value}
        {suffix && (
          <span className="text-sm font-medium text-slate-400 ml-1">
            {suffix}
          </span>
        )}
      </p>
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
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  if (!open) return null;
  const sizeClass = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white w-full ${sizeClass} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-sm text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
};

// ─── Calculation Preview ──────────────────────────────────────────────────────
const CalcPreview = ({ mode, calc, issuedQty }) => {
  if (!calc) return null;

  const issued = parseFloat(issuedQty) || 0;
  const recommended = parseFloat(calc.required_sqft) || 0;
  const diff = issued - recommended;
  const over = diff > 0.01;
  const under = diff < -0.01;

  const rows =
    mode === "sqft"
      ? [
          ["Cart sq.ft", calc.job_sqft, "From cart item"],
          [
            "Wastage Buf",
            calc.wastage_sqft,
            `${calc.wastage_buffer_pct}% of cart area`,
          ],
          ["Total", calc.required_sqft, "Cart + Buffer"],
        ]
      : [
          ["Job Area", calc.job_sqft, "Width × Height"],
          ["Margin Area", calc.margin_sqft, "Top + Bottom margins"],
          ["Gross Area", calc.gross_sqft, "Job + Margins"],
          [
            "Recommended",
            calc.required_sqft,
            `After ${calc.wastage_buffer_pct ?? "—"}% buffer`,
          ],
        ];

  const accentColor = mode === "sqft" ? "bg-violet-600" : "bg-sky-600";
  const borderColor =
    mode === "sqft"
      ? "bg-violet-50 border-violet-100"
      : "bg-sky-50 border-sky-100";
  const labelColor = mode === "sqft" ? "text-violet-600" : "text-sky-600";

  return (
    <div className={`${borderColor} border rounded-xl p-4 mt-3`}>
      <div className="flex items-center justify-between mb-3">
        <p
          className={`text-xs font-bold ${labelColor} uppercase tracking-wide`}
        >
          {mode === "sqft"
            ? "sq.ft Based Calculation"
            : "Server Calculation Breakdown"}
        </p>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mode === "sqft" ? "bg-violet-100 text-violet-600" : "bg-sky-100 text-sky-600"}`}
        >
          {mode === "sqft" ? "Auto from cart" : "Manual W×H"}
        </span>
      </div>
      <div
        className={`grid gap-2 mb-3 ${rows.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {rows.map(([k, v, hint]) => (
          <div
            key={k}
            className="bg-white rounded-lg p-2.5 text-center border border-white shadow-sm"
          >
            <p className="text-[10px] text-slate-400 mb-0.5 leading-tight">
              {k}
            </p>
            <p className="text-sm font-black text-slate-800">
              {v}{" "}
              <span className="text-[10px] font-normal text-slate-400">
                sqft
              </span>
            </p>
            <p className="text-[9px] text-slate-300 mt-0.5 leading-tight">
              {hint}
            </p>
          </div>
        ))}
      </div>
      <div
        className={`flex items-center justify-between ${accentColor} text-white rounded-lg px-4 py-2.5`}
      >
        <span className="text-xs font-bold tracking-wide">
          Recommended Issue Qty
        </span>
        <span className="text-lg font-black">
          {calc.required_sqft}{" "}
          <span className="text-xs font-normal opacity-80">sqft</span>
        </span>
      </div>
      {issued > 0 && (over || under) && (
        <p
          className={`mt-2 text-xs font-semibold ${over ? "text-amber-600" : "text-emerald-600"}`}
        >
          {over
            ? `⬆ Issuing ${diff.toFixed(2)} sqft above recommendation`
            : `⬇ Issuing ${Math.abs(diff).toFixed(2)} sqft below recommendation`}
        </p>
      )}
      {issued > 0 && !over && !under && (
        <p className="mt-2 text-xs font-semibold text-emerald-600">
          ✓ Matches recommendation exactly
        </p>
      )}
    </div>
  );
};

// ─── Job Lookup ───────────────────────────────────────────────────────────────
const JobLookup = ({ onJobSelected, issuedJobIds = new Set() }) => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const { toasts, show, dismiss } = useToast();

  const STATUS_CONFIG = {
    draft:       { label: "Draft",       color: "bg-slate-100 text-slate-600" },
    design:      { label: "Design",      color: "bg-blue-100 text-blue-700" },
    in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
    on_hold:     { label: "On Hold",     color: "bg-orange-100 text-orange-700" },
    production:  { label: "Production",  color: "bg-violet-100 text-violet-700" },
    accepted:    { label: "Accepted",    color: "bg-emerald-100 text-emerald-700" },
    converted:   { label: "Converted",   color: "bg-sky-100 text-sky-700" },
    completed:   { label: "Completed",   color: "bg-purple-100 text-purple-700" },
  };

  const fetchProductionJobs = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = ["design", "in_progress", "production", "accepted", "converted"];
      const requests = statuses.map((status) =>
        api(`/jobs?job_status=${status}&limit=100`).catch(() => null)
      );
      const results = await Promise.all(requests);

      const allJobs = results.flatMap((res) => {
        if (!res) return [];
        const list = res.data?.jobs || res.data || [];
        return Array.isArray(list) ? list : [];
      });

      const seen = new Set();
      const unique = allJobs.filter((j) => {
        if (seen.has(j._id)) return false;
        seen.add(j._id);
        return true;
      });

      const EXCLUDED_STATUSES = new Set(["draft", "sent", "viewed", "rejected", "expired", "completed"]);
      const active = unique.filter((j) => !EXCLUDED_STATUSES.has(j.job_status));

      const ORDER = ["design", "in_progress", "production", "accepted", "converted"];
      active.sort((a, b) => {
        const ai = ORDER.indexOf(a.job_status);
        const bi = ORDER.indexOf(b.job_status);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      setJobs(active);
      if (active.length === 0)
        show("No approved jobs found (design/production stage)", "warning");
    } catch (err) {
      show(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductionJobs();
  }, []);

  const filtered = useMemo(() => {
    let list = jobs.filter((j) => !issuedJobIds.has(j._id));
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(
      (j) =>
        j.job_no?.toLowerCase().includes(q) ||
        j.customer_name?.toLowerCase().includes(q) ||
        j.job_status?.toLowerCase().includes(q)
    );
  }, [jobs, filter, issuedJobIds]);

  const selectJob = (job) => {
    setSelected(job);
    onJobSelected(job);
  };
  const clearJob = () => {
    setSelected(null);
    onJobSelected(null);
  };

  useEffect(() => {
    if (selected && issuedJobIds.has(selected._id)) {
      setSelected(null);
      onJobSelected(null);
    }
  }, [issuedJobIds, selected]);

  const getStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || { label: status || "Unknown", color: "bg-slate-100 text-slate-600" };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {!selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">
                {loading
                  ? "Loading…"
                  : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} available`}
              </span>
            </div>
            <Btn
              variant="ghost"
              size="xs"
              onClick={fetchProductionJobs}
              loading={loading}
            >
              ↻ Refresh
            </Btn>
          </div>

          {jobs.length > 3 && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by job no, customer or status…"
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Spinner size={16} />
              <span className="text-sm">Fetching jobs…</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🏭"
              title="No available jobs"
              subtitle="No approved jobs found in design or production stage"
            />
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {filtered.map((job, idx) => {
                const isDesign = job.job_status === "design";
                return (
                  <div
                    key={job._id}
                    onClick={() => selectJob(job)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-violet-50 active:bg-violet-100 transition-colors ${
                      idx < filtered.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-600">
                      <span className="text-[9px] font-black text-white tracking-wider">
                        {isDesign ? "DSN" : "PROD"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800">
                          {job.job_no}
                        </p>
                        {job.approved_by && (
                          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            ✓ {job.approved_by}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {job.customer_name} · {job.cart_items?.length || 0} item(s)
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-slate-400">
                        {job.current_stage?.stage || "—"}
                      </p>
                      {getStatusBadge(job.job_status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex gap-3 items-center">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selected.job_status === "design"
                    ? "bg-blue-500/30"
                    : "bg-violet-500/30"
                }`}
              >
                <span className="text-[9px] font-black text-violet-200 tracking-wider">
                  {selected.job_status === "design" ? "DSN" : "PROD"}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold">{selected.job_no}</p>
                <p className="text-xs text-white/50">{selected.customer_name}</p>
              </div>
            </div>
            <button
              onClick={clearJob}
              className="text-xs text-violet-400 font-semibold hover:text-violet-300"
            >
              Change
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              ["Status", (STATUS_CONFIG[selected.job_status]?.label || selected.job_status || "—")],
              ["Stage",  selected.current_stage?.stage || "—"],
              ["Items",  selected.cart_items?.length || 0],
            ].map(([k, v]) => (
              <div key={k} className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] text-white/40 mb-0.5">{k}</p>
                <p className="text-xs font-bold truncate">{v}</p>
              </div>
            ))}
          </div>
          {selected.approved_by && (
            <div className="mt-2 flex items-center gap-2 bg-emerald-500/20 rounded-lg px-3 py-1.5">
              <span className="text-emerald-300 text-xs">✓ Approved by</span>
              <span className="text-white text-xs font-bold">{selected.approved_by}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Source Mode Tab Toggle ────────────────────────────────────────────────────
const SourceModeToggle = ({ mode, onChange }) => (
  <div className="flex rounded-xl overflow-hidden border border-slate-200 w-full mb-4">
    <button
      type="button"
      onClick={() => onChange("insource")}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all duration-150 ${
        mode === "insource"
          ? "bg-slate-900 text-white shadow-inner"
          : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      <span>🏠</span> In Source
    </button>
    <button
      type="button"
      onClick={() => onChange("outsource")}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold border-l border-slate-200 transition-all duration-150 ${
        mode === "outsource"
          ? "bg-indigo-600 text-white shadow-inner"
          : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      <span>🔗</span> Out Source
    </button>
  </div>
);

// ─── Issue Panel ──────────────────────────────────────────────────────────────
const IssuePanel = ({
  products,
  employees,
  allUsers,
  onIssued,
  issuedJobIds,
}) => {
  const { user } = useSelector((s) => s.authSlice);

  // ── Source mode: "insource" | "outsource" ────────────────────────────────
  const [sourceMode, setSourceMode] = useState("insource");

  // ── Job / cart ────────────────────────────────────────────────────────────
  const [job, setJob] = useState(null);
  const [cartItemIdx, setCartItemIdx] = useState(0);

  // ── Calculation fields ────────────────────────────────────────────────────
  const [manualMode, setManualMode] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [marginTop, setMarginTop] = useState(4);
  const [marginBot, setMarginBot] = useState(3);
  const [buffer, setBuffer] = useState(20);
  const [calc, setCalc] = useState(null);
  const [issuedQty, setIssuedQty] = useState("");
  const [calcLoading, setCalcLoading] = useState(false);

  // ── In-Source personnel ───────────────────────────────────────────────────
  const [empId, setEmpId] = useState("");

  // ── Out-Source fields ─────────────────────────────────────────────────────
  const [outsourceType, setOutsourceType] = useState("");
  const [outsourceVendor, setOutsourceVendor] = useState("");

  // ── Shared ────────────────────────────────────────────────────────────────
  const [productId, setProductId] = useState("");
  const [issueNotes, setIssueNotes] = useState("");

  const [submitLoad, setSubmitLoad] = useState(false);
  const { toasts, show, dismiss } = useToast();

  // ── Stable refs ───────────────────────────────────────────────────────────
  const calcTimer = useRef(null);
  const prevSqftKey = useRef(null);

  // ── Pure derived values ───────────────────────────────────────────────────
  const cartItem = job?.cart_items?.[cartItemIdx];

  const cartSqFt = useMemo(() => {
    const v = parseFloat(cartItem?.sq_ft);
    return isNaN(v) ? 0 : v;
  }, [cartItem]);

  const calcMode = manualMode ? "server" : "sqft";
  const isOutsourced = sourceMode === "outsource";

  const selectedProduct = products.find((p) => p._id === productId);
  const selectedEmp = employees.find((e) => e._id === empId);

  // ── Dimension parser ──────────────────────────────────────────────────────
  const parseDimensions = (sizeStr) => {
    if (!sizeStr) return null;
    const m = sizeStr.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : null;
  };

  // ── EFFECT 1: sqft auto-calc ──────────────────────────────────────────────
  useEffect(() => {
    if (manualMode) return;
    if (!cartSqFt || cartSqFt <= 0) {
      setCalc(null);
      setIssuedQty("");
      prevSqftKey.current = null;
      return;
    }
    const key = `${cartSqFt}|${buffer}`;
    if (prevSqftKey.current === key) return;
    prevSqftKey.current = key;
    const buf = parseFloat(buffer) || 0;
    const wastage = parseFloat(((cartSqFt * buf) / 100).toFixed(4));
    const required = parseFloat((cartSqFt + wastage).toFixed(4));
    setCalc({
      job_sqft: cartSqFt,
      wastage_sqft: wastage,
      required_sqft: required,
      wastage_buffer_pct: buf,
    });
    setIssuedQty(required);
  }, [cartSqFt, buffer, manualMode]);

  // ── EFFECT 2: manual W×H server calc ─────────────────────────────────────
  useEffect(() => {
    if (!manualMode) return;
    clearTimeout(calcTimer.current);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!w || !h || w <= 0 || h <= 0) {
      setCalc(null);
      return;
    }
    calcTimer.current = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const res = await api("/material/calculate", {
          method: "POST",
          body: JSON.stringify({
            width_ft: w,
            height_ft: h,
            margin_top_in: parseFloat(marginTop) || 0,
            margin_bottom_in: parseFloat(marginBot) || 0,
            wastage_buffer_pct: parseFloat(buffer) || 0,
          }),
        });
        setCalc(res.data);
        setIssuedQty(res.data.required_sqft);
      } catch (err) {
        show(`Calculation failed: ${err.message}`, "error");
      } finally {
        setCalcLoading(false);
      }
    }, 600);
    return () => clearTimeout(calcTimer.current);
  }, [manualMode, width, height, marginTop, marginBot, buffer]);

  // ── resetCalcForItem ──────────────────────────────────────────────────────
  const resetCalcForItem = useCallback((selectedJob, idx) => {
    const item = selectedJob?.cart_items?.[idx];
    setCalc(null);
    setIssuedQty("");
    setManualMode(false);
    prevSqftKey.current = null;
    if (item?.size) {
      const dims = parseDimensions(item.size);
      if (dims) {
        setWidth(dims.w);
        setHeight(dims.h);
      } else {
        setWidth("");
        setHeight("");
      }
    } else {
      setWidth("");
      setHeight("");
    }
  }, []);

  // ── handleJobSelected ─────────────────────────────────────────────────────
  const handleJobSelected = useCallback(
    (selectedJob) => {
      setJob(selectedJob);
      setCartItemIdx(0);
      setProductId("");
      setEmpId("");
      setIssueNotes("");
      setOutsourceType("");
      setOutsourceVendor("");
      prevSqftKey.current = null;
      if (selectedJob) {
        resetCalcForItem(selectedJob, 0);
      } else {
        setCalc(null);
        setIssuedQty("");
        setManualMode(false);
        setWidth("");
        setHeight("");
      }
    },
    [resetCalcForItem],
  );

  // ── handleCartItemChange ──────────────────────────────────────────────────
  const handleCartItemChange = useCallback(
    (idxStr) => {
      const idx = parseInt(idxStr, 10);
      setCartItemIdx(idx);
      resetCalcForItem(job, idx);
    },
    [job, resetCalcForItem],
  );

  // ── toggleManualMode ──────────────────────────────────────────────────────
  const toggleManualMode = useCallback((toManual) => {
    setManualMode(toManual);
    setCalc(null);
    setIssuedQty("");
    prevSqftKey.current = null;
  }, []);

  // ── handleSourceModeChange ────────────────────────────────────────────────
  const handleSourceModeChange = useCallback((newMode) => {
    setSourceMode(newMode);
    setEmpId("");
    setOutsourceType("");
    setOutsourceVendor("");
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!job) return show("Select a job first", "error");

    if (!isOutsourced && !productId)
      return show("Select a material product", "error");

    if (!isOutsourced && !empId)
      return show("Select an employee to issue to", "error");

    if (isOutsourced && !outsourceVendor.trim())
      return show(
        "Please enter vendor / party name for outsourced work",
        "error",
      );

    const qty = parseFloat(issuedQty);
    if (!isOutsourced && (!qty || qty <= 0))
      return show("Issued quantity must be greater than 0", "error");

    if (
      !isOutsourced &&
      manualMode &&
      (!parseFloat(width) || !parseFloat(height))
    )
      return show("Width and Height are required in manual mode", "error");

    if (!isOutsourced && selectedProduct && selectedProduct.stock_count < qty)
      return show(
        `Insufficient stock — available: ${selectedProduct.stock_count} sqft`,
        "error",
      );

    setSubmitLoad(true);
    try {
      const dimensionsPayload = {
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        unit: "ft",
      };

      const effectiveOutsourceType = isOutsourced
        ? outsourceType.trim() || "other"
        : "none";
      const effectiveQty = isOutsourced ? parseFloat(issuedQty) || 0 : qty;

      const payload = {
        cart_item_index: cartItemIdx,
        material: isOutsourced
          ? { product_id: null, product_name: "Outsourced", unit: "sqft" }
          : {
              product_id: productId,
              product_name: selectedProduct?.name,
              unit: "sqft",
            },
        issued_qty: effectiveQty,
        sq_ft: cartSqFt || null,
        calc_mode: isOutsourced ? "outsource" : calcMode,
        wastage_buffer_pct: parseFloat(buffer) || 0,
        outsource_type: effectiveOutsourceType,
        outsource_vendor: isOutsourced ? outsourceVendor.trim() : "",
        dimensions: dimensionsPayload,
        ...(!isOutsourced && manualMode
          ? {
              margin_top_in: parseFloat(marginTop) || 0,
              margin_bottom_in: parseFloat(marginBot) || 0,
            }
          : {}),
        issued_to: isOutsourced
          ? { user_id: null, name: outsourceVendor.trim(), role: "outsource" }
          : {
              user_id: empId,
              name: selectedEmp?.name || "",
              role: selectedEmp?.role || "",
            },
        issued_by: {
          user_id: user?._id,
          name: user?.name || "Store Manager",
          role: user?.role || "store manager",
        },
        issue_notes: issueNotes,
      };

      const res = await api(`/jobs/${job._id}/material/issue`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      show(res.message || "Material issued successfully", "success");

      const newIssue = {
        _id: res.data?.issue_id,
        issue_no: res.data?.issue_no,
        job_id: job._id,
        job_no: res.data?.job_no || job.job_no,
        cart_item_index: cartItemIdx,
        cart_item_name: cartItem?.product_name || "",
        material: isOutsourced
          ? { product_id: null, product_name: "Outsourced", unit: "sqft" }
          : {
              product_id: productId,
              product_name: selectedProduct?.name,
              unit: "sqft",
            },
        issued_qty: effectiveQty,
        suggested_qty: res.data?.suggested_qty || calc?.required_sqft || 0,
        issued_to: isOutsourced
          ? { user_id: null, name: outsourceVendor.trim(), role: "outsource" }
          : {
              user_id: empId,
              name: selectedEmp?.name || "",
              role: selectedEmp?.role || "",
            },
        issued_by: {
          user_id: user?._id,
          name: user?.name || "",
          role: user?.role || "",
        },
        dimensions: dimensionsPayload,
        calculation: res.data?.calculation || calc || {},
        outsource_type: effectiveOutsourceType,
        outsource_vendor: isOutsourced ? outsourceVendor.trim() : "",
        wastage_buffer_pct: parseFloat(buffer) || 0,
        issue_notes: issueNotes,
        status: "issued",
        return: null,
        createdAt: new Date().toISOString(),
      };

      onIssued(
        newIssue,
        isOutsourced ? null : productId,
        effectiveQty,
        job._id,
      );
      generateSlipPDF(newIssue, user);

      // Full reset
      setJob(null);
      setCartItemIdx(0);
      setProductId("");
      setEmpId("");
      setIssueNotes("");
      setIssuedQty("");
      setCalc(null);
      setOutsourceType("");
      setOutsourceVendor("");
      setManualMode(false);
      setWidth("");
      setHeight("");
      setSourceMode("insource");
      prevSqftKey.current = null;
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSubmitLoad(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* ── Production Jobs Card ──────────────────────────────────────────── */}
      <Card className="p-5">
        <SectionHeader
          icon="🏭"
          title="Production Jobs"
          subtitle="Select a job currently in production"
        />

        {/* ── SOURCE MODE TOGGLE — always visible at the top ─────────────── */}
        <SourceModeToggle mode={sourceMode} onChange={handleSourceModeChange} />

        {/* ── Outsource indicator banner (only in outsource mode) ─────────── */}
        {isOutsourced && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 mb-4">
            <span className="text-indigo-500 text-sm">🔗</span>
            <span className="text-xs font-semibold text-indigo-700">
              Outsource Mode — Material sent to external vendor
            </span>
            <Badge variant="indigo" className="ml-auto">
              External
            </Badge>
          </div>
        )}

        {/* ── SHARED: Single JobLookup used by both modes ─────────────────── */}
        <div className="space-y-4">
          <JobLookup
            onJobSelected={handleJobSelected}
            issuedJobIds={issuedJobIds}
          />

          {/* ── SHARED: Cart item selector ──────────────────────────────────── */}
          {job && job.cart_items?.length > 1 && (
            <Select
              label="Cart Item"
              value={String(cartItemIdx)}
              onChange={handleCartItemChange}
              options={job.cart_items.map((item, idx) => ({
                value: String(idx),
                label: `#${idx + 1} · ${item.product_name || "Item"}${item.size ? ` · ${item.size}` : ""}`,
              }))}
            />
          )}

          {/* ── SHARED: Cart item info grid ─────────────────────────────────── */}
          {job && cartItem && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Product", cartItem.product_name],
                ["Size", cartItem.size],
                ["sq.ft", cartSqFt > 0 ? `${cartSqFt} sqft` : "—"],
                ["Print Type", cartItem.printing_type],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className={`rounded-xl p-2.5 ${k === "sq.ft" && cartSqFt > 0 ? "bg-violet-50 border border-violet-100" : "bg-slate-50"}`}
                >
                  <p
                    className={`text-[10px] mb-0.5 uppercase tracking-wide ${k === "sq.ft" && cartSqFt > 0 ? "text-violet-400" : "text-slate-400"}`}
                  >
                    {k}
                  </p>
                  <p
                    className={`text-xs font-semibold truncate ${k === "sq.ft" && cartSqFt > 0 ? "text-violet-700" : "text-slate-700"}`}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── OUT SOURCE specific fields (only when outsource mode + job selected) */}
          {isOutsourced && job && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                Outsource Details
              </p>

              <Input
                label="Out Source Type"
                value={outsourceType}
                onChange={(e) => setOutsourceType(e.target.value)}
                placeholder="e.g. Printing, Lamination, Fabrication…"
              />

              <Input
                label="Vendor / Party Name *"
                value={outsourceVendor}
                onChange={(e) => setOutsourceVendor(e.target.value)}
                placeholder="e.g. Sri Murugan Printers, Chennai…"
              />

              {outsourceVendor.trim() && (
                <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🏭</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-indigo-800 truncate">
                      {outsourceVendor.trim()}
                    </p>
                    <p className="text-xs text-indigo-500">
                      {outsourceType.trim() ? outsourceType.trim() : "Outsource"}{" "}
                      · External vendor
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Rest of the form only when job is selected ────────────────────── */}
      {job && (
        <>
          {/* ── Material Selection Card (In-Source only) ────────────────── */}
          {!isOutsourced && (
            <Card className="p-5">
              <SectionHeader
                icon="📦"
                title="Material Selection"
                subtitle="Choose the product to issue"
              />
              <div className="space-y-4">
                <Select
                  label="Product"
                  value={productId}
                  onChange={(v) => setProductId(v)}
                  placeholder="Select material…"
                  options={products.map((p) => ({
                    value: p._id,
                    label: `${p.name} (${p.stock_count || 0} sqft)`,
                  }))}
                />

                {selectedProduct && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                      selectedProduct.stock_count > 50
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedProduct.stock_count > 10
                          ? "bg-amber-50 text-amber-700"
                          : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span>
                      {selectedProduct.stock_count > 50
                        ? "●"
                        : selectedProduct.stock_count > 10
                          ? "◆"
                          : "▲"}
                    </span>
                    {selectedProduct.stock_count} sqft in stock
                  </div>
                )}

                <Input
                  label="Issue Notes"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="e.g. Day 1 of 3-day job, special instructions…"
                />
              </div>
            </Card>
          )}

          {/* ── Calculation Card (In-Source only) ───────────────────────── */}
          {!isOutsourced && (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">
                    📐
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Material Calculation
                    </h3>
                    <p className="text-xs text-slate-400">
                      {!manualMode
                        ? cartSqFt > 0
                          ? `Using cart sq.ft (${cartSqFt} sqft) + wastage buffer`
                          : "No sq.ft on cart item — switch to manual"
                        : "Manual Width × Height → server calculates"}
                    </p>
                  </div>
                </div>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 text-xs font-semibold">
                  <button
                    onClick={() => toggleManualMode(false)}
                    className={`px-3 py-1.5 transition-colors ${!manualMode ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                  >
                    sq.ft
                  </button>
                  <button
                    onClick={() => toggleManualMode(true)}
                    className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${manualMode ? "bg-sky-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                  >
                    W × H
                  </button>
                </div>
              </div>

              {/* sq.ft mode */}
              {!manualMode && (
                <div className="space-y-4">
                  {cartSqFt > 0 ? (
                    <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-violet-700">
                      <span>▣</span>
                      Cart sq.ft:{" "}
                      <span className="font-black ml-1">{cartSqFt} sqft</span>
                      <span className="ml-auto text-violet-400 font-normal">
                        from "{cartItem?.size}"
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-amber-700">
                      <span>⚠</span> Cart item has no sq.ft — switch to W × H
                      mode or enter qty manually
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <NumberInput
                      label="Wastage Buffer %"
                      value={buffer}
                      onChange={setBuffer}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                    />
                    {cartSqFt > 0 && calc && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-400 mb-0.5">
                          Wastage added
                        </p>
                        <p className="text-sm font-black text-amber-600">
                          +{calc.wastage_sqft}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            sqft
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual W×H mode */}
              {manualMode && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                      Print Dimensions (ft)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberInput
                        label="Width"
                        value={width}
                        onChange={setWidth}
                        min={0.1}
                        step={0.1}
                        suffix="ft"
                      />
                      <NumberInput
                        label="Height"
                        value={height}
                        onChange={setHeight}
                        min={0.1}
                        step={0.1}
                        suffix="ft"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                      Margins & Buffer
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <NumberInput
                        label="Top Margin"
                        value={marginTop}
                        onChange={setMarginTop}
                        min={0}
                        step={0.5}
                        suffix="in"
                      />
                      <NumberInput
                        label="Bottom Margin"
                        value={marginBot}
                        onChange={setMarginBot}
                        min={0}
                        step={0.5}
                        suffix="in"
                      />
                      <NumberInput
                        label="Buffer %"
                        value={buffer}
                        onChange={setBuffer}
                        min={0}
                        max={100}
                        step={1}
                        suffix="%"
                      />
                    </div>
                  </div>
                  {calcLoading && (
                    <div className="flex items-center gap-2 text-xs text-sky-500 font-semibold py-1">
                      <Spinner size={12} /> Calculating via server…
                    </div>
                  )}
                </div>
              )}

              <CalcPreview mode={calcMode} calc={calc} issuedQty={issuedQty} />

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">
                  Recommended qty pre-filled. Override if issuing a different
                  amount.
                </p>
                <NumberInput
                  label="Actual Qty to Issue *"
                  value={issuedQty}
                  onChange={setIssuedQty}
                  min={0.01}
                  step={0.1}
                  suffix="sqft"
                />
                {calc &&
                  issuedQty !== "" &&
                  parseFloat(issuedQty) !== calc.required_sqft && (
                    <p className="text-xs text-amber-500 font-medium mt-1.5">
                      ⚠ Differs from recommended ({calc.required_sqft} sqft) —
                      manual override
                    </p>
                  )}
              </div>
            </Card>
          )}

          {/* ── Personnel Card (In-Source only) ─────────────────────────── */}
          {!isOutsourced && (
            <Card className="p-5">
              <SectionHeader
                icon="👤"
                title="Personnel"
                subtitle="Who is receiving this material"
              />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Select
                  label="Issue To"
                  required
                  value={empId}
                  onChange={(v) => setEmpId(v)}
                  placeholder="Select employee…"
                  options={employees.map((e) => ({
                    value: e._id,
                    label: e.name,
                  }))}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Issued By
                  </label>
                  <div className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium">
                    {user?.name || "—"}
                  </div>
                </div>
              </div>

              {selectedEmp && (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <Avatar name={selectedEmp.name} size="lg" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedEmp.name}
                    </p>
                    <p className="text-xs text-slate-400">{selectedEmp.role}</p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <div className="pb-4">
            <Btn
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              loading={submitLoad}
              fullWidth
            >
              📋 Issue Material & Print Slip
            </Btn>
          </div>
        </>
      )}

      {!job && (
        <EmptyState
          icon="🔍"
          title="No job selected"
          subtitle="Search and select a production job above to continue"
        />
      )}
    </div>
  );
};

// ─── Issues Panel (Records) ───────────────────────────────────────────────────
const IssuesPanel = ({ issues, onViewIssue, onRefresh, loading }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = useMemo(() => {
    let list = issues;
    if (statusFilter === "flagged")
      list = list.filter(
        (i) => i.return?.is_flagged && !i.return?.manager_reviewed,
      );
    else if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.issue_no?.toLowerCase().includes(q) ||
          i.job_no?.toLowerCase().includes(q) ||
          i.issued_to?.name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [issues, statusFilter, search]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by issue no, job, employee…"
          className="flex-1"
        />
        <div className="flex gap-2">
          <div className="flex-1 sm:w-36">
            <Select
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              placeholder="All statuses"
              options={[
                { value: "issued", label: "Issued" },
                { value: "returned", label: "Returned" },
                { value: "no_return", label: "No Return" },
                { value: "flagged", label: "🚩 Flagged" },
              ]}
            />
          </div>
          <Btn
            variant="ghost"
            onClick={onRefresh}
            loading={loading}
            size="md"
            className="flex-shrink-0"
          >
            ↻
          </Btn>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </p>
        {filtered.length !== issues.length && (
          <button
            onClick={() => {
              setStatusFilter("");
              setSearch("");
            }}
            className="text-xs text-sky-500 font-semibold"
          >
            Clear filters
          </button>
        )}
      </div>

      {paginated.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No records found"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {paginated.map((issue) => {
            const outsourceLabelCard =
              OUTSOURCE_TYPES.find((o) => o.value === issue.outsource_type)
                ?.label || issue.outsource_type;
            const isOutsourcedCard =
              issue.outsource_type && issue.outsource_type !== "none";
            return (
              <Card
                key={issue._id}
                hoverable
                className="p-4"
                onClick={() => onViewIssue(issue, "view")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-sky-600 font-mono tracking-wide">
                        {issue.issue_no}
                      </span>
                      {issue.return?.is_flagged &&
                        !issue.return?.manager_reviewed && (
                          <Badge variant="red">🚩 Review</Badge>
                        )}
                      {isOutsourcedCard && (
                        <Badge variant="indigo">🔗 {outsourceLabelCard}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {issue.job_no}
                    </p>
                  </div>
                  <StatusBadge status={issue.status} />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={issue.issued_to?.name || "?"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {issue.issued_to?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isOutsourcedCard
                        ? "External vendor"
                        : issue.issued_to?.role}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">
                      {issue.material?.product_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {issue.issued_qty} sqft
                    </p>
                  </div>
                </div>

                {issue.calculation && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[
                      ["Job Area", issue.calculation.job_sqft],
                      ["Gross", issue.calculation.gross_sqft],
                      ["Recommended", issue.calculation.required_sqft],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="bg-slate-50 rounded-lg p-1.5 text-center"
                      >
                        <p className="text-[9px] text-slate-400">{k}</p>
                        <p className="text-xs font-bold text-slate-700">
                          {v}
                          <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                            sqft
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {issue.return ? (
                  <WastageBar pct={issue.return.wastage_ratio_pct || 0} />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100" />
                    Pending return
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewIssue(issue, "view");
                    }}
                  >
                    View Details
                  </Btn>
                  {issue.return?.is_flagged &&
                    !issue.return?.manager_reviewed && (
                      <Btn
                        size="xs"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewIssue(issue, "review");
                        }}
                      >
                        Review
                      </Btn>
                    )}
                  <Btn
                    size="xs"
                    variant="ghost"
                    className="ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateSlipPDF(issue, null);
                    }}
                  >
                    📄 Slip
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 pt-2 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.min(
              Math.max(page - 2 + i, 1),
              totalPages - Math.min(4, totalPages - 1) + i,
            );
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === page ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Report Panel ─────────────────────────────────────────────────────────────
const ReportPanel = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { toasts, show, dismiss } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      const res = await api(
        `/material/report/wastage${params.toString() ? "?" + params.toString() : ""}`,
      );
      setReport(res.data);
    } catch (e) {
      show(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, []);

  const o = report?.overall;

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <Card className="p-5">
        <SectionHeader
          icon="📊"
          title="Wastage Report"
          subtitle="Filter by date range"
        />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Btn
          variant="primary"
          onClick={fetchReport}
          loading={loading}
          fullWidth
        >
          Apply Filter
        </Btn>
      </Card>

      {o && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Total Issued"
              value={parseFloat((o.total_issued_qty || 0).toFixed(1))}
              suffix="sqft"
              color="sky"
            />
            <StatTile
              label="Avg Wastage"
              value={(o.avg_wastage_ratio || 0).toFixed(1)}
              suffix="%"
              color="amber"
            />
            <StatTile
              label="Total Wastage"
              value={parseFloat((o.total_actual_wastage || 0).toFixed(1))}
              suffix="sqft"
            />
            <StatTile
              label="Needs Review"
              value={o.flagged_count || 0}
              color={o.flagged_count > 0 ? "rose" : "emerald"}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["✓ Good", o.good_count, "emerald"],
              ["◆ Acceptable", o.acceptable_count, "amber"],
              ["▼ High Wastage", o.high_wastage_count, "rose"],
            ].map(([l, count, color]) => (
              <StatTile key={l} label={l} value={count || 0} color={color} />
            ))}
          </div>
        </>
      )}

      {report?.by_employee?.length > 0 && (
        <Card className="p-5">
          <SectionHeader icon="👥" title="Employee Performance" />
          <div className="space-y-3">
            {report.by_employee.map((emp) => (
              <div
                key={emp._id}
                className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
              >
                <Avatar name={emp.employee_name || "?"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {emp.employee_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {emp.total_issues} issues
                  </p>
                </div>
                <div className="w-24 flex-shrink-0">
                  <WastageBar pct={emp.avg_wastage_ratio || 0} />
                </div>
                <PerfBadge rating={emp.overall_rating || "acceptable"} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {report?.by_outsource_type?.length > 0 && (
        <Card className="p-5">
          <SectionHeader
            icon="🔗"
            title="Outsource Breakdown"
            subtitle="Issues by outsource type"
          />
          <div className="space-y-3">
            {report.by_outsource_type.map((r) => {
              const label =
                OUTSOURCE_TYPES.find((o) => o.value === r._id)?.label ||
                r._id ||
                "Unknown";
              const max = Math.max(
                ...report.by_outsource_type.map((x) => x.count),
              );
              return (
                <div key={r._id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="text-slate-400 font-semibold">
                      {r.count}× ·{" "}
                      {parseFloat((r.total_issued || 0).toFixed(1))} sqft
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {report?.by_wastage_reason?.length > 0 && (
        <Card className="p-5 pb-6">
          <SectionHeader icon="📉" title="Wastage Reasons" />
          <div className="space-y-3">
            {report.by_wastage_reason.map((r) => {
              const label =
                WASTAGE_REASONS.find((w) => w.value === r._id)?.label ||
                r._id ||
                "Unknown";
              const max = Math.max(
                ...report.by_wastage_reason.map((x) => x.count),
              );
              return (
                <div key={r._id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="text-slate-400 font-semibold">
                      {r.count}×
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full transition-all duration-700"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!o && !loading && (
        <EmptyState
          icon="📊"
          title="No report data"
          subtitle="Issue some materials first to see wastage analytics"
        />
      )}
    </div>
  );
};

// ─── Issue Detail Modal ───────────────────────────────────────────────────────
const IssueDetailModal = ({ issue, mode, onClose, onReviewSaved }) => {
  const { user } = useSelector((s) => s.authSlice);
  const { toasts, show, dismiss } = useToast();
  const [override, setOverride] = useState("");
  const [manNotes, setManNotes] = useState("");
  const [loading, setLoading] = useState(false);
  if (!issue) return null;

  const handleReview = async () => {
    setLoading(true);
    try {
      const payload = {
        manager_by: {
          user_id: user?._id || "unknown",
          name: user?.name || "Store Manager",
        },
        manager_notes: manNotes,
        override_rating: override || null,
      };
      const method = issue.return?.manager_reviewed ? "PUT" : "POST";
      const res = await api(`/material/${issue._id}/review`, {
        method,
        body: JSON.stringify(payload),
      });
      show(res.message || "Review saved", "success");
      onReviewSaved(issue._id, {
        manager_notes: manNotes,
        override_rating: override,
      });
      onClose();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const r = issue.return;
  const calc = issue.calculation;
  const isOutsourcedModal =
    issue.outsource_type && issue.outsource_type !== "none";
  const outsourceLabelModal =
    OUTSOURCE_TYPES.find((o) => o.value === issue.outsource_type)?.label ||
    issue.outsource_type;

  return (
    <Modal
      open
      title={`${issue.issue_no} · ${issue.job_no}`}
      onClose={onClose}
      size="md"
    >
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
            Issue Summary
          </p>
          <div className="space-y-1">
            {[
              ["Material", issue.material?.product_name],
              ["Issued Qty", `${issue.issued_qty} sqft`],
              [
                "Recommended",
                `${issue.suggested_qty || calc?.required_sqft || "—"} sqft`,
              ],
              [
                "Dimensions",
                issue.dimensions
                  ? `${issue.dimensions?.width}ft × ${issue.dimensions?.height}ft`
                  : "—",
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between items-center py-2 border-b border-slate-50"
              >
                <span className="text-xs text-slate-400">{k}</span>
                <span className="text-sm font-semibold text-slate-800">
                  {v}
                </span>
              </div>
            ))}

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-400">
                {isOutsourcedModal ? "Vendor" : "Employee"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {issue.issued_to?.name || "—"}
                </span>
                {isOutsourcedModal && <Badge variant="indigo">External</Badge>}
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-400">Out Source</span>
              {isOutsourcedModal ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-indigo-700">
                    {outsourceLabelModal}
                  </span>
                  <Badge variant="indigo">External</Badge>
                </div>
              ) : (
                <span className="text-sm font-semibold text-slate-800">
                  In-House
                </span>
              )}
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-slate-400">Status</span>
              <StatusBadge status={issue.status} />
            </div>
          </div>
        </div>

        {calc && (
          <div>
            <Divider label="Calculation Breakdown" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Job Area", calc.job_sqft],
                ["Margin", calc.margin_sqft],
                ["Gross", calc.gross_sqft],
                ["Recommended", calc.required_sqft],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="bg-sky-50 border border-sky-100 rounded-xl p-2.5 text-center"
                >
                  <p className="text-[10px] text-slate-400 mb-0.5">{k}</p>
                  <p className="text-sm font-black text-sky-700">
                    {v}
                    <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                      sqft
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Btn
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => generateSlipPDF(issue, user)}
        >
          📄 Download / Print Slip
        </Btn>

        {r && (
          <div>
            <Divider label="Return Details" />
            <div className="space-y-1">
              {[
                ["Returned", `${r.returned_qty} sqft`],
                ["Used", `${r.actual_used_qty} sqft`],
                ["Wastage", `${r.actual_wastage_qty} sqft`],
                ["Ratio", `${r.wastage_ratio_pct}%`],
                [
                  "Reason",
                  WASTAGE_REASONS.find((x) => x.value === r.wastage_reason)
                    ?.label || r.wastage_reason,
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between py-2 border-b border-slate-50"
                >
                  <span className="text-xs text-slate-400">{k}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {v}
                  </span>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <span className="text-xs text-slate-400">Performance</span>
                <PerfBadge rating={r.performance_rating} />
              </div>
            </div>
            {r.is_flagged && (
              <div
                className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${r.manager_reviewed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
              >
                {r.manager_reviewed
                  ? "✓ Reviewed by manager"
                  : "🚩 Flagged · pending review"}
              </div>
            )}
          </div>
        )}

        {mode === "review" && r && (
          <div>
            <Divider label="Manager Review" />
            <div className="space-y-3">
              <Select
                label="Override Rating"
                value={override}
                onChange={setOverride}
                placeholder="Keep auto-rating"
                options={[
                  { value: "good", label: "Good" },
                  { value: "acceptable", label: "Acceptable" },
                  { value: "high_wastage", label: "High Wastage" },
                ]}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Manager Notes
                </label>
                <textarea
                  value={manNotes}
                  onChange={(e) => setManNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all resize-none"
                  placeholder="Explain the override rationale…"
                />
              </div>
              <Btn
                variant="primary"
                onClick={handleReview}
                loading={loading}
                fullWidth
              >
                Save Review
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function MaterialIssueManager() {
  const { user } = useSelector((s) => s.authSlice);
  const navigate = useNavigate();

  const [tab, setTab] = useState("issue");
  const [issues, setIssues] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [issLoading, setIssLoading] = useState(false);
  const [modalIssue, setModalIssue] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [issuedJobIds, setIssuedJobIds] = useState(new Set());
  const { toasts, show, dismiss } = useToast();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api("/product/get_product");
      setProducts(res.data || []);
    } catch {}
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api("/admin/get_admin");
      const admins = res.data || [];
      setEmployees(admins.filter((e) => e.role === "production team"));
      setAllUsers(admins);
    } catch {}
  }, []);

  const fetchIssues = useCallback(async () => {
    setIssLoading(true);
    try {
      const res = await api("/material?limit=100");
      const list = res.data?.issues || [];
      setIssues(list);
      setIssuedJobIds(new Set(list.map((i) => i.job_id).filter(Boolean)));
    } catch (e) {
      show(e.message, "error");
    } finally {
      setIssLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchEmployees();
    fetchIssues();
  }, []);

  const handleIssued = async (newIssue, productId, qty, jobId) => {
    setIssues((prev) => [newIssue, ...prev]);
    if (productId) {
      setProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? { ...p, stock_count: Math.max(0, (p.stock_count || 0) - qty) }
            : p,
        ),
      );
    }
    setIssuedJobIds((prev) => new Set([...prev, jobId]));
    setTab("issues");
  };

  const handleReviewSaved = (issueId, data) => {
    setIssues((prev) =>
      prev.map((i) =>
        i._id === issueId && i.return
          ? {
              ...i,
              return: {
                ...i.return,
                manager_reviewed: true,
                manager_notes: data.manager_notes,
                performance_rating:
                  data.override_rating || i.return.performance_rating,
              },
            }
          : i,
      ),
    );
  };

  const stats = useMemo(
    () => ({
      pending: issues.filter((i) => i.status === "issued").length,
      flagged: issues.filter(
        (i) => i.return?.is_flagged && !i.return?.manager_reviewed,
      ).length,
      totalIssued: parseFloat(
        issues.reduce((s, i) => s + (i.issued_qty || 0), 0).toFixed(1),
      ),
      avgWaste: (() => {
        const ret = issues.filter((i) => i.return);
        return ret.length
          ? parseFloat(
              (
                ret.reduce((s, i) => s + (i.return.wastage_ratio_pct || 0), 0) /
                ret.length
              ).toFixed(1),
            )
          : 0;
      })(),
    }),
    [issues],
  );

  const TABS = [
    { key: "issue", label: "Issue", icon: "📋" },
    { key: "issues", label: "Records", icon: "📦", badge: issues.length },
    { key: "report", label: "Report", icon: "📊" },
  ];

  return (
    <>
      <style>{`
        @keyframes slide-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ToastContainer toasts={toasts} dismiss={dismiss} />

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">DM</span>
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 leading-tight tracking-tight">
                    Material Issuance
                  </h1>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Flex roll & print tracker
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {stats.flagged > 0 && (
                  <button
                    onClick={() => setTab("issues")}
                    className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-full px-3 py-1.5 hover:bg-rose-100 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-xs font-bold text-rose-600">
                      {stats.flagged} to review
                    </span>
                  </button>
                )}
                <button
                  onClick={() => navigate("/add-product")}
                  className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-3 py-2 hover:bg-slate-700 active:scale-95 transition-all duration-150 shadow-sm"
                >
                  <span className="text-sm leading-none font-bold">+</span>
                  <span className="text-xs font-bold hidden sm:inline">
                    Add Product
                  </span>
                  <span className="text-xs font-bold sm:hidden">Add</span>
                </button>
                {user?.name && (
                  <div className="hidden sm:flex items-center gap-2">
                    <Avatar name={user.name} size="sm" />
                    <span className="text-xs font-semibold text-slate-600">
                      {user.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-2 pb-3">
              {[
                {
                  label: "Issued",
                  value: stats.totalIssued,
                  suffix: "sqft",
                  color: "text-sky-600",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  suffix: "",
                  color:
                    stats.pending > 0 ? "text-amber-600" : "text-slate-700",
                },
                {
                  label: "Avg Waste",
                  value: `${stats.avgWaste}%`,
                  suffix: "",
                  color:
                    stats.avgWaste > 20 ? "text-rose-600" : "text-slate-700",
                },
                {
                  label: "Review",
                  value: stats.flagged,
                  suffix: "",
                  color: stats.flagged > 0 ? "text-rose-600" : "text-slate-700",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-slate-50 rounded-xl px-3 py-2 text-center border border-slate-100"
                >
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                    {s.label}
                  </p>
                  <p className={`text-sm font-black ${s.color}`}>
                    {s.value}
                    <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                      {s.suffix}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop tab bar */}
            <div className="hidden sm:flex gap-1 pb-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all relative border-b-2 ${
                    tab === t.key
                      ? "text-slate-900 border-slate-900 bg-slate-50"
                      : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {t.badge > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 pb-24 sm:pb-6">
          {tab === "issue" && (
            <IssuePanel
              products={products}
              employees={employees}
              allUsers={allUsers}
              onIssued={handleIssued}
              issuedJobIds={issuedJobIds}
            />
          )}
          {tab === "issues" && (
            <IssuesPanel
              issues={issues}
              onViewIssue={(i, m) => {
                setModalIssue(i);
                setModalMode(m);
              }}
              onRefresh={fetchIssues}
              loading={issLoading}
            />
          )}
          {tab === "report" && <ReportPanel />}
        </main>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-30 shadow-[0_-1px_20px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-3 max-w-md mx-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1 py-3 px-2 relative transition-all ${tab === t.key ? "text-slate-900" : "text-slate-400"}`}
              >
                {tab === t.key && (
                  <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-900 rounded-full" />
                )}
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="text-[10px] font-bold">{t.label}</span>
                {t.badge > 0 && (
                  <span className="absolute top-2 right-3 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 bg-slate-200 text-slate-600">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <IssueDetailModal
          issue={modalIssue}
          mode={modalMode}
          onClose={() => setModalIssue(null)}
          onReviewSaved={handleReviewSaved}
        />
      </div>
    </>
  );
}