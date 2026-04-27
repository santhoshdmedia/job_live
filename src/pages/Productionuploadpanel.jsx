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
    setTimeout(() => setToast(null), 4000);
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
    purple:  "bg-purple-600 text-white hover:bg-purple-700",
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
    blue: "bg-blue-600", green: "bg-emerald-500",
    amber: "bg-amber-500", purple: "bg-purple-500", red: "bg-red-500",
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

// ─── Status dot ───────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const map = {
    draft:       ["bg-gray-300",    "Draft"],
    accepted:    ["bg-sky-400",     "Accepted"],
    in_progress: ["bg-amber-400",   "In Progress"],
    production:  ["bg-purple-400",  "Production"],
    on_hold:     ["bg-orange-400",  "On Hold"],
    completed:   ["bg-emerald-400", "Completed"],
    delivery:    ["bg-blue-400",    "Delivery"],
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

// ─── Camera icon ──────────────────────────────────────────────────────────────
const CameraIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// ─── Camera upload button ─────────────────────────────────────────────────────
// Opens the device camera (capture="environment") and uploads to the server.
// Calls onUploaded(url: string) on success.
const CameraUpload = ({ onUploaded, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so the same file can be re-selected

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
        className="w-24 h-24 bg-white border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-purple-400 hover:bg-purple-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Spinner size={22} />
            <span className="text-[10px] text-gray-400">Uploading…</span>
          </>
        ) : (
          <>
            <CameraIcon />
            <span className="text-[10px] text-gray-500 font-medium">Take photo</span>
          </>
        )}
      </button>
    </>
  );
};

// ─── Image thumbnail ──────────────────────────────────────────────────────────
const ImageThumb = ({ url, index, onRemove }) => (
  <div className="relative group flex-shrink-0">
    <img
      src={url}
      alt={`Production photo ${index + 1}`}
      className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm"
    />
    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
      #{index + 1}
    </span>
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity leading-none"
    >
      ×
    </button>
  </div>
);

// ─── Design file card ─────────────────────────────────────────────────────────
const DesignFileCard = ({ designFile, designStatus, jobNo }) => {
  const [lightbox, setLightbox] = useState(false);

  const fileName = designFile?.split("/").pop()?.split("?")[0] || `design_${jobNo}`;
  const isImage  = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  const isPdf    = /\.pdf$/i.test(fileName);

  const statusMap = {
    approved: { ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", badge: "Approved" },
    uploaded: { ring: "border-blue-200 bg-blue-50",       text: "text-blue-700",    badge: "Uploaded" },
    pending:  { ring: "border-amber-200 bg-amber-50",     text: "text-amber-700",   badge: "Pending"  },
    rejected: { ring: "border-red-200 bg-red-50",         text: "text-red-700",     badge: "Rejected" },
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
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${s.ring}`}>
          <span className={`text-xs font-bold ${s.text}`}>{s.badge}</span>
          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">{fileName}</span>
        </div>

        {/* Inline image preview */}
        {isImage && (
          <div className="bg-gray-100">
            <img
              src={designFile}
              alt="Design"
              className="w-full max-h-52 object-contain cursor-zoom-in"
              onClick={() => setLightbox(true)}
            />
          </div>
        )}

        {/* Non-image icon */}
        {!isImage && (
          <div className="flex items-center gap-3 px-3 py-4 bg-white/60">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-2xl">{isPdf ? "📄" : "🎨"}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{fileName}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {isPdf ? "PDF Document" : "Design File"} — tap Preview to open
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-3 py-2.5 bg-white/80 border-t border-white/60">
          <Btn variant="ghost" size="sm" onClick={() => window.open(designFile, "_blank")} className="flex-1">
            Preview
          </Btn>
          <Btn variant="primary" size="sm" onClick={download} className="flex-1">
            Download
          </Btn>
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
            className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-gray-700 shadow text-lg"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
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
      
      const onlyProduction = jobs.filter((j) => j.job_status === "production");
      setResults(onlyProduction);
      if (onlyProduction.length === 0) show(`No production jobs found for "${q}"`, "warning");
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
      // Fetch the full document — list endpoints may omit design_file (AWS URL)
      const full    = await api(`/jobs/${job._id}`);
      const fullJob = full.data || job;
      setSelected(fullJob);
      onJobSelected(fullJob);
    } catch {
      // Fall back to the list data if full fetch fails
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

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {!selected && (
        <div className="flex gap-2 mb-2">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (results) setResults(null); }}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Job number or customer name…"
            className="flex-1 px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-50 transition-all placeholder:text-gray-400"
          />
          <Btn variant="ghost" onClick={doSearch} loading={searching}>Look up</Btn>
        </div>
      )}

      {results && results.length > 0 && !selected && (
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
          {results.map((job, idx) => (
            <div
              key={job._id}
              onClick={() => pickJob(job)}
              className={`flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${idx < results.length - 1 ? "border-b border-gray-100" : ""}`}
            >
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
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white font-mono">JOB</span>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">{selected.job_no}</div>
                <div className="text-xs text-gray-500">{selected.customer_name}</div>
              </div>
            </div>
            <button onClick={clear} className="text-xs text-purple-600 font-semibold hover:underline flex-shrink-0">
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
const ProductionUploadPanel = () => {
  // Pull authenticated user from Redux
  const { user } = useSelector((state) => state.authSlice);

  const { toast, show: toastShow, dismiss } = useToast();

  const [job,              setJob]              = useState(null);
  const [productionImages, setProductionImages] = useState([]); // string[] of upload URLs
  const [notes,            setNotes]            = useState("");
  const [submitting,       setSubmitting]       = useState(false);
  const [success,          setSuccess]          = useState(false);

  // Append a newly uploaded URL (ignore duplicates)
  const handleImageUploaded = useCallback((url) => {
    if (url && typeof url === "string") {
      setProductionImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
    }
  }, []);

  const removeImage = (idx) => {
    setProductionImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setJob(null);
    setProductionImages([]);
    setNotes("");
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!job)                           return toastShow("Select a job first", "error");
    if (productionImages.length === 0)  return toastShow("Capture at least one production photo", "error");
    if (!notes.trim())                  return toastShow("Add production notes before submitting", "error");

    setSubmitting(true);
    try {
      const handledBy = {
        user_id: user?._id || "",
        name:    user?.name || "Production Team",
        role:    user?.role || "printing team",
      };

      // 1. Record the primary production photo as the output/design file
      await api(`/jobs/${job._id}/approve_design`, {
        method: "POST",
        body: JSON.stringify({
          handled_by:  handledBy,
          design_file: productionImages[0],
        }),
      });

      // 2. Update job status → delivery
      await api(`/jobs/${job._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ job_status: "delivery" }),
      });

      // 3. Close the current production stage and hand off to delivery
      await api(`/jobs/${job._id}/complete-stage`, {
        method: "POST",
        body: JSON.stringify({
          stage:      job.current_stage?.stage || "production",
          handled_by: handledBy,
          notes,
          next_stage: "delivery",
        }),
      });

      setSuccess(true);
      toastShow("Production submitted! Job moved to delivery.", "success");
      setTimeout(resetForm, 3500);
    } catch (err) {
      toastShow(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = productionImages.length > 0 && notes.trim().length > 0;

  return (
    <div className="min- bg-gray-50 flex flex-col max-w-lg mx-auto relative">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🖨️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Production Upload</h1>
            <p className="text-xs text-gray-400 mt-0.5">Capture and submit completed print output</p>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-3 pt-3 pb-28 space-y-3 overflow-y-auto">

        {/* Success banner */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm font-bold text-emerald-700">Production submitted!</div>
            <div className="text-xs text-emerald-600 mt-1">Job has been moved to delivery stage.</div>
          </div>
        )}

        {/* Step 1 — Job lookup */}
        <Card>
          <SectionLabel color="purple">Step 1 · Select job</SectionLabel>
          <JobLookup onJobSelected={setJob} />
        </Card>

        {/* Design file — only after job selected */}
        {job && (
          <Card>
            <SectionLabel color="amber">Design file</SectionLabel>
            {job.design_file ? (
              <DesignFileCard
                designFile={job.design_file}
                designStatus={job.design_status}
                jobNo={job.job_no}
              />
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                  <div className="text-sm font-semibold text-amber-700">No design file attached</div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Ask admin to upload the approved design before printing.
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Step 2 — Capture photos */}
        {job && (
          <Card>
            <SectionLabel color="purple">Step 2 · Capture production photos</SectionLabel>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Tap the camera button to photograph the finished print. You can capture multiple photos.
            </p>

            {productionImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {productionImages.map((url, idx) => (
                  <ImageThumb key={`${url}-${idx}`} url={url} index={idx} onRemove={removeImage} />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <CameraUpload onUploaded={handleImageUploaded} />
              <div className="text-xs text-gray-400 leading-relaxed">
                {productionImages.length === 0 ? (
                  <>
                    Tap to open camera
                    <br />
                    <span className="text-gray-300">PNG · JPG · WebP</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-purple-600">
                      {productionImages.length} photo{productionImages.length > 1 ? "s" : ""} captured
                    </span>
                    <br />
                    Tap again to add more
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 3 — Notes */}
        {job && (
          <Card>
            <SectionLabel color="purple">Step 3 · Production notes</SectionLabel>
            <Field label="Notes" required>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="e.g. Printed on 13oz flex, colour adjusted for brightness. Ready for lamination and dispatch."
                className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-50 transition-all resize-none placeholder:text-gray-400"
              />
            </Field>

            {/* Pre-submit summary */}
            {canSubmit && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mt-1">
                <div className="text-xs font-semibold text-purple-600 mb-2">Ready to submit</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <span className="text-gray-500">Job</span>
                  <span className="font-semibold text-gray-700">{job.job_no}</span>
                  <span className="text-gray-500">Customer</span>
                  <span className="font-semibold text-gray-700">{job.customer_name}</span>
                  <span className="text-gray-500">Photos</span>
                  <span className="font-semibold text-gray-700">{productionImages.length} captured</span>
                  <span className="text-gray-500">Next stage</span>
                  <span className="font-semibold text-emerald-600">→ Delivery</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Submit */}
        {job && (
          <div className="pb-6">
            <Btn
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              variant="success"
              size="lg"
              className="w-full"
            >
              🚚 Submit and move to delivery
            </Btn>
            {!canSubmit && (
              <p className="text-xs text-center text-gray-400 mt-2">
                {productionImages.length === 0
                  ? "Capture at least one photo to continue"
                  : "Add production notes to continue"}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!job && !success && (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-5xl mb-3">🖨️</div>
            <div className="font-medium">Look up a job above</div>
            <div className="text-xs mt-1 text-gray-300">then capture and submit production output</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionUploadPanel;