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
  PercentageOutlined, WalletOutlined, BankOutlined,
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
  draft:       { label: "Draft",       color: "default",  icon: <FileTextOutlined /> },
  sent:        { label: "Sent",        color: "blue",     icon: <SendOutlined /> },
  viewed:      { label: "Viewed",      color: "cyan",     icon: <EyeOutlined /> },
  accepted:    { label: "Accepted",    color: "green",    icon: <CheckCircleOutlined /> },
  design:      { label: "Design",      color: "blue",     icon: <FileTextOutlined /> },
  in_progress: { label: "In Progress", color: "gold",     icon: <PlayCircleOutlined /> },
  on_hold:     { label: "On Hold",     color: "orange",   icon: <PauseCircleOutlined /> },
  rejected:    { label: "Rejected",    color: "red",      icon: <CloseCircleOutlined /> },
  expired:     { label: "Expired",     color: "volcano",  icon: <ClockCircleOutlined /> },
  completed:   { label: "Completed",   color: "purple",   icon: <CheckCircleOutlined /> },
  converted:   { label: "Converted",   color: "geekblue", icon: <SwapOutlined /> },
};

const WORKFLOW_STAGES = [
  { value: "design",        label: "Design" },
  { value: "prepress",      label: "Prepress" },
  { value: "printing",      label: "Printing" },
  { value: "finishing",     label: "Finishing" },
  { value: "quality_check", label: "Quality Check" },
  { value: "dispatch",      label: "Dispatch" },
  { value: "delivered",     label: "Delivered" },
  { value: "custom",        label: "Custom" },
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
  { value: "ft",   label: "ft" },
  { value: "inch", label: "inch" },
  { value: "cm",   label: "cm" },
];

const QTY_TYPE_OPTIONS = [
  { value: "sq.ft",    label: "Sq. Ft" },
  { value: "quantity", label: "Quantity" },
];

const GST_OPTIONS = [0, 5, 12, 18, 28];

// ✅ Payment modes — same as CreateJobModal
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Cash on Delivery"];

// ─── sq.ft auto-calculator ────────────────────────────────────────────────────
const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w) || 0;
  const hn = parseFloat(h) || 0;
  if (!wn || !hn) return 0;
  if (unit === "ft")   return wn * hn;
  if (unit === "inch") return (wn / 12) * (hn / 12);
  if (unit === "cm")   return (wn / 30.48) * (hn / 30.48);
  return wn * hn;
};

// ─── Per-item calculation helper ──────────────────────────────────────────────
const calcItemTotals = (it) => {
  const qty    = parseFloat(it.quantity)       || 0;
  const sqFt   = parseFloat(it.sq_ft)          || 0;
  const price  = parseFloat(it.price)          || 0;
  const gstPct = parseFloat(it.gst_percentage) || 0;
  const isSqFt = it.quantity_type === "sq.ft";

  const base      = isSqFt ? qty * sqFt * price : qty * price;
  const gstAmt    = base * (gstPct / 100);
  const lineTotal = base + gstAmt;

  return { base, gstAmt, lineTotal, qty, sqFt, price, gstPct, isSqFt };
};

// ─── Job-level totals for VIEW modal ──────────────────────────────────────────
const calcJobTotals = (job) => {
  const cartItems = job.cart_items || [];
  let subtotal  = 0;
  let taxAmount = 0;

  cartItems.forEach((it) => {
    const { base, gstAmt } = calcItemTotals(it);
    subtotal  += base;
    taxAmount += gstAmt;
  });

  const discountPct     = parseFloat(job.discount_percentage) || 0;
  const discountAmt     = subtotal * (discountPct / 100);
  const taxableAmount   = subtotal - discountAmt;
  const designCharges   = parseFloat(job.design_charges)    || 0;
  const deliveryCharges = job.free_delivery ? 0 : (parseFloat(job.delivery_charges) || 0);
  const grandTotal      = taxableAmount + taxAmount + designCharges + deliveryCharges;

  return {
    subtotal, discountPct, discountAmt, taxableAmount,
    taxAmount, designCharges, deliveryCharges, grandTotal,
    freeDelivery: !!job.free_delivery,
  };
};

const EMPTY_ITEM = {
  product_id:     "",
  product_name:   "",
  variation:      "",
  printing_type:  "",
  width:          "",
  height:         "",
  size_unit:      "ft",
  sq_ft:          0,
  quantity_type:  "sq.ft",
  quantity:       1,
  price:          0,
  gst_percentage: 0,
  design_file:    "",
  notes:          "",
};

// ✅ Added payment_mode and payment_amount to DEFAULT_EDIT_FORM
const DEFAULT_EDIT_FORM = {
  customer_name:           "",
  customer_phone:          "",
  company_name:            "",
  estimated_delivery_date: "",
  address_line1:           "",
  address_line2:           "",
  city:                    "",
  state:                   "",
  pincode:                 "",
  country:                 "India",
  gst_no:                  "",
  delivery_charges:        0,
  free_delivery:           false,
  design_charges:          0,
  discount_percentage:     0,
  payment_mode:            "",
  payment_amount:          "",
  notes:                   "",
  terms_and_conditions:
    "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const extractJobs  = (d) => {
  if (Array.isArray(d?.data?.jobs)) return d.data.jobs;
  if (Array.isArray(d?.data))       return d.data;
  if (Array.isArray(d?.jobs))       return d.jobs;
  if (Array.isArray(d))             return d;
  return [];
};
const extractTotal = (d, fb) => {
  if (typeof d?.data?.pagination?.total === "number") return d.data.pagination.total;
  if (typeof d?.data?.total === "number") return d.data.total;
  if (typeof d?.data?.count === "number") return d.data.count;
  if (typeof d?.total === "number")       return d.total;
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

const InfoRow = ({ label, value, valueStyle }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", ...valueStyle }}>
      {value || "—"}
    </div>
  </div>
);

const SummaryRow = ({ label, value, color, bold, borderTop }) => (
  <div style={{
    display: "flex", justifyContent: "space-between",
    fontSize: bold ? 15 : 13,
    fontWeight: bold ? 800 : 600,
    color: color || "#4b5563",
    marginBottom: bold ? 0 : 4,
    paddingTop: borderTop ? 8 : 0,
    borderTop: borderTop ? "1px solid #e5e7eb" : "none",
  }}>
    <span style={{ color: bold ? "#1a1a2e" : undefined }}>{label}</span>
    <span style={{ color: color || (bold ? "#2563eb" : undefined) }}>{value}</span>
  </div>
);

// ─── ProductItemRow (EDIT MODE) ───────────────────────────────────────────────
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
    if (item.quantity_type === "sq.ft") {
      const sq = toSqFt(updated.width, updated.height, updated.size_unit);
      updated.sq_ft = parseFloat(sq.toFixed(4));
    }
    onChange(idx, updated);
  };

  const set = (f, v) => onChange(idx, { ...item, [f]: v });

  const handleQtyTypeChange = (val) => {
    onChange(idx, {
      ...item,
      quantity_type: val,
      ...(val === "quantity" ? { sq_ft: 0 } : {}),
    });
  };

  const { base, gstAmt, lineTotal, isSqFt } = calcItemTotals(item);
  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sizeCols    = isSqFt
    ? (isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr")
    : (isMobile ? "1fr 1fr" : "1fr 1fr 90px");
  const priceCols   = isMobile ? "1fr 1fr" : "repeat(3,1fr)";

  return (
    <div style={{
      background: "#f9fafb", border: "1px solid #e5e7eb",
      borderRadius: 10, padding: isMobile ? 10 : 14,
    }}>
      {/* Row Header */}
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

      {/* Product / Variation / Printing */}
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
                        product_name:  p.product_name,
                        product_id:    p.product_id,
                        variation:     "",
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
                    {p.product_name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontWeight: 400 }}>
                      {p.printing_type?.join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>

        <FormField label="Material">
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

      {/* Size fields */}
      <div style={{ display: "grid", gridTemplateColumns: sizeCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
        <FormField label="Width" required={isSqFt}>
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

        <FormField label="Height" required={isSqFt}>
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

        {isSqFt && (
          <FormField label="Sq. Ft (editable)">
            <InputNumber
              size="small"
              min={0}
              precision={4}
              value={item.sq_ft}
              style={{
                width: "100%", borderRadius: 6,
                background: item.sq_ft > 0 ? "#ecfdf5" : undefined,
                borderColor: item.sq_ft > 0 ? "#6ee7b7" : undefined,
              }}
              onChange={(v) => set("sq_ft", parseFloat((v || 0).toFixed(4)))}
            />
          </FormField>
        )}
      </div>

      {/* Notes */}
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

      {/* Price / GST / Qty */}
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
        <FormField label={isSqFt ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber
            min={0}
            value={item.price}
            size="small"
            style={{ width: "100%", borderRadius: 6 }}
            prefix="₹"
            onChange={(v) => set("price", v || 0)}
          />
        </FormField>
        <FormField label="GST %">
          <Select
            value={item.gst_percentage ?? 0}
            size="small"
            style={{ width: "100%" }}
            onChange={(v) => set("gst_percentage", v)}
          >
            {GST_OPTIONS.map(g => (
              <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>
            ))}
          </Select>
        </FormField>
      </div>

      {/* Design File */}
      <div style={{ marginBottom: 10 }}>
        <FormField label="Design File">
          <UploadHelper
            setImagePath={(path) => set("design_file", path)}
            image_path={item.design_file}
          />
        </FormField>
      </div>
      {item.design_file && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#6b7280",
            marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Design Preview
          </div>
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: 8,
            background: "#f9fafb", padding: 4,
            display: "flex", justifyContent: "center",
          }}>
            <img
              src={item.design_file}
              alt="Design Preview"
              style={{ maxHeight: 100, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }}
              onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
            />
          </div>
        </div>
      )}

      {/* Item Total */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background: "#fff", border: "1px solid #d1fae5",
          borderRadius: 8, padding: "8px 14px", textAlign: "right", minWidth: "100%",
        }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
            Base:{" "}
            <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
            {isSqFt && item.sq_ft > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>
                ({item.quantity} qty × {item.sq_ft} ft² × ₹{item.price}/ft²)
              </span>
            )}
            {!isSqFt && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>
                ({item.quantity} qty × ₹{item.price})
              </span>
            )}
            {(item.gst_percentage || 0) > 0 && (
              <span style={{ marginLeft: 8 }}>
                + GST ({item.gst_percentage}%):{" "}
                <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
            Item Total: ₹{lineTotal.toFixed(2)}
          </div>
          {!isSqFt && (item.width || item.height) && (
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
              Size ref: {item.width || "—"} × {item.height || "—"} {item.size_unit}
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

  // ── View modal ────────────────────────────────────────────────────────────
  const [viewModal, setViewModal] = useState(false);
  const [viewJob, setViewJob]     = useState(null);
  const openViewModal  = (record) => { setViewJob(record); setViewModal(true); };
  const closeViewModal = () => { setViewModal(false); setViewJob(null); };

  // ── Table state ───────────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(false);
  const [jobs, setJobs]                   = useState([]);
  const [total, setTotal]                 = useState(0);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState(null);
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown]         = useState(AUTO_REFRESH_INTERVAL / 1000);

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [editModal, setEditModal]     = useState(false);
  const [editJob, setEditJob]         = useState(null);
  const [editForm, setEditForm]       = useState({ ...DEFAULT_EDIT_FORM });
  const [editItems, setEditItems]     = useState([{ ...EMPTY_ITEM }]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState("");

  // ── Approve modal state ───────────────────────────────────────────────────
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingJob, setApprovingJob]         = useState(null);
  const [designers, setDesigners]               = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState(null);
  const [approving, setApproving]               = useState(false);
  const [designersLoading, setDesignersLoading] = useState(false);

  const autoRefreshRef = useRef(null);
  const countdownRef   = useRef(null);

  // ── Fetch jobs ────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch("https://api.dmedia.in/api/jobs", {
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

  // ── Designers ─────────────────────────────────────────────────────────────
  const fetchDesigners = async () => {
    setDesignersLoading(true);
    try {
      const res  = await fetch("https://api.dmedia.in/api/admin/get_admin", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      const data = await res.json();
      const designTeam = (data.data || []).filter(u => u.role === "designing team");
      setDesigners(designTeam);
      return designTeam;
    } catch (err) {
      ERROR_NOTIFICATION({ message: "Could not load designers list" });
      return [];
    } finally {
      setDesignersLoading(false);
    }
  };

  const openApproveModal = async (job) => {
    setApprovingJob(job);
    setSelectedDesigner(null);
    setApproveModalOpen(true);
    await fetchDesigners();
  };

  const handleApproveWithDesigner = async () => {
    if (!selectedDesigner) {
      ERROR_NOTIFICATION({ message: "Please select a designer to assign this job." });
      return;
    }
    setApproving(true);
    try {
      const profile   = localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile")) : {};
      const adminId   = profile._id   || null;
      const adminName = profile.name  || null;
      const designerName =
        selectedDesigner.name ||
        selectedDesigner.fullName ||
        selectedDesigner.username ||
        "Unknown";

      const response = await fetch(
        `https://api.dmedia.in/api/jobs/${approvingJob._id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            job_status:           "design",
            approved_by:          adminName,
            approved_by_admin_id: adminId,
            assign_to: {
              user_id: selectedDesigner._id,
              name:    designerName,
            },
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Approval failed");

      SUCCESS_NOTIFICATION({
        message: `Job ${approvingJob.job_no} approved & assigned to ${designerName}`,
      });
      setApproveModalOpen(false);
      setApprovingJob(null);
      setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) {
      ERROR_NOTIFICATION({ message: err.message || "Failed to approve job" });
    } finally {
      setApproving(false);
    }
  };

  const closeApproveModal = () => {
    if (approving) return;
    setApproveModalOpen(false);
    setApprovingJob(null);
    setSelectedDesigner(null);
    setDesigners([]);
  };

  // ── Open Edit modal ───────────────────────────────────────────────────────
  const openEditModal = (record) => {
    setEditJob(record);
    setEditError("");

    const addr          = record.delivery_address || {};
    const streetParts   = (addr.street || "").split(", ");
    const address_line1 = streetParts[0] || "";
    const address_line2 = streetParts.slice(1).join(", ") || "";

    setEditForm({
      customer_name:           record.customer_name  || "",
      customer_phone:          record.customer_phone || "",
      company_name:            record.company_name   || "",
      estimated_delivery_date: record.estimated_delivery_date
        ? dayjs(record.estimated_delivery_date).format("YYYY-MM-DDTHH:mm")
        : "",
      address_line1,
      address_line2,
      city:    addr.city    || "",
      state:   addr.state   || "",
      pincode: addr.pincode || "",
      country: addr.country || "India",
      gst_no:              record.gst_no              || "",
      delivery_charges:    record.delivery_charges    ?? 0,
      free_delivery:       record.free_delivery       ?? false,
      design_charges:      record.design_charges      ?? 0,
      discount_percentage: record.discount_percentage ?? 0,
      // ✅ Populate payment fields from record
      payment_mode:        record.payment_mode        || "",
      payment_amount:      record.payment_amount      || "",
      notes:               record.notes               || "",
      terms_and_conditions: record.terms_and_conditions ||
        "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
    });

    const items = (record.cart_items || []).map(it => {
      let width     = String(it.width  || "");
      let height    = String(it.height || "");
      let size_unit = it.size_unit || "ft";

      if ((!width || !height) && it.size) {
        const m = it.size.match(/^([\d.]+)\s*[×xX]\s*([\d.]+)\s*(\w+)/);
        if (m) { width = m[1]; height = m[2]; size_unit = m[3] || "ft"; }
      }

      const quantity_type = it.quantity_type ||
        (parseFloat(width) > 0 && parseFloat(height) > 0 ? "sq.ft" : "quantity");

      const sq_ft = it.sq_ft
        ? parseFloat(it.sq_ft)
        : quantity_type === "sq.ft"
          ? parseFloat(toSqFt(width, height, size_unit).toFixed(4))
          : 0;

      return {
        ...EMPTY_ITEM,
        ...it,
        width,
        height,
        size_unit,
        sq_ft,
        quantity_type,
        gst_percentage: it.gst_percentage ?? 0,
      };
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
  const handleEditItem  = (i, u) => setEditItems(p => p.map((it, j) => j === i ? u : it));
  const addEditItem     = () => setEditItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeEditItem  = (i) => setEditItems(p => p.filter((_, j) => j !== i));

  // ── Edit totals (computed live) ───────────────────────────────────────────
  const editTotals = useMemo(() => {
    let subtotal  = 0;
    let taxAmount = 0;

    editItems.forEach(it => {
      const { base, gstAmt } = calcItemTotals(it);
      subtotal  += base;
      taxAmount += gstAmt;
    });

    const discountPct     = parseFloat(editForm.discount_percentage) || 0;
    const discountAmt     = subtotal * (discountPct / 100);
    const taxableAmount   = subtotal - discountAmt;
    const designCharges   = parseFloat(editForm.design_charges)   || 0;
    const deliveryCharges = editForm.free_delivery ? 0 : (parseFloat(editForm.delivery_charges) || 0);
    const grandTotal      = taxableAmount + taxAmount + designCharges + deliveryCharges;
    // ✅ Payment balance calculation
    const paid            = parseFloat(editForm.payment_amount) || 0;
    const balance         = grandTotal - paid;

    return {
      subtotal, taxAmount, discountPct, discountAmt,
      taxableAmount, designCharges, deliveryCharges, grandTotal,
      paid, balance,
    };
  }, [editItems, editForm]);

  // ── Submit edit ───────────────────────────────────────────────────────────
  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditError("");
    try {
      if (!editForm.customer_name.trim())    throw new Error("Customer name is required");
      if (!editForm.customer_phone.trim())   throw new Error("Phone number is required");
      if (!editForm.estimated_delivery_date) throw new Error("Estimated delivery date is required");

      const valid = editItems.filter(it => {
        if (!it.product_name || !it.quantity_type) return false;
        if (it.quantity_type === "sq.ft" && (it.sq_ft || 0) <= 0) return false;
        return (it.quantity || 0) > 0 && (it.price || 0) > 0;
      });

      if (!valid.length) throw new Error("Add at least one valid product with size/qty and price");

      const payload = {
        customer_name:  editForm.customer_name.trim(),
        customer_phone: editForm.customer_phone.trim(),
        company_name:   (editForm.company_name || "").trim(),
        estimated_delivery_date: dayjs(editForm.estimated_delivery_date).toISOString(),
        delivery_address: {
          street:  [editForm.address_line1, editForm.address_line2].filter(Boolean).join(", "),
          city:    editForm.city,
          state:   editForm.state,
          pincode: editForm.pincode,
          country: editForm.country,
        },

        cart_items: valid.map(it => {
          const isSqFt = it.quantity_type === "sq.ft";
          return {
            product_id:     it.product_id    || "",
            product_name:   it.product_name,
            variation:      it.variation     || "",
            printing_type:  it.printing_type || "",
            quantity:       it.quantity,
            quantity_type:  it.quantity_type,
            price:          it.price,
            gst_percentage: it.gst_percentage || 0,
            design_file:    it.design_file   || "",
            notes:          it.notes         || "",
            width:     it.width     || "",
            height:    it.height    || "",
            size_unit: it.size_unit || (isSqFt ? "ft" : "pcs"),
            sq_ft:     isSqFt ? it.sq_ft : 0,
            size:      isSqFt && it.width && it.height
              ? `${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)`
              : "",
          };
        }),

        gst_no:              editForm.gst_no.trim(),
        delivery_charges:    editTotals.deliveryCharges,
        free_delivery:       editForm.free_delivery,
        design_charges:      editTotals.designCharges,
        discount_percentage: editTotals.discountPct,
        subtotal:            editTotals.subtotal,
        discount_amount:     editTotals.discountAmt,
        taxable_amount:      editTotals.taxableAmount,
        tax_amount:          editTotals.taxAmount,
        total_amount:        editTotals.grandTotal,
        // ✅ Payment fields in payload
        payment_mode:        editForm.payment_mode   || "",
        payment_amount:      parseFloat(editForm.payment_amount) || 0,
        balance_amount:      parseFloat(editTotals.balance.toFixed(2)),
        notes:               editForm.notes,
        terms_and_conditions: editForm.terms_and_conditions,
      };

      const res  = await fetch(`https://api.dmedia.in/api/jobs/${editJob._id}`, {
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
  const p  = isMobile ? 8 : 12;
  const g  = isMobile ? 8 : 12;
  const c2 = isMobile ? "1fr" : "1fr 1fr";
  const c3 = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const c4 = isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr" : "repeat(4,1fr)";
  const c5 = isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr 1fr" : "repeat(5,1fr)";

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const modalWidth      = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw,900px)";
  const mobileFullStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};
  const modalBodyStyle  = {
    maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh",
    overflowY: "auto",
    padding: isMobile ? 10 : 16,
  };
  const sheetStyle     = isMobile
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
          {r.company_name && (
            <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}>
              <BankOutlined style={{ fontSize: 10 }} /> {r.company_name}
            </div>
          )}
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
    // ✅ NEW: Approved By column - appears after Stage
    {
      title: "Approved By", 
      key: "approved_by",
      width: isMobile ? 100 : 130,
      render: (_, r) => {
        const approvedByName = r.approved_by;
        const approvedById = r.approved_by_admin_id;
        
        if (!approvedByName && !approvedById) {
          return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
        }
        
        return (
          <Tooltip title={approvedById ? `Admin ID: ${approvedById}` : ""}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <UserOutlined style={{ color: "#6b7280", fontSize: 11 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                {approvedByName || "Unknown"}
              </span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "", width: isMobile ? 90 : 150,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Tooltip title="View Job">
            <Button
              icon={<EyeOutlined />}
              size="small"
              style={{ color: "#6b7280", borderColor: "#e5e7eb" }}
              onClick={() => openViewModal(record)}
            >
              {!isMobile && "View"}
            </Button>
          </Tooltip>
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
          {record.job_status === "draft" && (
            <Tooltip title="Approve & Assign">
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
                onClick={() => openApproveModal(record)}
              >
                {!isMobile && "Approve"}
              </Button>
            </Tooltip>
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
        style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
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
        style={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}
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

      {/* ════════════ VIEW JOB MODAL ════════════ */}
      <Modal
        open={viewModal}
        onCancel={closeViewModal}
        footer={
          <Button onClick={closeViewModal} style={{ borderRadius: 8 }}>Close</Button>
        }
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOutlined style={{ color: "#6b7280" }} />
            <span style={{ fontWeight: 700 }}>View Job</span>
            {viewJob && (
              <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
                {viewJob.job_no}
              </Tag>
            )}
          </div>
        }
        width={isMobile ? "100vw" : "min(96vw, 760px)"}
        style={isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {}}
        styles={{
          body: {
            maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh",
            overflowY: "auto",
            padding: isMobile ? 10 : 16,
          },
        }}
        destroyOnClose
      >
        {viewJob && (() => {
          const cfg       = STATUS_CONFIG[viewJob.job_status] || STATUS_CONFIG.draft;
          const addr      = viewJob.delivery_address || {};
          const totals    = calcJobTotals(viewJob);
          const cartItems = viewJob.cart_items || [];

          const fullAddress = [
            addr.street, addr.city, addr.state, addr.pincode, addr.country,
          ].filter(Boolean).join(", ");

          const stageCfg = viewJob.current_stage;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Status & Meta ── */}
              <div style={{
                display: "flex", alignItems: "center", flexWrap: "wrap",
                gap: 8, justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 600, fontSize: 13, padding: "3px 10px" }}>
                    {cfg.label}
                  </Tag>
                  {stageCfg?.stage && (
                    <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>
                      {WORKFLOW_STAGES.find(s => s.value === stageCfg.stage)?.label || stageCfg.stage_label}
                    </Tag>
                  )}
                </div>
                {viewJob.order_date && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Ordered: {dayjs(viewJob.order_date).format("DD MMM YYYY, HH:mm")}
                  </span>
                )}
              </div>

              {/* ── Customer Info ── */}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                <SectionHeader icon={<UserOutlined />} title="Customer Info" />
                <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10 }}>
                  <InfoRow label="Name"  value={viewJob.customer_name} />
                  <InfoRow label="Phone" value={viewJob.customer_phone} />
                  {viewJob.company_name && (
                    <InfoRow
                      label="Company / Business"
                      value={viewJob.company_name}
                      valueStyle={{ color: "#1e3a8a", display: "flex", alignItems: "center", gap: 4 }}
                    />
                  )}
                  <InfoRow
                    label="Estimated Delivery"
                    value={viewJob.estimated_delivery_date
                      ? dayjs(viewJob.estimated_delivery_date).format("DD MMM YYYY, HH:mm")
                      : "—"}
                  />
                  <InfoRow label="GST Number" value={viewJob.gst_no || "—"} />
                  <InfoRow label="Created By"  value={viewJob.created_by || "—"} />
                  <InfoRow
                    label="Valid Until"
                    value={viewJob.valid_until
                      ? dayjs(viewJob.valid_until).format("DD MMM YYYY")
                      : "—"}
                  />
                </div>
              </div>

              {/* ── Assigned Designer ── */}
              {stageCfg?.assigned_to?.name && (
                <div style={{
                  background: "#eff6ff", borderRadius: 10,
                  padding: "10px 14px", border: "1px solid #bfdbfe",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <UserOutlined style={{ color: "#2563eb", fontSize: 16 }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Assigned Designer
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e3a8a" }}>
                      {stageCfg.assigned_to.name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "#3b82f6" }}>
                        {stageCfg.assigned_to.role}
                      </span>
                    </div>
                    {stageCfg.since && (
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        Since {dayjs(stageCfg.since).format("DD MMM YYYY, HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Delivery Address ── */}
              {fullAddress && (
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                  <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{fullAddress}</div>
                </div>
              )}

              {/* ── Cart Items ── */}
              <div>
                <SectionHeader icon={<ShoppingCartOutlined />} title={`Job Items (${cartItems.length})`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {cartItems.map((it, i) => {
                    const { base, gstAmt, lineTotal, isSqFt, qty, sqFt, price, gstPct } = calcItemTotals(it);
                    return (
                      <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#e0e7ff", padding: "2px 8px", borderRadius: 20 }}>
                              #{i + 1}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e", textTransform: "capitalize" }}>
                              {it.product_name || "—"}
                            </span>
                            {it.variation && <Tag style={{ fontSize: 10, margin: 0 }}>{it.variation}</Tag>}
                            {it.printing_type && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{it.printing_type}</Tag>}
                            <Tag color={isSqFt ? "cyan" : "orange"} style={{ fontSize: 10, margin: 0 }}>
                              {isSqFt ? "Sq. Ft" : "Qty"}
                            </Tag>
                          </div>
                          <div style={{ fontWeight: 700, color: "#065f46", fontSize: 15, background: "#d1fae5", padding: "2px 10px", borderRadius: 8 }}>
                            ₹{lineTotal.toFixed(2)}
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
                          <InfoRow label="Quantity" value={`${qty}`} />
                          {isSqFt ? (
                            <>
                              <InfoRow label="Sq. Ft" value={`${sqFt} ft²`} />
                              <InfoRow label="Size"   value={it.size || `${it.width}×${it.height} ${it.size_unit}`} />
                              <InfoRow label="Rate"   value={`₹${price} / ft²`} />
                            </>
                          ) : (
                            <>
                              <InfoRow label="Unit Price" value={`₹${price}`} />
                              {(it.width || it.height) && (
                                <InfoRow
                                  label="Size (ref)"
                                  value={`${it.width || "—"} × ${it.height || "—"} ${it.size_unit}`}
                                />
                              )}
                            </>
                          )}
                        </div>

                        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px", border: "1px solid #e5e7eb", fontSize: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563", marginBottom: 2 }}>
                            <span>
                              Base Amount
                              {isSqFt && <span style={{ color: "#9ca3af", marginLeft: 4 }}>({qty} qty × {sqFt} ft² × ₹{price}/ft²)</span>}
                              {!isSqFt && <span style={{ color: "#9ca3af", marginLeft: 4 }}>({qty} qty × ₹{price})</span>}
                            </span>
                            <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
                          </div>
                          {gstPct > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#92400e", marginBottom: 2 }}>
                              <span>GST @ {gstPct}%</span>
                              <span style={{ fontWeight: 600 }}>+ ₹{gstAmt.toFixed(2)}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#065f46", borderTop: "1px solid #d1fae5", paddingTop: 4, marginTop: 4 }}>
                            <span>Item Total</span>
                            <span>₹{lineTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {it.notes && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontStyle: "italic", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px" }}>
                            Note: "{it.notes}"
                          </div>
                        )}

                        {it.design_file && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase" }}>Design File</div>
                            <img
                              src={it.design_file}
                              alt="Design"
                              style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 6, objectFit: "contain", border: "1px solid #e5e7eb" }}
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Order Summary ── */}
              <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? 12 : "14px 16px" }}>
                <div style={{ fontWeight: 700, color: "#1e40af", marginBottom: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <WalletOutlined /> Order Summary
                </div>
                <SummaryRow label="Subtotal (items base)" value={`₹${totals.subtotal.toFixed(2)}`} />
                {totals.discountAmt > 0 && (
                  <SummaryRow label={`Discount (${totals.discountPct}%)`} value={`− ₹${totals.discountAmt.toFixed(2)}`} color="#059669" />
                )}
                {totals.discountAmt > 0 && (
                  <SummaryRow label="Taxable Amount" value={`₹${totals.taxableAmount.toFixed(2)}`} color="#374151" />
                )}
                <SummaryRow label="Total GST (all items)" value={`₹${totals.taxAmount.toFixed(2)}`} color="#d97706" />
                {totals.designCharges > 0 && (
                  <SummaryRow label="Design Charges" value={`₹${totals.designCharges.toFixed(2)}`} color="#7c3aed" />
                )}
                <SummaryRow
                  label="Delivery Charges"
                  value={totals.freeDelivery ? "Free" : `₹${totals.deliveryCharges.toFixed(2)}`}
                  color={totals.freeDelivery ? "#059669" : undefined}
                />
                <Divider style={{ margin: "10px 0" }} />
                <SummaryRow label="Grand Total" value={`₹${totals.grandTotal.toFixed(2)}`} bold />
                {Math.abs(totals.grandTotal - parseFloat(viewJob.total_amount || 0)) > 0.5 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px" }}>
                    Stored total: ₹{parseFloat(viewJob.total_amount || 0).toFixed(2)} · Computed: ₹{totals.grandTotal.toFixed(2)}
                  </div>
                )}
              </div>

              {/* ── Payment Info ── */}
              {(viewJob.payment_mode || parseFloat(viewJob.payment_amount || 0) > 0) && (
                <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px", border: "1px solid #bbf7d0" }}>
                  <SectionHeader icon={<WalletOutlined />} title="Payment" />
                  <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10 }}>
                    <InfoRow label="Payment Mode" value={viewJob.payment_mode || "—"} />
                    <InfoRow
                      label="Amount Paid"
                      value={parseFloat(viewJob.payment_amount || 0) > 0
                        ? `₹${parseFloat(viewJob.payment_amount).toFixed(2)}`
                        : "Unpaid"}
                      valueStyle={{ color: parseFloat(viewJob.payment_amount || 0) > 0 ? "#16a34a" : "#dc2626" }}
                    />
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              {viewJob.notes && (
                <div style={{ fontSize: 13, color: "#374151", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                  {viewJob.notes}
                </div>
              )}

              {/* ── Terms ── */}
              {viewJob.terms_and_conditions && (
                <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: 4 }}>Terms & Conditions</div>
                  <div style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>{viewJob.terms_and_conditions}</div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ════════════ EDIT JOB MODAL ════════════ */}
      <Modal
        open={editModal}
        onCancel={resetEditModal}
        footer={null}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EditOutlined style={{ color: "#2563eb" }} />
            <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>Edit Job </span>
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
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
              ⚠ {editError}
            </div>
          )}

          {/* ── Customer Info ── */}
          <SectionHeader icon={<UserOutlined />} title="Customer Info" />
          <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: g }}>
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

          {/* Company Name + GST Number */}
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
            <FormField label="Company Name">
              <Input
                prefix={<BankOutlined style={{ color: "#9ca3af" }} />}
                placeholder="Company / Business name"
                value={editForm.company_name}
                onChange={(e) => handleEditInput("company_name", e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </FormField>
            <FormField label="GST Number">
              <Input
                placeholder="GSTIN (15 chars)"
                maxLength={15}
                value={editForm.gst_no}
                onChange={(e) => handleEditInput("gst_no", e.target.value.toUpperCase())}
                style={{ borderRadius: 8 }}
              />
            </FormField>
          </div>

          {/* ── Delivery Address ── */}
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
                ["city",    "City",    "City"],
                ["state",   "State",   "State"],
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

          {/* ── Job Items ── */}
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

          {/* ── Pricing & Tax ── */}
          <SectionHeader icon={<TagOutlined />} title="Pricing & Tax" />
          <div style={{ display: "grid", gridTemplateColumns: c5, gap: g, marginBottom: 14 }}>
            <FormField label="Discount (%)">
              <InputNumber
                min={0} max={100}
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

            <FormField label="Design Charges (₹)">
              <InputNumber
                min={0}
                value={editForm.design_charges}
                style={{
                  width: "100%", borderRadius: 8,
                  background: (editForm.design_charges || 0) > 0 ? "#faf5ff" : undefined,
                  borderColor: (editForm.design_charges || 0) > 0 ? "#c4b5fd" : undefined,
                }}
                prefix="₹"
                onChange={(v) => handleEditInput("design_charges", v || 0)}
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
                <span style={{ fontSize: 12, fontWeight: 600, color: editForm.free_delivery ? "#16a34a" : "#6b7280" }}>
                  {editForm.free_delivery ? "Free" : "Paid"}
                </span>
              </div>
            </FormField>
          </div>

          {/* ✅ Payment Section — NEW in Edit modal */}
          <SectionHeader icon={<WalletOutlined />} title="Payment" />
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
            <FormField label="Payment Mode">
              <Select
                placeholder="Select payment mode"
                value={editForm.payment_mode || undefined}
                style={{ width: "100%" }}
                allowClear
                onChange={(v) => handleEditInput("payment_mode", v ?? "")}
              >
                {PAYMENT_MODES.map(m => (
                  <Option key={m} value={m}>{m}</Option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount Paid (₹)">
              <InputNumber
                min={0}
                placeholder="0.00"
                value={editForm.payment_amount || undefined}
                style={{ width: "100%", borderRadius: 8 }}
                prefix="₹"
                onChange={(v) => handleEditInput("payment_amount", v ?? "")}
              />
            </FormField>
          </div>

          {/* ── Notes & Terms ── */}
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

          {/* ── Order Summary (live preview) ── */}
          <div style={{ background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? 12 : "14px 16px", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "#1e40af", marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <FileTextOutlined /> Order Summary
            </div>
            <SummaryRow label="Subtotal (items base)" value={`₹${editTotals.subtotal.toFixed(2)}`} />
            {editTotals.discountAmt > 0 && (
              <SummaryRow label={`Discount (${editTotals.discountPct}%)`} value={`− ₹${editTotals.discountAmt.toFixed(2)}`} color="#059669" />
            )}
            {editTotals.discountAmt > 0 && (
              <SummaryRow label="Taxable Amount" value={`₹${editTotals.taxableAmount.toFixed(2)}`} color="#374151" />
            )}
            <SummaryRow label="Total GST" value={`₹${editTotals.taxAmount.toFixed(2)}`} color="#d97706" />
            {editTotals.designCharges > 0 && (
              <SummaryRow label="Design Charges" value={`₹${editTotals.designCharges.toFixed(2)}`} color="#7c3aed" />
            )}
            <SummaryRow
              label="Delivery"
              value={editForm.free_delivery ? "Free" : `₹${editTotals.deliveryCharges.toFixed(2)}`}
              color={editForm.free_delivery ? "#059669" : undefined}
            />
            <Divider style={{ margin: "8px 0" }} />
            <SummaryRow label="Grand Total" value={`₹${editTotals.grandTotal.toFixed(2)}`} bold />
            {/* ✅ Show paid / balance in summary when payment fields are filled */}
            {(editTotals.paid > 0 || editForm.payment_mode) && (
              <>
                <div style={{ height: 6 }} />
                <SummaryRow
                  label={`Amount Paid${editForm.payment_mode ? ` (${editForm.payment_mode})` : ""}`}
                  value={`− ₹${editTotals.paid.toFixed(2)}`}
                  color="#059669"
                />
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                  <span style={{ color: "#1a1a2e" }}>Balance Due</span>
                  <span style={{
                    color: editTotals.balance <= 0 ? "#059669" : "#dc2626",
                    background: editTotals.balance <= 0 ? "#f0fdf4" : "#fef2f2",
                    padding: "2px 10px", borderRadius: 6,
                  }}>
                    {editTotals.balance <= 0
                      ? `✓ Paid (Advance ₹${Math.abs(editTotals.balance).toFixed(2)})`
                      : `₹${editTotals.balance.toFixed(2)}`}
                  </span>
                </div>
              </>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: "#6b7280" }}>
              Formula: Sq.Ft items = qty × sq.ft × rate &nbsp;|&nbsp; Qty items = qty × rate
            </div>
          </div>

          {/* ── Actions ── */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button onClick={resetEditModal} style={{ borderRadius: 8, height: 40, flex: isMobile ? 1 : undefined }}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleEditSubmit}
              loading={editLoading}
              style={{ background: "#2563eb", border: "none", borderRadius: 8, height: 40, fontWeight: 600, flex: isMobile ? 1 : undefined }}
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
          <Button key="cancel" onClick={closeApproveModal} disabled={approving}>Cancel</Button>,
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
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", fontSize: 14 }}>
                {approvingJob.job_no}
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{approvingJob.customer_name || "—"}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{approvingJob.customer_phone || ""}</div>
              <div style={{ marginTop: 6, fontSize: 11 }}>
                Current status:{" "}
                {(() => {
                  const cfg = STATUS_CONFIG[approvingJob.job_status] || STATUS_CONFIG.draft;
                  return <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 500 }}>{cfg.label}</Tag>;
                })()}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                Select Designer to Assign <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Select
                placeholder={designersLoading ? "Loading designers…" : "Choose a designer"}
                style={{ width: "100%" }}
                value={selectedDesigner?._id || undefined}
                loading={designersLoading}
                disabled={designersLoading}
                onChange={(id) => setSelectedDesigner(designers.find(d => d._id === id) || null)}
                notFoundContent={designersLoading ? "Loading…" : "No designers found"}
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
                <div style={{ marginTop: 8, color: "#b45309", fontSize: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
                  No designers found. Add a user with role "designing team" first.
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#6b7280", background: "#fefce8", padding: "8px 10px", borderRadius: 6, border: "1px solid #fef08a" }}>
              The job will be approved and assigned to the selected designer with stage set to <strong>Design</strong>.
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

