import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import { uploadImage } from "../api/index";

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
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismiss = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );
  return { toasts, show, dismiss };
};

const ToastContainer = ({ toasts, dismiss }) => (
  <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
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
          className="bg-slate-900 text-white rounded-xl overflow-hidden shadow-2xl flex items-stretch animate-slide-up"
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
              className="opacity-40 hover:opacity-100 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className="animate-spin flex-shrink-0"
  >
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

// ─── Button ───────────────────────────────────────────────────────────────────
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
  const base = `inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed select-none ${fullWidth ? "w-full" : ""}`;
  const sizes = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-3.5 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 shadow-sm",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200",
    ghost: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
    purple:
      "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200",
    drive: "bg-[#1a73e8] text-white hover:bg-[#1557b0] shadow-sm",
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

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "", onClick, hoverable }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${
      hoverable
        ? "cursor-pointer hover:border-violet-200 hover:shadow-md transition-all duration-150"
        : ""
    } ${className}`}
  >
    {children}
  </div>
);

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, badge }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-base flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-4xl mb-3 opacity-30">{icon}</div>
    <p className="text-sm font-semibold text-slate-400">{title}</p>
    {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
  </div>
);

// ─── StatusDot ────────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    draft: ["bg-slate-300", "Draft"],
    accepted: ["bg-sky-400", "Accepted"],
    in_progress: ["bg-amber-400", "In Progress"],
    production: ["bg-violet-500", "Production"],
    on_hold: ["bg-orange-400", "On Hold"],
    completed: ["bg-emerald-400", "Completed"],
    delivery: ["bg-blue-400", "Delivery"],
    rejected: ["bg-rose-400", "Rejected"],
  };
  const [color, label] = map[status] || ["bg-slate-300", status || "—"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const CameraIcon = ({ size = 26 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Inline Google Drive logo — no external dependency
const DriveIcon = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 87.3 78"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28.35 52H0c0 1.55.4 3.1 1.2 4.5z"
      fill="#0066da"
    />
    <path
      d="M43.65 25L29.05 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5A9.06 9.06 0 0 0 0 52h28.35z"
      fill="#00ac47"
    />
    <path
      d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L85.1 56.5c.8-1.4 1.2-2.95 1.2-4.5H57.95l6.2 11.55z"
      fill="#ea4335"
    />
    <path d="M43.65 25L58.25 0H29.05z" fill="#00832d" />
    <path d="M57.95 52H87.3L73.55 27.3 58.95 2.6l-15.3 22.4z" fill="#2684fc" />
    <path d="M28.35 52l15.3-27H57.95L43.65 25z" fill="#ffba00" />
  </svg>
);

// ─── CameraUpload ─────────────────────────────────────────────────────────────
const CameraUpload = ({ onUploaded, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert(`"${file.name}" is not a supported image type (PNG, JPG, WebP).`);
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await uploadImage(formData);
      const url = result?.data?.data?.url || "";
      if (!url) throw new Error("No URL returned from upload");
      onUploaded(url);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={loading || disabled}
        onClick={() => !loading && !disabled && inputRef.current?.click()}
        className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-violet-500 flex-shrink-0"
      >
        {loading ? (
          <>
            <Spinner size={22} />
            <span className="text-[10px] font-medium">Uploading…</span>
          </>
        ) : (
          <>
            <CameraIcon size={24} />
            <span className="text-[10px] font-semibold">Take photo</span>
          </>
        )}
      </button>
    </>
  );
};

// ─── ImageThumb ───────────────────────────────────────────────────────────────
const ImageThumb = ({ url, index, onRemove }) => (
  <div className="relative group flex-shrink-0">
    <img
      src={url}
      alt={`Production photo ${index + 1}`}
      className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
    />
    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
      #{index + 1}
    </span>
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity leading-none"
    >
      ×
    </button>
  </div>
);

// ─── DriveFileBanner ──────────────────────────────────────────────────────────
// Shown when a job has a design_drive_link — prominent Drive button + 48-hr warning
const DriveFileBanner = ({ driveLink }) => {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(driveLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-amber-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
        <DriveIcon size={13} />
        <span className="text-xs font-bold text-amber-800 flex-1">
          Original File — Google Drive
        </span>
        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 flex-shrink-0">
          ⏱ 48 hr cleanup
        </span>
      </div>

      {/* Body */}
      <div className="bg-white px-3 py-3 space-y-2.5">
        {/* Warning */}
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          <span className="text-rose-500 text-sm flex-shrink-0 mt-px">⚠</span>
          <p className="text-[11px] leading-relaxed text-rose-700">
            <span className="font-bold">Auto-deleted after 48 hours.</span>{" "}
            Download or move to permanent storage before it is removed.
          </p>
        </div>

        {/* Link preview */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <DriveIcon size={12} />
          <span className="text-[11px] text-slate-500 font-mono truncate flex-1">
            {driveLink.length > 52 ? driveLink.slice(0, 52) + "…" : driveLink}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => window.open(driveLink, "_blank")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.97] text-white text-xs font-bold py-2 rounded-lg transition-all"
          >
            <DriveIcon size={12} />
            Open in Drive
          </button>
          <button
            onClick={copyLink}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] text-slate-700 text-xs font-bold py-2 rounded-lg transition-all border border-slate-200"
          >
            {copied ? "✓ Copied!" : "⎘ Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DesignFileCard ───────────────────────────────────────────────────────────
const DesignFileCard = ({
  designFile,
  designDriveLink,
  designStatus,
  jobNo,
}) => {
  const [lightbox, setLightbox] = useState(false);
  const fileName =
    designFile?.split("/").pop()?.split("?")[0] || `design_${jobNo}`;
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);

  const statusMap = {
    approved: {
      ring: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-700",
      badge: "✓ Approved",
    },
    uploaded: {
      ring: "border-sky-200 bg-sky-50",
      text: "text-sky-700",
      badge: "● Uploaded",
    },
    pending: {
      ring: "border-amber-200 bg-amber-50",
      text: "text-amber-700",
      badge: "◆ Pending",
    },
    rejected: {
      ring: "border-rose-200 bg-rose-50",
      text: "text-rose-700",
      badge: "✕ Rejected",
    },
  };
  const s = statusMap[designStatus] || statusMap.pending;

  const download = () => {
    const a = document.createElement("a");
    a.href = designFile;
    a.download = fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <div className={`border rounded-xl overflow-hidden ${s.ring}`}>
        {/* Status bar */}
        <div
          className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${s.ring}`}
        >
          <span className={`text-xs font-bold flex-shrink-0 ${s.text}`}>
            {s.badge}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {/* Drive pill — visible at a glance */}
            {designDriveLink && (
              <span className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#1a73e8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#c5d9f8] flex-shrink-0">
                <DriveIcon size={10} />
                Original on Drive
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {fileName}
            </span>
          </div>
        </div>

        {/* Image preview */}
        {isImage && (
          <div className="bg-slate-100 relative">
            <img
              src={designFile}
              alt="Design"
              className="w-full max-h-52 object-contain cursor-zoom-in"
              onClick={() => setLightbox(true)}
            />
            {/* Sample label */}
            <div className="absolute top-2 left-2 bg-violet-600/80 text-white text-[9px] font-black px-2 py-0.5 rounded-md tracking-wider uppercase backdrop-blur-sm">
              Sample · ≤1 MB
            </div>
          </div>
        )}

        {/* Non-image file */}
        {!isImage && (
          <div className="flex items-center gap-3 px-3 py-4 bg-white/60">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-2xl">{isPdf ? "📄" : "🎨"}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">
                {fileName}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {isPdf ? "PDF Document" : "Design File"} — tap Preview to open
              </div>
            </div>
          </div>
        )}

        {/* Sample file actions */}
        <div className="flex gap-2 px-3 py-2.5 bg-white/80 border-t border-white/60">
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => window.open(designFile, "_blank")}
            className="flex-1"
          >
            Preview Sample
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={download}
            className="flex-1"
          >
            Download Sample
          </Btn>
        </div>

        {/* ── Drive original section ── */}
        <div className="px-3 pb-3">
          {designDriveLink ? (
            <DriveFileBanner driveLink={designDriveLink} />
          ) : (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <DriveIcon size={12} />
              <span>No original Drive file attached to this job.</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={designFile}
            alt="Design full"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-700 shadow text-lg"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

// ─── JobSelector ─────────────────────────────────────────────────────────────
const JobSelector = ({ onJobSelected }) => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const { toasts, show, dismiss } = useToast();

  const fetchProductionJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/jobs?job_status=production&limit=100`);
      let list = res.data?.jobs || res.data || [];
      if (!Array.isArray(list)) list = [];
      const prodJobs = list.filter((j) => j.job_status === "production");
      setJobs(prodJobs);
      if (prodJobs.length === 0)
        show("No jobs currently in production", "warning");
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
    if (!filter.trim()) return jobs;
    const q = filter.toLowerCase();
    return jobs.filter(
      (j) =>
        j.job_no?.toLowerCase().includes(q) ||
        j.customer_name?.toLowerCase().includes(q),
    );
  }, [jobs, filter]);

  const pickJob = async (job) => {
    setLoading(true);
    try {
      // Always fetch full job so design_drive_link is present
      const full = await api(`/jobs/${job._id}`);
      const fullJob = full.data || job;
      setSelected(fullJob);
      onJobSelected(fullJob);
    } catch {
      setSelected(job);
      onJobSelected(job);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setSelected(null);
    onJobSelected(null);
    setFilter("");
  };

  return (
    <div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {!selected ? (
        <div className="space-y-3">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse flex-shrink-0" />
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">
                {loading
                  ? "Loading…"
                  : `${jobs.length} job${jobs.length !== 1 ? "s" : ""} in production`}
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

          {/* Filter */}
          {jobs.length > 3 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by job no or customer…"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all placeholder:text-slate-300"
            />
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Spinner size={16} />
              <span className="text-sm">Fetching production jobs…</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🏭"
              title="No production jobs"
              subtitle="Jobs appear here once they enter production stage"
            />
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {filtered.map((job) => (
                <div
                  key={job._id}
                  onClick={() => pickJob(job)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-violet-50 active:bg-violet-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-black text-white tracking-wider">
                      PROD
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-800">
                        {job.job_no}
                      </p>
                      {job.design_drive_link && (
                        <span className="inline-flex items-center gap-0.5 bg-[#e8f0fe] text-[#1a73e8] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[#c5d9f8] flex-shrink-0">
                          <DriveIcon size={9} />
                          Drive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {job.customer_name} · {job.cart_items?.length || 0}{" "}
                      item(s)
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400 mb-0.5">
                      {job.current_stage?.stage || "—"}
                    </p>
                    <StatusDot status={job.job_status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Selected job card */
        <div className="bg-slate-900 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-violet-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-black text-violet-200 tracking-wider">
                  PROD
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{selected.job_no}</p>
                  {selected.design_drive_link && (
                    <span className="inline-flex items-center gap-1 bg-[#1a73e8]/20 border border-[#1a73e8]/40 text-[#93bbf8] text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <DriveIcon size={9} />
                      Drive
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">
                  {selected.customer_name}
                </p>
              </div>
            </div>
            <button
              onClick={clear}
              className="text-xs text-violet-400 font-semibold hover:text-violet-300 flex-shrink-0"
            >
              Change
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Status", "Production"],
              ["Stage", selected.current_stage?.stage || "—"],
              ["Items", selected.cart_items?.length ?? 0],
            ].map(([k, v]) => (
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

// ─── Main Component ───────────────────────────────────────────────────────────
const ProductionUploadPanel = () => {
  const { user } = useSelector((state) => state.authSlice);
  const { toasts, show, dismiss } = useToast();

  const [job, setJob] = useState(null);
  const [productionImages, setProductionImages] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleImageUploaded = useCallback((url) => {
    if (url && typeof url === "string") {
      setProductionImages((prev) =>
        prev.includes(url) ? prev : [...prev, url],
      );
    }
  }, []);

  const removeImage = (idx) =>
    setProductionImages((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setJob(null);
    setProductionImages([]);
    setNotes("");
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!job) return show("Select a job first", "error");
    if (productionImages.length === 0)
      return show("Capture at least one production photo", "error");
    if (!notes.trim())
      return show("Add production notes before submitting", "error");

    setSubmitting(true);
    try {
      const handledBy = {
        user_id: user?._id || "",
        name: user?.name || "Production Team",
        role: user?.role || "printing team",
      };

      await api(`/jobs/${job._id}/approve_production`, {
        method: "POST",
        body: JSON.stringify({
          handled_by: handledBy,
          productionimg: productionImages[0],
        }),
      });

      console.log("Updating status...");
      await api(`/jobs/${job._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ job_status: "quality_check" }),
      });
      console.log("Status updated!");

      await api(`/jobs/${job._id}/complete-stage`, {
        method: "POST",
        body: JSON.stringify({
          stage: job.current_stage?.stage || "production",
          handled_by: handledBy,
          notes,
          next_stage: "quality_check",
        }),
      });

      setSuccess(true);
      show("Production submitted! Job moved to quality check.", "success");
      setTimeout(resetForm, 3500);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // All three steps must be done
  const canSubmit =
    !!job && productionImages.length > 0 && notes.trim().length > 0;

  const steps = [
    { n: 1, label: "Select Job", done: !!job },
    { n: 2, label: "Capture Photos", done: productionImages.length > 0 },
    { n: 3, label: "Add Notes", done: notes.trim().length > 0 },
  ];

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ToastContainer toasts={toasts} dismiss={dismiss} />

        {/* ── Header ── */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-200">
                  <span className="text-xl">🖨️</span>
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 tracking-tight">
                    Production Upload
                  </h1>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Capture and submit completed print output
                  </p>
                </div>
              </div>

              {/* Step progress — desktop */}
              <div className="hidden sm:flex items-center gap-1">
                {steps.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${s.done ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${s.done ? "bg-violet-600 text-white" : "bg-slate-300 text-slate-500"}`}
                      >
                        {s.done ? "✓" : s.n}
                      </span>
                      {s.label}
                    </div>
                    {i < steps.length - 1 && (
                      <span
                        className={`text-xs ${steps[i + 1].done || s.done ? "text-violet-300" : "text-slate-200"}`}
                      >
                        ›
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step progress — mobile */}
            <div className="sm:hidden flex items-center gap-2 pb-3">
              {steps.map((s, i) => (
                <div key={s.n} className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`flex-1 h-1.5 rounded-full transition-all ${s.done ? "bg-violet-500" : "bg-slate-200"}`}
                  />
                  {i < steps.length - 1 && (
                    <span
                      className={`text-[10px] font-bold ${s.done ? "text-violet-400" : "text-slate-300"}`}
                    >
                      {s.n}
                    </span>
                  )}
                </div>
              ))}
              <span className="text-xs text-slate-400 font-medium ml-1 flex-shrink-0">
                {steps.filter((s) => s.done).length}/{steps.length}
              </span>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 pb-24 sm:pb-8">
          {/* Success banner */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center mb-4">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-base font-black text-emerald-700">
                Production submitted!
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                Job has been moved to delivery stage.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ── Left column ── */}
            <div className="space-y-4">
              {/* Step 1 — Job selector */}
              <Card className="p-5">
                <SectionHeader
                  icon="🏭"
                  title="Production Jobs"
                  subtitle="All jobs currently in production"
                  badge={
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                      Auto-loaded
                    </span>
                  }
                />
                <JobSelector onJobSelected={setJob} />
              </Card>

              {/* Design file — shows sample + Drive link */}
              {job && (
                <Card className="p-5">
                  <SectionHeader
                    icon="🎨"
                    title="Design File"
                    subtitle="Reference design for this job"
                    badge={
                      job.design_drive_link && (
                        <span className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#1a73e8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#c5d9f8]">
                          <DriveIcon size={10} />
                          Original on Drive
                        </span>
                      )
                    }
                  />
                  {job.design_file ? (
                    <DesignFileCard
                      designFile={job.design_file}
                      designDriveLink={job.design_drive_link || null}
                      designStatus={job.design_status}
                      jobNo={job.job_no}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <span className="text-2xl flex-shrink-0">⚠️</span>
                        <div>
                          <p className="text-sm font-bold text-amber-700">
                            No design file attached
                          </p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            Ask admin to upload the approved design before
                            printing.
                          </p>
                        </div>
                      </div>
                      {/* Drive link even when no sample file exists */}
                      {job.design_drive_link && (
                        <DriveFileBanner driveLink={job.design_drive_link} />
                      )}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* ── Right column ── */}
            <div className="space-y-4">
              {job && (
                <Card className="p-5">
                  <SectionHeader
                    icon="📸"
                    title="Production Photos"
                    subtitle="Photograph the finished print output"
                    badge={
                      productionImages.length > 0 ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {productionImages.length} captured
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                          Required
                        </span>
                      )
                    }
                  />

                  {productionImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {productionImages.map((url, idx) => (
                        <ImageThumb
                          key={`${url}-${idx}`}
                          url={url}
                          index={idx}
                          onRemove={removeImage}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <CameraUpload onUploaded={handleImageUploaded} />
                    <div className="text-xs text-slate-400 leading-relaxed">
                      {productionImages.length === 0 ? (
                        <>
                          Tap to open camera
                          <br />
                          <span className="text-slate-300">
                            PNG · JPG · WebP supported
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-violet-600">
                            {productionImages.length} photo
                            {productionImages.length > 1 ? "s" : ""} captured
                          </span>
                          <br />
                          Tap again to add more
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-3 leading-relaxed">
                    💡 Capture the finished output clearly — these photos are
                    saved with the job record.
                  </p>
                </Card>
              )} 

              {/* Step 3 — Notes */}
              {job && (
                <Card className="p-5">
                  <SectionHeader
                    icon="📝"
                    title="Production Notes"
                    subtitle="Describe the completed output"
                    badge={
                      notes.trim().length > 0 ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          ✓ Added
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                          Required
                        </span>
                      )
                    }
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="e.g. Printed on 13oz flex, colour adjusted for brightness. Ready for lamination and dispatch."
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all resize-none placeholder:text-slate-300"
                  />

                  {/* Pre-submit checklist */}
                  <div
                    className={`rounded-xl p-4 mt-3 border ${canSubmit ? "bg-violet-50 border-violet-100" : "bg-slate-50 border-slate-100"}`}
                  >
                    <p
                      className={`text-xs font-bold mb-2.5 uppercase tracking-wide ${canSubmit ? "text-violet-600" : "text-slate-400"}`}
                    >
                      {canSubmit ? "✓ Ready to Submit" : "Checklist"}
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Job selected", done: !!job },
                        {
                          label: "Photo(s) captured",
                          done: productionImages.length > 0,
                        },
                        { label: "Notes added", done: notes.trim().length > 0 },
                      ].map(({ label, done }) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}
                          >
                            {done ? "✓" : "○"}
                          </span>
                          <span
                            className={
                              done
                                ? "text-slate-700 font-semibold"
                                : "text-slate-400"
                            }
                          >
                            {label}
                          </span>
                          {done && label === "Job selected" && (
                            <span className="text-slate-400 font-mono text-[10px] ml-auto">
                              {job.job_no}
                            </span>
                          )}
                          {done && label === "Photo(s) captured" && (
                            <span className="text-slate-400 text-[10px] ml-auto">
                              {productionImages.length} photo
                              {productionImages.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {canSubmit && (
                      <div className="mt-3 pt-3 border-t border-violet-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {[
                          ["Customer", job.customer_name],
                          ["Next Stage", "→ Delivery"],
                        ].map(([k, v]) => (
                          <>
                            <span key={`k-${k}`} className="text-slate-400">
                              {k}
                            </span>
                            <span
                              key={`v-${k}`}
                              className={`font-bold ${k === "Next Stage" ? "text-emerald-600" : "text-slate-700"}`}
                            >
                              {v}
                            </span>
                          </>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <Btn
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={!canSubmit}
                      variant="success"
                      size="lg"
                      fullWidth
                    >
                      🚚 Submit & Move to Delivery
                    </Btn>
                    {!canSubmit && (
                      <p className="text-xs text-center text-slate-400 mt-2">
                        {!job
                          ? "Select a job to continue"
                          : productionImages.length === 0
                            ? "Capture at least one photo to continue"
                            : "Add production notes to continue"}
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Empty state — no job selected */}
              {!job && !success && (
                <Card className="p-8">
                  <EmptyState
                    icon="🖨️"
                    title="Select a production job"
                    subtitle="Choose a job from the list on the left to capture output"
                  />
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default ProductionUploadPanel;
