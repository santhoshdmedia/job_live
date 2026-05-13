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
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { IMAGE_HELPER } from "../helper/imagehelper";

const { Option } = Select;
const { TextArea } = Input;

// ─── Theme tokens ──────────────────────────────────────────────────────────────
const THEME = {
  primary: "#1e6fdc",
  primaryLight: "#dbeafe",
  primaryMid: "#93c5fd",
  primaryDark: "#1d4ed8",
  bgPage: "#f0f6ff",
  bgCard: "#ffffff",
  bgRow: "#f8fbff",
  border: "#bfdbfe",
  borderMid: "#93c5fd",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  danger: "#dc2626",
  success: "#059669",
  warning: "#d97706",
  purple: "#7c3aed",
};

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

// ── Number to Words helper ────────────────────────────────────────────────────
const numberToWords = (num) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const toWords = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + toWords(n % 100);
    if (n < 100000) return toWords(Math.floor(n / 1000)) + "Thousand " + toWords(n % 1000);
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + "Lakh " + toWords(n % 100000);
    return toWords(Math.floor(n / 10000000)) + "Crore " + toWords(n % 10000000);
  };
  const n = Math.floor(num);
  if (n === 0) return "Zero Rupees Only";
  return "INR " + toWords(n).trim() + " Rupees Only";
};

// ── Convert image URL to Base64 ──────────────────────────────────────────────
const getImageDataUri = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

// ── Generate Invoice PDF ──────────────────────────────────────────────────────
const generateInvoicePDF = async (job) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW  = 210;
  const pageH  = 297;
  const margin = 14;
  let y = 10;

  // ── Colour palette ────────────────────────────────────────────────────────
  const black      = [0,   0,   0  ];
  const white      = [255, 255, 255];
  const darkText   = [20,  20,  20 ];
  const midGray    = [100, 100, 100];
  const lightGray  = [220, 220, 220];
  const teal       = [29,  190, 154];   // #1DBE9A  accent / borders
  const tealHeader = [36,  205, 213];   // #24CDD5  table header fill
  const tealHeaderText = [13, 58, 60];  // dark text on teal header
  const redAmt     = [192, 0,   32 ];   // grand total
  const bgAlt      = [248, 252, 252];   // alternate table row
  const bgMeta     = [245, 250, 250];   // light meta band

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isSqFtItem = (it) => {
    const v = parseFloat(it.sq_ft);
    return !isNaN(v) && v > 0;
  };

  const qtyLabel = (it) => {
    if (isSqFtItem(it)) {
      if (it.size) return it.size;
      const unit = it.size_unit || "ft";
      return `${it.width || ""}×${it.height || ""} ${unit}\n(${it.sq_ft} sq.ft)`;
    }
    return `${it.quantity} pcs`;
  };

  const computeItem = (it) => {
    const rate      = parseFloat(it.price          || 0);
    const gstPct    = parseFloat(it.gst_percentage || 0);
    const sqFtVal   = parseFloat(it.sq_ft          || 0);
    const qtyVal    = parseFloat(it.quantity       || 1);
    const taxable   = isSqFtItem(it) ? rate * sqFtVal : rate * qtyVal;
    const taxAmt    = (gstPct / 100) * taxable;
    return { rate, gstPct, taxable, taxAmt, total: taxable + taxAmt };
  };

  const hrLine = (yPos, color = lightGray, weight = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(margin, yPos, pageW - margin, yPos);
  };
  const cx = pageW / 2;

  // ── 1. HEADER — Logo + tagline + contact ─────────────────────────────────
  // Diamond logo mark (3 nested polygons approximated as rects rotated via text trick)

    const logoUrl = IMAGE_HELPER.Dlogo || "https://www.dmedia.in/assets/images/edit_white_logo1.png";
  try {
    const logoBase64 = await getImageDataUri(logoUrl);
    doc.addImage(logoBase64, "PNG", pageW / 2 - 20, y, 40, 12);
    y += 20;
  } catch {
    y += 10;
  }
  // Contact line
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGray);
  doc.text("Email: info@dmedia.in     |     Website: www.dmedia.in", cx, y, { align: "center" });
  y += 5;

  hrLine(y, lightGray, 0.3);
  y += 5;

  // ── 2. META BAND — Badge + Invoice # + Date ───────────────────────────────
  doc.setFillColor(...bgMeta);
  doc.rect(margin, y, pageW - margin * 2, 18, "F");

  // Badge pill
  doc.setFillColor(29, 190, 154, 30);   // semi-transparent teal
  doc.setFillColor(220, 248, 242);
  doc.roundedRect(margin + 2, y + 2, 20, 5.5, 1, 1, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...teal);
  doc.text("INVOICE", margin + 12, y + 5.8, { align: "center" });

  // Invoice number
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text(`# ${job.job_no || "—"}`, margin + 2, y + 13);

  // Date (right side)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGray);
  const invDate = job.order_date
    ? dayjs(job.order_date).format("DD MMM YYYY")
    : "—";
  doc.text(`Invoice Date: ${invDate}`, pageW - margin - 2, y + 13, { align: "right" });

  y += 22;

  // ── 3. ADDRESSES — Customer | Shipping (two columns) ─────────────────────
  const col1X   = margin;
  const col2X   = pageW / 2 + 4;
  const colMaxW = pageW / 2 - margin - 6;
  const addr    = job.delivery_address || {};

  const addrLines = [
    [addr.street].filter(Boolean),
    [[addr.city, addr.state].filter(Boolean).join(", ")].filter(Boolean),
    addr.pincode ? [`PINCODE: ${addr.pincode}`] : [],
    addr.country ? [addr.country] : [],
  ].flat();

  // Section label
  const secLabel = (text, x, yy) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...teal);
    doc.text(text.toUpperCase(), x, yy);
  };  

  secLabel("Customer Details", col1X, y);
  secLabel("Shipping Details", col2X, y);
  y += 5;

  // Customer name
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text(job.customer_name || "—", col1X, y);
  let cy = y + 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  addrLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, colMaxW);
    doc.text(wrapped, col1X, cy);
    cy += wrapped.length * 4.5;
  });

  if (job.customer_phone) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.setFontSize(8);
    const phoneLabelW = doc.getTextWidth("Phone: ");
    doc.text("Phone: ", col1X, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(job.customer_phone, col1X + phoneLabelW, cy);
    cy += 5;
  }

  // Shipping column
  let sy = y;
  const shipRows = [
    [
      "Expected Delivery:",
      job.estimated_delivery_date
        ? dayjs(job.estimated_delivery_date).format("DD MMM YYYY  HH:mm")
        : "5–7 Business Days",
    ],
    ["Delivery Mode:", "Standard"],
  ];

  shipRows.forEach(([label, val]) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...midGray);
    doc.text(label, col2X, sy);
    const lw = doc.getTextWidth(label) + 2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    const valLines = doc.splitTextToSize(val, colMaxW - lw);
    doc.text(valLines, col2X + lw, sy);
    sy += valLines.length * 5 + 3;
  });

  // Vertical divider between address columns
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2, y - 3, pageW / 2, Math.max(cy, sy) + 2);

  y = Math.max(cy, sy) + 6;
  hrLine(y, lightGray, 0.3);
  y += 6;

  // ── 4. ITEMS TABLE ────────────────────────────────────────────────────────
  const computedItems = (job.cart_items || []).map((it, i) => {
    const { rate, gstPct, taxable, taxAmt, total } = computeItem(it);
    const desc = [it.product_name, it.variation, it.printing_type]
      .filter(Boolean)
      .join(" | ");
    return {
      row: [
        i + 1,
        desc || "—",
        qtyLabel(it),
        `Rs. ${rate.toFixed(2)}`,
        gstPct > 0 ? `${gstPct}%` : "0%",
        `Rs. ${taxable.toFixed(2)}`,
        `Rs. ${taxAmt.toFixed(2)}`,
        `Rs. ${total.toFixed(2)}`,
      ],
      taxable,
      taxAmt,
      total,
    };
  });

  const tableRows    = computedItems.map((x) => x.row);
  const totalTaxable = computedItems.reduce((s, x) => s + x.taxable, 0);
  const totalTax     = computedItems.reduce((s, x) => s + x.taxAmt, 0);
  const grandTotal   = parseFloat(job.total_amount   || 0);
  const deliveryChg  = parseFloat(job.delivery_charges || 0);

  // Columns sum to 182 mm (210 - 14*2)
  // #(6) Desc(50) Qty(28) Rate(20) GST(12) Taxable(24) TaxAmt(22) Total(20) = 182
  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty / Area", "Rate", "GST %", "Taxable Amt", "Tax Amt", "Total"]],
    body: tableRows.length
      ? tableRows
      : [["", "No items", "", "", "", "", "", ""]],
    theme: "grid",
    headStyles: {
      fillColor: tealHeader,
      textColor: tealHeaderText,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: darkText,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: bgAlt },
    columnStyles: {
      0: { cellWidth: 6,  halign: "center" },
      1: { cellWidth: 50, halign: "left"   },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 20, halign: "right"  },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 24, halign: "right"  },
      6: { cellWidth: 22, halign: "right"  },
      7: { cellWidth: 20, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
    tableLineColor: lightGray,
    tableLineWidth: 0.3,
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = redAmt;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 7;

  // ── 5. AMOUNT IN WORDS ───────────────────────────────────────────────────
  const amtWords  = numberToWords(grandTotal);
  const keyLabel  = "Total amount (in words):   ";
  const keyW      = doc.getTextWidth(keyLabel);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midGray);
  doc.text(keyLabel, margin, y);

  doc.setFont("helvetica", "italic");
  doc.setTextColor(...midGray);
  const wrappedWords = doc.splitTextToSize(amtWords, pageW - margin * 2 - keyW);
  doc.text(wrappedWords, margin + keyW, y);
  y += wrappedWords.length * 5 + 8;

  // ── 6. SUMMARY TABLE (right-aligned) ────────────────────────────────────
  // Build per-rate GST rows
  const gstByRate = {};
  (job.cart_items || []).forEach((it) => {
    const { taxable, taxAmt, gstPct } = computeItem(it);
    const key = String(gstPct);
    if (!gstByRate[key]) gstByRate[key] = { taxAmt: 0 };
    gstByRate[key].taxAmt += taxAmt;
  });

  const summaryRows = [
    { label: "Subtotal (Taxable)",   val: `Rs. ${totalTaxable.toFixed(2)}`,         bold: false, red: false  },
    ...Object.entries(gstByRate)
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([pct, { taxAmt }]) => {
        const half = (parseFloat(pct) / 2).toFixed(1);
        return {
          label: `GST @ ${pct}%  (CGST ${half}% + SGST ${half}%)`,
          val:   `Rs. ${taxAmt.toFixed(2)}`,
          bold:  false, red: false,
        };
      }),
    {
      label: "Delivery Charges",
      val: job.free_delivery ? "Free" : `Rs. ${deliveryChg.toFixed(2)}`,
      bold: false, red: false,
    },
    ...(parseFloat(job.discount_amount || 0) > 0
      ? [{
          label: `Discount (${job.discount_percentage || 0}%)`,
          val:   `- Rs. ${parseFloat(job.discount_amount || 0).toFixed(2)}`,
          bold:  true, red: false, green: true,
        }]
      : []),
  ];

  const sumW  = 105;
  const sumX  = pageW - margin - sumW;
  const valX  = pageW - margin;
  let ry = y;

  summaryRows.forEach(({ label, val, green }) => {
    const labelColor = green ? [0, 140, 60] : midGray;
    const valColor   = green ? [0, 140, 60] : darkText;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...labelColor);
    doc.text(label, sumX, ry);

    doc.setFont("helvetica", green ? "bold" : "normal");
    doc.setTextColor(...valColor);
    doc.text(val, valX, ry, { align: "right" });

    ry += 6;
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.25);
    doc.line(sumX, ry - 1.5, valX, ry - 1.5);
  });

  // Grand Total row — highlighted strip
  ry += 2;
  doc.setFillColor(255, 244, 246);
  doc.rect(sumX - 3, ry - 4.5, sumW + 5, 9, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text("Grand Total", sumX, ry);
  doc.setTextColor(...redAmt);
  doc.text(`Rs. ${grandTotal.toFixed(2)}`, valX, ry, { align: "right" });

  y = ry + 14;

  // ── 7. TERMS & CONDITIONS BOX ────────────────────────────────────────────
  const tcRaw = (
    job.terms_and_conditions ||
    "Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation."
  );
  const tcLines  = tcRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const tcLineH  = 5;
  const tcBoxH   = 8 + tcLines.length * tcLineH + 7;   // header(8) + lines + padding

  // Outer border
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - margin * 2, tcBoxH, "S");

  // Left accent bar
  doc.setFillColor(...teal);
  doc.rect(margin, y, 3, tcBoxH, "F");

  // Heading
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...teal);
  doc.text("TERMS & CONDITIONS:", margin + 6, y + 6);

  // Lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  let tcy = y + 12;
  tcLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(`• ${line}`, pageW - margin * 2 - 12);
    doc.text(wrapped, margin + 6, tcy);
    tcy += wrapped.length * tcLineH;
  });

  y += tcBoxH + 8;

  // ── 8. SELLER INFORMATION ────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midGray);
  doc.text("SELLER INFORMATION", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...darkText);
  doc.text(`GST NO : ${job.gst_no || "33AANCP3376Q1ZN"}`, margin, y);
  y += 4.5;
  doc.text("PAN NO : AANCP3376Q", margin, y);
  y += 8;

  // ── 9. FOOTER ────────────────────────────────────────────────────────────
  hrLine(y, lightGray, 0.3);
  y += 5;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text(
    "MARKETED BY PAZHANAM DESIGNS AND CONSTRUCTIONS PRIVATE LIMITED",
    pageW / 2, y, { align: "center" }
  );
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...midGray);
  doc.text("#8 Church Colony, Tiruchirappalli, Tamil Nadu - 620017", pageW / 2, y, { align: "center" });
  y += 4.5;
  doc.text(
    "Email: info@dmedia.in  |  Customer-care: +91 95856 10000  |  Website: www.dmedia.in",
    pageW / 2, y, { align: "center" }
  );

  // ── 10. BOTTOM POWERED-BY BAR ────────────────────────────────────────────
  doc.setFillColor(...black);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("Powered By ", pageW / 2 - 5, pageH - 3.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("DMEDIA", pageW / 2 - 4.5, pageH - 3.5);

  doc.save(`Invoice_${job.job_no || "job"}.pdf`);
};

// ─── Constants ────────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const API_BASE = "https://api.dmedia.in/api";

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

// ─── Shared components ────────────────────────────────────────────────────────
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
  if (!stage || !label) return <span style={{ color: THEME.textMuted, fontSize: 12 }}>—</span>;
  return (
    <Tag color="geekblue" icon={<BranchesOutlined />} style={{ fontSize: 11 }}>
      {label}
    </Tag>
  );
};

const SectionDivider = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 10px" }}>
    <span style={{ color: THEME.primary, fontSize: 13 }}>{icon}</span>
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: THEME.textPrimary,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
      }}
    >
      {title}
    </span>
    <div style={{ flex: 1, height: 1, background: THEME.border, marginLeft: 4 }} />
  </div>
);

// ─── Job Detail View ──────────────────────────────────────────────────────────
const JobDetailView = ({ job, isMobile }) => {
  if (!job) return null;
  const addr = job.delivery_address || {};
  const fullAddress = [addr.street, addr.city, addr.state, addr.pincode, addr.country]
    .filter(Boolean)
    .join(", ");

  const LV = ({ label, value, mono }) => (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: THEME.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: THEME.textPrimary,
          fontFamily: mono ? "monospace" : undefined,
          fontWeight: mono ? 600 : 400,
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );

  const grid2 = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)",
    gap: "4px 16px",
    marginBottom: 12,
  };
  const grid4 = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
    gap: "4px 16px",
    marginBottom: 12,
  };

  return (
    <div>
      <SectionDivider icon={<UserOutlined />} title="Customer Info" />
      <div style={grid2}>
        <LV label="Name" value={job.customer_name} />
        <LV label="Phone" value={job.customer_phone} />
        <LV
          label="Est. Delivery"
          value={
            job.estimated_delivery_date
              ? dayjs(job.estimated_delivery_date).format("DD MMM YYYY, hh:mm A")
              : null
          }
        />
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
          const isSqFt = it.quantity_type === "sq.ft" || (it.sq_ft && it.sq_ft > 0);
          const lineTotal = isSqFt
            ? (it.quantity || 0) * (it.sq_ft || 0) * (it.price || 0)
            : (it.quantity || 0) * (it.price || 0);
          return (
            <div
              key={i}
              style={{
                background: THEME.primaryLight,
                border: `1px solid ${THEME.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                borderLeft: `4px solid ${THEME.primary}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: THEME.textPrimary, marginRight: 8 }}>
                    {it.product_name || "—"}
                  </span>
                  {it.variation && <Tag style={{ fontSize: 10 }}>{it.variation}</Tag>}
                  {it.printing_type && (
                    <Tag color="blue" style={{ fontSize: 10 }}>
                      {it.printing_type}
                    </Tag>
                  )}
                </div>
                <span style={{ fontWeight: 700, color: THEME.success, fontSize: 13 }}>
                  ₹{lineTotal.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: THEME.textSecondary,
                  marginTop: 4,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {isSqFt && it.width && (
                  <span>
                    Size: {it.width} × {it.height} {it.size_unit} ({it.sq_ft} ft²)
                  </span>
                )}
                <span>Qty: {it.quantity}</span>
                <span>
                  Price: ₹{it.price}/{isSqFt ? "sq.ft" : "unit"}
                </span>
                {it.notes && <span>Note: {it.notes}</span>}
              </div>
              {it.design_file && (
                <a
                  href={it.design_file}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: THEME.primary, marginTop: 4, display: "inline-block" }}
                >
                  View Design File ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      <SectionDivider icon={<FileTextOutlined />} title="Pricing" />
      <div
        style={{
          background: `linear-gradient(135deg, ${THEME.primaryLight}, #f0f9ff)`,
          border: `1px solid ${THEME.border}`,
          borderRadius: 10,
          padding: isMobile ? "10px" : "14px 16px",
          marginBottom: 12,
        }}
      >
        {[
          { label: "Subtotal", value: `₹${parseFloat(job.subtotal || 0).toFixed(2)}` },
          ...(job.discount_amount > 0
            ? [
                {
                  label: `Discount (${job.discount_percentage}%)`,
                  value: `- ₹${parseFloat(job.discount_amount).toFixed(2)}`,
                  green: true,
                },
              ]
            : []),
          { label: "GST", value: `₹${parseFloat(job.tax_amount || 0).toFixed(2)}` },
          {
            label: "Delivery",
            value: job.free_delivery ? "Free 🎉" : `₹${parseFloat(job.delivery_charges || 0).toFixed(2)}`,
          },
        ].map(({ label, value, green }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: green ? THEME.success : THEME.textSecondary,
              marginBottom: 4,
            }}
          >
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
              <img
                src={job.design_file}
                alt="Design"
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                  border: `1px solid ${THEME.border}`,
                  objectFit: "contain",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </a>
          </div>
        </>
      )}

      {job.productionimg && (
        <>
          <SectionDivider icon={<PlayCircleOutlined />} title="Production Image" />
          <div style={{ marginBottom: 12 }}>
            <a href={job.productionimg} target="_blank" rel="noreferrer">
              <img
                src={job.productionimg}
                alt="Production"
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                  border: `1px solid ${THEME.border}`,
                  objectFit: "contain",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </a>
          </div>
        </>
      )}

      <SectionDivider icon={<FileTextOutlined />} title="Job Info" />
      <div style={grid4}>
        {[
          { label: "Job No", value: job.job_no, mono: true },
          { label: "Status", value: <StatusTag status={job.job_status} /> },
          { label: "Created By", value: job.created_by },
          { label: "Approved By", value: job.approved_by },
          { label: "GST No", value: job.gst_no },
          { label: "Payment Mode", value: job.payment_mode },
          { label: "Payment Amount", value: job.payment_amount ? `₹${job.payment_amount}` : null },
          { label: "Order Date", value: job.order_date ? dayjs(job.order_date).format("DD MMM YYYY") : null },
          ...(job.current_stage?.stage
            ? [{ label: "Stage", value: <StageTag stage={job.current_stage.stage} /> }]
            : []),
          ...(job.current_stage?.assigned_to?.name
            ? [{ label: "Assigned To", value: job.current_stage.assigned_to.name }]
            : []),
          { label: "Design Status", value: job.design_status },
          { label: "Design Uploaded By", value: job.design_uploaded_by },
          { label: "Production Status", value: job.production_status },
          { label: "QC Status", value: job.qc_status },
        ].map(({ label, value, mono }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: THEME.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 13,
                color: THEME.textPrimary,
                fontFamily: mono ? "monospace" : undefined,
                fontWeight: mono ? 600 : 400,
              }}
            >
              {value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {job.notes && (
        <div
          style={{
            background: "#fefce8",
            border: "1px solid #fef08a",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#713f12",
          }}
        >
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
      <div
        style={{
          background: THEME.primaryLight,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 16,
          border: `1px solid ${THEME.border}`,
          borderLeft: `4px solid ${THEME.primary}`,
        }}
      >
        <div style={{ fontFamily: "monospace", fontWeight: 700, color: THEME.primary, fontSize: 14 }}>
          {job.job_no}
        </div>
        <div style={{ fontSize: 13, color: THEME.textPrimary, marginTop: 2 }}>{job.customer_name || "—"}</div>
        <div style={{ fontSize: 11, color: THEME.textSecondary }}>{job.customer_phone || ""}</div>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          Status: <StatusTag status={job.job_status} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13, color: THEME.textPrimary }}
        >
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
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: THEME.warning,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 6,
              padding: "6px 10px",
            }}
          >
            ⚠️ No members found. Please add the required team members first.
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: THEME.textSecondary,
          background: THEME.primaryLight,
          padding: "8px 12px",
          borderRadius: 6,
          border: `1px solid ${THEME.border}`,
        }}
      >
        ℹ️ {infoText}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MyJobs = () => {
  const { isMobile, isDesktop } = useBreakpoint();

  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);

  const [viewJob, setViewJob] = useState(null);
  const [deletingJob, setDeletingJob] = useState(null);
  const [deleteNotes, setDeleteNotes] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [approvingJob, setApprovingJob] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState(null);
  const [approving, setApproving] = useState(false);
  const [designersLoading, setDesignersLoading] = useState(false);

  const [qcJob, setQcJob] = useState(null);
  const [qcMembers, setQcMembers] = useState([]);
  const [selectedQcMember, setSelectedQcMember] = useState(null);
  const [qcAssigning, setQcAssigning] = useState(false);
  const [qcMembersLoading, setQcMembersLoading] = useState(false);

  const autoRefreshRef = useRef(null);
  const countdownRef = useRef(null);
  const userProfile = useMemo(() => getUserProfile(), []);
  const isSuperAdmin = userProfile?.role === "super admin";

  const fetchAllAdmins = async () => {
    const res = await fetch(`${API_BASE}/admin/get_admin`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    return data.data || [];
  };

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
        message.error(err.message || "Failed to load jobs");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isSuperAdmin, userProfile?._id]
  );

  const startAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_MS / 1000);
    countdownRef.current = setInterval(
      () => setCountdown((p) => (p <= 1 ? AUTO_REFRESH_MS / 1000 : p - 1)),
      1000
    );
    autoRefreshRef.current = setInterval(() => loadJobs(true), AUTO_REFRESH_MS);
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
    startAutoRefresh();
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const filteredJobs = useMemo(() => {
    let rows = jobs;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (j) =>
          (j.customer_name || "").toLowerCase().includes(q) ||
          (j.customer_phone || "").includes(q) ||
          (j.job_no || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) rows = rows.filter((j) => j.job_status === statusFilter);
    return rows;
  }, [jobs, search, statusFilter]);

  const pagedJobs = useMemo(() => {
    const s = (page - 1) * pageSize;
    return filteredJobs.slice(s, s + pageSize);
  }, [filteredJobs, page, pageSize]);

  // Approve
  const openApproveModal = async (job) => {
    setApprovingJob(job);
    setSelectedDesigner(null);
    setDesignersLoading(true);
    try {
      const all = await fetchAllAdmins();
      setDesigners(all.filter((u) => u.role === "designing team"));
    } catch {
      message.error("Could not load designers list");
      setDesigners([]);
    } finally {
      setDesignersLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDesigner) {
      message.error("Please select a designer.");
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
      message.success(`Job ${approvingJob.job_no} approved & assigned to ${name}`);
      setApprovingJob(null);
      setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) {
      message.error(err.message || "Failed to approve job");
    } finally {
      setApproving(false);
    }
  };

  // Delete
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
      message.success(`Job ${deletingJob.job_no} deleted successfully.`);
      closeDeleteModal();
      loadJobs(true);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete job");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Quality Check
  const openQcModal = async (job) => {
    setQcJob(job);
    setSelectedQcMember(null);
    setQcMembersLoading(true);
    try {
      const all = await fetchAllAdmins();
      const qcList = all.filter((u) => u.role === "quality check");
      setQcMembers(qcList.length > 0 ? qcList : all);
    } catch {
      message.error("Could not load QC members");
      setQcMembers([]);
    } finally {
      setQcMembersLoading(false);
    }
  };

  const handleAssignQc = async () => {
    if (!selectedQcMember) {
      message.error("Please select a QC assignee.");
      return;
    }
    setQcAssigning(true);
    try {
      const assigneeName =
        selectedQcMember.name || selectedQcMember.fullName || selectedQcMember.username || "Unknown";
      const payload = {
        stage: "quality_check",
        stage_label: "quality_check",
        assigned_to: {
          user_id: selectedQcMember._id,
          name: assigneeName,
          role: selectedQcMember.role || "",
        },
        assigned_by: {
          user_id: userProfile?._id || null,
          name: userProfile?.name || "Unknown",
          role: userProfile?.role || "",
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
      message.success(`Quality check assigned to ${assigneeName}`);
      setQcJob(null);
      setSelectedQcMember(null);
      loadJobs(true);
    } catch (err) {
      message.error(err.message || "Failed to assign QC");
    } finally {
      setQcAssigning(false);
    }
  };

  const fmtCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const p = isMobile ? 8 : 16;
  const g = isMobile ? 8 : 12;
  const slideUp = isMobile
    ? {
        top: "auto",
        bottom: 0,
        margin: 0,
        maxWidth: "100vw",
        padding: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
      }
    : {};
  const modalBody = {
    maxHeight: isMobile ? "72dvh" : "80vh",
    overflowY: "auto",
    padding: isMobile ? 12 : 16,
  };

  const columns = [
    {
      title: "#",
      width: 36,
      render: (_, __, i) => (
        <span style={{ color: THEME.textMuted, fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</span>
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
          <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textPrimary }}>{r.customer_name || "—"}</div>
          <div style={{ fontSize: 11, color: THEME.textSecondary }}>{r.customer_phone || ""}</div>
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
              <span style={{ fontSize: 12, color: THEME.textSecondary, whiteSpace: "nowrap" }}>
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
        <span style={{ fontWeight: 700, fontSize: 13, color: THEME.primary, whiteSpace: "nowrap" }}>
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
      width: isMobile ? 110 : 230,
      render: (_, record) => {
        const isQC = record.job_status === "quality_check";
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
            <Tooltip title="View Job Details">
              <Button
                icon={<EyeOutlined />}
                size="small"
                style={{ width: isMobile ? "100%" : "auto", borderColor: THEME.primary, color: THEME.primary }}
                onClick={() => setViewJob(record)}
              >
                {!isMobile && "View"}
              </Button>
            </Tooltip>

            {record.job_status === "design" && (
              <Tooltip title="Download Invoice PDF">
                <Button
                  icon={<FileTextOutlined />}
                  size="small"
                  style={{
                    width: isMobile ? "100%" : "auto",
                    background: THEME.textPrimary,
                    borderColor: THEME.textPrimary,
                    color: "#fff",
                  }}
                  onClick={() => generateInvoicePDF(record)}
                >
                  {!isMobile && "Invoice"}
                </Button>
              </Tooltip>
            )}

            {isQC && (
              <Tooltip title="Assign Quality Check Person">
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  size="small"
                  style={{
                    background: THEME.purple,
                    borderColor: THEME.purple,
                    width: isMobile ? "100%" : "auto",
                  }}
                  onClick={() => openQcModal(record)}
                >
                  {!isMobile && "Assign QC"}
                </Button>
              </Tooltip>
            )}

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

  return (
    <div style={{ padding: p, background: THEME.bgPage, minHeight: "100vh" }}>
      {/* Header */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          marginBottom: g,
          background: THEME.bgCard,
          boxShadow: "0 2px 12px rgba(30, 111, 220, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? 16 : 20,
                fontWeight: 800,
                color: THEME.textPrimary,
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                letterSpacing: "-0.02em",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  background: THEME.primaryLight,
                  borderRadius: 8,
                  marginRight: 4,
                }}
              >
                <BranchesOutlined style={{ color: THEME.primary, fontSize: 15 }} />
              </span>
              Job Management
              {isSuperAdmin && (
                <Tag color="gold" style={{ fontSize: 11, fontWeight: 600 }}>
                  Super Admin
                </Tag>
              )}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: THEME.textMuted }}>
              <strong style={{ color: THEME.primary }}>{filteredJobs.length}</strong> jobs · Last refreshed{" "}
              {lastRefreshed.format("HH:mm:ss")}
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
                padding: "4px 12px",
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
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700, fontFamily: "monospace" }}>
                {fmtCountdown(countdown)}
              </span>
            </div>
            <Tooltip title="Refresh now">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={() => {
                  loadJobs();
                  startAutoRefresh();
                }}
                style={{ borderRadius: 8, borderColor: THEME.border, color: THEME.primary }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card
        bodyStyle={{ padding: `${p}px ${p + 4}px` }}
        style={{
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          marginBottom: g,
          background: THEME.bgCard,
          boxShadow: "0 2px 12px rgba(30, 111, 220, 0.08)",
        }}
      >
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
          <Input.Search
            placeholder="Search name, phone, job no…"
            allowClear
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setSearch("");
                setPage(1);
              }
            }}
            style={{ flex: 1 }}
            size="middle"
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            size="middle"
            onChange={(v) => {
              setStatusFilter(v || null);
              setPage(1);
            }}
            style={{ width: isMobile ? "100%" : 190 }}
          >
            {Object.entries(STATUS_CONFIG).map(([k, { label, color }]) => (
              <Option key={k} value={k}>
                <Tag color={color} style={{ fontWeight: 500 }}>
                  {label}
                </Tag>
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card
        bodyStyle={{ padding: "0 0 8px 0" }}
        style={{
          borderRadius: 14,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0 2px 12px rgba(30, 111, 220, 0.08)",
          background: THEME.bgCard,
          overflow: "hidden",
        }}
      >
        <Table
          dataSource={pagedJobs}
          loading={loading}
          columns={columns}
          scroll={{ x: isMobile ? 360 : 900 }}
          rowKey={(r) => r._id || r.job_no}
          size="small"
          rowClassName={(_, i) => (i % 2 === 0 ? "row-alt" : "")}
          pagination={{
            current: page,
            pageSize,
            total: filteredJobs.length,
            showSizeChanger: !isMobile,
            pageSizeOptions: ["10", "25", "50"],
            showTotal: isMobile
              ? undefined
              : (total, [start, end]) => `${start}–${end} of ${total}`,
            onChange: (pg, ps) => {
              setPage(pg);
              setPageSize(ps);
            },
            style: { padding: "8px 12px" },
            size: isMobile ? "small" : "default",
          }}
        />
      </Card>

      {/* View Modal */}
      <Modal
        open={!!viewJob}
        onCancel={() => setViewJob(null)}
        footer={[
          <Button
            key="close"
            onClick={() => setViewJob(null)}
            style={{ borderColor: THEME.border, color: THEME.textSecondary }}
          >
            Close
          </Button>,
        ]}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <EyeOutlined style={{ color: THEME.primary }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Job Details</span>
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
            ? {
                top: 0,
                margin: 0,
                maxWidth: "100vw",
                padding: 0,
                paddingBottom: "env(safe-area-inset-bottom)",
              }
            : {}
        }
        styles={{
          body: {
            maxHeight: isMobile ? "90dvh" : "85vh",
            overflowY: "auto",
            padding: isMobile ? 12 : 20,
          },
        }}
        destroyOnClose
      >
        <JobDetailView job={viewJob} isMobile={isMobile} />
      </Modal>

      {/* Delete Modal */}
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
          <Button
            key="cancel"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
            style={{ borderColor: THEME.border }}
          >
            Cancel
          </Button>,
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
              <ExclamationCircleOutlined
                style={{ color: THEME.danger, fontSize: 16, marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 700, color: THEME.danger, fontSize: 13 }}>
                  This action cannot be undone.
                </div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                  Job <strong>{deletingJob.job_no}</strong> for{" "}
                  <strong>{deletingJob.customer_name}</strong> will be permanently deleted.
                </div>
              </div>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 6,
                  color: THEME.textPrimary,
                }}
              >
                Reason for Deletion <span style={{ color: THEME.danger }}>*</span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 400,
                    color: deleteNotes.trim().length >= 50 ? THEME.success : THEME.textMuted,
                  }}
                >
                  ({deleteNotes.trim().length} / 50 min)
                </span>
              </label>
              <TextArea
                rows={4}
                placeholder="Explain why this job is being deleted — e.g. customer cancelled, duplicate entry, wrong details entered…"
                value={deleteNotes}
                onChange={(e) => {
                  setDeleteNotes(e.target.value);
                  if (deleteError) setDeleteError("");
                }}
                maxLength={500}
                showCount
                style={{
                  borderRadius: 8,
                  borderColor: deleteError
                    ? "#f87171"
                    : deleteNotes.trim().length >= 50
                    ? "#86efac"
                    : undefined,
                }}
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

      {/* Approve Modal */}
      <Modal
        open={!!approvingJob}
        onCancel={() => {
          if (!approving) {
            setApprovingJob(null);
            setSelectedDesigner(null);
            setDesigners([]);
          }
        }}
        maskClosable={!approving}
        closable={!approving}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircleOutlined style={{ color: THEME.success }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Approve & Assign to Designer</span>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            disabled={approving}
            onClick={() => {
              if (!approving) {
                setApprovingJob(null);
                setSelectedDesigner(null);
                setDesigners([]);
              }
            }}
            style={{ borderColor: THEME.border }}
          >
            Cancel
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approving}
            disabled={!selectedDesigner || designersLoading}
            onClick={handleApprove}
            style={{ background: THEME.success, borderColor: THEME.success }}
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

      {/* QC Modal */}
      <Modal
        open={!!qcJob}
        onCancel={() => {
          if (!qcAssigning) {
            setQcJob(null);
            setSelectedQcMember(null);
            setQcMembers([]);
          }
        }}
        maskClosable={!qcAssigning}
        closable={!qcAssigning}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: THEME.purple }} />
            <span style={{ fontWeight: 700, color: THEME.textPrimary }}>Assign Quality Check</span>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            disabled={qcAssigning}
            onClick={() => {
              if (!qcAssigning) {
                setQcJob(null);
                setSelectedQcMember(null);
                setQcMembers([]);
              }
            }}
            style={{ borderColor: THEME.border }}
          >
            Cancel
          </Button>,
          <Button
            key="assign"
            type="primary"
            loading={qcAssigning}
            disabled={!selectedQcMember || qcMembersLoading}
            onClick={handleAssignQc}
            style={{ background: THEME.purple, borderColor: THEME.purple }}
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
        .ant-card { transition: box-shadow 0.2s; }
      `}</style>
    </div>
  );
};

export default MyJobs;