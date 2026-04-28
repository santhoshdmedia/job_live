import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

// ─── Constants ───────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api";

const WASTAGE_REASONS = [
  { value: "margin_trim", label: "Margin trim (top/bottom)" },
  { value: "misprint", label: "Misprint" },
  { value: "roll_end", label: "End of roll" },
  { value: "color_calibration", label: "Color calibration" },
  { value: "customer_change", label: "Customer spec change" },
  { value: "equipment_fault", label: "Equipment fault" },
  { value: "other", label: "Other" },
];

// ─── API helper ───────────────────────────────────────────────────────────────
const api = async (url, opts = {}) => {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
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

// ─── PDF Slip Generator ────────────────────────────────────────────────────
const generateSlipPDF = (issue, user) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Material Issue Slip - ${issue?.issue_no || "SLIP"}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; background: #fff; color: #111; font-size: 12px; }
  .slip { width: 80mm; margin: 0 auto; padding: 8mm; border: 1px dashed #999; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .brand { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
  .sub { font-size: 10px; color: #555; margin-top: 2px; }
  .slip-no { font-size: 13px; font-weight: 700; margin-top: 6px; letter-spacing: 1px; }
  .meta { font-size: 10px; color: #666; }
  .section { margin: 10px 0; }
  .section-title { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; margin: 4px 0; }
  .label { color: #555; font-size: 11px; }
  .value { font-weight: 700; font-size: 11px; text-align: right; max-width: 55%; word-break: break-word; }
  .highlight { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin: 8px 0; text-align: center; }
  .big { font-size: 22px; font-weight: 900; }
  .unit { font-size: 11px; color: #555; }
  .footer { text-align: center; border-top: 1px dashed #999; padding-top: 8px; margin-top: 10px; font-size: 9px; color: #888; }
  .sig-box { border: 1px solid #ddd; height: 30px; margin-top: 8px; border-radius: 3px; position: relative; }
  .sig-label { font-size: 9px; color: #999; text-align: center; margin-top: 2px; }
  .barcode { text-align: center; font-size: 22px; letter-spacing: 4px; margin: 8px 0; color: #222; font-family: monospace; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <div class="brand">DMEDIA</div>
    <div class="sub">Material Issuance System</div>
    <div class="slip-no">${issue?.issue_no || "MIS-XXXXXX"}</div>
    <div class="meta">${dateStr} &nbsp;|&nbsp; ${timeStr}</div>
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

  ${issue?.calculation ? `
  <div class="section">
    <div class="section-title">Calculation</div>
    <div class="row"><span class="label">Job Area</span><span class="value">${issue.calculation.job_sqft} sqft</span></div>
    <div class="row"><span class="label">Gross Area</span><span class="value">${issue.calculation.gross_sqft} sqft</span></div>
    <div class="row"><span class="label">Recommended</span><span class="value">${issue.calculation.required_sqft} sqft</span></div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Personnel</div>
    <div class="row"><span class="label">Issued By</span><span class="label">Issued To</span></div>
    <div class="row"><span class="value">${issue?.issued_by?.name || user?.name || "Store Manager"}</span><span class="value">${issue?.issued_to?.name || "—"}</span></div>
  </div>

  ${issue?.issue_notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <div style="font-size:11px;color:#444;margin-top:4px;">${issue.issue_notes}</div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Employee Signature</div>
    <div class="sig-box"></div>
    <div class="sig-label">Received by / Date</div>
  </div>


  <div class="footer">
    <div>This slip is system generated</div>
    <div style="margin-top:2px;">Keep this slip until material return</div>
    <div style="margin-top:4px;font-weight:700;">DMEDIA &copy; ${now.getFullYear()}</div>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
    };
  }
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show, dismiss: () => setToast(null) };
};

const Toast = ({ message, type = "info", onDismiss }) => {
  const colors = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  const bar = {
    info: "bg-blue-500", success: "bg-emerald-500", error: "bg-red-500", warning: "bg-amber-500",
  };
  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 p-3 rounded-xl border shadow-lg ${colors[type]}`}>
      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${bar[type]}`} />
      <span className="text-sm flex-1">{message}</span>
      <button onClick={onDismiss} className="text-lg leading-none opacity-60 hover:opacity-100 px-1">×</button>
    </div>
  );
};

// ─── Shared components ────────────────────────────────────────────────────────
const Badge = ({ children, color = "blue" }) => {
  const c = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
  }[color] || "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{children}</span>;
};

const PerfBadge = ({ rating }) => {
  const map = { good: ["green", "Good"], acceptable: ["amber", "Acceptable"], high_wastage: ["red", "High wastage"] };
  const [color, label] = map[rating] || ["gray", "—"];
  return <Badge color={color}>{label}</Badge>;
};

const StatusBadge = ({ status }) => {
  const map = { issued: ["blue", "Issued"], returned: ["green", "Returned"], partial_return: ["amber", "Partial"], no_return: ["red", "No return"] };
  const [color, label] = map[status] || ["gray", status];
  return <Badge color={color}>{label}</Badge>;
};

const Avatar = ({ name = "?" }) => {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
};

const WastageBar = ({ pct = 0 }) => {
  const color = pct <= 10 ? "bg-emerald-500" : pct <= 20 ? "bg-amber-500" : "bg-red-500";
  const text = pct <= 10 ? "text-emerald-600" : pct <= 20 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-semibold min-w-[36px] ${text}`}>{pct.toFixed(1)}%</span>
    </div>
  );
};

const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 62" />
  </svg>
);

const Btn = ({ children, onClick, disabled, loading, variant = "primary", size = "md", className = "", type = "button" }) => {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };
  const variants = {
    primary: "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
    danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
    ghost: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    success: "bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700",
  };
  return (
    <button type={type} onClick={!disabled && !loading ? onClick : undefined} disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading ? <Spinner size={14} /> : null}{children}
    </button>
  );
};

const Input = ({ className = "", ...props }) => (
  <input className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-gray-400 ${className}`} {...props} />
);

const NumberInput = ({ value, onChange, suffix, min = 0, step = 0.1 }) => (
  <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
    <input type="number" value={value} min={min} step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none min-w-0" />
    {suffix && <span className="px-3 py-2.5 text-xs text-gray-400 border-l border-gray-200 bg-gray-50 whitespace-nowrap">{suffix}</span>}
  </div>
);

const SelectInput = ({ value, onChange, options = [], placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all appearance-none">
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Field = ({ label, children, required }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>{children}</div>
);

const SectionLabel = ({ children, color = "blue" }) => {
  const colors = { blue: "bg-blue-600", green: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500" };
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-1 h-4 rounded-full ${colors[color]}`} />
      <span className="text-sm font-semibold text-gray-700">{children}</span>
    </div>
  );
};

const CalcPreview = ({ calc, issuedQty }) => {
  if (!calc) return null;
  const diff = issuedQty ? issuedQty - calc.required_sqft : 0;
  const overFlag = diff > 0.01;
  const underFlag = diff < -0.01;
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-2">
      <div className="text-xs font-semibold text-blue-600 mb-2">System calculation</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
        {[["Job area", `${calc.job_sqft} sqft`], ["Gross area", `${calc.gross_sqft} sqft`], ["Margin area", `${calc.margin_sqft} sqft`]].map(([k, v]) => (
          <><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800">{v}</span></>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-blue-100">
        <span className="text-xs font-semibold text-blue-600">Recommended</span>
        <span className="text-sm font-bold text-gray-800">{calc.required_sqft} sqft</span>
      </div>
      {(overFlag || underFlag) && (
        <div className={`mt-1.5 text-xs font-medium ${overFlag ? "text-amber-600" : "text-emerald-600"}`}>
          {overFlag ? `+${diff.toFixed(2)} sqft above recommendation` : `${Math.abs(diff).toFixed(2)} sqft below recommendation`}
        </div>
      )}
    </div>
  );
};

const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg lg:max-w-7xl rounded-t-3xl sm:rounded-2xl border border-gray-100 shadow-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, suffix, danger }) => (
  <div className={`rounded-2xl p-3 ${danger ? "bg-red-50 border border-red-100" : "bg-gray-50 border border-gray-100"}`}>
    <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${danger ? "text-red-500" : "text-gray-400"}`}>{label}</div>
    <div className={`text-xl font-bold ${danger ? "text-red-700" : "text-gray-800"}`}>
      {value}{suffix && <span className="text-sm font-medium text-gray-400 ml-1">{suffix}</span>}
    </div>
  </div>
);

// ─── Job Lookup ────────────────────────────────────────────────────────────────
const JobLookup = ({ onJobSelected }) => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const { toast, show: toastShow, dismiss } = useToast();

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return toastShow("Enter a job number or customer name", "warning");
    setSearching(true); setResults(null); setSelected(null);
    try {
      const res = await api(`/jobs?job_no=${encodeURIComponent(q)}&limit=10`);
      let jobs = res.data?.jobs || res.data || [];
      if (!Array.isArray(jobs)) jobs = [];
      if (jobs.length === 0) {
        const res2 = await api(`/jobs?customer_name=${encodeURIComponent(q)}&limit=10`);
        jobs = res2.data?.jobs || res2.data || [];
        if (!Array.isArray(jobs)) jobs = [];
      }
      setResults(jobs);
      if (jobs.length === 0) toastShow(`No jobs found for "${q}"`, "warning");
    } catch (err) { toastShow(err.message, "error"); setResults([]); }
    finally { setSearching(false); }
  };

  const selectJob = (job) => { setSelected(job); onJobSelected(job); setResults(null); };
  const clearJob = () => { setSelected(null); setQuery(""); setResults(null); onJobSelected(null); };

  const statusColor = (s) => ({ accepted: "text-blue-600", in_progress: "text-amber-600", completed: "text-emerald-600", on_hold: "text-amber-600", rejected: "text-red-600" }[s] || "text-gray-500");

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      {!selected && (
        <div className="flex gap-2 mb-2">
          <Input value={query} onChange={e => { setQuery(e.target.value); if (results) setResults(null); }}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Job number or customer name…" className="flex-1" />
          <Btn variant="ghost" onClick={doSearch} loading={searching}>Look up</Btn>
        </div>
      )}
      {results && results.length > 0 && !selected && (
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
          {results.map((job, idx) => (
            <div key={job._id} onClick={() => selectJob(job)}
              className={`flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${idx < results.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-blue-600 font-mono">JOB</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{job.job_no}</div>
                  <div className="text-xs text-gray-500">{job.customer_name} · {job.cart_items?.length || 0} item(s)</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold ${statusColor(job.job_status)}`}>{job.job_status?.replace(/_/g, " ")}</div>
                <div className="text-xs text-gray-400">{job.current_stage?.stage || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex gap-2.5 items-center">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white font-mono">JOB</span>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">{selected.job_no}</div>
                <div className="text-xs text-gray-500">{selected.customer_name}</div>
              </div>
            </div>
            <button onClick={clearJob} className="text-xs text-blue-600 font-semibold hover:underline">Change</button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[["Status", selected.job_status?.replace(/_/g, " ")], ["Stage", selected.current_stage?.stage || "—"], ["Items", selected.cart_items?.length || 0]].map(([k, v]) => (
              <div key={k} className="bg-white rounded-lg p-2">
                <div className="text-gray-400 mb-0.5">{k}</div>
                <div className="font-semibold text-gray-700 truncate">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Issue Panel ────────────────────────────────────────────────────────────
const IssuePanel = ({ products, employees, onIssued, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calc, setCalc] = useState(null);
  const [job, setJob] = useState(null);
  const [cartItemIdx, setCartItemIdx] = useState(0);
  const [productId, setProductId] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [marginTop, setMarginTop] = useState(4);
  const [marginBot, setMarginBot] = useState(3);
  const [buffer, setBuffer] = useState(20);
  const [issuedQty, setIssuedQty] = useState("");
  const [empId, setEmpId] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const { toast, show: toastShow, dismiss } = useToast();
  const calcTimer = useRef(null);
    const { user }   = useSelector((state) => state.authSlice);


  // const user = currentUser || { _id: user?._id, name: user?.name, role: user?.role };

  const handleCartItemChange = (idxStr) => {
    const idx = parseInt(idxStr, 10);
    setCartItemIdx(idx);
    const item = job?.cart_items?.[idx];
    if (item?.size) {
      const match = item.size.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (match) { setWidth(parseFloat(match[1])); setHeight(parseFloat(match[2])); }
    }
  };

  const handleJobSelected = (selectedJob) => {
    setJob(selectedJob); setCartItemIdx(0); setWidth(""); setHeight(""); setCalc(null); setIssuedQty("");
    if (selectedJob?.cart_items?.[0]?.size) {
      const match = selectedJob.cart_items[0].size.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (match) { setWidth(parseFloat(match[1])); setHeight(parseFloat(match[2])); }
    }
  };

  const triggerCalc = useCallback(() => {
    clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(async () => {
      const w = parseFloat(width), h = parseFloat(height);
      if (!w || !h || w <= 0 || h <= 0) return;
      setCalcLoading(true);
      try {
        const res = await api("/material/calculate", {
          method: "POST",
          body: JSON.stringify({ width_ft: w, height_ft: h, margin_top_in: marginTop, margin_bottom_in: marginBot, wastage_buffer_pct: buffer }),
        });
        setCalc(res.data);
        if (!issuedQty) setIssuedQty(res.data.required_sqft);
      } catch { /* silent */ }
      finally { setCalcLoading(false); }
    }, 600);
  }, [width, height, marginTop, marginBot, buffer, issuedQty]);

  useEffect(() => { triggerCalc(); }, [width, height, marginTop, marginBot, buffer]);

  const selectedProduct = products.find(p => p._id === productId);
  const selectedEmp = employees.find(e => e._id === empId);
  const cartItem = job?.cart_items?.[cartItemIdx];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!job) return toastShow("Look up and select a job first", "error");
    if (!productId) return toastShow("Select a material product", "error");
    if (!issuedQty || issuedQty <= 0) return toastShow("Issued qty must be > 0", "error");
    if (!empId) return toastShow("Select an employee", "error");
    if (!width || !height) return toastShow("Dimensions are required", "error");
    if (selectedProduct && selectedProduct.stock_count < parseFloat(issuedQty))
      return toastShow(`Insufficient stock. Available: ${selectedProduct.stock_count} sqft`, "error");

    setLoading(true);
    try {
      const payload = {
        cart_item_index: cartItemIdx,
        material: { product_id: productId, product_name: selectedProduct?.name, unit: "sqft" },
        issued_qty: parseFloat(issuedQty),
        dimensions: { width: parseFloat(width), height: parseFloat(height), unit: "ft" },
        margin_top_in: parseFloat(marginTop),
        margin_bottom_in: parseFloat(marginBot),
        wastage_buffer_pct: parseFloat(buffer),
        issued_to: { user_id: empId, name: selectedEmp?.name || "", role: selectedEmp?.role || "" },
        issued_by: { user_id: user._id, name: user.name || "Store Manager", role: user.role || "store manager" },
        issue_notes: issueNotes,
      };
      const res = await api(`/jobs/${job._id}/material/issue`, { method: "POST", body: JSON.stringify(payload) });
      toastShow(res.message || "Material issued successfully", "success");
      const newIssue = { ...res.data, calculation: calc };
      onIssued(newIssue, productId, parseFloat(issuedQty));
      // Auto-download slip
      setTimeout(() => generateSlipPDF(newIssue, user), 400);
      setProductId(""); setIssuedQty(""); setEmpId(""); setIssueNotes(""); setCalc(null);
    } catch (err) { toastShow(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <Card>
        <SectionLabel color="blue">Job lookup</SectionLabel>
        <JobLookup onJobSelected={handleJobSelected} />
        {job && job.cart_items?.length > 1 && (
          <div className="mt-3">
            <Field label="Cart item">
              <SelectInput value={String(cartItemIdx)} onChange={handleCartItemChange}
                options={job.cart_items.map((item, idx) => ({
                  value: String(idx),
                  label: `#${idx + 1} · ${item.product_name || "Item"}${item.size ? ` · ${item.size}` : ""}`,
                }))} />
            </Field>
          </div>
        )}
        {job && cartItem && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            {[["Product", cartItem.product_name], ["Size", cartItem.size], ["Type", cartItem.printing_type], ["Qty", cartItem.quantity]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><span className="text-gray-400">{k}: </span><span className="font-semibold text-gray-700">{v}</span></div>
            ))}
          </div>
        )}
      </Card>

      {job && (
        <>
          <Card>
            <SectionLabel color="blue">Material</SectionLabel>
            <Field label="Product" required>
              <SelectInput value={productId} onChange={setProductId} placeholder="Select material…"
                options={products.map(p => ({ value: p._id, label: `${p.name} (${p.stock_count || 0} sqft)` }))} />
              {selectedProduct && (
                <p className={`text-xs mt-1 font-medium ${selectedProduct.stock_count > 50 ? "text-emerald-600" : selectedProduct.stock_count > 10 ? "text-amber-600" : "text-red-600"}`}>
                  {selectedProduct.stock_count} sqft available
                </p>
              )}
            </Field>
            <Field label="Issue notes">
              <Input value={issueNotes} onChange={e => setIssueNotes(e.target.value)} placeholder="e.g. Day 1 of 3-day job" />
            </Field>
          </Card>

          <Card>
            <SectionLabel color="green">Dimensions & margins</SectionLabel>
            {cartItem?.size && (
              <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                ✓ Dimensions auto-filled from "{cartItem.size}"
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Width" required><NumberInput value={width} onChange={setWidth} min={0.1} step={0.1} suffix="ft" /></Field>
              <Field label="Height" required><NumberInput value={height} onChange={setHeight} min={0.1} step={0.1} suffix="ft" /></Field>
              <Field label="Buffer"><NumberInput value={buffer} onChange={setBuffer} min={0} max={50} step={1} suffix="%" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Top margin"><NumberInput value={marginTop} onChange={setMarginTop} min={0} step={0.5} suffix="in" /></Field>
              <Field label="Bottom margin"><NumberInput value={marginBot} onChange={setMarginBot} min={0} step={0.5} suffix="in" /></Field>
            </div>
            {calcLoading && <p className="text-xs text-gray-400 py-1">Calculating…</p>}
            <CalcPreview calc={calc} issuedQty={parseFloat(issuedQty)} />
            <div className="mt-3">
              <Field label="Actual qty to issue" required>
                <NumberInput value={issuedQty} onChange={setIssuedQty} min={0.01} step={0.1} suffix="sqft" />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionLabel color="red">Personnel</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Issue to" required>
                <SelectInput value={empId} onChange={setEmpId} placeholder="Employee…"
                  options={employees.map(e => ({ value: e._id, label: e.name }))} />
              </Field>
              <Field label="Issued by">
                <Input value={user?.name || "—"} disabled className="bg-gray-50 opacity-70" />
              </Field>
            </div>
            {selectedEmp && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mt-1">
                <Avatar name={selectedEmp.name} />
                <div>
                  <div className="text-sm font-semibold text-gray-800">{selectedEmp.name}</div>
                  <div className="text-xs text-gray-500">{selectedEmp.role}</div>
                </div>
              </div>
            )}
          </Card>

          <div className="pb-6">
            <Btn type="submit" onClick={handleSubmit} loading={loading} variant="primary" size="lg" className="w-full">
              📋 Issue material & print slip
            </Btn>
          </div>
        </>
      )}

      {!job && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div className="text-4xl mb-3">🔍</div>
          Look up a job above to continue
        </div>
      )}
    </div>
  );
};

// ─── Return Panel ─────────────────────────────────────────────────────────────
const ReturnPanel = ({ issues, employees, onReturned, currentUser }) => {
  const { toast, show: toastShow, dismiss } = useToast();
  const user = currentUser || { _id: "user1", name: "Store Manager" };
  const [selectedId, setSelectedId] = useState("");
  const [retQty, setRetQty] = useState("");
  const [reason, setReason] = useState("margin_trim");
  const [notes, setNotes] = useState("");
  const [retById, setRetById] = useState("");
  const [loading, setLoading] = useState(false);

  const openIssues = issues.filter(i => i.status === "issued");
  const selectedIssue = issues.find(i => i._id === selectedId);

  const derived = useMemo(() => {
    if (!selectedIssue || retQty === "" || isNaN(parseFloat(retQty))) return null;
    const issued = selectedIssue.issued_qty || 0;
    const jobSqft = selectedIssue.calculation?.job_sqft || 0;
    const returned = Math.max(0, Math.min(issued, parseFloat(retQty)));
    const used = issued - returned;
    const wastage = Math.max(0, used - jobSqft);
    const ratio = issued > 0 ? (wastage / issued) * 100 : 0;
    return { used: parseFloat(used.toFixed(4)), wastage: parseFloat(wastage.toFixed(4)), ratio: parseFloat(ratio.toFixed(2)), perf: ratio <= 10 ? "good" : ratio <= 20 ? "acceptable" : "high_wastage" };
  }, [selectedIssue, retQty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) return toastShow("Select an issue", "error");
    if (retQty === "") return toastShow("Enter returned qty", "error");
    const qty = parseFloat(retQty);
    if (isNaN(qty) || qty < 0) return toastShow("Returned qty must be ≥ 0", "error");
    if (selectedIssue && qty > selectedIssue.issued_qty)
      return toastShow(`Cannot return more than issued (${selectedIssue.issued_qty} sqft)`, "error");
    setLoading(true);
    const retBy = employees.find(e => e._id === retById);
    try {
      const payload = {
        returned_qty: qty, wastage_reason: reason, wastage_reason_notes: notes,
        returned_by: { user_id: retById || user._id, name: retBy?.name || user.name || "Employee", role: retBy?.role || "printing team" },
      };
      const res = await api(`/material/${selectedId}/return`, { method: "POST", body: JSON.stringify(payload) });
      toastShow(res.message || "Return recorded", "success");
      onReturned(selectedId, res.data);
      setSelectedId(""); setRetQty(""); setNotes(""); setRetById("");
    } catch (err) { toastShow(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <Card>
        <SectionLabel color="green">Select open issue</SectionLabel>
        <Field label="Issue" required>
          <SelectInput value={selectedId} onChange={v => { setSelectedId(v); setRetQty(""); }}
            placeholder="Choose an open issue…"
            options={openIssues.map(i => ({ value: i._id, label: `${i.issue_no} · ${i.job_no} · ${i.issued_qty} sqft` }))} />
        </Field>
        {selectedIssue && (
          <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3 text-xs">
            {[["Job", selectedIssue.job_no], ["Product", selectedIssue.material?.product_name], ["Issued", `${selectedIssue.issued_qty} sqft`], ["Employee", selectedIssue.issued_to?.name]].map(([k, v]) => (
              <div key={k}><span className="text-gray-400">{k}: </span><span className="font-semibold text-gray-700">{v}</span></div>
            ))}
          </div>
        )}
      </Card>

      {selectedIssue && (
        <>
          <Card>
            <SectionLabel color="red">Return details</SectionLabel>
            <Field label="Returned qty" required>
              <NumberInput value={retQty} onChange={setRetQty} min={0} step={0.1} suffix="sqft" />
              <p className="text-xs text-gray-400 mt-1">Issued: {selectedIssue.issued_qty} sqft. Enter 0 if nothing returned.</p>
            </Field>
            {derived && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                <div className="text-xs font-semibold text-amber-600 mb-2">Wastage preview</div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-gray-500">Actual used</span><span className="font-semibold">{derived.used} sqft</span>
                  <span className="text-gray-500">Wastage</span><span className="font-semibold">{derived.wastage} sqft</span>
                  <span className="text-gray-500">Wastage ratio</span><span className="font-semibold">{derived.ratio}%</span>
                  <span className="text-gray-500">Performance</span><PerfBadge rating={derived.perf} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Wastage reason"><SelectInput value={reason} onChange={setReason} options={WASTAGE_REASONS} /></Field>
              <Field label="Returned by">
                <SelectInput value={retById} onChange={setRetById} placeholder="Employee (opt.)" options={employees.map(e => ({ value: e._id, label: e.name }))} />
              </Field>
            </div>
            <Field label="Notes"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes…" /></Field>
          </Card>
          <div className="pb-6">
            <Btn onClick={handleSubmit} variant="success" size="lg" loading={loading} className="w-full">Record return</Btn>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Issues Panel ─────────────────────────────────────────────────────────────
const IssuesPanel = ({ issues, onViewIssue, onRefresh, loading }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const filtered = useMemo(() => {
    if (statusFilter === "flagged") return issues.filter(i => i.return?.is_flagged && !i.return?.manager_reviewed);
    if (statusFilter) return issues.filter(i => i.status === statusFilter);
    return issues;
  }, [issues, statusFilter]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <div className="flex-1">
          <SelectInput value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
            placeholder="All statuses"
            options={[{ value: "issued", label: "Issued" }, { value: "returned", label: "Returned" }, { value: "no_return", label: "No return" }, { value: "flagged", label: "Flagged" }]} />
        </div>
        <Btn variant="ghost" onClick={onRefresh} size="sm" loading={loading}>↻</Btn>
        <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} rec.</span>
      </div>

      <div className="space-y-2">
        {paginated.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <div className="text-4xl mb-2">📭</div>No records found
          </div>
        ) : paginated.map(issue => (
          <Card key={issue._id} className="cursor-pointer hover:border-blue-200 active:bg-gray-50 transition-all"
            onClick={() => onViewIssue(issue, "view")}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-blue-600 font-mono">{issue.issue_no}</span>
                {issue.return?.is_flagged && !issue.return?.manager_reviewed && (
                  <Badge color="red" className="ml-2">flagged</Badge>
                )}
                <div className="text-sm font-semibold text-gray-800 mt-0.5">{issue.job_no}</div>
              </div>
              <StatusBadge status={issue.status} />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={issue.issued_to?.name || "?"} />
              <div>
                <div className="text-xs font-semibold text-gray-700">{issue.issued_to?.name}</div>
                <div className="text-xs text-gray-400">{issue.issued_to?.role}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs font-semibold text-gray-700">{issue.material?.product_name}</div>
                <div className="text-xs text-gray-400">{issue.issued_qty} sqft</div>
              </div>
            </div>
            {issue.return ? (
              <WastageBar pct={issue.return.wastage_ratio_pct || 0} />
            ) : (
              <div className="text-xs text-gray-400">Pending return</div>
            )}
            <div className="flex gap-2 mt-2">
              <Btn size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onViewIssue(issue, "view"); }}>View</Btn>
              {issue.return?.is_flagged && !issue.return?.manager_reviewed && (
                <Btn size="sm" variant="danger" onClick={e => { e.stopPropagation(); onViewIssue(issue, "review"); }}>Review</Btn>
              )}
              <Btn size="sm" variant="ghost" onClick={e => { e.stopPropagation(); generateSlipPDF(issue, null); }} className="ml-auto">📄 Slip</Btn>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-4 pb-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 text-xs rounded-lg font-semibold transition-all ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {p}
            </button>
          ))}
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
  const { toast, show: toastShow, dismiss } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      const res = await api(`/material/report/wastage${params.toString() ? "?" + params.toString() : ""}`);
      setReport(res.data);
    } catch (e) { toastShow(e.message, "error"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const o = report?.overall;

  return (
    <div className="space-y-3">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <Card>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Field label="From"><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></Field>
        </div>
        <Btn variant="primary" onClick={fetchReport} loading={loading} size="sm" className="w-full">Apply filter</Btn>
      </Card>

      {o && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total issued" value={parseFloat((o.total_issued_qty || 0).toFixed(1))} suffix="sqft" />
            <StatCard label="Avg wastage" value={(o.avg_wastage_ratio || 0).toFixed(1)} suffix="%" />
            <StatCard label="Total wastage" value={parseFloat((o.total_actual_wastage || 0).toFixed(1))} suffix="sqft" />
            <StatCard label="Needs review" value={o.flagged_count || 0} danger={o.flagged_count > 0} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Good", o.good_count, "green"], ["Acceptable", o.acceptable_count, "amber"], ["High", o.high_wastage_count, "red"]].map(([l, count, color]) => (
              <Card key={l} className="text-center">
                <div className="text-xs text-gray-400 mb-1">{l}</div>
                <div className="text-2xl font-bold text-gray-800">{count || 0}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      {report?.by_employee?.length > 0 && (
        <Card>
          <SectionLabel color="blue">Employee performance</SectionLabel>
          {report.by_employee.map(emp => (
            <div key={emp._id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <Avatar name={emp.employee_name || "?"} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{emp.employee_name}</div>
                <div className="text-xs text-gray-400">{emp.total_issues} issues</div>
              </div>
              <div className="w-20"><WastageBar pct={emp.avg_wastage_ratio || 0} /></div>
              <PerfBadge rating={emp.overall_rating || "acceptable"} />
            </div>
          ))}
        </Card>
      )}

      {report?.by_wastage_reason?.length > 0 && (
        <Card className="pb-6">
          <SectionLabel color="red">Wastage reasons</SectionLabel>
          {report.by_wastage_reason.map(r => {
            const label = WASTAGE_REASONS.find(w => w.value === r._id)?.label || r._id || "Unknown";
            const max = Math.max(...report.by_wastage_reason.map(x => x.count));
            return (
              <div key={r._id} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{label}</span>
                  <span className="text-gray-400">{r.count}×</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

// ─── Issue Detail Modal ───────────────────────────────────────────────────────
const IssueDetailModal = ({ issue, mode, onClose, onReviewSaved, currentUser }) => {
  const { toast, show: toastShow, dismiss } = useToast();
  const { user }   = useSelector((state) => state.authSlice);
  const [override, setOverride] = useState("");
  const [manNotes, setManNotes] = useState("");
  const [loading, setLoading] = useState(false);
  if (!issue) return null;

  const handleReview = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { manager_by: { user_id: user?._id || "unknown", name: user?.name || "Store Manager" }, manager_notes: manNotes, override_rating: override || null };
      const method = issue.return?.manager_reviewed ? "PUT" : "POST";
      const res = await api(`/material/${issue._id}/review`, { method, body: JSON.stringify(payload) });
      toastShow(res.message || "Review saved", "success");
      onReviewSaved(issue._id, { manager_notes: manNotes, override_rating: override });
      onClose();
    } catch (err) { toastShow(err.message, "error"); }
    finally { setLoading(false); }
  };

  const r = issue.return;

  return (
    <Modal open title={`${issue.issue_no} · ${issue.job_no}`} onClose={onClose}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Issue summary</div>
        <div className="space-y-2">
          {[["Employee", issue.issued_to?.name], ["Material", issue.material?.product_name], ["Issued qty", `${issue.issued_qty} sqft`], ["Dimensions", `${issue.dimensions?.width}ft × ${issue.dimensions?.height}ft`]].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">{k}</span>
              <span className="text-sm font-semibold text-gray-800">{v}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-1.5">
            <span className="text-xs text-gray-500">Status</span>
            <StatusBadge status={issue.status} />
          </div>
        </div>
      </div>

      <div className="mb-3">
        <Btn variant="ghost" size="sm" className="w-full" onClick={() => generateSlipPDF(issue, user)}>
          📄 Download / Print slip
        </Btn>
      </div>

      {r && (
        <>
          <div className="border-t border-gray-100 pt-4 mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Return details</div>
            <div className="space-y-2">
              {[["Returned", `${r.returned_qty} sqft`], ["Used", `${r.actual_used_qty} sqft`], ["Wastage", `${r.actual_wastage_qty} sqft`], ["Ratio", `${r.wastage_ratio_pct}%`], ["Reason", WASTAGE_REASONS.find(x => x.value === r.wastage_reason)?.label || r.wastage_reason]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{k}</span>
                  <span className="text-sm font-semibold text-gray-800">{v}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-gray-500">Performance</span>
                <PerfBadge rating={r.performance_rating} />
              </div>
            </div>
            {r.is_flagged && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${r.manager_reviewed ? "bg-gray-50 text-gray-600" : "bg-red-50 text-red-700"}`}>
                {r.manager_reviewed ? "✓ Reviewed by manager" : "⚑ Flagged · pending review"}
              </div>
            )}
          </div>

          {mode === "review" && (
            <div className="border-t border-gray-100 pt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Manager review</div>
              <Field label="Override rating">
                <SelectInput value={override} onChange={setOverride} placeholder="Keep auto-rating"
                  options={[{ value: "good", label: "Good" }, { value: "acceptable", label: "Acceptable" }, { value: "high_wastage", label: "High wastage" }]} />
              </Field>
              <Field label="Notes">
                <textarea value={manNotes} onChange={e => setManNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none"
                  placeholder="Explain the override rationale…" />
              </Field>
              <Btn onClick={handleReview} variant="primary" loading={loading} className="w-full">Save review</Btn>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────
export default function MaterialIssueManager() {
  // Replace this with useSelector from Redux in your app:
    const { user }   = useSelector((state) => state.authSlice);
  const currentUser = { _id: user?._id, name: user?.name, role: user?.role };

  const [tab, setTab] = useState("issue");
  const [issues, setIssues] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [issLoading, setIssLoading] = useState(false);
  const [modalIssue, setModalIssue] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const { toast, show: toastShow, dismiss } = useToast();

  const fetchProducts = useCallback(async () => {
    try { const res = await api("/product/get_product"); setProducts(res.data || []); } catch { }
  }, []);
  const fetchEmployees = useCallback(async () => {
    try { const res = await api("/admin/get_admin"); setEmployees(res.data || []); } catch { }
  }, []);
  const fetchIssues = useCallback(async () => {
    setIssLoading(true);
    try { const res = await api("/material?limit=100"); setIssues(res.data?.issues || []); }
    catch (e) { toastShow(e.message, "error"); }
    finally { setIssLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); fetchEmployees(); fetchIssues(); }, []);
const handleIssued = async (newIssue, productId, qty) => {
  setIssues(prev => [newIssue, ...prev]);
  setProducts(prev => prev.map(p => p._id === productId ? { ...p, stock_count: Math.max(0, (p.stock_count || 0) - qty) } : p));

  // Update job status to "production" when material is issued
  try {
    await api(`/jobs/${newIssue.job_id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ job_status: "production" }),
    });
  } catch (err) {
    toastShow(`Material issued, but failed to update job status: ${err.message}`, "warning");
  }

  setTab("issues");
};
  const handleReturned = (issueId, data) => {
    setIssues(prev => prev.map(i => i._id === issueId ? { ...i, status: data.status || "returned", return: data } : i));
  };
  const handleReviewSaved = (issueId, data) => {
    setIssues(prev => prev.map(i =>
      i._id === issueId && i.return
        ? { ...i, return: { ...i.return, manager_reviewed: true, manager_notes: data.manager_notes, performance_rating: data.override_rating || i.return.performance_rating } }
        : i
    ));
  };

  const stats = useMemo(() => ({
    pending: issues.filter(i => i.status === "issued").length,
    flagged: issues.filter(i => i.return?.is_flagged && !i.return?.manager_reviewed).length,
    totalIssued: parseFloat(issues.reduce((s, i) => s + (i.issued_qty || 0), 0).toFixed(1)),
    avgWaste: (() => {
      const returned = issues.filter(i => i.return);
      return returned.length ? parseFloat((returned.reduce((s, i) => s + (i.return.wastage_ratio_pct || 0), 0) / returned.length).toFixed(1)) : 0;
    })(),
  }), [issues]);

  const TABS = [
    { key: "issue", label: "Issue", icon: "📋" },
    { key: "issues", label: "Records", icon: "📦", count: issues.length },
    { key: "returns", label: "Return", icon: "↩", count: stats.pending },
    { key: "report", label: "Report", icon: "📊" },
  ];

  return (
    <div className="min- bg-gray-50 flex flex-col max-w-lg lg:max-w-7xl mx-auto relative">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Material Issuance</h1>
            <p className="text-xs text-gray-400 mt-0.5">Flex roll & print tracker</p>
          </div>
          {stats.flagged > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-600">{stats.flagged} review</span>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[["Issued", `${stats.totalIssued}`, "sqft"], ["Pending", `${stats.pending}`, ""], ["Waste", `${stats.avgWaste}%`, ""], ["Review", `${stats.flagged}`, ""]].map(([l, v, s]) => (
            <div key={l} className="bg-gray-50 rounded-xl p-2 text-center">
              <div className="text-xs text-gray-400 truncate">{l}</div>
              <div className="text-base font-bold text-gray-800">{v}<span className="text-xs font-normal text-gray-400">{s}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-3 pt-3 pb-24 overflow-y-auto">
        {tab === "issue" && <IssuePanel products={products} employees={employees} onIssued={handleIssued} currentUser={currentUser} />}
        {tab === "issues" && <IssuesPanel issues={issues} onViewIssue={(i, m) => { setModalIssue(i); setModalMode(m); }} onRefresh={fetchIssues} loading={issLoading} />}
        {tab === "returns" && <ReturnPanel issues={issues} employees={employees} onReturned={handleReturned} currentUser={currentUser} />}
        {tab === "report" && <ReportPanel />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg lg:max-w-7xl mx-auto bg-white border-t border-gray-100 px-2 pb-safe z-30">
        <div className="grid grid-cols-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 py-3 px-1 relative transition-all ${tab === t.key ? "text-blue-600" : "text-gray-400"}`}>
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] font-semibold">{t.label}</span>
              {t.count > 0 && (
                <span className={`absolute top-2 right-3 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${tab === t.key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {t.count > 9 ? "9+" : t.count}
                </span>
              )}
              {tab === t.key && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      <IssueDetailModal issue={modalIssue} mode={modalMode} onClose={() => setModalIssue(null)} onReviewSaved={handleReviewSaved} currentUser={currentUser} />
    </div>
  );
}