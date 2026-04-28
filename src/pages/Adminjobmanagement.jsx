import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Button, Card, Input, Modal, Select, Tag, Tooltip,
  Divider, Spin, InputNumber, Popconfirm, Radio,
} from "antd";
import {
  EyeOutlined, EditOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, SwapOutlined,
  SendOutlined, UserOutlined, EnvironmentOutlined,
  FileTextOutlined, TagOutlined, ShoppingCartOutlined,
  BranchesOutlined, PlayCircleOutlined, PauseCircleOutlined,
  PlusOutlined, DeleteOutlined, SaveOutlined, PhoneOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import UploadHelper from "../helper/UploadHelper";
import { ERROR_NOTIFICATION, SUCCESS_NOTIFICATION } from "../helper/notification_helper";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

// ─── Breakpoint Hook ──────────────────────────────────────────────────────────
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

// ─── Static Configs ───────────────────────────────────────────────────────────
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
};

const WORKFLOW_STAGES = [
  { value: "design", label: "Design" },
  { value: "prepress", label: "Prepress" },
  { value: "printing", label: "Printing" },
  { value: "finishing", label: "Finishing" },
  { value: "quality_check", label: "Quality Check" },
  { value: "dispatch", label: "Dispatch" },
  { value: "delivered", label: "Delivered" },
  { value: "custom", label: "Custom" },
];

const PRODUCTS = [
  {
    product_id: "P001",
    product_name: "flex",
    printing_type: ["Solvent", "Latex", "UV"],
    variations: [
      "Normal Flex", "Flex BB -230gsm", "Flex BB -280gsm",
      "Flex BB -240gsm", "Flex Star Backlight", "Flex Backlight", "Flex BB Star",
    ],
  },
];

const UNIT_OPTIONS = [
  { value: "ft", label: "ft" },
  { value: "inch", label: "inch" },
  { value: "cm", label: "cm" },
];

const QTY_TYPE_OPTIONS = [
  { value: "sq.ft", label: "Sq. Ft" },
  { value: "quantity", label: "Quantity" },
];

// ─── sq.ft calculator ────────────────────────────────────────────────────────
const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w) || 0;
  const hn = parseFloat(h) || 0;
  if (!wn || !hn) return 0;
  if (unit === "ft") return wn * hn;
  if (unit === "inch") return (wn / 12) * (hn / 12);
  if (unit === "cm") return (wn / 30.48) * (hn / 30.48);
  return wn * hn;
};

const EMPTY_ITEM = {
  product_id: "",
  product_name: "",
  variation: "",
  printing_type: "",
  width: "",
  height: "",
  size_unit: "ft",
  sq_ft: 0,
  quantity_type: "sq.ft",
  quantity: 1,
  price: 0,
  design_file: "",
  notes: "",
};

const DEFAULT_EDIT_FORM = {
  customer_name: "",
  customer_phone: "",
  estimated_delivery_date: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  gst_no: "",
  delivery_charges: 0,
  free_delivery: false,
  discount_percentage: 0,
  notes: "",
  terms_and_conditions:
    "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const extractJobs = (d) => {
  if (Array.isArray(d?.data?.jobs)) return d.data.jobs;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.jobs)) return d.jobs;
  if (Array.isArray(d)) return d;
  return [];
};
const extractTotal = (d, fb) => {
  if (typeof d?.data?.total === "number") return d.data.total;
  if (typeof d?.data?.count === "number") return d.data.count;
  if (typeof d?.total === "number") return d.total;
  return fb;
};

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

// ─── Shared UI components ─────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
    <span style={{ color: "#2563eb", fontSize: 14 }}>{icon}</span>
    <span style={{
      fontSize: 11, fontWeight: 700, color: "#374151",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {title}
    </span>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 6 }} />
  </div>
);

const FormField = ({ label, required, children }) => (
  <div>
    <label style={{
      display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280",
      marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

// ─── ProductItemRow ───────────────────────────────────────────────────────────
const ProductItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile, isTablet }) => {
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);

  const matched = PRODUCTS.filter(p =>
    p.product_name.toLowerCase().includes((item.product_name || "").toLowerCase())
  );

  const selected = PRODUCTS.find(
    p => p.product_name.toLowerCase() === (item.product_name || "").toLowerCase()
  );

  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sizeChange = (field, val) => {
    const updated = { ...item, [field]: val };
    const sq = toSqFt(updated.width, updated.height, updated.size_unit);
    onChange(idx, { ...updated, sq_ft: parseFloat(sq.toFixed(4)) });
  };

  const set = (f, v) => onChange(idx, { ...item, [f]: v });

  const handleQtyTypeChange = (val) => {
    onChange(idx, {
      ...item,
      quantity_type: val,
      ...(val === "quantity" ? { width: "", height: "", sq_ft: 0 } : {}),
    });
  };

  const isSqFtMode = item.quantity_type === "sq.ft";
  const lineTotal = isSqFtMode
    ? (item.quantity || 0) * (item.sq_ft || 0) * (item.price || 0)
    : (item.quantity || 0) * (item.price || 0);

  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sizeCols = isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr";
  const priceCols = isMobile ? "1fr 1fr" : isSqFtMode ? "repeat(4,1fr)" : "1fr 1fr 1fr";

  return (
    <div style={{
      background: "#f9fafb", border: "1px solid #e5e7eb",
      borderRadius: 10, padding: isMobile ? 10 : 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#374151",
            background: "#e0e7ff", padding: "2px 10px", borderRadius: 20,
          }}>
            Item {idx + 1}
          </span>
          <Radio.Group
            size="small"
            value={item.quantity_type}
            onChange={(e) => handleQtyTypeChange(e.target.value)}
            buttonStyle="solid"
          >
            {QTY_TYPE_OPTIONS.map(o => (
              <Radio.Button
                key={o.value}
                value={o.value}
                style={{ fontSize: 11, fontWeight: 600, height: 24, lineHeight: "22px", padding: "0 10px" }}
              >
                {o.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <Popconfirm
          title="Remove this item?"
          onConfirm={() => onRemove(idx)}
          disabled={isOnly}
          okText="Yes"
          cancelText="No"
        >
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: productCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Product Name" required>
          <div style={{ position: "relative" }} ref={ref}>
            <Input
              placeholder="Type product…"
              value={item.product_name}
              size="small"
              autoComplete="off"
              style={{ borderRadius: 6 }}
              onChange={(e) => {
                onChange(idx, { ...item, product_name: e.target.value, variation: "", printing_type: "" });
                setShowSuggest(true);
              }}
              onFocus={() => item.product_name && setShowSuggest(true)}
            />
            {showSuggest && matched.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 8, zIndex: 9999,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden",
              }}>
                {matched.map(p => (
                  <div
                    key={p.product_id}
                    onMouseDown={() => {
                      onChange(idx, {
                        ...item,
                        product_name: p.product_name,
                        product_id: p.product_id,
                        variation: "",
                        printing_type: "",
                      });
                      setShowSuggest(false);
                    }}
                    style={{
                      padding: "8px 12px", cursor: "pointer",
                      fontSize: 13, color: "#1a1a2e", fontWeight: 600,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                  >
                    🖨️ {p.product_name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontWeight: 400 }}>
                      {p.printing_type?.join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>

        <FormField label="Variation">
          <Select
            placeholder={selected ? "Select variation" : "—"}
            value={item.variation || undefined}
            size="small"
            style={{ width: "100%" }}
            disabled={!selected}
            onChange={(v) => set("variation", v)}
          >
            {(selected?.variations || []).map(v => <Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>

        <FormField label="Printing Type">
          <Select
            placeholder={selected ? "Select type" : "—"}
            value={item.printing_type || undefined}
            size="small"
            style={{ width: "100%" }}
            disabled={!selected}
            onChange={(v) => set("printing_type", v)}
          >
            {(selected?.printing_type || []).map(t => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>

      {isSqFtMode && (
        <div style={{ display: "grid", gridTemplateColumns: sizeCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
          <FormField label="Width" required>
            <Input
              size="small"
              placeholder="0"
              type="number"
              min={0}
              value={item.width}
              prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>W</span>}
              style={{ borderRadius: 6 }}
              onChange={(e) => sizeChange("width", e.target.value)}
            />
          </FormField>
          <FormField label="Height" required>
            <Input
              size="small"
              placeholder="0"
              type="number"
              min={0}
              value={item.height}
              prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>H</span>}
              style={{ borderRadius: 6 }}
              onChange={(e) => sizeChange("height", e.target.value)}
            />
          </FormField>
          <FormField label="Unit">
            <Select
              value={item.size_unit}
              size="small"
              style={{ width: "100%" }}
              onChange={(v) => sizeChange("size_unit", v)}
            >
              {UNIT_OPTIONS.map(u => <Option key={u.value} value={u.value}>{u.label}</Option>)}
            </Select>
          </FormField>
          <FormField label="Sq. Ft (auto)">
            <div style={{
              background: item.sq_ft > 0 ? "#ecfdf5" : "#f9fafb",
              border: `1px solid ${item.sq_ft > 0 ? "#6ee7b7" : "#e5e7eb"}`,
              borderRadius: 6, padding: "4px 10px", height: 24,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: item.sq_ft > 0 ? "#065f46" : "#9ca3af",
              }}>
                {item.sq_ft > 0 ? `${item.sq_ft} ft²` : "—"}
              </span>
            </div>
          </FormField>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes / Specs">
          <Input
            placeholder="Custom text, specs…"
            value={item.notes}
            size="small"
            style={{ borderRadius: 6 }}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: priceCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Quantity" required>
          <InputNumber
            min={1}
            value={item.quantity}
            size="small"
            style={{ width: "100%", borderRadius: 6 }}
            onChange={(v) => set("quantity", v || 1)}
          />
        </FormField>

        {isSqFtMode && (
          <FormField label="Sq.Ft / piece">
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 6, padding: "4px 10px", height: 24,
              display: "flex", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                {item.sq_ft > 0 ? `${item.sq_ft} ft²` : "—"}
              </span>
            </div>
          </FormField>
        )}

        <FormField label={isSqFtMode ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber
            min={0}
            value={item.price}
            size="small"
            style={{ width: "100%", borderRadius: 6 }}
            prefix="₹"
            onChange={(v) => set("price", v || 0)}
          />
        </FormField>

        <FormField label="Design File">
          <UploadHelper
            setImagePath={(path) => set("design_file", path)}
            image_path={item.design_file}
          />
        </FormField>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background: "#fff", border: "1px solid #d1fae5",
          borderRadius: 8, padding: "6px 14px", textAlign: "right",
        }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Item Total</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
            ₹{lineTotal.toFixed(2)}
          </div>
          {isSqFtMode && item.sq_ft > 0 && (
            <div style={{ fontSize: 10, color: "#059669" }}>
              {item.quantity} × {item.sq_ft} ft² × ₹{item.price}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════════════════════
const AdminJobManagement = () => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // ── Table state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [editModal, setEditModal] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [editForm, setEditForm] = useState({ ...DEFAULT_EDIT_FORM });
  const [editItems, setEditItems] = useState([{ ...EMPTY_ITEM }]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Approve modal state ───────────────────────────────────────────────────
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingJob, setApprovingJob] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState(null);
  const [approving, setApproving] = useState(false);
  const [designersLoading, setDesignersLoading] = useState(false);

  const autoRefreshRef = useRef(null);
  const countdownRef = useRef(null);

  // ── Fetch jobs ────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("http://localhost:8000/api/jobs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      const data = await res.json();
      const rows = extractJobs(data);
      setJobs(rows);
      setTotal(extractTotal(data, rows.length));
      setLastRefreshed(dayjs());
      setCountdown(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err) {
      ERROR_NOTIFICATION({ message: err.message || "Failed to load jobs" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_INTERVAL / 1000);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);
    autoRefreshRef.current = setInterval(() => loadJobs(true), AUTO_REFRESH_INTERVAL);
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
    startAutoRefresh();
    return () => {
      clearInterval(autoRefreshRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const handleManualRefresh = () => { loadJobs(); startAutoRefresh(); };

  // ── FIX: fetchDesigners returns the list so caller can use it immediately ──
  const fetchDesigners = async () => {
    setDesignersLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/admin/get_admin", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      const data = await res.json();
      const designTeam = (data.data || []).filter(user => user.role === "designing team");
      setDesigners(designTeam);
      return designTeam; // ← return list so openApproveModal can use it immediately
    } catch (err) {
      console.error("Failed to fetch designers", err);
      ERROR_NOTIFICATION({ message: "Could not load designers list" });
      return [];
    } finally {
      setDesignersLoading(false);
    }
  };

  // ── FIX: use returned list, not stale state ────────────────────────────────
  const openApproveModal = async (job) => {
    setApprovingJob(job);
    setSelectedDesigner(null);
    setApproveModalOpen(true); // open modal first so user sees loading spinner
    await fetchDesigners();    // then populate list — state update triggers re-render
  };

  // ── FIX: setApproving(false) always runs via finally; adminId/Name guard ──
  const handleApproveWithDesigner = async () => {
    if (!selectedDesigner) {
      ERROR_NOTIFICATION({ message: "Please select a designer to assign this job." });
      return;
    }

    setApproving(true);
    try {
      const adminId = localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile"))._id : null;
      const adminName = localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile")).name : null;

      // FIX: was early-returning inside try without hitting finally,
      // leaving the button stuck in loading state forever.
      // Now we just throw so finally always fires.
      // if (!adminId || !adminName) {
      //   throw new Error("Admin information missing. Please log in again.");
      // }

      // FIX: guard designer name field — API may use 'name', 'fullName', etc.
      const designerName =
        selectedDesigner.name ||
        selectedDesigner.fullName ||
        selectedDesigner.username ||
        "Unknown";

      const response = await fetch(`http://localhost:8000/api/jobs/${approvingJob._id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          job_status: "design",
          approved_by: adminName,
          approved_by_admin_id: adminId,
          assign_to: {
            user_id: selectedDesigner._id,
            name: designerName,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Approval failed");
      }

      SUCCESS_NOTIFICATION({
        message: `Job ${approvingJob.job_no} approved & assigned to ${designerName}`,
      });
      setApproveModalOpen(false);
      setApprovingJob(null);
      setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) {
      console.error("Approve error:", err);
      ERROR_NOTIFICATION({ message: err.message || "Failed to approve job" });
    } finally {
      // FIX: this always runs now — button never gets stuck in loading
      setApproving(false);
    }
  };

  const closeApproveModal = () => {
    if (approving) return; // prevent close while submitting
    setApproveModalOpen(false);
    setApprovingJob(null);
    setSelectedDesigner(null);
    setDesigners([]);
  };

  // ── Open Edit modal ───────────────────────────────────────────────────────
  const openEditModal = (record) => {
    setEditJob(record);
    setEditError("");

    const addr = record.delivery_address || {};
    const streetParts = (addr.street || "").split(", ");
    const address_line1 = streetParts[0] || "";
    const address_line2 = streetParts.slice(1).join(", ") || "";

    setEditForm({
      customer_name: record.customer_name || "",
      customer_phone: record.customer_phone || "",
      estimated_delivery_date: record.estimated_delivery_date
        ? dayjs(record.estimated_delivery_date).format("YYYY-MM-DDTHH:mm")
        : "",
      address_line1,
      address_line2,
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      country: addr.country || "India",
      gst_no: record.gst_no || "",
      delivery_charges: record.delivery_charges ?? 0,
      free_delivery: record.free_delivery ?? false,
      discount_percentage: record.discount_percentage ?? 0,
      notes: record.notes || "",
      terms_and_conditions: record.terms_and_conditions ||
        "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
    });

    const items = (record.cart_items || []).map(it => {
      let width = String(it.width || "");
      let height = String(it.height || "");
      let size_unit = it.size_unit || "ft";

      if ((!width || !height) && it.size) {
        const m = it.size.match(/^([\d.]+)\s*[×xX]\s*([\d.]+)\s*(\w+)/);
        if (m) {
          width = m[1];
          height = m[2];
          size_unit = m[3] || "ft";
        }
      }

      const quantity_type = it.quantity_type ||
        (parseFloat(width) > 0 && parseFloat(height) > 0 ? "sq.ft" : "quantity");

      const sq_ft = quantity_type === "sq.ft"
        ? parseFloat(toSqFt(width, height, size_unit).toFixed(4))
        : 0;

      return { ...EMPTY_ITEM, ...it, width, height, size_unit, sq_ft, quantity_type };
    });

    setEditItems(items.length ? items : [{ ...EMPTY_ITEM }]);
    setEditModal(true);
  };

  const resetEditModal = () => {
    setEditModal(false);
    setEditJob(null);
    setEditError("");
    setEditForm({ ...DEFAULT_EDIT_FORM });
    setEditItems([{ ...EMPTY_ITEM }]);
  };

  // ── Edit item helpers ─────────────────────────────────────────────────────
  const handleEditInput = (k, v) => setEditForm(p => ({ ...p, [k]: v }));
  const handleEditItem = (i, u) => setEditItems(p => p.map((it, j) => j === i ? u : it));
  const addEditItem = () => setEditItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeEditItem = (i) => setEditItems(p => p.filter((_, j) => j !== i));

  // ── Totals ────────────────────────────────────────────────────────────────
  const editTotals = useMemo(() => {
    const sub = editItems.reduce((s, it) => {
      const line = it.quantity_type === "sq.ft"
        ? (it.quantity || 0) * (it.sq_ft || 0) * (it.price || 0)
        : (it.quantity || 0) * (it.price || 0);
      return s + line;
    }, 0);
    const disc = sub * ((parseFloat(editForm.discount_percentage) || 0) / 100);
    const after = sub - disc;
    const tax = after * 0.18;
    const del = editForm.free_delivery ? 0 : parseFloat(editForm.delivery_charges) || 0;
    return { sub, disc, after, tax, del, total: after + tax + del };
  }, [editItems, editForm]);

  // ── Submit edit ───────────────────────────────────────────────────────────
  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditError("");
    try {
      if (!editForm.customer_name.trim()) throw new Error("Customer name is required");
      if (!editForm.customer_phone.trim()) throw new Error("Phone number is required");
      if (!editForm.estimated_delivery_date) throw new Error("Estimated delivery date is required");

      const valid = editItems.filter(it => {
        if (!it.product_name || !it.quantity_type) return false;
        if (it.quantity_type === "sq.ft" && (it.sq_ft || 0) <= 0) return false;
        return (it.quantity || 0) > 0 && (it.price || 0) > 0;
      });

      if (!valid.length) throw new Error("Add at least one valid product with size/qty and price");

      const payload = {
        customer_name: editForm.customer_name.trim(),
        customer_phone: editForm.customer_phone.trim(),
        estimated_delivery_date: dayjs(editForm.estimated_delivery_date).toISOString(),
        delivery_address: {
          street: [editForm.address_line1, editForm.address_line2].filter(Boolean).join(", "),
          city: editForm.city,
          state: editForm.state,
          pincode: editForm.pincode,
          country: editForm.country,
        },
        cart_items: valid.map(it => ({
          product_id: it.product_id || "",
          product_name: it.product_name,
          variation: it.variation || "",
          printing_type: it.printing_type || "",
          quantity: it.quantity,
          quantity_type: it.quantity_type,
          price: it.price,
          design_file: it.design_file || "",
          notes: it.notes || "",
          width: it.quantity_type === "sq.ft" ? it.width : "",
          height: it.quantity_type === "sq.ft" ? it.height : "",
          size_unit: it.quantity_type === "sq.ft" ? it.size_unit : "",
          sq_ft: it.quantity_type === "sq.ft" ? it.sq_ft : 0,
          size: it.quantity_type === "sq.ft" && it.width && it.height
            ? `${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)`
            : "",
        })),
        gst_no: editForm.gst_no.trim(),
        delivery_charges: editForm.free_delivery ? 0 : parseFloat(editForm.delivery_charges) || 0,
        free_delivery: editForm.free_delivery,
        discount_percentage: parseFloat(editForm.discount_percentage || 0),
        subtotal: editTotals.sub,
        discount_amount: editTotals.disc,
        taxable_amount: editTotals.after,
        tax_amount: editTotals.tax,
        total_amount: editTotals.total,
        notes: editForm.notes,
        terms_and_conditions: editForm.terms_and_conditions,
      };

      const res = await fetch(`http://localhost:8000/api/jobs/${editJob._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update job");

      SUCCESS_NOTIFICATION({ message: "Job updated successfully!" });
      resetEditModal();
      loadJobs(true);
    } catch (err) {
      setEditError(err.message || "Failed to update job");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Layout vars ───────────────────────────────────────────────────────────
  const p = isMobile ? 8 : 12;
  const g = isMobile ? 8 : 12;
  const c2 = isMobile ? "1fr" : "1fr 1fr";
  const c3 = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const c4 = isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr" : "repeat(4,1fr)";

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const modalWidth = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw,900px)";
  const mobileFullStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};
  const modalBodyStyle = {
    maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh",
    overflowY: "auto",
    padding: isMobile ? 10 : 16,
  };
  const sheetStyle = isMobile
    ? { top: "auto", bottom: 0, margin: 0, maxWidth: "100vw", padding: 0 }
    : {};
  const sheetBodyStyle = {
    maxHeight: isMobile ? "72dvh" : "80vh",
    overflowY: "auto",
    padding: isMobile ? 12 : 16,
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: "#", width: 36,
      render: (_, __, i) => (
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</span>
      ),
    },
    {
      title: "Job No", dataIndex: "job_no",
      render: (n) => (
        <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
          {n || "—"}
        </Tag>
      ),
    },
    {
      title: "Customer", key: "customer",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e" }}>{r.customer_name || "—"}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_phone || ""}</div>
          {isMobile && (() => {
            const cfg = STATUS_CONFIG[r.job_status] || STATUS_CONFIG.draft;

            return (
              <Tag color={cfg.color} icon={cfg.icon} style={{ marginTop: 4, fontSize: 10 }}>
                {cfg.label}
              </Tag>
            );
          })()}
        </div>
      ),
    },
    ...(!isMobile ? [{
      title: "Date", dataIndex: "order_date",
      render: (d) => (
        <span style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
          {d ? dayjs(d).format("DD MMM YY") : "—"}
        </span>
      ),
    }] : []),
    {
      title: "Total", dataIndex: "total_amount",
      render: (a) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", whiteSpace: "nowrap" }}>
          ₹{parseFloat(a || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    ...(!isMobile ? [{
      title: "Status", dataIndex: "job_status",
      render: (s) => {
        const c = STATUS_CONFIG[s] || STATUS_CONFIG.draft;
        return <Tag color={c.color} icon={c.icon} style={{ fontWeight: 500 }}>{c.label}</Tag>;
      },
    }] : []),
    ...(isDesktop ? [{
      title: "Stage", key: "stage",
      render: (_, r) => {
        const stage = r.current_stage?.stage;
        const label = WORKFLOW_STAGES.find(s => s.value === stage)?.label;
        return stage
          ? <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>{label}</Tag>
          : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
      },
    }] : []),
    {
      title: "", width: isMobile ? 90 : 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Tooltip title="Edit Job">
            <Button
              icon={<EditOutlined />}
              size="small"
              style={{ color: "#2563eb", borderColor: "#bfdbfe" }}
              onClick={() => openEditModal(record)}
            >
              {!isMobile && "Edit"}
            </Button>
          </Tooltip>
          {record.job_status === "draft" ? (
            <Tooltip title="Approve & Assign">
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={false}
                size="small"
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
                onClick={() => openApproveModal(record)}
              >
                {!isMobile && "Approve"}
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={true}
              size="small"
              style={{ background: "#9ca3af", borderColor: "#9ca3af", cursor: "not-allowed" }}
            >
              {!isMobile && "Approved"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: p, background: "#f8fafc", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{
          borderRadius: 12, border: "1px solid #e5e7eb",
          marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 8,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "#1a1a2e" }}>
              Job Management
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              <strong>{total}</strong> jobs · Last refreshed {lastRefreshed.format("HH:mm:ss")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 20, padding: "4px 10px",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
                boxShadow: "0 0 0 2px #bbf7d0", display: "inline-block",
                animation: "pulse 1.5s infinite",
              }} />
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600, fontFamily: "monospace" }}>
                {formatCountdown(countdown)}
              </span>
            </div>
            <Tooltip title="Refresh now">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={handleManualRefresh}
                style={{ borderRadius: 8 }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* ── Filters ── */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{
          borderRadius: 12, border: "1px solid #e5e7eb",
          marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
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
            placeholder="Filter Status"
            allowClear
            onChange={(v) => { setStatusFilter(v || null); setPage(1); }}
            size="middle"
            style={{ width: isMobile ? "100%" : 180 }}
          >
            {Object.entries(STATUS_CONFIG).map(([k, { label, color }]) => (
              <Option key={k} value={k}>
                <Tag color={color} style={{ fontWeight: 500 }}>{label}</Tag>
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card
        bodyStyle={{ padding: "0 0 8px 0" }}
        style={{
          borderRadius: 12, border: "1px solid #e5e7eb",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden",
        }}
      >
        <CustomTable
          dataSource={jobs}
          loading={loading}
          columns={columns}
          scroll={{ x: isMobile ? 360 : 820 }}
          rowKey={(r) => r._id || r.job_no}
          size="small"
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: !isMobile,
            pageSizeOptions: ["10", "25", "50"],
            showTotal: isMobile ? undefined : (t, r) => `${r[0]}-${r[1]} of ${t}`,
            onChange: (pg, ps) => { setPage(pg); setPageSize(ps); },
            style: { padding: "8px 12px" },
            size: isMobile ? "small" : "default",
          }}
        />
      </Card>

      {/* ════════════ EDIT JOB MODAL ════════════ */}
      <Modal
        open={editModal}
        onCancel={resetEditModal}
        footer={null}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EditOutlined style={{ color: "#2563eb" }} />
            <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>Edit Job</span>
            {editJob && (
              <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
                {editJob.job_no}
              </Tag>
            )}
          </div>
        }
        width={modalWidth}
        style={mobileFullStyle}
        styles={{
          body: modalBodyStyle,
          header: {
            padding: `${isMobile ? 10 : 14}px ${isMobile ? 12 : 16}px`,
            borderBottom: "1px solid #f0f0f0",
          },
        }}
        destroyOnClose
      >
        <Spin spinning={editLoading}>
          {editError && (
            <div style={{
              marginBottom: 12, padding: "10px 14px",
              background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 8, color: "#b91c1c", fontSize: 13,
            }}>
              ⚠ {editError}
            </div>
          )}

          <SectionHeader icon={<UserOutlined />} title="Customer Info" />
          <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: 14 }}>
            <FormField label="Customer Name" required>
              <Input
                prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
                placeholder="Full name"
                value={editForm.customer_name}
                onChange={(e) => handleEditInput("customer_name", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
            <FormField label="Phone" required>
              <Input
                prefix={<PhoneOutlined style={{ color: "#9ca3af" }} />}
                placeholder="10-digit mobile"
                value={editForm.customer_phone}
                maxLength={10}
                onChange={(e) => handleEditInput("customer_phone", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
            <FormField label="Est. Delivery Date" required>
              <Input
                type="datetime-local"
                value={editForm.estimated_delivery_date}
                onChange={(e) => handleEditInput("estimated_delivery_date", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
          </div>

          <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
          <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: c2, gap: g }}>
              <FormField label="Address Line 1">
                <Input
                  placeholder="Flat / Door No, Building"
                  value={editForm.address_line1}
                  onChange={(e) => handleEditInput("address_line1", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </FormField>
              <FormField label="Address Line 2">
                <Input
                  placeholder="Street, Area, Landmark"
                  value={editForm.address_line2}
                  onChange={(e) => handleEditInput("address_line2", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: c4, gap: g }}>
              {[
                ["city", "City", "City"],
                ["state", "State", "State"],
                ["pincode", "Pincode", "6-digit"],
                ["country", "Country", "Country"],
              ].map(([k, label, ph]) => (
                <FormField key={k} label={label}>
                  <Input
                    placeholder={ph}
                    value={editForm[k]}
                    onChange={(e) => handleEditInput(k, e.target.value)}
                    style={{ borderRadius: 8 }}
                  />
                </FormField>
              ))}
            </div>
          </div>

          <SectionHeader icon={<ShoppingCartOutlined />} title="Job Items" />
          <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
            {editItems.map((item, idx) => (
              <ProductItemRow
                key={idx}
                item={item}
                idx={idx}
                onChange={handleEditItem}
                onRemove={removeEditItem}
                isOnly={editItems.length === 1}
                isMobile={isMobile}
                isTablet={isTablet}
              />
            ))}
            <Button
              icon={<PlusOutlined />}
              onClick={addEditItem}
              style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 40 }}
            >
              Add Item
            </Button>
          </div>

          <SectionHeader icon={<TagOutlined />} title="Pricing & Tax" />
          <div style={{ display: "grid", gridTemplateColumns: c4, gap: g, marginBottom: 14 }}>
            <FormField label="GST Number">
              <Input
                placeholder="GSTIN"
                maxLength={15}
                value={editForm.gst_no}
                onChange={(e) => handleEditInput("gst_no", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
            <FormField label="Discount (%)">
              <InputNumber
                min={0}
                max={100}
                value={editForm.discount_percentage}
                style={{ width: "100%", borderRadius: 8 }}
                prefix={<PercentageOutlined />}
                onChange={(v) => handleEditInput("discount_percentage", v || 0)}
              />
            </FormField>
            <FormField label="Delivery Charges (₹)">
              <InputNumber
                min={0}
                value={editForm.free_delivery ? 0 : editForm.delivery_charges}
                disabled={editForm.free_delivery}
                style={{ width: "100%", borderRadius: 8 }}
                prefix="₹"
                onChange={(v) => handleEditInput("delivery_charges", v || 0)}
              />
            </FormField>
            <FormField label="Free Delivery">
              <div
                onClick={() => handleEditInput("free_delivery", !editForm.free_delivery)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  background: editForm.free_delivery ? "#f0fdf4" : "#f9fafb",
                  border: `1px solid ${editForm.free_delivery ? "#86efac" : "#e5e7eb"}`,
                  borderRadius: 8, padding: "6px 12px",
                  userSelect: "none", transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 36, height: 20, borderRadius: 10,
                  background: editForm.free_delivery ? "#22c55e" : "#d1d5db",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{
                    position: "absolute", top: 2,
                    left: editForm.free_delivery ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: editForm.free_delivery ? "#16a34a" : "#6b7280",
                }}>
                  {editForm.free_delivery ? "Free 🎉" : "Paid"}
                </span>
              </div>
            </FormField>
          </div>

          <SectionHeader icon={<FileTextOutlined />} title="Notes & Terms" />
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
            <FormField label="Notes">
              <TextArea
                rows={3}
                placeholder="Additional notes…"
                value={editForm.notes}
                onChange={(e) => handleEditInput("notes", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
            <FormField label="Terms & Conditions">
              <TextArea
                rows={3}
                value={editForm.terms_and_conditions}
                onChange={(e) => handleEditInput("terms_and_conditions", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
          </div>

          {/* Order Summary */}
          <div style={{
            background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)",
            border: "1px solid #bfdbfe", borderRadius: 10,
            padding: isMobile ? 12 : "14px 16px", marginBottom: 14,
          }}>
            <div style={{
              fontWeight: 700, color: "#1e40af", marginBottom: 10,
              fontSize: 14, display: "flex", alignItems: "center", gap: 6,
            }}>
              <FileTextOutlined /> Order Summary
            </div>
            {[
              { label: "Subtotal", value: `₹${editTotals.sub.toFixed(2)}` },
              ...(editTotals.disc > 0 ? [{
                label: `Discount (${editForm.discount_percentage}%)`,
                value: `- ₹${editTotals.disc.toFixed(2)}`,
                color: "#059669",
              }] : []),
              { label: "GST (18%)", value: `₹${editTotals.tax.toFixed(2)}` },
              {
                label: "Delivery",
                value: editForm.free_delivery ? "Free 🎉" : `₹${editTotals.del.toFixed(2)}`,
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 13, color: color || "#4b5563", marginBottom: 4,
              }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <Divider style={{ margin: "8px 0" }} />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: isMobile ? 14 : 15, fontWeight: 800,
            }}>
              <span style={{ color: "#1a1a2e" }}>Grand Total</span>
              <span style={{ color: "#2563eb" }}>₹{editTotals.total.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button
              onClick={resetEditModal}
              style={{ borderRadius: 8, height: 40, flex: isMobile ? 1 : undefined }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleEditSubmit}
              loading={editLoading}
              style={{
                background: "#2563eb", border: "none",
                borderRadius: 8, height: 40, fontWeight: 600,
                flex: isMobile ? 1 : undefined,
              }}
            >
              Save Changes
            </Button>
          </div>
        </Spin>
      </Modal>

      {/* ════════════ APPROVE & ASSIGN MODAL ════════════ */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
            <span style={{ fontWeight: 700 }}>Approve & Assign Job</span>
          </div>
        }
        open={approveModalOpen}
        onCancel={closeApproveModal}
        maskClosable={!approving}
        closable={!approving}
        footer={[
          <Button key="cancel" onClick={closeApproveModal} disabled={approving}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={approving}
            disabled={!selectedDesigner || designersLoading}
            onClick={handleApproveWithDesigner}
            style={{ background: "#16a34a", borderColor: "#16a34a" }}
          >
            Approve & Assign
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={sheetStyle}
        styles={{ body: sheetBodyStyle }}
        destroyOnClose
      >
        {approvingJob && (
          <div>
            {/* Job summary card */}
            <div style={{
              background: "#f8fafc", borderRadius: 8,
              padding: "10px 12px", marginBottom: 16,
              border: "1px solid #e5e7eb",
            }}>
              <div style={{
                fontFamily: "monospace", fontWeight: 700,
                color: "#2563eb", fontSize: 14,
              }}>
                {approvingJob.job_no}
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>
                {approvingJob.customer_name || "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {approvingJob.customer_phone || ""}
              </div>
              <div style={{ marginTop: 6, fontSize: 11 }}>
                Current status:{" "}
                {(() => {
                  const cfg = STATUS_CONFIG[approvingJob.job_status] || STATUS_CONFIG.draft;
                  return (
                    <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 500 }}>
                      {cfg.label}
                    </Tag>
                  );
                })()}
              </div>
            </div>

            {/* Designer selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontWeight: 600,
                marginBottom: 8, fontSize: 13,
              }}>
                Select Designer to Assign <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Select
                placeholder={designersLoading ? "Loading designers…" : "Choose a designer"}
                style={{ width: "100%" }}
                value={selectedDesigner?._id || undefined}
                loading={designersLoading}
                disabled={designersLoading}
                onChange={(id) => {
                  const designer = designers.find(d => d._id === id);
                  setSelectedDesigner(designer || null);
                }}
                notFoundContent={
                  designersLoading
                    ? "Loading…"
                    : "No designers found"
                }
              >
                {designers.map(d => (
                  <Option key={d._id} value={d._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <UserOutlined style={{ color: "#6b7280", fontSize: 12 }} />
                      <span>{d.name || d.fullName || d.username || d._id}</span>
                    </div>
                  </Option>
                ))}
              </Select>

              {!designersLoading && designers.length === 0 && (
                <div style={{
                  marginTop: 8, color: "#b45309", fontSize: 12,
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: 6, padding: "6px 10px",
                }}>
                  ⚠️ No designers found. Add a user with role "designing team" first.
                </div>
              )}
            </div>

            {/* Info note */}
            <div style={{
              fontSize: 12, color: "#6b7280",
              background: "#fefce8", padding: "8px 10px",
              borderRadius: 6, border: "1px solid #fef08a",
            }}>
              ℹ️ The job will be approved and assigned to the selected designer with stage set to <strong>Design</strong>.
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default AdminJobManagement;