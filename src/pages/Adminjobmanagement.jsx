import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Button, Card, Input, Modal, Select, Tag, Tooltip, Divider, Spin,
  InputNumber, Popconfirm, Radio, Image, DatePicker, Tabs,
} from "antd";
import {
  EyeOutlined, EditOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, SwapOutlined, SendOutlined,
  UserOutlined, EnvironmentOutlined, FileTextOutlined, TagOutlined,
  ShoppingCartOutlined, BranchesOutlined, PlayCircleOutlined,
  PauseCircleOutlined, PlusOutlined, DeleteOutlined, SaveOutlined,
  PhoneOutlined, WalletOutlined, BankOutlined, InfoCircleOutlined,
  ExclamationCircleOutlined, CameraOutlined, CompassOutlined,
  CalendarOutlined, CheckOutlined, ToolOutlined, AppstoreOutlined,
  UploadOutlined, SearchOutlined,
} from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import { ERROR_NOTIFICATION, SUCCESS_NOTIFICATION } from "../helper/notification_helper";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

// ─── Round half-up (808.20→808, 808.60→809, 808.50→809) ──────────────────────
const roundHalfUp = (n) => Math.floor(n + 0.5);

// ─── Breakpoint ───────────────────────────────────────────────────────────────
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
  return { bp, isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md", isDesktop: bp === "lg" };
};

// ─── Overdue Helper ───────────────────────────────────────────────────────────
const getOverdueInfo = (estimated_delivery_date) => {
  if (!estimated_delivery_date) return null;
  const today = dayjs().startOf("day");
  const due = dayjs(estimated_delivery_date).startOf("day");
  const diff = today.diff(due, "day");
  if (diff === 0) return { diff: 0, label: "Due Today", badge: "0", color: "#92400e", bg: "#fef3c7", border: "#fcd34d", isOverdue: false, isDueToday: true };
  if (diff < 0) return { diff, label: diff === -1 ? "Due Tomorrow" : `Due in ${Math.abs(diff)}d`, badge: `${diff}`, color: "#065f46", bg: "#d1fae5", border: "#6ee7b7", isOverdue: false, isDueToday: false };
  return { diff, label: diff === 1 ? "Overdue 1d" : `Overdue ${diff}d`, badge: `+${diff}`, color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", isOverdue: true, isDueToday: false };
};

const isFullyCompletedAndPaid = (record) =>
  record?.job_status === "completed" &&
  (parseFloat(record?.balance_amount || 0) <= 0) &&
  parseFloat(record?.payment_amount || 0) > 0;

const OverdueBadge = ({ estimated_delivery_date, jobStatus }) => {
  if (jobStatus === "completed") return null;
  const info = getOverdueInfo(estimated_delivery_date);
  if (!info) return null;
  if (!info.isOverdue && !info.isDueToday && info.diff < -3) return null;
  return (
    <Tooltip title={`${info.label} · Est: ${dayjs(estimated_delivery_date).format("DD MMM YYYY")}`}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 10, border: `1px solid ${info.border}`, background: info.bg, color: info.color, fontFamily: "monospace", whiteSpace: "nowrap" }}>
        {info.isOverdue && <ExclamationCircleOutlined style={{ fontSize: 9 }} />}
        {info.badge}d
      </span>
    </Tooltip>
  );
};

const PaymentDueBadge = ({ next_due_date, balance_amount }) => {
  if (!next_due_date || !balance_amount || parseFloat(balance_amount) <= 0) return null;
  const today = dayjs().startOf("day");
  const due = dayjs(next_due_date).startOf("day");
  const diff = due.diff(today, "day");
  let color, bg, border, label;
  if (diff < 0) { color = "#991b1b"; bg = "#fee2e2"; border = "#fca5a5"; label = `Payment overdue ${Math.abs(diff)}d`; }
  else if (diff === 0) { color = "#92400e"; bg = "#fef3c7"; border = "#fcd34d"; label = "Payment due today"; }
  else if (diff <= 3) { color = "#92400e"; bg = "#fff7ed"; border = "#fdba74"; label = `Payment due in ${diff}d`; }
  else { color = "#1e40af"; bg = "#eff6ff"; border = "#93c5fd"; label = `Payment due ${dayjs(next_due_date).format("DD MMM")}`; }
  return (
    <Tooltip title={`Balance ₹${parseFloat(balance_amount).toFixed(2)} · Due ${dayjs(next_due_date).format("DD MMM YYYY")}`}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color, whiteSpace: "nowrap" }}>
        <WalletOutlined style={{ fontSize: 9 }} /> {label}
      </span>
    </Tooltip>
  );
};

const SiteVisitBadge = () => (
  <Tooltip title="Created from a Site Visit">
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "linear-gradient(135deg,#7c3aed22,#4f46e522)", border: "1px solid #a78bfa", color: "#6d28d9", whiteSpace: "nowrap" }}>
      <CompassOutlined style={{ fontSize: 9 }} /> Site Visit
    </span>
  </Tooltip>
);

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
    variations: ["Normal Flex", "Flex BB -230gsm", "Flex BB -280gsm", "Flex BB -240gsm", "Flex Star Backlight", "Flex Backlight", "Flex BB Star"],
  },
];

const UNIT_OPTIONS     = [{ value: "ft", label: "ft" }, { value: "inch", label: "inch" }, { value: "cm", label: "cm" }];
const QTY_TYPE_OPTIONS = [{ value: "sq.ft", label: "Sq. Ft" }, { value: "quantity", label: "Quantity" }];
const GST_OPTIONS      = [0, 5, 12, 18, 28];
const PAYMENT_MODES    = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Cash on Delivery"];

const OFFICE_WORK_TYPES = [
  { value: "website",      label: "Website",      icon: "🌐", calc: "days"   },
  { value: "design",       label: "Design",       icon: "🎨", calc: "hours"  },
  { value: "social_media", label: "Social Media", icon: "📱", calc: "counts" },
  { value: "photo_shoot",  label: "Photo Shoot",  icon: "📷", calc: "hours"  },
];

const EMPTY_PRODUCT_ITEM = {
  item_category: "product", product_id: "", product_name: "", variation: "", printing_type: "",
  width: "", height: "", size_unit: "inch", sq_ft: 0, sq_ft_manual: false,
  quantity_type: "sq.ft", quantity: 1, price: 0, gst_percentage: 0, design_file: "", notes: "",
};
const EMPTY_OFFICE_ITEM = {
  item_category: "service_office", service_name: "", office_type: "website",
  days: 1, hours: 1, reels_count: 0, post_count: 0, price: 0, gst_percentage: 0, notes: "",
};
const EMPTY_LABOUR_ITEM = {
  item_category: "service_labour", service_name: "",
  sq_ft: 0, hours: 0, price_per_sqft: 0, price_per_hour: 0, gst_percentage: 0, notes: "",
};

const DEFAULT_EDIT_FORM = {
  customer_name: "", customer_phone: "", company_name: "",
  estimated_delivery_date: "",
  address_line1: "", address_line2: "", city: "", state: "", pincode: "", country: "India",
  gst_no: "", delivery_charges: 0, free_delivery: false,
  design_charges: 0, discount_amount: 0,
  notes: "",
  terms_and_conditions: "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
};

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w) || 0, hn = parseFloat(h) || 0;
  if (!wn || !hn) return 0;
  if (unit === "ft")   return wn * hn;
  if (unit === "inch") return (wn / 12) * (hn / 12);
  if (unit === "cm")   return (wn / 30.48) * (hn / 30.48);
  return wn * hn;
};

const computeProductLineTotal = (item) => {
  const base = item.quantity_type === "sq.ft"
    ? (item.quantity || 0) * (item.sq_ft || 0) * (item.price || 0)
    : (item.quantity || 0) * (item.price || 0);
  const gstAmt = base * ((item.gst_percentage || 0) / 100);
  return { base, gstAmt, total: base + gstAmt };
};

const computeOfficeServiceLineTotal = (item) => {
  let qty = 0;
  if (item.office_type === "website")           qty = item.days || 0;
  else if (item.office_type === "design")       qty = item.hours || 0;
  else if (item.office_type === "social_media") qty = (item.reels_count || 0) + (item.post_count || 0);
  else if (item.office_type === "photo_shoot")  qty = item.hours || 0;
  const base = qty * (item.price || 0);
  const gstAmt = base * ((item.gst_percentage || 0) / 100);
  return { base, gstAmt, total: base + gstAmt, qty };
};

const computeLabourLineTotal = (item) => {
  const sqFtAmt  = (item.sq_ft || 0) * (item.price_per_sqft || 0);
  const hoursAmt = (item.hours || 0) * (item.price_per_hour || 0);
  const base     = sqFtAmt + hoursAmt;
  const gstAmt   = base * ((item.gst_percentage || 0) / 100);
  return { base, gstAmt, total: base + gstAmt, sqFtAmt, hoursAmt };
};

const calcJobTotals = (job) => {
  let subtotal = 0, taxAmount = 0;
  (job.cart_items || []).forEach(it => {
    const cat = it.item_category;
    let base = 0, gstAmt = 0;
    if (cat === "service_office")        { const r = computeOfficeServiceLineTotal(it); base = r.base; gstAmt = r.gstAmt; }
    else if (cat === "service_labour")   { const r = computeLabourLineTotal(it);        base = r.base; gstAmt = r.gstAmt; }
    else                                 { const r = computeProductLineTotal(it);       base = r.base; gstAmt = r.gstAmt; }
    subtotal += base; taxAmount += gstAmt;
  });
  let discountAmt = parseFloat(job.discount_amount) || 0;
  if (!discountAmt && job.discount_percentage) discountAmt = subtotal * ((parseFloat(job.discount_percentage) || 0) / 100);
  const taxableAmount   = subtotal - discountAmt;
  const designCharges   = parseFloat(job.design_charges) || 0;
  const deliveryCharges = job.free_delivery ? 0 : parseFloat(job.delivery_charges) || 0;
  return { subtotal, discountAmt, taxableAmount, taxAmount, designCharges, deliveryCharges, grandTotal: taxableAmount + taxAmount + designCharges + deliveryCharges, freeDelivery: !!job.free_delivery };
};

const isSiteVisitJob = (r) => !!(r?.site_visit_id || r?.site_visit_no);
const extractJobs    = (d) => Array.isArray(d?.data?.jobs) ? d.data.jobs : Array.isArray(d?.data) ? d.data : Array.isArray(d?.jobs) ? d.jobs : Array.isArray(d) ? d : [];
const extractTotal   = (d, fb) => typeof d?.data?.pagination?.total === "number" ? d.data.pagination.total : typeof d?.data?.total === "number" ? d.data.total : typeof d?.total === "number" ? d.total : fb;

// ─── Shared UI ────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, badge, action }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
    <span style={{ color: "#2563eb", fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
    {badge}
    <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 6 }} />
    {action}
  </div>
);

const FormField = ({ label, required, children, hint }) => (
  <div>
    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
    {children}
    {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{hint}</div>}
  </div>
);

const InfoRow = ({ label, value, valueStyle }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", ...valueStyle }}>{value || "—"}</div>
  </div>
);

const SummaryRow = ({ label, value, color, bold, borderTop, small }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: bold ? 15 : small ? 11 : 13, fontWeight: bold ? 800 : 600, color: color || "#4b5563", marginBottom: bold ? 0 : 4, paddingTop: borderTop ? 8 : 0, borderTop: borderTop ? "1px solid #e5e7eb" : "none" }}>
    <span style={{ color: bold ? "#1a1a2e" : undefined }}>{label}</span>
    <span style={{ color: color || (bold ? "#2563eb" : undefined) }}>{value}</span>
  </div>
);

// ─── Site Visit Photos ────────────────────────────────────────────────────────
const SiteVisitPhotosPanel = ({ photos }) => {
  if (!photos?.length) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#f5f3ff,#ede9fe22)", border: "1px solid #c4b5fd", borderRadius: 10, padding: "12px 14px" }}>
      <SectionHeader icon={<CameraOutlined style={{ color: "#7c3aed" }} />} title={`Site Visit Photos (${photos.length})`} />
      <Image.PreviewGroup>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
          {photos.map((photo, i) => (
            <div key={photo._id || i}>
              <Image src={photo.url} alt={photo.caption || `Photo ${i + 1}`} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, border: "2px solid #c4b5fd", cursor: "pointer" }} preview={{ mask: <EyeOutlined style={{ fontSize: 16 }} /> }} />
              {photo.caption && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.caption}</div>}
              {photo.taken_at && <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center" }}>{dayjs(photo.taken_at).format("DD MMM, HH:mm")}</div>}
            </div>
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  );
};

// ─── Payment Info Panel ───────────────────────────────────────────────────────
const PaymentInfoPanel = ({ job, onCollectPayment }) => {
  const paid    = parseFloat(job.payment_amount || 0);
  const balance = parseFloat(job.balance_amount || 0);
  const nextDue = job.next_due_date;
  const hasDue  = nextDue && balance > 0;
  const history = job.payments || [];

  if (!history.length && paid <= 0 && balance <= 0) return null;

  let dueColor = "#1e40af", dueBg = "#eff6ff", dueBorder = "#93c5fd", dueMsg = "";
  if (hasDue) {
    const diff = dayjs(nextDue).startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff < 0)       { dueColor = "#991b1b"; dueBg = "#fee2e2"; dueBorder = "#fca5a5"; dueMsg = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""}`; }
    else if (diff === 0){ dueColor = "#92400e"; dueBg = "#fef3c7"; dueBorder = "#fcd34d"; dueMsg = "Due today"; }
    else if (diff <= 3) { dueColor = "#c2410c"; dueBg = "#fff7ed"; dueBorder = "#fdba74"; dueMsg = `Due in ${diff} day${diff > 1 ? "s" : ""}`; }
    else { dueMsg = `Due in ${diff} days`; }
  }

  return (
    <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px", border: "1px solid #bbf7d0" }}>
      <SectionHeader
        icon={<WalletOutlined />}
        title="Payment"
        action={balance > 0 && onCollectPayment && (
          <Button size="small" type="primary" icon={<WalletOutlined />} onClick={onCollectPayment} style={{ background: "#16a34a", borderColor: "#16a34a", marginLeft: 8 }}>
            Collect Payment
          </Button>
        )}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: hasDue ? 12 : 0 }}>
        <InfoRow label="Total Paid" value={paid > 0 ? `₹${paid.toFixed(2)}` : "Unpaid"} valueStyle={{ color: paid > 0 ? "#16a34a" : "#dc2626" }} />
        {balance > 0 && <InfoRow label="Balance Due" value={`₹${balance.toFixed(2)}`} valueStyle={{ color: "#dc2626", fontWeight: 800 }} />}
        {hasDue && <InfoRow label="Next Due Date" value={dayjs(nextDue).format("DD MMM YYYY")} valueStyle={{ color: dueColor, fontWeight: 700 }} />}
      </div>
      {hasDue && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: dueBg, border: `1px solid ${dueBorder}`, borderRadius: 8 }}>
          <CalendarOutlined style={{ color: dueColor, fontSize: 16, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, color: dueColor, fontSize: 13 }}>₹{balance.toFixed(2)} balance due on {dayjs(nextDue).format("dddd, DD MMM YYYY")}</div>
            <div style={{ fontSize: 11, color: dueColor, opacity: 0.8, marginTop: 2 }}>{dueMsg}</div>
          </div>
        </div>
      )}
      {balance <= 0 && paid > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8 }}>
          <CheckCircleOutlined style={{ color: "#16a34a", fontSize: 16 }} />
          <span style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>Fully paid — no outstanding balance</span>
        </div>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Payment History ({history.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {[...history].reverse().map((p, i) => (
              <div key={p._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1a1a2e" }}>
                    ₹{parseFloat(p.amount || 0).toFixed(2)}
                    {p.method && <span style={{ fontWeight: 400, color: "#6b7280" }}> · {p.method}</span>}
                    {p.discount_applied > 0 && <span style={{ fontWeight: 400, color: "#059669" }}> · Disc: ₹{parseFloat(p.discount_applied).toFixed(2)}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>
                    {p.paid_at ? dayjs(p.paid_at).format("DD MMM YYYY, HH:mm") : ""}{p.notes ? ` · ${p.notes}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>Bal after: ₹{parseFloat(p.balance_after ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Image compression helper ──────────────────────────────────────────────────
const compressImage = (file, { maxDimension = 1600, quality = 0.8 } = {}) =>
  new Promise((resolve) => {
    if (!file.type?.startsWith("image/")) { resolve(file); return; }
    if (file.type === "image/svg+xml") { resolve(file); return; }
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width  = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });

const uploadDesignFile = async (file) => {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("image", compressed);
  const res = await fetch("https://api.dmedia.in/api/upload_images", {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");
  return data.data.url;
};

const DesignFileUpload = ({ value, onChange }) => {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError("");
    try { const url = await uploadDesignFile(file); onChange(url); }
    catch (err) { setError(err.message || "Upload failed. Please try again."); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <input ref={fileRef}   type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button size="small" icon={<UploadOutlined />} loading={busy} onClick={() => fileRef.current?.click()} style={{ borderRadius: 6, fontSize: 12 }}>{value ? "Change" : "Upload Design"}</Button>
        {!busy && <Button size="small" icon={<CameraOutlined />} onClick={() => cameraRef.current?.click()} style={{ borderRadius: 6, fontSize: 12 }}>Camera</Button>}
        {value && !busy && <Button size="small" danger type="text" onClick={() => onChange("")} style={{ fontSize: 12 }}>Remove</Button>}
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626" }}>⚠ {error}</div>}
      {value && !busy && (
        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", padding: 4, display: "flex", justifyContent: "center", maxHeight: 120, overflow: "hidden" }}>
          <img src={value} alt="Design Preview" style={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }} onError={e => { e.currentTarget.style.display = "none"; }} />
        </div>
      )}
    </div>
  );
};

// ─── ProductItemRow ───────────────────────────────────────────────────────────
const ProductItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile, isTablet }) => {
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);
  const matched  = PRODUCTS.filter(p => p.product_name.toLowerCase().includes((item.product_name || "").toLowerCase()));
  const selected = PRODUCTS.find(p => p.product_name.toLowerCase() === (item.product_name || "").toLowerCase());

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sizeChange = (field, val) => {
    const updated = { ...item, [field]: val };
    if (!updated.sq_ft_manual) updated.sq_ft = parseFloat(toSqFt(updated.width, updated.height, updated.size_unit).toFixed(4));
    onChange(idx, updated);
  };
  const set = (f, v) => onChange(idx, { ...item, [f]: v });
  const handleQtyTypeChange = (val) => onChange(idx, { ...item, quantity_type: val, ...(val === "quantity" ? { sq_ft: 0, sq_ft_manual: false, width: "", height: "" } : {}) });

  const isSqFtMode = item.quantity_type === "sq.ft";
  const { base, gstAmt, total: lineTotal } = computeProductLineTotal(item);
  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sizeCols    = isSqFtMode ? (isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr") : (isMobile ? "1fr 1fr" : "1fr 1fr 90px");
  const priceCols   = isMobile ? "1fr 1fr" : "repeat(3,1fr)";

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? 10 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#e0e7ff", padding: "2px 10px", borderRadius: 20 }}>Item {idx + 1}</span>
          <Radio.Group size="small" value={item.quantity_type} onChange={e => handleQtyTypeChange(e.target.value)} buttonStyle="solid">
            {QTY_TYPE_OPTIONS.map(o => (<Radio.Button key={o.value} value={o.value} style={{ fontSize: 11, fontWeight: 600, height: 24, lineHeight: "22px", padding: "0 10px" }}>{o.label}</Radio.Button>))}
          </Radio.Group>
        </div>
        <Popconfirm title="Remove this item?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: productCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Product Name" required>
          <div style={{ position: "relative" }} ref={ref}>
            <Input placeholder="Type product…" value={item.product_name} size="small" autoComplete="off" style={{ borderRadius: 6 }}
              onChange={e => { onChange(idx, { ...item, product_name: e.target.value, variation: "", printing_type: "" }); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)} />
            {showSuggest && matched.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {matched.map(p => (
                  <div key={p.product_id}
                    onMouseDown={() => { onChange(idx, { ...item, product_name: p.product_name, product_id: p.product_id, variation: "", printing_type: "" }); setShowSuggest(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#1a1a2e", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    🖨️ {p.product_name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontWeight: 400 }}>{p.printing_type?.join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>
        <FormField label="Material">
          <Select placeholder={selected ? "Select variation" : "—"} value={item.variation || undefined} size="small" style={{ width: "100%" }} disabled={!selected} onChange={v => set("variation", v)}>
            {(selected?.variations || []).map(v => <Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>
        <FormField label="Printing Type">
          <Select placeholder={selected ? "Select type" : "—"} value={item.printing_type || undefined} size="small" style={{ width: "100%" }} disabled={!selected} onChange={v => set("printing_type", v)}>
            {(selected?.printing_type || []).map(t => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>
      {isSqFtMode && (
        <div style={{ display: "grid", gridTemplateColumns: sizeCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
          <FormField label="Width" required={isSqFtMode}>
            <Input size="small" placeholder="0" type="number" min={0} value={item.width} prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>W</span>} style={{ borderRadius: 6 }} onChange={e => sizeChange("width", e.target.value)} />
          </FormField>
          <FormField label="Height" required={isSqFtMode}>
            <Input size="small" placeholder="0" type="number" min={0} value={item.height} prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>H</span>} style={{ borderRadius: 6 }} onChange={e => sizeChange("height", e.target.value)} />
          </FormField>
          <FormField label="Unit">
            <Select value={item.size_unit} size="small" style={{ width: "100%" }} onChange={v => sizeChange("size_unit", v)}>
              {UNIT_OPTIONS.map(u => <Option key={u.value} value={u.value}>{u.label}</Option>)}
            </Select>
          </FormField>
          <FormField label="Sq. Ft">
            <InputNumber size="small" min={0} precision={4} value={item.sq_ft}
              style={{ width: "100%", borderRadius: 6, background: item.sq_ft > 0 ? "#ecfdf5" : undefined, borderColor: item.sq_ft > 0 ? "#6ee7b7" : undefined }}
              onChange={v => onChange(idx, { ...item, sq_ft: parseFloat((v || 0).toFixed(4)), sq_ft_manual: true })} />
          </FormField>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes / Specs">
          <Input placeholder="Custom text, specs…" value={item.notes} size="small" style={{ borderRadius: 6 }} onChange={e => set("notes", e.target.value)} />
        </FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: priceCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Quantity" required>
          <InputNumber min={1} value={item.quantity} size="small" style={{ width: "100%", borderRadius: 6 }} onChange={v => set("quantity", v || 1)} />
        </FormField>
        <FormField label={isSqFtMode ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={v => set("price", v || 0)} />
        </FormField>
        <FormField label="GST %">
          <Select value={item.gst_percentage ?? 0} size="small" style={{ width: "100%" }} onChange={v => set("gst_percentage", v)}>
            {GST_OPTIONS.map(g => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
          </Select>
        </FormField>
      </div>
      <div style={{ marginBottom: 10 }}>
        <FormField label="Design File">
          <DesignFileUpload value={item.design_file} onChange={path => set("design_file", path)} />
        </FormField>
      </div>
      <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
          {isSqFtMode && item.sq_ft > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>({item.quantity} qty × {item.sq_ft} ft² × ₹{item.price}/ft²)</span>}
          {!isSqFtMode && <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>({item.quantity} qty × ₹{item.price})</span>}
          {(item.gst_percentage || 0) > 0 && <span style={{ marginLeft: 8 }}>+ GST ({item.gst_percentage}%): <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>Item Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── OfficeServiceItemRow ─────────────────────────────────────────────────────
const OfficeServiceItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile }) => {
  const set = (f, v) => onChange(idx, { ...item, [f]: v });
  const selectedType = OFFICE_WORK_TYPES.find(t => t.value === item.office_type);
  const { base, gstAmt, total: lineTotal, qty } = computeOfficeServiceLineTotal(item);

  const renderCalcFields = () => {
    const calc = selectedType?.calc;
    if (calc === "days")   return (<FormField label="Number of Days" required><InputNumber min={1} value={item.days} size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="days" onChange={v => set("days", v || 1)} /></FormField>);
    if (calc === "hours")  return (<FormField label="Number of Hours" required><InputNumber min={0} step={0.5} value={item.hours} size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="hrs" onChange={v => set("hours", v || 0)} /></FormField>);
    if (calc === "counts") return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FormField label="Reels Count"><InputNumber min={0} value={item.reels_count} size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="reels" onChange={v => set("reels_count", v || 0)} /></FormField>
        <FormField label="Post Count"><InputNumber min={0} value={item.post_count} size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="posts" onChange={v => set("post_count", v || 0)} /></FormField>
      </div>
    );
    return null;
  };

  const getUnitLabel = () => {
    const calc = selectedType?.calc;
    if (calc === "days")  return "Price / Day (₹)";
    if (calc === "hours") return "Price / Hour (₹)";
    return "Price / Item (₹)";
  };

  const getQtyLabel = () => {
    const calc = selectedType?.calc;
    if (calc === "days")   return `${qty} day${qty !== 1 ? "s" : ""}`;
    if (calc === "hours")  return `${qty} hr${qty !== 1 ? "s" : ""}`;
    return `${item.reels_count || 0} reels + ${item.post_count || 0} posts`;
  };

  return (
    <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? 10 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#fef3c7", padding: "2px 10px", borderRadius: 20 }}>
          {selectedType?.icon} {selectedType?.label || "Office Work"} #{idx + 1}
        </span>
        <Popconfirm title="Remove this service?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <FormField label="Service Name"><Input placeholder="e.g. Company Website…" value={item.service_name} size="small" style={{ borderRadius: 6 }} onChange={e => set("service_name", e.target.value)} /></FormField>
        <FormField label="Service Type" required>
          <Select value={item.office_type} size="small" style={{ width: "100%" }} onChange={v => onChange(idx, { ...item, office_type: v, days: 1, hours: 1, reels_count: 0, post_count: 0 })}>
            {OFFICE_WORK_TYPES.map(t => <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>)}
          </Select>
        </FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (item.office_type === "social_media" ? "1fr" : "1fr 1fr 1fr"), gap: 8, marginBottom: 10, alignItems: "end" }}>
        <div style={{ gridColumn: item.office_type === "social_media" ? "1/-1" : undefined }}>{renderCalcFields()}</div>
        {item.office_type !== "social_media" && (
          <>
            <FormField label={getUnitLabel()} required><InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={v => set("price", v || 0)} /></FormField>
            <FormField label="GST %"><Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={v => set("gst_percentage", v)}>{GST_OPTIONS.map(g => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}</Select></FormField>
          </>
        )}
      </div>
      {item.office_type === "social_media" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <FormField label="Price / Item (₹)" required><InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={v => set("price", v || 0)} /></FormField>
          <FormField label="GST %"><Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={v => set("gst_percentage", v)}>{GST_OPTIONS.map(g => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}</Select></FormField>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes"><Input placeholder="Additional notes…" value={item.notes} size="small" style={{ borderRadius: 6 }} onChange={e => set("notes", e.target.value)} /></FormField>
      </div>
      <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          {getQtyLabel()} × ₹{item.price} = <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && <span style={{ marginLeft: 8 }}>GST ({item.gst_percentage}%): <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>Service Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── LabourItemRow ────────────────────────────────────────────────────────────
const LabourItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile }) => {
  const set = (f, v) => onChange(idx, { ...item, [f]: v });
  const { base, gstAmt, total: lineTotal, sqFtAmt, hoursAmt } = computeLabourLineTotal(item);
  return (
    <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? 10 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#f3e8ff", padding: "2px 10px", borderRadius: 20 }}>🔧 Labour #{idx + 1}</span>
        <Popconfirm title="Remove this labour entry?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>
      <div style={{ marginBottom: 10 }}>
        <FormField label="Work Description"><Input placeholder="e.g. Flex installation, cutting, finishing…" value={item.service_name} size="small" style={{ borderRadius: 6 }} onChange={e => set("service_name", e.target.value)} /></FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        <FormField label="Sq. Ft"><InputNumber min={0} step={0.5} value={item.sq_ft || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="ft²" onChange={v => set("sq_ft", v || 0)} /></FormField>
        <FormField label="Price / Sq. Ft (₹)"><InputNumber min={0} value={item.price_per_sqft || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={v => set("price_per_sqft", v || 0)} /></FormField>
        <FormField label="Hours"><InputNumber min={0} step={0.5} value={item.hours || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: 6 }} addonAfter="hrs" onChange={v => set("hours", v || 0)} /></FormField>
        <FormField label="Price / Hour (₹)"><InputNumber min={0} value={item.price_per_hour || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={v => set("price_per_hour", v || 0)} /></FormField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <FormField label="GST %"><Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={v => set("gst_percentage", v)}>{GST_OPTIONS.map(g => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}</Select></FormField>
        <FormField label="Notes"><Input placeholder="Notes…" value={item.notes} size="small" style={{ borderRadius: 6 }} onChange={e => set("notes", e.target.value)} /></FormField>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          {item.sq_ft > 0 && <span>{item.sq_ft} ft² × ₹{item.price_per_sqft} = ₹{sqFtAmt.toFixed(2)}</span>}
          {item.sq_ft > 0 && item.hours > 0 && <span style={{ margin: "0 6px", color: "#9ca3af" }}>+</span>}
          {item.hours > 0 && <span>{item.hours} hrs × ₹{item.price_per_hour} = ₹{hoursAmt.toFixed(2)}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && <span style={{ marginLeft: 8 }}>GST ({item.gst_percentage}%): <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#6b21a8" }}>Labour Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── JobItemsSection ──────────────────────────────────────────────────────────
const JobItemsSection = ({ productItems, officeItems, labourItems, onProductChange, onOfficeChange, onLabourChange, onAddProduct, onAddOffice, onAddLabour, onRemoveProduct, onRemoveOffice, onRemoveLabour, isMobile, isTablet }) => {
  const tabItems = [
    {
      key: "product",
      label: (<span style={{ display: "flex", alignItems: "center", gap: 6 }}><AppstoreOutlined /> Product{productItems.length > 0 && <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 5px" }}>{productItems.length}</Tag>}</span>),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
          {productItems.map((item, idx) => (
            <ProductItemRow key={idx} item={item} idx={idx} onChange={onProductChange} onRemove={onRemoveProduct}
              isOnly={productItems.length === 1 && officeItems.length === 0 && labourItems.length === 0}
              isMobile={isMobile} isTablet={isTablet} />
          ))}
          <Button icon={<PlusOutlined />} onClick={onAddProduct} style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 40, borderColor: "#93c5fd" }}>Add Product Item</Button>
        </div>
      ),
    },
    {
      key: "service",
      label: (<span style={{ display: "flex", alignItems: "center", gap: 6 }}><ToolOutlined /> Service{(officeItems.length + labourItems.length) > 0 && <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 5px" }}>{officeItems.length + labourItems.length}</Tag>}</span>),
      children: (
        <Tabs size="small" type="card" items={[
          {
            key: "office",
            label: (<span style={{ display: "flex", alignItems: "center", gap: 5 }}><AppstoreOutlined style={{ fontSize: 12 }} /> Office Work {officeItems.length > 0 && <Tag color="gold" style={{ margin: 0, fontSize: 10, lineHeight: "14px", padding: "0 4px" }}>{officeItems.length}</Tag>}</span>),
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                {officeItems.map((item, idx) => (<OfficeServiceItemRow key={idx} item={item} idx={idx} onChange={onOfficeChange} onRemove={onRemoveOffice} isOnly={officeItems.length === 1} isMobile={isMobile} />))}
                <Button icon={<PlusOutlined />} onClick={onAddOffice} style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 40, borderColor: "#fcd34d" }}>Add Office Work</Button>
              </div>
            ),
          },
          {
            key: "labour",
            label: (<span style={{ display: "flex", alignItems: "center", gap: 5 }}><ToolOutlined style={{ fontSize: 12 }} /> Labour Work {labourItems.length > 0 && <Tag color="purple" style={{ margin: 0, fontSize: 10, lineHeight: "14px", padding: "0 4px" }}>{labourItems.length}</Tag>}</span>),
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                {labourItems.map((item, idx) => (<LabourItemRow key={idx} item={item} idx={idx} onChange={onLabourChange} onRemove={onRemoveLabour} isOnly={labourItems.length === 1} isMobile={isMobile} />))}
                <Button icon={<PlusOutlined />} onClick={onAddLabour} style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 40, borderColor: "#c4b5fd" }}>Add Labour Work</Button>
              </div>
            ),
          },
        ]} />
      ),
    },
  ];
  return <Tabs defaultActiveKey="product" type="card" size="middle" style={{ marginBottom: 14 }} items={tabItems} />;
};

// ─── ViewCartItems ────────────────────────────────────────────────────────────
const ViewCartItems = ({ cartItems, isMobile }) => {
  if (!cartItems?.length) return <div style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>No items.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cartItems.map((it, i) => {
        const cat = it.item_category;
        let lineTotal = 0, summary = "";
        if (cat === "service_office")       { const r = computeOfficeServiceLineTotal(it); lineTotal = r.total; summary = `${it.office_type} · ₹${r.base.toFixed(2)} base`; }
        else if (cat === "service_labour")  { const r = computeLabourLineTotal(it);        lineTotal = r.total; summary = `${it.sq_ft || 0} ft² + ${it.hours || 0} hrs · ₹${r.base.toFixed(2)} base`; }
        else                                { const r = computeProductLineTotal(it);       lineTotal = r.total; summary = it.quantity_type === "sq.ft" ? `${it.quantity} × ${it.sq_ft} ft² × ₹${it.price}/ft² = ₹${r.base.toFixed(2)}` : `${it.quantity} × ₹${it.price} = ₹${r.base.toFixed(2)}`; }
        const isProduct = !cat || cat === "product";
        const bgColor   = cat === "service_office" ? "#fffbeb" : cat === "service_labour" ? "#faf5ff" : "#fff";
        const borderColor = cat === "service_office" ? "#fde68a" : cat === "service_labour" ? "#e9d5ff" : "#e5e7eb";
        return (
          <div key={it._id || it.item_id || i} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#e0e7ff", padding: "2px 8px", borderRadius: 20 }}>#{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e", textTransform: "capitalize" }}>{it.product_name || it.service_name || "—"}</span>
                {it.variation && <Tag style={{ fontSize: 10, margin: 0 }}>{it.variation}</Tag>}
                {it.printing_type && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{it.printing_type}</Tag>}
                {cat === "service_office" && <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>Office Work</Tag>}
                {cat === "service_labour" && <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Labour</Tag>}
              </div>
              <div style={{ fontWeight: 700, color: "#065f46", fontSize: 15, background: "#d1fae5", padding: "2px 10px", borderRadius: 8 }}>₹{lineTotal.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{summary}</div>
            {isProduct && it.size && <div style={{ fontSize: 11, color: "#374151" }}>Size: {it.size}</div>}
            {it.notes && <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontStyle: "italic", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px" }}>Note: "{it.notes}"</div>}
            {(it.design_files || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase" }}>Design Files</div>
                <Image.PreviewGroup>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(it.design_files || []).map((df, di) => (
                      <div key={df._id || di} style={{ textAlign: "center" }}>
                        <Image src={df.url} alt={df.file_name || `Design ${di + 1}`} style={{ height: 70, width: 70, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer" }} preview={{ mask: <EyeOutlined /> }} />
                        {df.label && <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{df.label}</div>}
                      </div>
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            )}
            {it.design_file && !(it.design_files || []).length && (
              <div style={{ marginTop: 8 }}>
                <img src={it.design_file} alt="Design" style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 6, objectFit: "contain", border: "1px solid #e5e7eb" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
const AdminJobManagement = () => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // ── State ──────────────────────────────────────────────────────────────────
  const [viewModal, setViewModal] = useState(false);
  const [viewJob,   setViewJob]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [jobs,      setJobs]      = useState([]);
  const [total,     setTotal]     = useState(0);

  const [searchName,   setSearchName]   = useState("");
  const [searchJobNo,  setSearchJobNo]  = useState("");
  const [searchDate,   setSearchDate]   = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown]        = useState(AUTO_REFRESH_INTERVAL / 1000);

  // Edit modal
  const [editModal,   setEditModal]   = useState(false);
  const [editJob,     setEditJob]     = useState(null);
  const [editForm,    setEditForm]    = useState({ ...DEFAULT_EDIT_FORM });
  const [editProductItems, setEditProductItems] = useState([{ ...EMPTY_PRODUCT_ITEM }]);
  const [editOfficeItems,  setEditOfficeItems]  = useState([]);
  const [editLabourItems,  setEditLabourItems]  = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState("");

  // Approve modal
  const [approveModalOpen,  setApproveModalOpen]  = useState(false);
  const [approvingJob,      setApprovingJob]       = useState(null);
  const [designers,         setDesigners]          = useState([]);
  const [selectedDesigner,  setSelectedDesigner]   = useState(null);
  const [approving,         setApproving]          = useState(false);
  const [designersLoading,  setDesignersLoading]   = useState(false);

  // Collect Payment modal
  const [collectPaymentModal, setCollectPaymentModal] = useState(false);
  const [payingJob,           setPayingJob]           = useState(null);
  const [paymentForm,         setPaymentForm]         = useState({ amount: "", method: "", notes: "", next_due_date: null, discount_amount: 0 });
  const [collectingPayment,   setCollectingPayment]   = useState(false);
  const [collectPaymentError, setCollectPaymentError] = useState("");

  const autoRefreshRef = useRef(null);
  const countdownRef   = useRef(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch("https://api.dmedia.in/api/jobs", { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
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
    countdownRef.current   = setInterval(() => setCountdown(p => p <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : p - 1), 1000);
    autoRefreshRef.current = setInterval(() => loadJobs(true), AUTO_REFRESH_INTERVAL);
  }, [loadJobs]);

  useEffect(() => { loadJobs(); startAutoRefresh(); return () => { clearInterval(autoRefreshRef.current); clearInterval(countdownRef.current); }; }, []);
  useEffect(() => { setPage(1); }, [searchName, searchJobNo, searchDate, statusFilter, pageSize]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      result = result.filter(j => (j.customer_name || "").toLowerCase().includes(q) || (j.company_name || "").toLowerCase().includes(q) || (j.customer_phone || "").includes(q));
    }
    if (searchJobNo.trim()) {
      const q = searchJobNo.trim().toLowerCase();
      result = result.filter(j => (j.job_no || "").toLowerCase().includes(q));
    }
    if (searchDate) {
      const dateStr = searchDate.format("YYYY-MM-DD");
      result = result.filter(j => {
        const orderDate = j.order_date ? dayjs(j.order_date).format("YYYY-MM-DD") : null;
        const delivDate = j.estimated_delivery_date ? dayjs(j.estimated_delivery_date).format("YYYY-MM-DD") : null;
        return orderDate === dateStr || delivDate === dateStr;
      });
    }
    if (statusFilter) result = result.filter(j => j.job_status === statusFilter);
    return result;
  }, [jobs, searchName, searchJobNo, searchDate, statusFilter]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, page, pageSize]);

  const clearAllFilters = () => { setSearchName(""); setSearchJobNo(""); setSearchDate(null); setStatusFilter(null); setPage(1); };
  const hasActiveFilters = searchName || searchJobNo || searchDate || statusFilter;

  // ── Edit totals with round-half-up ────────────────────────────────────────
  const editTotals = useMemo(() => {
    let subtotal = 0, taxAmount = 0;
    editProductItems.forEach(it => { const r = computeProductLineTotal(it);       subtotal += r.base; taxAmount += r.gstAmt; });
    editOfficeItems.forEach(it  => { const r = computeOfficeServiceLineTotal(it); subtotal += r.base; taxAmount += r.gstAmt; });
    editLabourItems.forEach(it  => { const r = computeLabourLineTotal(it);        subtotal += r.base; taxAmount += r.gstAmt; });

    const discountAmt     = Math.min(parseFloat(editForm.discount_amount) || 0, subtotal);
    const taxableAmount   = subtotal - discountAmt;
    const designCharges   = parseFloat(editForm.design_charges) || 0;
    const deliveryCharges = editForm.free_delivery ? 0 : parseFloat(editForm.delivery_charges) || 0;

    const grandTotalExact   = taxableAmount + taxAmount + designCharges + deliveryCharges;
    const grandTotalRounded = roundHalfUp(grandTotalExact);
    const roundingAdj       = parseFloat((grandTotalRounded - grandTotalExact).toFixed(2));

    return { subtotal, taxAmount, discountAmt, taxableAmount, designCharges, deliveryCharges, grandTotalExact, grandTotal: grandTotalRounded, roundingAdj };
  }, [editProductItems, editOfficeItems, editLabourItems, editForm]);

  const hasRounding = Math.abs(editTotals.roundingAdj) >= 0.01;

  // ── Projected balance after saving edits (uses rounded total) ────────────
  const projectedBalanceAfterSave = useMemo(() => {
    const alreadyPaid = parseFloat(editJob?.payment_amount || 0);
    return parseFloat((editTotals.grandTotal - alreadyPaid).toFixed(2));
  }, [editTotals.grandTotal, editJob]);

  // ── Live balance for collect payment modal ────────────────────────────────
  // If the user edits items and then opens "Collect Payment" without saving,
  // we use the live rounded total minus already-paid so the balance is correct.
  const getLiveBalance = useCallback((job) => {
    if (editJob && job._id === editJob._id) {
      const alreadyPaid = parseFloat(editJob.payment_amount || 0);
      return Math.max(0, parseFloat((editTotals.grandTotal - alreadyPaid).toFixed(2)));
    }
    return parseFloat(job.balance_amount || 0);
  }, [editJob, editTotals.grandTotal]);

  // ── Designers ──────────────────────────────────────────────────────────────
  const fetchDesigners = async () => {
    setDesignersLoading(true);
    try {
      const res  = await fetch("https://api.dmedia.in/api/admin/get_admin", { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
      const data = await res.json();
      const team = (data.data || []).filter(u => u.role === "designing team");
      setDesigners(team); return team;
    } catch { ERROR_NOTIFICATION({ message: "Could not load designers list" }); return []; }
    finally { setDesignersLoading(false); }
  };

  const openApproveModal = async (job) => { setApprovingJob(job); setSelectedDesigner(null); setApproveModalOpen(true); await fetchDesigners(); };

  const handleApproveWithDesigner = async () => {
    if (!selectedDesigner) { ERROR_NOTIFICATION({ message: "Please select a designer." }); return; }
    setApproving(true);
    try {
      const profile = localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile")) : {};
      const isCustomer = selectedDesigner._id === "customer_designed";
      const body = isCustomer
        ? { job_status: "design", approved_by: profile.name || null, approved_by_admin_id: profile._id || null, is_customer_designed: true }
        : { job_status: "design", approved_by: profile.name || null, approved_by_admin_id: profile._id || null, assign_to: { user_id: selectedDesigner._id, name: selectedDesigner.name || selectedDesigner.fullName || "Unknown" } };
      const res  = await fetch(`https://api.dmedia.in/api/jobs/${approvingJob._id}/approve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      SUCCESS_NOTIFICATION({ message: isCustomer ? `Job ${approvingJob.job_no} approved (customer design)` : `Job ${approvingJob.job_no} approved & assigned to ${selectedDesigner.name || "designer"}` });
      setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) { ERROR_NOTIFICATION({ message: err.message || "Failed to approve" }); }
    finally { setApproving(false); }
  };

  // ── Collect Payment ────────────────────────────────────────────────────────
  const openCollectPaymentModal = (job) => {
    setCollectPaymentError("");
    // Attach live_balance so modal always reflects current item totals
    const liveBalance = getLiveBalance(job);
    setPayingJob({ ...job, live_balance: liveBalance });
    setPaymentForm({ amount: "", method: job.payment_mode || "", notes: "", next_due_date: null, discount_amount: 0 });
    setCollectPaymentModal(true);
  };

  const closeCollectPaymentModal = () => {
    if (collectingPayment) return;
    setCollectPaymentModal(false);
    setPayingJob(null);
    setCollectPaymentError("");
  };

  const handleCollectPayment = async () => {
    setCollectPaymentError("");
    // Use live_balance (which may reflect unsaved item edits) as the source of truth
    const balance  = parseFloat(payingJob?.live_balance ?? payingJob?.balance_amount ?? 0);
    const discount = parseFloat(paymentForm.discount_amount) || 0;
    const amt      = parseFloat(paymentForm.amount);

    if (!amt || amt <= 0) { setCollectPaymentError("Enter a valid payment amount."); return; }
    if (discount < 0)     { setCollectPaymentError("Discount cannot be negative."); return; }
    if (discount > balance + 0.01) { setCollectPaymentError(`Discount (₹${discount.toFixed(2)}) cannot exceed the balance (₹${balance.toFixed(2)}).`); return; }

    const effectiveBalance = Math.max(0, balance - discount);
    if (amt > effectiveBalance + 0.01) { setCollectPaymentError(`Amount cannot exceed the balance after discount (₹${effectiveBalance.toFixed(2)}).`); return; }

    setCollectingPayment(true);
    try {
      const remaining = parseFloat((effectiveBalance - amt).toFixed(2));
      const body = {
        amount:           amt,
        method:           paymentForm.method || "",
        notes:            paymentForm.notes  || "",
        discount_applied: discount,
        next_due_date:    remaining > 0 && paymentForm.next_due_date ? dayjs(paymentForm.next_due_date).toISOString() : null,
      };
      const res  = await fetch(`https://api.dmedia.in/api/jobs/${payingJob._id}/collect-payment`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to record payment");

      SUCCESS_NOTIFICATION({ message: `₹${amt.toFixed(2)} payment recorded for ${payingJob.job_no}` + (discount > 0 ? ` (₹${discount.toFixed(2)} discount applied)` : "") });

      const updatedJob = data.data || null;
      if (updatedJob) {
        if (viewJob && viewJob._id === updatedJob._id) setViewJob(updatedJob);
        if (editJob && editJob._id === updatedJob._id) setEditJob(updatedJob);
      }

      setCollectPaymentModal(false); setPayingJob(null);
      loadJobs(true);
    } catch (err) { setCollectPaymentError(err.message || "Failed to record payment"); }
    finally { setCollectingPayment(false); }
  };

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const openEditModal = (record) => {
    setEditJob(record); setEditError("");
    const addr        = record.delivery_address || {};
    const streetParts = (addr.street || "").split(", ");
    const storedDisc  = parseFloat(record.discount_amount) || 0;
    const legacyPct   = parseFloat(record.discount_percentage) || 0;
    let legacyDisc = 0;
    if (!storedDisc && legacyPct > 0) {
      const sub = (record.cart_items || []).reduce((acc, it) => acc + computeProductLineTotal(it).base, 0);
      legacyDisc = sub * (legacyPct / 100);
    }
    setEditForm({
      customer_name:           record.customer_name || "",
      customer_phone:          record.customer_phone || "",
      company_name:            record.company_name || "",
      estimated_delivery_date: record.estimated_delivery_date ? dayjs(record.estimated_delivery_date).format("YYYY-MM-DDTHH:mm") : "",
      address_line1: streetParts[0] || "",
      address_line2: streetParts.slice(1).join(", ") || "",
      city:    addr.city || "", state: addr.state || "", pincode: addr.pincode || "", country: addr.country || "India",
      gst_no:           record.gst_no || "",
      delivery_charges: record.delivery_charges ?? 0,
      free_delivery:    record.free_delivery ?? false,
      design_charges:   record.design_charges ?? 0,
      discount_amount:  storedDisc || legacyDisc || 0,
      notes:            record.notes || "",
      terms_and_conditions: record.terms_and_conditions || "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
    });

    const allItems   = record.cart_items || [];
    const products   = allItems.filter(it => it.item_category === "product" || !it.item_category);
    const mappedProducts = products.map(it => {
      let width = String(it.width || ""), height = String(it.height || ""), size_unit = it.size_unit || "ft";
      if ((!width || !height) && it.size) { const m = it.size.match(/^([\d.]+)\s*[×xX]\s*([\d.]+)\s*(\w+)/); if (m) { width = m[1]; height = m[2]; size_unit = m[3] || "ft"; } }
      const quantity_type = it.quantity_type || (parseFloat(width) > 0 && parseFloat(height) > 0 ? "sq.ft" : "quantity");
      const sq_ft = it.sq_ft ? parseFloat(it.sq_ft) : quantity_type === "sq.ft" ? parseFloat(toSqFt(width, height, size_unit).toFixed(4)) : 0;
      return { ...EMPTY_PRODUCT_ITEM, ...it, item_category: "product", width, height, size_unit, sq_ft, quantity_type, gst_percentage: it.gst_percentage ?? 0 };
    });
    setEditProductItems(mappedProducts.length ? mappedProducts : [{ ...EMPTY_PRODUCT_ITEM }]);
    const offices = allItems.filter(it => it.item_category === "service_office");
    setEditOfficeItems(offices.map(it => ({ ...EMPTY_OFFICE_ITEM, ...it, item_category: "service_office", gst_percentage: it.gst_percentage ?? 0 })));
    const labours = allItems.filter(it => it.item_category === "service_labour");
    setEditLabourItems(labours.map(it => ({ ...EMPTY_LABOUR_ITEM, ...it, item_category: "service_labour", gst_percentage: it.gst_percentage ?? 0 })));
    setEditModal(true);
  };

  const resetEditModal = () => {
    setEditModal(false); setEditJob(null); setEditError("");
    setEditForm({ ...DEFAULT_EDIT_FORM });
    setEditProductItems([{ ...EMPTY_PRODUCT_ITEM }]);
    setEditOfficeItems([]);
    setEditLabourItems([]);
  };

  const handleEditInput = (k, v) => setEditForm(p => ({ ...p, [k]: v }));

  const handleEditSubmit = async () => {
    setEditLoading(true); setEditError("");
    try {
      if (!editForm.customer_name.trim())    throw new Error("Customer name is required");
      if (!editForm.customer_phone.trim())   throw new Error("Phone number is required");
      if (!editForm.estimated_delivery_date) throw new Error("Estimated delivery date is required");

      const validProducts = editProductItems.filter(it => {
        if (!it.product_name || !it.quantity_type) return false;
        if (it.quantity_type === "sq.ft" && (it.sq_ft || 0) <= 0) return false;
        return (it.quantity || 0) > 0 && (it.price || 0) > 0;
      });
      const validOffice = editOfficeItems.filter(it => it.office_type && (it.price || 0) > 0);
      const validLabour = editLabourItems.filter(it => it.sq_ft > 0 || it.hours > 0);
      if (!validProducts.length && !validOffice.length && !validLabour.length) throw new Error("Add at least one valid item with price/qty");

      const cartItems = [
        ...validProducts.map(it => {
          const { base, gstAmt, total } = computeProductLineTotal(it);
          const isSqFt = it.quantity_type === "sq.ft";
          return { item_category: "product", product_id: it.product_id || "", product_name: it.product_name, variation: it.variation || "", printing_type: it.printing_type || "", quantity: it.quantity, quantity_type: it.quantity_type, price: it.price, gst_percentage: it.gst_percentage || 0, gst_amount: parseFloat(gstAmt.toFixed(2)), line_base: parseFloat(base.toFixed(2)), line_total: parseFloat(total.toFixed(2)), design_file: it.design_file || "", notes: it.notes || "", width: isSqFt ? it.width : "", height: isSqFt ? it.height : "", size_unit: isSqFt ? it.size_unit : "pcs", sq_ft: isSqFt ? it.sq_ft : 0, sq_ft_manual: it.sq_ft_manual || false, size: isSqFt && it.width && it.height ? `${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)` : "" };
        }),
        ...validOffice.map(it => {
          const { base, gstAmt, total, qty } = computeOfficeServiceLineTotal(it);
          return { item_category: "service_office", product_name: it.service_name || it.office_type, office_type: it.office_type, days: it.days || 0, hours: it.hours || 0, reels_count: it.reels_count || 0, post_count: it.post_count || 0, quantity: qty, quantity_type: it.office_type === "website" ? "days" : it.office_type === "social_media" ? "items" : "hours", price: it.price, gst_percentage: it.gst_percentage || 0, gst_amount: parseFloat(gstAmt.toFixed(2)), line_base: parseFloat(base.toFixed(2)), line_total: parseFloat(total.toFixed(2)), notes: it.notes || "" };
        }),
        ...validLabour.map(it => {
          const { base, gstAmt, total } = computeLabourLineTotal(it);
          return { item_category: "service_labour", product_name: it.service_name || "Labour Work", sq_ft: it.sq_ft || 0, hours: it.hours || 0, price_per_sqft: it.price_per_sqft || 0, price_per_hour: it.price_per_hour || 0, quantity: 1, quantity_type: "labour", price: base || 0, gst_percentage: it.gst_percentage || 0, gst_amount: parseFloat(gstAmt.toFixed(2)), line_base: parseFloat(base.toFixed(2)), line_total: parseFloat(total.toFixed(2)), notes: it.notes || "" };
        }),
      ];

      const payload = {
        customer_name:           editForm.customer_name.trim(),
        customer_phone:          editForm.customer_phone.trim(),
        company_name:            (editForm.company_name || "").trim(),
        estimated_delivery_date: dayjs(editForm.estimated_delivery_date).toISOString(),
        delivery_address: { street: [editForm.address_line1, editForm.address_line2].filter(Boolean).join(", "), city: editForm.city, state: editForm.state, pincode: editForm.pincode, country: editForm.country },
        cart_items:           cartItems,
        gst_no:               editForm.gst_no.trim(),
        delivery_charges:     editTotals.deliveryCharges,
        free_delivery:        editForm.free_delivery,
        design_charges:       editTotals.designCharges,
        discount_amount:      parseFloat(editTotals.discountAmt.toFixed(2)),
        discount_percentage:  0,
        subtotal:             parseFloat(editTotals.subtotal.toFixed(2)),
        taxable_amount:       parseFloat(editTotals.taxableAmount.toFixed(2)),
        tax_amount:           parseFloat(editTotals.taxAmount.toFixed(2)),
        // ✅ Send the rounded total — backend will recomputePayments() from this
        total_amount:         editTotals.grandTotal,
        rounding_adjustment:  parseFloat(editTotals.roundingAdj.toFixed(2)),
        notes:                editForm.notes,
        terms_and_conditions: editForm.terms_and_conditions,
      };

      const res  = await fetch(`https://api.dmedia.in/api/jobs/${editJob._id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update job");
      SUCCESS_NOTIFICATION({ message: "Job updated successfully!" });
      resetEditModal(); loadJobs(true);
    } catch (err) { setEditError(err.message || "Failed to update job"); }
    finally { setEditLoading(false); }
  };

  // ── Layout vars ────────────────────────────────────────────────────────────
  const p   = isMobile ? 8 : 12;
  const g   = isMobile ? 8 : 12;
  const c2  = isMobile ? "1fr" : "1fr 1fr";
  const c3  = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const c4  = isMobile ? "1fr 1fr" : "repeat(4,1fr)";
  const c5  = isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr 1fr" : "repeat(4,1fr)";
  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const modalWidth  = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw,900px)";
  const mobileStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};
  const modalBody   = { maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh", overflowY: "auto", padding: isMobile ? 10 : 16 };
  const sheetStyle  = isMobile ? { top: "auto", bottom: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};
  const sheetBody   = { maxHeight: isMobile ? "72dvh" : "80vh", overflowY: "auto", padding: isMobile ? 12 : 16 };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    { title: "#", width: 36, render: (_, __, i) => <span style={{ color: "#9ca3af", fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</span> },
    {
      title: "Job No", dataIndex: "job_no",
      render: (n, record) => {
        const isSV = isSiteVisitJob(record);
        const hasPaymentDue = record.next_due_date && parseFloat(record.balance_amount || 0) > 0;
        const completed = isFullyCompletedAndPaid(record);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
            {!completed && <OverdueBadge estimated_delivery_date={record.estimated_delivery_date} jobStatus={record.job_status} />}
            {!completed && hasPaymentDue && <PaymentDueBadge next_due_date={record.next_due_date} balance_amount={record.balance_amount} />}
            {isSV && <SiteVisitBadge />}
            {completed && (
              <Tooltip title="Job completed & fully paid">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46", whiteSpace: "nowrap" }}>
                  <CheckCircleOutlined style={{ fontSize: 9 }} /> Done & Paid
                </span>
              </Tooltip>
            )}
            <Tag color={completed ? "green" : "blue"} style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11, margin: 0, border: isSV ? "1px solid #a78bfa" : undefined }}>{n || "—"}</Tag>
          </div>
        );
      },
    },
    {
      title: "Customer", key: "customer",
      render: (_, r) => {
        const isSV = isSiteVisitJob(r);
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e" }}>{r.customer_name || "—"}</div>
            {r.company_name && <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}><BankOutlined style={{ fontSize: 10 }} /> {r.company_name}</div>}
            <div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_phone || ""}</div>
            {isSV && r.site_visit_no && <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}><CompassOutlined style={{ fontSize: 9 }} /> {r.site_visit_no}</div>}
            {isMobile && (() => { const cfg = STATUS_CONFIG[r.job_status] || STATUS_CONFIG.draft; return <Tag color={cfg.color} icon={cfg.icon} style={{ marginTop: 4, fontSize: 10 }}>{cfg.label}</Tag>; })()}
          </div>
        );
      },
    },
     ...(!isMobile ? [{
      title: "Created", dataIndex: "createdAt",
      width: 110,
      render: (date) => {
        if (!date) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{dayjs(date).format("DD MMM YY")}</span>
            <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{dayjs(date).format("HH:mm")}</span>
          </div>
        );
      },
    }] : []),
    ...(!isMobile ? [{
      title: "Est. Delivery", dataIndex: "estimated_delivery_date",
      render: (d, record) => {
        if (!d) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
        const info = getOverdueInfo(d);
        const completed = isFullyCompletedAndPaid(record);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{dayjs(d).format("DD MMM YY")}</span>
            {info && !completed && <span style={{ fontSize: 10, fontWeight: 600, color: info.color, whiteSpace: "nowrap" }}>{info.isDueToday ? "⚡ Today" : info.isOverdue ? `⚠ ${info.label}` : info.label}</span>}
            {completed && <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", whiteSpace: "nowrap" }}>✓ Completed</span>}
          </div>
        );
      },
    }] : []),
    {
      title: "Amount", key: "amount",
      render: (_, r) => {
        const balance = parseFloat(r.balance_amount || 0), paid = parseFloat(r.payment_amount || 0);
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", whiteSpace: "nowrap" }}>₹{parseFloat(r.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            {balance > 0   && <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>Bal: ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>}
            {balance <= 0 && paid > 0 && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>✓ Paid</div>}
          </div>
        );
      },
    },
    ...(!isMobile ? [{
      title: "Status", dataIndex: "job_status",
      render: (s) => { const c = STATUS_CONFIG[s] || STATUS_CONFIG.draft; return <Tag color={c.color} icon={c.icon} style={{ fontWeight: 500 }}>{c.label}</Tag>; },
    }] : []),
    ...(isDesktop ? [{
      title: "Stage", key: "stage",
      render: (_, r) => { const stage = r.current_stage?.stage, label = WORKFLOW_STAGES.find(s => s.value === stage)?.label; return stage ? <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>{label}</Tag> : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>; },
    }] : []),
    {
      title: "Approved By", key: "approved_by", width: isMobile ? 100 : 130,
      render: (_, r) => {
        if (!r.approved_by && !r.approved_by_admin_id) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
        return (
          <Tooltip title={r.approved_by_admin_id ? `Admin ID: ${r.approved_by_admin_id}` : ""}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <UserOutlined style={{ color: "#6b7280", fontSize: 11 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{r.approved_by || "Unknown"}</span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "", width: isMobile ? 90 : 190,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Tooltip title="View Job"><Button icon={<EyeOutlined />} size="small" style={{ color: "#6b7280", borderColor: "#e5e7eb" }} onClick={() => { setViewJob(record); setViewModal(true); }}>{!isMobile && "View"}</Button></Tooltip>
          <Tooltip title="Edit Job"><Button icon={<EditOutlined />} size="small" style={{ color: "#2563eb", borderColor: "#bfdbfe" }} onClick={() => openEditModal(record)}>{!isMobile && "Edit"}</Button></Tooltip>
          {parseFloat(record.balance_amount || 0) > 0 && (
            <Tooltip title="Collect Payment">
              <Button icon={<WalletOutlined />} size="small" style={{ color: "#d97706", borderColor: "#fde68a" }} onClick={() => openCollectPaymentModal(record)}>{!isMobile && "Collect"}</Button>
            </Tooltip>
          )}
          {record.job_status === "draft" && <Tooltip title="Approve & Assign"><Button type="primary" icon={<CheckCircleOutlined />} size="small" style={{ background: "#16a34a", borderColor: "#16a34a" }} onClick={() => openApproveModal(record)}>{!isMobile && "Approve"}</Button></Tooltip>}
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: p, background: "#f8fafc", minHeight: "100vh" }}>

      {/* Header */}
      <Card bodyStyle={{ padding: `${p}px ${p + 4}px` }} style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "#1a1a2e" }}>Job Management</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              <strong>{filteredJobs.length}</strong> job{filteredJobs.length !== 1 ? "s" : ""}{hasActiveFilters ? " (filtered)" : ` · Total: ${jobs.length}`} · Refreshed {lastRefreshed.format("HH:mm:ss")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px #bbf7d0", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600, fontFamily: "monospace" }}>{formatCountdown(countdown)}</span>
            </div>
            <Tooltip title="Refresh now"><Button icon={<ReloadOutlined spin={loading} />} onClick={() => { loadJobs(); startAutoRefresh(); }} style={{ borderRadius: 8 }} /></Tooltip>
          </div>
        </div>
      </Card>

      {/* Search & Filters */}
      <Card bodyStyle={{ padding: `${p}px ${p + 4}px` }} style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: g, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr 1fr" : "1fr 1fr 200px 180px", gap: 8, alignItems: "flex-end" }}>
            <FormField label="Search by Customer Name / Phone">
              <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} suffix={searchName ? <CloseCircleOutlined style={{ color: "#9ca3af", cursor: "pointer" }} onClick={() => setSearchName("")} /> : <SearchOutlined style={{ color: "#9ca3af" }} />} placeholder="Name or phone…" value={searchName} onChange={e => setSearchName(e.target.value)} style={{ borderRadius: 8 }} allowClear />
            </FormField>
            <FormField label="Search by Job Number">
              <Input prefix={<TagOutlined style={{ color: "#9ca3af" }} />} suffix={searchJobNo ? <CloseCircleOutlined style={{ color: "#9ca3af", cursor: "pointer" }} onClick={() => setSearchJobNo("")} /> : <SearchOutlined style={{ color: "#9ca3af" }} />} placeholder="e.g. JB-2024-001" value={searchJobNo} onChange={e => setSearchJobNo(e.target.value)} style={{ borderRadius: 8 }} allowClear />
            </FormField>
            <FormField label="Filter by Date (Order / Delivery)">
              <DatePicker value={searchDate} onChange={d => setSearchDate(d)} format="DD MMM YYYY" style={{ width: "100%", borderRadius: 8 }} placeholder="Pick a date" allowClear />
            </FormField>
            <FormField label="Filter by Status">
              <Select placeholder="All statuses" allowClear value={statusFilter} onChange={v => setStatusFilter(v || null)} style={{ width: "100%" }}>
                {Object.entries(STATUS_CONFIG).map(([k, { label, color }]) =>
                  <Option key={k} value={k}><Tag color={color} style={{ fontWeight: 500 }}>{label}</Tag></Option>
                )}
              </Select>
            </FormField>
          </div>

          {hasActiveFilters && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Active filters:</span>
              {searchName   && <Tag closable onClose={() => setSearchName("")}   color="blue"   style={{ fontSize: 11 }}>Name: "{searchName}"</Tag>}
              {searchJobNo  && <Tag closable onClose={() => setSearchJobNo("")}  color="purple" style={{ fontSize: 11 }}>Job No: "{searchJobNo}"</Tag>}
              {searchDate   && <Tag closable onClose={() => setSearchDate(null)} color="orange" style={{ fontSize: 11 }}>Date: {searchDate.format("DD MMM YYYY")}</Tag>}
              {statusFilter && <Tag closable onClose={() => setStatusFilter(null)} color={STATUS_CONFIG[statusFilter]?.color || "default"} style={{ fontSize: 11 }}>Status: {STATUS_CONFIG[statusFilter]?.label}</Tag>}
              <Button size="small" type="link" onClick={clearAllFilters} style={{ padding: "0 4px", fontSize: 11, color: "#6b7280" }}>Clear all</Button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Legend:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "linear-gradient(135deg,#d1fae5,#a7f3d0)", border: "1px solid #6ee7b7" }} /><span style={{ fontSize: 11, color: "#374151" }}>Completed & Paid</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "linear-gradient(135deg,#fee2e2,#fca5a5)", border: "1px solid #fca5a5" }} /><span style={{ fontSize: 11, color: "#374151" }}>Completed (payment pending)</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "#ffffff", border: "1px solid #e5e7eb" }} /><span style={{ fontSize: 11, color: "#374151" }}>Active / In Progress</span></div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding: "0 0 8px 0" }} style={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <CustomTable
          dataSource={paginatedJobs}
          loading={loading}
          columns={columns}
          scroll={{ x: isMobile ? 360 : 880 }}
          rowKey={r => r._id || r.job_no}
          size="small"
          rowClassName={record => {
            if (isFullyCompletedAndPaid(record)) return "row-completed-paid";
            if (record.job_status === "completed") return "row-completed-unpaid";
            if (isSiteVisitJob(record)) return "site-visit-row";
            return "";
          }}
          pagination={{
            current: page, pageSize, total: filteredJobs.length,
            showSizeChanger: !isMobile, pageSizeOptions: ["10", "25", "50"],
            showTotal: isMobile ? undefined : (t, r) => `${r[0]}-${r[1]} of ${t}`,
            onChange: (pg, ps) => { setPage(pg); setPageSize(ps); },
            style: { padding: "8px 12px" }, size: isMobile ? "small" : "default"
          }}
        />
      </Card>

      {/* ══ VIEW MODAL ══ */}
      <Modal open={viewModal} onCancel={() => { setViewModal(false); setViewJob(null); }}
        footer={<Button onClick={() => { setViewModal(false); setViewJob(null); }} style={{ borderRadius: 8 }}>Close</Button>}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EyeOutlined style={{ color: "#6b7280" }} />
            <span style={{ fontWeight: 700 }}>View Job</span>
            {viewJob && <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>{viewJob.job_no}</Tag>}
            {viewJob && isSiteVisitJob(viewJob) && <SiteVisitBadge />}
            {viewJob?.estimated_delivery_date && <OverdueBadge estimated_delivery_date={viewJob.estimated_delivery_date} jobStatus={viewJob.job_status} />}
            {viewJob?.next_due_date && parseFloat(viewJob.balance_amount || 0) > 0 && <PaymentDueBadge next_due_date={viewJob.next_due_date} balance_amount={viewJob.balance_amount} />}
            {viewJob && isFullyCompletedAndPaid(viewJob) && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46" }}>
                <CheckCircleOutlined style={{ fontSize: 10 }} /> Completed & Paid
              </span>
            )}
          </div>
        }
        width={isMobile ? "100vw" : "min(96vw,760px)"} style={mobileStyle} styles={{ body: modalBody }} destroyOnClose>
        {viewJob && (() => {
          const cfg = STATUS_CONFIG[viewJob.job_status] || STATUS_CONFIG.draft;
          const addr = viewJob.delivery_address || {};
          const totals = calcJobTotals(viewJob);
          const overdueInfo = getOverdueInfo(viewJob.estimated_delivery_date);
          const isFromSV = isSiteVisitJob(viewJob);
          const fullAddress = [addr.street, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(", ");
          const stageCfg = viewJob.current_stage;
          const completedAndPaid = isFullyCompletedAndPaid(viewJob);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {completedAndPaid && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg,#d1fae5,#a7f3d0)", border: "2px solid #6ee7b7" }}>
                  <CheckCircleOutlined style={{ color: "#065f46", fontSize: 22, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>✓ Job Completed & Fully Paid</div>
                    <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>No balance remaining. This job is closed.</div>
                  </div>
                </div>
              )}
              {isFromSV && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe55 100%)", border: "2px solid #a78bfa", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "linear-gradient(180deg,#7c3aed,#a78bfa)" }} />
                  <CompassOutlined style={{ color: "#7c3aed", fontSize: 22, marginLeft: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#5b21b6", fontSize: 13 }}>Created from a Site Visit</div>
                    {viewJob.site_visit_no && <div style={{ marginTop: 4 }}><span style={{ fontSize: 12, color: "#7c3aed" }}>Visit No: <strong style={{ fontFamily: "monospace" }}>{viewJob.site_visit_no}</strong></span></div>}
                  </div>
                </div>
              )}
              {isFromSV && viewJob.site_visit_photos?.length > 0 && <SiteVisitPhotosPanel photos={viewJob.site_visit_photos} />}
              {!completedAndPaid && overdueInfo && (overdueInfo.isOverdue || overdueInfo.isDueToday) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: overdueInfo.bg, border: `1px solid ${overdueInfo.border}` }}>
                  <ExclamationCircleOutlined style={{ color: overdueInfo.color, fontSize: 16, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: overdueInfo.color, fontSize: 13 }}>{overdueInfo.isDueToday ? "⚡ Delivery due today!" : `⚠ ${overdueInfo.label}`}</div>
                    <div style={{ fontSize: 11, color: overdueInfo.color, opacity: 0.85 }}>Est. delivery was {dayjs(viewJob.estimated_delivery_date).format("DD MMM YYYY")}</div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 600, fontSize: 13, padding: "3px 10px" }}>{cfg.label}</Tag>
                  {stageCfg?.stage && <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>{WORKFLOW_STAGES.find(s => s.value === stageCfg.stage)?.label || stageCfg.stage_label}</Tag>}
                </div>
                {viewJob.order_date && <span style={{ fontSize: 12, color: "#6b7280" }}>Ordered: {dayjs(viewJob.order_date).format("DD MMM YYYY, HH:mm")}</span>}
              </div>
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
  <SectionHeader icon={<UserOutlined />} title="Customer Info" />
  <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10 }}>
    <InfoRow label="Name"          value={viewJob.customer_name} />
    <InfoRow label="Created By"    value={viewJob.created_by || "—"} />
    <InfoRow label="Phone"         value={viewJob.customer_phone} />
    {viewJob.company_name && <InfoRow label="Company" value={viewJob.company_name} />}
    <InfoRow label="Est. Delivery" value={viewJob.estimated_delivery_date ? dayjs(viewJob.estimated_delivery_date).format("DD MMM YYYY, HH:mm") : "—"} />
    <InfoRow label="GST Number"    value={viewJob.gst_no || "—"} />
    <InfoRow label="Created Date"  value={viewJob.createdAt ? dayjs(viewJob.createdAt).format("DD MMM YYYY, HH:mm") : "—"} />
  </div>
</div>
              {stageCfg?.assigned_to?.name && (
                <div style={{ background: "#eff6ff", borderRadius: 10, padding: "10px 14px", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 10 }}>
                  <UserOutlined style={{ color: "#2563eb", fontSize: 16 }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Assigned Designer</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e3a8a" }}>{stageCfg.assigned_to.name} <span style={{ fontSize: 11, fontWeight: 400, color: "#3b82f6" }}>{stageCfg.assigned_to.role}</span></div>
                    {stageCfg.since && <div style={{ fontSize: 11, color: "#6b7280" }}>Since {dayjs(stageCfg.since).format("DD MMM YYYY, HH:mm")}</div>}
                  </div>
                </div>
              )}
              {fullAddress && (
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                  <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{fullAddress}</div>
                </div>
              )}
              <div>
                <SectionHeader icon={<ShoppingCartOutlined />} title={`Job Items (${(viewJob.cart_items || []).length})`} />
                <ViewCartItems cartItems={viewJob.cart_items} isMobile={isMobile} />
              </div>
              <div style={{ background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? 12 : "14px 16px" }}>
                <div style={{ fontWeight: 700, color: "#1e40af", marginBottom: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><WalletOutlined /> Order Summary</div>
                <SummaryRow label="Subtotal (base)"   value={`₹${totals.subtotal.toFixed(2)}`} />
                {totals.discountAmt > 0 && <SummaryRow label="Discount" value={`− ₹${totals.discountAmt.toFixed(2)}`} color="#059669" />}
                <SummaryRow label="Total GST"         value={`₹${totals.taxAmount.toFixed(2)}`} color="#d97706" />
                {totals.designCharges > 0 && <SummaryRow label="Design Charges" value={`₹${totals.designCharges.toFixed(2)}`} color="#7c3aed" />}
                <SummaryRow label="Delivery"          value={totals.freeDelivery ? "Free" : `₹${totals.deliveryCharges.toFixed(2)}`} color={totals.freeDelivery ? "#059669" : undefined} />
                <Divider style={{ margin: "10px 0" }} />
                <SummaryRow label="Grand Total"       value={`₹${totals.grandTotal.toFixed(2)}`} bold />
              </div>
              <PaymentInfoPanel job={viewJob} onCollectPayment={() => openCollectPaymentModal(viewJob)} />
              {viewJob.notes && (
                <div style={{ fontSize: 13, color: "#374151", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                  {viewJob.notes}
                </div>
              )}
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

      {/* ══ EDIT MODAL ══ */}
      <Modal open={editModal} onCancel={resetEditModal} footer={null}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EditOutlined style={{ color: "#2563eb" }} />
            <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>Edit Job</span>
            {editJob && <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>{editJob.job_no}</Tag>}
            {editJob && isSiteVisitJob(editJob) && <SiteVisitBadge />}
          </div>
        }
        width={modalWidth} style={mobileStyle}
        styles={{ body: modalBody, header: { padding: `${isMobile ? 10 : 14}px ${isMobile ? 12 : 16}px`, borderBottom: "1px solid #f0f0f0" } }}
        destroyOnClose>
        <Spin spinning={editLoading}>
          {editJob && isSiteVisitJob(editJob) && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg,#f5f3ff,#ede9fe44)", border: "2px solid #a78bfa", display: "flex", gap: 12, alignItems: "flex-start", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "linear-gradient(180deg,#7c3aed,#a78bfa)" }} />
              <CompassOutlined style={{ color: "#7c3aed", fontSize: 18, marginLeft: 6, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#5b21b6", fontSize: 13, marginBottom: 4 }}>Site Visit Job — fill in all details</div>
                {editJob.site_visit_no && <span style={{ fontSize: 11, color: "#6d28d9", background: "#ede9fe", padding: "2px 8px", borderRadius: 10 }}><CompassOutlined style={{ marginRight: 4 }} />{editJob.site_visit_no}</span>}
                {editJob.site_visit_photos?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", marginBottom: 6 }}>Site Visit Photos — Reference for sizing</div>
                    <Image.PreviewGroup>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {editJob.site_visit_photos.map((photo, i) => (
                          <Image key={photo._id || i} src={photo.url} alt={photo.caption || `Photo ${i + 1}`} style={{ height: 64, width: 64, objectFit: "cover", borderRadius: 6, border: "2px solid #c4b5fd", cursor: "pointer" }} preview={{ mask: <EyeOutlined style={{ fontSize: 12 }} /> }} />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  </div>
                )}
              </div>
            </div>
          )}

          {editError && (
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>⚠ {editError}</div>
          )}

          {/* Customer Info */}
          <SectionHeader icon={<UserOutlined />} title="Customer Info" />
          <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: g }}>
            <FormField label="Customer Name" required>
              <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="Full name" value={editForm.customer_name}
                onChange={e => handleEditInput("customer_name", e.target.value.replace(/^\w/, c => c.toUpperCase()))}
                style={{ borderRadius: 8 }} />
            </FormField>
            <FormField label="Phone" required>
              <Input prefix={<PhoneOutlined style={{ color: "#9ca3af" }} />} placeholder="10-digit mobile" value={editForm.customer_phone} maxLength={10} onChange={e => handleEditInput("customer_phone", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
            <FormField label="Est. Delivery Date" required>
              <Input type="datetime-local" value={editForm.estimated_delivery_date} onChange={e => handleEditInput("estimated_delivery_date", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
            <FormField label="Company Name">
              <Input prefix={<BankOutlined style={{ color: "#9ca3af" }} />} placeholder="Company / Business name" value={editForm.company_name} onChange={e => handleEditInput("company_name", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
            <FormField label="GST Number">
              <Input placeholder="GSTIN (15 chars)" maxLength={15} value={editForm.gst_no} onChange={e => handleEditInput("gst_no", e.target.value.toUpperCase())} style={{ borderRadius: 8 }} />
            </FormField>
          </div>

          {/* Delivery Address */}
          <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
          <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: c2, gap: g }}>
              <FormField label="Address Line 1"><Input placeholder="Flat / Door No, Building" value={editForm.address_line1} onChange={e => handleEditInput("address_line1", e.target.value)} style={{ borderRadius: 8 }} /></FormField>
              <FormField label="Address Line 2"><Input placeholder="Street, Area, Landmark" value={editForm.address_line2} onChange={e => handleEditInput("address_line2", e.target.value)} style={{ borderRadius: 8 }} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: c4, gap: g }}>
              {[["city", "City", "City"], ["state", "State", "State"], ["pincode", "Pincode", "6-digit"], ["country", "Country", "Country"]].map(([k, label, ph]) => (
                <FormField key={k} label={label}><Input placeholder={ph} value={editForm[k]} onChange={e => handleEditInput(k, e.target.value)} style={{ borderRadius: 8 }} /></FormField>
              ))}
            </div>
          </div>

          {/* Job Items */}
          <SectionHeader icon={<ShoppingCartOutlined />} title="Job Items" />
          <JobItemsSection
            productItems={editProductItems} officeItems={editOfficeItems} labourItems={editLabourItems}
            onProductChange={(i, u) => setEditProductItems(p => p.map((it, j) => j === i ? u : it))}
            onOfficeChange={(i, u) => setEditOfficeItems(p => p.map((it, j) => j === i ? u : it))}
            onLabourChange={(i, u) => setEditLabourItems(p => p.map((it, j) => j === i ? u : it))}
            onAddProduct={() => setEditProductItems(p => [...p, { ...EMPTY_PRODUCT_ITEM }])}
            onAddOffice={() => setEditOfficeItems(p => [...p, { ...EMPTY_OFFICE_ITEM }])}
            onAddLabour={() => setEditLabourItems(p => [...p, { ...EMPTY_LABOUR_ITEM }])}
            onRemoveProduct={i => setEditProductItems(p => p.filter((_, j) => j !== i))}
            onRemoveOffice={i => setEditOfficeItems(p => p.filter((_, j) => j !== i))}
            onRemoveLabour={i => setEditLabourItems(p => p.filter((_, j) => j !== i))}
            isMobile={isMobile} isTablet={isTablet}
          />

          {/* Pricing & Tax */}
          <SectionHeader icon={<TagOutlined />} title="Pricing & Tax" />
          <div style={{ display: "grid", gridTemplateColumns: c5, gap: g, marginBottom: 14 }}>
            <FormField label="Discount (₹)">
              <InputNumber min={0} value={editForm.discount_amount} style={{ width: "100%", borderRadius: 8 }} prefix="₹" onChange={v => handleEditInput("discount_amount", v || 0)} />
            </FormField>
            <FormField label="Delivery Charges (₹)">
              <InputNumber min={0} value={editForm.free_delivery ? 0 : editForm.delivery_charges} disabled={editForm.free_delivery} style={{ width: "100%", borderRadius: 8 }} prefix="₹" onChange={v => handleEditInput("delivery_charges", v || 0)} />
            </FormField>
            <FormField label="Design Charges (₹)">
              <InputNumber min={0} value={editForm.design_charges} style={{ width: "100%", borderRadius: 8 }} prefix="₹" onChange={v => handleEditInput("design_charges", v || 0)} />
            </FormField>
            <FormField label="Free Delivery">
              <div onClick={() => handleEditInput("free_delivery", !editForm.free_delivery)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: editForm.free_delivery ? "#f0fdf4" : "#f9fafb", border: `1px solid ${editForm.free_delivery ? "#86efac" : "#e5e7eb"}`, borderRadius: 8, padding: "6px 12px", userSelect: "none" }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: editForm.free_delivery ? "#22c55e" : "#d1d5db", position: "relative" }}>
                  <div style={{ position: "absolute", top: 2, left: editForm.free_delivery ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: editForm.free_delivery ? "#16a34a" : "#6b7280" }}>{editForm.free_delivery ? "Free" : "Paid"}</span>
              </div>
            </FormField>
          </div>

          {/* Payment Info (read-only, collect separately) */}
          <SectionHeader icon={<WalletOutlined />} title="Payment" />
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <InfoRow label="Paid So Far"     value={`₹${parseFloat(editJob?.payment_amount || 0).toFixed(2)}`} valueStyle={{ color: "#16a34a" }} />
              <InfoRow label="Current Balance" value={`₹${parseFloat(editJob?.balance_amount || 0).toFixed(2)}`} valueStyle={{ color: parseFloat(editJob?.balance_amount || 0) > 0 ? "#dc2626" : "#16a34a" }} />
              {editJob?.next_due_date && parseFloat(editJob?.balance_amount || 0) > 0 && <InfoRow label="Next Due" value={dayjs(editJob.next_due_date).format("DD MMM YYYY")} />}
            </div>
            <Button icon={<WalletOutlined />} onClick={() => openCollectPaymentModal(editJob)} disabled={!(parseFloat(editJob?.balance_amount || 0) > 0)} style={{ borderRadius: 8, color: "#d97706", borderColor: "#fde68a" }}>Collect Payment</Button>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>Payments are recorded separately and won't be affected by item/price changes here — the balance will recalculate after you save.</div>

          {/* Notes */}
          <SectionHeader icon={<FileTextOutlined />} title="Notes" />
          <div style={{ marginBottom: 14 }}>
            <FormField label="Notes">
              <TextArea rows={3} placeholder="Additional notes…" value={editForm.notes} onChange={e => handleEditInput("notes", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
          </div>

          {/* ── Order Summary with Round-Half-Up ── */}
          <div style={{ background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? 12 : "14px 16px", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "#1e40af", marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><FileTextOutlined /> Order Summary</div>

            <SummaryRow label="Subtotal (items base)" value={`₹${editTotals.subtotal.toFixed(2)}`} />
            {editTotals.discountAmt > 0 && <SummaryRow label="Discount" value={`− ₹${editTotals.discountAmt.toFixed(2)}`} color="#059669" />}
            <SummaryRow label="Total GST"             value={`₹${editTotals.taxAmount.toFixed(2)}`} color="#d97706" />
            {editTotals.designCharges > 0 && <SummaryRow label="Design Charges" value={`₹${editTotals.designCharges.toFixed(2)}`} color="#7c3aed" />}
            <SummaryRow label="Delivery"              value={editForm.free_delivery ? "Free" : `₹${editTotals.deliveryCharges.toFixed(2)}`} color={editForm.free_delivery ? "#059669" : undefined} />

            <Divider style={{ margin: "8px 0" }} />

            {/* Rounding rows — only shown when rounding applies */}
            {hasRounding && (
              <SummaryRow
                label="Exact Total (before rounding)"
                value={`₹${editTotals.grandTotalExact.toFixed(2)}`}
                color="#9ca3af" small />
            )}
            {hasRounding && (
              <SummaryRow
                label={editTotals.roundingAdj > 0 ? "Rounding (+)" : "Rounding (−)"}
                value={`${editTotals.roundingAdj > 0 ? "+" : ""}₹${editTotals.roundingAdj.toFixed(2)}`}
                color="#9ca3af" small />
            )}

            {/* Golden Grand Total row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "10px 14px", background: "#FFFBEA", border: "1.5px solid #F2C41A", borderRadius: 6 }}>
              <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: "#1A1200" }}>
                Grand Total
                {hasRounding && <span style={{ fontSize: 10, fontWeight: 500, color: "#C9A00E", marginLeft: 6 }}>(rounded)</span>}
              </span>
              <span style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, color: "#1A1200", letterSpacing: "-0.02em" }}>
                ₹{editTotals.grandTotal}
              </span>
            </div>

            {/* Already paid & projected balance */}
            {parseFloat(editJob?.payment_amount || 0) > 0 && (
              <>
                <div style={{ height: 6 }} />
                <SummaryRow label="Already Paid" value={`− ₹${parseFloat(editJob.payment_amount || 0).toFixed(2)}`} color="#059669" />
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                  <span style={{ color: "#1a1a2e" }}>Balance Due (after save)</span>
                  <span style={{ color: projectedBalanceAfterSave <= 0 ? "#059669" : "#dc2626", background: projectedBalanceAfterSave <= 0 ? "#f0fdf4" : "#fef2f2", padding: "2px 10px", borderRadius: 6 }}>
                    {projectedBalanceAfterSave <= 0
                      ? `✓ Paid${Math.abs(projectedBalanceAfterSave) > 0.01 ? ` (Advance ₹${Math.abs(projectedBalanceAfterSave).toFixed(2)})` : ""}`
                      : `₹${projectedBalanceAfterSave.toFixed(2)}`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button onClick={resetEditModal} style={{ borderRadius: 8, height: 40, flex: isMobile ? 1 : undefined }}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleEditSubmit} loading={editLoading} style={{ background: "#2563eb", border: "none", borderRadius: 8, height: 40, fontWeight: 600, flex: isMobile ? 1 : undefined }}>Save Changes</Button>
          </div>
        </Spin>
      </Modal>

      {/* ══ APPROVE MODAL ══ */}
      <Modal
        title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircleOutlined style={{ color: "#16a34a" }} /><span style={{ fontWeight: 700 }}>Approve & Assign Job</span></div>}
        open={approveModalOpen}
        onCancel={() => { if (approving) return; setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); }}
        maskClosable={!approving} closable={!approving}
        footer={[
          <Button key="cancel" onClick={() => { if (approving) return; setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); }} disabled={approving}>Cancel</Button>,
          <Button key="submit" type="primary" loading={approving} disabled={!selectedDesigner || designersLoading} onClick={handleApproveWithDesigner} style={{ background: "#16a34a", borderColor: "#16a34a" }}>Approve & Assign</Button>,
        ]}
        width={isMobile ? "100vw" : 480} style={sheetStyle} styles={{ body: sheetBody }} destroyOnClose>
        {approvingJob && (
          <div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", fontSize: 14 }}>{approvingJob.job_no}</div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{approvingJob.customer_name || "—"}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{approvingJob.customer_phone || ""}</div>
              {isSiteVisitJob(approvingJob) && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <CompassOutlined style={{ color: "#7c3aed", fontSize: 11 }} />
                  <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Site Visit: {approvingJob.site_visit_no || approvingJob.site_visit_id}</span>
                </div>
              )}
              {(() => { const cfg = STATUS_CONFIG[approvingJob.job_status] || STATUS_CONFIG.draft; return <div style={{ marginTop: 6, fontSize: 11 }}>Status: <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag></div>; })()}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Assign Designer <span style={{ color: "#ef4444" }}>*</span></label>
              <Select placeholder={designersLoading ? "Loading designers…" : "Choose a designer"} style={{ width: "100%" }} value={selectedDesigner?._id || undefined} loading={designersLoading} disabled={designersLoading}
                onChange={id => { if (id === "customer_designed") setSelectedDesigner({ _id: "customer_designed", name: "Customer Designed", type: "external" }); else setSelectedDesigner(designers.find(d => d._id === id) || null); }}
                notFoundContent={designersLoading ? "Loading…" : "No designers found"}>
                <Option value="customer_designed">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <UserOutlined style={{ color: "#f59e0b", fontSize: 12 }} />
                    <span style={{ fontWeight: 600, color: "#d97706" }}>🎨 Designed By Customer</span>
                    <Tag color="orange" style={{ fontSize: 10, marginLeft: 4 }}>Customer Provided</Tag>
                  </div>
                </Option>
                {designers.length > 0 && <Option disabled value="divider"><Divider style={{ margin: 8 }} orientation="left" plain><span style={{ fontSize: 11, color: "#9ca3af" }}>Internal Designers</span></Divider></Option>}
                {designers.map(d => (
                  <Option key={d._id} value={d._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><UserOutlined style={{ color: "#6b7280", fontSize: 12 }} /><span>{d.name || d.fullName || d.username || d._id}</span></div>
                  </Option>
                ))}
              </Select>
              {selectedDesigner?._id === "customer_designed" && (
                <div style={{ marginTop: 8, color: "#d97706", fontSize: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <InfoCircleOutlined style={{ color: "#f59e0b" }} /><span>No internal designer assigned — customer-provided design.</span>
                </div>
              )}
              {!designersLoading && designers.length === 0 && selectedDesigner?._id !== "customer_designed" && (
                <div style={{ marginTop: 8, color: "#b45309", fontSize: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
                  No designers found. Add a user with role "designing team" first.
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", background: "#fefce8", padding: "8px 10px", borderRadius: 6, border: "1px solid #fef08a" }}>
              Job will be approved and assigned to the selected designer, moving to <strong>Design</strong> stage.
            </div>
          </div>
        )}
      </Modal>

      {/* ══ COLLECT PAYMENT MODAL ══ */}
      <Modal
        title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><WalletOutlined style={{ color: "#16a34a" }} /><span style={{ fontWeight: 700 }}>Collect Payment</span></div>}
        open={collectPaymentModal}
        onCancel={closeCollectPaymentModal}
        maskClosable={!collectingPayment} closable={!collectingPayment}
        footer={[
          <Button key="cancel" onClick={closeCollectPaymentModal} disabled={collectingPayment}>Cancel</Button>,
          <Button key="submit" type="primary" loading={collectingPayment} onClick={handleCollectPayment} style={{ background: "#16a34a", borderColor: "#16a34a" }}>Record Payment</Button>,
        ]}
        width={isMobile ? "100vw" : 460} style={sheetStyle} styles={{ body: sheetBody }} destroyOnClose>
        {payingJob && (() => {
          // Always use live_balance — reflects unsaved item edits when opened from edit modal
          const balance      = parseFloat(payingJob.live_balance ?? payingJob.balance_amount ?? 0);
          const discount     = parseFloat(paymentForm.discount_amount) || 0;
          const effectiveBal = Math.max(0, balance - discount);
          const amt          = parseFloat(paymentForm.amount) || 0;
          const remaining    = parseFloat((effectiveBal - amt).toFixed(2));

          return (
            <div>
              {/* Job Summary */}
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 16, border: "1px solid #e5e7eb" }}>
                <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb", fontSize: 14 }}>{payingJob.job_no}</div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{payingJob.customer_name || "—"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Total: <strong>₹{parseFloat(payingJob.total_amount || 0).toFixed(2)}</strong></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>Balance Due: ₹{balance.toFixed(2)}</span>
                </div>
                {/* Show note if live balance differs from DB balance */}
                {payingJob.live_balance !== undefined && Math.abs(payingJob.live_balance - parseFloat(payingJob.balance_amount || 0)) > 0.01 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px" }}>
                    ⚠ Balance reflects unsaved item changes. Save the job first to lock in this amount.
                  </div>
                )}
              </div>

              {collectPaymentError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 12 }}>⚠ {collectPaymentError}</div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Discount / Waiver */}
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <TagOutlined style={{ color: "#d97706" }} /> Discount / Waiver (Optional)
                  </div>
                  <FormField label="Discount Amount (₹)" hint="Amount to waive off from the balance before collecting payment">
                    <InputNumber
                      min={0} max={balance}
                      value={paymentForm.discount_amount}
                      style={{ width: "100%", borderRadius: 8, background: "#fffbeb" }}
                      prefix="₹" placeholder="0.00 — no discount"
                      onChange={v => setPaymentForm(p => ({ ...p, discount_amount: v || 0, amount: "" }))}
                    />
                  </FormField>
                  {discount > 0 && (
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: "#92400e" }}>Balance after discount:</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#d97706" }}>₹{effectiveBal.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <FormField label="Amount Received (₹)" required>
                  <InputNumber
                    min={0} max={effectiveBal}
                    value={paymentForm.amount}
                    style={{ width: "100%", borderRadius: 8 }}
                    prefix="₹"
                    onChange={v => setPaymentForm(p => ({ ...p, amount: v }))}
                    placeholder={`Max ₹${effectiveBal.toFixed(2)}`}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setPaymentForm(p => ({ ...p, amount: effectiveBal }))}
                      style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontWeight: 600 }}>
                      Full Balance{discount > 0 ? ` (₹${effectiveBal.toFixed(2)})` : ""}
                    </button>
                    <button onClick={() => setPaymentForm(p => ({ ...p, amount: parseFloat((effectiveBal / 2).toFixed(2)) }))}
                      style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                      50%
                    </button>
                  </div>
                </FormField>

                {/* Payment Mode */}
                <FormField label="Payment Mode">
                  <Select placeholder="Select payment mode" value={paymentForm.method || undefined} style={{ width: "100%" }} allowClear onChange={v => setPaymentForm(p => ({ ...p, method: v || "" }))}>
                    {PAYMENT_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
                  </Select>
                </FormField>

                {/* Next Due Date */}
                {remaining > 0 && amt > 0 && (
                  <FormField label="Next Due Date for Remaining Balance" hint={`₹${remaining.toFixed(2)} will still be due`}>
                    <DatePicker
                      value={paymentForm.next_due_date ? dayjs(paymentForm.next_due_date) : null}
                      onChange={d => setPaymentForm(p => ({ ...p, next_due_date: d }))}
                      format="DD MMM YYYY"
                      style={{ width: "100%", borderRadius: 8 }}
                      disabledDate={d => d && d.isBefore(dayjs().startOf("day"))}
                      placeholder="Pick a due date"
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {[["7 days", 7], ["15 days", 15], ["30 days", 30]].map(([label, days]) => (
                        <button key={days} onClick={() => setPaymentForm(p => ({ ...p, next_due_date: dayjs().add(days, "day") }))}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                          +{label}
                        </button>
                      ))}
                    </div>
                  </FormField>
                )}

                {/* Notes */}
                <FormField label="Notes">
                  <Input placeholder="Reference / cheque no / remarks…" value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} style={{ borderRadius: 8 }} />
                </FormField>
              </div>

              {/* Payment Summary Preview */}
              {(amt > 0 || discount > 0) && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: remaining <= 0 ? "#f0fdf4" : "#fffbeb", border: `1px solid ${remaining <= 0 ? "#86efac" : "#fde68a"}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>Payment Summary</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                      <span>Original balance:</span><span style={{ fontWeight: 600 }}>₹{balance.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#059669" }}>
                        <span>Discount applied:</span><span style={{ fontWeight: 600 }}>− ₹{discount.toFixed(2)}</span>
                      </div>
                    )}
                    {amt > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#2563eb" }}>
                        <span>Amount received:</span><span style={{ fontWeight: 600 }}>− ₹{amt.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                      <span style={{ color: "#1a1a2e" }}>Remaining balance:</span>
                      <span style={{ color: remaining <= 0 ? "#16a34a" : "#dc2626" }}>
                        {remaining <= 0 ? "✓ Fully Settled" : `₹${remaining.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .row-completed-paid > td { background: linear-gradient(90deg, #d1fae5, #ecfdf5) !important; }
        .row-completed-paid:hover > td { background: linear-gradient(90deg, #a7f3d0, #d1fae5) !important; }
        .row-completed-paid > td:first-child { border-left: 3px solid #22c55e !important; }
        .row-completed-unpaid > td { background: linear-gradient(90deg, #fee2e2, #fff5f5) !important; }
        .row-completed-unpaid:hover > td { background: linear-gradient(90deg, #fecaca, #fee2e2) !important; }
        .row-completed-unpaid > td:first-child { border-left: 3px solid #f87171 !important; }
        .site-visit-row > td { background: linear-gradient(90deg, #f5f3ff55, transparent) !important; }
        .site-visit-row:hover > td { background: linear-gradient(90deg, #ede9fe88, #f0f0ff44) !important; }
        .site-visit-row > td:first-child { border-left: 3px solid #a78bfa !important; }
      `}</style>
    </div>
  );
};

export default AdminJobManagement;