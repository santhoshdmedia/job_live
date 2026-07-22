import { useEffect, useState, useCallback } from "react";
import {
  Button, Modal, Input, Spin, Empty,
  Tooltip, Divider, message, Popconfirm, Image, Select,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, FileImageOutlined,
  UserOutlined, CameraOutlined, ShoppingCartOutlined,
  CalendarOutlined, ReloadOutlined,
  DeleteOutlined, DownloadOutlined,
  PlayCircleOutlined, PauseCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined,
  StopOutlined, SwapOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import CapUploadHelper from "../helper/CapUploadHelper";
import { isSuperAdmin } from "../helper/permissionHelper";

dayjs.extend(duration);

const { TextArea } = Input;
const { Option } = Select;

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://api.dmedia.in/api/jobs";

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
  return `https://api.dmedia.in${url.startsWith("/") ? url : `/${url}`}`;
};

const formatDuration = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

// GET /api/jobs (all jobs — used for super admin, who should see every QC job
// regardless of who it's assigned to) can return the array in a few different
// shapes depending on pagination — normalize them all here.
const extractJobsList = (d) =>
  Array.isArray(d?.data?.jobs)
    ? d.data.jobs
    : Array.isArray(d?.data)
      ? d.data
      : Array.isArray(d?.jobs)
        ? d.jobs
        : Array.isArray(d)
          ? d
          : [];

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  quality_check: { label: "QC Pending",  color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  in_progress:   { label: "In Progress", color: "#fff",    bg: "#f59e0b", border: "#f59e0b" },
  on_hold:       { label: "On Hold",     color: "#fff",    bg: "#f59e0b", border: "#f59e0b" },
  passed:        { label: "Passed",      color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  failed:        { label: "Failed",      color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
  completed:     { label: "Completed",   color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  delivery:      { label: "Delivery",    color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.quality_check;
  const isAmber = ["in_progress", "on_hold"].includes(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 12px", borderRadius: 20,
      background: s.bg, border: `1.5px solid ${s.border}`,
      color: s.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
    }}>
      {isAmber && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LiveTimer
// ─────────────────────────────────────────────────────────────────────────────
const LiveTimer = ({ openSince, baseDurationSeconds = 0 }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!openSince) { setElapsed(0); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(openSince).getTime()) / 1000);
      setElapsed(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSince]);

  const total  = baseDurationSeconds + elapsed;
  const isLive = !!openSince;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "'Courier New', monospace",
      fontSize: 12, fontWeight: 700,
      color: isLive ? "#15803d" : "#374151",
    }}>
      {isLive && (
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
          animation: "qc-pulse 1.5s ease-in-out infinite",
          flexShrink: 0,
        }} />
      )}
      {formatDuration(total)}
      {isLive && <span style={{ fontSize: 10, color: "#22c55e", fontFamily: "sans-serif" }}>logged</span>}
      {!isLive && <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "sans-serif" }}>logged</span>}
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
    } catch { window.open(fullUrl, "_blank"); }
  };

  return (
    <div style={{
      border: "1px solid #ddd6fe", borderRadius: 10,
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
        <div style={{ display: "flex", gap: 10 }}>
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
            src={fullUrl} alt="Design reference"
            style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 6 }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      ) : isPdf ? (
        <div style={{ padding: 10, fontSize: 12, color: "#374151" }}>
          📄 PDF — <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>Click to view</a>
        </div>
      ) : (
        <div style={{ padding: 10, fontSize: 12, color: "#374151" }}>
          📎 File — <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>Download / View</a>
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
            background: "#f9fafb",
          }}>
            <Image
              src={src} width={80} height={80}
              style={{ objectFit: "cover" }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAM1BMVEXx8fH////y8vLz8/P09PT19fX29vb39/f4+Pj5+fn6+vr7+/v8/Pz9/f3+/v7///+qGMsrAAAAAnRSTlP//////////wD/////////AFZaHekAAAAASUVORK5CYII="
            />
            {!readonly && (
              <Button
                icon={<DeleteOutlined />} size="small" danger shape="circle"
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
// SessionHistoryPanel
// ─────────────────────────────────────────────────────────────────────────────
const SessionHistoryPanel = ({ sessionStatus }) => {
  if (!sessionStatus?.work_sessions?.length) return null;
  const sessions = sessionStatus.work_sessions;

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0",
      borderRadius: 8, padding: "10px 12px", marginBottom: 14,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        <ClockCircleOutlined style={{ marginRight: 5 }} />
        Session History ({sessions.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sessions.map((s, i) => {
          const start  = dayjs(s.session_start);
          const end    = s.session_end ? dayjs(s.session_end) : null;
          const dur    = s.duration_seconds || 0;
          const isOpen = !s.session_end;
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 8px", borderRadius: 6,
              background: isOpen ? "#f0fdf4" : "#fff",
              border: `1px solid ${isOpen ? "#86efac" : "#e5e7eb"}`,
              fontSize: 11,
            }}>
              <div style={{ color: "#64748b" }}>
                <span style={{ color: "#111827", fontWeight: 600 }}>#{i + 1}</span>
                {" · "}
                {start.format("DD MMM, HH:mm")}
                {end ? ` → ${end.format("HH:mm")}` : (
                  <span style={{ color: "#15803d", fontWeight: 700 }}> → NOW</span>
                )}
              </div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: isOpen ? "#15803d" : "#2563eb" }}>
                {isOpen
                  ? <LiveTimer openSince={s.session_start} baseDurationSeconds={0} />
                  : formatDuration(dur)
                }
              </div>
            </div>
          );
        })}
      </div>
      {sessionStatus.daily_summary?.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>Daily breakdown</div>
          {sessionStatus.daily_summary.map((d, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: "#6b7280", padding: "2px 0",
            }}>
              <span>{d.date || d.day}</span>
              <span style={{ fontFamily: "monospace", color: "#7c3aed", fontWeight: 600 }}>
                {formatDuration(d.duration_seconds || d.total_seconds || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QCJobCard — card with inline Start / Pause / Complete / Design buttons
// ─────────────────────────────────────────────────────────────────────────────
const QCJobCard = ({
  job,
  onOpenQCModal,
  sessionStatus,
  cardLoading,
  onCardStart,
  onCardPause,
  onCardComplete,
  isSuperAdmin,
  onReassign,
}) => {
  const delivDate  = job.estimated_delivery_date ? dayjs(job.estimated_delivery_date) : null;
  const isOverdue  = delivDate && delivDate.isBefore(dayjs());
  const isLive     = sessionStatus?.has_open_session;
  const hasSessions = (sessionStatus?.total_sessions || 0) > 0;
  const isOnHold   = !isLive && hasSessions;

  // Header gradient: green when live, blue when on-hold/default
  const headerBg = isLive
    ? "linear-gradient(135deg, #15803d 0%, #16a34a 100%)"
    : isOnHold
    ? "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)"
    : "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)";

  const hasDesign = !!(job.design_file || job.cart_items?.some((i) => i.design_file));

  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      border: `1.5px solid ${isLive ? "#86efac" : "#e5e7eb"}`,
      boxShadow: isLive
        ? "0 0 0 3px #dcfce7, 0 4px 20px rgba(34,197,94,0.12)"
        : "0 2px 10px rgba(0,0,0,0.07)",
      overflow: "hidden",
      transition: "all 0.2s",
      position: "relative",
    }}>
      {/* Live top strip */}
      {isLive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, #22c55e, #4ade80, #22c55e)",
          backgroundSize: "200% 100%",
          animation: "qc-shimmer 2s linear infinite",
        }} />
      )}

      {/* Card header */}
      <div style={{
        padding: "11px 14px",
        background: headerBg,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "monospace", fontWeight: 800, fontSize: 14,
            color: "#fff", letterSpacing: "0.05em",
          }}>
            {job.job_no}
          </span>
          {isLive && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#fff",
              background: "rgba(255,255,255,0.2)", borderRadius: 10,
              padding: "2px 8px", display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
                animation: "qc-pulse 1.5s ease-in-out infinite",
              }} />
              LIVE
            </span>
          )}
        </div>
        <StatusBadge status={isLive ? "in_progress" : isOnHold ? "on_hold" : job.job_status} />
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* Customer row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              border: "1.5px solid #bfdbfe",
            }}>
              <UserOutlined style={{ color: "#3b82f6", fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                {job.customer_name || "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>📞 {job.customer_phone || "—"}</div>
            </div>
          </div>
          {/* Session live badge top-right */}
          {isLive && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#15803d",
              background: "#f0fdf4", borderRadius: 10,
              padding: "3px 10px", border: "1px solid #86efac",
              whiteSpace: "nowrap",
            }}>
              ● Session Live
            </span>
          )}
          {isOnHold && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#b45309",
              background: "#fffbeb", borderRadius: 10,
              padding: "3px 10px", border: "1px solid #fde68a",
              whiteSpace: "nowrap",
            }}>
              {sessionStatus?.worked_days || 0} day logged
            </span>
          )}
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
                {item.size && <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {item.size}</span>}
              </span>
              <span style={{ color: "#6b7280" }}>×{item.quantity}</span>
            </div>
          ))}
          {(job.cart_items || []).length > 2 && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>+{job.cart_items.length - 2} more</div>
          )}
        </div>

        {/* Timer row */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 10,
        }}>
          <LiveTimer
            openSince={isLive ? sessionStatus?.open_since : null}
            baseDurationSeconds={sessionStatus?.total_duration_seconds || 0}
          />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {sessionStatus?.worked_days || 0} day{(sessionStatus?.worked_days || 0) !== 1 ? "s" : ""}
            {" · "}
            {sessionStatus?.total_sessions || 0} session{(sessionStatus?.total_sessions || 0) !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Delivery date */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
            <CalendarOutlined />
            {delivDate ? delivDate.format("DD MMM YYYY") : "—"}
            {isOverdue && <span style={{ fontWeight: 700 }}>⚠ Overdue</span>}
          </div>
        </div>

        {/* ── ACTION BUTTONS ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* State: no session yet → Show Start */}
          {!isLive && !hasSessions && (
            <>
              <Button
                icon={<PlayCircleOutlined />}
                loading={cardLoading}
                onClick={() => onCardStart(job)}
                style={{
                  flex: 1, height: 36, borderRadius: 8,
                  background: "#f0fdf4", border: "1.5px solid #86efac",
                  color: "#15803d", fontWeight: 700, fontSize: 12,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                Start
              </Button>
              {hasDesign && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => onOpenQCModal(job)}
                  style={{
                    height: 36, borderRadius: 8,
                    background: "#faf5ff", border: "1.5px solid #c4b5fd",
                    color: "#7c3aed", fontWeight: 700, fontSize: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  Design
                </Button>
              )}
            </>
          )}

          {/* State: session live → Show Pause + Complete + Design */}
          {isLive && (
            <>
              <Popconfirm
                title="Pause this session?"
                onConfirm={() => onCardPause(job)}
                okText="Pause"
                cancelText="Cancel"
              >
                <Button
                  icon={<PauseCircleOutlined />}
                  loading={cardLoading}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    background: "#fef2f2", border: "1.5px solid #fca5a5",
                    color: "#ef4444", fontWeight: 700, fontSize: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  Pause
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Complete this QC stage?"
                description="This will close the session and mark QC as completed."
                onConfirm={() => onCardComplete(job)}
                okText="Complete"
                okButtonProps={{ style: { background: "#16a34a", border: "none" } }}
                cancelText="Cancel"
              >
                <Button
                  icon={<CheckCircleOutlined />}
                  loading={cardLoading}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    background: "#f0fdf4", border: "1.5px solid #86efac",
                    color: "#15803d", fontWeight: 700, fontSize: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  Complete
                </Button>
              </Popconfirm>
              {hasDesign && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => onOpenQCModal(job)}
                  style={{
                    height: 36, borderRadius: 8,
                    background: "#faf5ff", border: "1.5px solid #c4b5fd",
                    color: "#7c3aed", fontWeight: 700, fontSize: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  Design
                </Button>
              )}
            </>
          )}

          {/* State: paused/on-hold → Show Resume + Design */}
          {isOnHold && (
            <>
              <Button
                icon={<PlayCircleOutlined />}
                loading={cardLoading}
                onClick={() => onCardStart(job)}
                style={{
                  flex: 1, height: 36, borderRadius: 8,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none",
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                Resume
              </Button>
              {hasDesign && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => onOpenQCModal(job)}
                  style={{
                    height: 36, borderRadius: 8,
                    background: "#faf5ff", border: "1.5px solid #c4b5fd",
                    color: "#7c3aed", fontWeight: 700, fontSize: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  Design
                </Button>
              )}
            </>
          )}
        </div>

        {/* QC Inspection link */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button
            icon={<CameraOutlined />}
            size="small"
            block
            onClick={() => onOpenQCModal(job)}
            style={{
              height: 30, borderRadius: 8,
              color: "#6b7280", borderColor: "#e5e7eb",
              background: "#f9fafb", fontWeight: 600, fontSize: 11,
            }}
          >
            Open QC Inspection
          </Button>
          {isSuperAdmin && (
            <Button
              icon={<SwapOutlined />}
              size="small"
              onClick={() => onReassign(job)}
              style={{
                height: 30, borderRadius: 8,
                color: "#7c3aed", borderColor: "#ddd6fe",
                background: "#faf5ff", fontWeight: 600, fontSize: 11,
                whiteSpace: "nowrap",
              }}
            >
              Reassign
            </Button>
          )}
        </div>
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
  const userIsSuperAdmin = isSuperAdmin(user.role);

  const [jobs, setJobs]                         = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [lastRefresh, setLastRefresh]           = useState(dayjs());
  const [sessionStatuses, setSessionStatuses]   = useState({});
  const [cardLoadingId, setCardLoadingId]       = useState(null); // which card is loading

  const [qcModalOpen, setQcModalOpen]           = useState(false);
  const [currentJob, setCurrentJob]             = useState(null);
  const [existingImages, setExistingImages]     = useState([]);
  const [newImageUrls, setNewImageUrls]         = useState([]);
  const [qcNotes, setQcNotes]                   = useState("");
  const [saving, setSaving]                     = useState(false);
  const [rejectReason, setRejectReason]         = useState("");
  const [showRejectInput, setShowRejectInput]   = useState(false);
  const [sessionStatus, setSessionStatus]       = useState(null);
  const [sessionLoading, setSessionLoading]     = useState(false);

  // ── Reassign (super admin only) ─────────────────────────────────────────────
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignJob, setReassignJob]             = useState(null);
  const [qcStaffList, setQcStaffList]             = useState([]);
  const [qcStaffLoading, setQcStaffLoading]       = useState(false);
  const [selectedReassignStaff, setSelectedReassignStaff] = useState(null);
  const [reassigning, setReassigning]             = useState(false);

  // ─── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let rows;
      if (userIsSuperAdmin) {
        // Super admin sees every job in the Quality Check stage, not just
        // the ones assigned to them.
        const res  = await fetch(BASE, { headers: authHeader() });
        const data = await res.json();
        rows = extractJobsList(data);
      } else {
        const res  = await fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() });
        const data = await res.json();
        rows = Array.isArray(data?.data) ? data.data : [];
      }
      const filtered = rows.filter((j) => j.job_status === "quality_check");
      setJobs(filtered);
      setLastRefresh(dayjs());
      filtered.forEach((job) => fetchSessionStatusCard(job._id));
    } catch (err) {
      message.error("Failed to load QC jobs: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [userId, userIsSuperAdmin]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── Fetch session status for card ────────────────────────────────────────
  const fetchSessionStatusCard = async (jobId) => {
    try {
      const res  = await fetch(`${BASE}/${jobId}/session/status?stage=quality_check`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) {
        setSessionStatuses((prev) => ({ ...prev, [jobId]: data.data }));
      }
    } catch (err) {
      console.error("Failed to fetch session status:", err);
    }
  };

  // ─── Fetch session status for modal ───────────────────────────────────────
  const fetchSessionStatus = async (jobId) => {
    setSessionLoading(true);
    try {
      const res  = await fetch(`${BASE}/${jobId}/session/status?stage=quality_check`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) {
        setSessionStatus(data.data);
        setSessionStatuses((prev) => ({ ...prev, [jobId]: data.data }));
      }
    } catch (err) {
      console.error("Failed to fetch session status:", err);
    } finally {
      setSessionLoading(false);
    }
  };

  // ─── Card: Start / Resume ─────────────────────────────────────────────────
  const handleCardStart = async (job) => {
    setCardLoadingId(job._id);
    try {
      const res  = await fetch(`${BASE}/${job._id}/session/open`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          stage:       "quality_check",
          stage_label: "Quality Check",
          user:        { user_id: userId, name: userName },
          notes:       "QC session started",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open session");
      message.success("Session started — timer is running.");
      await fetchSessionStatusCard(job._id);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCardLoadingId(null);
    }
  };

  // ─── Card: Pause ──────────────────────────────────────────────────────────
  const handleCardPause = async (job) => {
    setCardLoadingId(job._id);
    try {
      const res  = await fetch(`${BASE}/${job._id}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "quality_check", action: "on_hold", notes: "QC session paused" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to pause session");
      message.success("Session paused.");
      await fetchSessionStatusCard(job._id);
    } catch (err) {
      message.error(err.message);
    } finally {
      setCardLoadingId(null);
    }
  };

  // ─── Card: Complete ───────────────────────────────────────────────────────
  const handleCardComplete = async (job) => {
    setCardLoadingId(job._id);
    try {
      const ss = sessionStatuses[job._id];
      if (ss?.has_open_session) {
        const closeRes  = await fetch(`${BASE}/${job._id}/session/close`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({ stage: "quality_check", action: "completed", notes: "QC completed from card" }),
        });
        const closeData = await closeRes.json();
        if (!closeRes.ok || !closeData.success) throw new Error(closeData.message || "Failed to complete session");
      }
      // Pass QC — the backend moves the job to Delivery automatically.
      const passRes  = await fetch(`${BASE}/${job._id}/qc/pass`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: "Completed via card" }),
      });
      const passData = await passRes.json();
      if (!passRes.ok || !passData.success) throw new Error(passData.message || "Failed to pass QC");

      message.success("✅ QC Completed! Job moved to Delivery.");
      await loadJobs();
    } catch (err) {
      message.error(err.message);
    } finally {
      setCardLoadingId(null);
    }
  };

  // ─── Modal: Open / Close ──────────────────────────────────────────────────
  const openQCModal = async (job) => {
    setCurrentJob(job);
    setExistingImages(job.qc_images || []);
    setNewImageUrls([]);
    setQcNotes(job.qc_notes || "");
    setShowRejectInput(false);
    setRejectReason("");
    setSessionStatus(null);
    setQcModalOpen(true);
    await fetchSessionStatus(job._id);
  };

  const closeQCModal = () => {
    setQcModalOpen(false);
    setCurrentJob(null);
    setExistingImages([]);
    setNewImageUrls([]);
    setQcNotes("");
    setRejectReason("");
    setShowRejectInput(false);
    setSessionStatus(null);
  };

  // ─── Modal: Session controls ──────────────────────────────────────────────
  const handleOpenSession = async () => {
    if (!currentJob) return;
    setSaving(true);
    try {
      const res  = await fetch(`${BASE}/${currentJob._id}/session/open`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          stage:       "quality_check",
          stage_label: "Quality Check",
          user:        { user_id: userId, name: userName },
          notes:       "QC session started",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open session");
      message.success("QC session started — timer is running.");
      await fetchSessionStatus(currentJob._id);
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePauseSession = async () => {
    if (!currentJob) return;
    setSaving(true);
    try {
      const res  = await fetch(`${BASE}/${currentJob._id}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "quality_check", action: "on_hold", notes: "QC session paused" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to pause session");
      message.success("Session paused.");
      await fetchSessionStatus(currentJob._id);
      await fetchSessionStatusCard(currentJob._id);
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStopSession = async () => {
    if (!currentJob) return;
    setSaving(true);
    try {
      const res  = await fetch(`${BASE}/${currentJob._id}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: "quality_check", action: "completed", notes: "QC session stopped by inspector" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to stop session");
      message.success("Session stopped and time logged.");
      await fetchSessionStatus(currentJob._id);
      await fetchSessionStatusCard(currentJob._id);
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNewImageAdded = (val) => {
    if (Array.isArray(val)) {
      setNewImageUrls(val.map((v) => (typeof v === "string" ? v : v.path)).filter(Boolean));
    } else if (typeof val === "string" && val) {
      setNewImageUrls((prev) => [...prev, val]);
    }
  };

  const removeNewImage = (idx) => setNewImageUrls((prev) => prev.filter((_, i) => i !== idx));

  // ─── Reassign (super admin only) ────────────────────────────────────────────
  const fetchQCStaffList = async () => {
    setQcStaffLoading(true);
    try {
      const res  = await fetch("https://api.dmedia.in/api/admin/get_admin", { headers: authHeader() });
      const data = await res.json();
      const team = (data.data || []).filter((u) => u.role === "quality check");
      setQcStaffList(team);
    } catch {
      message.error("Could not load quality check staff list");
    } finally {
      setQcStaffLoading(false);
    }
  };

  const openReassignModal = async (job) => {
    setReassignJob(job);
    setSelectedReassignStaff(null);
    setReassignModalOpen(true);
    await fetchQCStaffList();
  };

  const closeReassignModal = () => {
    if (reassigning) return;
    setReassignModalOpen(false);
    setReassignJob(null);
    setSelectedReassignStaff(null);
    setQcStaffList([]);
  };

  const handleReassignSubmit = async () => {
    if (!reassignJob || !selectedReassignStaff) {
      message.warning("Please select a quality check staff member.");
      return;
    }
    setReassigning(true);
    try {
      const res  = await fetch(`${BASE}/${reassignJob._id}/assign`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          stage: "quality_check",
          stage_label: "Quality Check",
          assigned_to: {
            user_id: selectedReassignStaff._id,
            name: selectedReassignStaff.name || selectedReassignStaff.fullName || "Unknown",
            role: "quality check",
          },
          assigned_by: { user_id: userId, name: userName },
          notes: "Reassigned by super admin",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Reassign failed");
      message.success(`Reassigned to ${selectedReassignStaff.name}.`);
      closeReassignModal();
      await loadJobs();
    } catch (err) {
      message.error(err.message || "Failed to reassign");
    } finally {
      setReassigning(false);
    }
  };

  // ─── Save QC data ──────────────────────────────────────────────────────────
  const saveQCData = async (passOrFail = null) => {
    if (!currentJob) return;
    setSaving(true);
    try {
      const saveRes  = await fetch(`${BASE}/${currentJob._id}/qc/update`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({
          qc_notes:   qcNotes,
          qc_images:  newImageUrls,
          handled_by: { user_id: userId, name: userName },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success)
        throw new Error(saveData.message || "Failed to save QC data");

      if (passOrFail === "passed") {
        if (sessionStatus?.has_open_session) {
          await fetch(`${BASE}/${currentJob._id}/session/close`, {
            method: "POST", headers: jsonHeader(),
            body: JSON.stringify({ stage: "quality_check", action: "passed", notes: qcNotes }),
          });
        }
        const passRes  = await fetch(`${BASE}/${currentJob._id}/qc/pass`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({ handled_by: { user_id: userId, name: userName }, notes: qcNotes }),
        });
        const passData = await passRes.json();
        if (!passRes.ok || !passData.success) throw new Error(passData.message || "Failed to pass QC");

        message.success("✅ QC Passed! Job moved to Delivery.");

      } else if (passOrFail === "failed") {
        if (sessionStatus?.has_open_session) {
          await fetch(`${BASE}/${currentJob._id}/session/close`, {
            method: "POST", headers: jsonHeader(),
            body: JSON.stringify({ stage: "quality_check", action: "rejected", notes: rejectReason }),
          });
        }
        const failRes  = await fetch(`${BASE}/${currentJob._id}/qc/fail`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({
            handled_by: { user_id: userId, name: userName },
            reason:      rejectReason,
            notes:       qcNotes,
          }),
        });
        const failData = await failRes.json();
        if (!failRes.ok || !failData.success) throw new Error(failData.message || "Failed to fail QC");
        message.success("❌ QC Failed — rejection recorded.");
      } else {
        message.success("💾 QC data saved.");
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
    if (!rejectReason.trim()) { message.warning("Please provide a rejection reason."); return; }
    saveQCData("failed");
  };

  const rawDesignRef =
    currentJob?.design_file ||
    currentJob?.cart_items?.find((i) => i.design_file)?.design_file || null;
  const designRef = rawDesignRef ? resolveUrl(rawDesignRef) : null;

  const totalPhotos  = jobs.reduce((acc, j) => acc + (j.qc_images?.length || 0), 0);
  const liveJobCount = Object.values(sessionStatuses).filter((s) => s?.has_open_session).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes qc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes qc-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      <div style={{
        padding: 16,
        background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #faf5ff 100%)",
        minHeight: "100vh",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
          padding: "14px 18px", marginBottom: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            }}>
              <CameraOutlined style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
                Quality Check Dashboard
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Hi <strong style={{ color: "#374151" }}>{userName}</strong>
                {" · "}{jobs.length} job{jobs.length !== 1 ? "s" : ""} awaiting QC
                {liveJobCount > 0 && (
                  <span style={{ color: "#15803d", fontWeight: 700, marginLeft: 4 }}>
                    · {liveJobCount} live
                  </span>
                )}
                {" · "}
                <span style={{ color: "#9ca3af" }}>Updated {lastRefresh.format("HH:mm:ss")}</span>
              </p>
            </div>
          </div>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} />
          </Tooltip>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10, marginBottom: 16,
        }}>
          {[
            { label: "Pending QC",    value: jobs.length,       color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
            { label: "Live Sessions", value: liveJobCount,       color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
            { label: "Photos Taken",  value: totalPhotos,        color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
            { label: "With Design",   value: jobs.filter((j) => j.design_file).length, color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
            { label: "Overdue",       value: jobs.filter((j) => j.estimated_delivery_date && dayjs(j.estimated_delivery_date).isBefore(dayjs())).length, color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{
              background: bg, borderRadius: 10, padding: "10px 14px",
              border: `1px solid ${border}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Job grid ───────────────────────────────────────────────────── */}
        <Spin spinning={loading}>
          {!loading && jobs.length === 0 ? (
            <div style={{
              background: "#fff", borderRadius: 14, padding: "60px 20px",
              textAlign: "center", border: "1px solid #e5e7eb",
            }}>
              <Empty
                description={
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827" }}>No pending QC jobs</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Jobs in the quality check stage will appear here
                    </div>
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
                  sessionStatus={sessionStatuses[job._id]}
                  cardLoading={cardLoadingId === job._id}
                  onCardStart={handleCardStart}
                  onCardPause={handleCardPause}
                  onCardComplete={handleCardComplete}
                  isSuperAdmin={userIsSuperAdmin}
                  onReassign={openReassignModal}
                />
              ))}
            </div>
          )}
        </Spin>

        {/* ── QC Inspection Modal ────────────────────────────────────────── */}
        <Modal
          open={qcModalOpen}
          onCancel={closeQCModal}
          title={
            <span style={{ color: "#111827" }}>
              <CameraOutlined style={{ marginRight: 6, color: "#3b82f6" }} />
              Quality Inspection —{" "}
              <span style={{ fontFamily: "monospace", color: "#1d4ed8" }}>
                {currentJob?.job_no}
              </span>
            </span>
          }
          footer={null}
          width={700}
          destroyOnClose
        >
          {currentJob && (
            <div>
              {/* ── Customer info ──────────────────────────────────────── */}
              <div style={{
                background: "#f8fafc", borderRadius: 8, padding: "10px 12px",
                marginBottom: 14, border: "1px solid #e5e7eb",
                display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                    {currentJob.customer_name}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>📞 {currentJob.customer_phone}</div>
                </div>
                <StatusBadge status={currentJob.job_status} />
              </div>

              {/* ── Session Timer Panel ───────────────────────────────── */}
              <div style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: "12px 14px", marginBottom: 14,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "#64748b",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>
                    <ThunderboltOutlined style={{ marginRight: 5, color: "#f59e0b" }} />
                    QC Session Timer
                  </div>
                  {sessionLoading ? (
                    <Spin size="small" />
                  ) : sessionStatus ? (
                    <LiveTimer
                      openSince={sessionStatus.has_open_session ? sessionStatus.open_since : null}
                      baseDurationSeconds={sessionStatus.total_duration_seconds || 0}
                    />
                  ) : null}
                </div>

                {sessionLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Spin size="small" />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Loading session…</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {!sessionStatus?.has_open_session && (
                      <Button
                        icon={<PlayCircleOutlined />}
                        loading={saving || sessionLoading}
                        onClick={handleOpenSession}
                        style={{
                          background: "#f0fdf4", border: "1px solid #86efac",
                          color: "#15803d", fontWeight: 700, borderRadius: 8,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {(sessionStatus?.total_sessions || 0) > 0 ? "Resume" : "Start Session"}
                      </Button>
                    )}
                    {sessionStatus?.has_open_session && (
                      <Button
                        icon={<PauseCircleOutlined />}
                        loading={saving}
                        onClick={handlePauseSession}
                        style={{
                          background: "#fff7ed", border: "1px solid #fed7aa",
                          color: "#c2410c", fontWeight: 700, borderRadius: 8,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        Pause
                      </Button>
                    )}
                    {(sessionStatus?.total_sessions || 0) > 0 && (
                      <Popconfirm
                        title="Stop this QC session?"
                        description="This will permanently close the session."
                        onConfirm={handleStopSession}
                        okText="Yes, Stop"
                        okButtonProps={{ danger: true }}
                        cancelText="Cancel"
                      >
                        <Button
                          icon={<StopOutlined />}
                          loading={saving}
                          style={{
                            background: "#fef2f2", border: "1px solid #fecaca",
                            color: "#b91c1c", fontWeight: 700, borderRadius: 8,
                            display: "inline-flex", alignItems: "center", gap: 4,
                          }}
                        >
                          Stop
                        </Button>
                      </Popconfirm>
                    )}
                    {sessionStatus && (
                      <div style={{ fontSize: 11, color: "#6b7280", display: "flex", gap: 6, alignItems: "center" }}>
                        <ClockCircleOutlined />
                        <span>
                          {sessionStatus.total_sessions} session{sessionStatus.total_sessions !== 1 ? "s" : ""}
                          {" · "}Total:{" "}
                          <span style={{ fontFamily: "monospace", color: "#7c3aed", fontWeight: 700 }}>
                            {formatDuration(sessionStatus.total_duration_seconds || 0)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {sessionStatus && !sessionStatus.has_open_session && sessionStatus.total_sessions > 0 && (
                  <div style={{
                    marginTop: 10, padding: "6px 10px", borderRadius: 6,
                    background: "#fef2f2", border: "1px solid #fecaca",
                    fontSize: 11, color: "#b91c1c", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                    <StopOutlined />
                    Session paused / stopped — click Resume to continue
                  </div>
                )}
              </div>

              {/* ── Session History ───────────────────────────────────── */}
              <SessionHistoryPanel sessionStatus={sessionStatus} />

              {/* ── Reference design ─────────────────────────────────── */}
              {designRef && <DesignFilePreview fileUrl={designRef} label="Reference Design" />}

              {/* ── Existing QC photos ────────────────────────────────── */}
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

              {/* ── Upload new QC photos ──────────────────────────────── */}
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
                  multiple max={20} showCamera
                />

                {newImageUrls.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
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

              {/* ── Action buttons ────────────────────────────────────── */}
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
                    okButtonProps={{ style: { background: "#16a34a", border: "none" } }}
                  >
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      loading={saving}
                      style={{ flex: 1, background: "#16a34a", border: "none", fontWeight: 700 }}
                    >
                      Approve & Pass
                    </Button>
                  </Popconfirm>
                  <Button
                    icon={<CloseCircleOutlined />}
                    onClick={() => setShowRejectInput(true)}
                    style={{
                      flex: 1, color: "#ef4444", borderColor: "#fca5a5",
                      background: "#fef2f2", fontWeight: 700,
                    }}
                  >
                    Reject / Fail
                  </Button>
                </div>
              ) : (
                <div style={{
                  background: "#fef2f2", borderRadius: 8, padding: 12,
                  border: "1px solid #fecaca",
                }}>
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
                      danger icon={<CloseCircleOutlined />}
                      loading={saving} onClick={handleReject}
                      style={{ fontWeight: 700 }}
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
                * <strong style={{ color: "#6b7280" }}>Start</strong> to begin timing.{" "}
                <strong style={{ color: "#6b7280" }}>Pause</strong> to temporarily stop the clock.{" "}
                <strong style={{ color: "#6b7280" }}>Stop</strong> to permanently close the session.{" "}
                <strong style={{ color: "#6b7280" }}>Approve</strong> closes session & moves to Delivery.{" "}
                <strong style={{ color: "#6b7280" }}>Reject</strong> logs the failure.
              </div>
            </div>
          )}
        </Modal>

        {/* ── Reassign Quality Check Modal (super admin only) ──────────────── */}
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SwapOutlined style={{ color: "#7c3aed" }} />
              <span style={{ fontWeight: 700 }}>Reassign Quality Check</span>
            </div>
          }
          open={reassignModalOpen}
          onCancel={closeReassignModal}
          maskClosable={!reassigning}
          closable={!reassigning}
          footer={[
            <Button key="cancel" onClick={closeReassignModal} disabled={reassigning}>
              Cancel
            </Button>,
            <Button
              key="submit" type="primary" loading={reassigning}
              disabled={!selectedReassignStaff || qcStaffLoading}
              onClick={handleReassignSubmit}
              style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
            >
              Reassign
            </Button>,
          ]}
          destroyOnClose
        >
          {reassignJob && (
            <div>
              <div style={{
                background: "#f8fafc", borderRadius: 8, padding: "10px 12px",
                marginBottom: 16, border: "1px solid #e5e7eb",
              }}>
                <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#7c3aed", fontSize: 14 }}>
                  {reassignJob.job_no}
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>
                  {reassignJob.customer_name || "—"}
                </div>
                {reassignJob.current_stage?.assigned_to?.name && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                    Currently assigned to <strong>{reassignJob.current_stage.assigned_to.name}</strong>
                  </div>
                )}
              </div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                Assign To <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Select
                placeholder={qcStaffLoading ? "Loading staff…" : "Choose a quality check staff member"}
                style={{ width: "100%" }}
                value={selectedReassignStaff?._id || undefined}
                loading={qcStaffLoading}
                disabled={qcStaffLoading}
                onChange={(id) => setSelectedReassignStaff(qcStaffList.find((s) => s._id === id) || null)}
                notFoundContent={qcStaffLoading ? "Loading…" : "No quality check staff found"}
              >
                {qcStaffList.map((s) => (
                  <Option key={s._id} value={s._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <UserOutlined style={{ color: "#6b7280", fontSize: 12 }} />
                      <span>{s.name || s.fullName || s.username || s._id}</span>
                    </div>
                  </Option>
                ))}
              </Select>
              {!qcStaffLoading && qcStaffList.length === 0 && (
                <div style={{
                  marginTop: 8, color: "#b45309", fontSize: 12,
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: 6, padding: "6px 10px",
                }}>
                  No staff found. Add a user with role "quality check" first.
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default QualityCheckDashboard;