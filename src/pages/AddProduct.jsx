import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSelector } from "react-redux";
import { MdFileDownload } from "react-icons/md";
import {
  Button,
  Form,
  Image,
  Modal,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Card,
  Typography,
  message,
  Input,
  DatePicker,
  InputNumber,
  Progress,
  Badge,
  Drawer,
  Collapse,
  Statistic,
  Row,
  Col,
  Divider,
  Empty,
  Alert,
  Steps,
} from "antd";
import { FaFilter, FaBoxes, FaWarehouse } from "react-icons/fa";
import {
  LockOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  DeleteFilled,
  EyeOutlined,
  SwapOutlined,
  CameraOutlined,
  UploadOutlined,
  ExperimentOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  RollbackOutlined,
  AreaChartOutlined,
  BarcodeOutlined,
  TeamOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  addproduct,
  editProduct,
  getAllCategoryProducts,
  getAllVendor,
  getMainCategory,
  getProduct,
  getSubCategory,
  getSingleVendor,
  uploadImage,
  deleteProduct,
} from "../api";
import {
  ERROR_NOTIFICATION,
  SUCCESS_NOTIFICATION,
} from "../helper/notification_helper";
import CustomTable from "../components/CustomTable";
import { useForm } from "antd/es/form/Form";
import { formValidation } from "../helper/formvalidation";

const { Title, Text } = Typography;
const { confirm } = Modal;
const { Panel } = Collapse;

// ─── Unit configuration ───────────────────────────────────────────────────────
export const UNITS = [
  { value: "pcs",    label: "Pieces (pcs)",         short: "pcs",   kind: "count",  icon: "📦" },
  { value: "sqft",   label: "Square Feet (sq ft)",  short: "sq ft", kind: "area",   icon: "⬛" },
  { value: "sqm",    label: "Square Meters (sq m)", short: "sq m",  kind: "area",   icon: "⬛" },
  { value: "feet",   label: "Linear Feet (ft)",     short: "ft",    kind: "length", icon: "📏" },
  { value: "meters", label: "Linear Meters (m)",    short: "m",     kind: "length", icon: "📏" },
  { value: "kg",     label: "Kilograms (kg)",        short: "kg",    kind: "weight", icon: "⚖️" },
  { value: "rolls",  label: "Rolls",                short: "rolls", kind: "count",  icon: "🪄" },
];

export const UNIT_MAP  = Object.fromEntries(UNITS.map((u) => [u.value, u]));
export const unitLabel = (unit) => UNIT_MAP[unit]?.short || unit || "pcs";
export const formatQty = (qty, unit) => `${Number(qty || 0).toLocaleString()} ${unitLabel(unit)}`;
export const isAreaUnit = (unit) => unit === "sqft" || unit === "sqm";

const SIZE_UNITS = [
  { value: "feet",   label: "Feet (ft)" },
  { value: "inches", label: "Inches (in)" },
  { value: "cm",     label: "Centimeters (cm)" },
  { value: "meters", label: "Meters (m)" },
  { value: "mm",     label: "Millimeters (mm)" },
];

const STORAGE_KEYS = {
  PAGE_SIZE:    "products_pageSize",
  CURRENT_PAGE: "products_currentPage",
  ACTIVE_TAB:   "products_activeTab",
};

// ─── Area calculation ─────────────────────────────────────────────────────────
const calculateArea = (width, height, widthUnit, heightUnit, targetUnit) => {
  if (!width || !height) return null;
  const toFeet = (value, unit) => {
    const c = { inches: 1 / 12, feet: 1, cm: 0.0328084, meters: 3.28084, mm: 0.00328084 };
    return value * (c[unit] || 1);
  };
  const areaInSqFt = toFeet(parseFloat(width), widthUnit) * toFeet(parseFloat(height), heightUnit);
  if (targetUnit === "sqm") return areaInSqFt * 0.092903;
  return areaInSqFt;
};

// ─── Build unit stock summary ─────────────────────────────────────────────────
function buildUnitSummary(stockInfo = [], stockOffline = [], fallbackUnit = "pcs") {
  const map = {};
  stockInfo.forEach((e) => {
    const { qty = e.add_stock || 0, unit = fallbackUnit } = e.unit_qty || {};
    if (!map[unit]) map[unit] = { unit, total_in: 0, total_out: 0 };
    map[unit].total_in += Number(qty);
  });
  stockOffline.forEach((e) => {
    const { qty = e.stock || 0, unit = fallbackUnit } = e.unit_qty || {};
    if (!map[unit]) map[unit] = { unit, total_in: 0, total_out: 0 };
    map[unit].total_out += Number(qty);
  });
  return Object.values(map).map((r) => ({ ...r, net_stock: r.total_in - r.total_out }));
}

function groupByUnit(arr = []) {
  const t = {};
  arr.forEach(({ qty = 0, unit = "pcs" } = {}) => { t[unit] = (t[unit] || 0) + Number(qty); });
  return t;
}

// ─── Device detection ─────────────────────────────────────────────────────────
const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && window.innerWidth <= 768);

// ─── Image helpers ─────────────────────────────────────────────────────────────
const createImageObject = (url, existingId = null) => ({
  _id: existingId || uuidv4(),
  path: url,
  url,
  type: "image",
  uploadedAt: new Date().toISOString(),
});

// ─── SortableImage ────────────────────────────────────────────────────────────
const SortableImage = ({ id, image, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const imageUrl = image.url || image.path || image;
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div {...attributes} {...listeners}
        className="absolute top-1 left-1 z-20 bg-blue-500 bg-opacity-80 text-white p-1 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: 24, height: 24 }}>
        <div className="flex items-center justify-center w-full h-full">⠿</div>
      </div>
      <Image src={imageUrl} alt="Product" width={80} height={80}
        className="object-cover rounded border-2 border-dashed border-gray-300"
        preview={{ mask: <span className="text-white text-xs">Preview</span> }} />
      <button type="button"
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center border-0 cursor-pointer z-20"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(id); }}>
        <DeleteFilled className="text-xs" />
      </button>
    </div>
  );
};

const SortableImageList = ({ images, setImages }) => {
  const getId = (img) => img._id || img.path || img;
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oi = images.findIndex((img) => getId(img) === active.id);
    const ni = images.findIndex((img) => getId(img) === over.id);
    if (oi !== -1 && ni !== -1) setImages(arrayMove(images, oi, ni));
  };
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={images.map(getId)}>
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg min-h-[5rem] border border-dashed border-gray-300 mt-2">
          {images.map((img) => (
            <SortableImage key={getId(img)} id={getId(img)} image={img}
              onRemove={(id) => setImages(images.filter((i) => getId(i) !== id))} />
          ))}
          {images.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400 text-sm">No images yet</div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// ─── UploadHelper ─────────────────────────────────────────────────────────────
const UploadHelper = ({ max = 10, setImagePath, image_path = [], label = "Upload Images", fieldKey }) => {
  const [uploading, setUploading] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => { setIsMobile(isMobileDevice()); }, []);

  const processFiles = async (files) => {
    if (!files?.length) return;
    try {
      setUploading(true);
      const uploaded = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) { message.warning(`${file.name} is not an image`); continue; }
        if (file.size > 5 * 1024 * 1024)    { message.warning(`${file.name} exceeds 5MB`);     continue; }
        const fd = new FormData();
        fd.append("image", file);
        const result = await uploadImage(fd);
        const url = _.get(result, "data.data.url", "");
        if (url) uploaded.push(createImageObject(url));
      }
      if (uploaded.length) {
        setImagePath([...(Array.isArray(image_path) ? image_path : []), ...uploaded].slice(0, max));
        message.success(`Uploaded ${uploaded.length} image(s)`);
      }
    } catch { message.error("Upload failed"); }
    finally {
      setUploading(false);
      if (fileInputRef.current)   fileInputRef.current.value   = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleFileChange   = async (e) => { await processFiles(e.target.files); setShowMobileOptions(false); };
  const handleUploadClick  = () => { isMobile ? setShowMobileOptions(true) : fileInputRef.current?.click(); };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange}
        className="!hidden" id={`up-gallery-${fieldKey || "img"}`} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} className="!hidden" id={`up-camera-${fieldKey || "img"}`} />
      <button type="button" onClick={handleUploadClick} disabled={uploading}
        className="cursor-pointer flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-colors bg-gray-50 w-fit disabled:opacity-50 disabled:cursor-not-allowed">
        {uploading ? <Spin size="small" /> : <PlusOutlined />}
        {uploading ? "Uploading..." : label}
      </button>
      {isMobile && showMobileOptions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowMobileOptions(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-center text-gray-700 font-semibold mb-4 text-base">Add Image</p>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor={`up-camera-${fieldKey || "img"}`}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-blue-50 border-2 border-blue-200 rounded-xl cursor-pointer"
                onClick={() => setShowMobileOptions(false)}>
                <CameraOutlined style={{ fontSize: 32, color: "#2563eb" }} />
                <span className="text-sm font-semibold text-blue-700">Camera</span>
              </label>
              <label htmlFor={`up-gallery-${fieldKey || "img"}`}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-green-50 border-2 border-green-200 rounded-xl cursor-pointer"
                onClick={() => setShowMobileOptions(false)}>
                <UploadOutlined style={{ fontSize: 32, color: "#16a34a" }} />
                <span className="text-sm font-semibold text-green-700">Gallery</span>
              </label>
            </div>
            <button type="button" onClick={() => setShowMobileOptions(false)}
              className="mt-4 w-full py-3 text-sm text-gray-500 font-medium rounded-xl bg-gray-100 border-0">Cancel</button>
          </div>
        </div>
      )}
      {image_path?.length > 0 && <SortableImageList images={image_path} setImages={setImagePath} />}
    </div>
  );
};

// ─── UnitQtyInput ─────────────────────────────────────────────────────────────
const UnitQtyInput = ({ value, onChange, disabled = false, size = "large", min = 0 }) => {
  const qty = value?.qty ?? "";
  return (
    <InputNumber
      value={qty === "" ? null : qty}
      onChange={(v) => onChange({ qty: v ?? 0 })}
      min={min}
      placeholder="0"
      size={size}
      disabled={disabled}
      style={{ width: "100%", borderRadius: 10 }}
      formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
      parser={(v) => v.replace(/,/g, "")}
    />
  );
};

// ─── AreaProgressBar ─────────────────────────────────────────────────────────
const AreaProgressBar = ({ calculated, remaining, unit, showLabel = true }) => {
  if (calculated == null || !isAreaUnit(unit)) return null;
  const used = Math.max(0, (calculated || 0) - (remaining || 0));
  const pct  = calculated > 0 ? Math.min(100, (used / calculated) * 100) : 0;
  const color = pct >= 90 ? "#dc2626" : pct >= 60 ? "#d97706" : "#16a34a";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 font-medium">Area Used</span>
          <span className="font-bold" style={{ color }}>
            {used.toFixed(2)} / {(calculated || 0).toFixed(2)} {unitLabel(unit)}
          </span>
        </div>
      )}
      <Progress
        percent={parseFloat(pct.toFixed(1))}
        strokeColor={color}
        trailColor="#f0f0f0"
        showInfo={showLabel}
        size="small"
        format={(p) => <span style={{ fontSize: 10, color }}>{p}% used</span>}
      />
      {showLabel && (
        <div className="flex justify-between text-xs mt-0.5">
          <span className="text-green-600 font-semibold">
            Remaining: {(remaining || 0).toFixed(2)} {unitLabel(unit)}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── UnitStockSummaryCard ─────────────────────────────────────────────────────
const UnitStockSummaryCard = ({ product }) => {
  const summary     = _.get(product, "unit_stock_summary", []);
  const primaryUnit = _.get(product, "primary_unit", "pcs");

  const computed = useMemo(() => {
    if (summary.length > 0) return summary;
    const inEntries  = _.get(product, "stock_info",    []);
    const outEntries = _.get(product, "stock_offline", []);
    const map = {};
    inEntries.forEach((e) => {
      const { qty = e.add_stock || 0, unit = primaryUnit } = e.unit_qty || {};
      if (!map[unit]) map[unit] = { unit, total_in: 0, total_out: 0 };
      map[unit].total_in += Number(qty);
    });
    outEntries.forEach((e) => {
      const { qty = e.stock || 0, unit = primaryUnit } = e.unit_qty || {};
      if (!map[unit]) map[unit] = { unit, total_in: 0, total_out: 0 };
      map[unit].total_out += Number(qty);
    });
    return Object.values(map).map((r) => ({ ...r, net_stock: r.total_in - r.total_out }));
  }, [summary, product, primaryUnit]);

  if (!computed.length) return <span className="text-xs text-gray-400">No stock data</span>;

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      {computed.map(({ unit, net_stock, total_in, total_out }) => (
        <Tooltip key={unit} title={`IN: ${formatQty(total_in, unit)} | OUT: ${formatQty(total_out, unit)}`}>
          <div className="flex justify-between gap-2 text-xs cursor-help">
            <span className="font-semibold px-1 rounded"
              style={{
                background: unit === primaryUnit ? "#eff6ff" : "#f3f4f6",
                color: unit === primaryUnit ? "#1d4ed8" : "#6b7280",
                fontSize: 10,
              }}>
              {unitLabel(unit)}
            </span>
            <span className={`font-bold ${net_stock > 0 ? "text-gray-800" : "text-red-500"}`}>
              {Number(net_stock).toLocaleString()}
            </span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

// ─── Stock Range Filter ───────────────────────────────────────────────────────
const STOCK_PRESETS = [
  { label: "Out of Stock", min: 0,   max: 0,    color: "#dc2626", bg: "#fff1f2", border: "#fecaca" },
  { label: "Low (1–10)",   min: 1,   max: 10,   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { label: "Medium (11–50)",min: 11, max: 50,   color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "High (50+)",   min: 50,  max: null, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
];

const StockRangeFilter = ({ stockMin, stockMax, onStockMinChange, onStockMaxChange, onClear }) => {
  const hasActive = stockMin !== "" || stockMax !== "";
  const handlePreset = (preset) => {
    if (stockMin === (preset.min ?? "") && stockMax === (preset.max ?? "")) {
      onStockMinChange(""); onStockMaxChange("");
    } else {
      onStockMinChange(preset.min ?? ""); onStockMaxChange(preset.max ?? "");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {STOCK_PRESETS.map((preset) => {
          const active = stockMin === (preset.min ?? "") && stockMax === (preset.max ?? "");
          return (
            <button key={preset.label} type="button" onClick={() => handlePreset(preset)}
              style={{
                background: active ? preset.color : preset.bg,
                borderColor: active ? preset.color : preset.border,
                color: active ? "#fff" : preset.color,
                border: "1.5px solid", borderRadius: 20,
                padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <InputNumber placeholder="Min" min={0} value={stockMin === "" ? null : stockMin}
          onChange={(val) => onStockMinChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} />
        <span className="text-gray-400 font-bold text-lg flex-shrink-0">—</span>
        <InputNumber placeholder="Max" min={0} value={stockMax === "" ? null : stockMax}
          onChange={(val) => onStockMaxChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} />
        {hasActive && (
          <Button size="large" onClick={onClear} style={{ borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}>✕</Button>
        )}
      </div>
    </div>
  );
};

// ─── Price Range Filter ───────────────────────────────────────────────────────
const PRICE_PRESETS = [
  { label: "Under ₹500",    min: null, max: 500,  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { label: "₹500–₹1,000",  min: 500,  max: 1000, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "₹1k–₹5k",      min: 1000, max: 5000, color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  { label: "₹5,000+",       min: 5000, max: null, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
];

const PriceRangeFilter = ({ priceMin, priceMax, onPriceMinChange, onPriceMaxChange, onClear }) => {
  const hasActive = priceMin !== "" || priceMax !== "";
  const handlePreset = (preset) => {
    const pMin = preset.min ?? ""; const pMax = preset.max ?? "";
    if (priceMin === pMin && priceMax === pMax) { onPriceMinChange(""); onPriceMaxChange(""); }
    else { onPriceMinChange(pMin); onPriceMaxChange(pMax); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRICE_PRESETS.map((preset) => {
          const active = priceMin === (preset.min ?? "") && priceMax === (preset.max ?? "");
          return (
            <button key={preset.label} type="button" onClick={() => handlePreset(preset)}
              style={{
                background: active ? preset.color : preset.bg,
                borderColor: active ? preset.color : preset.border,
                color: active ? "#fff" : preset.color,
                border: "1.5px solid", borderRadius: 20,
                padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <InputNumber placeholder="Min ₹" min={0} value={priceMin === "" ? null : priceMin}
          onChange={(val) => onPriceMinChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }}
          formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
          parser={(v) => v.replace(/,/g, "")} />
        <span className="text-gray-400 font-bold text-lg flex-shrink-0">—</span>
        <InputNumber placeholder="Max ₹" min={0} value={priceMax === "" ? null : priceMax}
          onChange={(val) => onPriceMaxChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }}
          formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
          parser={(v) => v.replace(/,/g, "")} />
        {hasActive && (
          <Button size="large" onClick={onClear} style={{ borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}>✕</Button>
        )}
      </div>
    </div>
  );
};

// ─── Size display helper ──────────────────────────────────────────────────────
const renderSizeCell = (size) => {
  if (!size || (size.width == null && size.height == null)) {
    return <span className="text-xs text-gray-400 italic">—</span>;
  }
  const wUnit = size.width_unit  || size.unit || "feet";
  const hUnit = size.height_unit || size.unit || "feet";
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
      style={{ background: "#fefce8", color: "#92400e", border: "1px solid #fde68a" }}>
      📐 {size.width ?? "—"} {wUnit} × {size.height ?? "—"} {hUnit}
    </span>
  );
};

// ─── SizeInputGroup — reusable size fields (used for ALL unit types) ──────────
const SizeInputGroup = ({ value, onChange, required = false }) => {
  const { width = "", width_unit = "feet", height = "", height_unit = "feet" } = value || {};
  const update = (patch) => onChange({ width, width_unit, height, height_unit, ...patch });

  return (
    <div className="flex gap-4 items-start">
      <div className="flex-1">
        <Text className="text-sm font-semibold text-gray-600 block mb-2">
          Width {required && <span className="text-red-500">*</span>}
        </Text>
        <div className="flex gap-2">
          <input
            type="number"
            value={width}
            onChange={(e) => update({ width: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-0"
            placeholder="Width"
          />
          <select
            value={width_unit}
            onChange={(e) => update({ width_unit: e.target.value, height_unit: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            {SIZE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1">
        <Text className="text-sm font-semibold text-gray-600 block mb-2">
          Height {required && <span className="text-red-500">*</span>}
        </Text>
        <div className="flex gap-2">
          <input
            type="number"
            value={height}
            onChange={(e) => update({ height: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-0"
            placeholder="Height"
          />
          <select
            value={height_unit}
            onChange={(e) => update({ height_unit: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            {SIZE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BATCH AREA TRACKER MODAL ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const BatchAreaTrackerModal = ({ open, onClose, batchProducts = [], onStockOut }) => {
  const [activeProduct, setActiveProduct] = useState(null);

  if (!batchProducts.length) return null;

  const firstProduct = batchProducts[0];
  const primaryUnit  = firstProduct?.primary_unit || "sqft";
  const batchId      = firstProduct?.batch_id;

  const totalCalculated = batchProducts.reduce((s, p) => s + (p.calculated_area || 0), 0);
  const totalRemaining  = batchProducts.reduce((s, p) => s + (p.remaining_area  || 0), 0);
  const totalUsed       = totalCalculated - totalRemaining;
  const batchPct        = totalCalculated > 0 ? (totalUsed / totalCalculated) * 100 : 0;

  const allAllocations = batchProducts.flatMap((p) =>
    (p.allocations || []).map((a) => ({
      ...a,
      product_code: p.product_code,
      product_name: p.name,
      product_id:   p._id,
    }))
  ).sort((a, b) => new Date(b.allocated_at) - new Date(a.allocated_at));

  const statusColor = (s) => {
    if (s === "allocated")      return { color: "#d97706", bg: "#fffbeb", label: "Allocated" };
    if (s === "returned")       return { color: "#16a34a", bg: "#f0fdf4", label: "Returned" };
    if (s === "consumed")       return { color: "#dc2626", bg: "#fff1f2", label: "Consumed" };
    if (s === "partial_return") return { color: "#7c3aed", bg: "#f5f3ff", label: "Partial Return" };
    return { color: "#6b7280", bg: "#f3f4f6", label: s };
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose
      styles={{ body: { padding: 0 } }}
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center">
            <AppstoreOutlined style={{ color: "#0d9488", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Batch Area Tracker</div>
            <div className="text-xs text-gray-500 font-normal">
              Batch ID: <span className="font-mono font-bold text-teal-600">{batchId?.slice(0, 8)}…</span>
              {" · "}{batchProducts.length} products
            </div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Tag color="blue"  className="font-semibold">Total: {totalCalculated.toFixed(2)} {unitLabel(primaryUnit)}</Tag>
            <Tag color="green" className="font-semibold">Left: {totalRemaining.toFixed(2)} {unitLabel(primaryUnit)}</Tag>
            <Tag color="red"   className="font-semibold">Used: {totalUsed.toFixed(2)} {unitLabel(primaryUnit)}</Tag>
          </div>
        </div>
      }
    >
      <div className="p-6">
        <div className="mb-5 p-4 rounded-2xl" style={{ background: "linear-gradient(135deg,#f0fdf4,#eff6ff)", border: "1.5px solid #bbf7d0" }}>
          <div className="flex items-center justify-between mb-2">
            <Text className="text-sm font-bold text-gray-800">Batch Overall Usage</Text>
            <Text className="text-sm font-bold" style={{ color: batchPct > 80 ? "#dc2626" : "#16a34a" }}>
              {batchPct.toFixed(1)}% used
            </Text>
          </div>
          <Progress
            percent={parseFloat(batchPct.toFixed(1))}
            strokeColor={batchPct > 80 ? "#dc2626" : batchPct > 50 ? "#d97706" : "#16a34a"}
            trailColor="#e5e7eb"
            size={["100%", 14]}
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>0</span>
            <span>{totalCalculated.toFixed(2)} {unitLabel(primaryUnit)}</span>
          </div>
        </div>

        <Tabs defaultActiveKey="products" size="small" items={[
          {
            key: "products",
            label: <span className="font-semibold">📦 Per-Product Breakdown ({batchProducts.length})</span>,
            children: (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {batchProducts.map((product) => {
                  const calc = product.calculated_area || 0;
                  const rem  = product.remaining_area  ?? calc;
                  const used = calc - rem;
                  const pct  = calc > 0 ? (used / calc) * 100 : 0;
                  const allocCount = (product.allocations || []).length;
                  const activeAllocCount = (product.allocations || []).filter(
                    (a) => a.status === "allocated" || a.status === "partial_return"
                  ).length;
                  const pctColor = pct >= 90 ? "#dc2626" : pct >= 60 ? "#d97706" : "#0d9488";

                  return (
                    <div key={product._id}
                      className="rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md"
                      style={{
                        border: activeProduct?._id === product._id
                          ? "2px solid #0d9488"
                          : "1.5px solid #e5e7eb",
                        background: pct >= 100 ? "#fff1f2" : "#fff",
                      }}
                      onClick={() => setActiveProduct(activeProduct?._id === product._id ? null : product)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{product.product_code}</div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{product.name}</div>
                        </div>
                        {pct >= 100 ? (
                          <Tag color="error" className="text-xs font-bold">USED UP</Tag>
                        ) : activeAllocCount > 0 ? (
                          <Tag color="warning" className="text-xs font-semibold">{activeAllocCount} active</Tag>
                        ) : (
                          <Tag color="success" className="text-xs">Available</Tag>
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Used</span>
                          <span className="font-bold" style={{ color: pctColor }}>
                            {used.toFixed(2)} / {calc.toFixed(2)} {unitLabel(primaryUnit)}
                          </span>
                        </div>
                        <Progress
                          percent={parseFloat(pct.toFixed(1))}
                          strokeColor={pctColor}
                          size="small"
                          showInfo={false}
                        />
                        <div className="text-xs text-green-600 font-semibold mt-0.5">
                          Remaining: {rem.toFixed(2)} {unitLabel(primaryUnit)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{allocCount} allocation{allocCount !== 1 ? "s" : ""}</span>
                        <div className="flex gap-1">
                          {pct < 100 && (
                            <Button size="small" type="primary"
                              style={{ fontSize: 10, height: 22, padding: "0 8px", borderRadius: 6, background: "#0d9488", borderColor: "#0d9488" }}
                              onClick={(e) => { e.stopPropagation(); onStockOut(product); }}>
                              Stock OUT
                            </Button>
                          )}
                        </div>
                      </div>

                      {activeProduct?._id === product._id && (product.allocations || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <Text className="text-xs font-bold text-gray-600 block mb-2">Allocation History</Text>
                          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                            {product.allocations.map((alloc, idx) => {
                              const st = statusColor(alloc.status);
                              return (
                                <div key={alloc._id || idx} className="rounded-lg p-2"
                                  style={{ background: st.bg, border: `1px solid ${st.color}22` }}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
                                    <span className="text-xs font-bold text-gray-700">
                                      {(alloc.alloc_unit_qty?.qty || 0).toFixed(2)} {unitLabel(primaryUnit)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    To: <span className="font-semibold">{alloc.allocated_to || "—"}</span>
                                  </div>
                                  {alloc.job_no && (
                                    <div className="text-xs text-gray-500">Job: {alloc.job_no}</div>
                                  )}
                                  {alloc.returned_qty != null && (
                                    <div className="text-xs text-green-600 font-semibold">
                                      Returned: {alloc.returned_qty.toFixed(2)} {unitLabel(primaryUnit)}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {moment(alloc.allocated_at).format("DD/MM/YYYY h:mm A")}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
          },
          {
            key: "allocations",
            label: <span className="font-semibold">📋 All Allocations ({allAllocations.length})</span>,
            children: (
              <Table
                dataSource={allAllocations.map((a, i) => ({ ...a, key: i }))}
                size="small"
                scroll={{ x: 900 }}
                pagination={{ pageSize: 10, size: "small" }}
                columns={[
                  {
                    title: "Product Code",
                    dataIndex: "product_code",
                    width: 130,
                    render: (v) => (
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "#dbeafe", color: "#1d4ed8" }}>{v}</span>
                    ),
                  },
                  {
                    title: "Area Taken",
                    dataIndex: "alloc_unit_qty",
                    width: 120,
                    align: "center",
                    render: (uq) => (
                      <span className="font-bold text-orange-600">
                        {(uq?.qty || 0).toFixed(2)} {unitLabel(uq?.unit || primaryUnit)}
                      </span>
                    ),
                  },
                  {
                    title: "Remaining After",
                    dataIndex: "remaining_area_after",
                    width: 140,
                    render: (v) => v != null ? (
                      <span className="font-semibold text-green-700">
                        {v.toFixed(2)} {unitLabel(primaryUnit)}
                      </span>
                    ) : "—",
                  },
                  { title: "Allocated To", dataIndex: "allocated_to", render: (v) => <span className="text-xs font-semibold">{v || "—"}</span> },
                  { title: "Job No.", dataIndex: "job_no", render: (v) => <span className="font-mono text-xs">{v || "—"}</span> },
                  { title: "By", dataIndex: "allocated_by", render: (v) => <span className="text-xs">{v || "—"}</span> },
                  {
                    title: "Status",
                    dataIndex: "status",
                    width: 120,
                    render: (s) => {
                      const st = statusColor(s);
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      );
                    },
                  },
                  { title: "Date", dataIndex: "allocated_at", width: 135, render: (v) => <span className="text-xs text-gray-500">{v ? moment(v).format("DD/MM/YYYY h:mm A") : "—"}</span> },
                  {
                    title: "Return",
                    dataIndex: "returned_qty",
                    width: 100,
                    render: (v, record) => v != null ? (
                      <span className="text-xs font-semibold text-green-600">{v.toFixed(2)} {unitLabel(primaryUnit)}</span>
                    ) : record.status === "allocated" ? (
                      <Tag color="warning" className="text-xs">Pending</Tag>
                    ) : "—",
                  },
                ]}
              />
            ),
          },
        ]} />
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── STOCK OUT MODAL ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const StockOutModal = ({ open, onClose, product, onSuccess, apiStockOut }) => {
  const [form]    = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [unitQty, setUnitQty] = useState({ qty: 0 });

  const primaryUnit  = _.get(product, "primary_unit", "pcs");
  const currentStock = _.get(product, "stock_count",  0);
  const calcArea     = _.get(product, "calculated_area", null);
  const remArea      = _.get(product, "remaining_area", calcArea);
  const isArea       = isAreaUnit(primaryUnit);

  useEffect(() => {
    if (!open) { form.resetFields(); setUnitQty({ qty: 0 }); }
    else { setUnitQty({ qty: 0 }); }
  }, [open, primaryUnit]);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const qty = unitQty.qty;
      if (!qty || qty <= 0) { message.error("Enter a valid quantity"); return; }

      if (isArea && remArea != null && qty > remArea) {
        message.error(`Not enough area — only ${remArea.toFixed(2)} ${unitLabel(primaryUnit)} remaining`);
        return;
      }
      if (!isArea && qty > currentStock) {
        message.error(`Cannot remove ${formatQty(qty, primaryUnit)} — only ${formatQty(currentStock, primaryUnit)} in stock`);
        return;
      }

      await apiStockOut(product._id, {
        qty,
        taken_by:         values.taken_by         || "",
        customer_details: values.customer_details || "",
        job_no:           values.job_no           || "",
        handler_name:     values.handler_name     || "",
        location:         values.location         || "",
        notes:            values.notes            || "",
        date:             values.date ? values.date.toISOString() : new Date().toISOString(),
      });

      message.success("Stock OUT recorded with area & allocation tracking");
      onSuccess();
      onClose();
    } catch (err) {
      ERROR_NOTIFICATION(err);
    } finally {
      setLoading(false);
    }
  };

  const afterQty  = isArea
    ? Math.max(0, (remArea || 0) - (unitQty.qty || 0))
    : Math.max(0, currentStock - (unitQty.qty || 0));

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={680} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <ArrowDownOutlined style={{ color: "#dc2626" }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Stock OUT</div>
            <div className="text-xs text-gray-500">{product?.name}</div>
            {product?.product_code && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded font-bold"
                style={{ background: "#dbeafe", color: "#1d4ed8" }}>{product.product_code}</span>
            )}
          </div>
          <div className="ml-auto flex gap-2 flex-wrap text-right">
            <Tag color="blue" className="font-semibold text-xs">{UNIT_MAP[primaryUnit]?.icon} {unitLabel(primaryUnit)}</Tag>
            {isArea ? (
              <Tag color="green" className="font-semibold text-xs">
                Area Left: {(remArea || 0).toFixed(2)} {unitLabel(primaryUnit)}
              </Tag>
            ) : (
              <Tag color="error" className="font-semibold">Stock: {formatQty(currentStock, primaryUnit)}</Tag>
            )}
          </div>
        </div>
      }
    >
      {isArea && calcArea != null && (
        <div className="px-1 pt-4">
          <AreaProgressBar calculated={calcArea} remaining={remArea} unit={primaryUnit} />
        </div>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Text className="text-sm font-semibold text-gray-700 mb-1 block">
              {isArea ? "Area to Remove" : "Quantity to Remove"} <span className="text-red-500">*</span>
            </Text>
            <UnitQtyInput
              value={unitQty}
              onChange={(v) => {
                if (isArea && v.qty > (remArea || 0)) {
                  message.warning(`Max: ${(remArea || 0).toFixed(2)} ${unitLabel(primaryUnit)}`);
                } else if (!isArea && v.qty > currentStock) {
                  message.warning(`Max: ${formatQty(currentStock, primaryUnit)}`);
                }
                setUnitQty(v);
              }}
            />
            {unitQty.qty > 0 && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                  style={{ background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  <ArrowDownOutlined />
                  Removing: {isArea ? `${unitQty.qty.toFixed(2)} ${unitLabel(primaryUnit)}` : formatQty(unitQty.qty, primaryUnit)}
                </div>
                <div className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                  After: {isArea ? `${afterQty.toFixed(2)} ${unitLabel(primaryUnit)}` : formatQty(afterQty, primaryUnit)}
                </div>
              </div>
            )}
          </div>

          <Form.Item label="Taken By (Person Name)" name="taken_by">
            <Input placeholder="Name of person taking this" className="h-10" prefix={<TeamOutlined className="text-gray-400" />} />
          </Form.Item>
          <Form.Item label="Customer / Job Description" name="customer_details">
            <Input placeholder="Customer name or job description" className="h-10" />
          </Form.Item>
          <Form.Item label="Job / Work Order No." name="job_no">
            <Input placeholder="e.g. JOB-2024-001" className="h-10" prefix={<BarcodeOutlined className="text-gray-400" />} />
          </Form.Item>
          <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
            <Input placeholder="Who processed this OUT?" className="h-10" />
          </Form.Item>
          <Form.Item label="Location / Destination" name="location">
            <Input placeholder="Where is it going?" className="h-10" />
          </Form.Item>
          <Form.Item label="Date & Time" name="date" rules={[formValidation("Select a date")]}>
            <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
          </Form.Item>
          <Form.Item label="Notes" name="notes" className="md:col-span-2">
            <Input.TextArea placeholder="Reason for removal, any additional context..." rows={2} />
          </Form.Item>
        </div>

        {isArea && (
          <Alert type="info" showIcon className="mb-4 rounded-xl"
            message={
              <span className="text-xs">
                This product tracks <strong>area usage</strong>.
                The allocation will be recorded with who took it, how much area was used,
                and the remaining area on this specific product.
              </span>
            }
          />
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<ArrowDownOutlined />}
            className="rounded-lg px-6 h-10 font-semibold" danger>
            Confirm Stock OUT
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ─── Return Allocation Modal ──────────────────────────────────────────────────
const ReturnAllocationModal = ({ open, onClose, product, onSuccess, apiReturnAllocation }) => {
  const [loading, setLoading] = useState(false);
  const [selectedAllocId, setSelectedAllocId] = useState(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnNotes, setReturnNotes] = useState("");

  const primaryUnit = _.get(product, "primary_unit", "pcs");
  const allocations = (_.get(product, "allocations", []) || []).filter(
    (a) => a.status === "allocated" || a.status === "partial_return"
  );

  useEffect(() => {
    if (!open) { setSelectedAllocId(null); setReturnQty(0); setReturnNotes(""); }
  }, [open]);

  const selectedAlloc = allocations.find((a) => a._id === selectedAllocId);
  const maxReturn = selectedAlloc
    ? (selectedAlloc.alloc_unit_qty?.qty || 0) - (selectedAlloc.returned_qty || 0)
    : 0;

  const handleReturn = async () => {
    if (!selectedAllocId) { message.error("Select an allocation to return against"); return; }
    if (!returnQty || returnQty <= 0) { message.error("Enter return quantity"); return; }
    if (returnQty > maxReturn) { message.error(`Max returnable: ${maxReturn.toFixed(2)} ${unitLabel(primaryUnit)}`); return; }

    try {
      setLoading(true);
      await apiReturnAllocation(product._id, {
        allocation_id: selectedAllocId,
        returned_qty:  returnQty,
        return_notes:  returnNotes,
      });
      message.success("Return recorded successfully");
      onSuccess();
      onClose();
    } catch (err) {
      ERROR_NOTIFICATION(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={620} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <RollbackOutlined style={{ color: "#7c3aed" }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Return Allocation</div>
            <div className="text-xs text-gray-500">{product?.name}</div>
          </div>
          <Tag color="purple" className="ml-auto font-semibold">{allocations.length} returnable</Tag>
        </div>
      }
    >
      {allocations.length === 0 ? (
        <Empty description="No active allocations to return" className="py-8" />
      ) : (
        <div className="py-4 flex flex-col gap-4">
          <div>
            <Text className="text-sm font-semibold text-gray-700 mb-2 block">Select Allocation</Text>
            <div className="flex flex-col gap-2">
              {allocations.map((alloc) => {
                const taken     = alloc.alloc_unit_qty?.qty || 0;
                const ret       = alloc.returned_qty || 0;
                const canReturn = taken - ret;
                const selected  = selectedAllocId === alloc._id;
                return (
                  <div key={alloc._id}
                    className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                    style={{ borderColor: selected ? "#7c3aed" : "#e5e7eb", background: selected ? "#f5f3ff" : "#fff" }}
                    onClick={() => { setSelectedAllocId(alloc._id); setReturnQty(0); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{alloc.allocated_to || "Unknown"}</span>
                        {alloc.job_no && <span className="ml-2 font-mono text-xs text-gray-500">#{alloc.job_no}</span>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600 text-sm">Took: {taken.toFixed(2)} {unitLabel(primaryUnit)}</div>
                        <div className="text-xs text-green-600">Can return: {canReturn.toFixed(2)} {unitLabel(primaryUnit)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {moment(alloc.allocated_at).format("DD/MM/YYYY h:mm A")}
                      {ret > 0 && <span className="ml-2 text-green-600">Already returned: {ret.toFixed(2)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedAlloc && (
            <>
              <div>
                <Text className="text-sm font-semibold text-gray-700 mb-1 block">
                  Return Quantity (max: {maxReturn.toFixed(2)} {unitLabel(primaryUnit)})
                </Text>
                <InputNumber value={returnQty || null} onChange={(v) => setReturnQty(v || 0)}
                  min={0.01} max={maxReturn} step={0.01} size="large"
                  style={{ width: "100%", borderRadius: 10 }} placeholder={`0 – ${maxReturn.toFixed(2)}`} />
              </div>
              <div>
                <Text className="text-sm font-semibold text-gray-700 mb-1 block">Return Notes</Text>
                <Input.TextArea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2} placeholder="Reason for return..." />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
            <Button type="primary" loading={loading} icon={<RollbackOutlined />}
              onClick={handleReturn}
              style={{ background: "#7c3aed", borderColor: "#7c3aed", borderRadius: 8 }}
              className="px-6 h-10 font-semibold">
              Confirm Return
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─── StockInModal ─────────────────────────────────────────────────────────────
const StockInModal = ({ open, onClose, product, onSuccess }) => {
  const [form]    = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [images, setImages]   = useState([]);
  const [unitQty, setUnitQty] = useState({ qty: 0 });

  const primaryUnit = _.get(product, "primary_unit", "pcs");

  useEffect(() => {
    if (!open) { form.resetFields(); setImages([]); setUnitQty({ qty: 0 }); }
  }, [open]);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const existingStockInfo = _.get(product, "stock_info", []).map((item) => ({
        ...item,
        date: item.date ? new Date(item.date).toISOString() : null,
      }));

      const newEntry = {
        _id:          uuidv4(),
        add_stock:    unitQty.qty,
        unit_qty:     { qty: unitQty.qty, unit: primaryUnit },
        handler_name: values.handler_name || "",
        location:     values.location     || "",
        invoice:      values.invoice      || "",
        invoice_date: values.invoice_date ? values.invoice_date.toISOString() : null,
        notes:        values.notes        || "",
        stock_images: images.map((img) => ({ _id: img._id, path: img.path, url: img.url })),
        date:         values.date ? values.date.toISOString() : new Date().toISOString(),
      };

      const updatedStockInfo = [...existingStockInfo, newEntry];
      const existingOut      = _.get(product, "stock_offline", []);
      const newSummary       = buildUnitSummary(updatedStockInfo, existingOut, primaryUnit);
      const primarySummary   = newSummary.find((s) => s.unit === primaryUnit);
      const newStockCount    = primarySummary ? primarySummary.net_stock : 0;

      const result = await editProduct(
        { stock_info: updatedStockInfo, unit_stock_summary: newSummary, stock_count: newStockCount },
        product._id
      );
      SUCCESS_NOTIFICATION(result);
      onSuccess();
      onClose();
    } catch (err) {
      ERROR_NOTIFICATION(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={700} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <ArrowUpOutlined style={{ color: "#16a34a" }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Stock IN</div>
            <div className="text-xs text-gray-500">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <Tag color="blue" className="font-semibold text-xs">{UNIT_MAP[primaryUnit]?.icon} {unitLabel(primaryUnit)}</Tag>
            <Tag color="success" className="font-semibold">Current: {formatQty(_.get(product, "stock_count", 0), primaryUnit)}</Tag>
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Text className="text-sm font-semibold text-gray-700 mb-1 block">
              Add Stock Quantity <span className="text-red-500">*</span>
            </Text>
            <UnitQtyInput value={unitQty} onChange={setUnitQty} />
            {unitQty.qty > 0 && (
              <div className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                <ArrowUpOutlined /> Adding {formatQty(unitQty.qty, primaryUnit)}
              </div>
            )}
          </div>
          <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
            <Input placeholder="Who handled this?" className="h-10" />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input placeholder="Warehouse Rack no" className="h-10" />
          </Form.Item>
          <Form.Item label="Date & Time" name="date" rules={[formValidation("Select a date")]}>
            <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
          </Form.Item>
          <Form.Item label="Invoice No." name="invoice">
            <Input placeholder="INV-001" className="h-10" />
          </Form.Item>
          <Form.Item label="Invoice Date" name="invoice_date">
            <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
          </Form.Item>
          <Form.Item label="Notes" name="notes" className="md:col-span-2">
            <Input.TextArea placeholder="Any additional notes..." rows={2} />
          </Form.Item>
          <Form.Item label="Stock Images" className="md:col-span-2">
            <UploadHelper max={10} setImagePath={setImages} image_path={images} label="Upload Images" fieldKey="stock-in" />
          </Form.Item>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<ArrowUpOutlined />}
            className="rounded-lg px-6 h-10 font-semibold" style={{ background: "#16a34a", borderColor: "#16a34a" }}>
            Confirm Stock IN
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ─── StockHistoryModal ────────────────────────────────────────────────────────
const StockHistoryModal = ({ open, onClose, product }) => {
  const primaryUnit = _.get(product, "primary_unit", "pcs");

  const stockIn = _.get(product, "stock_info", []).map((item, i) => ({
    key:          `in-${i}`,
    unit_qty:     item.unit_qty || { qty: item.add_stock, unit: primaryUnit },
    handler_name: item.handler_name || "—",
    location:     item.location     || "—",
    invoice:      item.invoice      || "—",
    notes:        item.notes        || "—",
    date:         item.date ? moment(item.date).format("DD/MM/YYYY h:mm A") : "—",
    images:       item.stock_images || [],
  }));

  const stockOut = _.get(product, "stock_offline", []).map((item, i) => ({
    key:              `out-${i}`,
    unit_qty:         item.unit_qty || { qty: item.stock, unit: primaryUnit },
    handler_name:     item.handler_name     || "—",
    location:         item.location         || "—",
    customer_details: item.customer_details || "—",
    taken_by:         item.taken_by         || "—",
    job_no:           item.job_no           || "—",
    area_used:        item.area_used,
    remaining_area:   item.remaining_area,
    notes:            item.notes            || "—",
    date:             item.date ? moment(item.date).format("DD/MM/YYYY h:mm A") : "—",
  }));

  const inTotals  = groupByUnit(stockIn.map((r) => r.unit_qty));
  const outTotals = groupByUnit(stockOut.map((r) => r.unit_qty));
  const allUnits  = [...new Set([...Object.keys(inTotals), ...Object.keys(outTotals)])];

  const inColumns = [
    { title: "Date",     dataIndex: "date",         width: 145, render: (t) => <span className="text-xs text-gray-600">{t}</span> },
    { title: "Qty",      dataIndex: "unit_qty",      width: 110, align: "center", render: (uq) => <span className="font-bold text-green-600 text-sm">+{formatQty(uq.qty, uq.unit)}</span> },
    { title: "Handler",  dataIndex: "handler_name",  render: (t) => <span className="text-xs">{t}</span> },
    { title: "Location", dataIndex: "location",      render: (t) => <span className="text-xs">{t}</span> },
    { title: "Invoice",  dataIndex: "invoice",       render: (t) => <span className="text-xs">{t}</span> },
    { title: "Notes",    dataIndex: "notes",         render: (t) => <span className="text-xs">{t}</span> },
    {
      title: "Images", dataIndex: "images", width: 100,
      render: (imgs) => imgs?.length > 0 ? (
        <div className="flex gap-1 flex-wrap">
          {imgs.slice(0, 3).map((img, i) => (
            <Image key={i} src={img.url || img.path || img} width={32} height={32} className="object-cover rounded" preview />
          ))}
          {imgs.length > 3 && <span className="text-xs text-gray-400 self-center">+{imgs.length - 3}</span>}
        </div>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
  ];

  const outColumns = [
    { title: "Date",          dataIndex: "date",             width: 145, render: (t) => <span className="text-xs text-gray-600">{t}</span> },
    { title: "Qty",           dataIndex: "unit_qty",         width: 110, align: "center", render: (uq) => <span className="font-bold text-red-600 text-sm">−{formatQty(uq.qty, uq.unit)}</span> },
    { title: "Taken By",      dataIndex: "taken_by",         render: (t) => <span className="text-xs font-semibold">{t}</span> },
    { title: "Job No.",       dataIndex: "job_no",           render: (t) => <span className="font-mono text-xs">{t}</span> },
    { title: "Handler",       dataIndex: "handler_name",     render: (t) => <span className="text-xs">{t}</span> },
    { title: "Customer",      dataIndex: "customer_details", render: (t) => <span className="text-xs">{t}</span> },
    {
      title: "Area Used", dataIndex: "area_used", width: 120,
      render: (v, record) => v != null ? (
        <div className="flex flex-col">
          <span className="font-bold text-orange-600 text-xs">{v.toFixed(2)} {unitLabel(primaryUnit)}</span>
          {record.remaining_area != null && (
            <span className="text-xs text-green-600">Left: {record.remaining_area.toFixed(2)}</span>
          )}
        </div>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
    { title: "Notes", dataIndex: "notes", render: (t) => <span className="text-xs">{t}</span> },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1200} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
            <HistoryOutlined style={{ color: "#2563eb", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Stock Movement History</div>
            <div className="text-xs text-gray-500">{product?.name} · {product?.product_code}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            {allUnits.map((u) => {
              const net = (inTotals[u] || 0) - (outTotals[u] || 0);
              return <Tag key={u} color="blue" className="font-semibold text-xs">{UNIT_MAP[u]?.icon} Net: {net.toLocaleString()} {unitLabel(u)}</Tag>;
            })}
          </div>
        </div>
      }
    >
      {isAreaUnit(primaryUnit) && product?.calculated_area != null && (
        <div className="px-6 pt-4">
          <AreaProgressBar
            calculated={product.calculated_area}
            remaining={product.remaining_area ?? product.calculated_area}
            unit={primaryUnit}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <ArrowUpOutlined style={{ color: "#16a34a", fontSize: 13 }} />
            </div>
            <span className="font-bold text-green-700 text-sm">Stock IN</span>
            <Tag color="success" className="ml-1 text-xs font-semibold">{stockIn.length} entries</Tag>
          </div>
          <Table dataSource={stockIn} columns={inColumns} size="small" scroll={{ x: 700 }}
            pagination={{ pageSize: 8, showSizeChanger: false, size: "small" }}
            rowClassName={() => "bg-green-50 hover:bg-green-100"} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
              <ArrowDownOutlined style={{ color: "#dc2626", fontSize: 13 }} />
            </div>
            <span className="font-bold text-red-600 text-sm">Stock OUT</span>
            <Tag color="error" className="ml-1 text-xs font-semibold">{stockOut.length} entries</Tag>
          </div>
          <Table dataSource={stockOut} columns={outColumns} size="small" scroll={{ x: 600 }}
            pagination={{ pageSize: 8, showSizeChanger: false, size: "small" }}
            rowClassName={() => "bg-red-50 hover:bg-red-100"} />
        </div>
      </div>
    </Modal>
  );
};

// ─── Material Issue History Modal ─────────────────────────────────────────────
const MaterialIssueHistoryModal = ({ open, onClose, product }) => {
  const issues    = _.get(product, "material_issues", []);
  const stats     = _.get(product, "material_stats",  {});
  const statsUnit = stats.stats_unit || "sqft";
  const u = unitLabel(statsUnit);

  const columns = [
    { title: "Issue No.",    dataIndex: "issue_no",  width: 100, render: (v) => <span className="font-mono text-xs font-bold text-blue-700">{v || "—"}</span> },
    { title: "Job No.",      dataIndex: "job_no",    width: 100, render: (v) => <span className="font-mono text-xs">{v || "—"}</span> },
    { title: "Issued Qty",   dataIndex: "unit_qty",  width: 120, align: "center",
      render: (uq, r) => <span className="font-bold text-orange-600 text-sm">{uq ? formatQty(uq.qty, uq.unit) : formatQty(r.issued_qty, r.unit)}</span> },
    { title: "Returned Qty", dataIndex: "return_unit_qty", width: 120, align: "center",
      render: (ruq, r) => ruq ? (
        <span className="font-bold text-green-600 text-sm">{formatQty(ruq.qty, ruq.unit)}</span>
      ) : r.returned_qty != null ? (
        <span className="font-bold text-green-600 text-sm">{formatQty(r.returned_qty, r.unit)}</span>
      ) : <Tag color="warning" className="text-xs">Pending</Tag> },
    { title: "Issued To", dataIndex: "issued_to",  render: (v) => <span className="text-xs">{v || "—"}</span> },
    { title: "Issued By", dataIndex: "issued_by",  render: (v) => <span className="text-xs">{v || "—"}</span> },
    { title: "Date",      dataIndex: "issued_at",  width: 130, render: (v) => <span className="text-xs text-gray-600">{v ? moment(v).format("DD/MM/YYYY h:mm A") : "—"}</span> },
    { title: "Notes",     dataIndex: "notes",      render: (v) => <span className="text-xs text-gray-500">{v || "—"}</span> },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1050} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
            <ExperimentOutlined style={{ color: "#ea580c", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Material Issue History</div>
            <div className="text-xs text-gray-500">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Tag color="orange">Issued: {stats.total_issued_qty || 0} {u}</Tag>
            <Tag color="green">Returned: {stats.total_returned_qty || 0} {u}</Tag>
            <Tag color="red">Wastage: {stats.total_wastage_qty || 0} {u}</Tag>
            <Tag color="blue">Jobs: {stats.issue_count || 0}</Tag>
          </div>
        </div>
      }
    >
      <Table dataSource={issues.map((item, i) => ({ ...item, key: i }))}
        columns={columns} size="small" scroll={{ x: 800 }}
        pagination={{ pageSize: 10, showSizeChanger: false, size: "small" }} />
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW PRODUCT MODAL ────────────────────────────────────────────────────────
// Code generation is fully server-driven via /products/preview-codes
// ═══════════════════════════════════════════════════════════════════════════════
const NewProductStockModal = ({ open, onClose, onSuccess }) => {
  const [form]                    = Form.useForm();
  const [loading, setLoading]     = useState(false);
  const [stockImages, setStockImages] = useState([]);
  const [primaryUnit, setPrimaryUnit] = useState("pcs");
  const [stockQty, setStockQty]   = useState({ qty: 0 });
  const [calculatedArea, setCalculatedArea] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productSize, setProductSize] = useState({
    width: "", width_unit: "feet", height: "", height_unit: "feet",
  });

  // ── Code preview state (fetched from backend) ──────────────────────────────
  const [previewCodes, setPreviewCodes]         = useState([]);
  const [previewLoading, setPreviewLoading]     = useState(false);
  const [previewDebounce, setPreviewDebounce]   = useState(null);

  const isArea = isAreaUnit(primaryUnit);

  // ── Reset on open/close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setStockImages([]);
      setPrimaryUnit("pcs");
      setStockQty({ qty: 0 });
      setProductSize({ width: "", width_unit: "feet", height: "", height_unit: "feet" });
      setCalculatedArea(null);
      setProductQuantity(1);
      setPreviewCodes([]);
    } else {
      form.setFieldsValue({ date: moment() });
    }
  }, [open, form]);

  // ── Auto-calculate area from size (for area units) ─────────────────────────
  useEffect(() => {
    if (isArea && productSize.width && productSize.height) {
      const area = calculateArea(
        productSize.width, productSize.height,
        productSize.width_unit, productSize.height_unit,
        primaryUnit
      );
      setCalculatedArea(area);
      setStockQty({ qty: area ? parseFloat(area.toFixed(4)) : 0 });
    } else {
      setCalculatedArea(null);
      if (isArea) setStockQty({ qty: 0 });
    }
  }, [productSize.width, productSize.height, productSize.width_unit, productSize.height_unit, primaryUnit]);

  // ── Fetch code preview from backend (debounced 600ms) ─────────────────────
  const fetchPreviewCodes = useCallback((name, unit, size, qty) => {
    if (!name || !name.trim()) { setPreviewCodes([]); return; }
    if (previewDebounce) clearTimeout(previewDebounce);
    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const response = await fetch("https://api.dmedia.in/api/product/preview-codes", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            primary_unit: unit,
            size: size.width || size.height
              ? { width: size.width || null, width_unit: size.width_unit, height: size.height || null, height_unit: size.height_unit }
              : null,
            quantity: Math.max(1, qty || 1),
          }),
        });
        const data = await response.json();
        setPreviewCodes(_.get(data, "data.codes", []));
      } catch {
        setPreviewCodes([]);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    setPreviewDebounce(timer);
  }, [previewDebounce]);

  const productName = Form.useWatch("name", form) || "";

  // Re-fetch codes whenever any relevant input changes
  useEffect(() => {
    fetchPreviewCodes(productName, primaryUnit, productSize, productQuantity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName, primaryUnit, productSize.width, productSize.height, productSize.width_unit, productSize.height_unit, productQuantity]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const qty      = isArea ? (calculatedArea ? parseFloat(calculatedArea.toFixed(4)) : 0) : (stockQty.qty || 0);
      const quantity = Math.max(1, productQuantity || 1);

      if (qty <= 0) {
        message.error(isArea ? "Enter product dimensions to auto-calculate area" : "Enter initial stock quantity");
        return;
      }

      // Build size payload (store for ALL unit types)
      const sizePayload =
        productSize.width !== "" || productSize.height !== ""
          ? {
              width:       productSize.width  !== "" ? Number(productSize.width)  : null,
              width_unit:  productSize.width_unit  || "feet",
              height:      productSize.height !== "" ? Number(productSize.height) : null,
              height_unit: productSize.height_unit || "feet",
              unit:        productSize.width_unit  || "feet",
            }
          : null;

      const stockEntry = {
        _id:          uuidv4(),
        add_stock:    qty,
        unit_qty:     { qty, unit: primaryUnit },
        handler_name: values.handler_name || "",
        location:     values.location     || "",
        invoice:      values.invoice      || "",
        invoice_date: values.invoice_date ? values.invoice_date.toISOString() : null,
        notes:        values.notes        || "",
        stock_images: stockImages.map((img) => ({ _id: img._id, path: img.path, url: img.url })),
        date:         values.date ? values.date.toISOString() : new Date().toISOString(),
      };

      // ── Single API call — backend handles all code generation + batch ──────
      // We pass product_quantity so the backend creates N products with
      // sequential codes in one shot.
      const payload = {
        name:             values.name,
        material_brand:   values.material_brand || "",
        size:             sizePayload,

        calculated_area:  isArea && calculatedArea != null
          ? parseFloat(calculatedArea.toFixed(4))
          : null,
        product_quantity: quantity,

        type:             values.type || "Stand Alone Product",
        MRP_price:        values.MRP_price       || "",
        customer_product_price: values.customer_price || "",
        primary_unit:     primaryUnit,
        supported_units:  [primaryUnit],

        unit_stock_summary: [{
          unit:      primaryUnit,
          total_in:  qty,
          total_out: 0,
          net_stock: qty,
        }],
        stock_info:    [{ ...stockEntry }],
        stock_count:   qty,
        stock_offline: [],
        stocks_status: qty > 10 ? "In Stock" : qty > 0 ? "Limited" : "Out of Stock",
        is_visible:    false,
      };

      const response = await addproduct(payload);
      const created  = _.get(response, "data.data", []);
      const count    = Array.isArray(created) ? created.length : 1;

      message.success(
        `${count} product${count > 1 ? "s" : ""} created! ${
          isArea ? `Each tracks ${calculatedArea?.toFixed(2)} ${unitLabel(primaryUnit)} of area.` : ""
        }`
      );
      onSuccess();
      onClose();
    } catch (err) {
      ERROR_NOTIFICATION(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={860} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center">
            <PlusOutlined style={{ color: "#0d9488", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Add New Product</div>
            <div className="text-xs text-gray-500">
              {isArea
                ? "Area-based product — each unit tracks its own remaining area"
                : "Codes are auto-generated globally in sequence (e.g. DMP-003)"}
            </div>
          </div>
          <Tag color="cyan" className="ml-auto font-semibold">New Entry</Tag>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">

        {/* ── Product Details ────────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-teal-500 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Product Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Product Name" name="name" rules={[formValidation("Enter product name")]}>
              <Input placeholder="e.g. Normal Flex 10 X 10" className="h-10" />
            </Form.Item>
            <Form.Item label="Material Brand" name="material_brand">
              <Input placeholder="e.g. 3M, LG Hausys" className="h-10" />
            </Form.Item>
          </div>
        </div>

        {/* ── Primary Unit ───────────────────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-teal-600 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Primary Unit</span>
          </div>
          <Select
            value={primaryUnit}
            onChange={(value) => {
              setPrimaryUnit(value);
              if (!isAreaUnit(value)) { setCalculatedArea(null); }
            }}
            className="w-full" size="large"
            options={UNITS.map((u) => ({ value: u.value, label: `${u.icon} ${u.label}` }))}
          />
          {isArea && (
            <Alert className="mt-3 rounded-xl" type="info" showIcon
              message={
                <span className="text-xs font-semibold">
                  Area-based unit selected — stock quantity is auto-calculated from dimensions.
                  Each product in the batch tracks its own remaining area independently.
                </span>
              }
            />
          )}
        </div>

        {/* ── Size (shown for ALL unit types) ───────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "#fefce8", border: "1.5px solid #fde68a" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-yellow-400 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Size</span>
            {isArea
              ? <Tag color="orange" className="text-xs">Required for area calculation</Tag>
              : <Tag color="default" className="text-xs ml-auto">Optional — stored for reference &amp; code generation</Tag>}
          </div>

          <SizeInputGroup
            value={productSize}
            onChange={setProductSize}
            required={isArea}
          />

          {/* Area preview */}
          {isArea && calculatedArea !== null && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-800">📐 Area per unit:</span>
                <span className="text-lg font-bold text-green-700">
                  {calculatedArea.toFixed(4)} {unitLabel(primaryUnit)}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                {productSize.width} {productSize.width_unit} × {productSize.height} {productSize.height_unit}
                {productQuantity > 1 && (
                  <span className="ml-2 font-semibold">
                    → {productQuantity} separate products, each with full {calculatedArea.toFixed(4)} {unitLabel(primaryUnit)}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Quantity & Code Preview ───────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg,#eff6ff,#f0fdf4)", border: "1.5px solid #bfdbfe" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Quantity &amp; Auto Codes</span>
            <Tooltip title="Codes are generated globally in sequence across all products. The sequence never resets.">
              <InfoCircleOutlined className="text-gray-400 cursor-help" />
            </Tooltip>
          </div>

          <Text className="text-sm font-semibold text-gray-700 block mb-2">
            How many products to create?
          </Text>
          <InputNumber
            min={1} max={100}
            value={productQuantity}
            onChange={(val) => setProductQuantity(val ?? 1)}
            size="large"
            style={{ width: "100%", borderRadius: 10 }}
            placeholder="1"
          />

          {/* Code preview block */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Text className="text-xs font-semibold text-gray-600">
                🏷️ Auto-generated codes (from server):
              </Text>
              {previewLoading && <SyncOutlined spin className="text-teal-500 text-xs" />}
            </div>

            {previewCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-white rounded-xl border border-gray-200">
                {previewCodes.slice(0, 30).map((code) => (
                  <span key={code}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold"
                    style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" }}>
                    {code}
                  </span>
                ))}
                {previewCodes.length > 30 && (
                  <span className="text-xs text-gray-400 self-center">+{previewCodes.length - 30} more</span>
                )}
              </div>
            ) : productName.trim() ? (
              <div className="text-xs text-gray-400 italic p-2">
                {previewLoading ? "Fetching codes…" : "Codes will appear here once name is entered"}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic p-2">Enter a product name to see generated codes</div>
            )}

            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <InfoCircleOutlined style={{ fontSize: 10 }} />
              Format: <code className="text-xs bg-gray-100 px-1 rounded">DM{"{INITIALS}"}{isArea ? "{W}X{H}" : ""}-{"{SEQ}"}</code>
              &nbsp;— e.g.{" "}
              <code className="text-xs bg-teal-50 text-teal-700 px-1 rounded">
                {isArea ? "DMNF10X10-001" : primaryUnit === "pcs" ? "DMP-003" : "DMV3-002"}
              </code>
            </div>
          </div>

          {/* Per-product area summary for area-based */}
          {isArea && calculatedArea && productQuantity > 1 && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div className="text-xs text-green-700 font-bold mb-1">📐 Each product tracks independently:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 text-center border border-green-200">
                  <div className="font-bold text-green-700">{calculatedArea.toFixed(4)} {unitLabel(primaryUnit)}</div>
                  <div className="text-gray-500">per product</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-blue-200">
                  <div className="font-bold text-blue-700">{(calculatedArea * productQuantity).toFixed(4)} {unitLabel(primaryUnit)}</div>
                  <div className="text-gray-500">total batch</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Initial Stock (only for non-area units) ───────────────────── */}
        {!isArea && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 bg-green-500 rounded-full" />
              <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Initial Stock per Product</span>
            </div>
            <UnitQtyInput value={stockQty} onChange={setStockQty} />
            {stockQty.qty > 0 && (
              <div className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                <ArrowUpOutlined /> Each product gets {formatQty(stockQty.qty, primaryUnit)}
              </div>
            )}
          </div>
        )}

        {/* ── Stock Entry Details ───────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-green-500 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Stock Entry Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
              <Input placeholder="Who handled this?" className="h-10" />
            </Form.Item>
            <Form.Item label="Location / Rack" name="location">
              <Input placeholder="e.g. Warehouse Rack A-3" className="h-10" />
            </Form.Item>
            <Form.Item label="Date & Time" name="date" initialValue={moment()}
              rules={[formValidation("Date is required")]}
              getValueProps={(v) => ({ value: v && moment(v) })}>
              <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A"
                disabled style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }} suffixIcon={null} />
            </Form.Item>
            <Form.Item label="Invoice No." name="invoice">
              <Input placeholder="e.g. INV-001" className="h-10" />
            </Form.Item>
            <Form.Item label="Invoice Date" name="invoice_date">
              <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
            </Form.Item>
            <Form.Item label="Notes" name="notes" className="md:col-span-2">
              <Input.TextArea placeholder="Any additional notes..." rows={2} />
            </Form.Item>
            <Form.Item label="Stock Entry Images" className="md:col-span-2">
              <UploadHelper max={10} setImagePath={setStockImages} image_path={stockImages}
                label="Upload Stock Images" fieldKey="new-product-stock" />
            </Form.Item>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}
            className="rounded-lg px-6 h-10 font-semibold"
            style={{ background: "#0d9488", borderColor: "#0d9488" }}>
            {productQuantity > 1 ? `Create ${productQuantity} Products` : "Create Product"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const AddProduct = () => {
  const { user } = useSelector((state) => state.authSlice);

  const [tableData, setTableData]   = useState([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [mainCategory, setMainCategoryData]                       = useState([]);
  const [filterByProductCategory, setFilterByProductCategory]     = useState("");
  const [filterByProductSubcategory, setFilterByProductSubcategory] = useState("");
  const [vendorFilter, setVendorFilter]   = useState("");
  const [filterByType, setFilterByType]   = useState("");
  const [subcategoryData, setSubcategoryData]             = useState([]);
  const [allVendors, setAllVendors]                       = useState([]);
  const [categoryData, setCategoryData]                   = useState([]);
  const [subcategoryDataFilter, setSubcategoryDataFilter] = useState([]);
  const [showFilters, setShowFilters]     = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [activeTabKey, setActiveTabKey]   = useState("1");
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [stockMin, setStockMin]   = useState("");
  const [stockMax, setStockMax]   = useState("");
  const [priceMin, setPriceMin]   = useState("");
  const [priceMax, setPriceMax]   = useState("");

  const [newProductModal, setNewProductModal]               = useState(false);
  const [stockInProduct, setStockInProduct]                 = useState(null);
  const [stockOutProduct, setStockOutProduct]               = useState(null);
  const [stockHistoryProduct, setStockHistoryProduct]       = useState(null);
  const [materialIssueProduct, setMaterialIssueProduct]     = useState(null);
  const [returnAllocProduct, setReturnAllocProduct]         = useState(null);
  const [batchTrackerProducts, setBatchTrackerProducts]     = useState([]);
  const [batchTrackerOpen, setBatchTrackerOpen]             = useState(false);

  const [paginationConfig, setPaginationConfig] = useState(() => {
    const savedPageSize    = localStorage.getItem(STORAGE_KEYS.PAGE_SIZE);
    const savedCurrentPage = localStorage.getItem(STORAGE_KEYS.CURRENT_PAGE);
    const savedActiveTab   = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return {
      pageSize:    savedPageSize    ? parseInt(savedPageSize, 10)    : 10,
      currentPage: savedCurrentPage ? parseInt(savedCurrentPage, 10) : 1,
      initialTab:  savedActiveTab || "1",
    };
  });

  useEffect(() => {
    if (paginationConfig.initialTab) setActiveTabKey(paginationConfig.initialTab);
  }, []);

  const savePagination = (pageSize, currentPage) => {
    localStorage.setItem(STORAGE_KEYS.PAGE_SIZE,    pageSize.toString());
    localStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, currentPage.toString());
  };
  const handlePageChange     = (p) => { setPaginationConfig((c) => ({ ...c, currentPage: p })); savePagination(paginationConfig.pageSize, p); };
  const handlePageSizeChange = (s) => { setPaginationConfig((c) => ({ ...c, pageSize: s, currentPage: 1 })); savePagination(s, 1); };
  const handleTabChange      = (k) => { setActiveTabKey(k); localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, k); handlePageChange(1); };

  useEffect(() => {
    fetchData();
  }, [search, filterByProductCategory, filterByType, filterByProductSubcategory, vendorFilter, visibilityFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await getProduct("", search || "", true,
        filterByProductCategory || "", filterByType || "",
        filterByProductSubcategory || "", vendorFilter || "", visibilityFilter || "");
      setTableData(_.get(result, "data.data", []).reverse());
    } catch (err) { ERROR_NOTIFICATION(err); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const [mainResult, subResult] = await Promise.all([getMainCategory(), getSubCategory()]);
      setCategoryData(_.get(mainResult, "data.data", []));
      setSubcategoryData(_.get(subResult, "data.data", []));
    } catch (err) { ERROR_NOTIFICATION(err); }
  };

  const collectVendors = async () => {
    try {
      setLoading(true);
      const result = await getAllVendor();
      setAllVendors(_.get(result, "data.data", []));
    } catch (err) { ERROR_NOTIFICATION(err); }
    finally { setLoading(false); }
  };

  // ── API wrappers ───────────────────────────────────────────────────────────
  const apiStockOut = async (productId, body) => {
    const response = await fetch(`/api/products/${productId}/stock-out`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Stock out failed");
    }
    return response.json();
  };

  const apiReturnAllocation = async (productId, body) => {
    const response = await fetch(`/api/products/${productId}/return-allocation`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Return allocation failed");
    }
    return response.json();
  };

  const openBatchTracker = async (record) => {
    if (!record.batch_id) {
      setBatchTrackerProducts([record]);
      setBatchTrackerOpen(true);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/products/batch/${record.batch_id}`);
      const data = await response.json();
      setBatchTrackerProducts(_.get(data, "data", [record]));
      setBatchTrackerOpen(true);
    } catch {
      const batchProds = tableData.filter((p) => p.batch_id === record.batch_id);
      setBatchTrackerProducts(batchProds.length ? batchProds : [record]);
      setBatchTrackerOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (record) => {
    confirm({
      title:   "Delete Product",
      icon:    <ExclamationCircleOutlined style={{ color: "#dc2626" }} />,
      content: (
        <div>
          <p className="text-gray-700 mb-1">Delete <strong>{record.name}</strong>?</p>
          <p className="text-xs text-red-500">This action cannot be undone.</p>
        </div>
      ),
      okText: "Yes, Delete", okType: "danger", cancelText: "Cancel",
      okButtonProps: { style: { background: "#dc2626", borderColor: "#dc2626" } },
      onOk: async () => {
        try {
          setDeletingProductId(record._id);
          const result = await deleteProduct(JSON.stringify({ product_id: record._id, is_cloned: record.is_cloned || false }));
          SUCCESS_NOTIFICATION(result);
          await fetchData();
        } catch (err) { ERROR_NOTIFICATION(err); }
        finally { setDeletingProductId(null); }
      },
    });
  };

  const getProductImage = (product) => {
    if (product.images?.length > 0) {
      const fi = product.images[0];
      return typeof fi === "object" ? _.get(fi, "url", _.get(fi, "path", "")) : fi;
    }
    return "";
  };

  const getProductPrice = (product, priceType = "customer") => {
    const map = { customer: "customer_product_price", dealer: "Deler_product_price", corporate: "corporate_product_price" };
    return product[map[priceType]] || product.MRP_price || "N/A";
  };

  const exportToCSV = () => {
    try {
      setExportLoading(true);
      let csv = "data:text/csv;charset=utf-8,";
      const cols = ["S.No", "Product Name", "Product Code", "Batch ID", "Material Brand", "Size", "Calculated Area", "Remaining Area", "Type", "Primary Unit", "Stock Count", "Allocation Count"];
      csv += cols.join(",") + "\r\n";
      tableData.forEach((product, index) => {
        const size    = product.size;
        const sizeStr = size ? `${size.width ?? "—"} ${size.width_unit || "feet"} x ${size.height ?? "—"} ${size.height_unit || "feet"}` : "—";
        const row = {
          "S.No":             index + 1,
          "Product Name":     product.name || "N/A",
          "Product Code":     product.product_code || "—",
          "Batch ID":         product.batch_id?.slice(0, 8) || "—",
          "Material Brand":   product.material_brand || "—",
          "Size":             sizeStr,
          "Calculated Area":  product.calculated_area != null ? `${product.calculated_area} ${unitLabel(product.primary_unit || "pcs")}` : "—",
          "Remaining Area":   product.remaining_area  != null ? `${product.remaining_area}  ${unitLabel(product.primary_unit || "pcs")}` : "—",
          "Type":             product.type || "N/A",
          "Primary Unit":     unitLabel(product.primary_unit || "pcs"),
          "Stock Count":      product.stock_count ?? 0,
          "Allocation Count": (product.allocations || []).length,
        };
        csv += cols.map((c) => `"${row[c] || ""}"`).join(",") + "\r\n";
      });
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csv));
      link.setAttribute("download", `products_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      message.success("CSV downloaded");
    } catch { message.error("Export failed"); }
    finally { setExportLoading(false); }
  };

  const onCategoryChange = (value) => {
    setFilterByProductCategory(value);
    setFilterByProductSubcategory("");
    handlePageChange(1);
    setSubcategoryDataFilter(value ? subcategoryData.filter((s) => s.select_main_category === value) : []);
  };

  const handleClearFilters = () => {
    setFilterByProductCategory(""); setFilterByProductSubcategory("");
    setVendorFilter(""); setFilterByType(""); setVisibilityFilter("");
    setSubcategoryDataFilter([]); setSearch("");
    setStockMin(""); setStockMax(""); setPriceMin(""); setPriceMax("");
    handlePageChange(1);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const getCurrentTabData = useMemo(() =>
    activeTabKey === "1"
      ? tableData.filter((r) => !r.is_cloned)
      : tableData.filter((r) => r.is_cloned),
    [tableData, activeTabKey]);

  const stockFilteredData = useMemo(() => {
    if (stockMin === "" && stockMax === "") return getCurrentTabData;
    return getCurrentTabData.filter((item) => {
      const stock = item.stock_count || 0;
      return (stockMin === "" || stock >= Number(stockMin)) &&
             (stockMax === "" || stock <= Number(stockMax));
    });
  }, [getCurrentTabData, stockMin, stockMax]);

  const priceFilteredData = useMemo(() => {
    if (priceMin === "" && priceMax === "") return stockFilteredData;
    return stockFilteredData.filter((item) => {
      const rawPrice = getProductPrice(item, "customer");
      const price = rawPrice === "N/A" ? null : parseFloat(rawPrice);
      if (price === null) return false;
      return (priceMin === "" || price >= Number(priceMin)) &&
             (priceMax === "" || price <= Number(priceMax));
    });
  }, [stockFilteredData, priceMin, priceMax]);

  const processedTableData = useMemo(() =>
    priceFilteredData.map((item, index) => ({ ...item, serialNumber: index + 1 })),
    [priceFilteredData]);

  const activeFilterCount = [
    filterByProductCategory, filterByProductSubcategory, vendorFilter,
    filterByType, visibilityFilter, search,
    stockMin !== "" ? "s" : "", stockMax !== "" ? "s" : "",
    priceMin !== "" ? "p" : "", priceMax !== "" ? "p" : "",
  ].filter(Boolean).length;

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: "S.No", dataIndex: "serialNumber", width: 60, align: "center", fixed: "left",
      render: (n) => <span className="text-gray-700 font-semibold">{n}</span>,
    },
    {
      title: "Image", dataIndex: "images", width: 90,
      render: (_, record) => {
        const img = getProductImage(record);
        return (
          <div className="flex justify-center">
            {img ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 shadow">
                <Image src={img} alt="Product" width="100%" height="100%" className="object-cover" preview />
              </div>
            ) : (
              <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-300">
                <span className="text-xs text-gray-400">No Img</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Product", dataIndex: "name", width: 220,
      render: (data, record) => (
        <div className="flex flex-col space-y-1">
          <Tooltip title={data}>
            <span className="font-semibold text-gray-900 text-sm line-clamp-2">{data}</span>
          </Tooltip>
          {record.product_code && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded font-bold w-fit"
              style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" }}>
              {record.product_code}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
              {UNIT_MAP[record.primary_unit || "pcs"]?.icon} {unitLabel(record.primary_unit || "pcs")}
            </span>
          </span>
          {record.batch_id && (
            <Tooltip title={`Batch: ${record.batch_id}`}>
              <Tag color="cyan" className="text-xs cursor-pointer w-fit" style={{ fontSize: 10 }}
                onClick={() => openBatchTracker(record)}>
                📦 Batch {record.product_quantity > 1 ? `×${record.product_quantity}` : ""}
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: "Brand", dataIndex: "material_brand", width: 130,
      render: (brand) => brand ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" }}>
          🏷️ {brand}
        </span>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
    {
      title: "Size / Area", dataIndex: "size", width: 190,
      render: (size, record) => {
        const isAreaProd = isAreaUnit(record.primary_unit || "pcs");
        const calc = record.calculated_area;
        const rem  = record.remaining_area ?? calc;
        return (
          <div className="flex flex-col gap-1">
            {renderSizeCell(size)}
            {isAreaProd && calc != null && (
              <div className="w-full mt-1">
                <AreaProgressBar calculated={calc} remaining={rem} unit={record.primary_unit} showLabel={false} />
                <div className="flex justify-between text-xs mt-0.5">
                  <span className="text-gray-400">{(calc - (rem || 0)).toFixed(2)} used</span>
                  <span className="text-green-600 font-semibold">{(rem || 0).toFixed(2)} left</span>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Stock", dataIndex: "stock_count", width: 160, align: "center",
      render: (stock, record) => {
        const pu          = record.primary_unit || "pcs";
        const status      = record.stocks_status || "In Stock";
        const allocCount  = (record.allocations || []).length;
        const activeAllocs = (record.allocations || []).filter(
          (a) => a.status === "allocated" || a.status === "partial_return"
        ).length;
        return (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-gray-900 text-xl">{(stock || 0).toLocaleString()}</span>
              <span className="text-xs text-gray-500">{unitLabel(pu)}</span>
            </div>
            <span className={`text-xs font-medium ${status === "Out of Stock" ? "text-red-600" : status === "Limited" ? "text-orange-600" : "text-green-600"}`}>
              {status}
            </span>
            <UnitStockSummaryCard product={record} />
            {allocCount > 0 && (
              <div className="flex gap-1 mt-1">
                <Tag style={{ fontSize: 10, margin: 0 }} color={activeAllocs > 0 ? "warning" : "default"}>
                  {activeAllocs > 0 ? `${activeAllocs} active alloc` : `${allocCount} allocs`}
                </Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Actions", width: 300, align: "center", fixed: "right",
      render: (_, record) => {
        const isAreaProd = isAreaUnit(record.primary_unit || "pcs");
        const hasActiveAllocs = (record.allocations || []).some(
          (a) => a.status === "allocated" || a.status === "partial_return"
        );
        const isBatch = record.batch_id && record.product_quantity > 1;

        return (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <Tooltip title="Stock IN">
              <Button size="small" icon={<ArrowUpOutlined />} onClick={() => setStockInProduct(record)}
                style={{ background: "#f0fdf4", borderColor: "#16a34a", color: "#16a34a", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                IN
              </Button>
            </Tooltip>

            <Tooltip title={isAreaProd ? "Stock OUT (area tracking)" : "Stock OUT"}>
              <Button size="small" icon={<ArrowDownOutlined />} onClick={() => setStockOutProduct(record)}
                style={{ background: "#fff1f2", borderColor: "#dc2626", color: "#dc2626", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                OUT
              </Button>
            </Tooltip>

            {(isAreaProd || hasActiveAllocs) && (
              <Tooltip title="Return allocation">
                <Button size="small" icon={<RollbackOutlined />} onClick={() => setReturnAllocProduct(record)}
                  style={{ background: "#f5f3ff", borderColor: "#7c3aed", color: "#7c3aed", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                  Return
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Stock movement history">
              <Button size="small" icon={<HistoryOutlined />} onClick={() => setStockHistoryProduct(record)}
                style={{ background: "#eff6ff", borderColor: "#2563eb", color: "#2563eb", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                History
              </Button>
            </Tooltip>

            {isBatch && (
              <Tooltip title="View batch area tracker">
                <Button size="small" icon={<AppstoreOutlined />} onClick={() => openBatchTracker(record)}
                  style={{ background: "#f0fdfa", borderColor: "#0d9488", color: "#0d9488", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                  Batch
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Delete product">
              <Button size="small" icon={<DeleteFilled />} loading={deletingProductId === record._id}
                onClick={() => handleDeleteProduct(record)} danger
                style={{ background: "#fff1f2", borderColor: "#ef4444", color: "#ef4444", borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                Del
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const paginationProps = {
    current:     paginationConfig.currentPage,
    pageSize:    paginationConfig.pageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
    pageSizeOptions: ["10", "20", "50", "100"],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 p-4 md:p-8 font-sans">

      {/* Header */}
      <div className="bg-white shadow-2xl rounded-3xl px-6 py-5 mb-6 border border-teal-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight m-0">📦 Stock Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5 m-0">Manage inventory, area tracking &amp; allocations</p>
            </div>
            <Input placeholder="Search products, codes, batch IDs…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear className="h-9 rounded-xl border-gray-200 sm:w-72"
              prefix={<span className="text-gray-400">🔍</span>} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button icon={<MdFileDownload />} onClick={exportToCSV} loading={exportLoading}
              className="rounded-xl h-9 px-4 font-semibold"
              style={{ background: "#f0fdf4", borderColor: "#16a34a", color: "#16a34a" }}>
              Export CSV
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewProductModal(true)}
              className="rounded-xl font-bold h-9 px-5 shadow-md"
              style={{ background: "#0d9488", borderColor: "#0d9488" }}>
              New Product
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-white shadow-xl rounded-3xl border-none" bodyStyle={{ padding: 24 }}>
        <div className="flex justify-between items-center mb-4">
          <Title level={5} className="m-0 flex items-center gap-2 text-gray-900">
            <FaFilter className="text-teal-600" /> Filter Products
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold"
                style={{ background: "#0d9488", fontSize: 11 }}>
                {activeFilterCount}
              </span>
            )}
          </Title>
          <div className="flex gap-2">
            <Button type="text" onClick={() => setShowFilters(!showFilters)} className="text-teal-600 font-semibold">
              {showFilters ? "▲ Hide" : "▼ Show"}
            </Button>
            <Button onClick={handleClearFilters} className="bg-gray-100 border-none rounded-xl font-semibold">
              Clear All
            </Button>
          </div>
        </div>

        <div className={`transition-all duration-500 overflow-hidden ${showFilters ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Category</Text>
              <Select placeholder="Select Category" size="large" className="w-full" allowClear
                onChange={onCategoryChange} value={filterByProductCategory}>
                {mainCategory.map((item) => (
                  <Select.Option key={item._id} value={item._id}>{item.main_category_name}</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Sub Category</Text>
              <Select placeholder="Select Sub Category" size="large" className="w-full" allowClear
                onChange={(val) => setFilterByProductSubcategory(val)} value={filterByProductSubcategory}
                disabled={!filterByProductCategory || subcategoryDataFilter.length === 0}>
                {subcategoryDataFilter.map((item) => (
                  <Select.Option key={item._id} value={item._id}>{item.sub_category_name}</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Vendor</Text>
              <Select placeholder="Select Vendor" size="large" className="w-full" allowClear
                onChange={(val) => setVendorFilter(val)} value={vendorFilter}>
                {allVendors.map((item) => (
                  <Select.Option key={item._id} value={item._id}>{item.vendor_name}</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Product Type</Text>
              <Select placeholder="Select Type" size="large" className="w-full" allowClear
                onChange={(val) => setFilterByType(val)} value={filterByType}
                options={[
                  { value: "Stand Alone Product", label: "Stand Alone Product" },
                  { value: "Variable Product",    label: "Variable Product" },
                  { value: "Variant Product",     label: "Variant Product" },
                ]} />
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Visibility</Text>
              <Select placeholder="Visibility" size="large" className="w-full" allowClear
                onChange={(val) => setVisibilityFilter(val)} value={visibilityFilter}
                options={[
                  { value: "",      label: "All Products" },
                  { value: "true",  label: "Visible Only" },
                  { value: "false", label: "Hidden Only" },
                ]} />
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg,#f0fdf4,#eff6ff)", border: "1.5px solid #bbf7d0" }}>
            <Text className="text-sm font-bold text-gray-800 block mb-3">Stock Range Filter</Text>
            <StockRangeFilter stockMin={stockMin} stockMax={stockMax}
              onStockMinChange={(v) => { setStockMin(v); handlePageChange(1); }}
              onStockMaxChange={(v) => { setStockMax(v); handlePageChange(1); }}
              onClear={() => { setStockMin(""); setStockMax(""); handlePageChange(1); }} />
          </div>

          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", border: "1.5px solid #ddd6fe" }}>
            <Text className="text-sm font-bold text-gray-800 block mb-3">Customer Price Range</Text>
            <PriceRangeFilter priceMin={priceMin} priceMax={priceMax}
              onPriceMinChange={(v) => { setPriceMin(v); handlePageChange(1); }}
              onPriceMaxChange={(v) => { setPriceMax(v); handlePageChange(1); }}
              onClear={() => { setPriceMin(""); setPriceMax(""); handlePageChange(1); }} />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white shadow-xl rounded-3xl border-none" bodyStyle={{ padding: 0 }}>
        <Tabs destroyInactiveTabPane type="card" size="large"
          className="px-4 md:px-8 pt-4"
          activeKey={activeTabKey}
          onChange={handleTabChange}
          items={[{
            key: "1",
            label: (
              <span className="flex items-center font-bold text-gray-900 text-sm">
                📦 Products
                <Tag className="ml-2 bg-teal-100 text-teal-800 font-semibold rounded-full px-2 text-xs">
                  {processedTableData.length}
                </Tag>
              </span>
            ),
            children: (
              <CustomTable
                loading={loading}
                dataSource={processedTableData}
                columns={columns}
                className="rounded-b-3xl"
                onChange={(pagination) => {
                  if (pagination.current  !== paginationConfig.currentPage) handlePageChange(pagination.current);
                  if (pagination.pageSize !== paginationConfig.pageSize)    handlePageSizeChange(pagination.pageSize);
                }}
                pagination={paginationProps}
              />
            ),
          }]}
        />
      </Card>

      {/* ── Modals ── */}
      <NewProductStockModal
        open={newProductModal}
        onClose={() => setNewProductModal(false)}
        onSuccess={fetchData}
      />

      {stockInProduct && (
        <StockInModal
          open={true}
          product={stockInProduct}
          onClose={() => setStockInProduct(null)}
          onSuccess={() => { fetchData(); setStockInProduct(null); }}
        />
      )}

      {stockOutProduct && (
        <StockOutModal
          open={true}
          product={stockOutProduct}
          onClose={() => setStockOutProduct(null)}
          onSuccess={() => { fetchData(); setStockOutProduct(null); }}
          apiStockOut={apiStockOut}
        />
      )}

      {returnAllocProduct && (
        <ReturnAllocationModal
          open={true}
          product={returnAllocProduct}
          onClose={() => setReturnAllocProduct(null)}
          onSuccess={() => { fetchData(); setReturnAllocProduct(null); }}
          apiReturnAllocation={apiReturnAllocation}
        />
      )}

      {stockHistoryProduct && (
        <StockHistoryModal
          open={true}
          product={stockHistoryProduct}
          onClose={() => setStockHistoryProduct(null)}
        />
      )}

      {materialIssueProduct && (
        <MaterialIssueHistoryModal
          open={true}
          product={materialIssueProduct}
          onClose={() => setMaterialIssueProduct(null)}
        />
      )}

      {batchTrackerOpen && (
        <BatchAreaTrackerModal
          open={true}
          onClose={() => { setBatchTrackerOpen(false); setBatchTrackerProducts([]); }}
          batchProducts={batchTrackerProducts}
          onStockOut={(product) => {
            setBatchTrackerOpen(false);
            setStockOutProduct(product);
          }}
        />
      )}
    </div>
  );
};

export default AddProduct;