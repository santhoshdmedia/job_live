/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { MdFileDownload } from "react-icons/md";
import {
  Button, Form, Image, Modal, Select, Spin, Table, Tabs, Tag,
  Tooltip, Card, Typography, Dropdown, Menu, message, Input, DatePicker, InputNumber, Statistic,
} from "antd";
import { FaFilter } from "react-icons/fa";
import {
  LockOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined,
  DeleteFilled, EyeOutlined, SwapOutlined, CameraOutlined, UploadOutlined,
  ExperimentOutlined, RollbackOutlined, BarChartOutlined, WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  addproduct, editProduct, getAllCategoryProducts, getAllVendor,
  getMainCategory, getProduct, getSubCategory, getSingleVendor, uploadImage,
  deleteProduct,
} from "../api";
import { ERROR_NOTIFICATION, SUCCESS_NOTIFICATION } from "../helper/notification_helper";
import CustomTable from "../components/CustomTable";
import { useForm } from "antd/es/form/Form";
import { canEditPage, canDeletePage, isSuperAdmin } from "../helper/permissionHelper";
import { formValidation } from "../helper/formvalidation";

const { Title, Text } = Typography;
const { confirm } = Modal;

// ─── Unit configuration ────────────────────────────────────────────────────────

export const UNITS = [
  { value: "pcs",    label: "Pieces (pcs)",        short: "pcs",  kind: "count",  icon: "📦" },
  { value: "sqft",   label: "Square Feet (sq ft)",  short: "sq ft",kind: "area",   icon: "⬛" },
  { value: "sqm",    label: "Square Meters (sq m)", short: "sq m", kind: "area",   icon: "⬛" },
  { value: "feet",   label: "Linear Feet (ft)",     short: "ft",   kind: "length", icon: "📏" },
  { value: "meters", label: "Linear Meters (m)",    short: "m",    kind: "length", icon: "📏" },
  { value: "kg",     label: "Kilograms (kg)",       short: "kg",   kind: "weight", icon: "⚖️" },
  { value: "rolls",  label: "Rolls",                short: "rolls",kind: "count",  icon: "🪄" },
];

export const UNIT_MAP = Object.fromEntries(UNITS.map((u) => [u.value, u]));
export const unitLabel = (unit) => UNIT_MAP[unit]?.short || unit || "pcs";
export const formatQty = (qty, unit) => `${Number(qty || 0).toLocaleString()} ${unitLabel(unit)}`;
export const mkUnitQty = (qty, unit) => ({ qty: Number(qty) || 0, unit: unit || "pcs" });

// ─── Size unit options for Width / Height ─────────────────────────────────────
const SIZE_UNITS = [
  { value: "inches", label: "Inches (in)" },
  { value: "feet",   label: "Feet (ft)"   },
  { value: "cm",     label: "Centimeters (cm)" },
  { value: "meters", label: "Meters (m)"  },
  { value: "mm",     label: "Millimeters (mm)" },
];

const STORAGE_KEYS = {
  PAGE_SIZE:    "products_pageSize",
  CURRENT_PAGE: "products_currentPage",
  FILTERS:      "products_filters",
  ACTIVE_TAB:   "products_activeTab",
};

// ─── Device Detection ─────────────────────────────────────────────────────────

const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && window.innerWidth <= 768);

// ─── Image Helpers ────────────────────────────────────────────────────────────

const createImageObject = (url, existingId = null) => ({
  _id: existingId || uuidv4(),
  path: url, url, type: "image",
  uploadedAt: new Date().toISOString(),
});

// ─── SortableImage ────────────────────────────────────────────────────────────

const SortableImage = ({ id, image, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const imageUrl = image.url || image.path || image;
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes} {...listeners}
        className="absolute top-1 left-1 z-20 bg-blue-500 bg-opacity-80 text-white p-1 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: 24, height: 24 }}
      >
        <div className="flex items-center justify-center w-full h-full">⠿</div>
      </div>
      <Image
        src={imageUrl} alt="Product" width={80} height={80}
        className="object-cover rounded border-2 border-dashed border-gray-300"
        preview={{ mask: <span className="text-white text-xs">Preview</span> }}
      />
      <button
        type="button"
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center border-0 cursor-pointer z-20"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(id); }}
      >
        <DeleteFilled className="text-xs" />
      </button>
    </div>
  );
};

// ─── SortableImageList ────────────────────────────────────────────────────────

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
            <SortableImage
              key={getId(img)} id={getId(img)} image={img}
              onRemove={(id) => setImages(images.filter((i) => getId(i) !== id))}
            />
          ))}
          {images.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400 text-sm">No images yet</div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// ─── UploadHelper (Mobile-aware) ──────────────────────────────────────────────

const UploadHelper = ({ max = 10, setImagePath, image_path = [], label = "Upload Images", fieldKey }) => {
  const [uploading, setUploading] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => { setIsMobile(isMobileDevice()); }, []);

  const processFiles = async (files) => {
    if (!files?.length) return;
    try {
      setUploading(true);
      const uploaded = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) { message.warning(`${file.name} is not an image`); continue; }
        if (file.size > 5 * 1024 * 1024) { message.warning(`${file.name} exceeds 5MB`); continue; }
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
    } catch {
      message.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e) => { await processFiles(e.target.files); setShowMobileOptions(false); };
  const handleCameraChange = async (e) => { await processFiles(e.target.files); setShowMobileOptions(false); };
  const handleUploadClick = () => { isMobile ? setShowMobileOptions(true) : fileInputRef.current?.click(); };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange}
        className="!hidden" id={`up-gallery-${fieldKey || "img"}`} />

      <button
        type="button" onClick={handleUploadClick} disabled={uploading}
        className="cursor-pointer flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-colors bg-gray-50 w-fit disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Spin size="small" /> : <PlusOutlined />}
        {uploading ? "Uploading..." : label}
      </button>

      {isMobile && showMobileOptions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowMobileOptions(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-center text-gray-700 font-semibold mb-4 text-base">Add Image</p>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor={`up-camera-${fieldKey || "img"}`}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-blue-50 border-2 border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
                onClick={() => setShowMobileOptions(false)}>
                <CameraOutlined style={{ fontSize: 32, color: "#2563eb" }} />
                <span className="text-sm font-semibold text-blue-700">Camera</span>
                <span className="text-xs text-blue-400 text-center">Take a new photo</span>
              </label>
              <label htmlFor={`up-gallery-${fieldKey || "img"}`}
                className="flex flex-col items-center justify-center gap-2 p-5 bg-green-50 border-2 border-green-200 rounded-xl cursor-pointer hover:bg-green-100 active:scale-95 transition-all"
                onClick={() => setShowMobileOptions(false)}>
                <UploadOutlined style={{ fontSize: 32, color: "#16a34a" }} />
                <span className="text-sm font-semibold text-green-700">Gallery</span>
                <span className="text-xs text-green-400 text-center">Choose from photos</span>
              </label>
            </div>
            <button type="button" onClick={() => setShowMobileOptions(false)}
              className="mt-4 w-full py-3 text-sm text-gray-500 font-medium rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors border-0">
              Cancel
            </button>
          </div>
        </div>
      )}

      {image_path?.length > 0 && <SortableImageList images={image_path} setImages={setImagePath} />}
    </div>
  );
};

// ─── UnitQtyInput — reusable quantity + unit picker ───────────────────────────

const UnitQtyInput = ({
  value,
  onChange,
  allowedUnits,
  label = "Quantity",
  required = false,
  size = "large",
  disabled = false,
}) => {
  const options = (allowedUnits?.length ? UNITS.filter((u) => allowedUnits.includes(u.value)) : UNITS)
    .map((u) => ({ value: u.value, label: `${u.icon} ${u.short}` }));

  const qty  = value?.qty  ?? "";
  const unit = value?.unit ?? "pcs";

  return (
    <div className="flex gap-2 items-stretch">
      <InputNumber
        value={qty === "" ? null : qty}
        onChange={(v) => onChange({ qty: v ?? 0, unit })}
        min={0}
        placeholder="0"
        size={size}
        disabled={disabled}
        style={{ flex: 1, borderRadius: 10 }}
        formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
        parser={(v) => v.replace(/,/g, "")}
      />
      <Select
        value={unit}
        onChange={(u) => onChange({ qty, unit: u })}
        options={options}
        size={size}
        disabled={disabled}
        style={{ minWidth: 110, borderRadius: 10 }}
        popupMatchSelectWidth={false}
      />
    </div>
  );
};

// ─── SizeInput — Width × Height with shared unit ──────────────────────────────

const SizeInput = ({ value = {}, onChange, size = "large", disabled = false }) => {
  const width  = value.width  ?? "";
  const height = value.height ?? "";
  const unit   = value.unit   ?? "feet";

  const emit = (patch) => onChange({ width, height, unit, ...patch });

  return (
    <div className="flex gap-2 items-stretch flex-wrap">
      <InputNumber
        value={width === "" ? null : width}
        onChange={(v) => emit({ width: v ?? "" })}
        min={0}
        placeholder="Width"
        size={size}
        disabled={disabled}
        style={{ flex: 1, minWidth: 90, borderRadius: 10 }}
        addonBefore={<span className="text-xs text-gray-500 font-semibold">W</span>}
        formatter={(v) => (v ? `${v}` : "")}
        parser={(v) => v}
      />
      <span className="flex items-center text-gray-400 font-bold text-base select-none">×</span>
      <InputNumber
        value={height === "" ? null : height}
        onChange={(v) => emit({ height: v ?? "" })}
        min={0}
        placeholder="Height"
        size={size}
        disabled={disabled}
        style={{ flex: 1, minWidth: 90, borderRadius: 10 }}
        addonBefore={<span className="text-xs text-gray-500 font-semibold">H</span>}
        formatter={(v) => (v ? `${v}` : "")}
        parser={(v) => v}
      />
      <Select
        value={unit}
        onChange={(u) => emit({ unit: u })}
        options={SIZE_UNITS}
        size={size}
        disabled={disabled}
        style={{ minWidth: 150, borderRadius: 10 }}
        popupMatchSelectWidth={false}
      />
    </div>
  );
};

// ─── UnitStockSummaryCard ─────────────────────────────────────────────────────

const UnitStockSummaryCard = ({ product }) => {
  const summary = _.get(product, "unit_stock_summary", []);
  const primaryUnit = _.get(product, "primary_unit", "pcs");

  const computed = useMemo(() => {
    if (summary.length > 0) return summary;
    const inEntries  = _.get(product, "stock_info", []);
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

  if (!computed.length) {
    return <span className="text-xs text-gray-400">No stock data</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      {computed.map(({ unit, net_stock, total_in, total_out }) => (
        <Tooltip
          key={unit}
          title={`IN: ${formatQty(total_in, unit)} | OUT: ${formatQty(total_out, unit)}`}
        >
          <div className="flex justify-between gap-2 text-xs cursor-help">
            <span
              className="font-semibold px-1 rounded"
              style={{
                background: unit === primaryUnit ? "#eff6ff" : "#f3f4f6",
                color:      unit === primaryUnit ? "#1d4ed8" : "#6b7280",
                fontSize: 10,
              }}
            >
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

// ─── StockRangeFilter ─────────────────────────────────────────────────────────

const STOCK_PRESETS = [
  { label: "Out of Stock", min: 0, max: 0, color: "#dc2626", bg: "#fff1f2", border: "#fecaca" },
  { label: "Low (1–10)", min: 1, max: 10, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { label: "Medium (11–50)", min: 11, max: 50, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "High (50+)", min: 50, max: null, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
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

  const isPresetActive = (preset) =>
    stockMin === (preset.min ?? "") && stockMax === (preset.max ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {STOCK_PRESETS.map((preset) => {
          const active = isPresetActive(preset);
          return (
            <button key={preset.label} type="button" onClick={() => handlePreset(preset)}
              style={{
                background: active ? preset.color : preset.bg, borderColor: active ? preset.color : preset.border,
                color: active ? "#fff" : preset.color, border: "1.5px solid", borderRadius: 20,
                padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", outline: "none",
              }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <InputNumber placeholder="Min" min={0} value={stockMin === "" ? null : stockMin}
          onChange={(val) => onStockMinChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} prefix={<span className="text-gray-400 text-xs">≥</span>} />
        <span className="text-gray-400 font-bold text-lg flex-shrink-0">—</span>
        <InputNumber placeholder="Max" min={0} value={stockMax === "" ? null : stockMax}
          onChange={(val) => onStockMaxChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} prefix={<span className="text-gray-400 text-xs">≤</span>} />
        {hasActive && (
          <Tooltip title="Clear stock range">
            <Button size="large" onClick={onClear}
              style={{ borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", flexShrink: 0, fontWeight: 700 }}>
              ✕
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// ─── PriceRangeFilter ─────────────────────────────────────────────────────────

const PRICE_PRESETS = [
  { label: "Under ₹500", min: null, max: 500, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { label: "₹500–₹1,000", min: 500, max: 1000, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "₹1,000–₹5,000", min: 1000, max: 5000, color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  { label: "₹5,000+", min: 5000, max: null, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
];

const PriceRangeFilter = ({ priceMin, priceMax, onPriceMinChange, onPriceMaxChange, onClear }) => {
  const hasActive = priceMin !== "" || priceMax !== "";

  const handlePreset = (preset) => {
    const pMin = preset.min ?? ""; const pMax = preset.max ?? "";
    if (priceMin === pMin && priceMax === pMax) { onPriceMinChange(""); onPriceMaxChange(""); }
    else { onPriceMinChange(pMin); onPriceMaxChange(pMax); }
  };

  const isPresetActive = (preset) => priceMin === (preset.min ?? "") && priceMax === (preset.max ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRICE_PRESETS.map((preset) => {
          const active = isPresetActive(preset);
          return (
            <button key={preset.label} type="button" onClick={() => handlePreset(preset)}
              style={{
                background: active ? preset.color : preset.bg, borderColor: active ? preset.color : preset.border,
                color: active ? "#fff" : preset.color, border: "1.5px solid", borderRadius: 20,
                padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", outline: "none",
              }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <InputNumber placeholder="Min ₹" min={0} value={priceMin === "" ? null : priceMin}
          onChange={(val) => onPriceMinChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} prefix={<span className="text-gray-400 text-xs">₹≥</span>}
          formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
          parser={(v) => v.replace(/,/g, "")} />
        <span className="text-gray-400 font-bold text-lg flex-shrink-0">—</span>
        <InputNumber placeholder="Max ₹" min={0} value={priceMax === "" ? null : priceMax}
          onChange={(val) => onPriceMaxChange(val === null ? "" : val)} className="w-full" size="large"
          style={{ borderRadius: 10 }} prefix={<span className="text-gray-400 text-xs">₹≤</span>}
          formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
          parser={(v) => v.replace(/,/g, "")} />
        {hasActive && (
          <Tooltip title="Clear price range">
            <Button size="large" onClick={onClear}
              style={{ borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", flexShrink: 0, fontWeight: 700 }}>
              ✕
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// ─── MaterialStatsCard ────────────────────────────────────────────────────────

const MaterialStatsCard = ({ stats }) => {
  if (!stats) return <span className="text-xs text-gray-400">—</span>;
  const {
    total_issued_qty   = 0,
    total_returned_qty = 0,
    total_wastage_qty  = 0,
    avg_wastage_pct    = 0,
    issue_count        = 0,
    stats_unit         = "sqft",
  } = stats;

  const u = unitLabel(stats_unit);

  return (
    <div className="flex flex-col gap-1 text-xs min-w-[140px]">
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Issued:</span>
        <span className="font-bold text-orange-600">{total_issued_qty} {u}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Returned:</span>
        <span className="font-bold text-green-600">{total_returned_qty} {u}</span>
      </div>
      <div className="flex justify-between gap-2 border-t border-dashed border-gray-200 pt-1">
        <span className="text-gray-500">Wastage:</span>
        <span className="font-bold text-red-500">{total_wastage_qty} {u}</span>
      </div>
      <div className="flex justify-between gap-2">
        <Tooltip title="Average wastage across all print jobs">
          <span className="text-gray-500 cursor-help">Avg Waste%:</span>
        </Tooltip>
        <span className={`font-bold ${avg_wastage_pct > 20 ? "text-red-500" : avg_wastage_pct > 10 ? "text-orange-500" : "text-green-600"}`}>
          {Number(avg_wastage_pct).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-gray-500">Jobs:</span>
        <span className="font-bold text-blue-600">{issue_count}</span>
      </div>
    </div>
  );
};

// ─── MaterialIssueHistoryModal ────────────────────────────────────────────────

const MaterialIssueHistoryModal = ({ open, onClose, product }) => {
  const issues = _.get(product, "material_issues", []);
  const stats  = _.get(product, "material_stats", {});
  const statsUnit = stats.stats_unit || "sqft";

  const totalIssued   = stats.total_issued_qty   || 0;
  const totalReturned = stats.total_returned_qty  || 0;
  const totalWastage  = stats.total_wastage_qty   || 0;
  const avgWastage    = stats.avg_wastage_pct     || 0;
  const u = unitLabel(statsUnit);

  const columns = [
    {
      title: "Issue No.", dataIndex: "issue_no", key: "issue_no", width: 100,
      render: (v) => <span className="font-mono text-xs font-bold text-blue-700">{v || "—"}</span>,
    },
    {
      title: "Job No.", dataIndex: "job_no", key: "job_no", width: 100,
      render: (v) => <span className="font-mono text-xs">{v || "—"}</span>,
    },
    {
      title: "Issued Qty", dataIndex: "unit_qty", key: "issued_qty", width: 120, align: "center",
      render: (uq, record) => {
        const display = uq ? formatQty(uq.qty, uq.unit) : formatQty(record.issued_qty, record.unit);
        return <span className="font-bold text-orange-600 text-sm">{display}</span>;
      },
    },
    {
      title: "Returned Qty", dataIndex: "return_unit_qty", key: "returned_qty", width: 120, align: "center",
      render: (ruq, record) => {
        if (ruq) return <span className="font-bold text-green-600 text-sm">{formatQty(ruq.qty, ruq.unit)}</span>;
        if (record.returned_qty != null) return <span className="font-bold text-green-600 text-sm">{formatQty(record.returned_qty, record.unit)}</span>;
        return <Tag color="warning" className="text-xs">Pending</Tag>;
      },
    },
    {
      title: "Issued To", dataIndex: "issued_to", key: "issued_to",
      render: (v) => <span className="text-xs">{v || "—"}</span>,
    },
    {
      title: "Issued By", dataIndex: "issued_by", key: "issued_by",
      render: (v) => <span className="text-xs">{v || "—"}</span>,
    },
    {
      title: "Date", dataIndex: "issued_at", key: "issued_at", width: 130,
      render: (v) => <span className="text-xs text-gray-600">{v ? moment(v).format("DD/MM/YYYY h:mm A") : "—"}</span>,
    },
    {
      title: "Notes", dataIndex: "notes", key: "notes",
      render: (v) => <span className="text-xs text-gray-500">{v || "—"}</span>,
    },
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
            <div className="text-xs text-gray-500 font-normal">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Tag color="orange" className="font-semibold">Issued: {totalIssued} {u}</Tag>
            <Tag color="green"  className="font-semibold">Returned: {totalReturned} {u}</Tag>
            <Tag color="red"    className="font-semibold">Wastage: {totalWastage} {u}</Tag>
            <Tag color="blue"   className="font-semibold">Jobs: {stats.issue_count || 0}</Tag>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {[
          { label: "Total Issued",   val: totalIssued,   color: "#fff7ed", border: "#fed7aa", textColor: "#ea580c" },
          { label: "Total Returned", val: totalReturned, color: "#f0fdf4", border: "#bbf7d0", textColor: "#16a34a" },
          { label: "Total Wastage",  val: totalWastage,  color: "#fff1f2", border: "#fecaca", textColor: "#dc2626" },
        ].map(({ label, val, color, border, textColor }) => (
          <div key={label} className="rounded-xl p-3 flex flex-col items-center" style={{ background: color, border: `1px solid ${border}` }}>
            <span className="text-xs font-semibold mb-1" style={{ color: textColor }}>{label}</span>
            <span className="text-2xl font-extrabold" style={{ color: textColor }}>{val}</span>
            <span className="text-xs" style={{ color: textColor, opacity: 0.7 }}>{u}</span>
          </div>
        ))}
        <div className="rounded-xl p-3 flex flex-col items-center"
          style={{
            background: avgWastage > 20 ? "#fff1f2" : avgWastage > 10 ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${avgWastage > 20 ? "#fecaca" : avgWastage > 10 ? "#fde68a" : "#bbf7d0"}`,
          }}>
          <span className="text-xs font-semibold mb-1" style={{ color: avgWastage > 20 ? "#dc2626" : avgWastage > 10 ? "#d97706" : "#16a34a" }}>
            Avg Wastage %
          </span>
          <span className="text-2xl font-extrabold" style={{ color: avgWastage > 20 ? "#dc2626" : avgWastage > 10 ? "#d97706" : "#16a34a" }}>
            {Number(avgWastage).toFixed(1)}%
          </span>
          {avgWastage > 20 && <WarningOutlined style={{ color: "#dc2626", fontSize: 12 }} />}
        </div>
      </div>

      <Table
        dataSource={issues.map((item, i) => ({ ...item, key: `issue-${i}` }))}
        columns={columns}
        size="small"
        scroll={{ x: 800 }}
        pagination={{ pageSize: 10, showSizeChanger: false, size: "small" }}
        locale={{
          emptyText: (
            <div className="py-10 text-gray-400 text-sm text-center">
              <ExperimentOutlined style={{ fontSize: 28, color: "#fed7aa" }} />
              <div className="mt-2">No material issuances recorded yet</div>
            </div>
          ),
        }}
      />
    </Modal>
  );
};

// ─── NewProductStockModal ─────────────────────────────────────────────────────

const NewProductStockModal = ({ open, onClose, onSuccess, categoryData, subcategoryData, allVendors }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [productImages, setProductImages] = useState([]);
  const [stockImages, setStockImages] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [primaryUnit, setPrimaryUnit] = useState("pcs");
  const [supportedUnits, setSupportedUnits] = useState(["pcs"]);
  const [stockUnitQty, setStockUnitQty] = useState({ qty: 0, unit: "pcs" });
  const [productSize, setProductSize] = useState({ width: "", height: "", unit: "feet" });

  useEffect(() => {
    if (open) {
      // ── Auto-fill Date & Time with current datetime ──
      form.setFieldsValue({ date: moment() });
    } else {
      form.resetFields();
      setProductImages([]);
      setStockImages([]);
      setFilteredSubcategories([]);
      setSelectedCategory(null);
      setPrimaryUnit("pcs");
      setSupportedUnits(["pcs"]);
      setStockUnitQty({ qty: 0, unit: "pcs" });
      setProductSize({ width: "", height: "", unit: "feet" });
    }
  }, [open]);

  const handlePrimaryUnitChange = (unit) => {
    setPrimaryUnit(unit);
    setSupportedUnits((prev) => (prev.includes(unit) ? prev : [unit, ...prev]));
    setStockUnitQty((prev) => ({ ...prev, unit }));
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const unitQty = stockUnitQty;
      const stockEntry = {
        _id: uuidv4(),
        add_stock:    Number(values.initial_stock) || unitQty.qty || 0,
        unit_qty:     unitQty,
        handler_name: values.handler_name || "",
        location:     values.location || "",
        invoice:      values.invoice || "",
        invoice_date: values.invoice_date ? values.invoice_date.toISOString() : null,
        notes:        values.notes || "",
        stock_images: stockImages.map((img) => ({ _id: img._id, path: img.path, url: img.url })),
        date:         values.date ? values.date.toISOString() : new Date().toISOString(),
      };

      const unitStockSummary = supportedUnits.map((u) => ({
        unit:      u,
        total_in:  u === unitQty.unit ? unitQty.qty : 0,
        total_out: 0,
        net_stock: u === unitQty.unit ? unitQty.qty : 0,
      }));

      const sizePayload =
        (productSize.width !== "" || productSize.height !== "")
          ? {
              width:  productSize.width  !== "" ? Number(productSize.width)  : null,
              height: productSize.height !== "" ? Number(productSize.height) : null,
              unit:   productSize.unit,
            }
          : null;

      const payload = {
        name:                   values.name,
        material_brand:         values.material_brand || "",
        size:                   sizePayload,
        HSNcode_time:           values.HSNcode_time || "",
        type:                   values.type || "Stand Alone Product",
        MRP_price:              values.MRP_price || "",
        customer_product_price: values.customer_price || "",
        primary_unit:           primaryUnit,
        supported_units:        supportedUnits,
        unit_stock_summary:     unitStockSummary,
        stock_info:             [stockEntry],
        stock_count:            unitQty.qty || Number(values.initial_stock) || 0,
        stock_offline:          [],
        stocks_status:          (unitQty.qty || Number(values.initial_stock) || 0) > 10 ? "In Stock" : "Limited",
        is_visible:             false,
        material_issues:        [],
        material_stats: {
          total_issued_qty:   0,
          total_returned_qty: 0,
          total_wastage_qty:  0,
          avg_wastage_pct:    0,
          issue_count:        0,
          stats_unit:         primaryUnit,
        },
      };

      const result = await addproduct(payload);
      SUCCESS_NOTIFICATION(result);
      onSuccess();
      onClose();
    } catch (err) {
      ERROR_NOTIFICATION(err);
    } finally {
      setLoading(false);
    }
  };

  const productTypes = [
    { value: "Stand Alone Product", label: "Stand Alone Product" },
    { value: "Variable Product",    label: "Variable Product" },
    { value: "Variant Product",     label: "Variant Product" },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={860} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center">
            <PlusOutlined style={{ color: "#0d9488", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Add New Product</div>
            <div className="text-xs text-gray-500 font-normal">Create a new product with initial stock info</div>
          </div>
          <Tag color="cyan" className="ml-auto font-semibold">New Entry</Tag>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-teal-500 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Product Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <Form.Item label="Product Name" name="name"
              rules={[formValidation("Enter product name")]}>
              <Input placeholder="e.g. Vinyl Banner Roll" className="h-10" />
            </Form.Item>

            <Form.Item
              label={
                <span className="flex items-center gap-1">
                  Material Brand
                  <Tooltip title="The brand / manufacturer of this material (e.g. 3M, LG, Avery)">
                    <span className="text-gray-400 cursor-help text-xs border border-gray-300 rounded-full w-4 h-4 inline-flex items-center justify-center ml-1">?</span>
                  </Tooltip>
                </span>
              }
              name="material_brand"
            >
              <Input placeholder="e.g. 3M, LG Hausys, Avery Dennison" className="h-10"
                prefix={<span className="text-gray-400 text-sm">🏷️</span>} />
            </Form.Item>

            <Form.Item label="HSN Code" name="HSNcode_time">
              <Input placeholder="e.g. VND-001" className="h-10" />
            </Form.Item>

            <Form.Item label="Product Type" name="type">
              <Select placeholder="Select type" options={productTypes} allowClear className="h-10" />
            </Form.Item>

            <Form.Item label="MRP Price (₹)" name="MRP_price">
              <Input type="number" placeholder="e.g. 999" className="h-10" prefix="₹" />
            </Form.Item>

            <Form.Item label="Customer Price (₹)" name="customer_price">
              <Input type="number" placeholder="e.g. 799" className="h-10" prefix="₹" />
            </Form.Item>

          </div>
        </div>

        <div className="rounded-2xl p-4 mb-4" style={{ background: "#fefce8", border: "1.5px solid #fde68a" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-yellow-400 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Size</span>
            <Tooltip title="Physical dimensions of this product/material — stored per product for reference and reporting.">
              <span className="text-gray-400 cursor-help text-xs border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center">?</span>
            </Tooltip>
            <span className="ml-auto text-xs text-gray-400 font-medium">Optional</span>
          </div>

          <Text className="text-sm font-semibold text-gray-700 mb-1 block">Width × Height</Text>
          <Text className="text-xs text-gray-400 mb-2 block">
            Enter the physical size of the product and choose the measurement unit
          </Text>

          <SizeInput value={productSize} onChange={setProductSize} />

          {(productSize.width !== "" || productSize.height !== "") && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#fef9c3", border: "1px solid #fde68a", color: "#854d0e" }}>
              📐 Size: {productSize.width !== "" ? productSize.width : "—"} × {productSize.height !== "" ? productSize.height : "—"} {productSize.unit}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4 mb-4" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-teal-600 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Unit Configuration</span>
            <Tooltip title="Set how this product's stock is measured.">
              <span className="text-gray-400 cursor-help text-xs border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center">?</span>
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Primary Unit</Text>
              <Text className="text-xs text-gray-400 mb-2 block">The default unit shown in stock tables and reports</Text>
              <Select
                value={primaryUnit}
                onChange={handlePrimaryUnitChange}
                className="w-full"
                size="large"
                options={UNITS.map((u) => ({ value: u.value, label: `${u.icon} ${u.label}` }))}
              />
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Additional Units</Text>
              <Text className="text-xs text-gray-400 mb-2 block">Enable tracking in more than one dimension</Text>
              <Select
                mode="multiple"
                value={supportedUnits}
                onChange={setSupportedUnits}
                className="w-full"
                size="large"
                options={UNITS.map((u) => ({ value: u.value, label: `${u.icon} ${u.short}` }))}
                placeholder="Select additional units..."
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {supportedUnits.map((u) => (
              <Tag key={u} color={u === primaryUnit ? "green" : "default"} className="font-semibold text-xs">
                {UNIT_MAP[u]?.icon} {unitLabel(u)}{u === primaryUnit ? " (primary)" : ""}
              </Tag>
            ))}
          </div>
        </div>

        <div className="border-t border-dashed border-gray-200 my-5" />

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-green-500 rounded-full" />
            <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Initial Stock Info</span>
            <Tag color="success" className="text-xs">Stock IN Entry</Tag>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="md:col-span-2">
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">
                Initial Stock Quantity <span className="text-red-500">*</span>
              </Text>
              <UnitQtyInput
                value={stockUnitQty}
                onChange={setStockUnitQty}
                allowedUnits={supportedUnits.length ? supportedUnits : undefined}
              />
              <Text className="text-xs text-gray-400 mt-1 block">
                Enter quantity and select the unit for this stock entry
              </Text>
            </div>

            {/* ── REMOVED: Buy Price (₹) field ── */}

            <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
              <Input placeholder="Who handled this?" className="h-10" />
            </Form.Item>

            <Form.Item label="Location / Rack" name="location">
              <Input placeholder="e.g. Warehouse Rack A-3" className="h-10" />
            </Form.Item>

            {/* ── Date & Time — pre-filled with current datetime ── */}
            <Form.Item label="Date & Time" name="date" rules={[formValidation("Select a date")]}>
              <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
            </Form.Item>

            <Form.Item label="Invoice No." name="invoice">
              <Input placeholder="e.g. INV-001" className="h-10" />
            </Form.Item>

            {/* ── NEW: Invoice Date & Time ── */}
            <Form.Item label="Invoice Date & Time" name="invoice_date">
              <DatePicker
                showTime
                className="h-10 w-full"
                format="DD/MM/YYYY h:mm A"
                placeholder="Select invoice date & time"
              />
            </Form.Item>

            <Form.Item label="Notes" name="notes" className="md:col-span-2">
              <Input.TextArea placeholder="Any additional notes about this stock entry..." rows={2} />
            </Form.Item>
            <Form.Item label="Stock Entry Images" className="md:col-span-2">
              <UploadHelper max={10} setImagePath={setStockImages} image_path={stockImages}
                label="Upload Stock Images" fieldKey="new-product-stock" />
            </Form.Item>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100">
          <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}
            className="rounded-lg px-6 h-10 font-semibold"
            style={{ background: "#0d9488", borderColor: "#0d9488" }}>
            Create Product
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// ─── StockInModal ─────────────────────────────────────────────────────────────
const StockInModal = ({ open, onClose, product, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  const primaryUnit    = _.get(product, "primary_unit", "pcs");
  const supportedUnits = _.get(product, "supported_units", [primaryUnit]);

  const [unitQty, setUnitQty] = useState({ qty: 0, unit: primaryUnit });

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setImages([]);
      setUnitQty({ qty: 0, unit: primaryUnit });
    } else {
      setUnitQty({ qty: 0, unit: primaryUnit });
      // ── Auto-fill Date & Time with current datetime ──
      form.setFieldsValue({ date: moment() });
    }
  }, [open, primaryUnit]);

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
        unit_qty:     unitQty,
        handler_name: values.handler_name,
        location:     values.location,
        invoice:      values.invoice,
        invoice_date: values.invoice_date ? values.invoice_date.toISOString() : null,
        notes:        values.notes,
        stock_images: images.map((img) => ({ _id: img._id, path: img.path, url: img.url })),
        date:         values.date ? values.date.toISOString() : new Date().toISOString(),
      };
      const updatedStockInfo = [...existingStockInfo, newEntry];

      const existingOut = _.get(product, "stock_offline", []);
      const newSummary  = buildUnitSummary(updatedStockInfo, existingOut, primaryUnit);

      const primarySummary = newSummary.find((s) => s.unit === unitQty.unit);
      const legacyStockCount = primarySummary ? primarySummary.net_stock : 0;

      const payload = {
        stock_info:          updatedStockInfo,
        unit_stock_summary:  newSummary,
        stock_count:         legacyStockCount,
      };
      const result = await editProduct(payload, product._id);
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
            <div className="text-xs text-gray-500 font-normal">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Tag color="blue" className="font-semibold text-xs">
              Primary unit: {UNIT_MAP[primaryUnit]?.icon} {unitLabel(primaryUnit)}
            </Tag>
            <Tag color="success" className="font-semibold">
              Current: {formatQty(_.get(product, "stock_count", 0), primaryUnit)}
            </Tag>
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
            <UnitQtyInput
              value={unitQty}
              onChange={setUnitQty}
              allowedUnits={supportedUnits.length ? supportedUnits : undefined}
            />
            {unitQty.qty > 0 && (
              <div className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                <ArrowUpOutlined />
                Adding {formatQty(unitQty.qty, unitQty.unit)} to stock
              </div>
            )}
          </div>

          {/* ── REMOVED: Buy Price field ── */}

          <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
            <Input placeholder="Who handled this?" className="h-10" />
          </Form.Item>

          <Form.Item label="Location" name="location">
            <Input placeholder="Warehouse Rack no" className="h-10" />
          </Form.Item>

          {/* ── Date & Time — pre-filled with current datetime ── */}
          <Form.Item label="Date & Time" name="date" rules={[formValidation("Select a date")]}>
            <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
          </Form.Item>

          <Form.Item label="Invoice No." name="invoice">
            <Input placeholder="INV-001" className="h-10" />
          </Form.Item>

          {/* ── NEW: Invoice Date & Time ── */}
          <Form.Item label="Invoice Date & Time" name="invoice_date">
            <DatePicker
              showTime
              className="h-10 w-full"
              format="DD/MM/YYYY h:mm A"
              placeholder="Select invoice date & time"
            />
          </Form.Item>

          <Form.Item label="Notes" name="notes" className="md:col-span-2">
            <Input.TextArea placeholder="Any additional notes..." rows={2} />
          </Form.Item>
          <Form.Item label="Stock Images" className="md:col-span-2">
            <UploadHelper max={10} setImagePath={setImages} image_path={images}
              label="Upload Images" fieldKey="stock-in" />
          </Form.Item>
        </div>
        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100">
          <Button onClick={onClose} className="rounded-lg px-6">Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<ArrowUpOutlined />}
            className="rounded-lg px-6 h-10 font-semibold"
            style={{ background: "#16a34a", borderColor: "#16a34a" }}>
            Confirm Stock IN
          </Button>
        </div>
      </Form>
    </Modal>
  );
};


// ─── StockOutModal ────────────────────────────────────────────────────────────
const StockOutModal = ({ open, onClose, product, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const primaryUnit    = _.get(product, "primary_unit", "pcs");
  const supportedUnits = _.get(product, "supported_units", [primaryUnit]);
  const currentStock   = _.get(product, "stock_count", 0);

  const [unitQty, setUnitQty] = useState({ qty: 0, unit: primaryUnit });

  useEffect(() => {
    if (!open) { form.resetFields(); setUnitQty({ qty: 0, unit: primaryUnit }); }
    else { setUnitQty({ qty: 0, unit: primaryUnit }); }
  }, [open, primaryUnit]);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const qty = unitQty.qty;
      if (unitQty.unit === primaryUnit && qty > currentStock) {
        message.error(`Cannot remove ${formatQty(qty, unitQty.unit)} — only ${formatQty(currentStock, primaryUnit)} in stock`);
        return;
      }
      const existingStockOffline = _.get(product, "stock_offline", []).map((item) => ({
        ...item,
        date: item.date ? new Date(item.date).toISOString() : null,
      }));
      const newEntry = {
        stock:            qty,
        unit_qty:         unitQty,
        handler_name:     values.handler_name,
        location:         values.location,
        customer_details: values.customer_details,
        notes:            values.notes,
        date:             values.date ? values.date.toISOString() : new Date().toISOString(),
      };
      const updatedStockOffline = [...existingStockOffline, newEntry];
      const existingIn  = _.get(product, "stock_info", []);
      const newSummary  = buildUnitSummary(existingIn, updatedStockOffline, primaryUnit);
      const primarySum  = newSummary.find((s) => s.unit === unitQty.unit);
      const legacyCount = primarySum ? primarySum.net_stock : currentStock - qty;

      const payload = {
        stock_offline:       updatedStockOffline,
        unit_stock_summary:  newSummary,
        stock_count:         Math.max(0, legacyCount),
      };
      const result = await editProduct(payload, product._id);
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
    <Modal open={open} onCancel={onClose} footer={null} width={600} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <ArrowDownOutlined style={{ color: "#dc2626" }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Stock OUT</div>
            <div className="text-xs text-gray-500 font-normal">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Tag color="blue" className="font-semibold text-xs">
              {UNIT_MAP[primaryUnit]?.icon} {unitLabel(primaryUnit)}
            </Tag>
            <Tag color="error" className="font-semibold">
              Current: {formatQty(currentStock, primaryUnit)}
            </Tag>
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="md:col-span-2">
            <Text className="text-sm font-semibold text-gray-700 mb-1 block">
              Remove Stock Quantity <span className="text-red-500">*</span>
            </Text>
            <UnitQtyInput
              value={unitQty}
              onChange={(v) => {
                if (v.unit === primaryUnit && v.qty > currentStock) {
                  message.warning(`Max available: ${formatQty(currentStock, primaryUnit)}`);
                }
                setUnitQty(v);
              }}
              allowedUnits={supportedUnits.length ? supportedUnits : undefined}
            />
            {unitQty.qty > 0 && (
              <div className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <ArrowDownOutlined />
                Removing {formatQty(unitQty.qty, unitQty.unit)} from stock
              </div>
            )}
          </div>

          <Form.Item label="Handler Name" name="handler_name" rules={[formValidation("Enter handler name")]}>
            <Input placeholder="Who handled this?" className="h-10" />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input placeholder="Warehouse / Store" className="h-10" />
          </Form.Item>
          <Form.Item label="Date & Time" name="date" rules={[formValidation("Select a date")]}>
            <DatePicker showTime className="h-10 w-full" format="DD/MM/YYYY h:mm A" />
          </Form.Item>
          <Form.Item label="Customer Details" name="customer_details">
            <Input placeholder="Customer details" className="h-10" />
          </Form.Item>
          <Form.Item label="Notes" name="notes" className="md:col-span-2">
            <Input.TextArea placeholder="Reason for removal..." rows={2} />
          </Form.Item>
        </div>
        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100">
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

// ─── StockHistoryModal ────────────────────────────────────────────────────────
const StockHistoryModal = ({ open, onClose, product }) => {
  const primaryUnit = _.get(product, "primary_unit", "pcs");

  const stockIn = _.get(product, "stock_info", []).map((item, i) => ({
    key:         `in-${i}`,
    quantity:    item.add_stock,
    unit_qty:    item.unit_qty || { qty: item.add_stock, unit: primaryUnit },
    handler_name:item.handler_name || "—",
    location:    item.location || "—",
    invoice:     item.invoice || "—",
    invoice_date:item.invoice_date ? moment(item.invoice_date).format("DD/MM/YYYY h:mm A") : "—",
    notes:       item.notes || "—",
    date:        item.date ? moment(item.date).format("DD/MM/YYYY h:mm A") : "—",
    images:      item.stock_images || [],
  }));

  const stockOut = _.get(product, "stock_offline", []).map((item, i) => ({
    key:             `out-${i}`,
    quantity:        item.stock,
    unit_qty:        item.unit_qty || { qty: item.stock, unit: primaryUnit },
    handler_name:    item.handler_name || "—",
    location:        item.location || "—",
    customer_details:item.customer_details || "—",
    notes:           item.notes || "—",
    date:            item.date ? moment(item.date).format("DD/MM/YYYY h:mm A") : "—",
  }));

  const inTotals  = groupByUnit(stockIn.map((r) => r.unit_qty));
  const outTotals = groupByUnit(stockOut.map((r) => r.unit_qty));
  const allUnits  = [...new Set([...Object.keys(inTotals), ...Object.keys(outTotals)])];

  const inColumns = [
    {
      title: "Date & Time", dataIndex: "date", key: "date", width: 145,
      render: (t) => <span className="text-xs text-gray-600">{t}</span>
    },
    {
      title: "Qty", dataIndex: "unit_qty", key: "qty", width: 110, align: "center",
      render: (uq) => <span className="font-bold text-green-600 text-sm">+{formatQty(uq.qty, uq.unit)}</span>
    },
    {
      title: "Material Brand", key: "material_brand", width: 130,
      render: () => {
        const brand = product?.material_brand;
        return brand
          ? <span className="inline-flex items-center gap-1 text-xs text-indigo-700 font-medium">🏷️ {brand}</span>
          : <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      title: "Size", key: "size", width: 140,
      render: () => {
        const size = product?.size;
        if (!size) return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
            📐 {size.width ?? "—"} × {size.height ?? "—"} {size.unit}
          </span>
        );
      },
    },
    {
      title: "Handler", dataIndex: "handler_name", key: "handler_name",
      render: (t) => <span className="text-xs">{t}</span>
    },
    {
      title: "Location", dataIndex: "location", key: "location",
      render: (t) => <span className="text-xs">{t}</span>
    },
    {
      title: "Invoice", dataIndex: "invoice", key: "invoice",
      render: (t) => <span className="text-xs">{t}</span>
    },
    {
      title: "Invoice Date", dataIndex: "invoice_date", key: "invoice_date", width: 145,
      render: (t) => <span className="text-xs text-gray-600">{t}</span>
    },
    {
      title: "Notes", dataIndex: "notes", key: "notes",
      render: (t) => <span className="text-xs">{t}</span>
    },
    {
      title: "Images", dataIndex: "images", key: "images", width: 100,
      render: (imgs) =>
        imgs?.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {imgs.slice(0, 3).map((img, i) => (
              <Image key={i} src={img.url || img.path || img} width={32} height={32}
                className="object-cover rounded" preview />
            ))}
            {imgs.length > 3 && <span className="text-xs text-gray-400 self-center">+{imgs.length - 3}</span>}
          </div>
        ) : <span className="text-xs text-gray-400">—</span>,
    },
  ];

  const outColumns = [
    { title: "Date & Time", dataIndex: "date", key: "date", width: 145,
      render: (t) => <span className="text-xs text-gray-600">{t}</span> },
    { title: "Qty", dataIndex: "unit_qty", key: "qty", width: 110, align: "center",
      render: (uq) => <span className="font-bold text-red-600 text-sm">−{formatQty(uq.qty, uq.unit)}</span> },
    { title: "Handler", dataIndex: "handler_name", key: "handler_name",
      render: (t) => <span className="text-xs">{t}</span> },
    { title: "Location", dataIndex: "location", key: "location",
      render: (t) => <span className="text-xs">{t}</span> },
    { title: "Customer", dataIndex: "customer_details", key: "customer_details",
      render: (t) => <span className="text-xs">{t}</span> },
    { title: "Notes", dataIndex: "notes", key: "notes",
      render: (t) => <span className="text-xs">{t}</span> },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1100} destroyOnClose
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
            <SwapOutlined style={{ color: "#2563eb", fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Stock Movement History</div>
            <div className="text-xs text-gray-500 font-normal">{product?.name}</div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            {allUnits.map((u) => {
              const netStock = (inTotals[u] || 0) - (outTotals[u] || 0);
              return (
                <Tag key={u} color="blue" className="font-semibold text-xs">
                  {UNIT_MAP[u]?.icon} Net {unitLabel(u)}: {netStock.toLocaleString()}
                </Tag>
              );
            })}
          </div>
        </div>
      }
    >
      {allUnits.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-2">
          {allUnits.map((u) => {
            const inQty  = inTotals[u]  || 0;
            const outQty = outTotals[u] || 0;
            const net    = inQty - outQty;
            return (
              <div key={u} className="rounded-xl p-3 flex flex-col" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span className="text-xs font-bold text-gray-500 mb-1">{UNIT_MAP[u]?.icon} {unitLabel(u)}</span>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">+{inQty.toLocaleString()}</span>
                  <span className="text-red-500">−{outQty.toLocaleString()}</span>
                </div>
                <span className={`text-lg font-extrabold ${net >= 0 ? "text-gray-800" : "text-red-600"}`}>
                  {net.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
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
            rowClassName={() => "bg-green-50 hover:bg-green-100"}
            locale={{ emptyText: (
              <div className="py-8 text-gray-400 text-sm text-center">
                <ArrowUpOutlined style={{ fontSize: 24, color: "#86efac" }} />
                <div className="mt-2">No stock IN records yet</div>
              </div>
            )}} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
              <ArrowDownOutlined style={{ color: "#dc2626", fontSize: 13 }} />
            </div>
            <span className="font-bold text-red-600 text-sm">Stock OUT</span>
            <Tag color="error" className="ml-1 text-xs font-semibold">{stockOut.length} entries</Tag>
          </div>
          <Table dataSource={stockOut} columns={outColumns} size="small" scroll={{ x: 500 }}
            pagination={{ pageSize: 8, showSizeChanger: false, size: "small" }}
            rowClassName={() => "bg-red-50 hover:bg-red-100"}
            locale={{ emptyText: (
              <div className="py-8 text-gray-400 text-sm text-center">
                <ArrowDownOutlined style={{ fontSize: 24, color: "#fca5a5" }} />
                <div className="mt-2">No stock OUT records yet</div>
              </div>
            )}} />
        </div>
      </div>
    </Modal>
  );
};

// ─── Utility: build unit_stock_summary ───────────────────────────────────────
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

function groupByUnit(unitQtyArray = []) {
  const totals = {};
  unitQtyArray.forEach(({ qty = 0, unit = "pcs" } = {}) => {
    totals[unit] = (totals[unit] || 0) + Number(qty);
  });
  return totals;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const AddProduct = () => {
  const { user } = useSelector((state) => state.authSlice);

  const [formStatus, setFormStatus] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [search, setSearch] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [mainCategory, setMainCategoryData] = useState([]);
  const [filterByProductCategory, setFilterByProductCategory] = useState("");
  const [filterByProductSubcategory, setFilterByProductSubcategory] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [filterByType, setFilterByType] = useState("");
  const [vendorClose, setVendorClose] = useState([]);
  const [subcategoryData, setSubcategoryData] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [subcategoryDataFilter, setSubcategoryDataFilter] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [vendorNames, setVendorNames] = useState({});
  const [vendorsLoading, setVendorsLoading] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [activeTabKey, setActiveTabKey] = useState("1");
  const [updatingProductId, setUpdatingProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);

  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [newProductModal, setNewProductModal] = useState(false);
  const [stockInProduct, setStockInProduct] = useState(null);
  const [stockOutProduct, setStockOutProduct] = useState(null);
  const [stockHistoryProduct, setStockHistoryProduct] = useState(null);
  const [materialIssueProduct, setMaterialIssueProduct] = useState(null);

  const hasEditPermission = true;
  const hasDeletePermission = true;

  const [paginationConfig, setPaginationConfig] = useState(() => {
    const savedPageSize    = localStorage.getItem(STORAGE_KEYS.PAGE_SIZE);
    const savedCurrentPage = localStorage.getItem(STORAGE_KEYS.CURRENT_PAGE);
    const savedActiveTab   = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (savedActiveTab) setActiveTabKey(savedActiveTab);
    return {
      pageSize:    savedPageSize    ? parseInt(savedPageSize, 10)    : 10,
      currentPage: savedCurrentPage ? parseInt(savedCurrentPage, 10) : 1,
    };
  });

  const [initialFilters] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTERS);
    return saved ? JSON.parse(saved) : {};
  });

  const [form] = useForm();

  const savePaginationToStorage = (pageSize, currentPage) => {
    localStorage.setItem(STORAGE_KEYS.PAGE_SIZE, pageSize.toString());
    localStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, currentPage.toString());
  };

  const saveFiltersToStorage = (filters) => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  };

  const handlePageSizeChange = (pageSize) => {
    const newPag = { ...paginationConfig, pageSize, currentPage: 1 };
    setPaginationConfig(newPag);
    savePaginationToStorage(pageSize, 1);
  };

  const handlePageChange = (currentPage) => {
    const newPag = { ...paginationConfig, currentPage };
    setPaginationConfig(newPag);
    savePaginationToStorage(newPag.pageSize, currentPage);
  };

  const handleTabChange = (key) => {
    setActiveTabKey(key);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, key);
    if (paginationConfig.currentPage !== 1) handlePageChange(1);
  };

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.category)    setFilterByProductCategory(initialFilters.category);
      if (initialFilters.subcategory) setFilterByProductSubcategory(initialFilters.subcategory);
      if (initialFilters.vendor)      setVendorFilter(initialFilters.vendor);
      if (initialFilters.type)        setFilterByType(initialFilters.type);
      if (initialFilters.visibility)  setVisibilityFilter(initialFilters.visibility);
      if (initialFilters.search)      setSearch(initialFilters.search);
      if (initialFilters.stockMin !== undefined) setStockMin(initialFilters.stockMin);
      if (initialFilters.stockMax !== undefined) setStockMax(initialFilters.stockMax);
      if (initialFilters.priceMin !== undefined) setPriceMin(initialFilters.priceMin);
      if (initialFilters.priceMax !== undefined) setPriceMax(initialFilters.priceMax);
    }
  }, []);

  useEffect(() => {
    saveFiltersToStorage({
      category: filterByProductCategory, subcategory: filterByProductSubcategory,
      vendor: vendorFilter, type: filterByType, visibility: visibilityFilter,
      search, stockMin, stockMax, priceMin, priceMax,
    });
  }, [filterByProductCategory, filterByProductSubcategory, vendorFilter, filterByType, visibilityFilter, search, stockMin, stockMax, priceMin, priceMax]);

  useEffect(() => { fetchCategories(); fetchMainCategories(); collectVendors(); }, []);

  useEffect(() => {
    fetchData();
    if (!formStatus) setId("");
  }, [search, formStatus, filterByProductCategory, filterByType, filterByProductSubcategory, vendorFilter, visibilityFilter]);

  const getVendorName = useCallback(async (vid) => {
    if (!vid || vendorNames[vid]) return vendorNames[vid];
    setVendorsLoading((prev) => ({ ...prev, [vid]: true }));
    try {
      const vendor = await getSingleVendor(vid);
      const name = _.get(vendor, "data.data.business_name", "Unknown Vendor");
      setVendorNames((prev) => ({ ...prev, [vid]: name }));
      return name;
    } catch {
      setVendorNames((prev) => ({ ...prev, [vid]: "Error" }));
      return "Error";
    } finally {
      setVendorsLoading((prev) => ({ ...prev, [vid]: false }));
    }
  }, [vendorNames]);

  useEffect(() => {
    if (vendorClose.length > 0) vendorClose.forEach((v) => { if (!vendorNames[v._id]) getVendorName(v._id); });
  }, [vendorClose, vendorNames, getVendorName]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await getProduct(
        "", search || "", true,
        filterByProductCategory || "", filterByType || "",
        filterByProductSubcategory || "", vendorFilter || "", visibilityFilter || ""
      );
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

  const fetchMainCategories = async () => {
    try {
      const result = await getAllCategoryProducts();
      setMainCategoryData(_.get(result, "data.data", []));
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

  // ─── Delete handler ───────────────────────────────────────────────────────
  const handleDeleteProduct = (record) => {
    confirm({
      title: "Delete Product",
      icon: <ExclamationCircleOutlined style={{ color: "#dc2626" }} />,
      content: (
        <div>
          <p className="text-gray-700 mb-1">
            Are you sure you want to delete <strong>{record.name}</strong>?
          </p>
          <p className="text-xs text-red-500">
            This action cannot be undone. All stock history will be permanently removed.
          </p>
        </div>
      ),
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "Cancel",
      okButtonProps: {
        style: { background: "#dc2626", borderColor: "#dc2626" },
      },
      onOk: async () => {
        try {
          setDeletingProductId(record._id);
          const result = await deleteProduct(
            JSON.stringify({ product_id: record._id, is_cloned: record.is_cloned || false })
          );
          SUCCESS_NOTIFICATION(result);
          await fetchData();
        } catch (err) {
          ERROR_NOTIFICATION(err);
        } finally {
          setDeletingProductId(null);
        }
      },
    });
  };

  const getVariantImages = (product) => {
    if (!product.variants || !Array.isArray(product.variants)) return [];
    const variantImages = [];
    product.variants.forEach((vg) => {
      if (vg.variant_type === "image_variant" && vg.options) {
        vg.options.forEach((opt) => {
          if (opt.image_names?.length > 0) {
            const imgs = opt.image_names
              .map((img) => typeof img === "object" ? _.get(img, "url", _.get(img, "path", "")) : img)
              .filter(Boolean);
            if (imgs.length > 0)
              variantImages.push({ variantName: vg.variant_name, optionValue: opt.value, images: imgs });
          }
        });
      }
    });
    return variantImages;
  };

  const getFirstVariantImage = (product) => {
    const vi = getVariantImages(product);
    for (const v of vi) { if (v.images?.length > 0) return v.images[0]; }
    return null;
  };

  const getProductImage = (product) => {
    if (product.images?.length > 0) {
      const fi = product.images[0];
      return typeof fi === "object" ? _.get(fi, "url", _.get(fi, "path", "")) : fi;
    }
    return getFirstVariantImage(product) || "";
  };

  const getProductPrice = (product, priceType = "customer") => {
    const map = { customer: "customer_product_price", dealer: "Deler_product_price", corporate: "corporate_product_price" };
    const field = map[priceType];
    if (product.type === "Stand Alone Product") return product[field] || product.MRP_price || "N/A";
    if (product.type === "Variant Product" || product.type === "Variable Product") {
      if (product.variants_price?.length > 0) {
        const prices = product.variants_price.map((v) => parseFloat(v[field] || v.price)).filter((p) => !isNaN(p));
        if (prices.length > 0) return Math.min(...prices);
      }
      return product[field] || product.MRP_price || "N/A";
    }
    return "N/A";
  };

  const getTotalStock = (product) => {
    if ((product.type === "Variant Product" || product.type === "Variable Product") && product.variants_price?.length) {
      return product.variants_price.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
    }
    return product.stock_count || 0;
  };

  const getMaterialStats  = (product) => _.get(product, "material_stats", null);
  const getMaterialIssues = (product) => _.get(product, "material_issues", []);
  const hasMaterialActivity = (product) => {
    const stats = getMaterialStats(product);
    return stats && (stats.issue_count > 0 || stats.total_issued_qty > 0);
  };

  const handleOnChangeLabel = async (data, product) => {
    if (!hasEditPermission) { ERROR_NOTIFICATION({ message: "No permission to modify products" }); return; }
    const pid = _.get(product, "_id", "");
    try {
      setUpdatingProductId(pid);
      setTableData((prev) => prev.map((item) => item._id === pid ? { ...item, ...data } : item));
      const result = await editProduct(data, pid);
      SUCCESS_NOTIFICATION(result);
      await fetchData();
    } catch (error) {
      setTableData((prev) => prev.map((item) => item._id === pid ? { ...item, is_visible: !data.is_visible } : item));
      ERROR_NOTIFICATION(error);
    } finally {
      setUpdatingProductId(null);
    }
  };

  const exportToCSV = () => {
    try {
      setExportLoading(true);
      let csv = "data:text/csv;charset=utf-8,";
      const cols = [
        "S.No", "Product Name", "Material Brand", "Size",
        "PRODUCT S.NO", "VENDOR CODE", "Product Code",
        "Category", "Sub Category", "MRP Price",
        "Primary Unit", "Stock Count", "Stock Unit",
        "Total Issued", "Issue Unit", "Total Returned", "Total Wastage", "Avg Wastage %", "Issue Count",
      ];
      csv += cols.join(",") + "\r\n";
      tableData.forEach((product, index) => {
        const stats       = getMaterialStats(product) || {};
        const primaryUnit = product.primary_unit || "pcs";
        const size        = product.size;
        const sizeStr     = size ? `${size.width ?? "—"} x ${size.height ?? "—"} ${size.unit}` : "—";
        const row = {
          "S.No":             index + 1,
          "Product Name":     product.name || "N/A",
          "Material Brand":   product.material_brand || "—",
          "Size":             sizeStr,
          "PRODUCT S.NO":     product.product_codeS_NO || "N/A",
          "VENDOR CODE":      product.Vendor_Code || "N/A",
          "Product Code":     product.product_code || "N/A",
          "Category":         _.get(product, "category_details.main_category_name", "N/A"),
          "Sub Category":     _.get(product, "sub_category_details.sub_category_name", "N/A"),
          "MRP Price":        product.MRP_price || "N/A",
          "Primary Unit":     unitLabel(primaryUnit),
          "Stock Count":      product.stock_count ?? 0,
          "Stock Unit":       unitLabel(primaryUnit),
          "Total Issued":     stats.total_issued_qty   ?? 0,
          "Issue Unit":       unitLabel(stats.stats_unit || primaryUnit),
          "Total Returned":   stats.total_returned_qty ?? 0,
          "Total Wastage":    stats.total_wastage_qty  ?? 0,
          "Avg Wastage %":    stats.avg_wastage_pct ? Number(stats.avg_wastage_pct).toFixed(1) : "0.0",
          "Issue Count":      stats.issue_count        ?? 0,
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
    setFilterByProductCategory(""); setFilterByProductSubcategory(""); setVendorFilter("");
    setFilterByType(""); setVisibilityFilter(""); setSubcategoryDataFilter([]); setSearch("");
    setStockMin(""); setStockMax("");
    setPriceMin(""); setPriceMax("");
    handlePageChange(1); localStorage.removeItem(STORAGE_KEYS.FILTERS);
  };

  const handleTableChange = (pagination) => {
    if (pagination.current !== paginationConfig.currentPage) handlePageChange(pagination.current);
    if (pagination.pageSize !== paginationConfig.pageSize) handlePageSizeChange(pagination.pageSize);
  };

  const getCurrentTabData = useMemo(
    () => activeTabKey === "1" ? tableData.filter((r) => !r.is_cloned) : tableData.filter((r) => r.is_cloned),
    [tableData, activeTabKey]
  );

  const stockFilteredData = useMemo(() => {
    if (stockMin === "" && stockMax === "") return getCurrentTabData;
    return getCurrentTabData.filter((item) => {
      const stock = getTotalStock(item);
      const aboveMin = stockMin === "" || stock >= Number(stockMin);
      const belowMax = stockMax === "" || stock <= Number(stockMax);
      return aboveMin && belowMax;
    });
  }, [getCurrentTabData, stockMin, stockMax]);

  const priceFilteredData = useMemo(() => {
    if (priceMin === "" && priceMax === "") return stockFilteredData;
    return stockFilteredData.filter((item) => {
      const rawPrice = getProductPrice(item, "customer");
      const price = rawPrice === "N/A" ? null : parseFloat(rawPrice);
      if (price === null) return false;
      const aboveMin = priceMin === "" || price >= Number(priceMin);
      const belowMax = priceMax === "" || price <= Number(priceMax);
      return aboveMin && belowMax;
    });
  }, [stockFilteredData, priceMin, priceMax]);

  const processedTableData = useMemo(
    () => priceFilteredData.map((item, index) => ({
      ...item,
      serialNumber: index + 1,
      totalStock:   getTotalStock(item),
      prices: {
        customerPrice:  getProductPrice(item, "customer"),
        dealerPrice:    getProductPrice(item, "dealer"),
        corporatePrice: getProductPrice(item, "corporate"),
      },
    })),
    [priceFilteredData]
  );

  const activeFilterCount = [
    filterByProductCategory, filterByProductSubcategory, vendorFilter,
    filterByType, visibilityFilter, search,
    stockMin !== "" ? "stockMin" : "",
    stockMax !== "" ? "stockMax" : "",
    priceMin !== "" ? "priceMin" : "",
    priceMax !== "" ? "priceMax" : "",
  ].filter(Boolean).length;

  const productType = [
    { value: "Stand Alone Product", label: "Stand Alone Product" },
    { value: "Variable Product",    label: "Variable Product" },
    { value: "Variant Product",     label: "Variant Product" },
  ];

  const visibilityOptions = [
    { value: "",      label: "All Products" },
    { value: "true",  label: "Visible Only" },
    { value: "false", label: "Hidden Only" },
  ];

  // ── Table columns ────────────────────────────────────────────────────────────

  const columns = [
    {
      title: "S.No", dataIndex: "serialNumber", key: "serialNumber",
      align: "center", width: 60, fixed: "left",
      render: (n) => <span className="text-gray-700 font-semibold">{n}</span>,
    },
    {
      title: "Image", dataIndex: "images", width: 100,
      render: (_, record) => {
        const img   = getProductImage(record);
        const isVar = record.type === "Variable Product" || record.type === "Variant Product";
        return (
          <div className="flex justify-center">
            {img ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-white shadow hover:shadow-lg transition-all">
                <Image src={img} alt="Product" width="100%" height="100%"
                  className="object-cover w-full h-full" preview />
                {isVar && (
                  <div className="absolute bottom-1 left-1 bg-purple-500 text-white text-xs rounded px-1">Var</div>
                )}
              </div>
            ) : (
              <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-300">
                <span className="text-xs text-gray-400">No Image</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Name", dataIndex: "name", width: 180,
      render: (data, record) => (
        <div className="flex flex-col space-y-1">
          <Tooltip title={data}>
            <span className="font-semibold text-gray-900 text-sm line-clamp-2">{data}</span>
          </Tooltip>
          <span className="text-xs text-gray-500">Code: {record.product_code || "N/A"}</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
              {UNIT_MAP[record.primary_unit || "pcs"]?.icon} {unitLabel(record.primary_unit || "pcs")}
            </span>
            {record.supported_units?.length > 1 && (
              <Tooltip title={`Also tracked in: ${record.supported_units.filter((u) => u !== record.primary_unit).map(unitLabel).join(", ")}`}>
                <span className="text-xs text-gray-400 cursor-help">+{record.supported_units.length - 1}</span>
              </Tooltip>
            )}
          </span>
          {record.variants?.length > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {record.variants.reduce((c, v) => c + (v.options?.length || 0), 0)} variant(s)
            </span>
          )}
        </div>
      ),
    },
    {
      title: "Material Brand",
      key: "material_brand",
      dataIndex: "material_brand",
      width: 140,
      render: (brand) =>
        brand ? (
          <div className="flex flex-col gap-1">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" }}
            >
              🏷️ {brand}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">—</span>
        ),
    },
    {
      title: "Size",
      key: "size",
      dataIndex: "size",
      width: 140,
      render: (size) =>
        size && (size.width != null || size.height != null) ? (
          <div className="flex flex-col gap-1">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "#fefce8", color: "#92400e", border: "1px solid #fde68a" }}
            >
              📐 {size.width ?? "—"} × {size.height ?? "—"}
            </span>
            <span className="text-xs text-gray-400 pl-1">{size.unit}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">—</span>
        ),
    },
    {
      title: "Stock", dataIndex: "totalStock", width: 150, align: "center",
      render: (stock, record) => {
        const primaryUnit = record.primary_unit || "pcs";
        const status      = record.stocks_status || "In Stock";
        return (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-gray-900 text-xl">{stock.toLocaleString()}</span>
              <span className="text-xs text-gray-500 font-medium">{unitLabel(primaryUnit)}</span>
            </div>
            <span className={`text-xs font-medium ${status === "Limited" ? "text-orange-600" : "text-green-600"}`}>
              {status}
            </span>
            <UnitStockSummaryCard product={record} />
          </div>
        );
      },
    },
    {
      title: "Actions", width: 260, align: "center", fixed: "right",
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {hasEditPermission && (
            <Tooltip title={`Stock IN — ${formatQty(record.stock_count || 0, record.primary_unit || "pcs")}`}>
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => setStockInProduct(record)}
                style={{ background: "#f0fdf4", borderColor: "#16a34a", color: "#16a34a", fontWeight: 600, fontSize: 11, borderRadius: 8 }}
              >
                IN
              </Button>
            </Tooltip>
          )}
          {hasEditPermission && (
            <Tooltip title={`Stock OUT — ${formatQty(record.stock_count || 0, record.primary_unit || "pcs")}`}>
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={() => setStockOutProduct(record)}
                style={{ background: "#fff1f2", borderColor: "#dc2626", color: "#dc2626", fontWeight: 600, fontSize: 11, borderRadius: 8 }}
              >
                OUT
              </Button>
            </Tooltip>
          )}
          <Tooltip title="View stock movement history">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setStockHistoryProduct(record)}
              style={{ background: "#eff6ff", borderColor: "#2563eb", color: "#2563eb", fontWeight: 600, fontSize: 11, borderRadius: 8 }}
            >
              History
            </Button>
          </Tooltip>
          {hasDeletePermission && (
            <Tooltip title="Delete product permanently">
              <Button
                size="small"
                icon={<DeleteFilled />}
                loading={deletingProductId === record._id}
                onClick={() => handleDeleteProduct(record)}
                style={{ background: "#fff1f2", borderColor: "#ef4444", color: "#ef4444", fontWeight: 600, fontSize: 11, borderRadius: 8 }}
                danger
              >
                Delete
              </Button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  const paginationProps = {
    current:       paginationConfig.currentPage,
    pageSize:      paginationConfig.pageSize,
    showSizeChanger: true, showQuickJumper: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
    pageSizeOptions: ["10", "20", "50", "100"],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 p-4 md:p-8 font-sans">

      {/* ── Page Header ── */}
      <div className="bg-white shadow-2xl rounded-3xl px-6 py-5 mb-6 border border-teal-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight m-0">
                📦 Stock Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 m-0">
                Manage inventory, stock movements &amp; products · Unit-aware tracking
              </p>
            </div>
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="h-9 rounded-xl border-gray-200 sm:w-64"
              prefix={<span className="text-gray-400 text-sm">🔍</span>}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              icon={<MdFileDownload />}
              onClick={exportToCSV}
              loading={exportLoading}
              className="rounded-xl h-9 px-4 font-semibold"
              style={{ background: "#f0fdf4", borderColor: "#16a34a", color: "#16a34a" }}
            >
              Export CSV
            </Button>
            {hasEditPermission && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setNewProductModal(true)}
                className="rounded-xl font-bold h-9 px-5 shadow-md flex items-center gap-1"
                style={{ background: "#0d9488", borderColor: "#0d9488", fontSize: 13 }}
              >
                New Product
              </Button>
            )}
          </div>
        </div>
      </div>

      {!hasEditPermission && !hasDeletePermission && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-medium flex items-center gap-2">
            <LockOutlined /> You have view-only access. Contact an administrator for edit permissions.
          </p>
        </div>
      )}

      {/* ── Filters ── */}
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
              <Select placeholder="Select Type" size="large" className="w-full" options={productType}
                allowClear onChange={(val) => setFilterByType(val)} value={filterByType} />
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Visibility</Text>
              <Select placeholder="Visibility" size="large" className="w-full" options={visibilityOptions}
                allowClear onChange={(val) => setVisibilityFilter(val)} value={visibilityFilter} />
            </div>
            <div>
              <Text className="text-sm font-semibold text-gray-700 mb-1 block">Primary Unit</Text>
              <Select placeholder="Filter by unit" size="large" className="w-full" allowClear
                options={UNITS.map((u) => ({ value: u.value, label: `${u.icon} ${u.label}` }))} />
            </div>
          </div>

          {/* Stock Range */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)", border: "1.5px solid #bbf7d0" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#16a34a" }}>
                <SwapOutlined style={{ color: "#fff", fontSize: 12 }} />
              </div>
              <Text className="text-sm font-bold text-gray-800">Stock Range Filter</Text>
              <Text className="text-xs text-gray-400 ml-1">— filter by current stock count</Text>
            </div>
            <StockRangeFilter
              stockMin={stockMin} stockMax={stockMax}
              onStockMinChange={(val) => { setStockMin(val); handlePageChange(1); }}
              onStockMaxChange={(val) => { setStockMax(val); handlePageChange(1); }}
              onClear={() => { setStockMin(""); setStockMax(""); handlePageChange(1); }}
            />
          </div>

          {/* Price Range */}
          <div className="rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)", border: "1.5px solid #ddd6fe" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#7c3aed" }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>₹</span>
              </div>
              <Text className="text-sm font-bold text-gray-800">Customer Price Range</Text>
            </div>
            <PriceRangeFilter
              priceMin={priceMin} priceMax={priceMax}
              onPriceMinChange={(val) => { setPriceMin(val); handlePageChange(1); }}
              onPriceMaxChange={(val) => { setPriceMax(val); handlePageChange(1); }}
              onClear={() => { setPriceMin(""); setPriceMax(""); handlePageChange(1); }}
            />
          </div>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="bg-white shadow-xl rounded-3xl border-none" bodyStyle={{ padding: 0 }}>
        <Tabs
          destroyInactiveTabPane type="card" size="large"
          className="px-4 md:px-8 pt-4" activeKey={activeTabKey} onChange={handleTabChange}
          items={[
            {
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
                <CustomTable loading={loading} dataSource={processedTableData} columns={columns}
                  className="rounded-b-3xl" onChange={handleTableChange} pagination={paginationProps} />
              ),
            },
          ]}
        />
      </Card>

      {/* ── Modals ── */}

      <NewProductStockModal
        open={newProductModal}
        onClose={() => setNewProductModal(false)}
        onSuccess={fetchData}
        categoryData={categoryData}
        subcategoryData={subcategoryData}
        allVendors={allVendors}
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
    </div>
  );
};

export default AddProduct;