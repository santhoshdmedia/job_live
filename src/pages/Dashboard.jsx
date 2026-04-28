import { useState, useEffect, useCallback, useRef } from "react";
import {
  FiBriefcase, FiCheckCircle, FiAlertCircle, FiUser,
  FiTrendingUp, FiCalendar, FiFilter, FiRefreshCw,
  FiXCircle, FiPauseCircle, FiEdit3, FiZap, FiAlertTriangle,
  FiWifi, FiWifiOff, FiChevronDown, FiChevronUp, FiSearch,
} from "react-icons/fi";
import { Spin, Empty, notification } from "antd";
import { useSelector } from "react-redux";

// ═══════════════════════════════════════════════════════════════════
// API Layer — all real fetch calls live here
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

const fetchDashboardData = async ({ baseURL, token, userId, isSuperAdmin }) => {
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
  
  // Parallel: user's assigned jobs + all jobs (for expiry banner)
  const [assignedData, allData] = await Promise.all([
    apiGet(`${baseURL}/jobs/assigned-to/${userId}`, token),
    apiGet(allEndpoint, token),
  ]);
  
  const myJobs  = assignedData?.data || [];
  const allJobs = allData?.data?.jobs || [];
  const expiryToday = allJobs.filter(
    (j) => j.valid_until && j.valid_until.slice(0, 10) === todayStr
  );
  return { allJobs, myJobs, expiryToday };
};

// ═══════════════════════════════════════════════════════════════════
// Shared UI helpers
// ═══════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  draft:       { label: "Draft",       color: "#5F5E5A", bg: "#F1EFE8", icon: <FiEdit3        size={11} /> },
  accepted:    { label: "Accepted",    color: "#185FA5", bg: "#E6F1FB", icon: <FiCheckCircle  size={11} /> },
  in_progress: { label: "In Progress", color: "#3B6D11", bg: "#EAF3DE", icon: <FiZap          size={11} /> },
  on_hold:     { label: "On Hold",     color: "#BA7517", bg: "#FAEEDA", icon: <FiPauseCircle  size={11} /> },
  completed:   { label: "Completed",   color: "#0F6E56", bg: "#E1F5EE", icon: <FiCheckCircle  size={11} /> },
  rejected:    { label: "Rejected",    color: "#A32D2D", bg: "#FCEBEB", icon: <FiXCircle      size={11} /> },
  converted:   { label: "Converted",   color: "#534AB7", bg: "#EEEDFE", icon: <FiTrendingUp   size={11} /> },
  expired:     { label: "Expired",     color: "#993C1D", bg: "#FAECE7", icon: <FiAlertCircle  size={11} /> },
};

const StatusBadge = ({ status }) => {
  const cfg = status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 500, padding: "3px 8px",
      borderRadius: 20, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`, whiteSpace: "nowrap",
    }}>
       {cfg}
    </span>
  );
};

const daysLeft = (validUntil) => {
  if (!validUntil) return null;
  const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000);
  return { diff, label: diff <= 0 ? "Expired" : `${diff}d left` };
};

// ═══════════════════════════════════════════════════════════════════
// Stat Card — clickable filter tile
// ═══════════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, accent, active, onClick, skeleton }) => (
  <button
  onClick={onClick}
  style={{
    all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
      gap: 10, padding: "16px 18px", boxSizing: "border-box", width: "100%",
      background: active ? `${accent}12` : "var(--color-background-primary)",
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
// Desktop table row
// ═══════════════════════════════════════════════════════════════════

const COLS = "96px 1fr 110px 108px 90px 72px";

const JobRow = ({ job, isExpiring }) => {
  const stage    = job.current_stage;
  const validity = daysLeft(job.valid_until);
  return (
    <div
    style={{
      display: "grid", gridTemplateColumns: COLS,
      alignItems: "center", gap: 8, padding: "11px 16px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
      {/* Job no */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isExpiring && <FiAlertTriangle size={12} color="#BA7517" style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-primary)" }}>
          {job.job_no}
        </span>
      </div>
      {/* Customer */}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.customer_name || "—"}
        </p>
        {stage?.assigned_to?.name && (
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 3 }}>
            <FiUser size={10} /> {stage.assigned_to.name}
          </p>
        )}
      </div>
      {/* Stage */}
      <div>
        {stage?.stage_label
          ? <span style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "2px 8px", borderRadius: 10 }}>
              {stage.stage_label}
            </span>
          : <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>—</span>
        }
      </div>
      {/* Status */}
      <StatusBadge status={job.job_status} />
      {/* Amount */}
      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}>
        ₹{(job.total_amount || 0).toLocaleString("en-IN")}
      </span>
      {/* Validity */}
      <span style={{
        fontSize: 11, fontWeight: 500, textAlign: "right",
        color: !validity ? "var(--color-text-tertiary)"
        : validity.diff <= 0 ? "#A32D2D"
        : validity.diff <= 2 ? "#BA7517"
        : "var(--color-text-tertiary)",
      }}>
        {validity?.label || "—"}
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Mobile card
// ═══════════════════════════════════════════════════════════════════

const JobCard = ({ job, isExpiring }) => {
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
        <StatusBadge status={job.job_status} />
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {job.customer_name || "—"}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {stage?.stage_label && (
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "2px 8px", borderRadius: 10 }}>
            {stage.stage_label}
          </span>
        )}
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
// Stage breakdown panel (super admin)
// ═══════════════════════════════════════════════════════════════════

const STAGE_ACCENT = { design: "#378ADD", printing: "#534AB7", delivery: "#0F6E56" };

const StageBreakdown = ({ allJobs }) => (
  <div style={{ marginTop: 20 }}>
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      Active by stage
    </p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {["design", "printing", "delivery"].map(stage => {
        const accent    = STAGE_ACCENT[stage] || "#888";
        const active    = allJobs.filter(j => j.current_stage?.stage === stage && j.job_status === "in_progress").length;
        const assigned  = allJobs.filter(j => j.current_stage?.stage === stage).length;
        return (
          <div key={stage} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", flex: "1 1 140px",
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: accent, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "capitalize" }}>{stage}</p>
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
  const token = localStorage.getItem("admintoken") || "";
  const baseURL = "https://job-server-cocj.onrender.com/api";
    const { user } = useSelector((state) => state.authSlice);
  

  

  const isSuperAdmin = user.role === "super admin";

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [sortAsc, setSortAsc]   = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const intervalRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Core load function ──────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData({
        baseURL,
        token,
        userId: user._id,
        isSuperAdmin,
      });
      setData(result);
    } catch (err) {
      const msg = err.message || "Failed to load. Check your connection.";
      setError(msg);
      if (!silent) {
        notification.error({
          message:     "Dashboard error",
          description: msg,
          placement:   "topRight",
          duration:    4,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [baseURL, token, user._id, isSuperAdmin]);

  // Initial load + 60-second auto-refresh
  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  // ── Derived values ──────────────────────────────────────────────
  const todayStr    = new Date().toISOString().slice(0, 10);
  const allJobs     = data?.allJobs     || [];
  const myJobs      = data?.myJobs      || [];
  const expiryToday = data?.expiryToday || [];
  const expiryIds   = new Set(expiryToday.map(j => j._id));

  const todayCreated  = allJobs.filter(j => j.createdAt?.slice(0, 10) === todayStr);
  const inProgress    = myJobs.filter(j => j.job_status === "in_progress");
  const onHold        = myJobs.filter(j => j.job_status === "on_hold");
  const completedJobs = (isSuperAdmin ? allJobs : myJobs).filter(j => j.job_status === "completed");

  const STATS = [
    {
      key: "all", accent: "#378ADD", icon: <FiBriefcase size={18} />,
      label: isSuperAdmin ? "Total jobs" : "My jobs",
      value: isSuperAdmin ? allJobs.length : myJobs.length,
    },
    { key: "today",       accent: "#534AB7", icon: <FiCalendar      size={18} />, label: "Created today",   value: todayCreated.length  },
    { key: "in_progress", accent: "#3B6D11", icon: <FiZap           size={18} />, label: "In progress",     value: inProgress.length    },
    { key: "on_hold",     accent: "#BA7517", icon: <FiPauseCircle   size={18} />, label: "On hold",         value: onHold.length        },
    { key: "completed",   accent: "#0F6E56", icon: <FiCheckCircle   size={18} />, label: "Completed",       value: completedJobs.length },
    { key: "expiry",      accent: "#993C1D", icon: <FiAlertTriangle size={18} />, label: "Expiring today",  value: expiryToday.length   },
  ];

  // ── Filter → search → sort pipeline ────────────────────────────
  let displayJobs = (() => {
    switch (filter) {
      case "today":       return todayCreated;
      case "expiry":      return expiryToday;
      case "in_progress": return inProgress;
      case "on_hold":     return onHold;
      case "completed":   return completedJobs;
      default:            return isSuperAdmin ? allJobs : myJobs;
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

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "14px 10px" : "24px 28px", maxWidth: 1000, margin: "0 auto" }}>

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
            {isSuperAdmin ? "Super admin — all jobs" : `Assigned to ${user.name}`}
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

      {/* Expiry banner */}
      {!loading && expiryToday.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", marginBottom: 18,
          background: "#FAEEDA", border: "1px solid #BA751730", borderRadius: 10,
          flexWrap: "wrap",
        }}>
          <FiAlertTriangle size={15} color="#BA7517" />
          <span style={{ fontSize: 13, color: "#854F0B", fontWeight: 500 }}>
            {expiryToday.length} job{expiryToday.length > 1 ? "s" : ""} expiring today —&nbsp;
            {expiryToday.map(j => j.job_no).join(", ")}
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
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
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
              {filter === "all"         ? "All jobs"
               : filter === "expiry"   ? "Expiring today"
               : filter === "today"    ? "Created today"
               : STATUS_CONFIG[filter]?.label || filter}
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

          {/* Search box */}
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
              { label: "Customer" },
              { label: "Stage" },
              { label: "Status" },
              { label: "Amount" },
              { label: "Validity", sortable: true },
            ].map(h => (
              <span
                key={h.label}
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
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {loading && !data
            ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 14 }}>
                <Spin size="large" />
                <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>
                  Connecting to server…
                </p>
              </div>
            )
            : displayJobs.length === 0
            ? <div style={{ padding: "50px 0" }}>
                <Empty description="No jobs found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            : displayJobs.map(job =>
                isMobile
                  ? <div key={job._id} style={{ padding: "0 10px" }}>
                      <JobCard job={job} isExpiring={expiryIds.has(job._id)} />
                    </div>
                  : <JobRow key={job._id} job={job} isExpiring={expiryIds.has(job._id)} />
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

      {/* Stage breakdown — super admin only */}
      {isSuperAdmin && !loading && data && <StageBreakdown allJobs={allJobs} />}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}