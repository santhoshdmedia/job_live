import { useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { uploadImage } from "../api/index"; // adjust path as needed

// ─── API ──────────────────────────────────────────────────────────────────────
const API_BASE = "https://job-server-cocj.onrender.com/api";

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

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = "info") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4500);
  }, []);
  return { toast, show, dismiss: () => setToast(null) };
};

const Toast = ({ message: msg, type = "info", onDismiss }) => {
  const styles = {
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  const bars = {
    info: "bg-blue-500", success: "bg-emerald-500",
    error: "bg-red-500", warning: "bg-amber-500",
  };
  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 p-3 rounded-xl border shadow-lg ${styles[type]}`}>
      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${bars[type]}`} />
      <span className="text-sm flex-1">{msg}</span>
      <button onClick={onDismiss} className="text-lg leading-none opacity-60 hover:opacity-100 px-1">×</button>
    </div>
  );
};

// ─── Primitives ───────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin flex-shrink-0">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 62" />
  </svg>
);

const Btn = ({ children, onClick, disabled, loading, variant = "primary", size = "md", className = "", type = "button" }) => {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost:   "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    danger:  "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
    amber:   "bg-amber-500 text-white hover:bg-amber-600",
    teal:    "bg-teal-600 text-white hover:bg-teal-700",
  };
  return (
    <button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>
    {children}
  </div>
);

const SectionLabel = ({ children, color = "blue" }) => {
  const bars = {
    blue: "bg-blue-600", green: "bg-emerald-500", amber: "bg-amber-500",
    teal: "bg-teal-600", red: "bg-red-500", purple: "bg-purple-500",
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-1 h-4 rounded-full flex-shrink-0 ${bars[color]}`} />
      <span className="text-sm font-semibold text-gray-700">{children}</span>
    </div>
  );
};

const Field = ({ label, children, required }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Inp = ({ className = "", ...props }) => (
  <input
    className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all placeholder:text-gray-400 ${className}`}
    {...props}
  />
);

const Sel = ({ children, className = "", ...props }) => (
  <select
    className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all ${className}`}
    {...props}
  >
    {children}
  </select>
);

// ─── Status dot ───────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    draft:       ["bg-gray-300",    "Draft"],
    accepted:    ["bg-sky-400",     "Accepted"],
    in_progress: ["bg-amber-400",   "In Progress"],
    production:  ["bg-purple-400",  "Production"],
    on_hold:     ["bg-orange-400",  "On Hold"],
    completed:   ["bg-emerald-400", "Completed"],
    delivery:    ["bg-teal-400",    "Delivery"],
    rejected:    ["bg-red-400",     "Rejected"],
  };
  const [color, label] = map[status] || ["bg-gray-300", status || "—"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
};

// ─── Delivery method config ───────────────────────────────────────────────────
const DELIVERY_METHODS = [
  {
    key: "delivery",
    label: "Delivery",
    icon: "🚚",
    desc: "Door-to-door delivery",
    color: "border-teal-300 bg-teal-50",
    active: "border-teal-500 bg-teal-50 ring-2 ring-teal-200",
    text: "text-teal-700",
  },
  {
    key: "pickup",
    label: "Pickup",
    icon: "🏪",
    desc: "Customer collects from shop",
    color: "border-blue-200 bg-blue-50",
    active: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
    text: "text-blue-700",
  },
  {
    key: "parcel",
    label: "Parcel",
    icon: "📦",
    desc: "Courier / parcel service",
    color: "border-amber-200 bg-amber-50",
    active: "border-amber-500 bg-amber-50 ring-2 ring-amber-200",
    text: "text-amber-700",
  },
  {
    key: "erection",
    label: "Erection",
    icon: "🔧",
    desc: "On-site installation",
    color: "border-purple-200 bg-purple-50",
    active: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
    text: "text-purple-700",
  },
];

// ─── Camera icon ──────────────────────────────────────────────────────────────
const CameraIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// ─── Camera upload ────────────────────────────────────────────────────────────
const CameraUpload = ({ onUploaded, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert(`"${file.name}" is not a supported image type.`);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await uploadImage(fd);
      const url = result?.data?.data?.url || "";
      if (!url) throw new Error("No URL returned");
      onUploaded(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }} onChange={handleFile} />
      <button
        type="button"
        disabled={loading || disabled}
        onClick={() => !loading && !disabled && inputRef.current?.click()}
        className="w-24 h-24 bg-white border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-teal-400 hover:bg-teal-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Spinner size={22} /><span className="text-[10px] text-gray-400">Uploading…</span></>
        ) : (
          <><CameraIcon /><span className="text-[10px] text-gray-500 font-medium">Take photo</span></>
        )}
      </button>
    </>
  );
};

// ─── Image thumbnail ──────────────────────────────────────────────────────────
const ImageThumb = ({ url, index, onRemove }) => (
  <div className="relative group flex-shrink-0">
    <img src={url} alt={`Delivery photo ${index + 1}`}
      className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
      #{index + 1}
    </span>
    <button type="button" onClick={() => onRemove(index)}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity leading-none">
      ×
    </button>
  </div>
);

// ─── Job Detail Modal ─────────────────────────────────────────────────────────
const JobModal = ({ job, onClose }) => {
  if (!job) return null;

  const totalPaid   = parseFloat(job.payment_amount || 0);
  const totalAmount = job.total_amount || 0;
  const balance     = Math.max(0, totalAmount - totalPaid);
  const isPaid      = balance <= 0;

  const stageColorMap = {
    accepted:    "bg-sky-100 text-sky-700",
    in_progress: "bg-amber-100 text-amber-700",
    production:  "bg-purple-100 text-purple-700",
    on_hold:     "bg-orange-100 text-orange-700",
    completed:   "bg-emerald-100 text-emerald-700",
    delivery:    "bg-teal-100 text-teal-700",
    rejected:    "bg-red-100 text-red-700",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-gray-100 shadow-2xl max-h-[90vh] overflow-auto">
        {/* Handle + header */}
        <div className="sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-0" />
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="font-bold text-gray-900 text-base">{job.job_no}</span>
              <span className="ml-2 text-xs text-gray-400">{job.customer_name}</span>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg leading-none">×</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Payment summary */}
          <div className={`rounded-2xl p-4 border ${isPaid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-3 ${isPaid ? 'text-emerald-600' : 'text-red-600'}">
              {isPaid ? "✅ Fully paid" : "⚠️ Balance due"}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total</div>
                <div className="text-base font-bold text-gray-800">₹{totalAmount.toLocaleString("en-IN")}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Paid</div>
                <div className="text-base font-bold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</div>
              </div>
              <div className={`rounded-xl p-3 border ${isPaid ? "bg-white border-gray-100" : "bg-red-100 border-red-200"}`}>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Balance</div>
                <div className={`text-base font-bold ${isPaid ? "text-gray-400" : "text-red-600"}`}>
                  ₹{balance.toLocaleString("en-IN")}
                </div>
              </div>
            </div>
            {job.payment_mode && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                Mode: <span className="font-semibold text-gray-700 capitalize">{job.payment_mode}</span>
              </div>
            )}
          </div>

          {/* Job info */}
          <div className="space-y-2 text-sm">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Job details</div>
            {[
              ["Status",   <StatusDot status={job.job_status} />],
              ["Stage",    job.current_stage?.stage || "—"],
              ["Phone",    job.customer_phone || "—"],
              ["Order no", job.order_no || "—"],
              ["Order date", job.order_date ? new Date(job.order_date).toLocaleDateString("en-IN") : "—"],
              ["Est. delivery", job.estimated_delivery_date ? new Date(job.estimated_delivery_date).toLocaleDateString("en-IN") : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-500">{k}</span>
                <span className="text-xs font-semibold text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          {/* Delivery address */}
          {job.delivery_address?.street && (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery address</div>
              <div className="text-sm text-gray-700 leading-relaxed">
                {[job.delivery_address.street, job.delivery_address.city,
                  job.delivery_address.state, job.delivery_address.pincode]
                  .filter(Boolean).join(", ")}
              </div>
            </div>
          )}

          {/* Cart items */}
          {job.cart_items?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Cart items ({job.cart_items.length})
              </div>
              <div className="space-y-2">
                {job.cart_items.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{item.product_name || `Item ${idx + 1}`}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {[item.printing_type, item.variation, item.size].filter(Boolean).join(" · ")}
                      </div>
                      {item.notes && <div className="text-xs text-gray-400 mt-1 italic">{item.notes}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-gray-800">₹{(item.price || 0).toLocaleString("en-IN")}</div>
                      <div className="text-xs text-gray-400">qty {item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow stages */}
          {job.workflow_stages?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Workflow history</div>
              <div className="space-y-2">
                {job.workflow_stages.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${stageColorMap[s.action] || "bg-gray-100 text-gray-600"}`}>
                      {s.stage_label || s.stage}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-600">{s.handled_by?.name || "—"}</div>
                      <div className="text-[10px] text-gray-400">{s.total_duration_display || "—"} · {s.worked_days || 0} day(s)</div>
                    </div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${stageColorMap[s.action] || "bg-gray-100 text-gray-600"}`}>
                      {s.action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="text-xs font-semibold text-amber-600 mb-1">Notes</div>
              <div className="text-xs text-gray-600">{job.notes}</div>
            </div>
          )}

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
};

// ─── Payment gate banner ──────────────────────────────────────────────────────
const PaymentGate = ({ job, onCollect }) => {
  const totalPaid   = parseFloat(job.payment_amount || 0);
  const totalAmount = job.total_amount || 0;
  const balance     = Math.max(0, totalAmount - totalPaid);
  const isPaid      = balance <= 0;

  if (isPaid) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">✅</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-emerald-700">Fully paid</div>
          <div className="text-xs text-emerald-600 mt-0.5">
            ₹{totalPaid.toLocaleString("en-IN")} received · proceed to deliver
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-red-700">Balance due — delivery on hold</div>
          <div className="text-xs text-red-500 mt-0.5">Collect payment before dispatching.</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="bg-white rounded-lg p-2 border border-gray-100">
          <div className="text-[10px] text-gray-400 mb-0.5">Total</div>
          <div className="text-sm font-bold text-gray-800">₹{totalAmount.toLocaleString("en-IN")}</div>
        </div>
        <div className="bg-white rounded-lg p-2 border border-gray-100">
          <div className="text-[10px] text-gray-400 mb-0.5">Paid</div>
          <div className="text-sm font-bold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</div>
        </div>
        <div className="bg-red-100 rounded-lg p-2 border border-red-200">
          <div className="text-[10px] text-red-400 mb-0.5">Balance</div>
          <div className="text-sm font-bold text-red-700">₹{balance.toLocaleString("en-IN")}</div>
        </div>
      </div>
      <Btn variant="amber" size="sm" className="w-full" onClick={onCollect}>
        Collect ₹{balance.toLocaleString("en-IN")} now
      </Btn>
    </div>
  );
};

// ─── Collect payment modal ────────────────────────────────────────────────────
const CollectPaymentModal = ({ job, onClose, onCollected }) => {
  const [amount,  setAmount]  = useState("");
  const [mode,    setMode]    = useState("cash");
  const [saving,  setSaving]  = useState(false);
  const { toast, show, dismiss } = useToast();

  const totalPaid = parseFloat(job.payment_amount || 0);
  const balance   = Math.max(0, (job.total_amount || 0) - totalPaid);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return show("Enter a valid amount", "warning");
    if (amt > balance)    return show(`Amount exceeds balance of ₹${balance.toLocaleString("en-IN")}`, "warning");
    setSaving(true);
    try {
      const newPaid = totalPaid + amt;
      await api(`/jobs/${job._id}`, {
        method: "PUT",
        body: JSON.stringify({ payment_amount: String(newPaid), payment_mode: mode }),
      });
      onCollected(newPaid, mode);
      onClose();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-gray-100 shadow-2xl">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-0 sm:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-bold text-gray-800">Collect payment</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
            <div className="text-xs text-amber-600 font-semibold">Balance due</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">₹{balance.toLocaleString("en-IN")}</div>
          </div>
          <Field label="Amount collecting" required>
            <Inp type="number" placeholder={`Max ₹${balance}`} value={amount}
              onChange={(e) => setAmount(e.target.value)} min={1} max={balance} step={1} />
          </Field>
          <Field label="Payment mode" required>
            <Sel value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </Sel>
          </Field>
          <div className="grid grid-cols-2 gap-2 pt-1 pb-4">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="success" loading={saving} onClick={handleSave}>Save payment</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Job lookup ───────────────────────────────────────────────────────────────
const JobLookup = ({ onJobSelected }) => {
  const [query,     setQuery]     = useState("");
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const { toast, show, dismiss }  = useToast();

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return show("Enter a job number or customer name", "warning");
    setSearching(true);
    setResults(null);
    setSelected(null);
    try {
      let res  = await api(`/jobs?job_no=${encodeURIComponent(q)}&limit=10`);
      let jobs = res.data?.jobs || res.data || [];
      if (!Array.isArray(jobs)) jobs = [];
      if (jobs.length === 0) {
        res  = await api(`/jobs?customer_name=${encodeURIComponent(q)}&limit=10`);
        jobs = res.data?.jobs || res.data || [];
        if (!Array.isArray(jobs)) jobs = [];
      }
      // Only show delivery-stage jobs by default — but show all for flexibility
      setResults(jobs);
      if (jobs.length === 0) show(`No jobs found for "${q}"`, "warning");
    } catch (err) {
      show(err.message, "error");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickJob = async (job) => {
    setSearching(true);
    try {
      const full    = await api(`/jobs/${job._id}`);
      const fullJob = full.data || job;
      setSelected(fullJob);
      onJobSelected(fullJob);
    } catch {
      setSelected(job);
      onJobSelected(job);
    } finally {
      setSearching(false);
      setResults(null);
    }
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults(null);
    onJobSelected(null);
  };

  // Allow parent to update the selected job (e.g. after payment collected)
  const updateSelected = (updatedJob) => {
    setSelected(updatedJob);
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {!selected && (
        <div className="flex gap-2 mb-2">
          <Inp value={query} onChange={(e) => { setQuery(e.target.value); if (results) setResults(null); }}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Job number or customer name…" className="flex-1" />
          <Btn variant="ghost" onClick={doSearch} loading={searching}>Look up</Btn>
        </div>
      )}

      {results && results.length > 0 && !selected && (
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
          {results.map((job, idx) => (
            <div key={job._id} onClick={() => pickJob(job)}
              className={`flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${idx < results.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div>
                <div className="text-sm font-semibold text-gray-800">{job.job_no}</div>
                <div className="text-xs text-gray-500">{job.customer_name}</div>
              </div>
              <StatusDot status={job.job_status} />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white font-mono">JOB</span>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">{selected.job_no}</div>
                <div className="text-xs text-gray-500">{selected.customer_name}</div>
              </div>
            </div>
            <button onClick={clear} className="text-xs text-teal-600 font-semibold hover:underline flex-shrink-0">
              Change
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              ["Status", <StatusDot status={selected.job_status} />],
              ["Stage",  selected.current_stage?.stage || "—"],
              ["Items",  selected.cart_items?.length ?? 0],
            ].map(([k, v]) => (
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

// ─── Main component ───────────────────────────────────────────────────────────
const DeliveryPanel = () => {
  const { user } = useSelector((state) => state.authSlice);
  const { toast, show: toastShow, dismiss } = useToast();

  const [job,              setJob]              = useState(null);
  const [deliveryMethod,   setDeliveryMethod]   = useState("");
  const [deliveryPhotos,   setDeliveryPhotos]   = useState([]); // string[] URLs
  const [receiverName,     setReceiverName]     = useState("");
  const [trackingNo,       setTrackingNo]       = useState("");
  const [erectionAddress,  setErectionAddress]  = useState("");
  const [notes,            setNotes]            = useState("");
  const [submitting,       setSubmitting]       = useState(false);
  const [success,          setSuccess]          = useState(false);

  // Modal states
  const [showJobModal,     setShowJobModal]     = useState(false);
  const [showPayModal,     setShowPayModal]     = useState(false);

  // Payment state (kept in sync with job after collect)
  const [paidAmount,       setPaidAmount]       = useState(0);

  const handleJobSelected = (selectedJob) => {
    setJob(selectedJob);
    setPaidAmount(parseFloat(selectedJob?.payment_amount || 0));
    setDeliveryMethod("");
    setDeliveryPhotos([]);
    setReceiverName("");
    setTrackingNo("");
    setErectionAddress("");
    setNotes("");
    setSuccess(false);
  };

  const handlePhotoUploaded = useCallback((url) => {
    if (url && typeof url === "string") {
      setDeliveryPhotos((prev) => (prev.includes(url) ? prev : [...prev, url]));
    }
  }, []);

  const removePhoto = (idx) => {
    setDeliveryPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaymentCollected = (newPaid, mode) => {
    setPaidAmount(newPaid);
    setJob((prev) => prev ? { ...prev, payment_amount: String(newPaid), payment_mode: mode } : prev);
    toastShow(`₹${newPaid.toLocaleString("en-IN")} recorded`, "success");
  };

  const totalAmount = job?.total_amount || 0;
  const balance     = Math.max(0, totalAmount - paidAmount);
  const isPaid      = balance <= 0;

  // Require full payment for delivery & erection; pickup & parcel can proceed with balance
  const paymentBlocked =
    !isPaid && (deliveryMethod === "delivery" || deliveryMethod === "erection");

  const canSubmit =
    !!deliveryMethod &&
    !paymentBlocked &&
    deliveryPhotos.length > 0 &&
    notes.trim().length > 0;

  const resetForm = () => {
    setJob(null);
    setDeliveryMethod("");
    setDeliveryPhotos([]);
    setReceiverName("");
    setTrackingNo("");
    setErectionAddress("");
    setNotes("");
    setSuccess(false);
    setPaidAmount(0);
  };

  const handleSubmit = async () => {
    if (!job)             return toastShow("Select a job first", "error");
    if (!deliveryMethod)  return toastShow("Select a delivery method", "error");
    if (paymentBlocked)   return toastShow("Collect full payment before dispatching", "error");
    if (!deliveryPhotos.length) return toastShow("Capture at least one delivery photo", "error");
    if (!notes.trim())    return toastShow("Add delivery notes before submitting", "error");

    setSubmitting(true);
    try {
      const handledBy = {
        user_id: user?._id || "",
        name:    user?.name || "Delivery Team",
        role:    user?.role || "delivery",
      };

      // 1. Complete the delivery stage session
      await api(`/jobs/${job._id}/complete-stage`, {
        method: "POST",
        body: JSON.stringify({
          stage:       job.current_stage?.stage || "delivery",
          handled_by:  handledBy,
          notes,
          next_stage:  null, // delivery is the final stage
          delivery_method:  deliveryMethod,
          receiver_name:    receiverName || null,
          tracking_no:      trackingNo   || null,
          erection_address: erectionAddress || null,
          delivery_photos:  deliveryPhotos,
        }),
      });

      // 2. Mark job as completed
      await api(`/jobs/${job._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ job_status: "completed" }),
      });

      setSuccess(true);
      toastShow("Delivery completed! Job marked as done.", "success");
      setTimeout(resetForm, 3500);
    } catch (err) {
      toastShow(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min- bg-gray-50 flex flex-col max-w-lg mx-auto relative">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🚚</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Delivery</h1>
            <p className="text-xs text-gray-400 mt-0.5">Dispatch, pickup, parcel & erection</p>
          </div>
          {job && (
            <button
              onClick={() => setShowJobModal(true)}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 hover:bg-teal-100 transition-colors"
            >
              <span>📋</span> Job details
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-3 pt-3 pb-28 space-y-3 overflow-y-auto">

        {/* Success banner */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm font-bold text-emerald-700">Delivery completed!</div>
            <div className="text-xs text-emerald-600 mt-1">Job has been marked as completed.</div>
          </div>
        )}

        {/* Step 1 — Job lookup */}
        <Card>
          <SectionLabel color="teal">Step 1 · Select job</SectionLabel>
          <JobLookup onJobSelected={handleJobSelected} />
        </Card>

        {/* Step 2 — Payment gate */}
        {job && (
          <Card>
            <SectionLabel color={isPaid ? "green" : "red"}>Step 2 · Payment status</SectionLabel>
            <PaymentGate
              job={{ ...job, payment_amount: String(paidAmount) }}
              onCollect={() => setShowPayModal(true)}
            />
            {!isPaid && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <span className="font-semibold">Note:</span> Pickup and parcel can proceed with balance. Delivery and erection require full payment.
              </div>
            )}
          </Card>
        )}

        {/* Step 3 — Delivery method */}
        {job && (
          <Card>
            <SectionLabel color="teal">Step 3 · Delivery method</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {DELIVERY_METHODS.map((m) => {
                const isActive  = deliveryMethod === m.key;
                const isBlocked = !isPaid && (m.key === "delivery" || m.key === "erection");
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => !isBlocked && setDeliveryMethod(m.key)}
                    className={`relative text-left border rounded-xl p-3 transition-all ${
                      isActive
                        ? m.active
                        : isBlocked
                        ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                        : `${m.color} hover:opacity-80 active:scale-98`
                    }`}
                  >
                    {isBlocked && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                        Pay first
                      </span>
                    )}
                    <div className="text-xl mb-1">{m.icon}</div>
                    <div className={`text-sm font-bold ${isActive ? m.text : "text-gray-800"}`}>{m.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{m.desc}</div>
                    {isActive && (
                      <div className={`absolute top-2 right-2 w-4 h-4 rounded-full ${m.text.replace("text-", "bg-")} flex items-center justify-center`}>
                        <span className="text-white text-[10px]">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Method-specific fields */}
            {deliveryMethod === "delivery" && (
              <div className="mt-3 space-y-0">
                <Field label="Receiver name">
                  <Inp value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Who received the order?" />
                </Field>
              </div>
            )}
            {deliveryMethod === "parcel" && (
              <div className="mt-3">
                <Field label="Tracking / AWB number">
                  <Inp value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} placeholder="e.g. DELHIVERY1234567" />
                </Field>
              </div>
            )}
            {deliveryMethod === "erection" && (
              <div className="mt-3">
                <Field label="Erection / site address" required>
                  <Inp value={erectionAddress} onChange={(e) => setErectionAddress(e.target.value)} placeholder="Site address for installation" />
                </Field>
              </div>
            )}
          </Card>
        )}

        {/* Step 4 — Delivery photos */}
        {job && deliveryMethod && (
          <Card>
            <SectionLabel color="teal">Step 4 · Delivery photos</SectionLabel>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              {deliveryMethod === "delivery"  && "Photograph the delivered item at the customer's location."}
              {deliveryMethod === "pickup"    && "Photograph the customer collecting the order."}
              {deliveryMethod === "parcel"    && "Photograph the packed parcel and the courier receipt."}
              {deliveryMethod === "erection"  && "Photograph the completed installation on site."}
            </p>

            {deliveryPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {deliveryPhotos.map((url, idx) => (
                  <ImageThumb key={`${url}-${idx}`} url={url} index={idx} onRemove={removePhoto} />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <CameraUpload onUploaded={handlePhotoUploaded} />
              <div className="text-xs text-gray-400 leading-relaxed">
                {deliveryPhotos.length === 0 ? (
                  <>Tap to open camera<br /><span className="text-gray-300">PNG · JPG · WebP</span></>
                ) : (
                  <>
                    <span className="font-semibold text-teal-600">
                      {deliveryPhotos.length} photo{deliveryPhotos.length > 1 ? "s" : ""} captured
                    </span>
                    <br />Tap again to add more
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 5 — Notes */}
        {job && deliveryMethod && (
          <Card>
            <SectionLabel color="teal">Step 5 · Delivery notes</SectionLabel>
            <Field label="Notes" required>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={
                  deliveryMethod === "delivery"  ? "e.g. Delivered to reception. Signed by Raj at 3:30 PM." :
                  deliveryMethod === "pickup"    ? "e.g. Collected by customer at 2 PM. All items verified." :
                  deliveryMethod === "parcel"    ? "e.g. Handed to Delhivery. Tracking XXXX. 3 rolls packed." :
                  deliveryMethod === "erection"  ? "e.g. Banner installed at south wall. All bolts secured." :
                  "Delivery notes…"
                }
                className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all resize-none placeholder:text-gray-400"
              />
            </Field>

            {/* Pre-submit summary */}
            {canSubmit && (
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 mt-1">
                <div className="text-xs font-semibold text-teal-600 mb-2">Ready to complete</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <span className="text-gray-500">Job</span>
                  <span className="font-semibold text-gray-700">{job.job_no}</span>
                  <span className="text-gray-500">Customer</span>
                  <span className="font-semibold text-gray-700">{job.customer_name}</span>
                  <span className="text-gray-500">Method</span>
                  <span className="font-semibold text-gray-700 capitalize">{deliveryMethod}</span>
                  <span className="text-gray-500">Photos</span>
                  <span className="font-semibold text-gray-700">{deliveryPhotos.length} captured</span>
                  <span className="text-gray-500">Payment</span>
                  <span className={`font-semibold ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                    {isPaid ? "Fully paid ✓" : `₹${balance.toLocaleString("en-IN")} due`}
                  </span>
                </div>
              </div>
            )}

            {/* Payment blocked warning */}
            {paymentBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-2 text-xs text-red-700 font-medium">
                ⛔ Collect ₹{balance.toLocaleString("en-IN")} before completing {deliveryMethod}.
              </div>
            )}
          </Card>
        )}

        {/* Submit */}
        {job && deliveryMethod && (
          <div className="pb-6">
            <Btn
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              variant="teal"
              size="lg"
              className="w-full"
            >
              ✅ Complete delivery
            </Btn>
            {!canSubmit && (
              <p className="text-xs text-center text-gray-400 mt-2">
                {paymentBlocked
                  ? `Collect ₹${balance.toLocaleString("en-IN")} to proceed`
                  : deliveryPhotos.length === 0
                  ? "Capture at least one photo to continue"
                  : "Add delivery notes to continue"}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!job && !success && (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-5xl mb-3">🚚</div>
            <div className="font-medium">Look up a job above</div>
            <div className="text-xs mt-1 text-gray-300">select delivery method and complete dispatch</div>
          </div>
        )}
      </div>

      {/* Job detail modal */}
      {showJobModal && job && (
        <JobModal job={{ ...job, payment_amount: String(paidAmount) }} onClose={() => setShowJobModal(false)} />
      )}

      {/* Collect payment modal */}
      {showPayModal && job && (
        <CollectPaymentModal
          job={{ ...job, payment_amount: String(paidAmount) }}
          onClose={() => setShowPayModal(false)}
          onCollected={handlePaymentCollected}
        />
      )}
    </div>
  );
};

export default DeliveryPanel;