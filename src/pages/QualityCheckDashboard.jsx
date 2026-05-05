import { useEffect, useState, useCallback } from "react";
import {
  Button, Tag, Modal, Input, Spin, Empty,
  Tooltip, Divider, message, Popconfirm, Image,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, FileImageOutlined,
  UserOutlined, CameraOutlined, ShoppingCartOutlined,
  CalendarOutlined, ReloadOutlined,
  DeleteOutlined, DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import CapUploadHelper from "../helper/CapUploadHelper";

const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://job-server-cocj.onrender.com/api/jobs";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("authToken")}`,
});
const jsonHeader = () => ({
  ...authHeader(),
  "Content-Type": "application/json",
});
const profile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};

const resolveUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://job-server-cocj.onrender.com${url.startsWith("/") ? url : `/${url}`}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  quality_check: { label: "QC Pending",  color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  in_progress:   { label: "In Progress", color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
  on_hold:       { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  passed:        { label: "Passed",      color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  failed:        { label: "Failed",      color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  completed:     { label: "Completed",   color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
  delivery:      { label: "Delivery",    color: "#0891b2", bg: "#ecfeff", border: "#67e8f9" },
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.quality_check;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DesignFilePreview
// ─────────────────────────────────────────────────────────────────────────────
const DesignFilePreview = ({ fileUrl, label = "Reference Design" }) => {
  if (!fileUrl) return null;

  const fullUrl = resolveUrl(fileUrl);
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(fullUrl);
  const isPdf   = /\.pdf(\?.*)?$/i.test(fullUrl);

  const handleDownload = async () => {
    try {
      const res  = await fetch(fullUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `design_${Date.now()}.${fullUrl.split(".").pop().split("?")[0]}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(fullUrl, "_blank");
    }
  };

  return (
    <div style={{
      border: "1px solid #c4b5fd", borderRadius: 10,
      overflow: "hidden", marginBottom: 14, background: "#faf5ff",
    }}>
      <div style={{
        padding: "8px 12px",
        background: "linear-gradient(135deg, #7c3aed, #9333ea)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5f3ff" }}>
          <FileImageOutlined style={{ marginRight: 5 }} />{label}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={fullUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#e9d5ff", fontSize: 10 }}>
            <EyeOutlined /> Open
          </a>
          <span onClick={handleDownload}
            style={{ color: "#e9d5ff", fontSize: 10, cursor: "pointer" }}>
            <DownloadOutlined /> Download
          </span>
        </div>
      </div>

      {isImage ? (
        <div style={{ padding: 10, textAlign: "center", background: "#f5f3ff" }}>
          <img
            src={fullUrl}
            alt="Design reference"
            style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 6 }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      ) : isPdf ? (
        <div style={{ padding: 10, fontSize: 12, color: "#374151" }}>
          📄 PDF — <a href={fullUrl} target="_blank" rel="noopener noreferrer">Click to view</a>
        </div>
      ) : (
        <div style={{ padding: 10, fontSize: 12, color: "#374151" }}>
          📎 File — <a href={fullUrl} target="_blank" rel="noopener noreferrer">Download / View</a>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QCImageGallery
// ─────────────────────────────────────────────────────────────────────────────
const QCImageGallery = ({ images = [], onRemove, readonly = false }) => {
  if (!images.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {images.map((img, idx) => {
        const src = resolveUrl(img);
        return (
          <div key={idx} style={{
            position: "relative", width: 80, height: 80,
            border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden",
            background: "#f3f4f6",
          }}>
            <Image
              src={src}
              width={80}
              height={80}
              style={{ objectFit: "cover" }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAM1BMVEXx8fH////y8vLz8/P09PT19fX29vb39/f4+Pj5+fn6+vr7+/v8/Pz9/f3+/v7///+qGMsrAAAAAnRSTlP//////////wD/////////AFZaHekAAAAASUVORK5CYII="
            />
            {!readonly && (
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                shape="circle"
                style={{ position: "absolute", top: 2, right: 2, opacity: 0.9 }}
                onClick={() => onRemove(idx)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QCJobCard
// ─────────────────────────────────────────────────────────────────────────────
const QCJobCard = ({ job, onOpenQCModal }) => {
  const delivDate = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
  const isOverdue = delivDate && delivDate.isBefore(dayjs());
  const hasPhotos = (job.qc_images || []).length > 0;
  const hasDesign = !!(job.design_file || job.cart_items?.some((i) => i.design_file));

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Card header */}
      <div style={{
        padding: "10px 14px",
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontFamily: "monospace", fontWeight: 800, fontSize: 13,
          color: "#93c5fd",
        }}>
          {job.job_no}
        </span>
        <StatusBadge status={job.job_status} />
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* Customer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: "#eff6ff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <UserOutlined style={{ color: "#3b82f6", fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
              {job.customer_name || "—"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              📞 {job.customer_phone || "—"}
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div style={{
          background: "#f8fafc", borderRadius: 8, padding: "8px 10px",
          marginBottom: 10, border: "1px solid #e5e7eb",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5,
          }}>
            <ShoppingCartOutlined style={{ marginRight: 4 }} />Items
          </div>
          {(job.cart_items || []).slice(0, 2).map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, color: "#374151", marginBottom: 3,
            }}>
              <span style={{ fontWeight: 600 }}>
                {item.product_name}
                {item.size && (
                  <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {item.size}</span>
                )}
              </span>
              <span style={{ color: "#6b7280" }}>×{item.quantity}</span>
            </div>
          ))}
          {(job.cart_items || []).length > 2 && (
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              +{job.cart_items.length - 2} more
            </div>
          )}
        </div>

        {/* Delivery date */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#6b7280" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {delivDate ? delivDate.format("DD MMM YYYY") : "—"}
            {isOverdue && (
              <span style={{ marginLeft: 4, fontWeight: 700 }}>⚠ Overdue</span>
            )}
          </div>
        </div>

        {/* Tags */}
        {(hasDesign || hasPhotos) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {hasDesign && <Tag icon={<FileImageOutlined />} color="purple">Design provided</Tag>}
            {hasPhotos && (
              <Tag icon={<CheckCircleOutlined />} color="green">
                {job.qc_images.length} photo{job.qc_images.length !== 1 ? "s" : ""}
              </Tag>
            )}
          </div>
        )}

        {/* Actions */}
        <Button
          icon={<CameraOutlined />}
          size="small"
          block
          onClick={() => onOpenQCModal(job)}
          style={{
            height: 34, borderRadius: 8,
            color: "#7c3aed", borderColor: "#c4b5fd", background: "#faf5ff",
            fontWeight: 600,
          }}
        >
          QC Inspection
        </Button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Main Quality Check Dashboard
// ═════════════════════════════════════════════════════════════════════════════
const QualityCheckDashboard = () => {
  const user     = profile();
  const userId   = user._id;
  const userName = user.name || user.fullName || user.username || "QC Inspector";

  // ── Data state
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState(dayjs());

  // ── QC modal state
  const [qcModalOpen, setQcModalOpen]         = useState(false);
  const [currentJob, setCurrentJob]           = useState(null);
  const [existingImages, setExistingImages]   = useState([]);
  const [newImageUrls, setNewImageUrls]       = useState([]);
  const [qcNotes, setQcNotes]                 = useState("");
  const [saving, setSaving]                   = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // ─── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() });
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      setJobs(rows.filter((j) => j.job_status === "quality_check"));
      setLastRefresh(dayjs());
    } catch (err) {
      message.error("Failed to load QC jobs: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── QC Modal helpers ──────────────────────────────────────────────────────
  const openQCModal = (job) => {
    setCurrentJob(job);
    setExistingImages(job.qc_images || []);
    setNewImageUrls([]);
    setQcNotes(job.qc_notes || "");
    setShowRejectInput(false);
    setRejectReason("");
    setQcModalOpen(true);
  };

  const closeQCModal = () => {
    setQcModalOpen(false);
    setCurrentJob(null);
    setExistingImages([]);
    setNewImageUrls([]);
    setQcNotes("");
    setRejectReason("");
    setShowRejectInput(false);
  };

  const handleNewImageAdded = (val) => {
    if (Array.isArray(val)) {
      setNewImageUrls(val.map((v) => (typeof v === "string" ? v : v.path)).filter(Boolean));
    } else if (typeof val === "string" && val) {
      setNewImageUrls((prev) => [...prev, val]);
    }
  };

  const removeNewImage = (idx) =>
    setNewImageUrls((prev) => prev.filter((_, i) => i !== idx));

  // ─── Save QC data ──────────────────────────────────────────────────────────
  const saveQCData = async (passOrFail = null) => {
    if (!currentJob) return;
    setSaving(true);
    try {
      // Step 1: Save photos + notes
      const saveRes = await fetch(`${BASE}/${currentJob._id}/qc/update`, {
        method:  "POST",
        headers: jsonHeader(),
        body: JSON.stringify({
          qc_notes:   qcNotes,
          qc_images:  newImageUrls,
          handled_by: { user_id: userId, name: userName },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success)
        throw new Error(saveData.message || "Failed to save QC data");

      // Step 2a: Approve & Pass
      if (passOrFail === "passed") {
        const passRes = await fetch(`${BASE}/${currentJob._id}/qc/pass`, {
          method:  "POST",
          headers: jsonHeader(),
          body: JSON.stringify({
            handled_by: { user_id: userId, name: userName },
            notes:       qcNotes,
          }),
        });
        const passData = await passRes.json();
        if (!passRes.ok || !passData.success)
          throw new Error(passData.message || "Failed to pass QC");

        const statusRes = await fetch(`${BASE}/${currentJob._id}/status`, {
          method:  "PATCH",
          headers: jsonHeader(),
          body: JSON.stringify({ job_status: "delivery" }),
        });
        const statusData = await statusRes.json();
        if (!statusRes.ok || !statusData.success)
          throw new Error(statusData.message || "Failed to update job status to delivery");

        message.success("Quality passed! Job moved to Delivery.");

      // Step 2b: Reject / Fail
      } else if (passOrFail === "failed") {
        const failRes = await fetch(`${BASE}/${currentJob._id}/qc/fail`, {
          method:  "POST",
          headers: jsonHeader(),
          body: JSON.stringify({
            handled_by: { user_id: userId, name: userName },
            reason:      rejectReason,
            notes:       qcNotes,
          }),
        });
        const failData = await failRes.json();
        if (!failRes.ok || !failData.success)
          throw new Error(failData.message || "Failed to fail QC");

        message.success("QC failed — rejection recorded.");

      // Step 2c: Save only
      } else {
        message.success("QC data saved.");
      }

      closeQCModal();
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = () => saveQCData(null);
  const handleApprove  = () => saveQCData("passed");
  const handleReject   = () => {
    if (!rejectReason.trim()) {
      message.warning("Please provide a rejection reason.");
      return;
    }
    saveQCData("failed");
  };

  // ─── Derived values ────────────────────────────────────────────────────────
  const rawDesignRef =
    currentJob?.design_file ||
    currentJob?.cart_items?.find((i) => i.design_file)?.design_file ||
    null;
  const designRef = rawDesignRef ? resolveUrl(rawDesignRef) : null;

  const totalPhotos = jobs.reduce((acc, j) => acc + (j.qc_images?.length || 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: 16,
      background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #faf5ff 100%)",
      minHeight: "100vh",
    }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "14px 18px", marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CameraOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
              Quality Check Dashboard
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Hi <strong>{userName}</strong> · {jobs.length} job{jobs.length !== 1 ? "s" : ""} awaiting QC ·
              Updated {lastRefresh.format("HH:mm:ss")}
            </p>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} />
        </Tooltip>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10, marginBottom: 16,
      }}>
        {[
          { label: "Pending QC",   value: jobs.length,      color: "#3b82f6", bg: "#eff6ff" },
          { label: "Photos Taken", value: totalPhotos,       color: "#8b5cf6", bg: "#f5f3ff" },
          { label: "With Design",  value: jobs.filter((j) => j.design_file).length, color: "#0891b2", bg: "#ecfeff" },
          { label: "Overdue",      value: jobs.filter((j) => j.estimated_delivery_date && dayjs(j.estimated_delivery_date).isBefore(dayjs())).length, color: "#ef4444", bg: "#fef2f2" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: bg, borderRadius: 10, padding: "10px 14px",
            border: `1px solid ${color}33`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Job grid ───────────────────────────────────────────────────────── */}
      <Spin spinning={loading}>
        {!loading && jobs.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "60px 20px",
            textAlign: "center", border: "1px solid #e5e7eb",
          }}>
            <Empty
              description={
                <div>
                  <div style={{ fontWeight: 700 }}>No pending QC jobs</div>
                  <div style={{ fontSize: 13 }}>Jobs in the quality check stage will appear here</div>
                </div>
              }
            />
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}>
            {jobs.map((job) => (
              <QCJobCard
                key={job._id}
                job={job}
                onOpenQCModal={openQCModal}
              />
            ))}
          </div>
        )}
      </Spin>

      {/* ── QC Inspection Modal ────────────────────────────────────────────── */}
      <Modal
        open={qcModalOpen}
        onCancel={closeQCModal}
        title={
          <span>
            <CameraOutlined style={{ marginRight: 6 }} />
            Quality Inspection — {currentJob?.job_no}
          </span>
        }
        footer={null}
        width={680}
        destroyOnClose
      >
        {currentJob && (
          <div>
            {/* ── Customer info ─────────────────────────────────────────── */}
            <div style={{
              background: "#f8fafc", borderRadius: 8, padding: "10px 12px",
              marginBottom: 14, border: "1px solid #e5e7eb",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 8,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                  {currentJob.customer_name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  📞 {currentJob.customer_phone}
                </div>
              </div>
              <StatusBadge status={currentJob.job_status} />
            </div>

            {/* ── Reference design ─────────────────────────────────────── */}
            {designRef && (
              <DesignFilePreview fileUrl={designRef} label="Reference Design" />
            )}

            {/* ── Existing (server-saved) QC photos ────────────────────── */}
            {existingImages.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, marginBottom: 8,
                  color: "#374151", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <CheckCircleOutlined style={{ color: "#16a34a" }} />
                  Saved Photos ({existingImages.length})
                </div>
                <QCImageGallery images={existingImages} readonly />
              </div>
            )}

            {/* ── Upload new QC photos ──────────────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, marginBottom: 8,
                color: "#374151", display: "flex", alignItems: "center", gap: 6,
              }}>
                <CameraOutlined style={{ color: "#7c3aed" }} />
                Add QC Photos
              </div>

              <CapUploadHelper
                image_path={newImageUrls.map((url, i) => ({ key: i + 1, path: url }))}
                setImagePath={handleNewImageAdded}
                multiple
                max={20}
                showCamera
              />

              {newImageUrls.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151",
                  }}>
                    New Photos ({newImageUrls.length}) — not yet saved
                  </div>
                  <QCImageGallery images={newImageUrls} onRemove={removeNewImage} />
                </div>
              )}

              <TextArea
                rows={3}
                placeholder="Inspection notes, observations…"
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                style={{ marginTop: 12 }}
              />
            </div>

            <Divider style={{ margin: "12px 0" }} />

            {/* ── Action buttons ────────────────────────────────────────── */}
            {!showRejectInput ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button loading={saving} onClick={handleSaveOnly} style={{ flex: 1 }}>
                  Save Photos & Notes
                </Button>
                <Popconfirm
                  title="Pass this job's quality check?"
                  description="This will mark the job as QC passed and move it to Delivery."
                  onConfirm={handleApprove}
                  okText="Yes, Pass"
                  okButtonProps={{ style: { background: "#16a34a" } }}
                >
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    style={{ flex: 1, background: "#16a34a", border: "none" }}
                  >
                    Approve & Pass
                  </Button>
                </Popconfirm>
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={() => setShowRejectInput(true)}
                  style={{ flex: 1, color: "#ef4444", borderColor: "#fca5a5" }}
                >
                  Reject / Fail
                </Button>
              </div>
            ) : (
              <div style={{ background: "#fef2f2", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#b91c1c" }}>
                  Rejection Reason *
                </div>
                <TextArea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why does this fail QC? (e.g. misprint, wrong size, damaged)"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={saving}
                    onClick={handleReject}
                  >
                    Confirm Fail
                  </Button>
                  <Button onClick={() => { setShowRejectInput(false); setRejectReason(""); }}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>
              * <strong>Save Photos</strong> keeps the job in QC. <strong>Approve</strong> moves it
              to Delivery. <strong>Reject</strong> sends it back for rework.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QualityCheckDashboard;