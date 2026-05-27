import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  Button, Input, Modal, Select, Tag, Divider, Spin,
  InputNumber, Popconfirm, Radio,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UserOutlined, PhoneOutlined,
  EnvironmentOutlined, FileTextOutlined, ShoppingCartOutlined,
  SaveOutlined, WalletOutlined, BankOutlined, UploadOutlined, CloseCircleOutlined,
} from "@ant-design/icons";
import { SUCCESS_NOTIFICATION } from "../../helper/notification_helper";
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
  return { isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md" };
};

// ─── Static Data ──────────────────────────────────────────────────────────────
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
  { value: "ft",   label: "ft"   },
  { value: "inch", label: "inch" },
  { value: "cm",   label: "cm"   },
];

const QTY_TYPE_OPTIONS = [
  { value: "sq.ft",    label: "Sq. Ft"   },
  { value: "quantity", label: "Quantity" },
];

const GST_OPTIONS   = [0, 5, 12, 18, 28];
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

// ─── Line total ───────────────────────────────────────────────────────────────
const computeLineTotal = (item) => {
  const base =
    item.quantity_type === "sq.ft"
      ? (item.quantity || 0) * (item.sq_ft || 0) * (item.price || 0)
      : (item.quantity || 0) * (item.price || 0);
  const gstAmt = base * ((item.gst_percentage || 0) / 100);
  return { base, gstAmt, total: base + gstAmt };
};

// ─── Canvas-based image compressor (target ≤ maxKB) ──────────────────────────
const compressImageFile = (file, maxKB = 500) =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size <= maxKB * 1024) {
      resolve(file);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const img     = new Image();

    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = (maxKB * 1024) / file.size;
      if (ratio < 0.9) {
        const s = Math.sqrt(ratio);
        w = Math.max(1, Math.round(w * s));
        h = Math.max(1, Math.round(h * s));
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      const outType = file.type === "image/png" ? "image/jpeg" : file.type;

      const tryQuality = (q) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxKB * 1024 || q <= 0.10) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                type: blob.type, lastModified: Date.now(),
              }));
            } else {
              tryQuality(parseFloat((q - 0.05).toFixed(2)));
            }
          },
          outType,
          q,
        );
      };
      tryQuality(0.85);
    };

    img.src = blobUrl;
  });

// ─── DesignFileUpload ─────────────────────────────────────────────────────────
const DesignFileUpload = ({ value, setImagePath }) => {
  const inputRef          = useRef(null);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  const [origSize, setOrigSize] = useState(null);
  const [compSize, setCompSize] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setOrigSize((file.size / 1024).toFixed(0));
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, 500);
      setCompSize((compressed.size / 1024).toFixed(0));

      const reader = new FileReader();
      reader.onload  = (e) => { setImagePath(e.target.result); setBusy(false); };
      reader.onerror = ()  => { setError("Failed to read file."); setBusy(false); };
      reader.readAsDataURL(compressed);
    } catch (err) {
      setError("Compression failed, please try again.");
      setBusy(false);
    }
  };

  const handleClear = () => {
    setImagePath("");
    setOrigSize(null);
    setCompSize(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatKB = (kb) => kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button
          size="small"
          icon={<UploadOutlined />}
          loading={busy}
          onClick={() => inputRef.current?.click()}
          style={{ borderRadius: 6, fontSize: 12 }}
        >
          {busy ? "Compressing…" : value ? "Change File" : "Upload Design"}
        </Button>

        {value && !busy && (
          <Button
            size="small"
            danger
            type="text"
            icon={<CloseCircleOutlined />}
            onClick={handleClear}
            style={{ fontSize: 12 }}
          >
            Remove
          </Button>
        )}
      </div>

      {!busy && origSize && compSize && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#059669", fontWeight: 600 }}>
          ✅ Compressed: {formatKB(origSize)} → {formatKB(compSize)}
          {compSize <= 500 ? " (≤ 500 KB ✓)" : " ⚠ Still large, uploading anyway"}
        </div>
      )}

      {busy && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#2563eb", fontWeight: 600 }}>
          ⏳ Compressing image, please wait…
        </div>
      )}

      {error && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#dc2626" }}>⚠ {error}</div>
      )}

      {value && !busy && (
        <div style={{
          marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8,
          background: "#f9fafb", padding: 4,
          display: "flex", justifyContent: "center", alignItems: "center",
          maxHeight: 120, overflow: "hidden",
        }}>
          <img
            src={value}
            alt="Design Preview"
            style={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_ITEM = {
  product_id: "", product_name: "", variation: "", printing_type: "",
  width: "", height: "", size_unit: "inch",
  sq_ft: 0, sq_ft_manual: false,
  quantity_type: "sq.ft", quantity: 1, price: 0,
  gst_percentage: 0, design_file: "", notes: "",
};

const DEFAULT_FORM = {
  customer_name: "", customer_phone: "",
  company_name: "",
  estimated_delivery_date: "",
  address_line1: "", address_line2: "",
  city: "", state: "", pincode: "", country: "India",
  gst_no: "",
  delivery_charges: 0, free_delivery: false,
  discount_percentage: 0,
  payment_mode: "", payment_amount: "",
  // ── New fields ──
  notes: "",
  terms_and_conditions: "",
};

// ─── Reusable UI atoms ────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
    <span style={{ color: "#2563eb", fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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

const InfoBadge = ({ label, value, green, sub }) => (
  <div style={{ flex: 1, minWidth: 90 }}>
    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: green ? "#059669" : "#374151" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: "#9ca3af" }}>{sub}</div>}
  </div>
);

// ─── Product Item Row ─────────────────────────────────────────────────────────
const ProductItemRow = ({ item, idx, onChange, onRemove, isOnly }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);

  const matched  = item.product_name
    ? PRODUCTS.filter(p => p.product_name.toLowerCase().includes(item.product_name.toLowerCase()))
    : [];
  const selected = PRODUCTS.find(
    p => p.product_name.toLowerCase() === (item.product_name || "").toLowerCase()
  );

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sizeChange = (field, val) => {
    const updated = { ...item, [field]: val };
    if (item.quantity_type === "sq.ft" && !updated.sq_ft_manual) {
      updated.sq_ft = parseFloat(toSqFt(updated.width, updated.height, updated.size_unit).toFixed(4));
    }
    onChange(idx, updated);
  };

  const set = (f, v) => onChange(idx, { ...item, [f]: v });

  const handleQtyTypeChange = (val) => {
    onChange(idx, {
      ...item,
      quantity_type: val,
      ...(val === "quantity" ? { sq_ft: 0, sq_ft_manual: false } : {}),
    });
  };

  const isSqFtMode = item.quantity_type === "sq.ft";
  const { base, gstAmt, total: lineTotal } = computeLineTotal(item);

  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sizeCols    = isSqFtMode
    ? (isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr")
    : (isMobile ? "1fr 1fr" : "1fr 1fr 90px");
  const priceCols   = isMobile ? "1fr 1fr" : "repeat(3,1fr)";

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? 10 : 14 }}>

      {/* Row header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#e0e7ff", padding: "2px 10px", borderRadius: 20 }}>
            Item {idx + 1}
          </span>
          <Radio.Group size="small" value={item.quantity_type} onChange={(e) => handleQtyTypeChange(e.target.value)} buttonStyle="solid">
            {QTY_TYPE_OPTIONS.map(o => (
              <Radio.Button key={o.value} value={o.value} style={{ fontSize: 11, fontWeight: 600, height: 24, lineHeight: "22px", padding: "0 10px" }}>
                {o.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <Popconfirm title="Remove this item?" onConfirm={() => onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      {/* Product / Material / Printing */}
      <div style={{ display: "grid", gridTemplateColumns: productCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Product Name" required>
          <div style={{ position: "relative" }} ref={ref}>
            <Input
              placeholder="Type product…"
              value={item.product_name}
              size="small"
              autoComplete="off"
              style={{ borderRadius: 6 }}
              onChange={(e) => { onChange(idx, { ...item, product_name: e.target.value, variation: "", printing_type: "" }); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
            />
            {showSuggest && matched.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {matched.map(p => (
                  <div
                    key={p.product_id}
                    onMouseDown={() => { onChange(idx, { ...item, product_name: p.product_name, product_id: p.product_id, variation: "", printing_type: "" }); setShowSuggest(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#1a1a2e", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                  >
                    🖨️ {p.product_name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontWeight: 400 }}>{p.printing_type?.join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>

        <FormField label="Material">
          <Select placeholder={selected ? "Select variation" : "—"} value={item.variation || undefined} size="small" style={{ width: "100%" }} disabled={!selected} onChange={(v) => set("variation", v)}>
            {(selected?.variations || []).map(v => <Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>

        <FormField label="Printing Type">
          <Select placeholder={selected ? "Select type" : "—"} value={item.printing_type || undefined} size="small" style={{ width: "100%" }} disabled={!selected} onChange={(v) => set("printing_type", v)}>
            {(selected?.printing_type || []).map(t => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>

      {/* Size fields */}
      <div style={{ display: "grid", gridTemplateColumns: sizeCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
        <FormField label="Width" required={isSqFtMode}>
          <Input size="small" placeholder="0" type="number" min={0} value={item.width}
            prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>W</span>}
            style={{ borderRadius: 6 }}
            onChange={(e) => sizeChange("width", e.target.value)} />
        </FormField>

        <FormField label="Height" required={isSqFtMode}>
          <Input size="small" placeholder="0" type="number" min={0} value={item.height}
            prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>H</span>}
            style={{ borderRadius: 6 }}
            onChange={(e) => sizeChange("height", e.target.value)} />
        </FormField>

        <FormField label="Unit">
          <Select value={item.size_unit} size="small" style={{ width: "100%" }} onChange={(v) => sizeChange("size_unit", v)}>
            {UNIT_OPTIONS.map(u => <Option key={u.value} value={u.value}>{u.label}</Option>)}
          </Select>
        </FormField>

        {isSqFtMode && (
          <FormField label={
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Sq. Ft
              {item.sq_ft_manual && (item.width || item.height) && (
                <span
                  onClick={() => {
                    const sq = toSqFt(item.width, item.height, item.size_unit);
                    onChange(idx, { ...item, sq_ft: parseFloat(sq.toFixed(4)), sq_ft_manual: false });
                  }}
                  style={{ fontSize: 9, color: "#2563eb", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 600, background: "#eff6ff", padding: "1px 5px", borderRadius: 4, marginLeft: 2 }}
                >
                  ↺ auto
                </span>
              )}
              {!item.sq_ft_manual && (
                <span style={{ fontSize: 9, color: "#6b7280", textTransform: "none", letterSpacing: 0 }}>(auto)</span>
              )}
            </span>
          }>
            <InputNumber
              size="small" min={0} step={0.01} value={item.sq_ft || undefined} placeholder="0.0000"
              style={{
                width: "100%", borderRadius: 6,
                borderColor: item.sq_ft_manual ? "#2563eb" : undefined,
                background: item.sq_ft > 0 ? (item.sq_ft_manual ? "#eff6ff" : "#ecfdf5") : undefined,
              }}
              onChange={(val) => onChange(idx, { ...item, sq_ft: parseFloat(val) || 0, sq_ft_manual: true })}
            />
          </FormField>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes / Specs">
          <Input placeholder="Custom text, specs…" value={item.notes} size="small" style={{ borderRadius: 6 }} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>

      {/* Price row */}
      <div style={{ display: "grid", gridTemplateColumns: priceCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Quantity" required>
          <InputNumber min={1} value={item.quantity} size="small" style={{ width: "100%", borderRadius: 6 }} onChange={(v) => set("quantity", v || 1)} />
        </FormField>

        <FormField label={isSqFtMode ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber min={0} value={item.price} size="small" style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={(v) => set("price", v || 0)} />
        </FormField>

        <FormField label="GST %">
          <Select value={item.gst_percentage} size="small" style={{ width: "100%" }} onChange={(v) => set("gst_percentage", v)}>
            {GST_OPTIONS.map(g => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
          </Select>
        </FormField>
      </div>

      {/* Design File */}
      <div style={{ marginBottom: 10 }}>
        <FormField label="Design File">
          <DesignFileUpload
            value={item.design_file}
            setImagePath={(path) => set("design_file", path)}
          />
        </FormField>
      </div>

      {/* Line total */}
      <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && (
            <span style={{ marginLeft: 8 }}>
              GST ({item.gst_percentage}%): <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>Item Total: ₹{lineTotal.toFixed(2)}</div>
        {isSqFtMode && item.sq_ft > 0 && (
          <div style={{ fontSize: 10, color: "#059669" }}>{item.quantity} × {item.sq_ft} ft² × ₹{item.price}</div>
        )}
        {!isSqFtMode && (item.width || item.height) && (
          <div style={{ fontSize: 10, color: "#6b7280" }}>
            Size ref: {item.width || "—"} × {item.height || "—"} {item.size_unit}
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CreateJobModal
// ════════════════════════════════════════════════════════════════════════════
const CreateJobModal = ({ open, onClose, onCreated }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const { user: adminUser }    = useSelector((state) => state.authSlice);

  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState("");
  const [formData,    setFormData]    = useState({ ...DEFAULT_FORM });
  const [cartItems,   setCartItems]   = useState([{ ...EMPTY_ITEM }]);

  const orderDate  = dayjs();
  const validUntil = dayjs().add(30, "day");

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM });
    setCartItems([{ ...EMPTY_ITEM }]);
    setFormError("");
  };

  useEffect(() => { if (open) resetForm(); }, [open]);

  const handleInput = (k, v) => setFormData(p => ({ ...p, [k]: v }));
  const handleItem  = (i, u) => setCartItems(p => p.map((it, j) => j === i ? u : it));
  const addItem     = () => setCartItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem  = (i) => setCartItems(p => p.filter((_, j) => j !== i));

  const calcTotals = useCallback(() => {
    let subTotal = 0, totalGst = 0;
    cartItems.forEach(it => {
      const { base, gstAmt } = computeLineTotal(it);
      subTotal += base;
      totalGst += gstAmt;
    });
    const discPct    = parseFloat(formData.discount_percentage) || 0;
    const discAmt    = subTotal * (discPct / 100);
    const afterDisc  = subTotal - discAmt;
    const del        = formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0;
    const grandTotal = afterDisc + totalGst + del;
    const paid       = parseFloat(formData.payment_amount) || 0;
    const balance    = grandTotal - paid;
    return { subTotal, totalGst, discAmt, afterDisc, del, grandTotal, paid, balance };
  }, [cartItems, formData]);

  const handleSubmit = async () => {
    setFormLoading(true);
    setFormError("");
    try {
      if (!formData.customer_name.trim())    throw new Error("Customer name is required");
      if (!formData.customer_phone.trim())   throw new Error("Phone number is required");
      if (!formData.estimated_delivery_date) throw new Error("Estimated delivery date is required");

      const valid = cartItems.filter(it => {
        if (!it.product_name || !it.quantity_type) return false;
        if (it.quantity_type === "sq.ft" && (it.sq_ft || 0) <= 0) return false;
        return (it.quantity || 0) > 0 && (it.price || 0) > 0;
      });
      if (!valid.length) throw new Error("Add at least one valid product with size/qty and price");

      const t = calcTotals();

      const payload = {
        order_date:              orderDate.toISOString(),
        valid_until:             validUntil.toISOString(),
        estimated_delivery_date: dayjs(formData.estimated_delivery_date).toISOString(),

        customer_name:  formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        company_name:   (formData.company_name || "").trim(),

        delivery_address: {
          street:  [formData.address_line1, formData.address_line2].filter(Boolean).join(", "),
          city:    formData.city,
          state:   formData.state,
          pincode: formData.pincode,
          country: formData.country,
        },

        cart_items: valid.map(it => {
          const { base, gstAmt, total } = computeLineTotal(it);
          return {
            product_id:     it.product_id || "",
            product_name:   it.product_name,
            variation:      it.variation || "",
            printing_type:  it.printing_type || "",
            quantity:       it.quantity,
            quantity_type:  it.quantity_type,
            price:          it.price,
            gst_percentage: it.gst_percentage || 0,
            gst_amount:     parseFloat(gstAmt.toFixed(2)),
            line_base:      parseFloat(base.toFixed(2)),
            line_total:     parseFloat(total.toFixed(2)),
            design_file:    it.design_file || "",
            notes:          it.notes || "",
            width:          it.quantity_type === "sq.ft" ? it.width : "",
            height:         it.quantity_type === "sq.ft" ? it.height : "",
            size_unit:      it.quantity_type === "quantity" ? "pcs" : it.size_unit,
            sq_ft:          it.quantity_type === "sq.ft" ? it.sq_ft : 0,
            sq_ft_manual:   it.sq_ft_manual || false,
            size:           it.quantity_type === "sq.ft" && it.width && it.height
              ? `${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)`
              : "",
          };
        }),

        gst_no: formData.gst_no.trim(),

        subtotal:            parseFloat(t.subTotal.toFixed(2)),
        discount_amount:     parseFloat(t.discAmt.toFixed(2)),
        taxable_amount:      parseFloat(t.afterDisc.toFixed(2)),
        tax_amount:          parseFloat(t.totalGst.toFixed(2)),
        delivery_charges:    formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0,
        free_delivery:       formData.free_delivery,
        discount_percentage: parseFloat(formData.discount_percentage || 0),
        total_amount:        parseFloat(t.grandTotal.toFixed(2)),

        payment_mode:   formData.payment_mode || "",
        payment_amount: parseFloat(formData.payment_amount) || 0,
        balance_amount: parseFloat(t.balance.toFixed(2)),

        // ── New fields sent to API ──
        notes:                formData.notes.trim(),
        terms_and_conditions: formData.terms_and_conditions.trim(),

        created_by:          adminUser?.name || "Admin",
        created_by_admin_id: adminUser?._id ?? null,
        job_status:          "draft",
      };

      const res  = await fetch("https://api.dmedia.in/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create job");

      const createdJob = data.job || data.data;
      SUCCESS_NOTIFICATION({
        message: createdJob?.job_no
          ? `Job ${createdJob.job_no} created successfully!`
          : "Job created successfully!",
      });

      onClose();
      onCreated?.();
    } catch (err) {
      setFormError(err.message || "Failed to create job");
    } finally {
      setFormLoading(false);
    }
  };

  const totals = calcTotals();
  const g  = isMobile ? 8 : 12;
  const c2 = isMobile ? "1fr" : "1fr 1fr";
  const c3 = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const c4 = isMobile ? "1fr 1fr" : "repeat(4,1fr)";

  const modalWidth      = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw,900px)";
  const mobileFullStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const minDateVal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); resetForm(); }}
      footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextOutlined style={{ color: "#2563eb" }} />
          <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>Create New Job</span>
          <Tag color="blue" style={{ fontFamily: "monospace", marginLeft: 4 }}>New Job</Tag>
        </div>
      }
      width={modalWidth}
      style={mobileFullStyle}
      styles={{
        body: { maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh", overflowY: "auto", padding: isMobile ? 10 : 16 },
        header: { padding: `${isMobile ? 10 : 14}px ${isMobile ? 12 : 16}px`, borderBottom: "1px solid #f0f0f0" },
      }}
      destroyOnClose
    >
      <Spin spinning={formLoading}>

        {/* Order info banner */}
        <div style={{ background: "linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? "10px 12px" : "10px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 16, alignItems: "center" }}>
          <InfoBadge label="Order Date"  value={orderDate.format("DD MMM YYYY")} />
          <InfoBadge label="Valid Until" value={validUntil.format("DD MMM YYYY")} green sub="30 days" />
          {adminUser?.name && <InfoBadge label="Created By" value={adminUser.name} />}
        </div>

        {/* Error */}
        {formError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            ⚠ {formError}
          </div>
        )}

        {/* ── Customer Info ── */}
        <SectionHeader icon={<UserOutlined />} title="Customer Info" />
        <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: g }}>
          <FormField label="Customer Name" required>
            <Input
              prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Full name"
              value={formData.customer_name}
              onChange={(e) => handleInput("customer_name", e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </FormField>

          <FormField label="Phone" required>
            <Input
              prefix={<PhoneOutlined style={{ color: "#9ca3af" }} />}
              placeholder="10-digit mobile"
              value={formData.customer_phone}
              maxLength={10}
              onChange={(e) => handleInput("customer_phone", e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </FormField>

          <FormField label="Est. Delivery Date" required>
            <input
              type="datetime-local"
              min={minDateVal}
              value={formData.estimated_delivery_date}
              onChange={(e) => handleInput("estimated_delivery_date", e.target.value)}
              style={{
                width: "100%", height: 32, padding: "0 11px",
                border: "1px solid #d9d9d9", borderRadius: 8,
                fontSize: 14, color: "#374151", background: "#fff",
                outline: "none", boxSizing: "border-box", cursor: "pointer",
              }}
              onFocus={e  => { e.target.style.borderColor = "#2563eb"; e.target.style.boxShadow = "0 0 0 2px rgba(37,99,235,0.1)"; }}
              onBlur={e   => { e.target.style.borderColor = "#d9d9d9"; e.target.style.boxShadow = "none"; }}
            />
          </FormField>
        </div>

        {/* Company Name + GST Number */}
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
          <FormField label="Company Name">
            <Input
              prefix={<BankOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Company / Business name"
              value={formData.company_name}
              onChange={(e) => handleInput("company_name", e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </FormField>
          <FormField label="GST Number">
            <Input
              placeholder="GSTIN (15 chars)"
              maxLength={15}
              value={formData.gst_no}
              onChange={(e) => handleInput("gst_no", e.target.value.toUpperCase())}
              style={{ borderRadius: 8 }}
            />
          </FormField>
        </div>

        {/* ── Delivery Address ── */}
        <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
        <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g }}>
            <FormField label="Address Line 1">
              <Input placeholder="Flat / Door No, Building" value={formData.address_line1}
                onChange={(e) => handleInput("address_line1", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
            <FormField label="Address Line 2">
              <Input placeholder="Street, Area, Landmark" value={formData.address_line2}
                onChange={(e) => handleInput("address_line2", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: c4, gap: g }}>
            {[["city","City","City"],["state","State","State"],["pincode","Pincode","6-digit"],["country","Country","Country"]].map(([k,label,ph]) => (
              <FormField key={k} label={label}>
                <Input placeholder={ph} value={formData[k]} onChange={(e) => handleInput(k, e.target.value)} style={{ borderRadius: 8 }} />
              </FormField>
            ))}
          </div>
        </div>

        {/* ── Job Items ── */}
        <SectionHeader icon={<ShoppingCartOutlined />} title="Job Items" />
        <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
          {cartItems.map((item, idx) => (
            <ProductItemRow key={idx} item={item} idx={idx} onChange={handleItem} onRemove={removeItem} isOnly={cartItems.length === 1} />
          ))}
          <Button icon={<PlusOutlined />} onClick={addItem} style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 40 }}>
            Add Item
          </Button>
        </div>

        {/* ── Payment ── */}
        <SectionHeader icon={<WalletOutlined />} title="Payment" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: g, marginBottom: 14 }}>
          <FormField label="Payment Mode">
            <Select placeholder="Select mode" value={formData.payment_mode || undefined} style={{ width: "100%" }} allowClear onChange={(v) => handleInput("payment_mode", v ?? "")}>
              {PAYMENT_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </FormField>
          <FormField label="Amount Paid (₹)">
            <InputNumber min={0} placeholder="0.00" value={formData.payment_amount || undefined} style={{ width: "100%", borderRadius: 8 }} prefix="₹" onChange={(v) => handleInput("payment_amount", v ?? "")} />
          </FormField>
          <FormField label="Delivery Charges (₹)">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <InputNumber
                min={0} placeholder="0.00"
                value={formData.free_delivery ? 0 : (formData.delivery_charges || undefined)}
                disabled={formData.free_delivery}
                style={{ flex: 1, borderRadius: 8 }} prefix="₹"
                onChange={(v) => handleInput("delivery_charges", v ?? 0)}
              />
              <Button
                size="small"
                type={formData.free_delivery ? "primary" : "default"}
                onClick={() => handleInput("free_delivery", !formData.free_delivery)}
                style={{ borderRadius: 6, fontSize: 11, height: 32, padding: "0 8px", background: formData.free_delivery ? "#059669" : undefined, borderColor: formData.free_delivery ? "#059669" : undefined, color: formData.free_delivery ? "#fff" : undefined, whiteSpace: "nowrap" }}
              >
                {formData.free_delivery ? "🎉 Free" : "Free?"}
              </Button>
            </div>
          </FormField>
        </div>

        {/* ── Notes & Terms ── */}
        <SectionHeader icon={<FileTextOutlined />} title="Notes " />
        <div style={{ display: "grid",  marginBottom: 14 }}>
          <FormField label="Notes">
            <TextArea
              rows={3}
              placeholder="Additional notes, special instructions…"
              value={formData.notes}
              onChange={(e) => handleInput("notes", e.target.value)}
              style={{ borderRadius: 8, resize: "vertical" }}
            />
          </FormField>
          {/* <FormField label="Terms & Conditions">
            <TextArea
              rows={3}
              placeholder="Payment terms, delivery conditions…"
              value={formData.terms_and_conditions}
              onChange={(e) => handleInput("terms_and_conditions", e.target.value)}
              style={{ borderRadius: 8, resize: "vertical" }}
            />
          </FormField> */}
        </div>

        {/* ── Order Summary ── */}
        <div style={{ background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border: "1px solid #bfdbfe", borderRadius: 10, padding: isMobile ? 12 : "14px 16px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "#1e40af", marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <FileTextOutlined /> Order Summary
          </div>
          {[
            { label: "Subtotal (before GST & discount)", value: `₹${totals.subTotal.toFixed(2)}` },
            ...(totals.discAmt > 0 ? [{ label: `Discount (${formData.discount_percentage}%)`, value: `− ₹${totals.discAmt.toFixed(2)}`, color: "#059669" }] : []),
            { label: "Total GST (per item)", value: `₹${totals.totalGst.toFixed(2)}`, color: "#d97706" },
            { label: "Delivery Charges", value: formData.free_delivery ? "Free 🎉" : `₹${totals.del.toFixed(2)}`, color: formData.free_delivery ? "#059669" : undefined },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: color || "#4b5563", marginBottom: 4 }}>
              <span>{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: isMobile ? 14 : 15, fontWeight: 800, marginBottom: 6 }}>
            <span style={{ color: "#1a1a2e" }}>Grand Total</span>
            <span style={{ color: "#2563eb" }}>₹{totals.grandTotal.toFixed(2)}</span>
          </div>
          {(totals.paid > 0 || formData.payment_mode) && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#059669", marginBottom: 4 }}>
              <span>Amount Paid {formData.payment_mode ? `(${formData.payment_mode})` : ""}</span>
              <span style={{ fontWeight: 700 }}>− ₹{totals.paid.toFixed(2)}</span>
            </div>
          )}
          {(totals.paid > 0 || formData.payment_mode) && (
            <>
              <Divider style={{ margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: isMobile ? 14 : 15, fontWeight: 800 }}>
                <span style={{ color: "#1a1a2e" }}>Balance Due</span>
                <span style={{ color: totals.balance <= 0 ? "#059669" : "#dc2626", background: totals.balance <= 0 ? "#f0fdf4" : "#fef2f2", padding: "2px 10px", borderRadius: 6 }}>
                  {totals.balance <= 0 ? `✓ Paid (Advance ₹${Math.abs(totals.balance).toFixed(2)})` : `₹${totals.balance.toFixed(2)}`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={() => { onClose(); resetForm(); }} style={{ borderRadius: 8, height: 40, flex: isMobile ? 1 : undefined }}>
            Cancel
          </Button>
          <Button
            type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={formLoading}
            style={{ background: "#2563eb", border: "none", borderRadius: 8, height: 40, fontWeight: 600, flex: isMobile ? 1 : undefined }}
          >
            Create Job
          </Button>
        </div>

      </Spin>
    </Modal>
  );
};

export default CreateJobModal;