import { useState, useEffect, useCallback, useRef } from "react";
import {
  FiBriefcase, FiCheckCircle, FiAlertCircle, FiUser,
  FiTrendingUp, FiCalendar, FiFilter, FiRefreshCw,
  FiXCircle, FiPauseCircle, FiEdit3, FiZap, FiAlertTriangle,
  FiWifi, FiWifiOff, FiChevronDown, FiChevronUp, FiSearch,
  FiEye, FiX, FiPackage, FiTruck, FiShield, FiPhone,
  FiMapPin, FiClock, FiDollarSign, FiFileText, FiImage,
  FiSlash, FiActivity, FiGlobe, FiMap,
} from "react-icons/fi";
import { Spin, Empty, notification } from "antd";
import { useSelector } from "react-redux";

// ═══════════════════════════════════════════════════════════════════
// Fonts — Fira Code (data / mono) + Fira Sans (UI / body)
// ═══════════════════════════════════════════════════════════════════

const FONT_IMPORT_ID = "dmedia-dashboard-fonts";
const injectFonts = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(link);
};

// ═══════════════════════════════════════════════════════════════════
// Design tokens — dark financial-dashboard palette
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg:         "#F0F8FF",        // Alice blue - very light sky blue background
  bgSubtle:   "#E6F3FF",        // Lighter sky blue for subtle backgrounds
  card:       "#FFFFFF",        // Pure white cards
  cardAlt:    "#F5FAFF",        // Very light blue-white for alternate cards
  border:     "#B0D4F1",        // Soft sky blue borders
  borderSoft: "#D0E8FF",        // Even softer sky blue borders
  text:       "#0A0A0A",        // Almost black for primary text
  textDim:    "#2C5282",        // Dark blue for dimmed text
  textFaint:  "#6B8FA3",        // Muted blue-gray for faint text
  accent:     "#1E88E5",        // Bright blue accent
  accentDim:  "#1565C0",        // Darker blue for accent hover/states
  blue:       "#0D47A1",        // Deep blue
  violet:     "#5B6ABF",        // Soft violet-blue
  amber:      "#F59E0B",        // Kept amber for contrast/warnings
  red:        "#E53E3E",        // Kept red for errors
  redStrong:  "#C53030",        // Stronger red
  teal:       "#0D9488",        // Kept teal for variety
  fontMono:   "'Fira Code', monospace",
  fontSans:   "'Fira Sans', sans-serif",
};

// ═══════════════════════════════════════════════════════════════════
// Super Admin Email Whitelist
// ═══════════════════════════════════════════════════════════════════

const SUPER_ADMIN_EMAILS = ["hari@dmedia.in", "admin@dmedia.in"];

// ═══════════════════════════════════════════════════════════════════
// API Layer
// ═══════════════════════════════════════════════════════════════════

const buildHeaders = (token) => {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
};

const apiGet = async (url, token) => {
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
};

const fetchDashboardData = async ({ baseURL, token, userId, user, isSuperAdmin }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const allEndpoint = `${baseURL}/jobs?page=1&limit=500&sort_by=createdAt&sort_order=desc`;

  const allData = await apiGet(allEndpoint, token);
  const allJobs = allData?.data?.jobs || [];

  const myJobs = isSuperAdmin
    ? allJobs
    : allJobs.filter(job => {
        if (!job.created_by) return false;
        if (typeof job.created_by === "object" && job.created_by !== null) {
          return job.created_by.name === user.name || job.created_by._id === userId;
        }
        return job.created_by === user.name || job.created_by === userId;
      });

  const expiryToday = allJobs.filter(
    j => j.valid_until && j.valid_until.slice(0, 10) === todayStr
  );

  return { allJobs, myJobs, expiryToday };
};

// ═══════════════════════════════════════════════════════════════════
// Status & Stage Configs — remapped to dark palette
// ═══════════════════════════════════════════════════════════════════

const TERMINAL_STATUSES = new Set(["completed", "delivery", "rejected", "converted"]);

const STATUS_CONFIG = {
  draft:         { label: "Draft",         color: T.textDim, bg: "rgba(148,163,184,0.12)", icon: <FiEdit3       size={11} /> },
  accepted:      { label: "Accepted",      color: T.blue,     bg: "rgba(56,189,248,0.12)",  icon: <FiCheckCircle size={11} /> },
  design:        { label: "Design",        color: T.violet,   bg: "rgba(167,139,250,0.12)", icon: <FiEdit3       size={11} /> },
  in_progress:   { label: "In Progress",   color: T.accent,   bg: "rgba(34,197,94,0.12)",   icon: <FiZap         size={11} /> },
  production:    { label: "Production",    color: T.blue,     bg: "rgba(56,189,248,0.12)",  icon: <FiPackage     size={11} /> },
  quality_check: { label: "Quality Check", color: T.amber,    bg: "rgba(251,191,36,0.12)",  icon: <FiShield      size={11} /> },
  delivery:      { label: "Delivery",      color: T.teal,     bg: "rgba(45,212,191,0.12)",  icon: <FiTruck       size={11} /> },
  on_hold:       { label: "On Hold",       color: T.amber,    bg: "rgba(251,191,36,0.12)",  icon: <FiPauseCircle size={11} /> },
  completed:     { label: "Completed",     color: T.accent,   bg: "rgba(34,197,94,0.14)",   icon: <FiCheckCircle size={11} /> },
  rejected:      { label: "Rejected",      color: T.red,      bg: "rgba(248,113,113,0.12)", icon: <FiXCircle     size={11} /> },
  converted:     { label: "Converted",     color: T.violet,   bg: "rgba(167,139,250,0.14)", icon: <FiTrendingUp  size={11} /> },
  expired:       { label: "Expired",       color: T.red,      bg: "rgba(248,113,113,0.12)", icon: <FiAlertCircle size={11} /> },
  overdue:       { label: "Overdue",       color: T.redStrong,bg: "rgba(239,68,68,0.16)",   icon: <FiSlash       size={11} /> },
  delayed:       { label: "Delayed",       color: T.amber,    bg: "rgba(251,191,36,0.16)",  icon: <FiAlertTriangle size={11} /> },
  outsource:     { label: "Outsource",     color: T.amber,    bg: "rgba(251,191,36,0.12)",  icon: <FiGlobe       size={11} /> },
  pickup:        { label: "Pickup",        color: T.teal,     bg: "rgba(45,212,191,0.12)",  icon: <FiTruck       size={11} /> },
  sitevisit:     { label: "Site Visit",    color: T.violet,   bg: "rgba(167,139,250,0.12)", icon: <FiMap         size={11} /> },
};

const getStatusCfg = (status) =>
  STATUS_CONFIG[status] || { label: status || "Unknown", color: T.textDim, bg: "rgba(148,163,184,0.1)", icon: null };

const StatusBadge = ({ status, customLabel }) => {
  const cfg = getStatusCfg(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 10px",
      borderRadius: 20, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`, whiteSpace: "nowrap",
      fontFamily: T.fontSans, letterSpacing: "0.01em",
    }}>
      {cfg.icon} {customLabel || cfg.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const daysLeft = (validUntil) => {
  if (!validUntil) return null;
  const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000);
  return { diff, label: diff <= 0 ? "Expired" : `${diff}d left` };
};

const isJobOverdue = (job) => {
  if (!TERMINAL_STATUSES.has(job.job_status)) return false;
  return (job.balance_amount || 0) > 0;
};

const isJobDelayed = (job) => {
  if (TERMINAL_STATUSES.has(job.job_status)) return false;
  if (!job.estimated_delivery_date) return false;
  return new Date(job.estimated_delivery_date) < new Date();
};

const fmt = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const fmtDateTime = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const fmtHours = (since) => {
  if (!since) return null;
  const hrs = Math.floor((Date.now() - new Date(since)) / 3_600_000);
  if (hrs < 24) return `${hrs}h in stage`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h in stage`;
};

// ═══════════════════════════════════════════════════════════════════
// Stat Tile — glass card with left accent rail
// ═══════════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, accent, active, onClick, skeleton, sublabel }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset", cursor: "pointer", position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 14px", boxSizing: "border-box", width: "100%",
      background: active ? `${accent}1A` : T.card,
      border: `1px solid ${active ? `${accent}66` : T.borderSoft}`,
      borderRadius: 12, transition: "all 0.15s ease",
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.background = T.cardAlt; } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.background = T.card; } }}
  >
    <div style={{
      position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
      background: active ? accent : "transparent", transition: "background 0.15s",
    }} />
    <div style={{
      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
      background: `${accent}1F`, color: accent,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
    </div>
    <div style={{ textAlign: "left", minWidth: 0 }}>
      {skeleton
        ? <div style={{ width: 36, height: 20, background: T.borderSoft, borderRadius: 5, marginBottom: 4 }} />
        : <p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: T.text, lineHeight: 1, fontFamily: T.fontMono }}>{value}</p>
      }
      <p style={{ margin: "4px 0 0", fontSize: 10.5, color: T.textDim, lineHeight: 1.2, fontFamily: T.fontSans, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      {sublabel && (
        <p style={{ margin: "2px 0 0", fontSize: 9.5, color: accent, fontWeight: 600, fontFamily: T.fontSans }}>{sublabel}</p>
      )}
    </div>
  </button>
);

// ═══════════════════════════════════════════════════════════════════
// Job View Modal — slide-in glass drawer
// ═══════════════════════════════════════════════════════════════════

const ViewModal = ({ job, onClose }) => {
  if (!job) return null;
  const validity  = daysLeft(job.valid_until);
  const overdue   = isJobOverdue(job);
  const delayed   = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 22 }}>
      <p style={{
        margin: "0 0 11px", fontSize: 10, fontWeight: 700,
        color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em",
        paddingBottom: 7, borderBottom: `1px solid ${T.borderSoft}`, fontFamily: T.fontSans,
      }}>{title}</p>
      {children}
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div style={{ marginBottom: 9 }}>
      <span style={{ fontSize: 10.5, color: T.textFaint, fontFamily: T.fontSans }}>{label}</span>
      <p style={{
        margin: "2px 0 0", fontSize: 13, color: T.text, fontWeight: 500,
        fontFamily: mono ? T.fontMono : T.fontSans,
      }}>{value || "—"}</p>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(2,6,23,0.7)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          borderRadius: 16, width: "100%", maxWidth: 720,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          border: `1px solid ${T.border}`,
          background: T.card, fontFamily: T.fontSans,
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 22px", borderBottom: `1px solid ${T.borderSoft}`,
          position: "sticky", top: 0, background: T.card,
          zIndex: 1, borderRadius: "16px 16px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: T.fontMono, color: T.text }}>
              {job.job_no}
            </span>
            <StatusBadge status={job.job_status} />
            {overdue && <StatusBadge status="overdue" />}
            {!overdue && delayed && <StatusBadge status="delayed" />}
          </div>
          <button
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer", width: 32, height: 32,
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: T.cardAlt, color: T.textDim, border: `1px solid ${T.borderSoft}`,
            }}
          >
            <FiX size={16} />
          </button>
        </div>

        {(overdue || delayed) && (
          <div style={{
            padding: "11px 22px",
            background: overdue ? "rgba(239,68,68,0.1)" : "rgba(251,191,36,0.1)",
            borderBottom: `1px solid ${T.borderSoft}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <FiAlertTriangle size={14} color={overdue ? T.redStrong : T.amber} />
            <span style={{ fontSize: 12, fontWeight: 600, color: overdue ? T.red : T.amber }}>
              {overdue
                ? `Overdue — ₹${Number(job.balance_amount).toLocaleString("en-IN")} balance pending`
                : `Delayed — estimated delivery ${fmt(job.estimated_delivery_date)} has passed`}
            </span>
          </div>
        )}

        <div style={{ padding: "22px" }}>

          <Section title="Customer Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Field label="Customer Name" value={job.customer_name} />
              <Field label="Phone" value={job.customer_phone} mono />
              <Field label="Created by" value={typeof job.created_by === "object" ? job.created_by?.name : job.created_by} />
              <Field label="Company" value={job.company_name} />
            </div>
            {job.delivery_address && (
              <div style={{
                marginTop: 9, padding: "11px 14px", borderRadius: 10,
                background: T.cardAlt, border: `1px solid ${T.borderSoft}`,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <FiMapPin size={13} color={T.textFaint} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>
                  {[job.delivery_address.street, job.delivery_address.city,
                    job.delivery_address.state, job.delivery_address.pincode,
                    job.delivery_address.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </Section>

          {job.current_stage && (
            <Section title="Current Stage">
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "13px 14px", borderRadius: 10,
                background: T.cardAlt, border: `1px solid ${T.borderSoft}`,
              }}>
                <StatusBadge status={job.current_stage.stage} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {job.current_stage.assigned_to?.name && (
                    <p style={{ margin: 0, fontSize: 12, color: T.textDim, display: "flex", alignItems: "center", gap: 4 }}>
                      <FiUser size={11} /> {job.current_stage.assigned_to.name}
                      {job.current_stage.assigned_to.role && (
                        <span style={{ color: T.textFaint }}> · {job.current_stage.assigned_to.role}</span>
                      )}
                    </p>
                  )}
                  {job.current_stage.since && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textFaint, display: "flex", alignItems: "center", gap: 4 }}>
                      <FiClock size={10} /> Since {fmtDateTime(job.current_stage.since)}
                      {stageTime && <span> · {stageTime}</span>}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: 11, color: T.textDim, fontFamily: T.fontMono,
                  background: T.bg, padding: "2px 8px",
                  borderRadius: 8, border: `1px solid ${T.borderSoft}`,
                }}>
                  {job.current_stage.stage_action}
                </span>
              </div>
            </Section>
          )}

          {job.cart_items?.length > 0 && (
            <Section title={`Order Items (${job.cart_items.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {job.cart_items.map((item, i) => {
                  const categoryLabel =
                    item.item_category === "service_office" ? "Office Service" :
                    item.item_category === "service_labour" ? "Labour" : "Product";
                  const categoryColor =
                    item.item_category === "service_office" ? T.amber :
                    item.item_category === "service_labour" ? T.violet : T.blue;
                  const categoryBg =
                    item.item_category === "service_office" ? "rgba(251,191,36,0.12)" :
                    item.item_category === "service_labour" ? "rgba(167,139,250,0.12)" : "rgba(56,189,248,0.12)";
                  return (
                    <div key={i} style={{
                      padding: "11px 14px", borderRadius: 10,
                      background: T.cardAlt, border: `1px solid ${T.borderSoft}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: categoryColor, background: categoryBg, padding: "1px 7px", borderRadius: 12 }}>
                              {categoryLabel}
                            </span>
                            {item.office_type && (
                              <span style={{ fontSize: 10, color: T.textFaint }}>
                                {item.office_type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>
                            {item.product_name || "—"}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textFaint }}>
                            {[item.variation, item.printing_type, item.size].filter(Boolean).join(" · ")}
                          </p>
                          {item.item_category === "service_office" && (
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textFaint }}>
                              {item.days ? `${item.days} days` : ""}
                              {item.hours ? `${item.hours} hrs` : ""}
                              {item.reels_count ? `${item.reels_count} reels` : ""}
                              {item.post_count ? ` + ${item.post_count} posts` : ""}
                            </p>
                          )}
                          {item.item_category === "service_labour" && (
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textFaint }}>
                              {item.sq_ft ? `${item.sq_ft} ft²` : ""}
                              {item.hours ? ` · ${item.hours} hrs` : ""}
                            </p>
                          )}
                          {item.notes && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: T.textDim }}>
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 12 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.fontMono }}>
                            ₹{(item.line_total || 0).toLocaleString("en-IN")}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textFaint }}>
                            {item.quantity_type === "sq.ft" && item.sq_ft > 0
                              ? `${item.quantity} × ${item.sq_ft} ft²`
                              : `Qty: ${item.quantity}`}
                          </p>
                          {item.gst_percentage > 0 && (
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: T.amber }}>GST {item.gst_percentage}%</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="Workflow Progress">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Design",     status: job.design_status,     by: job.design_uploaded_by,    at: job.design_approved_at,    duration: job.design_duration_display },
                { label: "Production", status: job.production_status,  by: null,                      at: job.production_approved_at },
                { label: "QC",         status: job.qc_status,          by: job.qc_inspected_by,       at: null, notes: job.qc_notes, duration: job.qc_duration_display },
              ].map(({ label, status, by, at, notes, duration }) => {
                const isOk      = status === "approved" || status === "production_completed";
                const isPending = status === "pending" || !status;
                const color     = isOk ? T.accent : isPending ? T.amber : T.red;
                const bg        = isOk ? "rgba(34,197,94,0.1)" : isPending ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)";
                return (
                  <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${color}33` }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color }}>{status?.replace(/_/g, " ") || "—"}</p>
                    {by && <p style={{ margin: "2px 0 0", fontSize: 10, color }}>{by}</p>}
                    {at && <p style={{ margin: "2px 0 0", fontSize: 10, color: `${color}AA` }}>{fmt(at)}</p>}
                    {duration && duration !== "00:00:00" && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: `${color}AA`, fontFamily: T.fontMono }}>⏱ {duration}</p>
                    )}
                    {notes && <p style={{ margin: "4px 0 0", fontSize: 10, color }}>{notes}</p>}
                  </div>
                );
              })}
            </div>
          </Section>

          {(job.design_file || job.design_drive_link || job.productionimg) && (
            <Section title="Uploaded Files">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {job.design_file && (
                  <a href={job.design_file} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: `1px solid ${T.border}`, background: T.cardAlt,
                    color: T.textDim, fontSize: 12, textDecoration: "none",
                  }}>
                    <FiImage size={13} /> Design File
                  </a>
                )}
                {job.design_drive_link && (
                  <a href={job.design_drive_link} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: `1px solid ${T.border}`, background: T.cardAlt,
                    color: T.textDim, fontSize: 12, textDecoration: "none",
                  }}>
                    <FiFileText size={13} /> Drive Link
                  </a>
                )}
                {job.productionimg && (
                  <a href={job.productionimg} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: `1px solid ${T.border}`, background: T.cardAlt,
                    color: T.textDim, fontSize: 12, textDecoration: "none",
                  }}>
                    <FiImage size={13} /> Production Image
                  </a>
                )}
              </div>
            </Section>
          )}

          <Section title="Payment Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "7px 16px" }}>
              <Field label="Subtotal"        value={`₹${(job.subtotal || 0).toLocaleString("en-IN")}`} mono />
              <Field label="Grand Total"     value={`₹${(job.total_amount || 0).toLocaleString("en-IN")}`} mono />
              <Field label="Discount"        value={job.discount_amount ? `₹${job.discount_amount.toLocaleString("en-IN")} (${job.discount_percentage}%)` : "No discount"} mono />
              <Field label="Tax"             value={job.tax_amount ? `₹${job.tax_amount.toLocaleString("en-IN")}` : "No tax"} mono />
              <Field label="Payment Mode"    value={job.payment_mode} />
              <Field label="Amount Received" value={job.payment_amount ? `₹${Number(job.payment_amount).toLocaleString("en-IN")}` : "—"} mono />
              {job.balance_amount > 0 && (
                <Field label="Balance Due" value={`₹${Number(job.balance_amount).toLocaleString("en-IN")}`} mono />
              )}
              {job.next_due_date && (
                <Field label="Next Due Date" value={fmt(job.next_due_date)} />
              )}
              {job.gst_no && <Field label="GST No." value={job.gst_no} mono />}
            </div>
          </Section>

          <Section title="Dates">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "7px 16px" }}>
              <Field label="Order Date"   value={fmtDateTime(job.order_date)} />
              <Field label="Created At"   value={fmtDateTime(job.createdAt)} />
              <Field label="Est. Delivery" value={
                <span style={{ color: isJobDelayed(job) ? T.amber : T.text, fontWeight: isJobDelayed(job) ? 700 : 500 }}>
                  {fmt(job.estimated_delivery_date)}{isJobDelayed(job) ? " ⚠ Delayed" : ""}
                </span>
              } />
              <Field label="Valid Until" value={
                validity ? `${fmt(job.valid_until)} (${validity.label})` : fmt(job.valid_until)
              } />
            </div>
          </Section>

          {(job.notes || job.terms_and_conditions) && (
            <Section title="Notes & Terms">
              {job.notes && <Field label="Notes" value={job.notes} />}
              {job.terms_and_conditions && <Field label="Terms" value={job.terms_and_conditions} />}
            </Section>
          )}

        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Desktop table row
// ═══════════════════════════════════════════════════════════════════

const COLS = "100px 1fr 130px 140px 100px 80px 40px";

const JobRow = ({ job, onView }) => {
  const stage     = job.current_stage;
  const validity  = daysLeft(job.valid_until);
  const overdue   = isJobOverdue(job);
  const delayed   = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  const rowBg = overdue ? "rgba(239,68,68,0.06)" : delayed ? "rgba(251,191,36,0.06)" : "transparent";

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: COLS,
        alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: `1px solid ${T.borderSoft}`,
        transition: "background 0.1s", cursor: "default",
        background: rowBg, fontFamily: T.fontSans,
        borderLeft: overdue ? `3px solid ${T.redStrong}` : delayed ? `3px solid ${T.amber}` : "3px solid transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = overdue ? "rgba(239,68,68,0.12)" : delayed ? "rgba(251,191,36,0.1)" : T.cardAlt}
      onMouseLeave={e => e.currentTarget.style.background = rowBg}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {(overdue || delayed) && (
          <FiAlertTriangle size={12} color={overdue ? T.redStrong : T.amber} style={{ flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: T.fontMono, color: T.text }}>
          {job.job_no}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.customer_name || "—"}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: T.textFaint }}>
          By: {typeof job.created_by === "object" ? job.created_by?.name : job.created_by || "—"}
        </p>
      </div>

      <div>
        {stage?.stage_label
          ? (
            <div>
              <StatusBadge status={stage.stage} />
              {stageTime && (
                <p style={{ margin: "2px 0 0", fontSize: 9, color: T.textFaint, fontFamily: T.fontMono }}>
                  {stageTime}
                </p>
              )}
            </div>
          )
          : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        }
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <StatusBadge status={job.job_status} />
        {overdue && <StatusBadge status="overdue" />}
        {!overdue && delayed && <StatusBadge status="delayed" />}
      </div>

      <span style={{ fontSize: 12, color: T.textDim, textAlign: "right", fontFamily: T.fontMono }}>
        ₹{(job.total_amount || 0).toLocaleString("en-IN")}
      </span>

      <span style={{
        fontSize: 11, fontWeight: 500, textAlign: "right", fontFamily: T.fontMono,
        color: !validity ? T.textFaint
          : validity.diff <= 0 ? T.red
          : validity.diff <= 2 ? T.amber
          : T.textFaint,
      }}>
        {validity?.label || "—"}
      </span>

      <button
        onClick={() => onView(job)}
        title="View details"
        style={{
          all: "unset", cursor: "pointer", width: 28, height: 28,
          borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
          color: T.textFaint, border: `1px solid ${T.borderSoft}`,
          transition: "all 0.12s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(56,189,248,0.14)";
          e.currentTarget.style.color = T.blue;
          e.currentTarget.style.borderColor = `${T.blue}55`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.textFaint;
          e.currentTarget.style.borderColor = T.borderSoft;
        }}
      >
        <FiEye size={13} />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Mobile card
// ═══════════════════════════════════════════════════════════════════

const JobCard = ({ job, onView }) => {
  const stage     = job.current_stage;
  const validity  = daysLeft(job.valid_until);
  const overdue   = isJobOverdue(job);
  const delayed   = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  return (
    <div style={{
      background: overdue ? "rgba(239,68,68,0.07)" : delayed ? "rgba(251,191,36,0.07)" : T.card,
      border: `1px solid ${overdue ? `${T.redStrong}40` : delayed ? `${T.amber}40` : T.borderSoft}`,
      borderLeft: `3px solid ${overdue ? T.redStrong : delayed ? T.amber : "transparent"}`,
      borderRadius: 12, padding: "13px 14px", marginBottom: 10, fontFamily: T.fontSans,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {(overdue || delayed) && (
            <FiAlertTriangle size={12} color={overdue ? T.redStrong : T.amber} />
          )}
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: T.fontMono, color: T.text }}>
            {job.job_no}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusBadge status={job.job_status} />
          <button
            onClick={() => onView(job)}
            style={{
              all: "unset", cursor: "pointer", width: 26, height: 26,
              borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(56,189,248,0.14)", color: T.blue,
            }}
          >
            <FiEye size={12} />
          </button>
        </div>
      </div>

      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500, color: T.text }}>
        {job.customer_name || "—"}
      </p>
      <p style={{ margin: "0 0 7px", fontSize: 10, color: T.textFaint }}>
        By: {typeof job.created_by === "object" ? job.created_by?.name : job.created_by || "—"}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {stage?.stage && <StatusBadge status={stage.stage} />}
        {overdue && <StatusBadge status="overdue" />}
        {!overdue && delayed && <StatusBadge status="delayed" />}
      </div>

      {stageTime && (
        <p style={{ margin: "5px 0 0", fontSize: 10, color: T.textFaint, fontFamily: T.fontMono }}>
          ⏱ {stageTime}
        </p>
      )}

      {delayed && (
        <p style={{ margin: "5px 0 0", fontSize: 10, color: T.amber, fontWeight: 600 }}>
          ⚠ Estimated delivery {fmt(job.estimated_delivery_date)} has passed
        </p>
      )}

      <div style={{
        marginTop: 11, paddingTop: 9,
        borderTop: `1px solid ${T.borderSoft}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.textDim, fontFamily: T.fontMono }}>
          ₹{(job.total_amount || 0).toLocaleString("en-IN")}
        </span>
        {validity && (
          <span style={{
            fontSize: 11, fontWeight: 500, fontFamily: T.fontMono,
            color: validity.diff <= 0 ? T.red : validity.diff <= 2 ? T.amber : T.textFaint,
          }}>
            {validity.label}
          </span>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Stage breakdown (super admin)
// ═══════════════════════════════════════════════════════════════════

const STAGE_ACCENT = {
  design:        T.violet,
  production:    T.blue,
  quality_check: T.amber,
  delivery:      T.teal,
};

const StageBreakdown = ({ allJobs }) => (
  <div style={{ marginTop: 24 }}>
    <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.fontSans }}>
      Active by stage
    </p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {["design", "production", "quality_check", "delivery"].map(stage => {
        const accent   = STAGE_ACCENT[stage] || T.textDim;
        const active   = allJobs.filter(j => j.current_stage?.stage === stage && j.job_status === stage).length;
        const assigned = allJobs.filter(j => j.current_stage?.stage === stage).length;
        const label    = getStatusCfg(stage).label;
        return (
          <div key={stage} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 16px", flex: "1 1 150px",
            background: T.card, border: `1px solid ${T.borderSoft}`, borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: accent, flexShrink: 0, boxShadow: `0 0 8px ${accent}AA` }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: T.textFaint, fontFamily: T.fontSans }}>{label}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text, lineHeight: 1.3, fontFamily: T.fontMono }}>
                {active}
                <span style={{ fontSize: 11, fontWeight: 400, color: T.textFaint, marginLeft: 4, fontFamily: T.fontSans }}>
                  / {assigned} assigned
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// Error banner
// ═══════════════════════════════════════════════════════════════════

const ErrorBanner = ({ message, onRetry }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, padding: "13px 16px", marginBottom: 18,
    background: "rgba(239,68,68,0.1)", border: `1px solid ${T.redStrong}40`, borderRadius: 10,
    flexWrap: "wrap", fontFamily: T.fontSans,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <FiWifiOff size={15} color={T.redStrong} />
      <span style={{ fontSize: 13, color: T.red, fontWeight: 500 }}>{message}</span>
    </div>
    <button
      onClick={onRetry}
      style={{
        all: "unset", cursor: "pointer", fontSize: 12, color: T.red,
        border: `1px solid ${T.redStrong}55`, padding: "4px 12px", borderRadius: 8,
        display: "flex", alignItems: "center", gap: 5,
      }}
    >
      <FiRefreshCw size={12} /> Retry
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════════════

export default function Dashboard() {
  useEffect(() => { injectFonts(); }, []);

  const token   = localStorage.getItem("admintoken") || "";
  const baseURL = "https://api.dmedia.in/api";
  const { user } = useSelector((state) => state.authSlice);

  const isSuperAdmin =
    user.role === "super admin" ||
    SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase().trim());

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [sortAsc, setSortAsc]   = useState(false);
  const [viewJob, setViewJob]   = useState(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const intervalRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData({
        baseURL, token, userId: user._id, user, isSuperAdmin,
      });
      setData(result);
    } catch (err) {
      const msg = err.message || "Failed to load. Check your connection.";
      setError(msg);
      if (!silent) {
        notification.error({ message: "Dashboard error", description: msg, placement: "topRight", duration: 4 });
      }
    } finally {
      setLoading(false);
    }
  }, [baseURL, token, user._id, user, isSuperAdmin]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setViewJob(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Derived values ──────────────────────────────────────────────
  const todayStr    = new Date().toISOString().slice(0, 10);
  const allJobs     = data?.allJobs     || [];
  const myJobs      = data?.myJobs      || [];
  const expiryToday = data?.expiryToday || [];

  const pool = isSuperAdmin ? allJobs : myJobs;

  const todayCreated   = myJobs.filter(j => j.createdAt?.slice(0, 10) === todayStr);
  const designJobs     = pool.filter(j => j.job_status === "design");
  const productionJobs = pool.filter(j => j.job_status === "production");
  const qcJobs         = pool.filter(j => j.job_status === "quality_check");
  const deliveryJobs   = pool.filter(j => j.job_status === "delivery");
  const completedJobs  = pool.filter(j => j.job_status === "completed");
  const inProgressJobs = pool.filter(j => j.job_status === "in_progress");
  const onHoldJobs     = pool.filter(j => j.job_status === "on_hold");
  const outsourceJobs  = pool.filter(j => j.job_status === "outsource");
  const pickupJobs     = pool.filter(j => j.job_status === "pickup");
  const sitevisitJobs  = pool.filter(j => j.job_status === "sitevisit");

  const overdueJobs    = pool.filter(isJobOverdue);
  const delayedJobs    = pool.filter(isJobDelayed);

  const myExpiryToday = expiryToday.filter(j => pool.some(pj => pj._id === j._id));

  // ── Stats rows ──────────────────────────────────────────────────
  const STATS_PIPELINE = [
    { key: "all",           accent: T.blue,   icon: <FiBriefcase   size={16} />, label: isSuperAdmin ? "Total Jobs" : "My Jobs",  value: pool.length },
    { key: "today",         accent: T.violet, icon: <FiCalendar    size={16} />, label: "Created Today",  value: todayCreated.length    },
    { key: "design",        accent: T.violet, icon: <FiEdit3       size={16} />, label: "Design",         value: designJobs.length      },
    { key: "production",    accent: T.blue,   icon: <FiPackage     size={16} />, label: "Production",     value: productionJobs.length  },
    { key: "quality_check", accent: T.amber,  icon: <FiShield      size={16} />, label: "Quality Check",  value: qcJobs.length          },
    { key: "completed",     accent: T.accent, icon: <FiCheckCircle size={16} />, label: "Completed",      value: completedJobs.length   },
  ];

  const STATS_ALERTS = [
    {
      key: "overdue", accent: T.redStrong, icon: <FiSlash size={16} />, label: "Overdue",
      sublabel: overdueJobs.length > 0 ? "Payment pending for closed jobs" : null, value: overdueJobs.length,
    },
    {
      key: "delayed", accent: T.amber, icon: <FiAlertTriangle size={16} />, label: "Delayed",
      sublabel: delayedJobs.length > 0 ? "Est. delivery date passed" : null, value: delayedJobs.length,
    },
    {
      key: "expiry", accent: T.amber, icon: <FiAlertCircle size={16} />, label: "Expiring Today",
      sublabel: myExpiryToday.length > 0 ? "Validity ends today" : null, value: myExpiryToday.length,
    },
    {
      key: "on_hold", accent: T.amber, icon: <FiPauseCircle size={16} />, label: "On Hold",
      sublabel: null, value: onHoldJobs.length,
    },
  ];

  const STATS_EXTRA = [
    { key: "outsource", accent: T.amber,  icon: <FiGlobe size={16} />, label: "Outsource", value: outsourceJobs.length },
    { key: "pickup",    accent: T.teal,   icon: <FiTruck size={16} />, label: "Pickup",    value: pickupJobs.length },
    { key: "sitevisit", accent: T.violet, icon: <FiMap   size={16} />, label: "Site Visit", value: sitevisitJobs.length },
  ];

  // ── Filter → search → sort ──────────────────────────────────────
  let displayJobs = (() => {
    switch (filter) {
      case "today":         return todayCreated;
      case "expiry":        return myExpiryToday;
      case "design":        return designJobs;
      case "production":    return productionJobs;
      case "quality_check": return qcJobs;
      case "delivery":      return deliveryJobs;
      case "completed":     return completedJobs;
      case "in_progress":   return inProgressJobs;
      case "on_hold":       return onHoldJobs;
      case "overdue":       return overdueJobs;
      case "delayed":       return delayedJobs;
      case "outsource":     return outsourceJobs;
      case "pickup":        return pickupJobs;
      case "sitevisit":     return sitevisitJobs;
      default:              return pool;
    }
  })();

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    displayJobs = displayJobs.filter(j =>
      j.job_no?.toLowerCase().includes(q) ||
      j.customer_name?.toLowerCase().includes(q) ||
      j.current_stage?.assigned_to?.name?.toLowerCase().includes(q)
    );
  }

  displayJobs = [...displayJobs].sort((a, b) => {
    const aScore = isJobOverdue(a) ? 2 : isJobDelayed(a) ? 1 : 0;
    const bScore = isJobOverdue(b) ? 2 : isJobDelayed(b) ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    const da = new Date(a.createdAt), db = new Date(b.createdAt);
    return sortAsc ? da - db : db - da;
  });

  const filterLabel = (() => {
    const map = {
      all:       isSuperAdmin ? "All Jobs" : "My Jobs",
      today:     "Created Today",
      expiry:    "Expiring Today",
      overdue:   "Overdue Jobs",
      delayed:   "Delayed Jobs",
      on_hold:   "On Hold",
      outsource: "Outsource",
      pickup:    "Pickup",
      sitevisit: "Site Visit",
    };
    return map[filter] || getStatusCfg(filter).label;
  })();

  const alertCount = overdueJobs.length + delayedJobs.length;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{
      background: T.bg, minHeight: "100%",
      padding: isMobile ? "16px 10px 40px" : "26px 30px 50px",
      fontFamily: T.fontSans,
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 20, flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 23, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
              Job Dashboard
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textFaint, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ position: "relative", width: 8, height: 8, display: "inline-flex" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: T.accent, animation: "dmedia-pulse 2s infinite" }} />
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: T.accent }} />
              </span>
              {isSuperAdmin ? "Super admin — all jobs" : `Jobs by ${user.name}`}
              {" · "}
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              all: "unset", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: T.textDim,
              border: `1px solid ${T.border}`,
              padding: "8px 15px", borderRadius: 9,
              background: T.card, opacity: loading ? 0.6 : 1,
            }}
          >
            <FiRefreshCw size={13} style={{ animation: loading ? "dmedia-spin 1s linear infinite" : "none" }} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => load()} />}

        {!loading && (alertCount > 0 || myExpiryToday.length > 0) && (
          <div style={{
            padding: "13px 16px", marginBottom: 18,
            background: alertCount > 0 ? "rgba(239,68,68,0.08)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${alertCount > 0 ? `${T.redStrong}40` : `${T.amber}40`}`,
            borderRadius: 12, display: "flex", flexDirection: "column", gap: 9,
          }}>
            {overdueJobs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <FiSlash size={14} color={T.redStrong} />
                <span style={{ fontSize: 13, color: T.red, fontWeight: 600 }}>
                  {overdueJobs.length} overdue job{overdueJobs.length > 1 ? "s" : ""} (closed with pending payment) —
                </span>
                <span style={{ fontSize: 12, color: T.red, fontFamily: T.fontMono }}>
                  {overdueJobs.slice(0, 4).map(j => j.job_no).join(", ")}{overdueJobs.length > 4 ? ` +${overdueJobs.length - 4} more` : ""}
                </span>
                <button onClick={() => setFilter("overdue")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: T.red, border: `1px solid ${T.redStrong}55`, padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                  View
                </button>
              </div>
            )}
            {delayedJobs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <FiAlertTriangle size={14} color={T.amber} />
                <span style={{ fontSize: 13, color: T.amber, fontWeight: 600 }}>
                  {delayedJobs.length} delayed job{delayedJobs.length > 1 ? "s" : ""} (estimated delivery passed) —
                </span>
                <span style={{ fontSize: 12, color: T.amber, fontFamily: T.fontMono }}>
                  {delayedJobs.slice(0, 4).map(j => j.job_no).join(", ")}{delayedJobs.length > 4 ? ` +${delayedJobs.length - 4} more` : ""}
                </span>
                <button onClick={() => setFilter("delayed")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: T.amber, border: `1px solid ${T.amber}55`, padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                  View
                </button>
              </div>
            )}
            {myExpiryToday.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <FiCalendar size={14} color={T.amber} />
                <span style={{ fontSize: 13, color: T.amber, fontWeight: 600 }}>
                  {myExpiryToday.length} job{myExpiryToday.length > 1 ? "s" : ""} expiring today —
                </span>
                <span style={{ fontSize: 12, color: T.amber, fontFamily: T.fontMono }}>
                  {myExpiryToday.slice(0, 4).map(j => j.job_no).join(", ")}{myExpiryToday.length > 4 ? ` +${myExpiryToday.length - 4} more` : ""}
                </span>
                <button onClick={() => setFilter("expiry")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: T.amber, border: `1px solid ${T.amber}55`, padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                  View
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Pipeline stats ── */}
        <p style={{ margin: "0 0 9px", fontSize: 10.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Pipeline
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)",
          gap: isMobile ? 8 : 10, marginBottom: 16,
        }}>
          {STATS_PIPELINE.map(s => (
            <StatCard
              key={s.key} icon={s.icon} label={s.label} value={s.value} accent={s.accent}
              active={filter === s.key} skeleton={loading && !data}
              onClick={() => setFilter(prev => prev === s.key ? "all" : s.key)}
            />
          ))}
        </div>

        {/* ── Alert stats ── */}
        <p style={{ margin: "0 0 9px", fontSize: 10.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Alerts & Hold
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 8 : 10, marginBottom: 16,
        }}>
          {STATS_ALERTS.map(s => (
            <StatCard
              key={s.key} icon={s.icon} label={s.label} sublabel={s.sublabel} value={s.value} accent={s.accent}
              active={filter === s.key} skeleton={loading && !data}
              onClick={() => setFilter(prev => prev === s.key ? "all" : s.key)}
            />
          ))}
        </div>

        {/* ── Additional Statuses ── */}
        <p style={{ margin: "0 0 9px", fontSize: 10.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Additional Statuses
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 8 : 10, marginBottom: 24,
        }}>
          {STATS_EXTRA.map(s => (
            <StatCard
              key={s.key} icon={s.icon} label={s.label} value={s.value} accent={s.accent}
              active={filter === s.key} skeleton={loading && !data}
              onClick={() => setFilter(prev => prev === s.key ? "all" : s.key)}
            />
          ))}
        </div>

        {/* Jobs table */}
        <div style={{
          background: T.card, border: `1px solid ${T.borderSoft}`,
          borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "13px 15px", borderBottom: `1px solid ${T.borderSoft}`,
            gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FiFilter size={13} color={T.textFaint} />
              <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                {filterLabel}
              </span>
              <span style={{
                fontSize: 11, background: T.cardAlt, color: T.textDim,
                padding: "1px 9px", borderRadius: 20, fontFamily: T.fontMono,
              }}>
                {displayJobs.length}
              </span>
              {filter !== "all" && (
                <button
                  onClick={() => setFilter("all")}
                  style={{ all: "unset", cursor: "pointer", fontSize: 11, color: T.textFaint, display: "flex", alignItems: "center", gap: 3 }}
                >
                  Clear <FiXCircle size={11} />
                </button>
              )}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 11px",
              background: T.bgSubtle,
            }}>
              <FiSearch size={13} color={T.textFaint} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search job no, customer…"
                style={{
                  all: "unset", fontSize: 12, color: T.text,
                  width: isMobile ? 110 : 190, fontFamily: T.fontSans,
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ all: "unset", cursor: "pointer", display: "flex" }}>
                  <FiXCircle size={12} color={T.textFaint} />
                </button>
              )}
            </div>
          </div>

          {!isMobile && (
            <div style={{
              display: "grid", gridTemplateColumns: COLS,
              gap: 8, padding: "9px 16px",
              background: T.bgSubtle, borderBottom: `1px solid ${T.borderSoft}`,
            }}>
              {[
                { label: "Job No."            },
                { label: "Customer / Creator"   },
                { label: "Stage / Time"         },
                { label: "Status"               },
                { label: "Amount"               },
                { label: "Validity", sortable: true },
                { label: ""                     },
              ].map((h, i) => (
                <span
                  key={i}
                  onClick={h.sortable ? () => setSortAsc(v => !v) : undefined}
                  style={{
                    fontSize: 10, fontWeight: 600, color: T.textFaint,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    display: "flex", alignItems: "center", gap: 3,
                    cursor: h.sortable ? "pointer" : "default",
                  }}
                >
                  {h.label}
                  {h.sortable && (sortAsc ? <FiChevronUp size={10} /> : <FiChevronDown size={10} />)}
                </span>
              ))}
            </div>
          )}

          <div style={{ maxHeight: 540, overflowY: "auto" }}>
            {loading && !data
              ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 14 }}>
                  <Spin size="large" />
                  <p style={{ fontSize: 13, color: T.textFaint, margin: 0 }}>Connecting to server…</p>
                </div>
              )
              : displayJobs.length === 0
              ? <div style={{ padding: "50px 0" }}><Empty description={<span style={{ color: T.textFaint }}>No jobs found</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
              : displayJobs.map(job =>
                  isMobile
                    ? <div key={job._id} style={{ padding: "0 10px" }}>
                        <JobCard job={job} onView={setViewJob} />
                      </div>
                    : <JobRow key={job._id} job={job} onView={setViewJob} />
                )
            }
          </div>

          {displayJobs.length > 0 && (
            <div style={{
              padding: "10px 16px", borderTop: `1px solid ${T.borderSoft}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: T.textFaint }}>
                {displayJobs.length} job{displayJobs.length !== 1 ? "s" : ""}
                {search ? ` matching "${search}"` : ""}
                {filter !== "all" ? ` · ${filterLabel}` : ""}
              </span>
              <span style={{ fontSize: 11, color: T.textFaint }}>
                Auto-refreshes every 60s
              </span>
            </div>
          )}
        </div>

        {isSuperAdmin && !loading && data && <StageBreakdown allJobs={allJobs} />}

        {viewJob && <ViewModal job={viewJob} onClose={() => setViewJob(null)} />}

        <style>{`
          @keyframes dmedia-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes dmedia-pulse {
            0% { transform: scale(1); opacity: 0.7; }
            70% { transform: scale(2.2); opacity: 0; }
            100% { transform: scale(2.2); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}