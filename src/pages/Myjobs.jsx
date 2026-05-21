// Myjobs.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Integrated My Jobs portal with Customer Info Requests tab.
// Drop this inside your admin dashboard/layout.
// ─────────────────────────────────────────────────────────────────────────────

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
  Table,
  message,
  Tabs,
  Badge,
  Spin,
  Empty,
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
  HourglassOutlined,
  UnlockOutlined,
  LockOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { IMAGE_HELPER } from "../helper/imagehelper";

dayjs.extend(relativeTime);

const { Option } = Select;
const { TextArea } = Input;

// ─── API bases ────────────────────────────────────────────────────────────────
const API_BASE        = "https://api.dmedia.in/api";
const INFO_BASE       = "https://api.dmedia.in/api/info-requests";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getUserProfile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};
const getToken   = () => localStorage.getItem("authToken");
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });

// ─── Theme ────────────────────────────────────────────────────────────────────
const THEME = {
  primary:       "#1e6fdc",
  primaryLight:  "#dbeafe",
  primaryMid:    "#93c5fd",
  primaryDark:   "#1d4ed8",
  bgPage:        "#f0f6ff",
  bgCard:        "#ffffff",
  bgRow:         "#f8fbff",
  border:        "#bfdbfe",
  borderMid:     "#93c5fd",
  textPrimary:   "#0f172a",
  textSecondary: "#475569",
  textMuted:     "#94a3b8",
  danger:        "#dc2626",
  success:       "#059669",
  warning:       "#d97706",
  purple:        "#7c3aed",
  amber:         "#d97706",
};

// ─── Breakpoint hook ──────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => {
    const w = window.innerWidth;
    if (w < 480)  return "xs";
    if (w < 768)  return "sm";
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
    isMobile:  bp === "xs" || bp === "sm",
    isTablet:  bp === "md",
    isDesktop: bp === "lg",
  };
};

// ── Number to Words ───────────────────────────────────────────────────────────
const numberToWords = (num) => {
  const ones = [
    "","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen",
  ];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const toW  = (n) => {
    if (n === 0)       return "";
    if (n < 20)        return ones[n] + " ";
    if (n < 100)       return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000)      return ones[Math.floor(n / 100)] + " Hundred " + toW(n % 100);
    if (n < 100000)    return toW(Math.floor(n / 1000))    + "Thousand "  + toW(n % 1000);
    if (n < 10000000)  return toW(Math.floor(n / 100000))  + "Lakh "      + toW(n % 100000);
    return               toW(Math.floor(n / 10000000)) + "Crore " + toW(n % 10000000);
  };
  const n = Math.floor(num);
  return n === 0 ? "Zero Rupees Only" : "INR " + toW(n).trim() + " Rupees Only";
};

// ── Image to Base64 ───────────────────────────────────────────────────────────
const getImageDataUri = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context not available")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

// ── Generate Invoice PDF ──────────────────────────────────────────────────────
// Layout matches the quotation format:
//   • QUOTATION label + "ORIGINAL FOR RECIPIENT" banner
//   • Company block (left) + Logo (right)
//   • Quotation #, Date, Validity strip
//   • Customer Details + Place of Supply
//   • Items table: #, Item, Rate/Item, Qty, Amount
//   • Total row + Amount in words
//   • Bank Details + Authorised Signatory
//   • Terms & Conditions
//   • Footer: page info + Powered By D-Media
// ─────────────────────────────────────────────────────────────────────────────
const generateInvoicePDF = async (job) => {
  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW     = 210;
  const PH     = 297;
  const MARGIN = 14;
  const CW     = PW - MARGIN * 2;
  let   y      = 0;

  // ── Colour palette ──────────────────────────────────────────────────────────
  const BLACK   = [0,   0,   0  ];
  const WHITE   = [255, 255, 255];
  const DARK    = [20,  20,  20 ];
  const MID     = [100, 100, 100];
  const LGRAY   = [210, 210, 210];
  const BGLIGHT = [248, 248, 248];
  const BLUE    = [30,  80,  160];

  // ── Draw helpers ────────────────────────────────────────────────────────────
  const hr = (yy, color = LGRAY, w = 0.25) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(w);
    doc.line(MARGIN, yy, PW - MARGIN, yy);
  };
  const fillRect = (x, ry, w, h, fill, stroke) => {
    if (fill)   { doc.setFillColor(...fill);    doc.rect(x, ry, w, h, "F"); }
    if (stroke) { doc.setDrawColor(...stroke);  doc.setLineWidth(0.25); doc.rect(x, ry, w, h, "S"); }
  };

  // ── Item calculation helpers ────────────────────────────────────────────────
  const isSqFtItem = (it) =>
    it.quantity_type === "sq.ft" || (parseFloat(it.sq_ft) > 0);

  const itemBase = (it) => {
    const qty  = parseFloat(it.quantity || 1);
    const sqft = parseFloat(it.sq_ft    || 0);
    const pr   = parseFloat(it.price    || 0);
    return isSqFtItem(it) ? qty * sqft * pr : qty * pr;
  };

  const cartItems   = job.cart_items || [];
  const grandTotal  = parseFloat(job.total_amount       || 0);
  const deliveryChg = job.free_delivery ? 0 : parseFloat(job.delivery_charges || 0);
  const designChg   = parseFloat(job.design_charges     || 0);
  const discountAmt = parseFloat(job.discount_amount    || 0);
  const discountPct = parseFloat(job.discount_percentage || 0);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 1 — TOP BANNER
  // ──────────────────────────────────────────────────────────────────────────
  y = 8;

  // "QUOTATION" pill (top-left)
  doc.setFillColor(...WHITE);
  doc.roundedRect(MARGIN, y, 4, 6, 1, 1, "F");
  doc.setTextColor(...BLUE);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", MARGIN + 10, y + 4.2, { align: "center" });

  // "ORIGINAL FOR RECIPIENT" (top-right)
  doc.setTextColor(...MID);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("ORIGINAL FOR RECIPIENT", PW - MARGIN, y + 4.2, { align: "right" });

  y += 10;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2 — COMPANY BLOCK (left) + LOGO (right)
  // ──────────────────────────────────────────────────────────────────────────
  const logoUrl = IMAGE_HELPER?.Dlogo ||
    "https://www.dmedia.in/assets/images/edit_white_logo1.png";

  // Company name
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  // Wrap if too long
  const companyNameLines = doc.splitTextToSize(
    "PAZHANAM DESIGNS AND CONSTRUCTIONS PRIVATE LIMITED",
    CW - 36
  );
  doc.text(companyNameLines, MARGIN, y);

  const companyInfoLines = [
    `GSTIN ${job.gst_no || "33AANCP3376Q1ZN"}   PAN AANCP3376Q`,
    "NO.35, GROUND FLOOR, SUBHAM ILLAM",
    "KUMUTHAM SALAI, Tiruchirappalli",
    "TIRUCHIRAPPALLI, TAMIL NADU, 620018",
    "Mobile +91 7373610000, 9943026600   Email dmediaculbe@gmail.com",
    "Website www.dmedia.in",
  ];
  let cy = y + companyNameLines.length * 5 + 1;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID);
  companyInfoLines.forEach((ln) => {
    doc.text(ln, MARGIN, cy);
    cy += 4;
  });

  // Logo box (right)
  try {
    const logoB64 = await getImageDataUri(logoUrl);
    const logoX   = PW - MARGIN - 32;
    const logoY   = y - 2;
    fillRect(logoX, logoY, 40, 20, WHITE, WHITE);
    doc.addImage(logoB64, "PNG", logoX + 2, logoY + 2, 28, 22);
  } catch { /* skip on CORS / load error */ }

  y = cy + 4;
  hr(y, LGRAY, 0.4);
  y += 5;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3 — QUOTATION META STRIP
  // ──────────────────────────────────────────────────────────────────────────
  const invDate  = job.order_date
    ? dayjs(job.order_date).format("DD MMM YYYY")
    : dayjs().format("DD MMM YYYY");
  const validDate = job.valid_until
    ? dayjs(job.valid_until).format("DD MMM YYYY")
    : invDate;

  fillRect(MARGIN, y - 2, CW, 11, BGLIGHT, LGRAY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  doc.text(`Quotation #: ${job.job_no || "—"}`, MARGIN + 4, y + 5);
  doc.text(`Quotation Date: ${invDate}`, PW / 2, y + 5, { align: "center" });
  doc.text(`Validity: ${validDate}`, PW - MARGIN - 4, y + 5, { align: "right" });

  y += 14;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4 — CUSTOMER DETAILS (left) + PLACE OF SUPPLY (right)
  // ──────────────────────────────────────────────────────────────────────────
  const addr    = job.delivery_address || {};
  const colMid  = MARGIN + CW * 0.56;
  const leftMaxW = colMid - MARGIN - 4;

  const sectionY = y; // anchor for right column

  // Left — Customer Details label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text("Customer Details:", MARGIN, y);
  y += 5;

  // Customer name
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(job.customer_name || "—", leftMaxW);
  doc.text(nameLines, MARGIN, y);
  y += nameLines.length * 5;

  // Address lines
  const addrParts = [
    addr.street,
    [addr.city, addr.state].filter(Boolean).join(", "),
    addr.pincode ? `PIN: ${addr.pincode}` : "",
    addr.country || "",
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MID);
  addrParts.forEach((ln) => {
    const wrapped = doc.splitTextToSize(ln, leftMaxW);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4.5;
  });

  // Right column — Place of Supply
  let rcy = sectionY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text("Place of Supply:", colMid, rcy);
  rcy += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MID);
  doc.text(addr.state || "33-TAMIL NADU", colMid, rcy);
  rcy += 6;

  if (job.customer_phone) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Phone:", colMid, rcy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MID);
    doc.text(job.customer_phone, colMid + doc.getTextWidth("Phone:") + 2, rcy);
    rcy += 5;
  }
  if (job.gst_no) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("GSTIN:", colMid, rcy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MID);
    doc.text(job.gst_no, colMid + doc.getTextWidth("GSTIN:") + 2, rcy);
    rcy += 5;
  }

  // Advance y past whichever column is taller
  y = Math.max(y, rcy) + 5;
  hr(y, LGRAY, 0.3);
  y += 5;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5 — ITEMS TABLE
  // ──────────────────────────────────────────────────────────────────────────
  const tableRows = cartItems.map((it, i) => {
    const desc  = [it.product_name, it.variation, it.printing_type]
      .filter(Boolean).join(" | ");
    const qty   = isSqFtItem(it)
      ? `${it.quantity} × ${parseFloat(it.sq_ft || 0)} ft²`
      : String(it.quantity || 1);
    const rate  = `Rs. ${parseFloat(it.price || 0).toFixed(2)}`;
    const total = `Rs. ${itemBase(it).toFixed(2)}`;
    return [i + 1, desc || "—", rate, qty, total];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Rate / Item", "Qty", "Amount"]],
    body:  tableRows.length ? tableRows : [["", "No items", "", "", ""]],
    theme: "grid",
    headStyles: {
      fillColor:   [235, 235, 235],
      textColor:   DARK,
      fontSize:    8.5,
      fontStyle:   "bold",
      halign:      "center",
      valign:      "middle",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize:    8.5,
      textColor:   DARK,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      valign:      "middle",
    },
    alternateRowStyles: { fillColor: BGLIGHT },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 78, halign: "left"   },
      2: { cellWidth: 32, halign: "right"  },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 36, halign: "right", fontStyle: "bold" },
    },
    margin:         { left: MARGIN, right: MARGIN },
    tableLineColor: LGRAY,
    tableLineWidth: 0.25,
  });

  y = doc.lastAutoTable.finalY;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 6 — EXTRA CHARGES (discount / design / delivery)
  // ──────────────────────────────────────────────────────────────────────────
  const extraRows = [
    ...(discountAmt > 0
      ? [{ label: `Discount (${discountPct}%)`, value: `- Rs. ${discountAmt.toFixed(2)}`, green: true }]
      : []),
    ...(designChg > 0
      ? [{ label: "Design Charges", value: `Rs. ${designChg.toFixed(2)}` }]
      : []),
    ...(deliveryChg > 0
      ? [{ label: "Delivery Charges", value: `Rs. ${deliveryChg.toFixed(2)}` }]
      : []),
    ...(job.free_delivery
      ? [{ label: "Delivery Charges", value: "Free" }]
      : []),
  ];

  const totX  = PW - MARGIN - 90;
  const totRX = PW - MARGIN;
  let   ty    = y + 4;

  extraRows.forEach(({ label, value, green }) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...(green ? [0, 140, 60] : MID));
    doc.text(label, totX, ty);
    doc.setFont("helvetica", green ? "bold" : "normal");
    doc.setTextColor(...(green ? [0, 140, 60] : DARK));
    doc.text(value, totRX, ty, { align: "right" });
    ty += 5.5;
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.2);
    doc.line(totX, ty - 1, totRX, ty - 1);
  });

  // ── TOTAL ROW ───────────────────────────────────────────────────────────────
  fillRect(MARGIN, ty, CW, 10, [235, 235, 235], LGRAY);

  // Left: total items / qty
  const totalQty = cartItems.reduce((s, it) => s + parseFloat(it.quantity || 1), 0);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID);
  doc.text(
    `Total Items / Qty: ${cartItems.length} / ${totalQty}`,
    MARGIN + 3,
    ty + 6.5
  );

  // Centre: "Total" label
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Total", PW / 2, ty + 6.5, { align: "center" });

  // Right: grand total amount
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(
    `Rs. ${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    PW - MARGIN - 4,
    ty + 6.5,
    { align: "right" }
  );

  ty += 13;

  // ── Amount in words ──────────────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...MID);
  const wordStr   = `Total amount (in words): ${numberToWords(grandTotal)}`;
  const wordLines = doc.splitTextToSize(wordStr, CW);
  doc.text(wordLines, MARGIN, ty);
  ty += wordLines.length * 5 + 6;

  hr(ty, LGRAY, 0.3);
  ty += 6;

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 11 — FOOTER
  // ──────────────────────────────────────────────────────────────────────────
  const footerY = PH - 14;

  hr(footerY - 4, LGRAY, 0.25);

  // Left: page info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MID);
  doc.text(
    "Page 1 / 1   •   This is a computer generated document and requires no signature.",
    MARGIN,
    footerY + 1
  );
  doc.setFontSize(6.5);
  doc.text(
    "Swipe | Simple Invoicing, Billing and Payments | Visit getswipe.in",
    MARGIN,
    footerY + 5.5
  );

  
  // Right: "Powered By D-Media" box
  const pbX = PW - MARGIN - 32;
  // Reduced height from 15 to 10 and width from 32 to 28
  fillRect(pbX, footerY - 6, 28, 10, null);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6); // Reduced from 6 to 5
  doc.setTextColor(0, 0, 0);
  doc.text("Powered By", pbX + 14, footerY - 0, { align: "center" }); // Even more top padding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8); // Reduced from 9 to 8
  doc.setTextColor(0, 0, 0); // White text on black background
  doc.text("D-Media", pbX + 14, footerY + 5, { align: "center" }); // Adjusted position

  // ── Save ─────────────────────────────────────────────────────────────────────
  doc.save(`Quotation_${job.job_no || "job"}.pdf`);
};

// ─── Job status config ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:         { label: "Draft",         color: "default",  icon: <FileTextOutlined /> },
  sent:          { label: "Sent",          color: "blue",     icon: <SendOutlined /> },
  viewed:        { label: "Viewed",        color: "cyan",     icon: <EyeOutlined /> },
  accepted:      { label: "Accepted",      color: "green",    icon: <CheckCircleOutlined /> },
  design:        { label: "Design",        color: "blue",     icon: <FileTextOutlined /> },
  in_progress:   { label: "In Progress",   color: "gold",     icon: <PlayCircleOutlined /> },
  on_hold:       { label: "On Hold",       color: "orange",   icon: <PauseCircleOutlined /> },
  rejected:      { label: "Rejected",      color: "red",      icon: <CloseCircleOutlined /> },
  expired:       { label: "Expired",       color: "volcano",  icon: <ClockCircleOutlined /> },
  completed:     { label: "Completed",     color: "purple",   icon: <CheckCircleOutlined /> },
  converted:     { label: "Converted",     color: "geekblue", icon: <SwapOutlined /> },
  quality_check: { label: "Quality Check", color: "magenta",  icon: <SafetyCertificateOutlined /> },
  production:    { label: "Production",    color: "lime",     icon: <PlayCircleOutlined /> },
};

const WORKFLOW_STAGES = [
  { value: "design",        label: "Design"        },
  { value: "prepress",      label: "Prepress"      },
  { value: "printing",      label: "Printing"      },
  { value: "finishing",     label: "Finishing"     },
  { value: "quality_check", label: "Quality Check" },
  { value: "dispatch",      label: "Dispatch"      },
  { value: "delivered",     label: "Delivered"     },
  { value: "delivery",      label: "Delivery"      },
  { value: "custom",        label: "Custom"        },
];

// ─── Info-request status config ────────────────────────────────────────────────
const INFO_STATUS_CFG = {
  pending:  { color: "#d97706", bg: "#fffbeb", border: "#fcd34d", label: "Pending",  icon: <HourglassOutlined /> },
  approved: { color: "#16a34a", bg: "#f0fdf4", border: "#86efac", label: "Approved", icon: <UnlockOutlined /> },
  rejected: { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", label: "Rejected", icon: <CloseCircleOutlined /> },
};

// ─── Shared sub-components ────────────────────────────────────────────────────
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
    return <span style={{ color: THEME.textMuted, fontSize: 12 }}>—</span>;
  return (
    <Tag color="geekblue" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>
      {label}
    </Tag>
  );
};

const SectionDivider = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 10px" }}>
    <span style={{ color: THEME.primary, fontSize: 13 }}>{icon}</span>
    <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textPrimary, textTransform: "uppercase", letterSpacing: "0.07em" }}>
      {title}
    </span>
    <div style={{ flex: 1, height: 1, background: THEME.border, marginLeft: 4 }} />
  </div>
);

const InfoStatusBadge = ({ status }) => {
  const cfg = INFO_STATUS_CFG[status] || INFO_STATUS_CFG.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── Job Detail View ──────────────────────────────────────────────────────────
const JobDetailView = ({ job, isMobile }) => {
  if (!job) return null;
  const addr        = job.delivery_address || {};
  const fullAddress = [addr.street, addr.city, addr.state, addr.pincode, addr.country]
    .filter(Boolean).join(", ");

  const LV = ({ label, value, mono }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: THEME.textPrimary, fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 600 : 400 }}>
        {value ?? "—"}
      </div>
    </div>
  );

  const grid2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: "4px 16px", marginBottom: 12 };
  const grid4 = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "4px 16px", marginBottom: 12 };

  return (
    <div>
      <SectionDivider icon={<UserOutlined />} title="Customer Info" />
      <div style={grid2}>
        <LV label="Name"  value={job.customer_name} />
        <LV label="Phone" value={job.customer_phone} />
        <LV label="Est. Delivery" value={job.estimated_delivery_date ? dayjs(job.estimated_delivery_date).format("DD MMM YYYY, hh:mm A") : null} />
      </div>

      {fullAddress && (
        <>
          <SectionDivider icon={<EyeOutlined />} title="Delivery Address" />
          <p style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 12, wordBreak: "break-word" }}>
            {fullAddress}
          </p>
        </>
      )}

      <SectionDivider icon={<FileTextOutlined />} title="Items" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {(job.cart_items || []).map((it, i) => {
          const isSqFt    = it.quantity_type === "sq.ft" || (it.sq_ft && it.sq_ft > 0);
          const lineTotal = isSqFt
            ? (it.quantity || 0) * (it.sq_ft || 0) * (it.price || 0)
            : (it.quantity || 0) * (it.price || 0);
          return (
            <div key={i} style={{ background: THEME.primaryLight, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${THEME.primary}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: THEME.textPrimary, marginRight: 8 }}>{it.product_name || "—"}</span>
                  {it.variation    && <Tag style={{ fontSize: 10 }}>{it.variation}</Tag>}
                  {it.printing_type && <Tag color="blue" style={{ fontSize: 10 }}>{it.printing_type}</Tag>}
                </div>
                <span style={{ fontWeight: 700, color: THEME.success, fontSize: 13 }}>₹{lineTotal.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {isSqFt && it.width && <span>Size: {it.width} × {it.height} {it.size_unit} ({it.sq_ft} ft²)</span>}
                <span>Qty: {it.quantity}</span>
                <span>Price: ₹{it.price}/{isSqFt ? "sq.ft" : "unit"}</span>
                {it.notes && <span>Note: {it.notes}</span>}
              </div>
              {it.design_file && (
                <a href={it.design_file} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: THEME.primary, marginTop: 4, display: "inline-block" }}>
                  View Design File ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      <SectionDivider icon={<FileTextOutlined />} title="Pricing" />
      <div style={{ background: `linear-gradient(135deg,${THEME.primaryLight},#f0f9ff)`, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: isMobile ? "10px" : "14px 16px", marginBottom: 12 }}>
        {[
          { label: "Subtotal",  value: `₹${parseFloat(job.subtotal || 0).toFixed(2)}` },
          ...(job.discount_amount > 0 ? [{ label: `Discount (${job.discount_percentage}%)`, value: `- ₹${parseFloat(job.discount_amount).toFixed(2)}`, green: true }] : []),
          { label: "GST",      value: `₹${parseFloat(job.tax_amount || 0).toFixed(2)}` },
          { label: "Delivery", value: job.free_delivery ? "Free 🎉" : `₹${parseFloat(job.delivery_charges || 0).toFixed(2)}` },
        ].map(({ label, value, green }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: green ? THEME.success : THEME.textSecondary, marginBottom: 4 }}>
            <span>{label}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        <Divider style={{ margin: "8px 0", borderColor: THEME.border }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15 }}>
          <span style={{ color: THEME.textPrimary }}>Grand Total</span>
          <span style={{ color: THEME.primary }}>₹{parseFloat(job.total_amount || 0).toFixed(2)}</span>
        </div>
      </div>

      {job.design_file && (
        <>
          <SectionDivider icon={<FileTextOutlined />} title="Design File" />
          <div style={{ marginBottom: 12 }}>
            <a href={job.design_file} target="_blank" rel="noreferrer">
              <img src={job.design_file} alt="Design" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: `1px solid ${THEME.border}`, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
            </a>
          </div>
        </>
      )}

      {job.productionimg && (
        <>
          <SectionDivider icon={<PlayCircleOutlined />} title="Production Image" />
          <div style={{ marginBottom: 12 }}>
            <a href={job.productionimg} target="_blank" rel="noreferrer">
              <img src={job.productionimg} alt="Production" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: `1px solid ${THEME.border}`, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
            </a>
          </div>
        </>
      )}

      <SectionDivider icon={<FileTextOutlined />} title="Job Info" />
      <div style={grid4}>
        {[
          { label: "Job No",            value: job.job_no,        mono: true },
          { label: "Status",            value: <StatusTag status={job.job_status} /> },
          { label: "Created By",        value: job.created_by },
          { label: "Approved By",       value: job.approved_by },
          { label: "GST No",            value: job.gst_no },
          { label: "Payment Mode",      value: job.payment_mode },
          { label: "Payment Amount",    value: job.payment_amount ? `₹${job.payment_amount}` : null },
          { label: "Order Date",        value: job.order_date ? dayjs(job.order_date).format("DD MMM YYYY") : null },
          ...(job.current_stage?.stage ? [{ label: "Stage",       value: <StageTag stage={job.current_stage.stage} /> }] : []),
          ...(job.current_stage?.assigned_to?.name ? [{ label: "Assigned To", value: job.current_stage.assigned_to.name }] : []),
          { label: "Design Status",       value: job.design_status },
          { label: "Design Uploaded By",  value: job.design_uploaded_by },
          { label: "Production Status",   value: job.production_status },
          { label: "QC Status",           value: job.qc_status },
        ].map(({ label, value, mono }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: THEME.textPrimary, fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 600 : 400 }}>{value ?? "—"}</div>
          </div>
        ))}
      </div>

      {job.notes && (
        <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#713f12" }}>
          <strong>Notes:</strong> {job.notes}
        </div>
      )}
    </div>
  );
};

// ─── Assign Modal Body ────────────────────────────────────────────────────────
const AssignModalBody = ({ job, members, membersLoading, selected, onSelect, infoText }) => {
  if (!job) return null;
  return (
    <div>
      <div style={{ background: THEME.primaryLight, borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: `1px solid ${THEME.border}`, borderLeft: `4px solid ${THEME.primary}` }}>
        <div style={{ fontFamily: "monospace", fontWeight: 700, color: THEME.primary, fontSize: 14 }}>{job.job_no}</div>
        <div style={{ fontSize: 13, color: THEME.textPrimary, marginTop: 2 }}>{job.customer_name || "—"}</div>
        <div style={{ fontSize: 11, color: THEME.textSecondary }}>{job.customer_phone || ""}</div>
        <div style={{ marginTop: 6, fontSize: 11 }}>Status: <StatusTag status={job.job_status} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13, color: THEME.textPrimary }}>
          Assign To <span style={{ color: THEME.danger }}>*</span>
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
                <UserOutlined style={{ color: THEME.textMuted, fontSize: 12 }} />
                <span>{d.name || d.fullName || d.username || d._id}</span>
                {d.role && <span style={{ fontSize: 10, color: THEME.textMuted }}>({d.role})</span>}
              </div>
            </Option>
          ))}
        </Select>
        {!membersLoading && members.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: THEME.warning, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
            ⚠️ No members found. Please add the required team members first.
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: THEME.textSecondary, background: THEME.primaryLight, padding: "8px 12px", borderRadius: 6, border: `1px solid ${THEME.border}` }}>
        ℹ️ {infoText}
      </div>
    </div>
  );
};

// ─── Info Request Card ────────────────────────────────────────────────────────
const InfoRequestCard = ({ req, onApprove, onReject, acting }) => {
  const isPending = req.status === "pending";
  const isExpired = req.expires_at && new Date(req.expires_at) < new Date();
  const expiresIn = req.expires_at ? dayjs(req.expires_at).fromNow() : null;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${isPending ? "#fcd34d" : "#e5e7eb"}`, boxShadow: isPending ? "0 0 0 2px #fef3c7, 0 3px 10px rgba(0,0,0,0.06)" : "0 2px 6px rgba(0,0,0,0.05)", overflow: "hidden", transition: "all 0.2s" }}>
      <div style={{ padding: "8px 14px", background: isPending ? "linear-gradient(135deg,#78350f,#d97706)" : req.status === "approved" ? "linear-gradient(135deg,#14532d,#16a34a)" : "linear-gradient(135deg,#7f1d1d,#ef4444)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 12, color: "#fff" }}>
          {req.job_no || req.job_id}
        </span>
        <InfoStatusBadge status={req.status} />
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#eff6ff", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserOutlined style={{ color: "#3b82f6", fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{req.requested_by?.name || "Unknown"}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{req.requested_by?.role || "Designer"}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />{dayjs(req.createdAt).fromNow()}
          </div>
        </div>

        {req.request_reason && (
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12, color: "#374151" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 3, textTransform: "uppercase" }}>
              <InfoCircleOutlined style={{ marginRight: 4 }} />Reason
            </div>
            {req.request_reason}
          </div>
        )}

        {req.status === "approved" && req.expires_at && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: isExpired ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isExpired ? "#fca5a5" : "#86efac"}`, borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 11, color: isExpired ? "#ef4444" : "#16a34a", fontWeight: 600 }}>
            {isExpired ? <LockOutlined /> : <UnlockOutlined />}
            {isExpired ? "Access expired" : `Access expires ${expiresIn}`}
          </div>
        )}

        {req.review_notes && (
          <div style={{ background: req.status === "rejected" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${req.status === "rejected" ? "#fca5a5" : "#86efac"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: req.status === "rejected" ? "#7f1d1d" : "#14532d" }}>
            <strong>Admin note:</strong> {req.review_notes}
          </div>
        )}

        {isPending && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="primary" icon={<CheckCircleOutlined />} size="small" loading={acting === `approve-${req._id}`} onClick={() => onApprove(req)}
              style={{ flex: 1, height: 30, fontWeight: 700, fontSize: 12, background: "#16a34a", border: "none", borderRadius: 8 }}>
              Approve
            </Button>
            <Button icon={<CloseCircleOutlined />} size="small" danger loading={acting === `reject-${req._id}`} onClick={() => onReject(req)}
              style={{ flex: 1, height: 30, fontWeight: 700, fontSize: 12, borderRadius: 8 }}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Info Requests Panel ──────────────────────────────────────────────────────
const InfoRequestsPanel = ({ userProfile }) => {
  const userId   = userProfile._id;
  const userName = userProfile.name || userProfile.fullName || "Admin";

  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [infoTab,      setInfoTab]      = useState("pending");
  const [actionModal,  setActionModal]  = useState(false);
  const [actionTarget, setActionTarget] = useState(null);
  const [reviewNotes,  setReviewNotes]  = useState("");
  const [ttlHours,     setTtlHours]     = useState(24);
  const [submitting,   setSubmitting]   = useState(false);
  const [acting,       setActing]       = useState(null);

  const loadInfoRequests = useCallback(async (status) => {
    setLoading(true);
    try {
      const qs  = status && status !== "all" ? `?status=${status}&limit=100` : "?limit=100";
      const res = await fetch(`${INFO_BASE}${qs}`, { headers: authHeader() });
      const d   = await res.json();
      if (d.success) setRequests(d.data?.requests || []);
    } catch (err) {
      message.error("Failed to load info requests: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInfoRequests(infoTab); }, [infoTab, loadInfoRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const openApprove = (req) => { setActionTarget({ req, type: "approve" }); setReviewNotes(""); setTtlHours(24); setActionModal(true); };
  const openReject  = (req) => { setActionTarget({ req, type: "reject"  }); setReviewNotes(""); setActionModal(true); };

  const submitAction = async () => {
    const { req, type } = actionTarget;
    setSubmitting(true);
    setActing(`${type}-${req._id}`);
    try {
      const body = {
        reviewed_by:  { user_id: userId, name: userName },
        review_notes: reviewNotes,
        ...(type === "approve" ? { ttl_hours: ttlHours } : {}),
      };
      const res = await fetch(`${INFO_BASE}/${req._id}/${type}`, {
        method: "PATCH", headers: jsonHeader(), body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.message || "Action failed");
      message.success(
        type === "approve"
          ? `Access granted to ${req.requested_by?.name} for ${req.job_no || "job"}.`
          : `Request from ${req.requested_by?.name} rejected.`
      );
      setActionModal(false);
      loadInfoRequests(infoTab);
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
      setActing(null);
    }
  };

  const shown = infoTab === "all" ? requests : requests.filter((r) => r.status === infoTab);

  const infoTabItems = [
    {
      key: "pending",
      label: (
        <span>
          <HourglassOutlined style={{ marginRight: 4 }} />Pending
          {pendingCount > 0 && infoTab !== "pending" && (
            <Badge count={pendingCount} style={{ marginLeft: 6, backgroundColor: "#f59e0b" }} />
          )}
        </span>
      ),
    },
    { key: "approved", label: <span><UnlockOutlined style={{ marginRight: 4 }} />Approved</span> },
    { key: "rejected", label: <span><CloseCircleOutlined style={{ marginRight: 4 }} />Rejected</span> },
    { key: "all",      label: <span>All</span> },
  ];

  return (
    <div>
      {/* Sub-header */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#d97706,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyOutlined style={{ color: "#fff", fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>Customer Info Access Requests</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Review designer requests to view customer contact details
              {pendingCount > 0 && <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 700 }}>· {pendingCount} pending</span>}
            </div>
          </div>
        </div>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={() => loadInfoRequests(infoTab)} style={{ borderRadius: 8 }} />
        </Tooltip>
      </div>

      {/* Tabs + cards */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <Tabs activeKey={infoTab} onChange={setInfoTab} items={infoTabItems} style={{ marginBottom: 14 }} />
        <Spin spinning={loading}>
          {shown.length === 0 && !loading ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: "#9ca3af", fontSize: 13 }}>No {infoTab === "all" ? "" : infoTab} requests</span>} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
              {shown.map((req) => (
                <InfoRequestCard key={req._id} req={req} onApprove={openApprove} onReject={openReject} acting={acting} />
              ))}
            </div>
          )}
        </Spin>
      </div>

      {/* Action Modal */}
      <Modal
        open={actionModal}
        onCancel={() => !submitting && setActionModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {actionTarget?.type === "approve"
              ? <UnlockOutlined style={{ color: "#16a34a" }} />
              : <LockOutlined   style={{ color: "#ef4444" }} />}
            <span style={{ fontWeight: 700 }}>
              {actionTarget?.type === "approve" ? "Grant Access" : "Reject Request"}
            </span>
            {actionTarget?.req && (
              <Tag color={actionTarget.type === "approve" ? "green" : "red"} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>
                {actionTarget.req.job_no}
              </Tag>
            )}
          </div>
        }
        footer={[
          <Button key="c" onClick={() => setActionModal(false)} disabled={submitting}>Cancel</Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={submitAction}
            style={{ background: actionTarget?.type === "approve" ? "#16a34a" : "#ef4444", border: "none" }}>
            {actionTarget?.type === "approve" ? "Grant Access" : "Reject"}
          </Button>,
        ]}
        width={440}
        destroyOnClose
      >
        {actionTarget && (
          <div>
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Designer</div>
              <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{actionTarget.req.requested_by?.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Job: <strong>{actionTarget.req.job_no}</strong></div>
              {actionTarget.req.request_reason && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#374151", fontStyle: "italic" }}>"{actionTarget.req.request_reason}"</div>
              )}
            </div>
            {actionTarget.type === "approve" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Access Duration (hours)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[4, 8, 24, 48].map((h) => (
                    <Button key={h} size="small" type={ttlHours === h ? "primary" : "default"} onClick={() => setTtlHours(h)}
                      style={{ borderRadius: 8, fontWeight: 600, ...(ttlHours === h ? { background: "#16a34a", border: "none", color: "#fff" } : {}) }}>
                      {h}h
                    </Button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                  Designer will have access for {ttlHours} hour{ttlHours !== 1 ? "s" : ""} after approval.
                </div>
              </div>
            )}
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {actionTarget.type === "approve" ? "Note to Designer (optional)" : "Rejection Reason"}
            </label>
            <TextArea rows={3}
              placeholder={actionTarget.type === "approve"
                ? "e.g. Access granted for delivery coordination…"
                : "e.g. Not required for design work — contact manager…"}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Myjobs = () => {
  const { isMobile, isDesktop } = useBreakpoint();

  const [loading,        setLoading]        = useState(false);
  const [jobs,           setJobs]           = useState([]);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState(null);
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(10);
  const [lastRefreshed,  setLastRefreshed]  = useState(dayjs());
  const [countdown,      setCountdown]      = useState(AUTO_REFRESH_MS / 1000);
  const [mainTab,        setMainTab]        = useState("jobs");

  const [viewJob,        setViewJob]        = useState(null);
  const [deletingJob,    setDeletingJob]    = useState(null);
  const [deleteNotes,    setDeleteNotes]    = useState("");
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteError,    setDeleteError]    = useState("");

  const [approvingJob,      setApprovingJob]      = useState(null);
  const [designers,         setDesigners]         = useState([]);
  const [selectedDesigner,  setSelectedDesigner]  = useState(null);
  const [approving,         setApproving]         = useState(false);
  const [designersLoading,  setDesignersLoading]  = useState(false);

  const [qcJob,            setQcJob]            = useState(null);
  const [qcMembers,        setQcMembers]        = useState([]);
  const [selectedQcMember, setSelectedQcMember] = useState(null);
  const [qcAssigning,      setQcAssigning]      = useState(false);
  const [qcMembersLoading, setQcMembersLoading] = useState(false);

  const [pendingInfoCount, setPendingInfoCount] = useState(0);

  const autoRefreshRef = useRef(null);
  const countdownRef   = useRef(null);
  const userProfile    = useMemo(() => getUserProfile(), []);
  const isSuperAdmin   = userProfile?.role === "super admin";
  
  // Check if user is authorized for quotation button (admin@dmedia.in or admin@printe.in)
  const isQuotationAuthorized = useMemo(() => {
    const userEmail = userProfile?.email || userProfile?.username || "";
    const authorizedEmails = ["admin@dmedia.in", "admin@printe.in"];
    return authorizedEmails.includes(userEmail.toLowerCase());
  }, [userProfile]);

  const fetchAllAdmins = async () => {
    const res  = await fetch(`${API_BASE}/admin/get_admin`, { headers: authHeader() });
    const data = await res.json();
    return data.data || [];
  };

  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch(`${API_BASE}/jobs`, { headers: authHeader() });
      const data = await res.json();
      let rows = [];
      if      (Array.isArray(data?.data?.jobs)) rows = data.data.jobs;
      else if (Array.isArray(data?.data))       rows = data.data;
      else if (Array.isArray(data?.jobs))       rows = data.jobs;
      else if (Array.isArray(data))             rows = data;
      if (!isSuperAdmin) rows = rows.filter((j) => j.created_by_admin_id === userProfile?._id);
      setJobs(rows);
      setLastRefreshed(dayjs());
      setCountdown(AUTO_REFRESH_MS / 1000);
    } catch (err) {
      message.error(err.message || "Failed to load jobs");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isSuperAdmin, userProfile?._id]);

  const pollPendingInfo = useCallback(async () => {
    try {
      const res = await fetch(`${INFO_BASE}?status=pending&limit=1`, { headers: authHeader() });
      const d   = await res.json();
      if (d.success) {
        const cnt = d.data?.total ?? (d.data?.requests?.length ?? 0);
        setPendingInfoCount(cnt);
      }
    } catch { /* silent */ }
  }, []);

  const startAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (countdownRef.current)   clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_MS / 1000);
    countdownRef.current   = setInterval(() => setCountdown((p) => (p <= 1 ? AUTO_REFRESH_MS / 1000 : p - 1)), 1000);
    autoRefreshRef.current = setInterval(() => { loadJobs(true); pollPendingInfo(); }, AUTO_REFRESH_MS);
  }, [loadJobs, pollPendingInfo]);

  useEffect(() => {
    loadJobs();
    pollPendingInfo();
    startAutoRefresh();
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (countdownRef.current)   clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const filteredJobs = useMemo(() => {
    let rows = jobs;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((j) =>
        (j.customer_name  || "").toLowerCase().includes(q) ||
        (j.customer_phone || "").includes(q) ||
        (j.job_no         || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) rows = rows.filter((j) => j.job_status === statusFilter);
    return rows;
  }, [jobs, search, statusFilter]);

  const pagedJobs = useMemo(() => {
    const s = (page - 1) * pageSize;
    return filteredJobs.slice(s, s + pageSize);
  }, [filteredJobs, page, pageSize]);

  // ── Approve ─────────────────────────────────────────────────────────────────
  const openApproveModal = async (job) => {
    setApprovingJob(job); setSelectedDesigner(null); setDesignersLoading(true);
    try {
      const all = await fetchAllAdmins();
      setDesigners(all.filter((u) => u.role === "designing team"));
    } catch { message.error("Could not load designers list"); setDesigners([]); }
    finally { setDesignersLoading(false); }
  };

  const handleApprove = async () => {
    if (!selectedDesigner) { message.error("Please select a designer."); return; }
    setApproving(true);
    try {
      const name = selectedDesigner.name || selectedDesigner.fullName || selectedDesigner.username || "Unknown";
      const res  = await fetch(`${API_BASE}/jobs/${approvingJob._id}/approve`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ job_status: "design", approved_by: userProfile?.name || null, approved_by_admin_id: userProfile?._id || null, assign_to: { user_id: selectedDesigner._id, name } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Approval failed");
      message.success(`Job ${approvingJob.job_no} approved & assigned to ${name}`);
      setApprovingJob(null); setSelectedDesigner(null); loadJobs(true);
    } catch (err) { message.error(err.message || "Failed to approve job"); }
    finally { setApproving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeletingJob(null); setDeleteNotes(""); setDeleteError("");
  };

  const handleDelete = async () => {
    if (deleteNotes.trim().length < 50) { setDeleteError("Please provide at least 50 characters explaining the reason."); return; }
    setDeleteLoading(true); setDeleteError("");
    try {
      const res  = await fetch(`${API_BASE}/jobs/${deletingJob._id}`, {
        method: "DELETE", headers: jsonHeader(),
        body: JSON.stringify({ delete_notes: deleteNotes.trim(), adminId: userProfile?._id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete job");
      message.success(`Job ${deletingJob.job_no} deleted successfully.`);
      closeDeleteModal(); loadJobs(true);
    } catch (err) { setDeleteError(err.message || "Failed to delete job"); }
    finally { setDeleteLoading(false); }
  };

  // ── Quality Check ────────────────────────────────────────────────────────────
  const openQcModal = async (job) => {
    setQcJob(job); setSelectedQcMember(null); setQcMembersLoading(true);
    try {
      const all    = await fetchAllAdmins();
      const qcList = all.filter((u) => u.role === "quality check");
      setQcMembers(qcList.length > 0 ? qcList : all);
    } catch { message.error("Could not load QC members"); setQcMembers([]); }
    finally { setQcMembersLoading(false); }
  };

  const handleAssignQc = async () => {
    if (!selectedQcMember) { message.error("Please select a QC assignee."); return; }
    setQcAssigning(true);
    try {
      const assigneeName = selectedQcMember.name || selectedQcMember.fullName || selectedQcMember.username || "Unknown";
      const payload = {
        stage: "quality_check", stage_label: "quality_check",
        assigned_to: { user_id: selectedQcMember._id, name: assigneeName, role: selectedQcMember.role || "" },
        assigned_by: { user_id: userProfile?._id || null, name: userProfile?.name || "Unknown", role: userProfile?.role || "" },
        notes: "QC assigned via My Jobs page",
      };
      const res  = await fetch(`${API_BASE}/jobs/${qcJob._id}/assign`, { method: "POST", headers: jsonHeader(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "QC assignment failed");
      message.success(`Quality check assigned to ${assigneeName}`);
      setQcJob(null); setSelectedQcMember(null); loadJobs(true);
    } catch (err) { message.error(err.message || "Failed to assign QC"); }
    finally { setQcAssigning(false); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fmtCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const p         = isMobile ? 8  : 16;
  const g         = isMobile ? 8  : 12;
  const slideUp   = isMobile ? { top: "auto", bottom: 0, margin: 0, maxWidth: "100vw", padding: 0, paddingBottom: "env(safe-area-inset-bottom)" } : {};
  const modalBody = { maxHeight: isMobile ? "72dvh" : "80vh", overflowY: "auto", padding: isMobile ? 12 : 16 };

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "#", width: 36,
      render: (_, __, i) => <span style={{ color: THEME.textMuted, fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</span>,
    },
    {
      title: "Job No", dataIndex: "job_no",
      render: (n) => <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>{n || "—"}</Tag>,
    },
    {
      title: "Customer", key: "customer",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textPrimary }}>{r.customer_name || "—"}</div>
          <div style={{ fontSize: 11, color: THEME.textSecondary }}>{r.customer_phone || ""}</div>
          {isMobile && <StatusTag status={r.job_status} style={{ marginTop: 4, fontSize: 10 }} />}
        </div>
      ),
    },
    ...(!isMobile ? [{
      title: "Date", dataIndex: "order_date",
      render: (d) => <span style={{ fontSize: 12, color: THEME.textSecondary, whiteSpace: "nowrap" }}>{d ? dayjs(d).format("DD MMM YY") : "—"}</span>,
    }] : []),
    {
      title: "Total", dataIndex: "total_amount",
      render: (a) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: THEME.primary, whiteSpace: "nowrap" }}>
          ₹{parseFloat(a || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    ...(!isMobile ? [{ title: "Status", dataIndex: "job_status", render: (s) => <StatusTag status={s} /> }] : []),
    ...(isDesktop  ? [{ title: "Stage",  key: "stage",            render: (_, r) => <StageTag stage={r.current_stage?.stage} /> }] : []),
    {
      title: "", width: isMobile ? 110 : 230,
      render: (_, record) => {
        const isQC = record.job_status === "quality_check";
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end", flexDirection: isMobile ? "column" : "row" }}>
            <Tooltip title="View Job Details">
              <Button icon={<EyeOutlined />} size="small"
                style={{ width: isMobile ? "100%" : "auto", borderColor: THEME.primary, color: THEME.primary }}
                onClick={() => setViewJob(record)}>
                {!isMobile && "View"}
              </Button>
            </Tooltip>

            {/* Quotation button - only show for authorized admins */}
            {record.job_status === "design" && isQuotationAuthorized && (
              <Tooltip title="Download Quotation PDF">
                <Button icon={<FileTextOutlined />} size="small"
                  style={{ width: isMobile ? "100%" : "auto", background: THEME.textPrimary, borderColor: THEME.textPrimary, color: "#fff" }}
                  onClick={() => generateInvoicePDF(record)}>
                  {!isMobile && "Quotation"}
                </Button>
              </Tooltip>
            )}

            {isQC && (
              <Tooltip title="Assign Quality Check Person">
                <Button type="primary" icon={<SafetyCertificateOutlined />} size="small"
                  style={{ background: THEME.purple, borderColor: THEME.purple, width: isMobile ? "100%" : "auto" }}
                  onClick={() => openQcModal(record)}>
                  {!isMobile && "Assign QC"}
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Delete Job">
              <Button icon={<DeleteOutlined />} size="small" danger
                style={{ width: isMobile ? "100%" : "auto" }}
                onClick={() => { setDeletingJob(record); setDeleteNotes(""); setDeleteError(""); }}>
                {!isMobile && "Delete"}
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  // ── Main tab items ───────────────────────────────────────────────────────────
  const mainTabItems = [
    {
      key: "jobs",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <BranchesOutlined />Jobs
          <Badge count={filteredJobs.length} showZero style={{ backgroundColor: THEME.primary }} />
        </span>
      ),
      children: (
        <div>
          {/* Filters */}
          <Card bodyStyle={{ padding: `${p}px ${p + 4}px` }} style={{ borderRadius: 12, border: `1px solid ${THEME.border}`, marginBottom: g, background: THEME.bgCard, boxShadow: "0 2px 12px rgba(30,111,220,0.08)" }}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
              <Input.Search
                placeholder="Search name, phone, job no…" allowClear
                onSearch={(v) => { setSearch(v); setPage(1); }}
                onChange={(e) => { if (!e.target.value) { setSearch(""); setPage(1); } }}
                style={{ flex: 1 }} size="middle"
              />
              <Select
                placeholder="Filter by Status" allowClear size="middle"
                onChange={(v) => { setStatusFilter(v || null); setPage(1); }}
                style={{ width: isMobile ? "100%" : 190 }}
              >
                {Object.entries(STATUS_CONFIG).map(([k, { label, color }]) => (
                  <Option key={k} value={k}><Tag color={color} style={{ fontWeight: 500 }}>{label}</Tag></Option>
                ))}
              </Select>
            </div>
          </Card>

          {/* Table */}
          <Card bodyStyle={{ padding: "0 0 8px 0" }} style={{ borderRadius: 12, border: `1px solid ${THEME.border}`, boxShadow: "0 2px 12px rgba(30,111,220,0.08)", background: THEME.bgCard, overflow: "hidden" }}>
            <Table
              dataSource={pagedJobs} loading={loading} columns={columns}
              scroll={{ x: isMobile ? 360 : 900 }} rowKey={(r) => r._id || r.job_no}
              size="small" rowClassName={(_, i) => (i % 2 === 0 ? "row-alt" : "")}
              pagination={{
                current: page, pageSize, total: filteredJobs.length,
                showSizeChanger: !isMobile, pageSizeOptions: ["10", "25", "50"],
                showTotal: isMobile ? undefined : (total, [start, end]) => `${start}–${end} of ${total}`,
                onChange: (pg, ps) => { setPage(pg); setPageSize(ps); },
                style: { padding: "8px 12px" },
                size: isMobile ? "small" : "default",
              }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "info-requests",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <KeyOutlined />Info Requests
          {pendingInfoCount > 0 && <Badge count={pendingInfoCount} style={{ backgroundColor: "#d97706" }} />}
        </span>
      ),
      children: <InfoRequestsPanel userProfile={userProfile} />,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: p, background: THEME.bgPage, minHeight: "100vh" }}>

      {/* Header */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{ borderRadius: 14, border: `1px solid ${THEME.border}`, marginBottom: g, background: THEME.bgCard, boxShadow: "0 2px 12px rgba(30,111,220,0.08)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, fontWeight: 800, color: THEME.textPrimary, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, letterSpacing: "-0.02em" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, background: THEME.primaryLight, borderRadius: 8, marginRight: 4 }}>
                <BranchesOutlined style={{ color: THEME.primary, fontSize: 15 }} />
              </span>
              Job Management
              {isSuperAdmin && <Tag color="gold" style={{ fontSize: 11, fontWeight: 600 }}>Super Admin</Tag>}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: THEME.textMuted }}>
              <strong style={{ color: THEME.primary }}>{filteredJobs.length}</strong> jobs · Last refreshed {lastRefreshed.format("HH:mm:ss")}
              {pendingInfoCount > 0 && (
                <span style={{ marginLeft: 10, color: THEME.amber, fontWeight: 700 }}>
                  · <KeyOutlined style={{ marginRight: 3 }} />{pendingInfoCount} info request{pendingInfoCount !== 1 ? "s" : ""} pending
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px #bbf7d0", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700, fontFamily: "monospace" }}>{fmtCountdown(countdown)}</span>
            </div>
            <Tooltip title="Refresh now">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={() => { loadJobs(); pollPendingInfo(); startAutoRefresh(); }}
                style={{ borderRadius: 8, borderColor: THEME.border, color: THEME.primary }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* Main Tabs */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{ borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.bgCard, boxShadow: "0 2px 12px rgba(30,111,220,0.08)" }}
      >
        <Tabs
          activeKey={mainTab}
          onChange={(k) => { setMainTab(k); if (k === "info-requests") pollPendingInfo(); }}
          items={mainTabItems}
          size={isMobile ? "small" : "middle"}
        />
      </Card>

      {/* ── View Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!viewJob}
        onCancel={() => setViewJob(null)}
        footer={[<Button key="close" onClick={() => setViewJob(null)} style={{ borderColor: THEME.border, color: THEME.textSecondary }}>Close</Button>]}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EyeOutlined style={{ color: THEME.primary }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Job Details</span>
            {viewJob && <Tag color="blue" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>{viewJob.job_no}</Tag>}
          </div>
        }
        width={isMobile ? "100vw" : "min(96vw, 860px)"}
        style={isMobile ? { top: 0, margin: 0, maxWidth: "100vw", padding: 0, paddingBottom: "env(safe-area-inset-bottom)" } : {}}
        styles={{ body: { maxHeight: isMobile ? "90dvh" : "85vh", overflowY: "auto", padding: isMobile ? 12 : 20 } }}
        destroyOnClose
      >
        <JobDetailView job={viewJob} isMobile={isMobile} />
      </Modal>

      {/* ── Delete Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={!!deletingJob}
        onCancel={closeDeleteModal}
        maskClosable={!deleteLoading}
        closable={!deleteLoading}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DeleteOutlined style={{ color: THEME.danger }} />
            <span style={{ fontWeight: 700, color: THEME.danger }}>Delete Job</span>
          </div>
        }
        footer={[
          <Button key="cancel" onClick={closeDeleteModal} disabled={deleteLoading} style={{ borderColor: THEME.border }}>Cancel</Button>,
          <Button key="confirm" danger type="primary" loading={deleteLoading} disabled={deleteNotes.trim().length < 50} onClick={handleDelete} icon={<DeleteOutlined />}>
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
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <ExclamationCircleOutlined style={{ color: THEME.danger, fontSize: 16, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: THEME.danger, fontSize: 13 }}>This action cannot be undone.</div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                  Job <strong>{deletingJob.job_no}</strong> for <strong>{deletingJob.customer_name}</strong> will be permanently deleted.
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6, color: THEME.textPrimary }}>
                Reason for Deletion <span style={{ color: THEME.danger }}>*</span>
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: deleteNotes.trim().length >= 50 ? THEME.success : THEME.textMuted }}>
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
                style={{ borderRadius: 8, borderColor: deleteError ? "#f87171" : deleteNotes.trim().length >= 50 ? "#86efac" : undefined }}
              />
              {deleteError && (
                <div style={{ color: THEME.danger, fontSize: 12, marginTop: 6 }}>⚠ {deleteError}</div>
              )}
              {deleteNotes.trim().length > 0 && deleteNotes.trim().length < 50 && (
                <div style={{ color: THEME.warning, fontSize: 12, marginTop: 6 }}>
                  {50 - deleteNotes.trim().length} more characters needed.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Approve Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!approvingJob}
        onCancel={() => { if (!approving) { setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); } }}
        maskClosable={!approving}
        closable={!approving}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircleOutlined style={{ color: THEME.success }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Approve & Assign to Designer</span>
          </div>
        }
        footer={[
          <Button key="cancel" disabled={approving} onClick={() => { if (!approving) { setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); } }} style={{ borderColor: THEME.border }}>
            Cancel
          </Button>,
          <Button key="approve" type="primary" loading={approving} disabled={!selectedDesigner || designersLoading} onClick={handleApprove} style={{ background: THEME.success, borderColor: THEME.success }}>
            Approve & Assign
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={slideUp}
        styles={{ body: modalBody }}
        destroyOnClose
      >
        <AssignModalBody
          job={approvingJob} members={designers} membersLoading={designersLoading}
          selected={selectedDesigner} onSelect={setSelectedDesigner}
          infoText='Job will be approved and stage set to "Design".'
        />
      </Modal>

      {/* ── QC Modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!qcJob}
        onCancel={() => { if (!qcAssigning) { setQcJob(null); setSelectedQcMember(null); setQcMembers([]); } }}
        maskClosable={!qcAssigning}
        closable={!qcAssigning}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: THEME.purple }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Assign Quality Check</span>
          </div>
        }
        footer={[
          <Button key="cancel" disabled={qcAssigning} onClick={() => { if (!qcAssigning) { setQcJob(null); setSelectedQcMember(null); setQcMembers([]); } }} style={{ borderColor: THEME.border }}>
            Cancel
          </Button>,
          <Button key="assign" type="primary" loading={qcAssigning} disabled={!selectedQcMember || qcMembersLoading} onClick={handleAssignQc} style={{ background: THEME.purple, borderColor: THEME.purple }}>
            Assign QC
          </Button>,
        ]}
        width={isMobile ? "100vw" : 480}
        style={slideUp}
        styles={{ body: modalBody }}
        destroyOnClose
      >
        <AssignModalBody
          job={qcJob} members={qcMembers} membersLoading={qcMembersLoading}
          selected={selectedQcMember} onSelect={setSelectedQcMember}
          infoText="The selected person will perform quality check for this job."
        />
      </Modal>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .row-alt td { background: ${THEME.bgRow} !important; }
        .ant-table-thead > tr > th {
          background: ${THEME.primaryLight} !important;
          color: ${THEME.primary} !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          border-bottom: 2px solid ${THEME.border} !important;
        }
        .ant-table-row:hover td { background: ${THEME.primaryLight} !important; }
        .ant-pagination-item-active { border-color: ${THEME.primary} !important; }
        .ant-pagination-item-active a { color: ${THEME.primary} !important; }
        .ant-btn-primary { background: ${THEME.primary} !important; border-color: ${THEME.primary} !important; }
        .ant-input-search .ant-input:focus { border-color: ${THEME.primary} !important; box-shadow: 0 0 0 2px ${THEME.primaryLight} !important; }
        .ant-select:not(.ant-select-disabled):hover .ant-select-selector { border-color: ${THEME.primary} !important; }
        .ant-select-focused .ant-select-selector { border-color: ${THEME.primary} !important; box-shadow: 0 0 0 2px ${THEME.primaryLight} !important; }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: ${THEME.primary} !important; }
        .ant-tabs-ink-bar { background: ${THEME.primary} !important; }
      `}</style>
    </div>
  );
};

export default Myjobs;