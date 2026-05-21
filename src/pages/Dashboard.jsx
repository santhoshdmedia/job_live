import { useState, useEffect, useCallback, useRef } from "react";
import {
  FiBriefcase, FiCheckCircle, FiAlertCircle, FiUser,
  FiTrendingUp, FiCalendar, FiFilter, FiRefreshCw,
  FiXCircle, FiPauseCircle, FiEdit3, FiZap, FiAlertTriangle,
  FiWifi, FiWifiOff, FiChevronDown, FiChevronUp, FiSearch,
  FiEye, FiX, FiPackage, FiTruck, FiShield, FiPhone,
  FiMapPin, FiClock, FiDollarSign, FiFileText, FiImage,
} from "react-icons/fi";
import { Spin, Empty, notification } from "antd";
import { useSelector } from "react-redux";

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

  if (isSuperAdmin) {
    const data = await apiGet(allEndpoint, token);
    const allJobs = data?.data?.jobs || [];
    const expiryToday = allJobs.filter(
      (j) => j.valid_until && j.valid_until.slice(0, 10) === todayStr
    );
    return { allJobs, myJobs: allJobs, expiryToday };
  }

  // For regular users: get ALL jobs first, then filter by creator
  const allData = await apiGet(allEndpoint, token);
  const allJobs = allData?.data?.jobs || [];
  
  // Filter jobs created by the logged-in user
  const myJobs = allJobs.filter(job => {
    if (!job.created_by) return false;
    
    // Handle different possible formats of created_by
    if (typeof job.created_by === 'object' && job.created_by !== null) {
      // If created_by is an object with name or _id
      return job.created_by.name === user.name || job.created_by._id === userId;
    }
    // If created_by is a string (name or ID)
    return job.created_by === user.name || job.created_by === userId;
  });
  
  const expiryToday = allJobs.filter(
    (j) => j.valid_until && j.valid_until.slice(0, 10) === todayStr
  );
  
  return { allJobs, myJobs, expiryToday };
};

// ═══════════════════════════════════════════════════════════════════
// Status & Stage Configs
// ═══════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  draft:         { label: "Draft",          color: "#5F5E5A", bg: "#F1EFE8", icon: <FiEdit3       size={11} /> },
  accepted:      { label: "Accepted",       color: "#185FA5", bg: "#E6F1FB", icon: <FiCheckCircle size={11} /> },
  design:        { label: "Design",         color: "#7C3AED", bg: "#EDE9FE", icon: <FiEdit3       size={11} /> },
  in_progress:   { label: "In Progress",    color: "#3B6D11", bg: "#EAF3DE", icon: <FiZap         size={11} /> },
  production:    { label: "Production",     color: "#0369A1", bg: "#E0F2FE", icon: <FiPackage     size={11} /> },
  quality_check: { label: "Quality Check",  color: "#B45309", bg: "#FEF3C7", icon: <FiShield      size={11} /> },
  delivery:      { label: "Delivery",       color: "#0F6E56", bg: "#ECFDF5", icon: <FiTruck       size={11} /> },
  on_hold:       { label: "On Hold",        color: "#BA7517", bg: "#FAEEDA", icon: <FiPauseCircle size={11} /> },
  completed:     { label: "Completed",      color: "#047857", bg: "#D1FAE5", icon: <FiCheckCircle size={11} /> },
  rejected:      { label: "Rejected",       color: "#A32D2D", bg: "#FCEBEB", icon: <FiXCircle     size={11} /> },
  converted:     { label: "Converted",      color: "#534AB7", bg: "#EEEDFE", icon: <FiTrendingUp  size={11} /> },
  expired:       { label: "Expired",        color: "#993C1D", bg: "#FAECE7", icon: <FiAlertCircle size={11} /> },
};

const getStatusCfg = (status) =>
  STATUS_CONFIG[status] || { label: status || "Unknown", color: "#888", bg: "#F3F4F6", icon: null };

const StatusBadge = ({ status }) => {
  const cfg = getStatusCfg(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 9px",
      borderRadius: 20, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`, whiteSpace: "nowrap",
    }}>
      {cfg.icon} {cfg.label}
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

const fmt = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

const fmtDateTime = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ═══════════════════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, accent, active, onClick, skeleton }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
      gap: 10, padding: "16px 18px", boxSizing: "border-box", width: "100%",
      background: active ? `${accent}14` : "var(--color-background-primary)",
      border: `1.5px solid ${active ? accent : "var(--color-border-tertiary)"}`,
      borderRadius: 14, transition: "border-color 0.15s, background 0.15s",
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${accent}88`; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--color-border-tertiary)"; }}
  >
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: `${accent}22`, color: accent,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
    </div>
    <div>
      {skeleton
        ? <div style={{ width: 40, height: 26, background: "var(--color-background-secondary)", borderRadius: 6, marginBottom: 4 }} />
        : <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>{value}</p>
      }
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</p>
    </div>
  </button>
);

// ═══════════════════════════════════════════════════════════════════
// Job View Modal
// ═══════════════════════════════════════════════════════════════════

const ViewModal = ({ job, onClose }) => {
  if (!job) return null;
  const validity = daysLeft(job.valid_until);

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
          
          borderRadius: 18, width: "100%", maxWidth: 680,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          border: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "0.5px solid var(--color-border-tertiary)",
          position: "sticky", top: 0, background: "var(--color-background-primary)",
          zIndex: 1, borderRadius: "18px 18px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 15, fontWeight: 700, fontFamily: "monospace",
              color: "var(--color-text-primary)",
            }}>{job.job_no}</span>
            <StatusBadge status={job.job_status} />
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

        {/* Modal Body */}
        <div style={{ padding: "20px 22px" }}>

          {/* Customer */}
          <Section title="Customer Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Field label="Customer Name" value={job.customer_name} />
              <Field label="Phone" value={job.customer_phone} />
              <Field label="Created by" value={job.created_by} />
              <Field label="Approved by" value={job.approved_by} />
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
                        <span style={{ color: "var(--color-text-tertiary)" }}>· {job.current_stage.assigned_to.role}</span>
                      )}
                    </p>
                  )}
                  {job.current_stage.since && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <FiClock size={10} /> Since {fmtDateTime(job.current_stage.since)}
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
            <Section title="Order Items">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {job.cart_items.map((item, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: 10,
                    background: "var(--color-background-secondary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                          {item.product_name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                          {[item.variation, item.printing_type, item.size].filter(Boolean).join(" · ")}
                        </p>
                        {item.notes && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                          ₹{(item.price || 0).toLocaleString("en-IN")}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                          Qty: {item.quantity}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Workflow Status */}
          <Section title="Workflow Progress">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Design", status: job.design_status, by: job.design_uploaded_by, at: job.design_approved_at, duration: job.design_duration_display },
                { label: "Production", status: job.production_status, by: job.production_approved_by, at: job.production_approved_at },
                { label: "QC", status: job.qc_status, by: job.qc_inspected_by, at: null, notes: job.qc_notes, duration: job.qc_duration_display },
              ].map(({ label, status, by, at, notes, duration }) => {
                const isOk = status === "approved" || status === "production_completed";
                const isPending = status === "pending" || !status;
                const color = isOk ? "#047857" : isPending ? "#BA7517" : "#A32D2D";
                const bg    = isOk ? "#D1FAE5" : isPending ? "#FEF3C7" : "#FCEBEB";
                return (
                  <div key={label} style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: bg, border: `1px solid ${color}22`,
                  }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color }}>
                      {status?.replace(/_/g, " ") || "—"}
                    </p>
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
          {(job.design_file || job.productionimg) && (
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

          {/* Payment & Financials */}
          <Section title="Payment Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
              <Field label="Subtotal" value={`₹${(job.subtotal || 0).toLocaleString("en-IN")}`} />
              <Field label="Total Amount" value={`₹${(job.total_amount || 0).toLocaleString("en-IN")}`} />
              <Field label="Discount" value={job.discount_amount ? `₹${job.discount_amount.toLocaleString("en-IN")} (${job.discount_percentage}%)` : "No discount"} />
              <Field label="Tax" value={job.tax_amount ? `₹${job.tax_amount.toLocaleString("en-IN")}` : "No tax"} />
              <Field label="Payment Mode" value={job.payment_mode} />
              <Field label="Payment Received" value={job.payment_amount ? `₹${job.payment_amount}` : "—"} />
              {job.gst_no && <Field label="GST No." value={job.gst_no} />}
            </div>
          </Section>

          {/* Dates */}
          <Section title="Dates">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
              <Field label="Order Date" value={fmtDateTime(job.order_date)} />
              <Field label="Created At" value={fmtDateTime(job.createdAt)} />
              <Field label="Est. Delivery" value={fmt(job.estimated_delivery_date)} />
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

const COLS = "100px 1fr 120px 120px 90px 72px 40px";

const JobRow = ({ job, isExpiring, onView }) => {
  const stage    = job.current_stage;
  const validity = daysLeft(job.valid_until);
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: COLS,
        alignItems: "center", gap: 8, padding: "11px 16px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        transition: "background 0.1s", cursor: "default",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isExpiring && <FiAlertTriangle size={12} color="#BA7517" style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-primary)" }}>
          {job.job_no}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.customer_name || "—"}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: "var(--color-text-tertiary)" }}>
          Created by: {typeof job.created_by === 'object' ? job.created_by?.name : job.created_by || "—"}
        </p>
      </div>
      <div>
        {stage?.stage_label
          ? <StatusBadge status={stage.stage} />
          : <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>—</span>
        }
      </div>
      <StatusBadge status={job.job_status} />
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

const JobCard = ({ job, isExpiring, onView }) => {
  const stage    = job.current_stage;
  const validity = daysLeft(job.valid_until);
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: `0.5px solid ${isExpiring ? "#BA751750" : "var(--color-border-tertiary)"}`,
      borderLeft: `3px solid ${isExpiring ? "#BA7517" : "transparent"}`,
      borderRadius: 12, padding: "12px 14px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isExpiring && <FiAlertTriangle size={12} color="#BA7517" />}
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
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {job.customer_name || "—"}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--color-text-tertiary)" }}>
        Created by: {typeof job.created_by === 'object' ? job.created_by?.name : job.created_by || "—"}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {stage?.stage && <StatusBadge status={stage.stage} />}
        {stage?.assigned_to?.name && (
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 3 }}>
            <FiUser size={10} /> {stage.assigned_to.name}
          </span>
        )}
      </div>
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
  const isSuperAdmin = user.role === "super admin";

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

  // Close modal on Escape
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
  const expiryIds   = new Set(expiryToday.map(j => j._id));

  const todayCreated  = myJobs.filter(j => j.createdAt?.slice(0, 10) === todayStr);
  const designJobs    = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "design");
  const productionJobs = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "production");
  const qcJobs        = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "quality_check");
  const deliveryJobs  = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "delivery");
  const completedJobs = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "completed");
  const inProgress    = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "in_progress");
  const onHold        = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "on_hold");

  const STATS = [
    { key: "all",           accent: "#378ADD", icon: <FiBriefcase    size={18} />, label: isSuperAdmin ? "Total jobs" : "My jobs",  value: isSuperAdmin ? allJobs.length : myJobs.length },
    { key: "today",         accent: "#534AB7", icon: <FiCalendar     size={18} />, label: "Created today",   value: todayCreated.length    },
    { key: "design",        accent: "#7C3AED", icon: <FiEdit3        size={18} />, label: "Design",          value: designJobs.length      },
    { key: "production",    accent: "#0369A1", icon: <FiPackage      size={18} />, label: "Production",      value: productionJobs.length  },
    { key: "quality_check", accent: "#B45309", icon: <FiShield       size={18} />, label: "Quality Check",   value: qcJobs.length          },
    { key: "delivery",      accent: "#0F6E56", icon: <FiTruck        size={18} />, label: "Delivery",        value: deliveryJobs.length    },
    { key: "completed",     accent: "#047857", icon: <FiCheckCircle  size={18} />, label: "Completed",       value: completedJobs.length   },
    { key: "expiry",        accent: "#993C1D", icon: <FiAlertTriangle size={18} />, label: "Expiring today", value: expiryToday.filter(j => myJobs.some(mj => mj._id === j._id)).length },
  ];

  // ── Filter → search → sort ──────────────────────────────────────
  let displayJobs = (() => {
    const base = isSuperAdmin ? allJobs : myJobs;
    switch (filter) {
      case "today":         return todayCreated;
      case "expiry":        return expiryToday.filter(j => base.some(bj => bj._id === j._id));
      case "design":        return designJobs;
      case "production":    return productionJobs;
      case "quality_check": return qcJobs;
      case "delivery":      return deliveryJobs;
      case "completed":     return completedJobs;
      case "in_progress":   return inProgress;
      case "on_hold":       return onHold;
      default:              return base;
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
    const da = new Date(a.createdAt), db = new Date(b.createdAt);
    return sortAsc ? da - db : db - da;
  });

  const filterLabel = (() => {
    if (filter === "all")    return "All jobs";
    if (filter === "expiry") return "Expiring today";
    if (filter === "today")  return "Created today";
    return getStatusCfg(filter).label;
  })();

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "14px 10px" : "24px 28px", maxWidth: 1100, margin: "0 auto" }}>

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
            {isSuperAdmin ? "Super admin — all jobs" : `Jobs created by ${user.name}`}
            {" · "}
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            all: "unset",
            cursor: loading ? "not-allowed" : "pointer",
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

      {/* Expiry banner - only for user's own expiring jobs */}
      {!loading && expiryToday.filter(j => myJobs.some(mj => mj._id === j._id)).length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", marginBottom: 18,
          background: "#FAEEDA", border: "1px solid #BA751730", borderRadius: 10, flexWrap: "wrap",
        }}>
          <FiAlertTriangle size={15} color="#BA7517" />
          <span style={{ fontSize: 13, color: "#854F0B", fontWeight: 500 }}>
            {expiryToday.filter(j => myJobs.some(mj => mj._id === j._id)).length} job(s) expiring today —&nbsp;
            {expiryToday.filter(j => myJobs.some(mj => mj._id === j._id)).map(j => j.job_no).join(", ")}
          </span>
          <button
            onClick={() => setFilter("expiry")}
            style={{
              all: "unset", cursor: "pointer", fontSize: 11, color: "#854F0B",
              border: "1px solid #BA751760", padding: "2px 10px", borderRadius: 8, marginLeft: "auto",
            }}
          >
            View all
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: isMobile ? 8 : 12, marginBottom: 22,
      }}>
        {STATS.map(s => (
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
              { label: "Job No." },
              { label: "Customer / Creator" },
              { label: "Stage" },
              { label: "Status" },
              { label: "Amount" },
              { label: "Validity", sortable: true },
              { label: "" },
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
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
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
                      <JobCard job={job} isExpiring={expiryIds.has(job._id)} onView={setViewJob} />
                    </div>
                  : <JobRow key={job._id} job={job} isExpiring={expiryIds.has(job._id)} onView={setViewJob} />
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
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              Auto-refreshes every 60s
            </span>
          </div>
        )}
      </div>

      {/* Stage breakdown — super admin */}
      {isSuperAdmin && !loading && data && <StageBreakdown allJobs={allJobs} />}

      {/* View Modal */}
      {viewJob && <ViewModal job={viewJob} onClose={() => setViewJob(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}