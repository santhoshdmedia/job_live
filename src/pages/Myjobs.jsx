import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Tag,
  Tooltip,
  Divider,
} from "antd";
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  SendOutlined,
  UserOutlined,
  FileTextOutlined,
  BranchesOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import {
  ERROR_NOTIFICATION,
  SUCCESS_NOTIFICATION,
} from "../helper/notification_helper";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getUserProfile = () => {
  try {
    return JSON.parse(localStorage.getItem("userprofile") || "{}");
  } catch {
    return {};
  }
};
const getToken = () => localStorage.getItem("authToken");

// ─── Breakpoint hook ──────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => {
    const w = window.innerWidth;
    if (w < 480) return "xs";
    if (w < 768) return "sm";
    if (w < 1024) return "md";
    return "lg";
  };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const fn = () => setBp(get());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return {
    bp,
    isMobile: bp === "xs" || bp === "sm",
    isTablet: bp === "md",
    isDesktop: bp === "lg",
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const API_BASE = "https://job-server-cocj.onrender.com/api";

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "default", icon: <FileTextOutlined /> },
  sent: { label: "Sent", color: "blue", icon: <SendOutlined /> },
  viewed: { label: "Viewed", color: "cyan", icon: <EyeOutlined /> },
  accepted: { label: "Accepted", color: "green", icon: <CheckCircleOutlined /> },
  design: { label: "Design", color: "blue", icon: <FileTextOutlined /> },
  in_progress: { label: "In Progress", color: "gold", icon: <PlayCircleOutlined /> },
  on_hold: { label: "On Hold", color: "orange", icon: <PauseCircleOutlined /> },
  rejected: { label: "Rejected", color: "red", icon: <CloseCircleOutlined /> },
  expired: { label: "Expired", color: "volcano", icon: <ClockCircleOutlined /> },
  completed: { label: "Completed", color: "purple", icon: <CheckCircleOutlined /> },
  converted: { label: "Converted", color: "geekblue", icon: <SwapOutlined /> },
  quality_check: { label: "Quality Check", color: "magenta", icon: <SafetyCertificateOutlined /> },
  production: { label: "Production", color: "lime", icon: <PlayCircleOutlined /> },
};

const WORKFLOW_STAGES = [
  { value: "design", label: "Design" },
  { value: "prepress", label: "Prepress" },
  { value: "printing", label: "Printing" },
  { value: "finishing", label: "Finishing" },
  { value: "quality_check", label: "Quality Check" },
  { value: "dispatch", label: "Dispatch" },
  { value: "delivered", label: "Delivered" },
  { value: "delivery", label: "Delivery" },
  { value: "custom", label: "Custom" },
];

// ─── Shared tiny components ───────────────────────────────────────────────────
const StatusTag = ({ status, style }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 500, ...style }}>
      {cfg.label}
    </Tag>
  );
};

const StageTag = ({ stage }) => {
  const label = WORKFLOW_STAGES.find((s) => s.value === stage)?.label;
  if (!stage || !label)
    return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
  return (
    <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>
      {label}
    </Tag>
  );
};

const SectionDivider = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 10px" }}>
    <span style={{ color: "#2563eb", fontSize: 13 }}>{icon}</span>
    <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em" }}>
      {title}
    </span>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 4 }} />
  </div>
);

// ─── Job Detail (read-only view) ──────────────────────────────────────────────
const JobDetailView = ({ job, isMobile }) => {
  if (!job) return null;
  const addr = job.delivery_address || {};
  const fullAddress = [addr.street, addr.city, addr.state, addr.pincode, addr.country]
    .filter(Boolean)
    .join(", ");

  const LV = ({ label, value, mono }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#1a1a2e", fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 600 : 400 }}>
        {value ?? "—"}
      </div>
    </div>
  );

  const grid2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: "4px 16px", marginBottom: 12 };
  const grid4 = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "4px 16px", marginBottom: 12 };

  return (
    <div>
      {/* Customer */}
      <SectionDivider icon={<UserOutlined />} title="Customer Info" />
      <div style={grid2}>
        <LV label="Name" value={job.customer_name} />
        <LV label="Phone" value={job.customer_phone} />
        <LV
          label="Est. Delivery"
          value={job.estimated_delivery_date ? dayjs(job.estimated_delivery_date).format("DD MMM YYYY, hh:mm A") : null}
        />
      </div>

      {/* Address */}
      {fullAddress && (
        <>
          <SectionDivider icon={<EyeOutlined />} title="Delivery Address" />
          <p style={{ fontSize: 12, color: "#374151", marginBottom: 12, wordBreak: "break-word" }}>{fullAddress}</p>
        </>
      )}

      {/* Items */}
      <SectionDivider icon={<FileTextOutlined />} title="Items" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {(job.cart_items || []).map((it, i) => {
          const isSqFt = it.quantity_type === "sq.ft" || (it.sq_ft && it.sq_ft > 0);
          const lineTotal = isSqFt
            ? (it.quantity || 0) * (it.sq_ft || 0) * (it.price || 0)
            : (it.quantity || 0) * (it.price || 0);
          return (
            <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", marginRight: 8 }}>{it.product_name || "—"}</span>
                  {it.variation && <Tag style={{ fontSize: 10 }}>{it.variation}</Tag>}
                  {it.printing_type && <Tag color="blue" style={{ fontSize: 10 }}>{it.printing_type}</Tag>}
                </div>
                <span style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>₹{lineTotal.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {isSqFt && it.width && (
                  <span>Size: {it.width} × {it.height} {it.size_unit} ({it.sq_ft} ft²)</span>
                )}
                <span>Qty: {it.quantity}</span>
                <span>Price: ₹{it.price}/{isSqFt ? "sq.ft" : "unit"}</span>
                {it.notes && <span>Note: {it.notes}</span>}
              </div>
              {it.design_file && (
                <a href={it.design_file} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", marginTop: 4, display: "inline-block" }}>
                  View Design File ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Pricing */}
      <SectionDivider icon={<FileTextOutlined />} title="Pricing" />
      <div style={{ background: "linear-gradient(135deg,#eff6ff,#f8fafc)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? "10px" : "12px 14px", marginBottom: 12 }}>
        {[
          { label: "Subtotal", value: `₹${parseFloat(job.subtotal || 0).toFixed(2)}` },
          ...(job.discount_amount > 0
            ? [{ label: `Discount (${job.discount_percentage}%)`, value: `- ₹${parseFloat(job.discount_amount).toFixed(2)}`, green: true }]
            : []),
          { label: "GST", value: `₹${parseFloat(job.tax_amount || 0).toFixed(2)}` },
          { label: "Delivery", value: job.free_delivery ? "Free 🎉" : `₹${parseFloat(job.delivery_charges || 0).toFixed(2)}` },
        ].map(({ label, value, green }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: green ? "#059669" : "#4b5563", marginBottom: 3 }}>
            <span>{label}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        <Divider style={{ margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15 }}>
          <span style={{ color: "#1a1a2e" }}>Grand Total</span>
          <span style={{ color: "#2563eb" }}>₹{parseFloat(job.total_amount || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Design file (if exists on job level) */}
      {job.design_file && (
        <>
          <SectionDivider icon={<FileTextOutlined />} title="Design File" />
          <div style={{ marginBottom: 12 }}>
            <a href={job.design_file} target="_blank" rel="noreferrer">
              <img
                src={job.design_file}
                alt="Design"
                style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "contain" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </a>
          </div>
        </>
      )}

      {/* Production image (if exists) */}
      {job.productionimg && (
        <>
          <SectionDivider icon={<PlayCircleOutlined />} title="Production Image" />
          <div style={{ marginBottom: 12 }}>
            <a href={job.productionimg} target="_blank" rel="noreferrer">
              <img
                src={job.productionimg}
                alt="Production"
                style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "contain" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </a>
          </div>
        </>
      )}

      {/* Job Meta */}
      <SectionDivider icon={<FileTextOutlined />} title="Job Info" />
      <div style={grid4}>
        <LV label="Job No" value={job.job_no} mono />
        <LV label="Status" value={<StatusTag status={job.job_status} />} />
        <LV label="Created By" value={job.created_by} />
        <LV label="Approved By" value={job.approved_by} />
        <LV label="GST No" value={job.gst_no} />
        <LV label="Payment Mode" value={job.payment_mode} />
        <LV label="Payment Amount" value={job.payment_amount ? `₹${job.payment_amount}` : null} />
        <LV label="Order Date" value={job.order_date ? dayjs(job.order_date).format("DD MMM YYYY") : null} />
        {job.current_stage?.stage && (
          <LV label="Stage" value={<StageTag stage={job.current_stage.stage} />} />
        )}
        {job.current_stage?.assigned_to?.name && (
          <LV label="Assigned To" value={job.current_stage.assigned_to.name} />
        )}
        <LV label="Design Status" value={job.design_status} />
        <LV label="Design Uploaded By" value={job.design_uploaded_by} />
        <LV label="Design Approved By" value={job.design_approved_at ? dayjs(job.design_approved_at).format("DD MMM YYYY, hh:mm A") : null} />
        <LV label="Production Status" value={job.production_status} />
        <LV label="QC Status" value={job.qc_status} />
      </div>

      {job.notes && (
        <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#713f12" }}>
          <strong>Notes:</strong> {job.notes}
        </div>
      )}
    </div>
  );
};

// ─── Assign Modal Body (shared for approve & QC) ──────────────────────────────
const AssignModalBody = ({ job, members, membersLoading, selected, onSelect, infoText }) => {
  if (!job) return null;
  return (
    <div>
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 16, border: "1px solid #e5e7eb" }}>
        <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", fontSize: 14 }}>{job.job_no}</div>
        <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{job.customer_name || "—"}</div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{job.customer_phone || ""}</div>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          Status: <StatusTag status={job.job_status} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13, color: "#374151" }}>
          Assign To <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <Select
          placeholder={membersLoading ? "Loading…" : "Choose a person"}
          style={{ width: "100%" }}
          value={selected?._id || undefined}
          loading={membersLoading}
          disabled={membersLoading}
          onChange={(id) => onSelect(members.find((d) => d._id === id) || null)}
          notFoundContent={membersLoading ? "Loading…" : "No members found"}
          size="large"
        >
          {members.map((d) => (
            <Option key={d._id} value={d._id}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <UserOutlined style={{ color: "#6b7280", fontSize: 12 }} />
                <span>{d.name || d.fullName || d.username || d._id}</span>
                {d.role && <span style={{ fontSize: 10, color: "#9ca3af" }}>({d.role})</span>}
              </div>
            </Option>
          ))}
        </Select>
        {!membersLoading && members.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
            ⚠️ No members found. Please add the required team members first.
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#6b7280", background: "#fefce8", padding: "8px 10px", borderRadius: 6, border: "1px solid #fef08a" }}>
        ℹ️ {infoText}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
const MyJobs = () => {
  const { isMobile, isDesktop } = useBreakpoint();

  // Table state
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);

  // View modal
  const [viewJob, setViewJob] = useState(null);

  // Delete modal
  const [deletingJob, setDeletingJob] = useState(null);
  const [deleteNotes, setDeleteNotes] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Approve modal
  const [approvingJob, setApprovingJob] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState(null);
  const [approving, setApproving] = useState(false);
  const [designersLoading, setDesignersLoading] = useState(false);

  // QC modal
  const [qcJob, setQcJob] = useState(null);
  const [qcMembers, setQcMembers] = useState([]);
  const [selectedQcMember, setSelectedQcMember] = useState(null);
  const [qcAssigning, setQcAssigning] = useState(false);
  const [qcMembersLoading, setQcMembersLoading] = useState(false);

  const autoRefreshRef = useRef(null);
  const countdownRef = useRef(null);

  const userProfile = useMemo(() => getUserProfile(), []);
  const isSuperAdmin = userProfile?.role === "super admin";

  // ── Fetch all admins from API ──────────────────────────────────────────────
  const fetchAllAdmins = async () => {
    const res = await fetch(`${API_BASE}/admin/get_admin`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    return data.data || [];
  };

  // ── Load jobs ──────────────────────────────────────────────────────────────
  const loadJobs = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const res = await fetch(`${API_BASE}/jobs`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();

        let rows = [];
        if (Array.isArray(data?.data?.jobs)) rows = data.data.jobs;
        else if (Array.isArray(data?.data)) rows = data.data;
        else if (Array.isArray(data?.jobs)) rows = data.jobs;
        else if (Array.isArray(data)) rows = data;

        if (!isSuperAdmin) {
          rows = rows.filter((j) => j.created_by_admin_id === userProfile?._id);
        }

        setJobs(rows);
        setLastRefreshed(dayjs());
        setCountdown(AUTO_REFRESH_MS / 1000);
      } catch (err) {
        ERROR_NOTIFICATION({ message: err.message || "Failed to load jobs" });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isSuperAdmin, userProfile?._id],
  );

  const startAutoRefresh = useCallback(() => {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_MS / 1000);
    countdownRef.current = setInterval(
      () => setCountdown((p) => (p <= 1 ? AUTO_REFRESH_MS / 1000 : p - 1)),
      1000,
    );
    autoRefreshRef.current = setInterval(() => loadJobs(true), AUTO_REFRESH_MS);
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
    startAutoRefresh();
    return () => {
      clearInterval(autoRefreshRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  // ── Filtered + paged ───────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    let rows = jobs;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (j) =>
          (j.customer_name || "").toLowerCase().includes(q) ||
          (j.customer_phone || "").includes(q) ||
          (j.job_no || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter) rows = rows.filter((j) => j.job_status === statusFilter);
    return rows;
  }, [jobs, search, statusFilter]);

  const pagedJobs = useMemo(() => {
    const s = (page - 1) * pageSize;
    return filteredJobs.slice(s, s + pageSize);
  }, [filteredJobs, page, pageSize]);

  // ── Approve ────────────────────────────────────────────────────────────────
  const openApproveModal = async (job) => {
    setApprovingJob(job);
    setSelectedDesigner(null);
    setDesignersLoading(true);
    try {
      const all = await fetchAllAdmins();
      setDesigners(all.filter((u) => u.role === "designing team"));
    } catch {
      ERROR_NOTIFICATION({ message: "Could not load designers list" });
      setDesigners([]);
    } finally {
      setDesignersLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDesigner) {
      ERROR_NOTIFICATION({ message: "Please select a designer." });
      return;
    }
    setApproving(true);
    try {
      const name = selectedDesigner.name || selectedDesigner.fullName || selectedDesigner.username || "Unknown";
      const res = await fetch(`${API_BASE}/jobs/${approvingJob._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          job_status: "design",
          approved_by: userProfile?.name || null,
          approved_by_admin_id: userProfile?._id || null,
          assign_to: { user_id: selectedDesigner._id, name },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      SUCCESS_NOTIFICATION({ message: `Job ${approvingJob.job_no} approved & assigned to ${name}` });
      setApprovingJob(null);
      setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) {
      ERROR_NOTIFICATION({ message: err.message || "Failed to approve job" });
    } finally {
      setApproving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeletingJob(null);
    setDeleteNotes("");
    setDeleteError("");
  };

  const handleDelete = async () => {
    if (deleteNotes.trim().length < 50) {
      setDeleteError("Please provide at least 50 characters explaining the reason.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API_BASE}/jobs/${deletingJob._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ delete_notes: deleteNotes.trim(), adminId: userProfile?._id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete job");
      SUCCESS_NOTIFICATION({ message: `Job ${deletingJob.job_no} deleted successfully.` });
      closeDeleteModal();
      loadJobs(true);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete job");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Quality Check ──────────────────────────────────────────────────────────
  const openQcModal = async (job) => {
    setQcJob(job);
    setSelectedQcMember(null);
    setQcMembersLoading(true);
    try {
      const all = await fetchAllAdmins();
      // Filter by "quality check" role; fall back to full list if none found
      const qcList = all.filter((u) => u.role === "quality check");
      setQcMembers(qcList.length > 0 ? qcList : all);
    } catch {
      ERROR_NOTIFICATION({ message: "Could not load QC members" });
      setQcMembers([]);
    } finally {
      setQcMembersLoading(false);
    }
  };

  const handleAssignQc = async () => {
    if (!selectedQcMember) {
      ERROR_NOTIFICATION({ message: "Please select a QC assignee." });
      return;
    }
    setQcAssigning(true);
    try {
      const assigneeName = selectedQcMember.name || selectedQcMember.fullName || selectedQcMember.username || "Unknown";
      const assigneeRole = selectedQcMember.role || "";
      const assignedByName = userProfile?.name || "Unknown";
      const assignedById = userProfile?._id || null;
      const assignedByRole = userProfile?.role || "";

      const payload = {
        stage: "quality_check",
        stage_label: "quality_check",
        assigned_to: {
          user_id: selectedQcMember._id,
          name: assigneeName,
          role: assigneeRole,
        },
        assigned_by: {
          user_id: assignedById,
          name: assignedByName,
          role: assignedByRole,
        },
        notes: "QC assigned via My Jobs page",
      };

      const res = await fetch(`${API_BASE}/jobs/${qcJob._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "QC assignment failed");
      SUCCESS_NOTIFICATION({ message: `Quality check assigned to ${assigneeName}` });
      setQcJob(null);
      setSelectedQcMember(null);
      loadJobs(true);
    } catch (err) {
      ERROR_NOTIFICATION({ message: err.message || "Failed to assign QC" });
    } finally {
      setQcAssigning(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const p = isMobile ? 8 : 12;
  const g = isMobile ? 8 : 12;
  const slideUp = isMobile
    ? { top: "auto", bottom: 0, margin: 0, maxWidth: "100vw", padding: 0, paddingBottom: "env(safe-area-inset-bottom)" }
    : {};
  const modalBody = { maxHeight: isMobile ? "72dvh" : "80vh", overflowY: "auto", padding: isMobile ? 12 : 16 };

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: "#",
      width: 36,
      render: (_, __, i) => (
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</span>
      ),
    },
    {
      title: "Job No",
      dataIndex: "job_no",
      render: (n) => (
        <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
          {n || "—"}
        </Tag>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e" }}>{r.customer_name || "—"}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_phone || ""}</div>
          {isMobile && <StatusTag status={r.job_status} style={{ marginTop: 4, fontSize: 10 }} />}
        </div>
      ),
    },
    ...(!isMobile
      ? [
          {
            title: "Date",
            dataIndex: "order_date",
            render: (d) => (
              <span style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                {d ? dayjs(d).format("DD MMM YY") : "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      title: "Total",
      dataIndex: "total_amount",
      render: (a) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", whiteSpace: "nowrap" }}>
          ₹{parseFloat(a || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    ...(!isMobile
      ? [
          {
            title: "Status",
            dataIndex: "job_status",
            render: (s) => <StatusTag status={s} />,
          },
        ]
      : []),
    ...(isDesktop
      ? [
          {
            title: "Stage",
            key: "stage",
            render: (_, r) => <StageTag stage={r.current_stage?.stage} />,
          },
        ]
      : []),
    {
      title: "",
      width: isMobile ? 110 : 220,
      render: (_, record) => {
        const isQC = record.job_status === "quality_check"&&record.current_stage?.stage !== "quality_check";
        return (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: isMobile ? "flex-start" : "flex-end",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            {/* View */}
            <Tooltip title="View Job Details">
              <Button
                icon={<EyeOutlined />}
                size="small"
                style={{ width: isMobile ? "100%" : "auto", borderColor: "#2563eb", color: "#2563eb" }}
                onClick={() => setViewJob(record)}
              >
                {!isMobile && "View"}
              </Button>
            </Tooltip>

            {/* Assign QC — only when status is quality_check */}
            {isQC && (
              <Tooltip title="Assign Quality Check Person">
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  size="small"
                  style={{ background: "#7c3aed", borderColor: "#7c3aed", width: isMobile ? "100%" : "auto" }}
                  onClick={() => openQcModal(record)}
                >
                  {!isMobile && "Assign QC"}
                </Button>
              </Tooltip>
            )}

            {/* Delete */}
            <Tooltip title="Delete Job">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                style={{ width: isMobile ? "100%" : "auto" }}
                onClick={() => {
                  setDeletingJob(record);
                  setDeleteNotes("");
                  setDeleteError("");
                }}
              >
                {!isMobile && "Delete"}
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: p, background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                color: "#1a1a2e",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              Job Management
              {isSuperAdmin && (
                <Tag color="gold" style={{ fontSize: 11, fontWeight: 600 }}>
                  Super Admin
                </Tag>
              )}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
              <strong>{filteredJobs.length}</strong> jobs · Last refreshed {lastRefreshed.format("HH:mm:ss")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 20,
                padding: "4px 10px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 0 2px #bbf7d0",
                  display: "inline-block",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600, fontFamily: "monospace" }}>
                {fmtCountdown(countdown)}
              </span>
            </div>
            <Tooltip title="Refresh now">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={() => { loadJobs(); startAutoRefresh(); }}
                style={{ borderRadius: 8 }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
          <Input.Search
            placeholder="Search name, phone, job no…"
            allowClear
            onSearch={(v) => { setSearch(v); setPage(1); }}
            onChange={(e) => { if (!e.target.value) { setSearch(""); setPage(1); } }}
            style={{ flex: 1 }}
            size="middle"
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            size="middle"
            onChange={(v) => { setStatusFilter(v || null); setPage(1); }}
            style={{ width: isMobile ? "100%" : 190 }}
          >
            {Object.entries(STATUS_CONFIG).map(([k, { label, color }]) => (
              <Option key={k} value={k}>
                <Tag color={color} style={{ fontWeight: 500 }}>{label}</Tag>
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card
        bodyStyle={{ padding: "0 0 8px 0" }}
        style={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}
      >
        <CustomTable
          dataSource={pagedJobs}
          loading={loading}
          columns={columns}
          scroll={{ x: isMobile ? 360 : 900 }}
          rowKey={(r) => r._id || r.job_no}
          size="small"
          rowClassName={() => (isMobile ? "mobile-table-row" : "")}
          pagination={{
            current: page,
            pageSize,
            total: filteredJobs.length,
            showSizeChanger: !isMobile,
            pageSizeOptions: ["10", "25", "50"],
            showTotal: isMobile ? undefined : (t, [s, e]) => `${s}-${e} of ${t}`,
            onChange: (pg, ps) => { setPage(pg); setPageSize(ps); },
            style: { padding: "8px 12px" },
            size: isMobile ? "small" : "default",
          }}
        />
      </Card>

      {/* ══ VIEW MODAL ══ */}
      <Modal
        open={!!viewJob}
        onCancel={() => setViewJob(null)}
        footer={[
          <Button key="close" onClick={() => setViewJob(null)}>
            Close
          </Button>,
        ]}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EyeOutlined style={{ color: "#2563eb" }} />
            <span style={{ fontWeight: 700 }}>Job Details</span>
            {viewJob && (
              <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
                {viewJob.job_no}
              </Tag>
            )}
          </div>
        }
        width={isMobile ? "100vw" : "min(96vw, 860px)"}
        style={
          isMobile
            ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0, paddingBottom: "env(safe-area-inset-bottom)" }
            : {}
        }
        styles={{ body: { maxHeight: isMobile ? "90dvh" : "85vh", overflowY: "auto", padding: isMobile ? 12 : 20 } }}
        destroyOnClose
      >
        <JobDetailView job={viewJob} isMobile={isMobile} />
      </Modal>

      {/* ══ DELETE MODAL ══ */}
      <Modal
        open={!!deletingJob}
        onCancel={closeDeleteModal}
        maskClosable={!deleteLoading}
        closable={!deleteLoading}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DeleteOutlined style={{ color: "#dc2626" }} />
            <span style={{ fontWeight: 700, color: "#dc2626" }}>Delete Job</span>
          </div>
        }
        footer={[
          <Button key="cancel" onClick={closeDeleteModal} disabled={deleteLoading}>Cancel</Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={deleteLoading}
            disabled={deleteNotes.trim().length < 50}
            onClick={handleDelete}
            icon={<DeleteOutlined />}
          >
            Confirm Delete
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={slideUp}
        styles={{ body: modalBody }}
        destroyOnClose
      >
        {deletingJob && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
              }}
            >
              <ExclamationCircleOutlined style={{ color: "#dc2626", fontSize: 16, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 13 }}>This action cannot be undone.</div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                  Job <strong>{deletingJob.job_no}</strong> for <strong>{deletingJob.customer_name}</strong> will be permanently deleted.
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6, color: "#374151" }}>
                Reason for Deletion <span style={{ color: "#ef4444" }}>*</span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 400,
                    color: deleteNotes.trim().length >= 50 ? "#16a34a" : "#9ca3af",
                  }}
                >
                  ({deleteNotes.trim().length} / 50 min)
                </span>
              </label>
              <TextArea
                rows={4}
                placeholder="Explain why this job is being deleted — e.g. customer cancelled, duplicate entry, wrong details entered…"
                value={deleteNotes}
                onChange={(e) => { setDeleteNotes(e.target.value); if (deleteError) setDeleteError(""); }}
                maxLength={500}
                showCount
                style={{
                  borderRadius: 8,
                  borderColor: deleteError ? "#f87171" : deleteNotes.trim().length >= 50 ? "#86efac" : undefined,
                }}
              />
              {deleteError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>⚠ {deleteError}</div>}
              {deleteNotes.trim().length > 0 && deleteNotes.trim().length < 50 && (
                <div style={{ color: "#d97706", fontSize: 12, marginTop: 6 }}>
                  {50 - deleteNotes.trim().length} more characters needed.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ══ APPROVE MODAL ══ */}
      <Modal
        open={!!approvingJob}
        onCancel={() => { if (!approving) { setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); } }}
        maskClosable={!approving}
        closable={!approving}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
            <span style={{ fontWeight: 700 }}>Approve & Assign to Designer</span>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            disabled={approving}
            onClick={() => { if (!approving) { setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); } }}
          >
            Cancel
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approving}
            disabled={!selectedDesigner || designersLoading}
            onClick={handleApprove}
            style={{ background: "#16a34a", borderColor: "#16a34a" }}
          >
            Approve & Assign
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={slideUp}
        styles={{ body: modalBody }}
        destroyOnClose
      >
        <AssignModalBody
          job={approvingJob}
          members={designers}
          membersLoading={designersLoading}
          selected={selectedDesigner}
          onSelect={setSelectedDesigner}
          infoText='Job will be approved and stage set to "Design".'
        />
      </Modal>

      {/* ══ QUALITY CHECK MODAL ══ */}
      <Modal
        open={!!qcJob}
        onCancel={() => { if (!qcAssigning) { setQcJob(null); setSelectedQcMember(null); setQcMembers([]); } }}
        maskClosable={!qcAssigning}
        closable={!qcAssigning}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: "#7c3aed" }} />
            <span style={{ fontWeight: 700 }}>Assign Quality Check</span>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            disabled={qcAssigning}
            onClick={() => { if (!qcAssigning) { setQcJob(null); setSelectedQcMember(null); setQcMembers([]); } }}
          >
            Cancel
          </Button>,
          <Button
            key="assign"
            type="primary"
            loading={qcAssigning}
            disabled={!selectedQcMember || qcMembersLoading}
            onClick={handleAssignQc}
            style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
          >
            Assign QC
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={slideUp}
        styles={{ body: modalBody }}
        destroyOnClose
      >
        <AssignModalBody
          job={qcJob}
          members={qcMembers}
          membersLoading={qcMembersLoading}
          selected={selectedQcMember}
          onSelect={setSelectedQcMember}
          infoText="The selected person will perform quality check for this job."
        />
      </Modal>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .mobile-table-row td { padding: 8px 6px !important; }
      `}</style>
    </div>
  );
};

export default MyJobs;