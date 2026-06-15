import { useState, useEffect, useCallback, useRef } from "react";
import {
  FiBriefcase, FiCheckCircle, FiAlertCircle, FiUser,
  FiTrendingUp, FiCalendar, FiFilter, FiRefreshCw,
  FiXCircle, FiPauseCircle, FiEdit3, FiZap, FiAlertTriangle,
  FiWifi, FiWifiOff, FiChevronDown, FiChevronUp, FiSearch,
  FiEye, FiX, FiPackage, FiTruck, FiShield, FiPhone,
  FiMapPin, FiClock, FiDollarSign, FiFileText, FiImage,
  FiSlash, FiActivity,
} from "react-icons/fi";
import { Spin, Empty, notification } from "antd";
import { useSelector } from "react-redux";

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
// Status & Stage Configs
// ═══════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  draft:         { label: "Draft",         color: "#5F5E5A", bg: "#F1EFE8", icon: <FiEdit3       size={11} /> },
  accepted:      { label: "Accepted",      color: "#185FA5", bg: "#E6F1FB", icon: <FiCheckCircle size={11} /> },
  design:        { label: "Design",        color: "#7C3AED", bg: "#EDE9FE", icon: <FiEdit3       size={11} /> },
  in_progress:   { label: "In Progress",   color: "#3B6D11", bg: "#EAF3DE", icon: <FiZap         size={11} /> },
  production:    { label: "Production",    color: "#0369A1", bg: "#E0F2FE", icon: <FiPackage     size={11} /> },
  quality_check: { label: "Quality Check", color: "#B45309", bg: "#FEF3C7", icon: <FiShield      size={11} /> },
  delivery:      { label: "Delivery",      color: "#0F6E56", bg: "#ECFDF5", icon: <FiTruck       size={11} /> },
  on_hold:       { label: "On Hold",       color: "#BA7517", bg: "#FAEEDA", icon: <FiPauseCircle size={11} /> },
  completed:     { label: "Completed",     color: "#047857", bg: "#D1FAE5", icon: <FiCheckCircle size={11} /> },
  rejected:      { label: "Rejected",      color: "#A32D2D", bg: "#FCEBEB", icon: <FiXCircle     size={11} /> },
  converted:     { label: "Converted",     color: "#534AB7", bg: "#EEEDFE", icon: <FiTrendingUp  size={11} /> },
  expired:       { label: "Expired",       color: "#993C1D", bg: "#FAECE7", icon: <FiAlertCircle size={11} /> },
  overdue:       { label: "Overdue",       color: "#9B1C1C", bg: "#FEE2E2", icon: <FiSlash       size={11} /> },
  delayed:       { label: "Delayed",       color: "#92400E", bg: "#FEF3C7", icon: <FiAlertTriangle size={11} /> },
};

const getStatusCfg = (status) =>
  STATUS_CONFIG[status] || { label: status || "Unknown", color: "#888", bg: "#F3F4F6", icon: null };

const StatusBadge = ({ status, customLabel }) => {
  const cfg = getStatusCfg(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 9px",
      borderRadius: 20, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`, whiteSpace: "nowrap",
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

// A job is "overdue" when estimated_delivery_date is in the past and not completed/rejected/delivered
const TERMINAL_STATUSES = new Set(["completed", "rejected", "converted", "delivery"]);

const isJobOverdue = (job) => {
  if (!job.estimated_delivery_date) return false;
  if (TERMINAL_STATUSES.has(job.job_status)) return false;
  return new Date(job.estimated_delivery_date) < new Date();
};

// A job is "delayed" when it's been in the same stage for more than 2 days (48 hrs)
const DELAYED_HOURS = 48;
const isJobDelayed = (job) => {
  if (TERMINAL_STATUSES.has(job.job_status)) return false;
  if (!job.current_stage?.since) return false;
  const hoursInStage = (Date.now() - new Date(job.current_stage.since)) / 3_600_000;
  return hoursInStage > DELAYED_HOURS;
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
// Stat Card
// ═══════════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, accent, active, onClick, skeleton, sublabel }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
      gap: 8, padding: "14px 16px", boxSizing: "border-box", width: "100%",
      background: active ? `${accent}14` : "var(--color-background-primary)",
      border: `1.5px solid ${active ? accent : "var(--color-border-tertiary)"}`,
      borderRadius: 14, transition: "border-color 0.15s, background 0.15s",
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${accent}88`; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--color-border-tertiary)"; }}
  >
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      background: `${accent}22`, color: accent,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
    </div>
    <div>
      {skeleton
        ? <div style={{ width: 40, height: 24, background: "var(--color-background-secondary)", borderRadius: 6, marginBottom: 4 }} />
        : <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>{value}</p>
      }
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.3 }}>{label}</p>
      {sublabel && (
        <p style={{ margin: "2px 0 0", fontSize: 10, color: accent, fontWeight: 600 }}>{sublabel}</p>
      )}
    </div>
  </button>
);

// ═══════════════════════════════════════════════════════════════════
// Job View Modal
// ═══════════════════════════════════════════════════════════════════

const ViewModal = ({ job, onClose }) => {
  if (!job) return null;
  const validity  = daysLeft(job.valid_until);
  const overdue   = isJobOverdue(job);
  const delayed   = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <p style={{
        margin: "0 0 10px", fontSize: 10, fontWeight: 700,
        color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em",
        paddingBottom: 6, borderBottom: "0.5px solid var(--color-border-tertiary)",
      }}>{title}</p>
      {children}
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{label}</span>
      <p style={{
        margin: "2px 0 0", fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500,
        fontFamily: mono ? "monospace" : "inherit",
      }}>{value || "—"}</p>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        className="text-black bg-white"
        onClick={e => e.stopPropagation()}
        style={{
          borderRadius: 18, width: "100%", maxWidth: 700,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          border: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)",
          position: "sticky", top: 0, background: "var(--color-background-primary)",
          zIndex: 1, borderRadius: "18px 18px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-primary)" }}>
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
              background: "var(--color-background-secondary)", color: "var(--color-text-secondary)",
            }}
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Overdue / Delayed alert strip */}
        {(overdue || delayed) && (
          <div style={{
            padding: "10px 20px",
            background: overdue ? "#FEE2E2" : "#FEF3C7",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <FiAlertTriangle size={14} color={overdue ? "#9B1C1C" : "#92400E"} />
            <span style={{ fontSize: 12, fontWeight: 600, color: overdue ? "#9B1C1C" : "#92400E" }}>
              {overdue
                ? `Overdue — delivery was due ${fmt(job.estimated_delivery_date)}`
                : `Delayed — ${stageTime} (over ${DELAYED_HOURS}h threshold)`}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: "20px 20px" }}>

          {/* Customer */}
          <Section title="Customer Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Field label="Customer Name" value={job.customer_name} />
              <Field label="Phone" value={job.customer_phone} />
              <Field label="Created by" value={typeof job.created_by === "object" ? job.created_by?.name : job.created_by} />
              <Field label="Company" value={job.company_name} />
            </div>
            {job.delivery_address && (
              <div style={{
                marginTop: 8, padding: "10px 14px", borderRadius: 10,
                background: "var(--color-background-secondary)",
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <FiMapPin size={13} color="var(--color-text-tertiary)" style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  {[job.delivery_address.street, job.delivery_address.city,
                    job.delivery_address.state, job.delivery_address.pincode,
                    job.delivery_address.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </Section>

          {/* Current Stage */}
          {job.current_stage && (
            <Section title="Current Stage">
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
              }}>
                <StatusBadge status={job.current_stage.stage} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {job.current_stage.assigned_to?.name && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <FiUser size={11} /> {job.current_stage.assigned_to.name}
                      {job.current_stage.assigned_to.role && (
                        <span style={{ color: "var(--color-text-tertiary)" }}> · {job.current_stage.assigned_to.role}</span>
                      )}
                    </p>
                  )}
                  {job.current_stage.since && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <FiClock size={10} /> Since {fmtDateTime(job.current_stage.since)}
                      {stageTime && <span style={{ color: delayed ? "#92400E" : "var(--color-text-tertiary)", fontWeight: delayed ? 700 : 400 }}> · {stageTime}</span>}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: 11, color: "var(--color-text-tertiary)",
                  background: "var(--color-background-primary)", padding: "2px 8px",
                  borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)",
                }}>
                  {job.current_stage.stage_action}
                </span>
              </div>
            </Section>
          )}

          {/* Order Items */}
          {job.cart_items?.length > 0 && (
            <Section title={`Order Items (${job.cart_items.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {job.cart_items.map((item, i) => {
                  const categoryLabel =
                    item.item_category === "service_office" ? "Office Service" :
                    item.item_category === "service_labour" ? "Labour" : "Product";
                  const categoryColor =
                    item.item_category === "service_office" ? "#92400E" :
                    item.item_category === "service_labour" ? "#6B21A8" : "#1E40AF";
                  const categoryBg =
                    item.item_category === "service_office" ? "#FEF3C7" :
                    item.item_category === "service_labour" ? "#F3E8FF" : "#EFF6FF";
                  return (
                    <div key={i} style={{
                      padding: "10px 14px", borderRadius: 10,
                      background: "var(--color-background-secondary)",
                      border: "0.5px solid var(--color-border-tertiary)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: categoryColor, background: categoryBg, padding: "1px 7px", borderRadius: 12 }}>
                              {categoryLabel}
                            </span>
                            {item.office_type && (
                              <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                                {item.office_type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {item.product_name || "—"}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                            {[item.variation, item.printing_type, item.size].filter(Boolean).join(" · ")}
                          </p>
                          {item.item_category === "service_office" && (
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                              {item.days ? `${item.days} days` : ""}
                              {item.hours ? `${item.hours} hrs` : ""}
                              {item.reels_count ? `${item.reels_count} reels` : ""}
                              {item.post_count ? ` + ${item.post_count} posts` : ""}
                            </p>
                          )}
                          {item.item_category === "service_labour" && (
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                              {item.sq_ft ? `${item.sq_ft} ft²` : ""}
                              {item.hours ? ` · ${item.hours} hrs` : ""}
                            </p>
                          )}
                          {item.notes && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 12 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                            ₹{(item.line_total || 0).toLocaleString("en-IN")}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                            {item.quantity_type === "sq.ft" && item.sq_ft > 0
                              ? `${item.quantity} × ${item.sq_ft} ft²`
                              : `Qty: ${item.quantity}`}
                          </p>
                          {item.gst_percentage > 0 && (
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#D97706" }}>GST {item.gst_percentage}%</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Workflow Status */}
          <Section title="Workflow Progress">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Design",     status: job.design_status,     by: job.design_uploaded_by,    at: job.design_approved_at,    duration: job.design_duration_display },
                { label: "Production", status: job.production_status,  by: null,                      at: job.production_approved_at },
                { label: "QC",         status: job.qc_status,          by: job.qc_inspected_by,       at: null, notes: job.qc_notes, duration: job.qc_duration_display },
              ].map(({ label, status, by, at, notes, duration }) => {
                const isOk      = status === "approved" || status === "production_completed";
                const isPending = status === "pending" || !status;
                const color     = isOk ? "#047857" : isPending ? "#BA7517" : "#A32D2D";
                const bg        = isOk ? "#D1FAE5" : isPending ? "#FEF3C7" : "#FCEBEB";
                return (
                  <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${color}22` }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color }}>{status?.replace(/_/g, " ") || "—"}</p>
                    {by && <p style={{ margin: "2px 0 0", fontSize: 10, color }}>{by}</p>}
                    {at && <p style={{ margin: "2px 0 0", fontSize: 10, color: `${color}99` }}>{fmt(at)}</p>}
                    {duration && duration !== "00:00:00" && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: `${color}99` }}>⏱ {duration}</p>
                    )}
                    {notes && <p style={{ margin: "4px 0 0", fontSize: 10, color }}>{notes}</p>}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Media Files */}
          {(job.design_file || job.design_drive_link || job.productionimg) && (
            <Section title="Uploaded Files">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {job.design_file && (
                  <a href={job.design_file} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: "0.5px solid var(--color-border-secondary)",
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-secondary)", fontSize: 12, textDecoration: "none",
                  }}>
                    <FiImage size={13} /> Design File
                  </a>
                )}
                {job.design_drive_link && (
                  <a href={job.design_drive_link} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: "0.5px solid var(--color-border-secondary)",
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-secondary)", fontSize: 12, textDecoration: "none",
                  }}>
                    <FiFileText size={13} /> Drive Link
                  </a>
                )}
                {job.productionimg && (
                  <a href={job.productionimg} target="_blank" rel="noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 8, border: "0.5px solid var(--color-border-secondary)",
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-secondary)", fontSize: 12, textDecoration: "none",
                  }}>
                    <FiImage size={13} /> Production Image
                  </a>
                )}
              </div>
            </Section>
          )}

          {/* Payment */}
          <Section title="Payment Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
              <Field label="Subtotal"          value={`₹${(job.subtotal || 0).toLocaleString("en-IN")}`} />
              <Field label="Grand Total"        value={`₹${(job.total_amount || 0).toLocaleString("en-IN")}`} />
              <Field label="Discount"           value={job.discount_amount ? `₹${job.discount_amount.toLocaleString("en-IN")} (${job.discount_percentage}%)` : "No discount"} />
              <Field label="Tax"                value={job.tax_amount ? `₹${job.tax_amount.toLocaleString("en-IN")}` : "No tax"} />
              <Field label="Payment Mode"       value={job.payment_mode} />
              <Field label="Amount Received"    value={job.payment_amount ? `₹${Number(job.payment_amount).toLocaleString("en-IN")}` : "—"} />
              {job.balance_amount > 0 && (
                <Field label="Balance Due" value={`₹${Number(job.balance_amount).toLocaleString("en-IN")}`} />
              )}
              {job.next_due_date && (
                <Field label="Next Due Date" value={fmt(job.next_due_date)} />
              )}
              {job.gst_no && <Field label="GST No." value={job.gst_no} />}
            </div>
          </Section>

          {/* Dates */}
          <Section title="Dates">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
              <Field label="Order Date"    value={fmtDateTime(job.order_date)} />
              <Field label="Created At"   value={fmtDateTime(job.createdAt)} />
              <Field label="Est. Delivery" value={
                <span style={{ color: isJobOverdue(job) ? "#9B1C1C" : "var(--color-text-primary)", fontWeight: isJobOverdue(job) ? 700 : 500 }}>
                  {fmt(job.estimated_delivery_date)}{isJobOverdue(job) ? " ⚠ Overdue" : ""}
                </span>
              } />
              <Field label="Valid Until" value={
                validity
                  ? `${fmt(job.valid_until)} (${validity.label})`
                  : fmt(job.valid_until)
              } />
            </div>
          </Section>

          {/* Notes */}
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

const COLS = "100px 1fr 120px 130px 90px 72px 40px";

const JobRow = ({ job, onView }) => {
  const stage    = job.current_stage;
  const validity = daysLeft(job.valid_until);
  const overdue  = isJobOverdue(job);
  const delayed  = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  const rowBg = overdue ? "#FFF5F5" : delayed ? "#FFFBEB" : "transparent";

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: COLS,
        alignItems: "center", gap: 8, padding: "11px 16px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        transition: "background 0.1s", cursor: "default",
        background: rowBg,
        borderLeft: overdue ? "3px solid #9B1C1C" : delayed ? "3px solid #92400E" : "3px solid transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = overdue ? "#FEE2E2" : delayed ? "#FEF3C7" : "var(--color-background-secondary)"}
      onMouseLeave={e => e.currentTarget.style.background = rowBg}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {(overdue || delayed) && (
          <FiAlertTriangle size={12} color={overdue ? "#9B1C1C" : "#92400E"} style={{ flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-primary)" }}>
          {job.job_no}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.customer_name || "—"}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: "var(--color-text-tertiary)" }}>
          By: {typeof job.created_by === "object" ? job.created_by?.name : job.created_by || "—"}
        </p>
      </div>

      <div>
        {stage?.stage_label
          ? (
            <div>
              <StatusBadge status={stage.stage} />
              {stageTime && (
                <p style={{ margin: "2px 0 0", fontSize: 9, color: delayed ? "#92400E" : "var(--color-text-tertiary)", fontWeight: delayed ? 700 : 400 }}>
                  {stageTime}
                </p>
              )}
            </div>
          )
          : <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>—</span>
        }
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <StatusBadge status={job.job_status} />
        {overdue && <StatusBadge status="overdue" />}
        {!overdue && delayed && <StatusBadge status="delayed" />}
      </div>

      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}>
        ₹{(job.total_amount || 0).toLocaleString("en-IN")}
      </span>

      <span style={{
        fontSize: 11, fontWeight: 500, textAlign: "right",
        color: !validity ? "var(--color-text-tertiary)"
          : validity.diff <= 0 ? "#A32D2D"
          : validity.diff <= 2 ? "#BA7517"
          : "var(--color-text-tertiary)",
      }}>
        {validity?.label || "—"}
      </span>

      <button
        onClick={() => onView(job)}
        title="View details"
        style={{
          all: "unset", cursor: "pointer", width: 28, height: 28,
          borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-tertiary)", border: "0.5px solid var(--color-border-tertiary)",
          transition: "all 0.12s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#E0F2FE";
          e.currentTarget.style.color = "#0369A1";
          e.currentTarget.style.borderColor = "#0369A140";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text-tertiary)";
          e.currentTarget.style.borderColor = "var(--color-border-tertiary)";
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
  const stage    = job.current_stage;
  const validity = daysLeft(job.valid_until);
  const overdue  = isJobOverdue(job);
  const delayed  = isJobDelayed(job);
  const stageTime = fmtHours(job.current_stage?.since);

  return (
    <div style={{
      background: overdue ? "#FFF5F5" : delayed ? "#FFFBEB" : "var(--color-background-primary)",
      border: `0.5px solid ${overdue ? "#9B1C1C50" : delayed ? "#92400E50" : "var(--color-border-tertiary)"}`,
      borderLeft: `3px solid ${overdue ? "#9B1C1C" : delayed ? "#92400E" : "transparent"}`,
      borderRadius: 12, padding: "12px 14px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {(overdue || delayed) && (
            <FiAlertTriangle size={12} color={overdue ? "#9B1C1C" : "#92400E"} />
          )}
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-primary)" }}>
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
              background: "#E0F2FE", color: "#0369A1",
            }}
          >
            <FiEye size={12} />
          </button>
        </div>
      </div>

      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {job.customer_name || "—"}
      </p>
      <p style={{ margin: "0 0 6px", fontSize: 10, color: "var(--color-text-tertiary)" }}>
        By: {typeof job.created_by === "object" ? job.created_by?.name : job.created_by || "—"}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {stage?.stage && <StatusBadge status={stage.stage} />}
        {overdue && <StatusBadge status="overdue" />}
        {!overdue && delayed && <StatusBadge status="delayed" />}
      </div>

      {stageTime && (
        <p style={{ margin: "4px 0 0", fontSize: 10, color: delayed ? "#92400E" : "var(--color-text-tertiary)", fontWeight: delayed ? 700 : 400 }}>
          ⏱ {stageTime}
        </p>
      )}

      {overdue && (
        <p style={{ margin: "4px 0 0", fontSize: 10, color: "#9B1C1C", fontWeight: 600 }}>
          ⚠ Delivery was due {fmt(job.estimated_delivery_date)}
        </p>
      )}

      <div style={{
        marginTop: 10, paddingTop: 8,
        borderTop: "0.5px solid var(--color-border-tertiary)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          ₹{(job.total_amount || 0).toLocaleString("en-IN")}
        </span>
        {validity && (
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: validity.diff <= 0 ? "#A32D2D" : validity.diff <= 2 ? "#BA7517" : "var(--color-text-tertiary)",
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
  design:        "#7C3AED",
  production:    "#0369A1",
  quality_check: "#B45309",
  delivery:      "#0F6E56",
};

const StageBreakdown = ({ allJobs }) => (
  <div style={{ marginTop: 20 }}>
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      Active by stage
    </p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {["design", "production", "quality_check", "delivery"].map(stage => {
        const accent   = STAGE_ACCENT[stage] || "#888";
        const active   = allJobs.filter(j => j.current_stage?.stage === stage && j.job_status === stage).length;
        const assigned = allJobs.filter(j => j.current_stage?.stage === stage).length;
        const label    = getStatusCfg(stage).label;
        return (
          <div key={stage} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", flex: "1 1 140px",
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: accent, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-tertiary)" }}>{label}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                {active}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-tertiary)", marginLeft: 4 }}>
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
    gap: 12, padding: "12px 16px", marginBottom: 18,
    background: "#FCEBEB", border: "1px solid #A32D2D30", borderRadius: 10, flexWrap: "wrap",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <FiWifiOff size={15} color="#A32D2D" />
      <span style={{ fontSize: 13, color: "#791F1F", fontWeight: 500 }}>{message}</span>
    </div>
    <button
      onClick={onRetry}
      style={{
        all: "unset", cursor: "pointer", fontSize: 12, color: "#A32D2D",
        border: "1px solid #A32D2D50", padding: "4px 12px", borderRadius: 8,
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
  const overdueJobs    = pool.filter(isJobOverdue);
  const delayedJobs    = pool.filter(j => !isJobOverdue(j) && isJobDelayed(j)); // delayed but not overdue

  const expiryIds = new Set(expiryToday.map(j => j._id));
  const myExpiryToday = expiryToday.filter(j => pool.some(pj => pj._id === j._id));

  // Stats row 1: main pipeline
  const STATS_PIPELINE = [
    { key: "all",           accent: "#378ADD", icon: <FiBriefcase   size={17} />, label: isSuperAdmin ? "Total Jobs" : "My Jobs",  value: pool.length },
    { key: "today",         accent: "#534AB7", icon: <FiCalendar    size={17} />, label: "Created Today",  value: todayCreated.length    },
    { key: "design",        accent: "#7C3AED", icon: <FiEdit3       size={17} />, label: "Design",         value: designJobs.length      },
    { key: "production",    accent: "#0369A1", icon: <FiPackage     size={17} />, label: "Production",     value: productionJobs.length  },
    { key: "quality_check", accent: "#B45309", icon: <FiShield      size={17} />, label: "Quality Check",  value: qcJobs.length          },
    { key: "completed",     accent: "#047857", icon: <FiCheckCircle size={17} />, label: "Completed",      value: completedJobs.length   },
  ];

  // Stats row 2: alerts
  const STATS_ALERTS = [
    {
      key: "overdue",
      accent: "#9B1C1C",
      icon: <FiSlash size={17} />,
      label: "Overdue",
      sublabel: overdueJobs.length > 0 ? "Past delivery date" : null,
      value: overdueJobs.length,
    },
    {
      key: "delayed",
      accent: "#92400E",
      icon: <FiAlertTriangle size={17} />,
      label: "Delayed",
      sublabel: delayedJobs.length > 0 ? `In stage >48h` : null,
      value: delayedJobs.length,
    },
    {
      key: "expiry",
      accent: "#993C1D",
      icon: <FiAlertCircle size={17} />,
      label: "Expiring Today",
      sublabel: myExpiryToday.length > 0 ? "Validity ends today" : null,
      value: myExpiryToday.length,
    },
    {
      key: "on_hold",
      accent: "#BA7517",
      icon: <FiPauseCircle size={17} />,
      label: "On Hold",
      sublabel: null,
      value: onHoldJobs.length,
    },
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
    // Always pin overdue jobs to top, then delayed
    const aScore = isJobOverdue(a) ? 2 : isJobDelayed(a) ? 1 : 0;
    const bScore = isJobOverdue(b) ? 2 : isJobDelayed(b) ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    const da = new Date(a.createdAt), db = new Date(b.createdAt);
    return sortAsc ? da - db : db - da;
  });

  const filterLabel = (() => {
    const map = {
      all:           isSuperAdmin ? "All Jobs" : "My Jobs",
      today:         "Created Today",
      expiry:        "Expiring Today",
      overdue:       "Overdue Jobs",
      delayed:       "Delayed Jobs",
      on_hold:       "On Hold",
    };
    return map[filter] || getStatusCfg(filter).label;
  })();

  // Alert counts for top banner
  const alertCount = overdueJobs.length + delayedJobs.length;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "14px 10px" : "24px 28px", maxWidth: 1140, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 18, flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Job Dashboard
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 5 }}>
            <FiWifi size={11} />
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
            fontSize: 12, color: "var(--color-text-secondary)",
            border: "0.5px solid var(--color-border-secondary)",
            padding: "7px 14px", borderRadius: 8,
            background: "var(--color-background-primary)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <FiRefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {/* Combined alert banner: overdue + delayed + expiring */}
      {!loading && (alertCount > 0 || myExpiryToday.length > 0) && (
        <div style={{
          padding: "12px 16px", marginBottom: 18,
          background: alertCount > 0 ? "#FEF2F2" : "#FAEEDA",
          border: `1px solid ${alertCount > 0 ? "#9B1C1C30" : "#BA751730"}`,
          borderRadius: 12, display: "flex", flexDirection: "column", gap: 8,
        }}>
          {overdueJobs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FiSlash size={14} color="#9B1C1C" />
              <span style={{ fontSize: 13, color: "#7F1D1D", fontWeight: 600 }}>
                {overdueJobs.length} overdue job{overdueJobs.length > 1 ? "s" : ""} —
              </span>
              <span style={{ fontSize: 12, color: "#9B1C1C" }}>
                {overdueJobs.slice(0, 4).map(j => j.job_no).join(", ")}{overdueJobs.length > 4 ? ` +${overdueJobs.length - 4} more` : ""}
              </span>
              <button onClick={() => setFilter("overdue")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#9B1C1C", border: "1px solid #9B1C1C60", padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                View
              </button>
            </div>
          )}
          {delayedJobs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FiAlertTriangle size={14} color="#92400E" />
              <span style={{ fontSize: 13, color: "#78350F", fontWeight: 600 }}>
                {delayedJobs.length} delayed job{delayedJobs.length > 1 ? "s" : ""} (stuck &gt;48h) —
              </span>
              <span style={{ fontSize: 12, color: "#92400E" }}>
                {delayedJobs.slice(0, 4).map(j => j.job_no).join(", ")}{delayedJobs.length > 4 ? ` +${delayedJobs.length - 4} more` : ""}
              </span>
              <button onClick={() => setFilter("delayed")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#92400E", border: "1px solid #92400E60", padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                View
              </button>
            </div>
          )}
          {myExpiryToday.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FiCalendar size={14} color="#BA7517" />
              <span style={{ fontSize: 13, color: "#854F0B", fontWeight: 600 }}>
                {myExpiryToday.length} job{myExpiryToday.length > 1 ? "s" : ""} expiring today —
              </span>
              <span style={{ fontSize: 12, color: "#BA7517" }}>
                {myExpiryToday.slice(0, 4).map(j => j.job_no).join(", ")}{myExpiryToday.length > 4 ? ` +${myExpiryToday.length - 4} more` : ""}
              </span>
              <button onClick={() => setFilter("expiry")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#BA7517", border: "1px solid #BA751760", padding: "2px 10px", borderRadius: 8, marginLeft: "auto" }}>
                View
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pipeline stats ── */}
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Pipeline
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)",
        gap: isMobile ? 8 : 10, marginBottom: 14,
      }}>
        {STATS_PIPELINE.map(s => (
          <StatCard
            key={s.key}
            icon={s.icon}
            label={s.label}
            value={s.value}
            accent={s.accent}
            active={filter === s.key}
            skeleton={loading && !data}
            onClick={() => setFilter(prev => prev === s.key ? "all" : s.key)}
          />
        ))}
      </div>

      {/* ── Alert stats ── */}
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Alerts & Hold
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: isMobile ? 8 : 10, marginBottom: 22,
      }}>
        {STATS_ALERTS.map(s => (
          <StatCard
            key={s.key}
            icon={s.icon}
            label={s.label}
            sublabel={s.sublabel}
            value={s.value}
            accent={s.accent}
            active={filter === s.key}
            skeleton={loading && !data}
            onClick={() => setFilter(prev => prev === s.key ? "all" : s.key)}
          />
        ))}
      </div>

      {/* Jobs table */}
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)",
          gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FiFilter size={13} color="var(--color-text-tertiary)" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {filterLabel}
            </span>
            <span style={{
              fontSize: 11, background: "var(--color-background-secondary)",
              color: "var(--color-text-secondary)", padding: "1px 8px", borderRadius: 20,
            }}>
              {displayJobs.length}
            </span>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 3 }}
              >
                Clear <FiXCircle size={11} />
              </button>
            )}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: 8, padding: "5px 10px",
            background: "var(--color-background-secondary)",
          }}>
            <FiSearch size={13} color="var(--color-text-tertiary)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search job no, customer…"
              style={{
                all: "unset", fontSize: 12, color: "var(--color-text-primary)",
                width: isMobile ? 110 : 180,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ all: "unset", cursor: "pointer", display: "flex" }}>
                <FiXCircle size={12} color="var(--color-text-tertiary)" />
              </button>
            )}
          </div>
        </div>

        {/* Column headers — desktop only */}
        {!isMobile && (
          <div style={{
            display: "grid", gridTemplateColumns: COLS,
            gap: 8, padding: "8px 16px",
            background: "var(--color-background-secondary)",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
          }}>
            {[
              { label: "Job No."              },
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
                  fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
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

        {/* Row list */}
        <div style={{ maxHeight: 540, overflowY: "auto" }}>
          {loading && !data
            ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 14 }}>
                <Spin size="large" />
                <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>Connecting to server…</p>
              </div>
            )
            : displayJobs.length === 0
            ? <div style={{ padding: "50px 0" }}><Empty description="No jobs found" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
            : displayJobs.map(job =>
                isMobile
                  ? <div key={job._id} style={{ padding: "0 10px" }}>
                      <JobCard job={job} onView={setViewJob} />
                    </div>
                  : <JobRow key={job._id} job={job} onView={setViewJob} />
              )
          }
        </div>

        {/* Table footer */}
        {displayJobs.length > 0 && (
          <div style={{
            padding: "9px 16px", borderTop: "0.5px solid var(--color-border-tertiary)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {displayJobs.length} job{displayJobs.length !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : ""}
              {filter !== "all" ? ` · ${filterLabel}` : ""}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              Auto-refreshes every 60s
            </span>
          </div>
        )}
      </div>

      {/* Stage breakdown — super admin only */}
      {isSuperAdmin && !loading && data && <StageBreakdown allJobs={allJobs} />}

      {/* View Modal */}
      {viewJob && <ViewModal job={viewJob} onClose={() => setViewJob(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}