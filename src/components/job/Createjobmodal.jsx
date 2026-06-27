/**
 * CreateJobModal — UI UX Pro Max Edition
 *
 * Skill applied: ui-ux-pro-max-skill
 *   Typography : Minimal Swiss — Inter throughout (admin panel best practice)
 *   Colors     : SaaS blue #2563EB primary + custom golden #F2C41A accent for totals
 *   Style      : Conversion-Optimised Form — focus rings, loading states, inline feedback
 *   UX rules   : WCAG AA, clear error states, success feedback, loading spinner on submit
 *
 * Feature additions vs original:
 *   ✅ Round-half-up on grand total (808.20 → 808, 808.60 → 809)
 *   ✅ "Rounded" savings callout shown when rounding applies
 *   ✅ Rounding delta sent to backend as `rounding_adjustment`
 *   ✅ Sticky order summary sidebar on desktop
 *   ✅ Real-time balance indicator with colour-coded pill
 *   ✅ Section progress stepper header
 *   ✅ Improved pincode auto-fill UX with green pulse badge
 *   ✅ City suggestion dropdown with flag + "TN" badge
 *   ✅ Golden total row that stands out from the rest of the summary
 *   ✅ Free Delivery toggle styled as a real toggle switch
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  Button, Input, Modal, Select, Tag, Divider, Spin, InputNumber,
  Popconfirm, Radio, DatePicker, Tabs,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UserOutlined, PhoneOutlined,
  EnvironmentOutlined, FileTextOutlined, ShoppingCartOutlined,
  SaveOutlined, WalletOutlined, BankOutlined, UploadOutlined,
  CloseCircleOutlined, CameraOutlined, ToolOutlined, AppstoreOutlined,
  LoadingOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { SUCCESS_NOTIFICATION } from "../../helper/notification_helper";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

// ─── Google Font (Inter — Minimal Swiss for admin panels) ─────────────────────
const injectFont = () => {
  if (document.getElementById("cjm-inter-font")) return;
  const link = document.createElement("link");
  link.id   = "cjm-inter-font";
  link.rel  = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap";
  document.head.appendChild(link);
};

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  primary:     "#2563EB",
  primaryDk:   "#1D4ED8",
  primaryLt:   "#EFF6FF",
  onPrimary:   "#FFFFFF",
  golden:      "#F2C41A",
  goldenDk:    "#C9A00E",
  goldenLt:    "#FFFBEA",
  onGolden:    "#1A1200",
  success:     "#059669",
  successLt:   "#ECFDF5",
  warning:     "#D97706",
  warningLt:   "#FFFBEB",
  danger:      "#DC2626",
  dangerLt:    "#FEF2F2",
  bg:          "#F8FAFC",
  card:        "#FFFFFF",
  fg:          "#1E293B",
  muted:       "#E9EFF8",
  mutedFg:     "#64748B",
  border:      "#E2E8F0",
  borderFocus: "#2563EB",
  radius:      "6px",
  radiusLg:    "10px",
  font:        "'Inter', system-ui, sans-serif",
};

// ─── Round half-up helper ──────────────────────────────────────────────────────
// 808.20 → 808 | 808.60 → 809 | 808.50 → 809
const roundHalfUp = (n) => Math.floor(n + 0.5);

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
  return { isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md" };
};

// ─── Static Data ──────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    product_id: "P001", product_name: "flex",
    printing_type: ["Solvent", "Latex", "UV"],
    variations: [
      "Normal Flex", "Flex BB -230gsm", "Flex BB -280gsm", "Flex BB -240gsm",
      "Flex Star Backlight", "Flex Backlight", "Flex BB Star",
    ],
  },
];

const UNIT_OPTIONS   = [{ value: "ft", label: "ft" }, { value: "inch", label: "inch" }, { value: "cm", label: "cm" }];
const QTY_TYPE_OPTIONS = [{ value: "sq.ft", label: "Sq. Ft" }, { value: "quantity", label: "Quantity" }];
const GST_OPTIONS    = [0, 5, 12, 18, 28];
const PAYMENT_MODES  = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Cash on Delivery"];
const OFFICE_WORK_TYPES = [
  { value: "website",     label: "Website",     icon: "🌐", calc: "days"   },
  { value: "design",      label: "Design",      icon: "🎨", calc: "hours"  },
  { value: "social_media",label: "Social Media",icon: "📱", calc: "counts" },
  { value: "photo_shoot", label: "Photo Shoot", icon: "📷", calc: "hours"  },
];

const TN_CITIES = [
  "Ambur","Anaimalai","Ariyalur","Attur","Batlagundu","Bhavani","Chengalpattu",
  "Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode",
  "Gobichettipalayam","Gudiyatham","Hosur","Kallakurichi","Kanchipuram",
  "Karaikkudi","Karur","Krishnagiri","Kumbakonam","Kumarapalayam","Madurai",
  "Mayiladuthurai","Mettupalayam","Nagapattinam","Nagercoil","Namakkal","Neyveli",
  "Ooty","Palani","Paramakudi","Perambalur","Pollachi","Pudukkottai","Rajapalayam",
  "Ramanathapuram","Ranipet","Salem","Sankarankovil","Sattur","Sivaganga","Sivakasi",
  "Srivilliputhur","Thanjavur","Thoothukkudi","Tiruchirappalli","Tirunelveli",
  "Tirupathur","Tiruppur","Tiruvannamalai","Tiruvarur","Tenkasi","Udhagamandalam",
  "Vaniyambadi","Vellore","Viluppuram","Virudhunagar",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fetchPincodeData = async (pincode) => {
  if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return null;
  try {
    const res  = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { city: po.District || po.Name || "", district: po.District || "", state: po.State || "" };
    }
  } catch {}
  return null;
};

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
  if (item.office_type === "website")      qty = item.days || 0;
  else if (item.office_type === "design")  qty = item.hours || 0;
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

// ─── Image compressor ──────────────────────────────────────────────────────────
const compressImageFile = (file, maxKB = 500) =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size <= maxKB * 1024) { resolve(file); return; }
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.onload  = () => {
      URL.revokeObjectURL(blobUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = (maxKB * 1024) / file.size;
      if (ratio < 0.9) { const s = Math.sqrt(ratio); w = Math.max(1,Math.round(w*s)); h = Math.max(1,Math.round(h*s)); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const outType = file.type === "image/png" ? "image/jpeg" : file.type;
      const tryQ = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxKB * 1024 || q <= 0.1)
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: blob.type, lastModified: Date.now() }));
          else tryQ(parseFloat((q - 0.05).toFixed(2)));
        }, outType, q);
      };
      tryQ(0.85);
    };
    img.src = blobUrl;
  });

// ─── Design File Upload ────────────────────────────────────────────────────────
const DesignFileUpload = ({ value, setImagePath }) => {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [origSize, setOrigSize]  = useState(null);
  const [compSize, setCompSize]  = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const uploadToCloud = async (f) => {
    const fd = new FormData(); fd.append("image", f);
    const res  = await fetch("https://api.dmedia.in/api/upload_images", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");
    return data.data.url;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(""); setOrigSize((file.size / 1024).toFixed(0)); setBusy(true);
    try {
      const compressed = await compressImageFile(file, 500);
      setCompSize((compressed.size / 1024).toFixed(0));
      setPreviewUrl(URL.createObjectURL(compressed));
      const url = await uploadToCloud(compressed);
      setImagePath(url); setBusy(false);
    } catch (err) { setError(err.message || "Upload failed, try again."); setBusy(false); }
  };

  const handleClear = () => {
    setImagePath(""); setOrigSize(null); setCompSize(null); setError(""); setPreviewUrl("");
    if (fileInputRef.current)   fileInputRef.current.value   = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const fmt = (kb) => kb >= 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`;

  return (
    <div>
      <input ref={fileInputRef}   type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"  style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Button size="small" icon={<UploadOutlined />} loading={busy}
          onClick={() => fileInputRef.current?.click()}
          style={{ borderRadius: T.radius, fontSize: 12, borderColor: T.primary, color: T.primary }}>
          {busy ? "Uploading…" : value ? "Change File" : "Upload Design"}
        </Button>
        {!busy && (
          <Button size="small" icon={<CameraOutlined />}
            onClick={() => cameraInputRef.current?.click()}
            style={{ borderRadius: T.radius, fontSize: 12 }}>
            Camera
          </Button>
        )}
        {value && !busy && (
          <Button size="small" danger type="text" icon={<CloseCircleOutlined />}
            onClick={handleClear} style={{ fontSize: 12 }}>
            Remove
          </Button>
        )}
      </div>
      {!busy && origSize && compSize && (
        <div style={{ marginTop: 4, fontSize: 10, color: T.success, fontWeight: 600 }}>
          ✅ {fmt(origSize)} → {fmt(compSize)}{compSize <= 500 ? " ✓" : " ⚠ Still large"}
        </div>
      )}
      {busy && <div style={{ marginTop: 4, fontSize: 10, color: T.primary, fontWeight: 600 }}>⏳ Compressing & uploading…</div>}
      {error && <div style={{ marginTop: 4, fontSize: 10, color: T.danger }}>⚠ {error}</div>}
      {previewUrl && !busy && (
        <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bg, padding: 4, display: "flex", justifyContent: "center", maxHeight: 120, overflow: "hidden" }}>
          <img src={previewUrl} alt="Preview" style={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
      )}
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_PRODUCT_ITEM = {
  item_category: "product", product_id: "", product_name: "", variation: "",
  printing_type: "", width: "", height: "", size_unit: "inch", sq_ft: 0,
  sq_ft_manual: false, quantity_type: "sq.ft", quantity: 1, price: 0,
  gst_percentage: 0, design_file: "", notes: "",
};
const EMPTY_OFFICE_ITEM = {
  item_category: "service_office", service_name: "", office_type: "website",
  days: 1, hours: 1, reels_count: 0, post_count: 0, price: 0, gst_percentage: 0, notes: "",
};
const EMPTY_LABOUR_ITEM = {
  item_category: "service_labour", service_name: "", sq_ft: 0, hours: 0,
  price_per_sqft: 0, price_per_hour: 0, gst_percentage: 0, notes: "",
};
const DEFAULT_FORM = {
  customer_name: "", customer_phone: "", company_name: "",
  estimated_delivery_date: null, address_line1: "", address_line2: "",
  city: "", district: "", state: "", pincode: "", country: "India",
  gst_no: "", delivery_charges: 0, free_delivery: false,
  discount_percentage: 0, payment_mode: "", payment_amount: "",
  next_due_date: null, notes: "", terms_and_conditions: "",
};

// ─── Reusable atoms ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, count }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <span style={{ color: T.primary, fontSize: 14, flexShrink: 0 }}>{icon}</span>
    <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.fg, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
    {count !== undefined && (
      <span style={{ background: T.primary, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20, fontFamily: T.font }}>{count}</span>
    )}
    <div style={{ flex: 1, height: "1.5px", background: T.border, marginLeft: 4 }} />
  </div>
);

const FormField = ({ label, required, children, hint }) => (
  <div>
    <label style={{ display: "block", fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.mutedFg, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {label}{required && <span style={{ color: T.danger, marginLeft: 2 }}>*</span>}
    </label>
    {children}
    {hint && <p style={{ margin: "4px 0 0", fontFamily: T.font, fontSize: 10, color: T.mutedFg }}>{hint}</p>}
  </div>
);

// Compact info badge used in the order banner
const InfoBadge = ({ label, value, color, sub }) => (
  <div style={{ flex: 1, minWidth: 80 }}>
    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: color || T.fg }}>{value}</div>
    {sub && <div style={{ fontFamily: T.font, fontSize: 9, color: T.mutedFg }}>{sub}</div>}
  </div>
);

// Row summary line in order summary
const SummaryRow = ({ label, value, color, bold, small, highlight }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: highlight ? "6px 10px" : "2px 0",
    background: highlight ? T.goldenLt : "transparent",
    borderRadius: highlight ? T.radius : 0,
    marginBottom: highlight ? 4 : 3,
  }}>
    <span style={{ fontFamily: T.font, fontSize: small ? 10 : 12, color: color || T.mutedFg, fontWeight: bold ? 600 : 400 }}>{label}</span>
    <span style={{ fontFamily: T.font, fontSize: small ? 10 : 12, color: color || T.fg, fontWeight: bold ? 700 : 500 }}>{value}</span>
  </div>
);

// ─── Product Item Row ─────────────────────────────────────────────────────────
const ProductItemRow = ({ item, idx, onChange, onRemove, isOnly }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);

  const matched  = item.product_name ? PRODUCTS.filter((p) => p.product_name.toLowerCase().includes(item.product_name.toLowerCase())) : [];
  const selected = PRODUCTS.find((p) => p.product_name.toLowerCase() === (item.product_name || "").toLowerCase());

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

  const handleQtyTypeChange = (val) => {
    onChange(idx, { ...item, quantity_type: val, ...(val === "quantity" ? { sq_ft: 0, sq_ft_manual: false, width: "", height: "" } : {}) });
  };

  const isSqFtMode = item.quantity_type === "sq.ft";
  const { base, gstAmt, total: lineTotal } = computeProductLineTotal(item);
  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sqFtCols   = isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr";
  const priceCols  = isMobile ? "1fr 1fr" : "repeat(3,1fr)";

  return (
    <div style={{ background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, padding: isMobile ? 10 : 14 }}>
      {/* Row header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.primary, background: T.primaryLt, padding: "2px 10px", borderRadius: 20 }}>
            Item {idx + 1}
          </span>
          <Radio.Group size="small" value={item.quantity_type} onChange={(e) => handleQtyTypeChange(e.target.value)} buttonStyle="solid">
            {QTY_TYPE_OPTIONS.map((o) => (
              <Radio.Button key={o.value} value={o.value}
                style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, height: 24, lineHeight: "22px", padding: "0 10px" }}>
                {o.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <Popconfirm title="Remove this item?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: productCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Product Name" required>
          <div style={{ position: "relative" }} ref={ref}>
            <Input placeholder="Type product…" value={item.product_name} size="small" autoComplete="off"
              style={{ borderRadius: T.radius, fontFamily: T.font }}
              onChange={(e) => { onChange(idx, { ...item, product_name: e.target.value, variation: "", printing_type: "" }); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)} />
            {showSuggest && matched.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {matched.map((p) => (
                  <div key={p.product_id}
                    onMouseDown={() => { onChange(idx, { ...item, product_name: p.product_name, product_id: p.product_id, variation: "", printing_type: "" }); setShowSuggest(false); }}
                    style={{ padding: "9px 12px", cursor: "pointer", fontFamily: T.font, fontSize: 13, color: T.fg, fontWeight: 600, borderBottom: `1px solid ${T.muted}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.primaryLt)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = T.card)}>
                    🖨️ {p.product_name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: T.mutedFg, fontWeight: 400 }}>{p.printing_type?.join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>
        <FormField label="Material">
          <Select placeholder={selected ? "Select variation" : "—"} value={item.variation || undefined} size="small"
            style={{ width: "100%", fontFamily: T.font }} disabled={!selected} onChange={(v) => set("variation", v)}>
            {(selected?.variations || []).map((v) => <Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>
        <FormField label="Printing Type">
          <Select placeholder={selected ? "Select type" : "—"} value={item.printing_type || undefined} size="small"
            style={{ width: "100%", fontFamily: T.font }} disabled={!selected} onChange={(v) => set("printing_type", v)}>
            {(selected?.printing_type || []).map((t) => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>

      {isSqFtMode && (
        <div style={{ display: "grid", gridTemplateColumns: sqFtCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
          <FormField label="Width" required>
            <Input size="small" placeholder="0" type="number" min={0} value={item.width}
              prefix={<span style={{ fontSize: 10, color: T.mutedFg, fontWeight: 700 }}>W</span>}
              style={{ borderRadius: T.radius, fontFamily: T.font }}
              onChange={(e) => sizeChange("width", e.target.value)} />
          </FormField>
          <FormField label="Height" required>
            <Input size="small" placeholder="0" type="number" min={0} value={item.height}
              prefix={<span style={{ fontSize: 10, color: T.mutedFg, fontWeight: 700 }}>H</span>}
              style={{ borderRadius: T.radius, fontFamily: T.font }}
              onChange={(e) => sizeChange("height", e.target.value)} />
          </FormField>
          <FormField label="Unit">
            <Select value={item.size_unit} size="small" style={{ width: "100%" }} onChange={(v) => sizeChange("size_unit", v)}>
              {UNIT_OPTIONS.map((u) => <Option key={u.value} value={u.value}>{u.label}</Option>)}
            </Select>
          </FormField>
          <FormField label={
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Sq. Ft
              {item.sq_ft_manual && (item.width || item.height) && (
                <span onClick={() => { const sq = toSqFt(item.width, item.height, item.size_unit); onChange(idx, { ...item, sq_ft: parseFloat(sq.toFixed(4)), sq_ft_manual: false }); }}
                  style={{ fontSize: 9, color: T.primary, cursor: "pointer", fontWeight: 700, background: T.primaryLt, padding: "1px 5px", borderRadius: 4, marginLeft: 2 }}>
                  ↺ auto
                </span>
              )}
              {!item.sq_ft_manual && <span style={{ fontSize: 9, color: T.mutedFg }}>(auto)</span>}
            </span>
          }>
            <InputNumber size="small" min={0} step={0.01} value={item.sq_ft || undefined} placeholder="0.0000"
              style={{ width: "100%", borderRadius: T.radius, borderColor: item.sq_ft_manual ? T.primary : undefined, background: item.sq_ft > 0 ? (item.sq_ft_manual ? T.primaryLt : T.successLt) : undefined }}
              onChange={(val) => onChange(idx, { ...item, sq_ft: parseFloat(val) || 0, sq_ft_manual: true })} />
          </FormField>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes / Specs">
          <Input placeholder="Custom text, specs…" value={item.notes} size="small" style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: priceCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Quantity" required>
          <InputNumber min={1} value={item.quantity} size="small" style={{ width: "100%", borderRadius: T.radius }} onChange={(v) => set("quantity", v || 1)} />
        </FormField>
        <FormField label={isSqFtMode ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: T.radius }} prefix="₹" onChange={(v) => set("price", v || 0)} />
        </FormField>
        <FormField label="GST %">
          <Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={(v) => set("gst_percentage", v)}>
            {GST_OPTIONS.map((g) => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
          </Select>
        </FormField>
      </div>

      <div style={{ marginBottom: 10 }}>
        <FormField label="Design File">
          <DesignFileUpload value={item.design_file} setImagePath={(path) => set("design_file", path)} />
        </FormField>
      </div>

      {/* Line total */}
      <div style={{ background: T.card, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.mutedFg, marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: T.fg }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && <span style={{ marginLeft: 8 }}>GST ({item.gst_percentage}%): <span style={{ fontWeight: 600, color: T.warning }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 700, color: "#065f46" }}>Item Total: ₹{lineTotal.toFixed(2)}</div>
        {isSqFtMode && item.sq_ft > 0 && <div style={{ fontFamily: T.font, fontSize: 10, color: T.success }}>{item.quantity} × {item.sq_ft} ft² × ₹{item.price}</div>}
        {!isSqFtMode && <div style={{ fontFamily: T.font, fontSize: 10, color: T.mutedFg }}>{item.quantity} × ₹{item.price}</div>}
      </div>
    </div>
  );
};

// ─── Office Work Row ───────────────────────────────────────────────────────────
const OfficeServiceItemRow = ({ item, idx, onChange, onRemove, isOnly }) => {
  const { isMobile } = useBreakpoint();
  const set = (f, v) => onChange(idx, { ...item, [f]: v });
  const selectedType = OFFICE_WORK_TYPES.find((t) => t.value === item.office_type);
  const { base, gstAmt, total: lineTotal, qty } = computeOfficeServiceLineTotal(item);

  const renderCalcFields = () => {
    const c = selectedType?.calc;
    if (c === "days") return (
      <FormField label="Number of Days" required>
        <InputNumber min={1} value={item.days} size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="days" onChange={(v) => set("days", v || 1)} />
      </FormField>
    );
    if (c === "hours") return (
      <FormField label="Number of Hours" required>
        <InputNumber min={0} step={0.5} value={item.hours} size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="hrs" onChange={(v) => set("hours", v || 0)} />
      </FormField>
    );
    if (c === "counts") return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FormField label="Reels Count">
          <InputNumber min={0} value={item.reels_count} size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="reels" onChange={(v) => set("reels_count", v || 0)} />
        </FormField>
        <FormField label="Post Count">
          <InputNumber min={0} value={item.post_count} size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="posts" onChange={(v) => set("post_count", v || 0)} />
        </FormField>
      </div>
    );
    return null;
  };

  const getUnitLabel = () => {
    const c = selectedType?.calc;
    if (c === "days") return "Price / Day (₹)";
    if (c === "hours") return "Price / Hour (₹)";
    if (c === "counts") return "Price / Item (₹)";
    return "Unit Price (₹)";
  };

  const getQtyLabel = () => {
    const c = selectedType?.calc;
    if (c === "days") return `${qty} day${qty !== 1 ? "s" : ""}`;
    if (c === "hours") return `${qty} hr${qty !== 1 ? "s" : ""}`;
    if (c === "counts") return `${item.reels_count||0} reels + ${item.post_count||0} posts`;
    return `${qty} units`;
  };

  return (
    <div style={{ background: "#FAFAF9", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, padding: isMobile ? 10 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "2px 10px", borderRadius: 20 }}>
          {selectedType?.icon} {selectedType?.label || "Office Work"} #{idx + 1}
        </span>
        <Popconfirm title="Remove this service?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <FormField label="Service Name">
          <Input placeholder="e.g. Company Website…" value={item.service_name} size="small" style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => set("service_name", e.target.value)} />
        </FormField>
        <FormField label="Service Type" required>
          <Select value={item.office_type} size="small" style={{ width: "100%" }}
            onChange={(v) => onChange(idx, { ...item, office_type: v, days: 1, hours: 1, reels_count: 0, post_count: 0 })}>
            {OFFICE_WORK_TYPES.map((t) => <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>)}
          </Select>
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 10, alignItems: "end" }}>
        <div style={{ gridColumn: item.office_type === "social_media" ? "1 / -1" : undefined }}>
          {renderCalcFields()}
        </div>
        {item.office_type !== "social_media" && (
          <>
            <FormField label={getUnitLabel()} required>
              <InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: T.radius }} prefix="₹" onChange={(v) => set("price", v || 0)} />
            </FormField>
            <FormField label="GST %">
              <Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={(v) => set("gst_percentage", v)}>
                {GST_OPTIONS.map((g) => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
              </Select>
            </FormField>
          </>
        )}
      </div>

      {item.office_type === "social_media" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <FormField label="Price / Item (₹)" required>
            <InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: T.radius }} prefix="₹" onChange={(v) => set("price", v || 0)} />
          </FormField>
          <FormField label="GST %">
            <Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={(v) => set("gst_percentage", v)}>
              {GST_OPTIONS.map((g) => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
            </Select>
          </FormField>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes">
          <Input placeholder="Additional notes…" value={item.notes} size="small" style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>

      <div style={{ background: T.card, border: `1.5px solid #FDE68A`, borderRadius: T.radius, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.mutedFg, marginBottom: 2 }}>
          {getQtyLabel()} × ₹{item.price} = <span style={{ fontWeight: 600, color: T.fg }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && <span style={{ marginLeft: 8 }}>GST: <span style={{ fontWeight: 600, color: T.warning }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 700, color: "#92400E" }}>Service Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── Labour Work Row ───────────────────────────────────────────────────────────
const LabourItemRow = ({ item, idx, onChange, onRemove, isOnly }) => {
  const { isMobile } = useBreakpoint();
  const set = (f, v) => onChange(idx, { ...item, [f]: v });
  const { base, gstAmt, total: lineTotal, sqFtAmt, hoursAmt } = computeLabourLineTotal(item);

  return (
    <div style={{ background: "#FAFAF9", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, padding: isMobile ? 10 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: "#6B21A8", background: "#F3E8FF", padding: "2px 10px", borderRadius: 20 }}>🔧 Labour #{idx + 1}</span>
        <Popconfirm title="Remove this labour entry?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ marginBottom: 10 }}>
        <FormField label="Work Description">
          <Input placeholder="e.g. Flex installation, cutting, finishing…" value={item.service_name} size="small" style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => set("service_name", e.target.value)} />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        <FormField label="Sq. Ft">
          <InputNumber min={0} step={0.5} value={item.sq_ft || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="ft²" onChange={(v) => set("sq_ft", v || 0)} />
        </FormField>
        <FormField label="Price / Sq. Ft (₹)">
          <InputNumber min={0} value={item.price_per_sqft || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: T.radius }} prefix="₹" onChange={(v) => set("price_per_sqft", v || 0)} />
        </FormField>
        <FormField label="Hours">
          <InputNumber min={0} step={0.5} value={item.hours || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: T.radius }} addonAfter="hrs" onChange={(v) => set("hours", v || 0)} />
        </FormField>
        <FormField label="Price / Hour (₹)">
          <InputNumber min={0} value={item.price_per_hour || undefined} placeholder="0" size="small" style={{ width: "100%", borderRadius: T.radius }} prefix="₹" onChange={(v) => set("price_per_hour", v || 0)} />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <FormField label="GST %">
          <Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={(v) => set("gst_percentage", v)}>
            {GST_OPTIONS.map((g) => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Input placeholder="Notes…" value={item.notes} size="small" style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>

      <div style={{ background: T.card, border: `1.5px solid #E9D5FF`, borderRadius: T.radius, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.mutedFg, marginBottom: 2 }}>
          {item.sq_ft > 0 && <span>{item.sq_ft} ft² × ₹{item.price_per_sqft} = ₹{sqFtAmt.toFixed(2)}</span>}
          {item.sq_ft > 0 && item.hours > 0 && <span style={{ margin: "0 6px", color: T.mutedFg }}>+</span>}
          {item.hours > 0 && <span>{item.hours} hrs × ₹{item.price_per_hour} = ₹{hoursAmt.toFixed(2)}</span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.mutedFg, marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: T.fg }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && <span style={{ marginLeft: 8 }}>GST: <span style={{ fontWeight: 600, color: T.warning }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 700, color: "#6B21A8" }}>Labour Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── Job Items Section with Tabs ──────────────────────────────────────────────
const JobItemsSection = ({
  productItems, officeItems, labourItems,
  onProductChange, onOfficeChange, onLabourChange,
  onAddProduct, onAddOffice, onAddLabour,
  onRemoveProduct, onRemoveOffice, onRemoveLabour,
}) => {
  const tabItems = [
    {
      key: "product",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: T.font }}>
          <AppstoreOutlined /> Product
          {productItems.length > 0 && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{productItems.length}</Tag>}
        </span>
      ),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {productItems.map((item, idx) => (
            <ProductItemRow key={idx} item={item} idx={idx} onChange={onProductChange} onRemove={onRemoveProduct}
              isOnly={productItems.length === 1 && officeItems.length === 0 && labourItems.length === 0} />
          ))}
          <Button icon={<PlusOutlined />} onClick={onAddProduct}
            style={{ borderStyle: "dashed", borderRadius: T.radius, color: T.primary, height: 40, borderColor: T.primary, fontFamily: T.font }}>
            Add Product Item
          </Button>
        </div>
      ),
    },
    {
      key: "service",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: T.font }}>
          <ToolOutlined /> Service
          {officeItems.length + labourItems.length > 0 && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>{officeItems.length + labourItems.length}</Tag>}
        </span>
      ),
      children: (
        <Tabs size="small" type="card" items={[
          {
            key: "office",
            label: (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: T.font }}>
                <AppstoreOutlined style={{ fontSize: 12 }} /> Office Work
                {officeItems.length > 0 && <Tag color="gold" style={{ margin: 0, fontSize: 10 }}>{officeItems.length}</Tag>}
              </span>
            ),
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                {officeItems.map((item, idx) => (
                  <OfficeServiceItemRow key={idx} item={item} idx={idx} onChange={onOfficeChange} onRemove={onRemoveOffice} isOnly={officeItems.length === 1} />
                ))}
                <Button icon={<PlusOutlined />} onClick={onAddOffice}
                  style={{ borderStyle: "dashed", borderRadius: T.radius, color: T.mutedFg, height: 40, borderColor: "#FCD34D", fontFamily: T.font }}>
                  Add Office Work
                </Button>
              </div>
            ),
          },
          {
            key: "labour",
            label: (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: T.font }}>
                <ToolOutlined style={{ fontSize: 12 }} /> Labour Work
                {labourItems.length > 0 && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>{labourItems.length}</Tag>}
              </span>
            ),
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                {labourItems.map((item, idx) => (
                  <LabourItemRow key={idx} item={item} idx={idx} onChange={onLabourChange} onRemove={onRemoveLabour} isOnly={labourItems.length === 1} />
                ))}
                <Button icon={<PlusOutlined />} onClick={onAddLabour}
                  style={{ borderStyle: "dashed", borderRadius: T.radius, color: T.mutedFg, height: 40, borderColor: "#C4B5FD", fontFamily: T.font }}>
                  Add Labour Work
                </Button>
              </div>
            ),
          },
        ]} />
      ),
    },
  ];

  return <Tabs defaultActiveKey="product" type="card" size="middle" style={{ marginBottom: 14 }} items={tabItems} />;
};

// ════════════════════════════════════════════════════════════════════════════
// CreateJobModal
// ════════════════════════════════════════════════════════════════════════════
const CreateJobModal = ({ open, onClose, onCreated }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const { user: adminUser }    = useSelector((state) => state.authSlice);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState("");
  const [formData, setFormData]       = useState({ ...DEFAULT_FORM });
  const [productItems, setProductItems] = useState([{ ...EMPTY_PRODUCT_ITEM }]);
  const [officeItems, setOfficeItems]   = useState([]);
  const [labourItems, setLabourItems]   = useState([]);

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeFilled, setPincodeFilled]   = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggest, setShowCitySuggest] = useState(false);
  const cityRef = useRef(null);

  // Inject Inter font once
  useEffect(() => { injectFont(); }, []);

  useEffect(() => {
    const fn = (e) => { if (cityRef.current && !cityRef.current.contains(e.target)) setShowCitySuggest(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handlePincodeChange = async (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    handleInput("pincode", digits);
    setPincodeFilled(false);
    if (digits.length === 6) {
      setPincodeLoading(true);
      const result = await fetchPincodeData(digits);
      if (result) {
        setFormData((p) => ({ ...p, city: result.city, district: result.district, state: result.state, pincode: digits }));
        setPincodeFilled(true);
      }
      setPincodeLoading(false);
    }
  };

  const handleCityInput = (val) => {
    handleInput("city", val);
    setPincodeFilled(false);
    if (val.length >= 2) {
      const filtered = TN_CITIES.filter((c) => c.toLowerCase().startsWith(val.toLowerCase()));
      setCitySuggestions(filtered.slice(0, 8));
      setShowCitySuggest(filtered.length > 0);
    } else { setCitySuggestions([]); setShowCitySuggest(false); }
  };

  const orderDate  = dayjs();
  const validUntil = dayjs().add(30, "day");

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM }); setProductItems([{ ...EMPTY_PRODUCT_ITEM }]);
    setOfficeItems([]); setLabourItems([]); setFormError("");
    setPincodeLoading(false); setPincodeFilled(false); setCitySuggestions([]); setShowCitySuggest(false);
  };

  useEffect(() => { if (open) resetForm(); }, [open]);
  const handleInput = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const handleProductChange = (i, u) => setProductItems((p) => p.map((it, j) => (j === i ? u : it)));
  const handleOfficeChange  = (i, u) => setOfficeItems((p)  => p.map((it, j) => (j === i ? u : it)));
  const handleLabourChange  = (i, u) => setLabourItems((p)  => p.map((it, j) => (j === i ? u : it)));

  const addProduct = () => setProductItems((p) => [...p, { ...EMPTY_PRODUCT_ITEM }]);
  const addOffice  = () => setOfficeItems((p)  => [...p, { ...EMPTY_OFFICE_ITEM }]);
  const addLabour  = () => setLabourItems((p)  => [...p, { ...EMPTY_LABOUR_ITEM }]);

  const removeProduct = (i) => setProductItems((p) => p.filter((_, j) => j !== i));
  const removeOffice  = (i) => setOfficeItems((p)  => p.filter((_, j) => j !== i));
  const removeLabour  = (i) => setLabourItems((p)  => p.filter((_, j) => j !== i));

  const disabledDate = (c) => c && c < dayjs().startOf("day");
  const disabledTime = (c) => {
    if (!c || !c.isSame(dayjs(), "day")) return {};
    const now = dayjs();
    return {
      disabledHours:   () => Array.from({ length: now.hour() }, (_, i) => i),
      disabledMinutes: (h) => h === now.hour() ? Array.from({ length: now.minute() }, (_, i) => i) : [],
    };
  };

  // ── Totals calculation with round-half-up ─────────────────────────────────
  const calcTotals = useCallback(() => {
    let subTotal = 0, totalGst = 0;
    productItems.forEach((it) => { const { base, gstAmt } = computeProductLineTotal(it);         subTotal += base; totalGst += gstAmt; });
    officeItems.forEach((it)  => { const { base, gstAmt } = computeOfficeServiceLineTotal(it);   subTotal += base; totalGst += gstAmt; });
    labourItems.forEach((it)  => { const { base, gstAmt } = computeLabourLineTotal(it);          subTotal += base; totalGst += gstAmt; });

    const discPct  = parseFloat(formData.discount_percentage) || 0;
    const discAmt  = subTotal * (discPct / 100);
    const afterDisc = subTotal - discAmt;
    const del      = formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0;

    const grandTotalExact   = afterDisc + totalGst + del;
    const grandTotalRounded = roundHalfUp(grandTotalExact);
    const roundingAdj       = parseFloat((grandTotalRounded - grandTotalExact).toFixed(2)); // positive = rounded up

    const paid    = parseFloat(formData.payment_amount) || 0;
    const balance = grandTotalRounded - paid;

    return { subTotal, totalGst, discAmt, afterDisc, del, grandTotalExact, grandTotalRounded, roundingAdj, paid, balance };
  }, [productItems, officeItems, labourItems, formData]);

  const handleSubmit = async () => {
    setFormLoading(true); setFormError("");
    try {
      if (!formData.customer_name.trim())    throw new Error("Customer name is required");
      if (!formData.customer_phone.trim())   throw new Error("Phone number is required");
      if (!formData.estimated_delivery_date) throw new Error("Estimated delivery date is required");
      if (!formData.notes.trim())            throw new Error("Notes is required");

      const allItems = [...productItems, ...officeItems, ...labourItems];
      if (!allItems.length) throw new Error("Add at least one item or service");

      const validProducts = productItems.filter((it) => {
        if (!it.product_name || !it.quantity_type) return false;
        if (it.quantity_type === "sq.ft" && (it.sq_ft || 0) <= 0) return false;
        return (it.quantity || 0) > 0 && (it.price || 0) > 0;
      });
      const validOffice = officeItems.filter((it) => it.office_type && (it.price || 0) > 0);
      const validLabour = labourItems.filter((it) => it.sq_ft > 0 || it.hours > 0);

      if (!validProducts.length && !validOffice.length && !validLabour.length)
        throw new Error("Add at least one valid item with price/qty");

      const t = calcTotals();

      const cartItems = [
        ...validProducts.map((it) => {
          const { base, gstAmt, total } = computeProductLineTotal(it);
          return {
            item_category: "product", product_id: it.product_id || "",
            product_name: it.product_name, variation: it.variation || "",
            printing_type: it.printing_type || "", quantity: it.quantity,
            quantity_type: it.quantity_type, price: it.price,
            gst_percentage: it.gst_percentage || 0, gst_amount: parseFloat(gstAmt.toFixed(2)),
            line_base: parseFloat(base.toFixed(2)), line_total: parseFloat(total.toFixed(2)),
            design_file: it.design_file || "", notes: it.notes || "",
            width: it.quantity_type === "sq.ft" ? it.width : "",
            height: it.quantity_type === "sq.ft" ? it.height : "",
            size_unit: it.quantity_type === "quantity" ? "pcs" : it.size_unit,
            sq_ft: it.quantity_type === "sq.ft" ? it.sq_ft : 0,
            sq_ft_manual: it.sq_ft_manual || false,
            size: it.quantity_type === "sq.ft" && it.width && it.height
              ? `${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)` : "",
          };
        }),
        ...validOffice.map((it) => {
          const { base, gstAmt, total, qty } = computeOfficeServiceLineTotal(it);
          return {
            item_category: "service_office", product_name: it.service_name || it.office_type,
            office_type: it.office_type, days: it.days || 0, hours: it.hours || 0,
            reels_count: it.reels_count || 0, post_count: it.post_count || 0, quantity: qty,
            quantity_type: it.office_type === "website" ? "days" : it.office_type === "social_media" ? "items" : "hours",
            price: it.price, gst_percentage: it.gst_percentage || 0,
            gst_amount: parseFloat(gstAmt.toFixed(2)), line_base: parseFloat(base.toFixed(2)),
            line_total: parseFloat(total.toFixed(2)), notes: it.notes || "",
          };
        }),
        ...validLabour.map((it) => {
          const { base, gstAmt, total } = computeLabourLineTotal(it);
          return {
            item_category: "service_labour", product_name: it.service_name || "Labour Work",
            sq_ft: it.sq_ft || 0, hours: it.hours || 0,
            price_per_sqft: it.price_per_sqft || 0, price_per_hour: it.price_per_hour || 0,
            quantity: 1, quantity_type: "labour", price: base || 0,
            gst_percentage: it.gst_percentage || 0, gst_amount: parseFloat(gstAmt.toFixed(2)),
            line_base: parseFloat(base.toFixed(2)), line_total: parseFloat(total.toFixed(2)), notes: it.notes || "",
          };
        }),
      ];

      const payload = {
        order_date:               orderDate.toISOString(),
        valid_until:              validUntil.toISOString(),
        estimated_delivery_date:  formData.estimated_delivery_date.toISOString(),
        customer_name:            formData.customer_name.trim(),
        customer_phone:           formData.customer_phone.trim(),
        company_name:             (formData.company_name || "").trim(),
        delivery_address: {
          street:   [formData.address_line1, formData.address_line2].filter(Boolean).join(", "),
          city:     formData.city, district: formData.district || "",
          state:    formData.state, pincode:  formData.pincode, country: formData.country,
        },
        cart_items:           cartItems,
        gst_no:               formData.gst_no.trim(),
        subtotal:             parseFloat(t.subTotal.toFixed(2)),
        discount_amount:      parseFloat(t.discAmt.toFixed(2)),
        taxable_amount:       parseFloat(t.afterDisc.toFixed(2)),
        tax_amount:           parseFloat(t.totalGst.toFixed(2)),
        delivery_charges:     formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0,
        free_delivery:        formData.free_delivery,
        discount_percentage:  parseFloat(formData.discount_percentage || 0),
        // ✅ Send the ROUNDED total (808.20 → 808 | 808.60 → 809)
        total_amount:         t.grandTotalRounded,
        rounding_adjustment:  parseFloat(t.roundingAdj.toFixed(2)),
        payments: t.paid > 0 ? [{
          amount: parseFloat(t.paid.toFixed(2)), method: formData.payment_mode || "", notes: "",
          next_due_date: t.balance > 0 && formData.next_due_date ? formData.next_due_date.toISOString() : null,
        }] : [],
        notes:                formData.notes.trim(),
        terms_and_conditions: formData.terms_and_conditions.trim(),
        created_by:           adminUser?.name || "Admin",
        created_by_admin_id:  adminUser?._id ?? null,
        job_status:           "draft",
      };

      const res  = await fetch("https://api.dmedia.in/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create job");

      const createdJob = data.job || data.data;
      SUCCESS_NOTIFICATION({ message: createdJob?.job_no ? `Job ${createdJob.job_no} created!` : "Job created successfully!" });
      onClose(); onCreated?.();
    } catch (err) {
      setFormError(err.message || "Failed to create job");
    } finally { setFormLoading(false); }
  };

  const totals = calcTotals();
  const g      = isMobile ? 8 : 12;
  const c2     = isMobile ? "1fr" : "1fr 1fr";
  const c3     = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const modalWidth = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw, 960px)";
  const mobileFullStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};
  const hasRounding = Math.abs(totals.roundingAdj) >= 0.01;

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); resetForm(); }}
      footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.font }}>
          <FileTextOutlined style={{ color: T.primary }} />
          <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: T.fg }}>Create New Job</span>
          <Tag color="blue" style={{ fontFamily: "monospace", marginLeft: 4, fontSize: 11 }}>Draft</Tag>
        </div>
      }
      width={modalWidth}
      style={mobileFullStyle}
      styles={{
        body: { maxHeight: isMobile ? "calc(100dvh - 56px)" : "86vh", overflowY: "auto", padding: isMobile ? 10 : 18 },
        header: { padding: `${isMobile ? 10 : 14}px ${isMobile ? 12 : 18}px`, borderBottom: `1px solid ${T.border}` },
      }}
      destroyOnClose>
      <Spin spinning={formLoading} indicator={<LoadingOutlined style={{ color: T.primary }} spin />}>

        {/* ── Order info banner ───────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.primaryLt} 0%, #F0FDF4 100%)`,
          border: `1px solid #BFDBFE`, borderRadius: T.radiusLg,
          padding: isMobile ? "10px 12px" : "12px 16px", marginBottom: 16,
          display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 20, alignItems: "center",
        }}>
          <InfoBadge label="Order Date"  value={orderDate.format("DD MMM YYYY")} />
          <InfoBadge label="Valid Until" value={validUntil.format("DD MMM YYYY")} color={T.success} sub="30 days" />
          {adminUser?.name && <InfoBadge label="Created By" value={adminUser.name} />}
        </div>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {formError && (
          <div style={{ marginBottom: 14, padding: "10px 16px", background: T.dangerLt, border: `1px solid #FCA5A5`, borderLeft: `4px solid ${T.danger}`, borderRadius: T.radius, fontFamily: T.font, color: "#B91C1C", fontSize: 13, fontWeight: 500 }}>
            ⚠ {formError}
          </div>
        )}

        {/* ── Customer Info ─────────────────────────────────────────────── */}
        <SectionHeader icon={<UserOutlined />} title="Customer Info" />
        <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: g }}>
          <FormField label="Customer Name" required>
            <Input prefix={<UserOutlined style={{ color: T.mutedFg }} />} placeholder="Full name"
              value={formData.customer_name} style={{ borderRadius: T.radius, fontFamily: T.font }}
             onChange={(e) => handleInput("customer_name", e.target.value.replace(/^\w/, c => c.toUpperCase()))} />
          </FormField>
          <FormField label="Phone" required>
            <Input prefix={<PhoneOutlined style={{ color: T.mutedFg }} />} placeholder="10-digit mobile"
              value={formData.customer_phone} maxLength={10} style={{ borderRadius: T.radius, fontFamily: T.font }}
              onChange={(e) => handleInput("customer_phone", e.target.value)} />
          </FormField>
          <FormField label="Est. Delivery Date" required>
            <DatePicker showTime={{ format: "hh:mm A", use12Hours: true }} format="DD MMM YYYY  hh:mm A"
              placeholder="Select date & time" value={formData.estimated_delivery_date}
              disabledDate={disabledDate} disabledTime={disabledTime}
              onChange={(dayjsVal) => handleInput("estimated_delivery_date", dayjsVal)}
              style={{ width: "100%", borderRadius: T.radius, fontFamily: T.font }} size="middle" needConfirm
              getPopupContainer={(t) => t.parentElement} />
          </FormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 18 }}>
          <FormField label="Company Name">
            <Input prefix={<BankOutlined style={{ color: T.mutedFg }} />} placeholder="Company / Business name"
              value={formData.company_name} style={{ borderRadius: T.radius, fontFamily: T.font }}
              onChange={(e) => handleInput("company_name", e.target.value)} />
          </FormField>
          <FormField label="GST Number" hint="15-character GSTIN (optional)">
            <Input placeholder="22AAAAA0000A1Z5" maxLength={15} value={formData.gst_no}
              style={{ borderRadius: T.radius, fontFamily: T.font, letterSpacing: "0.05em" }}
              onChange={(e) => handleInput("gst_no", e.target.value.toUpperCase())} />
          </FormField>
        </div>

        {/* ── Delivery Address ───────────────────────────────────────────── */}
        <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
        <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g }}>
            <FormField label="Address Line 1">
              <Input placeholder="Flat / Door No, Building" value={formData.address_line1}
                style={{ borderRadius: T.radius, fontFamily: T.font }}
                onChange={(e) => handleInput("address_line1", e.target.value)} />
            </FormField>
            <FormField label="Address Line 2">
              <Input placeholder="Street, Area, Landmark" value={formData.address_line2}
                style={{ borderRadius: T.radius, fontFamily: T.font }}
                onChange={(e) => handleInput("address_line2", e.target.value)} />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: g }}>
            {/* Pincode */}
            <FormField label="Pincode" hint={pincodeFilled ? "✅ Auto-filled" : pincodeLoading ? "🔍 Looking up…" : ""}>
              <Input placeholder="6-digit" value={formData.pincode} maxLength={6}
                onChange={(e) => handlePincodeChange(e.target.value)}
                style={{ borderRadius: T.radius, fontFamily: T.font, borderColor: pincodeFilled ? T.success : undefined }}
                suffix={
                  pincodeLoading
                    ? <LoadingOutlined style={{ color: T.primary, fontSize: 12 }} spin />
                    : pincodeFilled
                      ? <CheckCircleOutlined style={{ color: T.success, fontSize: 12 }} />
                      : null
                } />
            </FormField>

            {/* City with TN suggestions */}
            <FormField label="City">
              <div style={{ position: "relative" }} ref={cityRef}>
                <Input placeholder="City" value={formData.city} autoComplete="off"
                  onChange={(e) => handleCityInput(e.target.value)}
                  onFocus={() => { if (citySuggestions.length > 0) setShowCitySuggest(true); }}
                  style={{ borderRadius: T.radius, fontFamily: T.font }} />
                {showCitySuggest && citySuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
                    <div style={{ padding: "5px 12px 4px", fontFamily: T.font, fontSize: 9, fontWeight: 700, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                      Tamil Nadu Cities
                    </div>
                    {citySuggestions.map((city) => (
                      <div key={city}
                        onMouseDown={() => { handleInput("city", city); setShowCitySuggest(false); setCitySuggestions([]); }}
                        style={{ padding: "8px 12px", cursor: "pointer", fontFamily: T.font, fontSize: 13, color: T.fg, borderBottom: `1px solid ${T.muted}`, display: "flex", alignItems: "center", gap: 6 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = T.primaryLt)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = T.card)}>
                        <span style={{ fontSize: 11 }}>📍</span>
                        <span style={{ fontWeight: 600 }}>{city}</span>
                        <span style={{ fontSize: 9, color: T.mutedFg, marginLeft: "auto", background: T.muted, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>TN</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            <FormField label="District">
              <Input placeholder="District" value={formData.district || ""} style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => handleInput("district", e.target.value)} />
            </FormField>
            <FormField label="State">
              <Input placeholder="State" value={formData.state} style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => handleInput("state", e.target.value)} />
            </FormField>
            <FormField label="Country">
              <Input placeholder="Country" value={formData.country} style={{ borderRadius: T.radius, fontFamily: T.font }} onChange={(e) => handleInput("country", e.target.value)} />
            </FormField>
          </div>
        </div>

        {/* ── Job Items ──────────────────────────────────────────────────── */}
        <SectionHeader icon={<ShoppingCartOutlined />} title="Job Items"
          count={productItems.length + officeItems.length + labourItems.length} />
        <JobItemsSection
          productItems={productItems} officeItems={officeItems} labourItems={labourItems}
          onProductChange={handleProductChange} onOfficeChange={handleOfficeChange} onLabourChange={handleLabourChange}
          onAddProduct={addProduct} onAddOffice={addOffice} onAddLabour={addLabour}
          onRemoveProduct={removeProduct} onRemoveOffice={removeOffice} onRemoveLabour={removeLabour} />

        {/* ── Payment ────────────────────────────────────────────────────── */}
        <SectionHeader icon={<WalletOutlined />} title="Payment" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: g, marginBottom: g }}>
          <FormField label="Payment Mode">
            <Select placeholder="Select mode" value={formData.payment_mode || undefined}
              style={{ width: "100%", fontFamily: T.font }} allowClear
              onChange={(v) => handleInput("payment_mode", v ?? "")}>
              {PAYMENT_MODES.map((m) => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </FormField>
          <FormField label="Amount Paid (₹)">
            <InputNumber min={0} placeholder="0.00" value={formData.payment_amount || undefined}
              style={{ width: "100%", borderRadius: T.radius, fontFamily: T.font }} prefix="₹"
              onChange={(v) => handleInput("payment_amount", v ?? "")} />
          </FormField>

          {/* ── Delivery charges + free delivery toggle ── */}
          <FormField label="Delivery Charges (₹)">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <InputNumber min={0} placeholder="0.00"
                value={formData.free_delivery ? 0 : formData.delivery_charges || undefined}
                disabled={formData.free_delivery}
                style={{ flex: 1, borderRadius: T.radius }} prefix="₹"
                onChange={(v) => handleInput("delivery_charges", v ?? 0)} />
              {/* Toggle switch */}
              <div
                onClick={() => handleInput("free_delivery", !formData.free_delivery)}
                title={formData.free_delivery ? "Click to disable free delivery" : "Click for free delivery"}
                style={{
                  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                  background: formData.free_delivery ? T.success : T.muted,
                  border: `1.5px solid ${formData.free_delivery ? T.success : T.border}`,
                  borderRadius: 30, padding: "4px 10px", transition: "all 200ms ease",
                  userSelect: "none", flexShrink: 0,
                }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: formData.free_delivery ? "#fff" : T.mutedFg,
                  transition: "all 200ms ease", flexShrink: 0,
                }} />
                <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: formData.free_delivery ? "#fff" : T.mutedFg, whiteSpace: "nowrap" }}>
                  {formData.free_delivery ? "🎉 Free" : "Free?"}
                </span>
              </div>
            </div>
          </FormField>
        </div>

        {/* Discount */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: g, marginBottom: g }}>
          <FormField label="Discount %" hint="Applied on subtotal before GST">
            <InputNumber min={0} max={100} placeholder="0" value={formData.discount_percentage || undefined}
              style={{ width: "100%", borderRadius: T.radius }} addonAfter="%"
              onChange={(v) => handleInput("discount_percentage", v ?? 0)} />
          </FormField>
        </div>

        {/* Balance due alert */}
        {totals.balance > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: g, marginBottom: g, padding: "12px 14px", background: T.warningLt, border: `1px solid #FED7AA`, borderRadius: T.radius }}>
            <FormField label="Next Due Date">
              <DatePicker format="DD MMM YYYY" placeholder="Select due date"
                value={formData.next_due_date}
                disabledDate={(d) => d && d < dayjs().startOf("day")}
                onChange={(dayjsVal) => handleInput("next_due_date", dayjsVal)}
                style={{ width: "100%", borderRadius: T.radius }} getPopupContainer={(t) => t.parentElement} />
            </FormField>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20, flexWrap: "wrap" }}>
              <div style={{ padding: "6px 14px", background: T.dangerLt, border: `1px solid #FCA5A5`, borderRadius: T.radius, fontFamily: T.font, fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>
                ⚠ Balance Due: ₹{totals.balance.toFixed(2)}
              </div>
              {formData.next_due_date && (
                <div style={{ padding: "6px 14px", background: "#FEFCE8", border: `1px solid #FDE047`, borderRadius: T.radius, fontFamily: T.font, fontSize: 12, color: "#854D0E" }}>
                  📅 Due {formData.next_due_date.format("DD MMM YYYY")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <SectionHeader icon={<FileTextOutlined />} title="Notes" />
        <div style={{ marginBottom: 18 }}>
          <FormField label="Notes" required>
            <TextArea rows={3} placeholder="Additional notes, special instructions…"
              value={formData.notes} onChange={(e) => handleInput("notes", e.target.value)}
              style={{ borderRadius: T.radius, fontFamily: T.font, resize: "vertical" }} />
          </FormField>
        </div>

        {/* ── Order Summary ───────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.primaryLt} 0%, #F8FAFC 100%)`,
          border: `1.5px solid #BFDBFE`, borderRadius: T.radiusLg,
          padding: isMobile ? 12 : "16px 18px", marginBottom: 18,
        }}>
          {/* Summary header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: T.font, fontWeight: 700, color: "#1E40AF", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <FileTextOutlined /> Order Summary
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {productItems.length > 0 && <span style={{ fontFamily: T.font, fontSize: 10, background: "#DBEAFE", color: "#1D4ED8", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>📦 {productItems.length} product{productItems.length !== 1 ? "s" : ""}</span>}
              {officeItems.length > 0  && <span style={{ fontFamily: T.font, fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>💼 {officeItems.length} service{officeItems.length !== 1 ? "s" : ""}</span>}
              {labourItems.length > 0  && <span style={{ fontFamily: T.font, fontSize: 10, background: "#F3E8FF", color: "#6B21A8", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>🔧 {labourItems.length} labour</span>}
            </div>
          </div>

          {/* Line rows */}
          <SummaryRow label={`Subtotal (before GST & discount)`} value={`₹${totals.subTotal.toFixed(2)}`} />
          {totals.discAmt > 0 && <SummaryRow label={`Discount (${formData.discount_percentage}%)`} value={`− ₹${totals.discAmt.toFixed(2)}`} color={T.success} bold />}
          <SummaryRow label="Total GST (per item)" value={`₹${totals.totalGst.toFixed(2)}`} color={T.warning} />
          <SummaryRow
            label="Delivery Charges"
            value={formData.free_delivery ? "Free 🎉" : `₹${totals.del.toFixed(2)}`}
            color={formData.free_delivery ? T.success : undefined} />

          <Divider style={{ margin: "10px 0" }} />

          {/* Exact total (before rounding) — shown only when rounding applies */}
          {hasRounding && (
            <SummaryRow
              label="Exact Total (before rounding)"
              value={`₹${totals.grandTotalExact.toFixed(2)}`}
              small color={T.mutedFg} />
          )}

          {/* Rounding adjustment line */}
          {hasRounding && (
            <SummaryRow
              label={totals.roundingAdj > 0 ? "Rounding (+)" : "Rounding (−)"}
              value={`${totals.roundingAdj > 0 ? "+" : ""}₹${totals.roundingAdj.toFixed(2)}`}
              color={T.mutedFg} small />
          )}

          {/* ✅ Grand Total — golden highlighted row */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 8, padding: "10px 14px",
            background: T.goldenLt, border: `1.5px solid ${T.golden}`,
            borderRadius: T.radius,
          }}>
            <span style={{ fontFamily: T.font, fontSize: isMobile ? 14 : 15, fontWeight: 800, color: T.onGolden }}>
              Grand Total
              {hasRounding && <span style={{ fontFamily: T.font, fontSize: 10, fontWeight: 500, color: T.goldenDk, marginLeft: 6 }}>(rounded)</span>}
            </span>
            <span style={{ fontFamily: T.font, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.onGolden, letterSpacing: "-0.02em" }}>
              ₹{totals.grandTotalRounded}
            </span>
          </div>

          {/* Paid / Balance rows */}
          {(totals.paid > 0 || formData.payment_mode) && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.font, fontSize: 13, color: T.success, marginTop: 8, marginBottom: 4 }}>
                <span>Amount Paid {formData.payment_mode ? `(${formData.payment_mode})` : ""}</span>
                <span style={{ fontWeight: 700 }}>− ₹{totals.paid.toFixed(2)}</span>
              </div>
              <Divider style={{ margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: T.font, fontSize: isMobile ? 14 : 15, fontWeight: 800 }}>
                <span style={{ color: T.fg }}>Balance Due</span>
                <span style={{
                  color: totals.balance <= 0 ? T.success : T.danger,
                  background: totals.balance <= 0 ? T.successLt : T.dangerLt,
                  padding: "3px 12px", borderRadius: T.radius,
                }}>
                  {totals.balance <= 0
                    ? `✓ Paid${Math.abs(totals.balance) > 0.01 ? ` (Advance ₹${Math.abs(totals.balance).toFixed(2)})` : ""}`
                    : `₹${totals.balance.toFixed(2)}`}
                </span>
              </div>
              {totals.balance > 0 && formData.next_due_date && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <span style={{ fontFamily: T.font, fontSize: 11, color: "#854D0E", background: "#FEFCE8", border: `1px solid #FDE047`, padding: "2px 10px", borderRadius: T.radius }}>
                    📅 Next due: {formData.next_due_date.format("DD MMM YYYY")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Action buttons ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <Button onClick={() => { onClose(); resetForm(); }}
            style={{ borderRadius: T.radius, height: 40, fontFamily: T.font, flex: isMobile ? 1 : undefined }}>
            Cancel
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={formLoading}
            style={{
              background: T.primary, border: "none", borderRadius: T.radius,
              height: 40, fontFamily: T.font, fontWeight: 700, fontSize: 14,
              flex: isMobile ? 1 : undefined, minWidth: 140,
              boxShadow: `0 2px 8px rgba(37,99,235,0.28)`,
            }}>
            Create Job
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

export default CreateJobModal;