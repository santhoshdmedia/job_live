import { useEffect, useState, useCallback, useRef } from "react";
import { uploadImage } from "../api";
import {
  Button, Tag, Modal, Input, Spin, Empty, Tooltip, Divider,
  message, Popconfirm, Table, Space, Select, DatePicker,
  InputNumber, Radio, Drawer, Alert,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, EyeOutlined, UserOutlined, PhoneOutlined,
  ReloadOutlined, PauseCircleOutlined, HistoryOutlined, TeamOutlined,
  DeleteOutlined, LoadingOutlined, EnvironmentOutlined, CameraOutlined,
  PlusOutlined, CarOutlined, CheckSquareOutlined, FormOutlined,
  RocketOutlined, CompassOutlined, StarOutlined, FileTextOutlined,
  FieldTimeOutlined, BankOutlined, UploadOutlined, SaveOutlined,
  WalletOutlined, ShoppingCartOutlined, AimOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtSecs = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const profile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const BASE      = "https://api.dmedia.in/api/jobs";
const STAGE_KEY = "site_visit";
const STAGE_LBL = "Site Visit";

// ✅ FIX: job_status for site-visit jobs is "site_visit", not "draft"
const SITE_VISIT_JOB_STATUS = "site_visit";

const VISIT_STATUS = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  on_hold:     { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  completed:   { label: "Completed",   color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  converted:   { label: "Converted",   color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  cancelled:   { label: "Cancelled",   color: "#6b7280", bg: "#f9fafb", border: "#d1d5db" },
};

const SITE_TYPES = [
  "Outdoor Signage", "Indoor Signage", "Hoarding / Billboard",
  "Vehicle Wrap", "Event Branding", "Retail Branding",
  "Office Branding", "Exhibition / Stall", "Other",
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Cash on Delivery"];

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

const UNIT_OPTIONS     = [{ value: "ft", label: "ft" }, { value: "inch", label: "inch" }, { value: "cm", label: "cm" }];
const QTY_TYPE_OPTIONS = [{ value: "sq.ft", label: "Sq. Ft" }, { value: "quantity", label: "Quantity" }];
const GST_OPTIONS      = [0, 5, 12, 18, 28];

const { Option }   = Select;
const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────
const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w) || 0, hn = parseFloat(h) || 0;
  if (!wn || !hn) return 0;
  if (unit === "ft")   return wn * hn;
  if (unit === "inch") return (wn / 12) * (hn / 12);
  if (unit === "cm")   return (wn / 30.48) * (hn / 30.48);
  return wn * hn;
};

const computeLineTotal = (item) => {
  const base =
    item.quantity_type === "sq.ft"
      ? (item.quantity || 0) * (item.sq_ft || 0) * (item.price || 0)
      : (item.quantity || 0) * (item.price || 0);
  const gstAmt = base * ((item.gst_percentage || 0) / 100);
  return { base, gstAmt, total: base + gstAmt };
};

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint hook
// ─────────────────────────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => { const w = window.innerWidth; return w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"; };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const fn = () => setBp(get());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Image compression
// ─────────────────────────────────────────────────────────────────────────────
const MAX_COMPRESSED_BYTES = 500 * 1024;
const MAX_DIMENSION        = 2400;

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload  = (evt) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload  = () => {
        const scale = img.width > MAX_DIMENSION || img.height > MAX_DIMENSION
          ? MAX_DIMENSION / Math.max(img.width, img.height) : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const tryQ = (quality) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("canvas.toBlob failed")); return; }
            if (blob.size <= MAX_COMPRESSED_BYTES || quality <= 0.1) {
              resolve({
                file: new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }),
                previewUrl: URL.createObjectURL(blob),
                originalSizeKB:   Math.round(file.size  / 1024),
                compressedSizeKB: Math.round(blob.size  / 1024),
              });
            } else { tryQ(Math.max(quality - 0.1, 0.1)); }
          }, "image/jpeg", quality);
        };
        tryQ(0.85);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

const compressDesignFile = (file, maxKB = 500) =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size <= maxKB * 1024) { resolve(file); return; }
    const blobUrl = URL.createObjectURL(file);
    const img     = new Image();
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.onload  = () => {
      URL.revokeObjectURL(blobUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = (maxKB * 1024) / file.size;
      if (ratio < 0.9) { const s = Math.sqrt(ratio); w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s)); }
      const canvas  = document.createElement("canvas");
      canvas.width  = w; canvas.height = h;
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

// ─────────────────────────────────────────────────────────────────────────────
// GPS helper
// ─────────────────────────────────────────────────────────────────────────────
const getGPSLocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

const uploadFileToServer = async (file) => {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const result = await uploadImage(formData);
  const url = result?.data?.data?.url || result?.data?.url || "";
  if (!url) throw new Error("Upload succeeded but no URL returned");
  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable UI atoms
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
    <span style={{ color: "#0369a1", fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 6 }} />
  </div>
);

const FormField = ({ label, required, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

const InfoBadge = ({ label, value, green }) => (
  <div style={{ flex: 1, minWidth: 90 }}>
    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: green ? "#059669" : "#374151" }}>{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GPS Tag display
// ─────────────────────────────────────────────────────────────────────────────
const GPSTag = ({ gps }) => {
  if (!gps?.lat) return null;
  return (
    <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: "#0369a1", fontWeight: 700,
        background: "#eff6ff", padding: "1px 6px", borderRadius: 4, border: "1px solid #bae6fd", textDecoration: "none" }}>
      <AimOutlined />
      {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
      {gps.accuracy && <span style={{ color: "#6b7280" }}> ±{Math.round(gps.accuracy)}m</span>}
    </a>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Site Photo Upload
// ─────────────────────────────────────────────────────────────────────────────
const SitePhotoUploadField = ({ photos, setPhotos }) => {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  const processFiles = async (files, fromCamera = false) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    setProcessing(true);
    const gps = fromCamera ? await getGPSLocation() : null;
    const newItems = [];
    for (const file of imageFiles) {
      const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        const { file: compressed, previewUrl, originalSizeKB, compressedSizeKB } = await compressImage(file);
        newItems.push({ id, file: compressed, previewUrl, name: file.name, originalSizeKB, compressedSizeKB, gps });
      } catch {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({ id, file, previewUrl, name: file.name, originalSizeKB: Math.round(file.size / 1024), compressedSizeKB: Math.round(file.size / 1024), gps });
      }
    }
    setPhotos((prev) => [...prev, ...newItems]);
    setProcessing(false);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  return (
    <div>
      <input ref={fileInputRef}   type="file" multiple accept="image/*" style={{ display: "none" }}
        onChange={(e) => { processFiles(e.target.files, false); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { processFiles(e.target.files, true); e.target.value = ""; }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <Button size="small" icon={<UploadOutlined />} loading={processing}
          onClick={() => fileInputRef.current?.click()} style={{ borderRadius: 6, fontSize: 12 }}>
          {processing ? "Compressing…" : photos.length > 0 ? "Add More" : "Upload Photos"}
        </Button>
        {!processing && (
          <Button size="small" icon={<CameraOutlined />} onClick={() => cameraInputRef.current?.click()}
            style={{ borderRadius: 6, fontSize: 12 }}>Camera</Button>
        )}
        {photos.length > 0 && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>{photos.length} photo{photos.length !== 1 ? "s" : ""} ready</span>
        )}
      </div>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {photos.map((photo) => (
            <div key={photo.id} style={{ borderRadius: 8, overflow: "visible", border: "1px solid #e5e7eb" }}>
              <div style={{ position: "relative", aspectRatio: "1", borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
                <img src={photo.previewUrl} alt={photo.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(photo.id)}
                  style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <DeleteOutlined style={{ color: "#fff", fontSize: 9 }} />
                </button>
                <div style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(0,0,0,0.55)",
                  borderRadius: 3, padding: "1px 3px", fontSize: 9, color: "#fff", fontWeight: 600 }}>
                  {photo.compressedSizeKB}KB
                </div>
              </div>
              {photo.gps?.lat && (
                <div style={{ padding: "3px 4px", background: "#f0f9ff", borderTop: "1px solid #e5e7eb", borderRadius: "0 0 7px 7px" }}>
                  <GPSTag gps={photo.gps} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Design File Upload
// ─────────────────────────────────────────────────────────────────────────────
const DesignFileUpload = ({ value, setImagePath }) => {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [origSize, setOrigSize] = useState(null);
  const [compSize, setCompSize] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(""); setOrigSize((file.size / 1024).toFixed(0)); setBusy(true);
    try {
      const compressed = await compressDesignFile(file, 500);
      setCompSize((compressed.size / 1024).toFixed(0));
      const reader    = new FileReader();
      reader.onload   = (e) => { setImagePath(e.target.result); setBusy(false); };
      reader.onerror  = () => { setError("Failed to read file."); setBusy(false); };
      reader.readAsDataURL(compressed);
    } catch { setError("Compression failed."); setBusy(false); }
  };

  const handleClear = () => {
    setImagePath(""); setOrigSize(null); setCompSize(null); setError("");
    if (fileInputRef.current)   fileInputRef.current.value   = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const fmtKB = (kb) => kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

  return (
    <div>
      <input ref={fileInputRef}   type="file" accept="image/*,application/pdf" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button size="small" icon={<UploadOutlined />} loading={busy}
          onClick={() => fileInputRef.current?.click()} style={{ borderRadius: 6, fontSize: 12 }}>
          {busy ? "Compressing…" : value ? "Change File" : "Upload Design"}
        </Button>
        {!busy && (
          <Button size="small" icon={<CameraOutlined />} onClick={() => cameraInputRef.current?.click()}
            style={{ borderRadius: 6, fontSize: 12 }}>Camera</Button>
        )}
        {value && !busy && (
          <Button size="small" danger type="text" icon={<CloseCircleOutlined />}
            onClick={handleClear} style={{ fontSize: 12 }}>Remove</Button>
        )}
      </div>
      {!busy && origSize && compSize && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#059669", fontWeight: 600 }}>
          ✅ {fmtKB(origSize)} → {fmtKB(compSize)}{compSize <= 500 ? " (≤500KB ✓)" : " ⚠ Still large"}
        </div>
      )}
      {busy  && <div style={{ marginTop: 4, fontSize: 10, color: "#2563eb", fontWeight: 600 }}>⏳ Compressing…</div>}
      {error && <div style={{ marginTop: 4, fontSize: 10, color: "#dc2626" }}>⚠ {error}</div>}
      {value && !busy && (
        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb",
          padding: 4, display: "flex", justifyContent: "center", maxHeight: 120, overflow: "hidden" }}>
          <img src={value} alt="Design Preview"
            style={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY REQUIREMENT
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_REQUIREMENT = {
  product_id:    "",
  product_name:  "",
  variation:     "",
  printing_type: "",
  width:         "",
  height:        "",
  size_unit:     "inch",
  sq_ft:         0,
  sq_ft_manual:  false,
  quantity_type: "sq.ft",
  quantity:      1,
  price:         0,
  gst_percentage:0,
  design_file:   "",
  notes:         "",
};

// ─────────────────────────────────────────────────────────────────────────────
// RequirementRow
// ─────────────────────────────────────────────────────────────────────────────
const RequirementRow = ({ item, index, onChange, onRemove, isOnly }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);

  const set = (field, value) => onChange(index, { ...item, [field]: value });

  const matched  = item.product_name
    ? PRODUCTS.filter((p) => p.product_name.toLowerCase().includes(item.product_name.toLowerCase()))
    : [];
  const selected = PRODUCTS.find(
    (p) => p.product_name.toLowerCase() === (item.product_name || "").toLowerCase(),
  );

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sizeChange = (field, val) => {
    const updated = { ...item, [field]: val };
    if (!updated.sq_ft_manual) {
      updated.sq_ft = parseFloat(toSqFt(updated.width, updated.height, updated.size_unit).toFixed(4));
    }
    onChange(index, updated);
  };

  const handleQtyTypeChange = (val) => {
    onChange(index, {
      ...item,
      quantity_type: val,
      ...(val === "quantity" ? { sq_ft: 0, sq_ft_manual: false, width: "", height: "" } : {}),
    });
  };

  const isSqFtMode = item.quantity_type === "sq.ft";
  const { base, gstAmt, total: lineTotal } = computeLineTotal(item);

  const productCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const sqFtCols    = isMobile ? "1fr 1fr" : "1fr 1fr 90px 1fr";
  const priceCols   = isMobile ? "1fr 1fr" : "repeat(3,1fr)";

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: isMobile ? 10 : 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151",
            background: "#e0e7ff", padding: "2px 10px", borderRadius: 20 }}>
            Item {index + 1}
          </span>
          <Radio.Group size="small" value={item.quantity_type} onChange={(e) => handleQtyTypeChange(e.target.value)} buttonStyle="solid">
            {QTY_TYPE_OPTIONS.map((o) => (
              <Radio.Button key={o.value} value={o.value}
                style={{ fontSize: 11, fontWeight: 600, height: 24, lineHeight: "22px", padding: "0 10px" }}>
                {o.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <Popconfirm title="Remove this item?" onConfirm={() => onRemove(index)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: productCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Product Name" required>
          <div style={{ position: "relative" }} ref={ref}>
            <Input placeholder="Type product…" value={item.product_name} size="small" autoComplete="off"
              style={{ borderRadius: 6 }}
              onChange={(e) => { onChange(index, { ...item, product_name: e.target.value, variation: "", printing_type: "" }); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)} />
            {showSuggest && matched.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 9999,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                {matched.map((p) => (
                  <div key={p.product_id}
                    onMouseDown={() => { onChange(index, { ...item, product_name: p.product_name, product_id: p.product_id, variation: "", printing_type: "" }); setShowSuggest(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#1a1a2e",
                      fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
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
        <FormField label="Material / Variation">
          <Select placeholder={selected ? "Select variation" : "—"} value={item.variation || undefined}
            size="small" style={{ width: "100%" }} disabled={!selected} onChange={(v) => set("variation", v)}>
            {(selected?.variations || []).map((v) => <Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>
        <FormField label="Printing Type">
          <Select placeholder={selected ? "Select type" : "—"} value={item.printing_type || undefined}
            size="small" style={{ width: "100%" }} disabled={!selected} onChange={(v) => set("printing_type", v)}>
            {(selected?.printing_type || []).map((t) => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>

      {isSqFtMode && (
        <div style={{ display: "grid", gridTemplateColumns: sqFtCols, gap: 8, marginBottom: 10, alignItems: "end" }}>
          <FormField label="Width" required>
            <Input size="small" placeholder="0" type="number" min={0} value={item.width}
              prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>W</span>}
              style={{ borderRadius: 6 }} onChange={(e) => sizeChange("width", e.target.value)} />
          </FormField>
          <FormField label="Height" required>
            <Input size="small" placeholder="0" type="number" min={0} value={item.height}
              prefix={<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>H</span>}
              style={{ borderRadius: 6 }} onChange={(e) => sizeChange("height", e.target.value)} />
          </FormField>
          <FormField label="Unit">
            <Select value={item.size_unit} size="small" style={{ width: "100%" }}
              onChange={(v) => sizeChange("size_unit", v)}>
              {UNIT_OPTIONS.map((u) => <Option key={u.value} value={u.value}>{u.label}</Option>)}
            </Select>
          </FormField>
          <FormField label={
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Sq. Ft
              {item.sq_ft_manual && (item.width || item.height) && (
                <span onClick={() => onChange(index, { ...item, sq_ft: parseFloat(toSqFt(item.width, item.height, item.size_unit).toFixed(4)), sq_ft_manual: false })}
                  style={{ fontSize: 9, color: "#2563eb", cursor: "pointer", background: "#eff6ff", padding: "1px 5px", borderRadius: 4 }}>
                  ↺ auto
                </span>
              )}
              {!item.sq_ft_manual && <span style={{ fontSize: 9, color: "#6b7280" }}>(auto)</span>}
            </span>
          }>
            <InputNumber size="small" min={0} step={0.01} value={item.sq_ft || undefined} placeholder="0.0000"
              style={{ width: "100%", borderRadius: 6, borderColor: item.sq_ft_manual ? "#2563eb" : undefined,
                background: item.sq_ft > 0 ? (item.sq_ft_manual ? "#eff6ff" : "#ecfdf5") : undefined }}
              onChange={(val) => onChange(index, { ...item, sq_ft: parseFloat(val) || 0, sq_ft_manual: true })} />
          </FormField>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <FormField label="Notes / Specs">
          <Input placeholder="Custom text, specs…" value={item.notes} size="small"
            style={{ borderRadius: 6 }} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: priceCols, gap: 8, marginBottom: 10 }}>
        <FormField label="Quantity" required>
          <InputNumber min={1} value={item.quantity} size="small"
            style={{ width: "100%", borderRadius: 6 }} onChange={(v) => set("quantity", v || 1)} />
        </FormField>
        <FormField label={isSqFtMode ? "Price / sq.ft (₹)" : "Unit Price (₹)"} required>
          <InputNumber min={0} value={item.price} size="small"
            style={{ width: "100%", borderRadius: 6 }} prefix="₹" onChange={(v) => set("price", v || 0)} />
        </FormField>
        <FormField label="GST %">
          <Select value={item.gst_percentage} size="small" style={{ width: "100%" }}
            onChange={(v) => set("gst_percentage", v)}>
            {GST_OPTIONS.map((g) => <Option key={g} value={g}>{g === 0 ? "No GST" : `${g}%`}</Option>)}
          </Select>
        </FormField>
      </div>

      <div style={{ marginBottom: 10 }}>
        <FormField label="Design File">
          <DesignFileUpload value={item.design_file} setImagePath={(path) => set("design_file", path)} />
        </FormField>
      </div>

      <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
          Base: <span style={{ fontWeight: 600, color: "#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage > 0 && (
            <span style={{ marginLeft: 8 }}>GST ({item.gst_percentage}%):{" "}
              <span style={{ fontWeight: 600, color: "#d97706" }}>₹{gstAmt.toFixed(2)}</span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>Item Total: ₹{lineTotal.toFixed(2)}</div>
        {isSqFtMode && item.sq_ft > 0 && (
          <div style={{ fontSize: 10, color: "#059669" }}>{item.quantity} × {item.sq_ft} ft² × ₹{item.price}</div>
        )}
        {!isSqFtMode && <div style={{ fontSize: 10, color: "#6b7280" }}>{item.quantity} × ₹{item.price}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────
const VisitStatusBadge = ({ status }) => {
  const s = VISIT_STATUS[status] || VISIT_STATUS.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
      borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily Summary Bar
// ─────────────────────────────────────────────────────────────────────────────
const DailySummaryBar = ({ dailySummary = [], totalSecs = 0, workedDays = 0 }) => {
  if (!dailySummary.length) return null;
  const maxSecs = Math.max(...dailySummary.map((d) => d.seconds), 1);
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span><HistoryOutlined style={{ marginRight: 4 }} />Visit History ({workedDays} day{workedDays !== 1 ? "s" : ""})</span>
        <span style={{ color: "#166534" }}>Total: {fmtSecs(totalSecs)}</span>
      </div>
      {dailySummary.map((day, i) => {
        const pct = Math.round((day.seconds / maxSecs) * 100);
        return (
          <div key={day.date} style={{ marginBottom: i < dailySummary.length - 1 ? 6 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#374151", marginBottom: 2, fontWeight: 600 }}>
              <span>Day {i + 1} — {dayjs(day.date).format("DD MMM")}</span>
              <span style={{ color: "#15803d" }}>{day.display}</span>
            </div>
            <div style={{ height: 6, background: "#dcfce7", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)",
                borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Convert to Job Panel
// ─────────────────────────────────────────────────────────────────────────────
const ConvertToJobPanel = ({ requirements = [], onConvert, loading }) => (
  <div style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", border: "2px solid #c4b5fd",
    borderRadius: 14, padding: "16px 18px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <RocketOutlined style={{ color: "#fff", fontSize: 17 }} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>Convert to Production Job</div>
        <div style={{ fontSize: 11, color: "#7c3aed" }}>This pick up will be linked to a new job order</div>
      </div>
    </div>
    {requirements.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 6 }}>Requirements Summary</div>
        {requirements.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151",
            padding: "3px 0", borderBottom: i < requirements.length - 1 ? "1px dashed #e9d5ff" : undefined }}>
            <span><strong>{r.product_name || "—"}</strong>{r.variation && ` · ${r.variation}`}</span>
            <span style={{ color: "#7c3aed", fontWeight: 700 }}>Qty: {r.quantity || 1}</span>
          </div>
        ))}
      </div>
    )}
    <Popconfirm
      title={<div><div style={{ fontWeight: 700 }}>Convert this pick up to a job?</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>A new job order will be created and linked to this visit.</div></div>}
      onConfirm={onConvert} okText="Yes, Convert"
      okButtonProps={{ style: { background: "#7c3aed", border: "none" } }} cancelText="Cancel">
      <Button type="primary" icon={<RocketOutlined />} loading={loading} block
        style={{ height: 40, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none",
          borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        Convert to Job Order
      </Button>
    </Popconfirm>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT FORM STATE
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_VISIT_FORM = {
  customer_name:           "",
  customer_phone:          "",
  company_name:            "",
  gst_no:                  "",
  visit_date:              null,
  estimated_delivery_date: null,
  address_line1:           "",
  address_line2:           "",
  city:                    "",
  state:                   "",
  pincode:                 "",
  country:                 "India",
  site_type:               "",
  visited_by:              "",
  visit_purpose:           "",
  notes:                   "",
  discount_percentage:     0,
  delivery_charges:        0,
  free_delivery:           false,
  payment_mode:            "",
  payment_amount:          "",
};

// ═════════════════════════════════════════════════════════════════════════════
// NEW SITE VISIT MODAL
// ═════════════════════════════════════════════════════════════════════════════
const NewSiteVisitModal = ({ open, onClose, onSuccess, userId, userName }) => {
  const { isMobile, isTablet } = useBreakpoint();

  const [formData,     setFormData]     = useState({ ...DEFAULT_VISIT_FORM });
  const [requirements, setRequirements] = useState([{ ...EMPTY_REQUIREMENT }]);
  const [sitePhotos,   setSitePhotos]   = useState([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState("");

  const resetForm = () => {
    setFormData({ ...DEFAULT_VISIT_FORM, visit_date: dayjs() });
    setRequirements([{ ...EMPTY_REQUIREMENT }]);
    setSitePhotos([]);
    setFormError("");
  };

  useEffect(() => { if (open) resetForm(); }, [open]);

  const handleInput = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const addRequirement    = () => setRequirements((p) => [...p, { ...EMPTY_REQUIREMENT }]);
  const removeRequirement = (idx) => setRequirements((p) => p.filter((_, i) => i !== idx));
  const changeRequirement = (idx, updatedItem) => setRequirements((p) => p.map((r, i) => i === idx ? updatedItem : r));

  const calcTotals = useCallback(() => {
    let subTotal = 0, totalGst = 0;
    requirements.forEach((item) => { const { base, gstAmt } = computeLineTotal(item); subTotal += base; totalGst += gstAmt; });
    const discPct    = parseFloat(formData.discount_percentage) || 0;
    const discAmt    = subTotal * (discPct / 100);
    const afterDisc  = subTotal - discAmt;
    const del        = formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0;
    const grandTotal = afterDisc + totalGst + del;
    const paid       = parseFloat(formData.payment_amount) || 0;
    const balance    = grandTotal - paid;
    return { subTotal, totalGst, discAmt, afterDisc, del, grandTotal, paid, balance };
  }, [requirements, formData]);

  const handleSubmit = async () => {
    setSubmitting(true); setFormError("");
    try {
      if (!formData.customer_name.trim())        throw new Error("Customer name is required");
      if (!formData.customer_phone.trim())        throw new Error("Phone number is required");
      if (!formData.address_line1.trim())         throw new Error("Site address (line 1) is required");
      if (!formData.estimated_delivery_date)      throw new Error("Estimated delivery date is required");

      const uploadedPhotos = [];
      for (const photo of sitePhotos) {
        try {
          const url = await uploadFileToServer(photo.file);
          uploadedPhotos.push({ url, gps: photo.gps || null });
        } catch { /* non-blocking */ }
      }

      const t = calcTotals();

      const cartItems = requirements
        .filter((r) => r.product_name?.trim())
        .map((r) => {
          const { base, gstAmt, total: lineTotal } = computeLineTotal(r);
          return {
            product_id:    r.product_id    || "",
            product_name:  r.product_name,
            variation:     r.variation     || "",
            printing_type: r.printing_type || "",
            quantity:      r.quantity      || 1,
            quantity_type: r.quantity_type || "sq.ft",
            price:         r.price         || 0,
            sq_ft:         r.sq_ft         || 0,
            sq_ft_manual:  r.sq_ft_manual  || false,
            width:         r.width         || "",
            height:        r.height        || "",
            size_unit:     r.size_unit     || "inch",
            gst_percentage:r.gst_percentage|| 0,
            gst_amount:    parseFloat(gstAmt.toFixed(2)),
            line_base:     parseFloat(base.toFixed(2)),
            line_total:    parseFloat(lineTotal.toFixed(2)),
            design_file:   r.design_file   || "",
            notes:         r.notes         || "",
          };
        });

      const visitDate  = formData.visit_date || dayjs();
      const validUntil = dayjs().add(30, "day");

      const siteMeta = {
        site_type:     formData.site_type,
        visited_by:    formData.visited_by || userName,
        visit_purpose: formData.visit_purpose,
        visit_date:    visitDate.toISOString(),
        estimated_delivery_date: formData.estimated_delivery_date.toISOString(),
        site_address:  [formData.address_line1, formData.address_line2, formData.city, formData.state].filter(Boolean).join(", "),
        requirements:  cartItems,
        site_photos:        uploadedPhotos.map((p) => p.url),
        site_photos_detail: uploadedPhotos,
        created_at:    new Date().toISOString(),
      };

      const payload = {
        customer_name:  formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        company_name:   formData.company_name.trim(),
        gst_no:         formData.gst_no.trim(),

        subtotal:            parseFloat(t.subTotal.toFixed(2)),
        discount_percentage: parseFloat(formData.discount_percentage || 0),
        discount_amount:     parseFloat(t.discAmt.toFixed(2)),
        taxable_amount:      parseFloat(t.afterDisc.toFixed(2)),
        tax_amount:          parseFloat(t.totalGst.toFixed(2)),
        delivery_charges:    formData.free_delivery ? 0 : parseFloat(formData.delivery_charges) || 0,
        free_delivery:       formData.free_delivery,
        total_amount:        parseFloat(t.grandTotal.toFixed(2)),
        payment_mode:        formData.payment_mode  || "",
        payment_amount:      parseFloat(formData.payment_amount) || 0,
        balance_amount:      parseFloat(t.balance.toFixed(2)),

        valid_until:             validUntil.toDate(),
        order_date:              visitDate.toDate(),
        estimated_delivery_date: formData.estimated_delivery_date.toDate(),

        cart_items:      cartItems,
        delivery_address: {
          street:  [formData.address_line1, formData.address_line2].filter(Boolean).join(", "),
          city:    formData.city,
          state:   formData.state,
          pincode: formData.pincode,
          country: formData.country,
        },

        // ✅ FIX 1: job_status must be "site_visit" so getAllJobs / getJobsAssignedToUser
        //           returns it in the site-visit dashboard filter
        job_status: SITE_VISIT_JOB_STATUS,

        notes:           formData.notes.trim(),
        site_visit_meta: JSON.stringify(siteMeta),

        created_by:          userName,
        created_by_admin_id: userId,
      };

      const res  = await fetch(BASE, { method: "POST", headers: jsonHeader(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create pick up");

      // data.job._id  (backend returns both data.job and data.data)
      const jobId = data.job?._id || data.data?._id;

      if (jobId) {
        // ✅ FIX 2: openSession sets current_stage so non-admin fetch works
        await fetch(`${BASE}/${jobId}/session/open`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({
            stage:       STAGE_KEY,
            stage_label: STAGE_LBL,
            user: { user_id: userId, name: userName, role: "pick up team" },
            notes: `Site visit initiated by ${formData.visited_by || userName}`,
          }),
        });

        // ✅ FIX 3: immediately close the auto-open so job appears as "pending"
        //            rather than "in_progress" until staff manually starts it.
        //            Remove these two lines if you want visits to start live immediately.
        await fetch(`${BASE}/${jobId}/session/close`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({ stage: STAGE_KEY, action: "on_hold", notes: "Created, awaiting field visit" }),
        });
      }

      message.success(`Site visit created! ${data.job?.job_no || data.data?.job_no || ""}`);
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.message || "Failed to create pick up");
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calcTotals();
  const g  = isMobile ? 8 : 12;
  const c2 = isMobile ? "1fr" : "1fr 1fr";
  const c3 = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const c4 = isMobile ? "1fr 1fr" : "repeat(4,1fr)";

  const modalWidth      = isMobile ? "100vw" : isTablet ? "94vw" : "min(96vw,900px)";
  const mobileFullStyle = isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0 } : {};

  return (
    <Modal open={open} onCancel={() => { onClose(); resetForm(); }} footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <EnvironmentOutlined style={{ color: "#0369a1" }} />
          <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>New Site Visit</span>
          <Tag color="blue" style={{ fontFamily: "monospace", marginLeft: 4 }}>Site Visit</Tag>
        </div>
      }
      width={modalWidth} style={mobileFullStyle}
      styles={{
        body:   { maxHeight: isMobile ? "calc(100dvh - 56px)" : "85vh", overflowY: "auto", padding: isMobile ? 10 : 16 },
        header: { padding: `${isMobile ? 10 : 14}px ${isMobile ? 12 : 16}px`, borderBottom: "1px solid #f0f0f0" },
      }}
      destroyOnClose>
      <Spin spinning={submitting}>
        <div style={{ background: "linear-gradient(135deg,#f0f9ff 0%,#f0fdf4 100%)", border: "1px solid #bae6fd",
          borderRadius: 10, padding: isMobile ? "10px 12px" : "10px 14px", marginBottom: 14,
          display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 16, alignItems: "center" }}>
          <InfoBadge label="Visit Date"
            value={(formData.visit_date || dayjs()).format("DD MMM YYYY, hh:mm A")} />
          <InfoBadge label="Est. Delivery"
            value={formData.estimated_delivery_date ? formData.estimated_delivery_date.format("DD MMM YYYY") : "—"} green />
          {userName && <InfoBadge label="Created By" value={userName} />}
        </div>

        {formError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            ⚠ {formError}
          </div>
        )}

        <SectionHeader icon={<UserOutlined />} title="Customer Info" />
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: g }}>
          <FormField label="Customer Name" required>
            <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="Full name"
              value={formData.customer_name} onChange={(e) => handleInput("customer_name", e.target.value)}
              style={{ borderRadius: 8 }} />
          </FormField>
          <FormField label="Phone" required>
            <Input prefix={<PhoneOutlined style={{ color: "#9ca3af" }} />} placeholder="10-digit mobile"
              value={formData.customer_phone} maxLength={10}
              onChange={(e) => handleInput("customer_phone", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: g }}>
          <FormField label="Visit Date & Time (auto)">
            <DatePicker showTime={{ format: "hh:mm A", use12Hours: true }} format="DD MMM YYYY  hh:mm A"
              placeholder="Visit date & time" value={formData.visit_date}
              onChange={(v) => handleInput("visit_date", v)}
              style={{ width: "100%", borderRadius: 8 }} needConfirm
              getPopupContainer={(t) => t.parentElement}
              renderExtraFooter={() => (
                <div style={{ padding: "4px 8px", fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
                  ⚡ Auto-filled with current date & time
                </div>
              )} />
          </FormField>
          <FormField label="Estimated Delivery Date & Time" required>
            <DatePicker showTime={{ format: "hh:mm A", use12Hours: true }} format="DD MMM YYYY  hh:mm A"
              placeholder="Select delivery date & time" value={formData.estimated_delivery_date}
              disabledDate={(c) => c && c < dayjs().startOf("day")}
              disabledTime={(c) => {
                if (!c || !c.isSame(dayjs(), "day")) return {};
                const now = dayjs();
                return {
                  disabledHours:   () => Array.from({ length: now.hour() },   (_, i) => i),
                  disabledMinutes: (h) => h === now.hour() ? Array.from({ length: now.minute() }, (_, i) => i) : [],
                };
              }}
              onChange={(v) => handleInput("estimated_delivery_date", v)}
              style={{ width: "100%", borderRadius: 8 }} needConfirm getPopupContainer={(t) => t.parentElement} />
          </FormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: c2, gap: g, marginBottom: 14 }}>
          <FormField label="Company Name">
            <Input prefix={<BankOutlined style={{ color: "#9ca3af" }} />} placeholder="Company / Business name"
              value={formData.company_name} onChange={(e) => handleInput("company_name", e.target.value)}
              style={{ borderRadius: 8 }} />
          </FormField>
          <FormField label="GST Number">
            <Input placeholder="GSTIN (15 chars)" maxLength={15} value={formData.gst_no}
              onChange={(e) => handleInput("gst_no", e.target.value.toUpperCase())} style={{ borderRadius: 8 }} />
          </FormField>
        </div>

        <SectionHeader icon={<CarOutlined />} title="Visit Details" />
        <div style={{ display: "grid", gridTemplateColumns: c3, gap: g, marginBottom: 14 }}>
          <FormField label="Visited By (Field Staff)">
            <Input prefix={<TeamOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Name of person visiting site" value={formData.visited_by}
              onChange={(e) => handleInput("visited_by", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
          <FormField label="Site Type">
            <Select placeholder="Select site type" value={formData.site_type || undefined}
              onChange={(v) => handleInput("site_type", v)} style={{ width: "100%" }} allowClear>
              {SITE_TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </FormField>
          <FormField label="Visit Purpose">
            <Input placeholder="Measurement, survey, demo…" value={formData.visit_purpose}
              onChange={(e) => handleInput("visit_purpose", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>

        <SectionHeader icon={<EnvironmentOutlined />} title="Site Address" />
        <div style={{ display: "flex", flexDirection: "column", gap: g, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: c2, gap: g }}>
            <FormField label="Address Line 1" required>
              <Input placeholder="Flat / Door No, Building, Street" value={formData.address_line1}
                onChange={(e) => handleInput("address_line1", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
            <FormField label="Address Line 2">
              <Input placeholder="Area, Landmark" value={formData.address_line2}
                onChange={(e) => handleInput("address_line2", e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: c4, gap: g }}>
            {[["city","City","City"],["state","State","State"],["pincode","Pincode","6-digit"],["country","Country","Country"]].map(([k, label, ph]) => (
              <FormField key={k} label={label}>
                <Input placeholder={ph} value={formData[k]}
                  onChange={(e) => handleInput(k, e.target.value)} style={{ borderRadius: 8 }} />
              </FormField>
            ))}
          </div>
        </div>

        <SectionHeader icon={<CheckSquareOutlined />} title="Requirements" />
        <div style={{ marginBottom: 14 }}>
          {requirements.map((req, idx) => (
            <RequirementRow key={idx} item={req} index={idx}
              onChange={changeRequirement} onRemove={removeRequirement}
              isOnly={requirements.length === 1} />
          ))}
          {requirements.length === 0 && (
            <div style={{ textAlign: "center", padding: 12, color: "#9ca3af", fontSize: 12 }}>
              No requirements yet. Click "Add Row" to start.
            </div>
          )}
          <Button icon={<PlusOutlined />} onClick={addRequirement}
            style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 38, width: "100%", marginTop: 4 }}>
            Add Requirement Row
          </Button>
        </div>

        <SectionHeader icon={<CameraOutlined />} title="Site Photos" />
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 6, fontSize: 11, color: "#6b7280" }}>
            📍 Photos taken with <strong>Camera</strong> will automatically capture GPS location.
          </div>
          <SitePhotoUploadField photos={sitePhotos} setPhotos={setSitePhotos} />
        </div>

        <SectionHeader icon={<FileTextOutlined />} title="Notes" />
        <div style={{ marginBottom: 14 }}>
          <FormField label="Additional Notes">
            <TextArea rows={3} placeholder="Special instructions, access info, observations…"
              value={formData.notes} onChange={(e) => handleInput("notes", e.target.value)}
              style={{ borderRadius: 8, resize: "vertical" }} />
          </FormField>
        </div>

        <SectionHeader icon={<WalletOutlined />} title="Payment" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: g, marginBottom: g }}>
          <FormField label="Payment Mode">
            <Select placeholder="Select mode" value={formData.payment_mode || undefined}
              style={{ width: "100%" }} allowClear onChange={(v) => handleInput("payment_mode", v ?? "")}>
              {PAYMENT_MODES.map((m) => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </FormField>
          <FormField label="Amount Paid (₹)">
            <InputNumber min={0} placeholder="0.00" value={formData.payment_amount || undefined}
              style={{ width: "100%", borderRadius: 8 }} prefix="₹"
              onChange={(v) => handleInput("payment_amount", v ?? "")} />
          </FormField>
          <FormField label="Delivery Charges (₹)">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <InputNumber min={0} placeholder="0.00"
                value={formData.free_delivery ? 0 : formData.delivery_charges || undefined}
                disabled={formData.free_delivery} style={{ flex: 1, borderRadius: 8 }} prefix="₹"
                onChange={(v) => handleInput("delivery_charges", v ?? 0)} />
              <Button size="small" type={formData.free_delivery ? "primary" : "default"}
                onClick={() => handleInput("free_delivery", !formData.free_delivery)}
                style={{ borderRadius: 6, fontSize: 11, height: 32, padding: "0 8px",
                  background: formData.free_delivery ? "#059669" : undefined,
                  borderColor: formData.free_delivery ? "#059669" : undefined,
                  color: formData.free_delivery ? "#fff" : undefined, whiteSpace: "nowrap" }}>
                {formData.free_delivery ? "🎉 Free" : "Free?"}
              </Button>
            </div>
          </FormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: g, marginBottom: 14 }}>
          <FormField label="Discount %">
            <InputNumber min={0} max={100} placeholder="0" value={formData.discount_percentage || undefined}
              style={{ width: "100%", borderRadius: 8 }}
              formatter={(v) => (v ? `${v}%` : "")} parser={(v) => v?.replace("%", "") ?? ""}
              onChange={(v) => handleInput("discount_percentage", v ?? 0)} />
          </FormField>
        </div>

        <div style={{ background: "linear-gradient(135deg,#f0f9ff 0%,#f8fafc 100%)", border: "1px solid #bae6fd",
          borderRadius: 10, padding: isMobile ? 12 : "14px 16px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "#0c4a6e", marginBottom: 10, fontSize: 14,
            display: "flex", alignItems: "center", gap: 6 }}>
            <ShoppingCartOutlined /> Order Summary
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
            <span style={{ color: "#0c4a6e" }}>Grand Total</span>
            <span style={{ color: "#0369a1" }}>₹{totals.grandTotal.toFixed(2)}</span>
          </div>
          {(totals.paid > 0 || formData.payment_mode) && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#059669", marginBottom: 4 }}>
                <span>Amount Paid {formData.payment_mode ? `(${formData.payment_mode})` : ""}</span>
                <span style={{ fontWeight: 700 }}>− ₹{totals.paid.toFixed(2)}</span>
              </div>
              <Divider style={{ margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: isMobile ? 14 : 15, fontWeight: 800 }}>
                <span style={{ color: "#0c4a6e" }}>Balance Due</span>
                <span style={{ color: totals.balance <= 0 ? "#059669" : "#dc2626",
                  background: totals.balance <= 0 ? "#f0fdf4" : "#fef2f2", padding: "2px 10px", borderRadius: 6 }}>
                  {totals.balance <= 0 ? `✓ Paid (Advance ₹${Math.abs(totals.balance).toFixed(2)})` : `₹${totals.balance.toFixed(2)}`}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={() => { onClose(); resetForm(); }}
            style={{ borderRadius: 8, height: 40, flex: isMobile ? 1 : undefined }}>Cancel</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={submitting}
            style={{ background: "#0369a1", border: "none", borderRadius: 8, height: 40,
              fontWeight: 600, flex: isMobile ? 1 : undefined }}>
            Create Site Visit
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Site Visit Workspace Drawer
// ─────────────────────────────────────────────────────────────────────────────
const SiteVisitWorkspaceDrawer = ({
  open, onClose, job, sessionData, liveTimerSecs, isLive,
  onStartSession, onPauseSession, onCompleteSession,
  onSaveSheet, onConvertToJob, userId, userName,
}) => {
  const [sheetData,     setSheetData]     = useState({ observations: "", measurements: "", recommendation: "", requirements: [] });
  const [photos,        setPhotos]        = useState([]);
  const [savingSheet,   setSavingSheet]   = useState(false);
  const [convertingJob, setConvertingJob] = useState(false);
  const [actionNotes,   setActionNotes]   = useState("");
  const [sessionActionType, setSessionActionType] = useState(null);
  const [actioning,     setActioning]    = useState(false);
  const [sessionModal,  setSessionModal] = useState(false);

  const parsedMeta = (() => {
    try { return JSON.parse(job?.site_visit_meta || "{}"); }
    catch { return {}; }
  })();

  useEffect(() => {
    if (open && job) {
      let existingReqs = [];
      if (parsedMeta.requirements?.length) {
        existingReqs = parsedMeta.requirements.map((r) => ({ ...EMPTY_REQUIREMENT, ...r }));
      } else if (job.cart_items?.length) {
        existingReqs = job.cart_items.map((c) => ({ ...EMPTY_REQUIREMENT, ...c }));
      }
      setSheetData({
        observations:   parsedMeta.observations   || "",
        measurements:   parsedMeta.measurements   || "",
        recommendation: parsedMeta.recommendation || "",
        requirements:   existingReqs.length ? existingReqs : [{ ...EMPTY_REQUIREMENT }],
      });
      setPhotos([]);
    }
  }, [open, job?._id]);

  if (!job) return null;

  const handleSessionAction = (type) => { setSessionActionType(type); setActionNotes(""); setSessionModal(true); };

  const confirmSessionAction = async () => {
    setActioning(true);
    try {
      if (sessionActionType === "open") await onStartSession(job, actionNotes);
      else await onPauseSession(job, sessionActionType, actionNotes);
      setSessionModal(false);
    } catch { /* errors handled upstream */ }
    finally { setActioning(false); }
  };

  const handleSaveSheet = async () => {
    setSavingSheet(true);
    try {
      const uploadedDetails = [];
      for (const photo of photos) {
        if (photo.uploaded && photo.uploadedUrl) {
          uploadedDetails.push({ url: photo.uploadedUrl, gps: photo.gps || null });
          continue;
        }
        setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, uploading: true } : p));
        try {
          const url = await uploadFileToServer(photo.file);
          uploadedDetails.push({ url, gps: photo.gps || null });
          setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, uploading: false, uploaded: true, uploadedUrl: url } : p));
        } catch (err) {
          setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, uploading: false, error: err.message } : p));
          message.error(`Failed to upload ${photo.name}`);
        }
      }

      const updatedCartItems = sheetData.requirements
        .filter((r) => r.product_name?.trim())
        .map((r) => {
          const { base, gstAmt, total: lineTotal } = computeLineTotal(r);
          return {
            product_id:    r.product_id    || "",
            product_name:  r.product_name,
            variation:     r.variation     || "",
            printing_type: r.printing_type || "",
            quantity:      r.quantity      || 1,
            quantity_type: r.quantity_type || "sq.ft",
            price:         r.price         || 0,
            sq_ft:         r.sq_ft         || 0,
            sq_ft_manual:  r.sq_ft_manual  || false,
            width:         r.width         || "",
            height:        r.height        || "",
            size_unit:     r.size_unit     || "inch",
            gst_percentage:r.gst_percentage|| 0,
            gst_amount:    parseFloat(gstAmt.toFixed(2)),
            line_base:     parseFloat(base.toFixed(2)),
            line_total:    parseFloat(lineTotal.toFixed(2)),
            design_file:   r.design_file   || "",
            notes:         r.notes         || "",
          };
        });

      const updatedMeta = {
        ...parsedMeta,
        observations:   sheetData.observations,
        measurements:   sheetData.measurements,
        recommendation: sheetData.recommendation,
        requirements:   updatedCartItems,
        site_photos:        [...(parsedMeta.site_photos || []), ...uploadedDetails.map((d) => d.url)],
        site_photos_detail: [...(parsedMeta.site_photos_detail || []), ...uploadedDetails],
        sheet_updated_at:   new Date().toISOString(),
        sheet_updated_by:   userName,
      };

      await onSaveSheet(job._id, {
        site_visit_meta: JSON.stringify(updatedMeta),
        cart_items:      updatedCartItems,
        qc_images:       uploadedDetails.map((d) => d.url),
        qc_notes:        sheetData.observations,
      });

      message.success("Site visit sheet saved!");
    } catch (err) {
      message.error(err.message);
    } finally {
      setSavingSheet(false);
    }
  };

  const handleConvert = async () => {
    setConvertingJob(true);
    try { await onConvertToJob(job._id); }
    finally { setConvertingJob(false); }
  };

  const addRequirement    = () => setSheetData((p) => ({ ...p, requirements: [...p.requirements, { ...EMPTY_REQUIREMENT }] }));
  const removeRequirement = (idx) => setSheetData((p) => ({ ...p, requirements: p.requirements.filter((_, i) => i !== idx) }));
  const changeRequirement = (idx, updatedItem) => setSheetData((p) => ({ ...p, requirements: p.requirements.map((r, i) => i === idx ? updatedItem : r) }));

  const existingPhotoUrls    = parsedMeta?.site_photos        || [];
  const existingPhotoDetails = parsedMeta?.site_photos_detail || [];
  const isConverted = job.converted_to_order === true;
  const siteAddress = parsedMeta?.site_address ||
    [job.delivery_address?.street, job.delivery_address?.city, job.delivery_address?.state, job.delivery_address?.pincode].filter(Boolean).join(", ");

  return (
    <>
      <Drawer open={open} onClose={onClose} width={600}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8,
              background: isLive ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#0369a1,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EnvironmentOutlined style={{ color: "#fff", fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>
                Site Visit — {job.job_no}
                {isLive && (
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, background: "#dcfce7",
                    color: "#16a34a", padding: "2px 7px", borderRadius: 8, border: "1px solid #86efac" }}>
                    ● LIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{job.customer_name}</div>
            </div>
          </div>
        }
        styles={{ body: { padding: "16px 20px", overflowY: "auto" } }}
        extra={<Button icon={<ReloadOutlined />} size="small" onClick={onClose} style={{ borderRadius: 6 }}>Close</Button>}>

        <div style={{ background: "linear-gradient(135deg,#f0f9ff,#f0fdf4)", border: "1px solid #bae6fd",
          borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>{job.customer_name}</div>
              {job.company_name && <div style={{ fontSize: 12, color: "#6b7280" }}>{job.company_name}</div>}
              {job.customer_phone && (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                  <PhoneOutlined style={{ marginRight: 4, color: "#0369a1" }} />{job.customer_phone}
                </div>
              )}
              {parsedMeta?.visited_by && (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                  <TeamOutlined style={{ marginRight: 4, color: "#7c3aed" }} />
                  <span style={{ fontWeight: 600 }}>Visited by:</span> {parsedMeta.visited_by}
                </div>
              )}
            </div>
            <VisitStatusBadge status={
              isConverted ? "converted" : isLive ? "in_progress"
              : job.job_status === "on_hold" ? "on_hold"
              : sessionData?.closed_sessions > 0 ? "completed" : "pending"
            } />
          </div>
          {siteAddress && (
            <div style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "flex-start", gap: 6 }}>
              <EnvironmentOutlined style={{ color: "#d97706", marginTop: 1, flexShrink: 0 }} />
              <span>{siteAddress}</span>
            </div>
          )}
          {parsedMeta?.site_type && (
            <div style={{ marginTop: 6 }}>
              <Tag color="cyan" style={{ fontSize: 10, fontWeight: 700 }}>{parsedMeta.site_type}</Tag>
            </div>
          )}
          {isConverted && (
            <Alert type="success" showIcon icon={<RocketOutlined />}
              message={<span style={{ fontSize: 12, fontWeight: 700 }}>Converted to Job Order</span>}
              style={{ borderRadius: 8, marginTop: 10, padding: "6px 10px" }} />
          )}
        </div>

        {/* ── Session Timer ── */}
        <div style={{ background: isLive ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "#f9fafb",
          border: `2px solid ${isLive ? "#16a34a" : "#e5e7eb"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: isLive ? "#15803d" : "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><FieldTimeOutlined style={{ marginRight: 4 }} />Visit Duration</span>
            {isLive && <span style={{ color: "#16a34a", fontSize: 10, background: "#dcfce7", padding: "2px 8px", borderRadius: 8 }}>● LIVE SESSION</span>}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 32, fontWeight: 800,
            color: isLive ? "#166534" : "#9ca3af", letterSpacing: "-0.02em" }}>
            {fmtSecs(liveTimerSecs)}
          </div>
          {sessionData && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              {sessionData.worked_days || 0} day{(sessionData.worked_days || 0) !== 1 ? "s" : ""} · {sessionData.closed_sessions || 0} session{(sessionData.closed_sessions || 0) !== 1 ? "s" : ""}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {!isLive && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleSessionAction("open")}
                style={{ flex: 1, height: 36, background: "#16a34a", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12 }}>
                {sessionData?.closed_sessions > 0 ? "Resume Visit" : "Start Visit"}
              </Button>
            )}
            {isLive && (
              <>
                <Button icon={<PauseCircleOutlined />} onClick={() => handleSessionAction("on_hold")} danger
                  style={{ flex: 1, height: 36, borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Pause</Button>
                <Button icon={<CheckCircleOutlined />} onClick={() => handleSessionAction("completed")}
                  style={{ flex: 1, height: 36, background: "#0369a1", border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Done</Button>
              </>
            )}
          </div>
        </div>

        {sessionData?.daily_summary?.length > 0 && (
          <DailySummaryBar dailySummary={sessionData.daily_summary} totalSecs={liveTimerSecs} workedDays={sessionData.worked_days || 0} />
        )}

        <Divider style={{ margin: "8px 0 16px" }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>📋 Site Visit Job Sheet</span>
        </Divider>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckSquareOutlined />Requirements / Measurements
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={addRequirement}
              style={{ background: "#16a34a", border: "none", color: "#fff", borderRadius: 6, height: 24, fontSize: 10, fontWeight: 700 }}>
              Add
            </Button>
          </div>
          {sheetData.requirements.map((req, idx) => (
            <RequirementRow key={idx} item={req} index={idx}
              onChange={changeRequirement} onRemove={removeRequirement}
              isOnly={sheetData.requirements.length === 1} />
          ))}
          {sheetData.requirements.length === 0 && (
            <div style={{ textAlign: "center", padding: 10, color: "#9ca3af", fontSize: 12 }}>Add requirement rows above</div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            <EyeOutlined style={{ marginRight: 4 }} />Site Observations
          </label>
          <TextArea rows={3} placeholder="Site conditions, existing signage, access, challenges…"
            value={sheetData.observations} style={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 12 }}
            onChange={(e) => setSheetData((p) => ({ ...p, observations: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            <FormOutlined style={{ marginRight: 4 }} />Measurements Taken
          </label>
          <TextArea rows={2} placeholder="Exact measurements, wall dimensions, height restrictions…"
            value={sheetData.measurements} style={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 12 }}
            onChange={(e) => setSheetData((p) => ({ ...p, measurements: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            <StarOutlined style={{ marginRight: 4 }} />Recommendation
          </label>
          <TextArea rows={2} placeholder="Recommended materials, approach, timeline…"
            value={sheetData.recommendation} style={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 12 }}
            onChange={(e) => setSheetData((p) => ({ ...p, recommendation: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <CameraOutlined />Site Photos
          </div>
          {existingPhotoUrls.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 6 }}>
                Previously saved ({existingPhotoUrls.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
                {existingPhotoUrls.map((url, i) => {
                  const detail = existingPhotoDetails[i];
                  return (
                    <div key={i} style={{ borderRadius: 8, border: "2px solid #bae6fd", overflow: "visible" }}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <div style={{ aspectRatio: "1", borderRadius: "7px 7px 0 0", overflow: "hidden" }}>
                          <img src={url} alt={`site-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      </a>
                      {detail?.gps?.lat && (
                        <div style={{ padding: "3px 4px", background: "#f0f9ff", borderTop: "1px solid #bae6fd", borderRadius: "0 0 7px 7px" }}>
                          <GPSTag gps={detail.gps} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 6, fontSize: 11, color: "#6b7280" }}>
            📍 <strong>Camera</strong> captures will automatically attach GPS coordinates.
          </div>
          <SitePhotoUploadField photos={photos} setPhotos={setPhotos} />
        </div>

        <Button type="primary" icon={savingSheet ? <LoadingOutlined /> : <FileTextOutlined />}
          loading={savingSheet} onClick={handleSaveSheet} block
          style={{ height: 42, background: "linear-gradient(135deg,#0369a1,#0ea5e9)", border: "none",
            borderRadius: 10, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          {savingSheet ? "Saving…" : `Save Job Sheet${photos.filter((p) => !p.uploaded).length > 0 ? ` + ${photos.filter((p) => !p.uploaded).length} Photo${photos.filter((p) => !p.uploaded).length > 1 ? "s" : ""}` : ""}`}
        </Button>

        {!isConverted && sessionData?.closed_sessions > 0 && (
          <ConvertToJobPanel requirements={sheetData.requirements.filter((r) => r.product_name?.trim())}
            onConvert={handleConvert} loading={convertingJob} />
        )}
        {isConverted && (
          <Alert type="success" showIcon icon={<RocketOutlined />}
            message="Already converted to a production job"
            description="This pick up has been linked to a job order."
            style={{ borderRadius: 10 }} />
        )}
      </Drawer>

      <Modal open={sessionModal} onCancel={() => !actioning && setSessionModal(false)} width={400}
        title={
          <span style={{ fontWeight: 700 }}>
            {sessionActionType === "open"      && "Start / Resume Site Visit"}
            {sessionActionType === "on_hold"   && "Pause Site Visit"}
            {sessionActionType === "completed" && "Mark Visit as Done"}
            <Tag color="green" style={{ marginLeft: 8, fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>
              {job.job_no}
            </Tag>
          </span>
        }
        footer={[
          <Button key="c" onClick={() => setSessionModal(false)} disabled={actioning}>Cancel</Button>,
          <Button key="ok" type="primary" loading={actioning} onClick={confirmSessionAction}
            style={{ background: sessionActionType === "on_hold" ? "#f97316" : sessionActionType === "completed" ? "#16a34a" : "#0369a1", border: "none" }}>
            Confirm
          </Button>,
        ]}
        destroyOnClose>
        <TextArea rows={3}
          placeholder={
            sessionActionType === "open"      ? "Notes on starting this visit…"
            : sessionActionType === "on_hold" ? "Reason for pause (waiting for client, lunch, etc.)…"
            : "Summary of visit, next steps…"
          }
          value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
          style={{ borderRadius: 8, marginTop: 12 }} />
      </Modal>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN — SiteVisitDashboard
// ═════════════════════════════════════════════════════════════════════════════
const SiteVisitDashboard = () => {
  const user         = profile();
  const userId       = user._id;
  const userName     = user.name || user.fullName || user.username || "Field Agent";
  const isSuperAdmin = user.role === "super admin";

  const [jobs,         setJobs]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [sessionMap,   setSessionMap]   = useState({});
  const [lastRefresh,  setLastRefresh]  = useState(dayjs());
  const [activeFilter, setActiveFilter] = useState("all");

  const [newVisitModal, setNewVisitModal] = useState(false);
  const [workspaceJob,  setWorkspaceJob]  = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // ── Timer state ──────────────────────────────────────────────────────────
  // Structure per jobId: { closedSecs: number, sessionStartedAt: Date | null }
  // closedSecs  = total_duration_seconds from DB (sum of all CLOSED sessions)
  // sessionStartedAt = when the current open session started (from open_since)
  // Display = closedSecs + (now - sessionStartedAt) if live, else closedSecs
  const [timerState, setTimerState] = useState({});
  const tickRef = useRef(null);   // single shared interval
  const [tickNow, setTickNow] = useState(Date.now());

  // Single interval ticks every second and updates `tickNow`; all live timers
  // compute their value from it — no per-job intervals, no drift accumulation.
  useEffect(() => {
    tickRef.current = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // ✅ FIX: Correct timer display calculation.
  // closedSecs = seconds in completed sessions (from DB total_duration_seconds,
  //   which already excludes the open session on the backend).
  // If live: add elapsed time since open_since.
  const getLiveDisplaySecs = useCallback((jobId) => {
    const ts = timerState[jobId];
    if (!ts) return sessionMap[jobId]?.total_duration_seconds || 0;
    const closed = ts.closedSecs || 0;
    if (!ts.sessionStartedAt) return closed;
    const elapsed = Math.max(0, Math.floor((tickNow - new Date(ts.sessionStartedAt).getTime()) / 1000));
    return closed + elapsed;
  }, [timerState, sessionMap, tickNow]);

  // ── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let myJobs = [];

      if (isSuperAdmin) {
        // ✅ FIX: Filter by job_status = "site_visit" for the admin view too
        const res  = await fetch(`${BASE}?status=${SITE_VISIT_JOB_STATUS}&limit=200`, { headers: authHeader() });
        const data = await res.json();
        const rows = Array.isArray(data?.data?.jobs) ? data.data.jobs
          : Array.isArray(data?.data) ? data.data : [];
        myJobs = rows;
      } else {
        // ✅ FIX: Non-admin: fetch all jobs assigned to this user, then filter
        //         by job_status === "site_visit". The openSession call during
        //         create sets current_stage.assigned_to, so this works.
        const res  = await fetch(`${BASE}/assigned-to/${userId}`, { headers: authHeader() });
        const data = await res.json();
        const rows = Array.isArray(data?.data) ? data.data : [];
        myJobs = rows.filter((j) => j.job_status === SITE_VISIT_JOB_STATUS);
      }

      setJobs(myJobs);
      setLastRefresh(dayjs());

      // Fetch session status for each job
      const sessMap = {};
      await Promise.all(myJobs.map(async (j) => {
        try {
          const sr = await fetch(`${BASE}/${j._id}/session/status?stage=${STAGE_KEY}`, { headers: authHeader() });
          const sd = await sr.json();
          if (sd.success) sessMap[j._id] = sd.data;
        } catch { /* ignore */ }
      }));
      setSessionMap(sessMap);

      // ✅ FIX: Build timerState from fresh session data.
      // total_duration_seconds from the backend = sum of CLOSED sessions only
      // (the backend accumulates this when a session is closed).
      // For a live session: add elapsed since open_since client-side.
      setTimerState((prev) => {
        const next = { ...prev };
        for (const [jobId, sess] of Object.entries(sessMap)) {
          if (sess.has_open_session && sess.open_since) {
            // Keep existing sessionStartedAt if we already have it (avoid jump on re-fetch)
            const existing = prev[jobId];
            next[jobId] = {
              closedSecs:       sess.total_duration_seconds || 0,
              sessionStartedAt: existing?.sessionStartedAt || new Date(sess.open_since),
            };
          } else {
            // No open session — show total closed seconds, no live count
            next[jobId] = {
              closedSecs:       sess.total_duration_seconds || 0,
              sessionStartedAt: null,
            };
          }
        }
        return next;
      });
    } catch (err) {
      message.error("Failed to load pick ups: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [userId, isSuperAdmin]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ── Session handlers ──────────────────────────────────────────────────────
  const handleStartSession = async (job, notes = "") => {
    const res  = await fetch(`${BASE}/${job._id}/session/open`, {
      method: "POST", headers: jsonHeader(),
      body: JSON.stringify({
        stage: STAGE_KEY, stage_label: STAGE_LBL,
        user: { user_id: userId, name: userName, role: "pick up team" },
        notes,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to start session");

    const now = new Date();

    // ✅ FIX: Update timerState immediately — don't wait for loadJobs.
    //         closedSecs stays what it was; sessionStartedAt = now.
    setTimerState((prev) => ({
      ...prev,
      [job._id]: {
        closedSecs:       prev[job._id]?.closedSecs || 0,
        sessionStartedAt: now,
      },
    }));

    // ✅ FIX: Also update sessionMap immediately so isLive reflects in UI
    setSessionMap((prev) => ({
      ...prev,
      [job._id]: {
        ...(prev[job._id] || {}),
        has_open_session: true,
        open_since: now.toISOString(),
      },
    }));

    // ✅ FIX: Sync workspaceJob if the drawer is open for this job
    setWorkspaceJob((prev) => prev?._id === job._id ? { ...job } : prev);

    message.success(`Visit started for ${job.job_no}!`);
    // Reload in background to get full updated session data
    loadJobs();
  };

  const handlePauseSession = async (job, action, notes = "") => {
    const res  = await fetch(`${BASE}/${job._id}/session/close`, {
      method: "POST", headers: jsonHeader(),
      body: JSON.stringify({ stage: STAGE_KEY, action, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to close session");

    // ✅ FIX: Immediately add elapsed to closedSecs, clear sessionStartedAt
    setTimerState((prev) => {
      const ts = prev[job._id];
      const elapsed = ts?.sessionStartedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(ts.sessionStartedAt).getTime()) / 1000))
        : 0;
      return {
        ...prev,
        [job._id]: {
          closedSecs:       (ts?.closedSecs || 0) + elapsed,
          sessionStartedAt: null,
        },
      };
    });

    // Update sessionMap immediately
    setSessionMap((prev) => ({
      ...prev,
      [job._id]: {
        ...(prev[job._id] || {}),
        has_open_session: false,
        open_since: null,
      },
    }));

    message.success(action === "on_hold" ? "Visit paused!" : "Visit completed!");
    loadJobs();
  };

  const handleSaveSheet = async (jobId, updates) => {
    const res  = await fetch(`${BASE}/${jobId}`, {
      method: "PUT", headers: jsonHeader(), body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to save sheet");
    await loadJobs();
  };

  const handleConvertToJob = async (jobId) => {
    try {
      const res  = await fetch(`${BASE}/${jobId}/status`, {
        method: "PATCH", headers: jsonHeader(),
        body: JSON.stringify({ job_status: "design", converted_to_order: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Conversion failed");

      await fetch(`${BASE}/${jobId}/session/close`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ stage: STAGE_KEY, action: "completed", notes: "Converted to production job" }),
      });

      message.success("Site visit converted to production job order!");
      setWorkspaceOpen(false);
      await loadJobs();
    } catch (err) { message.error(err.message); }
  };

  // ── Derived counts ────────────────────────────────────────────────────────
  const liveCount      = Object.values(sessionMap).filter((s) => s?.has_open_session).length;
  const onHoldCount    = jobs.filter((j) => {
    const s = sessionMap[j._id];
    return !s?.has_open_session && (s?.closed_sessions || 0) > 0 && !j.converted_to_order;
  }).length;
  const convertedCount = jobs.filter((j) => j.converted_to_order === true).length;
  const completedCount = jobs.filter((j) =>
    j.workflow_stages?.some((s) => s.stage === STAGE_KEY && (s.action === "completed" || s.action === "passed"))
  ).length;

  const filteredJobs = jobs.filter((job) => {
    const sess = sessionMap[job._id];
    switch (activeFilter) {
      case "live":      return sess?.has_open_session === true;
      case "on_hold":   return !sess?.has_open_session && (sess?.closed_sessions || 0) > 0 && !job.converted_to_order;
      case "converted": return job.converted_to_order === true;
      case "completed": return job.workflow_stages?.some((s) => s.stage === STAGE_KEY && (s.action === "completed" || s.action === "passed"));
      default:          return true;
    }
  });

  const summaryItems = [
    { key: "all",       label: "All Visits",  value: jobs.length,      color: "#0369a1", bg: "#f0f9ff", activeBg: "#e0f2fe", border: "#bae6fd" },
    { key: "live",      label: "On Site Now", value: liveCount,         color: "#16a34a", bg: "#f0fdf4", activeBg: "#dcfce7", border: "#86efac" },
    { key: "on_hold",   label: "On Hold",     value: onHoldCount,       color: "#f97316", bg: "#fff7ed", activeBg: "#ffedd5", border: "#fdba74" },
    { key: "completed", label: "Visited",     value: completedCount,    color: "#0ea5e9", bg: "#f0f9ff", activeBg: "#e0f2fe", border: "#7dd3fc" },
    { key: "converted", label: "Converted",   value: convertedCount,    color: "#7c3aed", bg: "#f5f3ff", activeBg: "#ede9fe", border: "#c4b5fd" },
  ];

  const columns = [
    {
      title: "S.No", key: "sno", width: 55,
      render: (_, __, i) => <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>{i + 1}</span>,
    },
    {
      title: "Job No", dataIndex: "job_no", width: 140,
      render: (val, job) => {
        const isLive      = sessionMap[job._id]?.has_open_session;
        const isConverted = job.converted_to_order === true;
        return (
          <div>
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13,
              color: isConverted ? "#7c3aed" : isLive ? "#16a34a" : "#0369a1" }}>{val}</span>
            {isLive && (
              <div style={{ marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#dcfce7",
                  color: "#16a34a", padding: "1px 6px", borderRadius: 8, border: "1px solid #86efac" }}>● LIVE</span>
              </div>
            )}
            {isConverted && (
              <div style={{ marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#f5f3ff",
                  color: "#7c3aed", padding: "1px 6px", borderRadius: 8, border: "1px solid #c4b5fd" }}>✓ CONVERTED</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Customer", width: 180,
      render: (_, job) => {
        let visitedBy = "";
        try { visitedBy = JSON.parse(job.site_visit_meta || "{}").visited_by || ""; } catch {}
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{job.customer_name || "—"}</div>
            {job.company_name   && <div style={{ fontSize: 11, color: "#6b7280" }}>{job.company_name}</div>}
            {job.customer_phone && <div style={{ fontSize: 11, color: "#6b7280" }}><PhoneOutlined style={{ marginRight: 3 }} />{job.customer_phone}</div>}
            {visitedBy && <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 1 }}><TeamOutlined style={{ marginRight: 3 }} />{visitedBy}</div>}
          </div>
        );
      },
    },
    {
      title: "Site Address", width: 200,
      render: (_, job) => {
        let display = "", siteType = "";
        try { const m = JSON.parse(job.site_visit_meta || "{}"); display = m.site_address || ""; siteType = m.site_type || ""; } catch {}
        if (!display) {
          const addr = job.delivery_address;
          display = [addr?.street, addr?.city, addr?.state].filter(Boolean).join(", ");
        }
        return (
          <div>
            {display
              ? <div style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "flex-start", gap: 5 }}>
                  <EnvironmentOutlined style={{ color: "#d97706", marginTop: 1, flexShrink: 0, fontSize: 12 }} />
                  <span style={{ lineHeight: 1.4 }}>{display}</span>
                </div>
              : <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
            }
            {siteType && <Tag color="gold" style={{ marginTop: 4, fontSize: 10, fontWeight: 700 }}>{siteType}</Tag>}
          </div>
        );
      },
    },
    {
      title: "Requirements", width: 180,
      render: (_, job) => {
        let reqs = [];
        try { reqs = JSON.parse(job.site_visit_meta || "{}").requirements || []; } catch {}
        if (!reqs.length && job.cart_items?.length) reqs = job.cart_items;
        if (!reqs.length) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
        return (
          <div>
            {reqs.slice(0, 2).map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>{r.product_name || "—"}</span>
                {r.variation && <span style={{ color: "#9ca3af" }}> · {r.variation}</span>}
                {r.quantity  && <span style={{ color: "#0369a1" }}> ×{r.quantity}</span>}
              </div>
            ))}
            {reqs.length > 2 && <span style={{ fontSize: 11, color: "#6b7280" }}>+{reqs.length - 2} more</span>}
          </div>
        );
      },
    },
    {
      title: "Status", width: 120,
      render: (_, job) => {
        const isLive      = sessionMap[job._id]?.has_open_session;
        const isConverted = job.converted_to_order === true;
        const isDone      = job.workflow_stages?.some((s) => s.stage === STAGE_KEY && (s.action === "completed" || s.action === "passed"));
        const hasSessions = (sessionMap[job._id]?.closed_sessions || 0) > 0;
        const status = isConverted ? "converted"
          : isLive ? "in_progress"
          : hasSessions ? "on_hold"
          : isDone ? "completed"
          : "pending";
        return <VisitStatusBadge status={status} />;
      },
    },
    {
      title: "Time on Site", width: 120,
      render: (_, job) => {
        const secs  = getLiveDisplaySecs(job._id);
        const sess  = sessionMap[job._id];
        const isLive = sess?.has_open_session;
        if (!secs && !sess) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
        return (
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: isLive ? "#16a34a" : "#374151" }}>
              {fmtSecs(secs)}
            </div>
            {sess && (
              <div style={{ fontSize: 10, color: "#6b7280" }}>
                {sess.worked_days || 0} day{(sess.worked_days || 0) !== 1 ? "s" : ""} · {sess.closed_sessions || 0} visit{(sess.closed_sessions || 0) !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Visit Date", width: 110,
      render: (_, job) => {
        let visitDate = null;
        try { visitDate = JSON.parse(job.site_visit_meta || "{}").visit_date; } catch {}
        const date    = visitDate ? dayjs(visitDate) : job.order_date ? dayjs(job.order_date) : null;
        if (!date) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
        const isToday = date.isSame(dayjs(), "day");
        const isPast  = date.isBefore(dayjs(), "day");
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? "#16a34a" : isPast ? "#6b7280" : "#0369a1" }}>
              {isToday && "📅 "}{date.format("DD MMM YYYY")}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{date.format("h:mm A")}</div>
          </div>
        );
      },
    },
    {
      title: "Actions", width: 160, fixed: "right",
      render: (_, job) => {
        const isLive = sessionMap[job._id]?.has_open_session;
        return (
          <Space size={4} wrap>
            <Tooltip title="Open job sheet / workspace">
              <Button size="small" icon={<FormOutlined />}
                onClick={() => { setWorkspaceJob(job); setWorkspaceOpen(true); }}
                style={{ height: 28, fontSize: 11, fontWeight: 600, borderRadius: 6,
                  color: "#0369a1", borderColor: "#bae6fd", background: "#f0f9ff" }}>
                Sheet
              </Button>
            </Tooltip>
            {!isLive && (
              <Tooltip title="Start / Resume pick up">
                <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                  onClick={async () => {
                    try { await handleStartSession(job); }
                    catch (err) { message.error(err.message); }
                  }}
                  style={{ height: 28, fontSize: 11, fontWeight: 600, borderRadius: 6, background: "#16a34a", border: "none" }}>
                  {(sessionMap[job._id]?.closed_sessions || 0) > 0 ? "Resume" : "Start"}
                </Button>
              </Tooltip>
            )}
            {isLive && (
              <Tooltip title="Pause visit">
                <Button size="small" danger icon={<PauseCircleOutlined />}
                  onClick={async () => {
                    try { await handlePauseSession(job, "on_hold"); }
                    catch (err) { message.error(err.message); }
                  }}
                  style={{ height: 28, fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
                  Pause
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16, background: "linear-gradient(160deg,#f0f9ff 0%,#f8fafc 50%,#f0fdf4 100%)", minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .visit-table .ant-table-thead > tr > th {
          background: #f8fafc !important; font-size: 11px !important;
          font-weight: 700 !important; color: #6b7280 !important;
          text-transform: uppercase; letter-spacing: 0.05em;
          border-bottom: 2px solid #e5e7eb !important; padding: 10px 12px !important;
        }
        .visit-table .ant-table-tbody > tr > td { padding: 10px 12px !important; border-bottom: 1px solid #f0fdf4 !important; vertical-align: top; }
        .visit-table .ant-table-tbody > tr:hover > td { background: #f0f9ff !important; }
        .visit-table .ant-table-tbody > tr.live-row > td { background: #f0fdf4 !important; }
        .visit-table .ant-table-tbody > tr.converted-row > td { background: #faf5ff !important; }
        .visit-table .ant-table-tbody > tr { animation: slideIn 0.25s ease forwards; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 18px",
        marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex",
        justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#0369a1,#0ea5e9)",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px #0ea5e940" }}>
            <CompassOutlined style={{ color: "#fff", fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0c4a6e", letterSpacing: "-0.02em" }}>
              Site Visit Dashboard
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              {isSuperAdmin ? "All pick ups" : <><strong style={{ color: "#0369a1" }}>{userName}</strong> · My visits</>}
              {" "}· {jobs.length} record{jobs.length !== 1 ? "s" : ""} · Updated {lastRefresh.format("HH:mm:ss")}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined spin={loading} />} onClick={loadJobs} style={{ borderRadius: 8 }} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewVisitModal(true)}
            style={{ height: 38, background: "linear-gradient(135deg,#0369a1,#0ea5e9)", border: "none",
              borderRadius: 8, fontWeight: 700, fontSize: 13, boxShadow: "0 4px 12px #0ea5e940" }}>
            New Site Visit
          </Button>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${summaryItems.length}, minmax(0, 1fr))`, gap: 10, marginBottom: 16 }}>
        {summaryItems.map(({ key, label, value, color, bg, activeBg }) => {
          const isActive = activeFilter === key;
          return (
            <div key={key} onClick={() => setActiveFilter(isActive ? "all" : key)}
              style={{ background: isActive ? activeBg : bg, borderRadius: 10, padding: "10px 12px",
                border: `${isActive ? "2px" : "1px"} solid ${isActive ? color : `${color}44`}`,
                cursor: "pointer", transition: "all 0.18s ease",
                boxShadow: isActive ? `0 0 0 3px ${color}22` : "none",
                transform: isActive ? "translateY(-2px)" : "none", position: "relative" }}>
              {isActive && <div style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7,
                borderRadius: "50%", background: color, animation: "pulse 1.5s infinite" }} />}
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: isActive ? color : "#6b7280", fontWeight: isActive ? 700 : 600, marginTop: 3 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <Spin spinning={loading}>
          <Table className="visit-table" dataSource={filteredJobs} columns={columns} rowKey="_id"
            scroll={{ x: 1180 }}
            pagination={{ pageSize: 20, showSizeChanger: true,
              showTotal: (total) => `${total} pick up${total !== 1 ? "s" : ""}`,
              style: { padding: "12px 16px" } }}
            locale={{ emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ color: "#9ca3af" }}>
                    <CompassOutlined style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
                    No pick ups yet. Create your first visit!
                  </div>
                }
                style={{ padding: "40px 0" }} />
            )}}
            rowClassName={(job) => {
              if (job.converted_to_order) return "converted-row";
              if (sessionMap[job._id]?.has_open_session) return "live-row";
              return "";
            }}
          />
        </Spin>
      </div>

      {/* ── New Site Visit Modal ── */}
      <NewSiteVisitModal open={newVisitModal} onClose={() => setNewVisitModal(false)}
        onSuccess={loadJobs} userId={userId} userName={userName} />

      {/* ── Workspace Drawer ── */}
      <SiteVisitWorkspaceDrawer
        open={workspaceOpen}
        onClose={() => { setWorkspaceOpen(false); setWorkspaceJob(null); }}
        job={workspaceJob}
        sessionData={workspaceJob ? sessionMap[workspaceJob._id] : null}
        liveTimerSecs={workspaceJob ? getLiveDisplaySecs(workspaceJob._id) : 0}
        isLive={workspaceJob ? !!sessionMap[workspaceJob._id]?.has_open_session : false}
        onStartSession={handleStartSession}
        onPauseSession={handlePauseSession}
        onSaveSheet={handleSaveSheet}
        onConvertToJob={handleConvertToJob}
        userId={userId}
        userName={userName}
      />
    </div>
  );
};

export default SiteVisitDashboard;