// Myjobs.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Button, Card, Input, Modal, Select, Tag, Tooltip, Divider,
  Table, message, Tabs, Badge, Spin, Empty,
} from "antd";
import {
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, SwapOutlined, SendOutlined, UserOutlined,
  FileTextOutlined, BranchesOutlined, PlayCircleOutlined,
  PauseCircleOutlined, DeleteOutlined, EyeOutlined,
  ExclamationCircleOutlined, SafetyCertificateOutlined,
  HourglassOutlined, UnlockOutlined, LockOutlined, InfoCircleOutlined,
  CalendarOutlined, KeyOutlined, PrinterOutlined, WhatsAppOutlined,
  MailOutlined, DownloadOutlined, ShareAltOutlined, CopyOutlined,
  ShopOutlined, GiftOutlined,
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
const API_BASE = "https://api.dmedia.in/api";
const INFO_BASE = "https://api.dmedia.in/api/info-requests";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ── Applicable Products List ──────────────────────────────────────────────────
const APPLICABLE_PRODUCTS = [
  { label: "Wood", value: "6a3a230becad7f75a775aaa4", link: "https://printe.in/product/Wood-Log-colour" },
];

// ── localStorage key for persisted coupon store ───────────────────────────────
const COUPON_STORE_LS_KEY = "dmedia_coupon_store";

const loadCouponStoreFromLS = () => {
  try {
    const raw = localStorage.getItem(COUPON_STORE_LS_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch { return new Map(); }
};

const saveCouponStoreToLS = (map) => {
  try {
    const obj = {};
    map.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(COUPON_STORE_LS_KEY, JSON.stringify(obj));
  } catch { /* silent */ }
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getUserProfile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};
const getToken = () => localStorage.getItem("authToken");
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });

// ─── Theme ────────────────────────────────────────────────────────────────────
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
  amber: "#d97706",
};

// ─── Coupon Theme Colors ───────────────────────────────────────────────────────
const C = {
  YELLOW:      "#f2c41a",
  YELLOW_DARK: "#c99d08",
  YELLOW_PALE: "#fef9e0",
  BROWN_DARK:  "#000000",
  BROWN_MID:   "#1a1a1a",
  BROWN_LT:    "#333333",
  CREAM:       "#fff8e1",
};

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
  return { bp, isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md", isDesktop: bp === "lg" };
};

// ── Number to Words ───────────────────────────────────────────────────────────
const numberToWords = (num) => {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const toW = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred " + toW(n%100);
    if (n < 100000) return toW(Math.floor(n/1000)) + "Thousand " + toW(n%1000);
    if (n < 10000000) return toW(Math.floor(n/100000)) + "Lakh " + toW(n%100000);
    return toW(Math.floor(n/10000000)) + "Crore " + toW(n%10000000);
  };
  const n = Math.floor(num);
  return n === 0 ? "Zero Rupees Only" : "INR " + toW(n).trim() + " Rupees Only";
};

// ── Random 4-letter suffix ────────────────────────────────────────────────────
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const nextAlphaSuffix = (n = 4) => {
  let r = "";
  for (let i = 0; i < n; i++) r += ALPHA[Math.floor(Math.random() * 26)];
  return r;
};

// ── Image to Base64 ───────────────────────────────────────────────────────────
const getImageDataUri = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context not available")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

// ── Build Invoice PDF ─────────────────────────────────────────────────────────
const buildInvoicePDF = async (job) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297, MARGIN = 14, CW = PW - MARGIN * 2;
  let y = 0;
  const WHITE=[255,255,255], DARK=[20,20,20], MID=[100,100,100], LGRAY=[210,210,210], BGLIGHT=[248,248,248], BLUE=[30,80,160];
  const hr = (yy,color=LGRAY,w=0.25) => { doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(MARGIN,yy,PW-MARGIN,yy); };
  const fillRect = (x,ry,w,h,fill,stroke) => {
    if(fill){doc.setFillColor(...fill);doc.rect(x,ry,w,h,"F");}
    if(stroke){doc.setDrawColor(...stroke);doc.setLineWidth(0.25);doc.rect(x,ry,w,h,"S");}
  };
  const isSqFtItem = (it) => it.quantity_type==="sq.ft"||parseFloat(it.sq_ft)>0;
  const itemBase = (it) => {
    const qty=parseFloat(it.quantity||1), sqft=parseFloat(it.sq_ft||0), pr=parseFloat(it.price||0);
    return isSqFtItem(it) ? qty*sqft*pr : qty*pr;
  };
  const cartItems=job.cart_items||[];
  const grandTotal=parseFloat(job.total_amount||0);
  const deliveryChg=job.free_delivery?0:parseFloat(job.delivery_charges||0);
  const designChg=parseFloat(job.design_charges||0);
  const discountAmt=parseFloat(job.discount_amount||0);
  const discountPct=parseFloat(job.discount_percentage||0);
  y=8;
  doc.setFillColor(...WHITE); doc.roundedRect(MARGIN,y,4,6,1,1,"F");
  doc.setTextColor(...BLUE); doc.setFontSize(9.5); doc.setFont("helvetica","bold");
  doc.text("QUOTATION",MARGIN+10,y+4.2,{align:"center"});
  doc.setTextColor(...MID); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text("ORIGINAL FOR RECIPIENT",PW-MARGIN,y+4.2,{align:"right"});
  y+=10;
  const logoUrl=IMAGE_HELPER?.Dlogo||"https://www.dmedia.in/assets/images/edit_white_logo1.png";
  doc.setTextColor(...DARK); doc.setFontSize(10); doc.setFont("helvetica","bold");
  const companyNameLines=doc.splitTextToSize("PAZHANAM DESIGNS AND CONSTRUCTIONS PRIVATE LIMITED",CW-36);
  doc.text(companyNameLines,MARGIN,y);
  const companyInfoLines=["GSTIN : 33AANCP3376Q1ZN    PAN : AANCP3376Q","NO.35, GROUND FLOOR, SUBHAM ILLAM","KUMUTHAM SALAI, Tiruchirappalli","TIRUCHIRAPPALLI, TAMIL NADU, 620018","Mobile : +91 7373610000, 9943026600   Email : dmediaculbe@gmail.com","Website : www.dmedia.in"];
  let cy=y+companyNameLines.length*5+1;
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...MID);
  companyInfoLines.forEach((ln)=>{doc.text(ln,MARGIN,cy);cy+=4;});
  try {
    const logoB64=await getImageDataUri(logoUrl);
    const logoX=PW-MARGIN-32, logoY=y-2;
    fillRect(logoX,logoY,40,20,WHITE,WHITE);
    doc.addImage(logoB64,"PNG",logoX+2,logoY+2,35,15);
  } catch {}
  y=cy+4; hr(y,LGRAY,0.4); y+=5;
  const invDate=job.order_date?dayjs(job.order_date).format("DD MMM YYYY"):dayjs().format("DD MMM YYYY");
  const validDate=job.valid_until?dayjs(job.valid_until).format("DD MMM YYYY"):invDate;
  fillRect(MARGIN,y-2,CW,11,BGLIGHT,LGRAY);
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  doc.text(`Quotation #: ${job.job_no||"—"}`,MARGIN+4,y+5);
  doc.text(`Quotation Date: ${invDate}`,PW/2,y+5,{align:"center"});
  doc.text(`Validity: ${validDate}`,PW-MARGIN-4,y+5,{align:"right"});
  y+=14;
  const addr=job.delivery_address||{};
  const colMid=MARGIN+CW*0.56, leftMaxW=colMid-MARGIN-4, sectionY=y;
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text("Customer Details:",MARGIN,y); y+=5;
  doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.setTextColor(...DARK);
  const nameLines=doc.splitTextToSize(job.customer_name||"—",leftMaxW);
  doc.text(nameLines,MARGIN,y); y+=nameLines.length*5;
  const addrParts=[addr.street,[addr.city,addr.state].filter(Boolean).join(", "),addr.pincode?`PIN: ${addr.pincode}`:"",addr.country||""].filter(Boolean);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...MID);
  addrParts.forEach((ln)=>{const wrapped=doc.splitTextToSize(ln,leftMaxW);doc.text(wrapped,MARGIN,y);y+=wrapped.length*4.5;});
  let rcy=sectionY;
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text("Place of Supply:",colMid,rcy); rcy+=5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...MID);
  doc.text(addr.state||"33-TAMIL NADU",colMid,rcy); rcy+=6;
  if(job.customer_phone){doc.setFont("helvetica","bold");doc.setTextColor(...DARK);doc.text("Phone:",colMid,rcy);doc.setFont("helvetica","normal");doc.setTextColor(...MID);doc.text(job.customer_phone,colMid+doc.getTextWidth("Phone:")+2,rcy);rcy+=5;}
  if(job.gst_no){doc.setFont("helvetica","bold");doc.setTextColor(...DARK);doc.text("GSTIN:",colMid,rcy);doc.setFont("helvetica","normal");doc.setTextColor(...MID);doc.text(job.gst_no,colMid+doc.getTextWidth("GSTIN:")+2,rcy);rcy+=5;}
  y=Math.max(y,rcy)+5; hr(y,LGRAY,0.3); y+=5;
  const tableRows=cartItems.map((it,i)=>{
    const desc=[it.product_name,it.variation,it.printing_type].filter(Boolean).join(" | ");
    const qty=isSqFtItem(it)?`${it.quantity} × ${parseFloat(it.sq_ft||0)} ft²`:String(it.quantity||1);
    return [i+1,desc||"—",`Rs. ${parseFloat(it.price||0).toFixed(2)}`,qty,`Rs. ${itemBase(it).toFixed(2)}`];
  });
  autoTable(doc,{startY:y,head:[["#","Item","Rate / Item","Qty","Amount"]],body:tableRows.length?tableRows:[["","No items","","",""]],theme:"grid",headStyles:{fillColor:[235,235,235],textColor:DARK,fontSize:8.5,fontStyle:"bold",halign:"center",valign:"middle",cellPadding:{top:4,bottom:4,left:3,right:3}},bodyStyles:{fontSize:8.5,textColor:DARK,cellPadding:{top:4,bottom:4,left:3,right:3},valign:"middle"},alternateRowStyles:{fillColor:BGLIGHT},columnStyles:{0:{cellWidth:10,halign:"center"},1:{cellWidth:78,halign:"left"},2:{cellWidth:32,halign:"right"},3:{cellWidth:26,halign:"center"},4:{cellWidth:36,halign:"right",fontStyle:"bold"}},margin:{left:MARGIN,right:MARGIN},tableLineColor:LGRAY,tableLineWidth:0.25});
  y=doc.lastAutoTable.finalY;
  const extraRows=[...(discountAmt>0?[{label:`Discount (${discountPct}%)`,value:`- Rs. ${discountAmt.toFixed(2)}`,green:true}]:[]),(designChg>0?{label:"Design Charges",value:`Rs. ${designChg.toFixed(2)}`}:null),(deliveryChg>0?{label:"Delivery Charges",value:`Rs. ${deliveryChg.toFixed(2)}`}:null),(job.free_delivery?{label:"Delivery Charges",value:"Free"}:null)].filter(Boolean);
  const totX=PW-MARGIN-90, totRX=PW-MARGIN;
  let ty=y+4;
  extraRows.forEach(({label,value,green})=>{doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(...(green?[0,140,60]:MID));doc.text(label,totX,ty);doc.setFont("helvetica",green?"bold":"normal");doc.setTextColor(...(green?[0,140,60]:DARK));doc.text(value,totRX,ty,{align:"right"});ty+=5.5;doc.setDrawColor(...LGRAY);doc.setLineWidth(0.2);doc.line(totX,ty-1,totRX,ty-1);});
  fillRect(MARGIN,ty,CW,10,[235,235,235],LGRAY);
  const totalQty=cartItems.reduce((s,it)=>s+parseFloat(it.quantity||1),0);
  doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(...MID);doc.text(`Total Items / Qty: ${cartItems.length} / ${totalQty}`,MARGIN+3,ty+6.5);
  doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...DARK);doc.text("Total",PW/2,ty+6.5,{align:"center"});
  doc.setFontSize(11);doc.setTextColor(...DARK);doc.text(`Rs. ${grandTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}`,PW-MARGIN-4,ty+6.5,{align:"right"});
  ty+=13;
  doc.setFontSize(7.5);doc.setFont("helvetica","italic");doc.setTextColor(...MID);
  const wordStr=`Total amount (in words): ${numberToWords(grandTotal)}`;
  const wordLines=doc.splitTextToSize(wordStr,CW);
  doc.text(wordLines,MARGIN,ty); ty+=wordLines.length*5+6; hr(ty,LGRAY,0.3); ty+=6;
  const footerY=PH-14; hr(footerY-4,LGRAY,0.25);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...MID);
  doc.text("Page 1 / 1   •   This is a computer generated document and requires no signature.",MARGIN,footerY+1);
  doc.setFontSize(6.5);doc.text("D-Media | Simple Invoicing, Billing and Payments | Visit www.dmedia.in",MARGIN,footerY+5.5);
  const pbX=PW-MARGIN-32;
  doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(0,0,0);doc.text("Powered By",pbX+14,footerY-0,{align:"center"});
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("D-Media",pbX+14,footerY+5,{align:"center"});
  return { blob: doc.output("blob"), filename: `Quotation_${job.job_no||"job"}.pdf` };
};

// ── Build Job Sheet PDF ───────────────────────────────────────────────────────
const buildJobSheetPDF = async (job) => {
  const doc = new jsPDF({ orientation:"portrait",unit:"mm",format:"a4" });
  const PW=210,PH=297,MARGIN=12,CW=PW-MARGIN*2;
  const DARK=[15,15,15],MID=[90,90,90],LGRAY=[200,200,200];
  const cartItems=job.cart_items||[];
  const grandTotal=parseFloat(job.total_amount||0);
  const addr=job.delivery_address||{};
  const invDate=job.order_date?dayjs(job.order_date).format("DD MMM YYYY"):dayjs().format("DD MMM YYYY");
  const estDate=job.estimated_delivery_date?dayjs(job.estimated_delivery_date).format("DD MMM YYYY"):"";
  const hr=(yy,color=LGRAY,lw=0.3)=>{doc.setDrawColor(...color);doc.setLineWidth(lw);doc.line(MARGIN,yy,PW-MARGIN,yy);};
  const txt=(text,x,y,opts={})=>{doc.text(String(text??""),x,y,opts);};
  const buildSizeString=(it)=>{
    const w=parseFloat(it.width||0),h=parseFloat(it.height||0),sqft=parseFloat(it.sq_ft||0),unit=(it.size_unit||"ft").trim();
    const isSqFt=it.quantity_type==="sq.ft"||sqft>0;
    if(w>0&&h>0){if(isSqFt&&sqft>0)return `${w} × ${h} ${unit}\n(${sqft} ft²)`;return `${w} × ${h} ${unit}`;}
    if(it.size&&String(it.size).trim())return String(it.size).trim();
    return "—";
  };
  let y=14;
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...MID);txt("Order Date :",MARGIN,y);
  doc.setFont("helvetica","bold");doc.setTextColor(...DARK);txt(invDate,MARGIN+doc.getTextWidth("Order Date :")+2,y);
  const orderNoX=PW/2-1;
  doc.setFont("helvetica","normal");doc.setTextColor(...MID);txt("Order No :",orderNoX,y);
  doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...DARK);txt(job.job_no||"—",orderNoX+doc.getTextWidth("Order No :")+1,y);
  const logoUrl=IMAGE_HELPER?.Dlogo||"https://www.dmedia.in/assets/images/edit_white_logo1.png";
  try{const logoB64=await getImageDataUri(logoUrl);doc.addImage(logoB64,"PNG",PW-MARGIN-44,y-10,48,14);}catch{}
  y+=8;hr(y,LGRAY);y+=5;
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...MID);txt("Customer Details :",MARGIN,y);
  doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...DARK);
  const displayName=job.company_name?.trim()?job.company_name.trim():job.customer_name||"—";
  txt([displayName,job.customer_phone].filter(Boolean).join("   |   "),MARGIN+doc.getTextWidth("Customer Details :")+2,y);
  y+=7;hr(y,LGRAY);y+=5;
  const deliveryLine=[addr.street,addr.city,addr.state,addr.pincode].filter(Boolean).join(", ");
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...MID);txt("Delivery to :",MARGIN,y);
  doc.setFont("helvetica","normal");doc.setTextColor(...DARK);
  const delivLines=doc.splitTextToSize(deliveryLine||"—",CW*0.7);
  txt(delivLines,MARGIN+doc.getTextWidth("Delivery to :")+3,y);
  const lineCount=Array.isArray(delivLines)?delivLines.length:1;
  const addressEndY=y+(lineCount-1)*4;
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...MID);txt("Est. Delivery on :",MARGIN,addressEndY+6);
  doc.setFont("helvetica","bold");doc.setTextColor(...DARK);txt(estDate||"—",MARGIN+doc.getTextWidth("Est. Delivery on :")+2,addressEndY+6);
  y=addressEndY+14;hr(y,LGRAY);y+=4;
  const isSqFtItem=(it)=>it.quantity_type==="sq.ft"||parseFloat(it.sq_ft)>0;
  const tableRows=cartItems.map((it,i)=>{
    const productDesc=[it.product_name,it.variation,it.printing_type].filter(Boolean).join("\n");
    const size=buildSizeString(it);
    const sqft=parseFloat(it.sq_ft||0);
    const qty=isSqFtItem(it)&&sqft>0?`${it.quantity} pcs\n${sqft} ft²`:String(it.quantity||1);
    const lineTotal=isSqFtItem(it)?(parseFloat(it.quantity)||0)*sqft*(parseFloat(it.price)||0):(parseFloat(it.quantity)||0)*(parseFloat(it.price)||0);
    return [i+1,productDesc||"—",size,qty,lineTotal.toFixed(2)];
  });
  autoTable(doc,{startY:y,head:[["S.No","Product","Size","Quantity","Amount"]],body:tableRows,theme:"grid",headStyles:{fillColor:[230,230,230],textColor:DARK,fontSize:8.5,fontStyle:"bold",halign:"center",valign:"middle",cellPadding:{top:3,bottom:3,left:2,right:2}},bodyStyles:{fontSize:8,textColor:DARK,cellPadding:{top:5,bottom:5,left:2,right:1},valign:"middle",minCellHeight:10},columnStyles:{0:{cellWidth:12,halign:"center"},1:{cellWidth:72,halign:"left"},2:{cellWidth:36,halign:"center"},3:{cellWidth:28,halign:"center"},4:{cellWidth:34,halign:"right",fontStyle:"bold",cellPadding:{right:2}}}});
  y=doc.lastAutoTable.finalY+4;
  const footerY=y+4;
  const labelText="Total Job Amount : ", amountText=`Rs. ${grandTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}`;
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  const labelWidth=doc.getTextWidth(labelText);
  doc.setFont("helvetica","bold");doc.setFontSize(10);
  const totalWidth=labelWidth+doc.getTextWidth(amountText);
  const rightX=MARGIN+CW-8, startX=rightX-totalWidth;
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...MID);txt(labelText,startX,footerY);
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...DARK);txt(amountText,startX+labelWidth,footerY);
  y=footerY+24;hr(y,LGRAY);
  doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...DARK);txt("JOB SHEET",PW-MARGIN-3,PH-14,{align:"right"});
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...MID);txt("Powered By D-Media  |  www.dmedia.in",MARGIN,PH-13);
  return { blob: doc.output("blob"), filename: `Job_sheet_${job.job_no||"job"}.pdf` };
};

// ─── Coupon Canvas Draw ────────────────────────────────────────────────────────
const drawVoucherCanvas = async (canvas, { job, couponCode, couponDiscount, discountType, couponValidity, applicableProduct }) => {
  if (!canvas || !job) return;
  const W = 960, H = 420;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const YELLOW      = "#f2c41a";
  const YELLOW_DARK = "#c99d08";
  const YELLOW_PALE = "#fef9e0";
  const BROWN_DARK  = "#000000";
  const BROWN_MID   = "#1a1a1a";
  const CREAM       = "#fff8e1";
  const WHITE       = "#FFFFFF";
  const splitX      = Math.round(W * 0.60);
  const lcx         = splitX / 2;
  const rcx         = splitX + (W - splitX) / 2;

  const rr = (x, y, w, h, rad, fill, stroke, lw = 1) => {
    ctx.beginPath();
    ctx.moveTo(x+rad,y); ctx.lineTo(x+w-rad,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+rad);
    ctx.lineTo(x+w,y+h-rad);
    ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
    ctx.lineTo(x+rad,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-rad);
    ctx.lineTo(x,y+rad);
    ctx.quadraticCurveTo(x,y,x+rad,y);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
  };

  // Outer clip
  rr(0,0,W,H,22,null,null);
  ctx.save(); ctx.clip();

  // LEFT: yellow → dark yellow gradient
  const lgrd = ctx.createLinearGradient(0,0,splitX,H);
  lgrd.addColorStop(0, YELLOW);
  lgrd.addColorStop(0.6, "#e8b010");
  lgrd.addColorStop(1, YELLOW_DARK);
  ctx.fillStyle = lgrd;
  ctx.fillRect(0,0,splitX,H);

  // Diagonal stripe texture
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 14;
  for(let i=-H;i<W+H;i+=38){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+H,H);ctx.stroke();}
  ctx.globalAlpha = 1;
  ctx.restore();

  // Vignette
  const lgl = ctx.createRadialGradient(0,0,10,0,0,splitX*0.85);
  lgl.addColorStop(0,"rgba(255,255,255,0.10)");
  lgl.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = lgl; ctx.fillRect(0,0,splitX,H);

  // RIGHT: deep black
  const rgrd = ctx.createLinearGradient(splitX,0,W,H);
  rgrd.addColorStop(0, BROWN_DARK);
  rgrd.addColorStop(1, BROWN_MID);
  ctx.fillStyle = rgrd;
  ctx.fillRect(splitX,0,W-splitX,H);

  // Stripe texture on right
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 10;
  for(let i=-H;i<W+H;i+=32){ctx.beginPath();ctx.moveTo(splitX+i,0);ctx.lineTo(splitX+i+H,H);ctx.stroke();}
  ctx.globalAlpha = 1;
  ctx.restore();

  // Yellow accent strip on black panel left edge
  ctx.fillStyle = YELLOW_DARK;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(splitX, 0, 3, H);
  ctx.globalAlpha = 1;

  ctx.restore();

  // Perforation notches
  ctx.fillStyle = CREAM;
  ctx.beginPath(); ctx.arc(splitX,0,20,0,Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(splitX,H,20,Math.PI,2*Math.PI); ctx.fill();

  ctx.save();
  ctx.setLineDash([10,8]);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(splitX,24); ctx.lineTo(splitX,H-24); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ═══ LEFT PANEL ═══════════════════════════════════════════════════════════

  // ── TOP HEADER ROW: black badge (left) + printe.in logo (right), same Y ──
  const headerY = 16;   // top of header row
  const headerH = 44;   // height of header row

  // 1) Black badge — D-MEDIA | EXCLUSIVE VOUCHER (top-left)
  const bW = 240, bH = 34, bX = 22, bY = headerY + (headerH - 34) / 2;
  rr(bX, bY, bW, bH, 8, BROWN_DARK, BROWN_MID, 1.5);
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = YELLOW;
  ctx.fillText("D-MEDIA", bX + 14, bY + bH / 2);
  const brandWidth = ctx.measureText("D-MEDIA").width;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 10px Arial, sans-serif";
  ctx.fillText("EXCLUSIVE VOUCHER", bX + 14 + brandWidth + 18, bY + bH / 2);

  // 2) printe.in logo — same row, right-aligned inside the left panel
  const LOGO_URL = "https://www.printe.in/assets/without_bg-B7FPZzwZ.png";
  const logoW = 130, logoH = 44;
  // Place logo flush right of the left panel with a small margin
  const logoX = splitX - logoW - 18;
  const logoY = headerY + (headerH - logoH) / 2;

  try {
    const logoImg = await new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = LOGO_URL;
    });
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  } catch {
    // Fallback: skip logo silently
  }

  // ── Rest of left panel ──

  // Tagline
  ctx.fillStyle = BROWN_DARK;
  ctx.font = "700 12px Arial, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("SPECIAL  OFFER", lcx, 104);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = BROWN_DARK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(lcx-90,110); ctx.lineTo(lcx+90,110); ctx.stroke();

  // Watermark ghost
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = BROWN_DARK;
  ctx.font = "bold 160px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(discountType==="fixed"?"₹":"%", lcx, 200);
  ctx.globalAlpha = 1;

  // Big discount value
  const discDisplay = discountType==="fixed" ? `₹${couponDiscount}` : `${couponDiscount}%`;
  ctx.fillStyle = BROWN_DARK;
  ctx.font = "bold 92px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(discDisplay, lcx, 228);

  // OFF label
  ctx.fillStyle = BROWN_MID;
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(discountType==="fixed"?"FLAT OFF":"OFF", lcx, 262);

  // Coupon code box
  const cbW=318, cbH=56, cbX=lcx-cbW/2, cbY=282;
  rr(cbX,cbY,cbW,cbH,10,BROWN_DARK,YELLOW_DARK,2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 9px Arial, sans-serif";
  ctx.letterSpacing = "2.5px";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("PROMO CODE", lcx, cbY+16);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = YELLOW;
  ctx.font = `bold 21px "Courier New", Courier, monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(couponCode||"Click Generate below", lcx, cbY+39);

  // Applicable product badge (if set)
  if(applicableProduct){
    const prod = APPLICABLE_PRODUCTS.find(p=>p.value===applicableProduct);
    if(prod){
      rr(lcx-60,cbY+cbH+8,120,24,6,"rgba(0,0,0,0.85)",YELLOW_DARK,1);
      ctx.fillStyle = YELLOW_PALE;
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`Product: ${prod.label}`, lcx, cbY+cbH+20);
    }
  }

  // Website footer
  ctx.fillStyle = "rgba(0,0,0,0.50)";
  ctx.font = "12px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("https://printe.in", lcx, H-16);

  // ═══ RIGHT PANEL ═══════════════════════════════════════════════════════════
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(rcx-80,38); ctx.lineTo(rcx+80,38); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = YELLOW;
  ctx.font = "700 10px Arial, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("YOUR", rcx, 62);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = WHITE;
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DISCOUNT", rcx, 96);

  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rcx-90,108); ctx.lineTo(rcx+90,108); ctx.stroke();

  ctx.fillStyle = YELLOW;
  ctx.font = "bold 78px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(discDisplay, rcx, 216);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(discountType==="fixed"?"FLAT OFF":"OFF", rcx, 248);

  ctx.strokeStyle = YELLOW; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.moveTo(rcx-90,264); ctx.lineTo(rcx+90,264); ctx.stroke();
  ctx.globalAlpha = 1;

  // Customer details
  const dy=282, lh=23;
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = "10px Arial, sans-serif"; ctx.letterSpacing = "2px";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("FOR CUSTOMER", rcx, dy); ctx.letterSpacing = "0px";

  ctx.fillStyle = WHITE;
  ctx.font = "bold 15px Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText((job.customer_name||"Valued Customer").slice(0,20), rcx, dy+lh);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "11px Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`Valid for ${couponValidity} days from issue`, rcx, dy+lh*2+2);

  ctx.fillStyle = YELLOW_PALE;
  ctx.font = `bold 11px "Courier New", Courier, monospace`; ctx.textAlign = "center";
  ctx.fillText(`REF: ${job.job_no||"—"}`, rcx, dy+lh*3+4);

  // Barcode
  const bcy=H-44, bsx=rcx-52;
  const barData=[4,2,6,2,3,2,5,2,4,2,3,2,5,2,4,2,3];
  let bx2=bsx;
  barData.forEach((bw,i)=>{
    if(i%2===0){ctx.fillStyle="rgba(255,255,255,0.22)";ctx.fillRect(bx2,bcy,bw,22);}
    bx2+=bw+2;
  });

  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.font = "9px Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("*Terms & conditions apply", rcx, H-12);

  ctx.strokeStyle = YELLOW; ctx.lineWidth = 1; ctx.globalAlpha = 0.30;
  ctx.beginPath(); ctx.moveTo(rcx-80,H-26); ctx.lineTo(rcx+80,H-26); ctx.stroke();
  ctx.globalAlpha = 1;
};

// ─── Job Status Config ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:         { label:"Draft",         color:"default",  icon:<FileTextOutlined /> },
  sent:          { label:"Sent",          color:"blue",     icon:<SendOutlined /> },
  viewed:        { label:"Viewed",        color:"cyan",     icon:<EyeOutlined /> },
  accepted:      { label:"Accepted",      color:"green",    icon:<CheckCircleOutlined /> },
  design:        { label:"Design",        color:"blue",     icon:<FileTextOutlined /> },
  in_progress:   { label:"In Progress",   color:"gold",     icon:<PlayCircleOutlined /> },
  on_hold:       { label:"On Hold",       color:"orange",   icon:<PauseCircleOutlined /> },
  rejected:      { label:"Rejected",      color:"red",      icon:<CloseCircleOutlined /> },
  expired:       { label:"Expired",       color:"volcano",  icon:<ClockCircleOutlined /> },
  completed:     { label:"Completed",     color:"purple",   icon:<CheckCircleOutlined /> },
  converted:     { label:"Converted",     color:"geekblue", icon:<SwapOutlined /> },
  quality_check: { label:"Quality Check", color:"magenta",  icon:<SafetyCertificateOutlined /> },
  production:    { label:"Production",    color:"lime",     icon:<PlayCircleOutlined /> },
};

const WORKFLOW_STAGES = [
  {value:"design",label:"Design"},{value:"prepress",label:"Prepress"},
  {value:"printing",label:"Printing"},{value:"finishing",label:"Finishing"},
  {value:"quality_check",label:"Quality Check"},{value:"dispatch",label:"Dispatch"},
  {value:"delivered",label:"Delivered"},{value:"delivery",label:"Delivery"},
  {value:"custom",label:"Custom"},
];

const INFO_STATUS_CFG = {
  pending:  {color:"#d97706",bg:"#fffbeb",border:"#fcd34d",label:"Pending",  icon:<HourglassOutlined />},
  approved: {color:"#16a34a",bg:"#f0fdf4",border:"#86efac",label:"Approved", icon:<UnlockOutlined />},
  rejected: {color:"#ef4444",bg:"#fef2f2",border:"#fca5a5",label:"Rejected", icon:<CloseCircleOutlined />},
};

// ─── Shared Sub-components ────────────────────────────────────────────────────
const StatusTag = ({ status, style }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight:500, ...style }}>{cfg.label}</Tag>;
};

const StageTag = ({ stage }) => {
  const label = WORKFLOW_STAGES.find(s=>s.value===stage)?.label;
  if(!stage||!label) return <span style={{color:THEME.textMuted,fontSize:12}}>—</span>;
  return <Tag color="geekblue" icon={<BranchesOutlined />} style={{fontSize:11}}>{label}</Tag>;
};

const SectionDivider = ({ icon, title }) => (
  <div style={{display:"flex",alignItems:"center",gap:6,margin:"4px 0 10px"}}>
    <span style={{color:THEME.primary,fontSize:13}}>{icon}</span>
    <span style={{fontSize:10,fontWeight:700,color:THEME.textPrimary,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>
    <div style={{flex:1,height:1,background:THEME.border,marginLeft:4}} />
  </div>
);

const InfoStatusBadge = ({ status }) => {
  const cfg = INFO_STATUS_CFG[status] || INFO_STATUS_CFG.pending;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:12,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color,fontSize:11,fontWeight:700}}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── PDF Share Modal ──────────────────────────────────────────────────────────
const PdfShareModal = ({ open, onClose, job, type = "jobsheet", couponStoreRef }) => {
  const [generating, setGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [filename, setFilename] = useState("");
  const [blobRef, setBlobRef] = useState(null);
  const [copyDone, setCopyDone] = useState(false);

  // Coupon state
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
const [couponDiscount, setCouponDiscount] = useState("400");
const [discountType, setDiscountType] = useState("fixed");
const [couponValidity, setCouponValidity] = useState("6");
  const [applicableProduct, setApplicableProduct] = useState(APPLICABLE_PRODUCTS[0].value);
  const [couponGenerated, setCouponGenerated] = useState(false);
  const [couponSending, setCouponSending] = useState(false);
  const [couponSent, setCouponSent] = useState(false);
  const [couponError, setCouponError] = useState("");
  const couponCanvasRef = useRef(null);

  const isQuotation = type === "quotation";
  const accentColor = isQuotation ? "#1e40af" : "#0f766e";
  const accentGrad  = isQuotation ? "linear-gradient(135deg,#1e40af,#3b82f6)" : "linear-gradient(135deg,#0f766e,#14b8a6)";
  const bgReady     = isQuotation ? "#eff6ff" : "#f0fdfa";
  const borderReady = isQuotation ? "#93c5fd" : "#99f6e4";
  const titleLabel  = isQuotation ? "Quotation" : "Job Sheet";
  const titleIcon   = isQuotation
    ? <FileTextOutlined style={{color:accentColor,fontSize:16}} />
    : <PrinterOutlined style={{color:accentColor,fontSize:16}} />;

  useEffect(() => {
    if (!open || !job) return;
    const jobKey = job._id || job.job_no;
    const stored = couponStoreRef?.current?.get(jobKey);
    if (stored) {
      setCouponCode(stored.code);
      setCouponDiscount(stored.discount);
      setDiscountType(stored.discountType);
      setCouponValidity(stored.validity);
      setApplicableProduct(stored.applicableProduct || APPLICABLE_PRODUCTS[0].value);
      setCouponGenerated(true);
    } else {
      setCouponCode("");
     setCouponDiscount("400");
setDiscountType("fixed");
setCouponValidity("6");
      setApplicableProduct(APPLICABLE_PRODUCTS[0].value);
      setCouponGenerated(false);
    }
    setShowCoupon(false);
    setCouponSent(false);
    setCouponError("");
  }, [open, job]);

  useEffect(() => {
    if (!open || !job) return;
    let cancelled = false;
    setPdfReady(false); setBlobUrl(null); setGenerating(true);
    const builder = isQuotation ? buildInvoicePDF : buildJobSheetPDF;
    builder(job)
      .then(({ blob, filename: fn }) => {
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob)); setFilename(fn); setBlobRef(blob); setPdfReady(true);
      })
      .catch(err => { if (!cancelled) message.error("PDF generation failed: " + err.message); })
      .finally(() => { if (!cancelled) setGenerating(false); });
    return () => { cancelled = true; };
  }, [open, job, type]);

  useEffect(() => {
    if (!open && blobUrl) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setBlobUrl(null); setPdfReady(false);
    }
  }, [open]);

  // Redraw canvas — handles async drawVoucherCanvas
  const redrawCanvas = useCallback(() => {
    drawVoucherCanvas(couponCanvasRef.current, { job, couponCode, couponDiscount, discountType, couponValidity, applicableProduct })
      .catch(err => console.warn("Canvas draw error:", err));
  }, [job, couponCode, couponDiscount, discountType, couponValidity, applicableProduct]);

  useEffect(() => {
    if (showCoupon) setTimeout(redrawCanvas, 60);
  }, [showCoupon, couponCode, couponDiscount, discountType, couponValidity, applicableProduct, redrawCanvas]);

  useEffect(() => {
    if (showCoupon && couponGenerated) setTimeout(redrawCanvas, 60);
  }, [couponGenerated]);

  const persistCoupon = (code, discount, dType, validity, product) => {
    if (!couponStoreRef || !job) return;
    const jobKey = job._id || job.job_no;
    const entry = { code, discount, discountType: dType, validity, applicableProduct: product };
    couponStoreRef.current.set(jobKey, entry);
    saveCouponStoreToLS(couponStoreRef.current);
  };

  const handleGenerateCoupon = () => {
    const newCode = `WOOD-${nextAlphaSuffix(4)}`;
    setCouponCode(newCode);
    setCouponGenerated(true);
    setCouponSent(false);
    setCouponError("");
    persistCoupon(newCode, couponDiscount, discountType, couponValidity, applicableProduct);
  };

  const invalidateCoupon = () => {
    setCouponGenerated(false);
    setCouponCode("");
    setCouponError("");
    if (couponStoreRef && job) {
      const jobKey = job._id || job.job_no;
      couponStoreRef.current.delete(jobKey);
      saveCouponStoreToLS(couponStoreRef.current);
    }
  };

  const buildCouponPayload = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const endDate = dayjs().add(parseInt(couponValidity, 10), "day").format("YYYY-MM-DD");
    const discVal = parseFloat(couponDiscount) || 0;
    return {
      code: couponCode,
      jobNo: job?.job_no || "",
      discountType: discountType === "fixed" ? "fixed" : "percentage",
      Customer_discountValue: discVal,
      Corporate_discountValue: 0,
      Dealer_discountValue: 0,
      applicableProducts: applicableProduct ? [applicableProduct] : [],
      isActive: true,
      singleUse: true,
      usageLimit: 1,
      minimumOrderAmount: 0,
      startDate: today,
      endDate: endDate,
    };
  };

  const handleSendCoupon = async () => {
    if (!job) return;
    setCouponSending(true); setCouponError("");
    try {
      const payload = buildCouponPayload();
      const res = await fetch("https://api.printe.in/api/coupen", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `API error ${res.status}`);
      }

      const canvas = couponCanvasRef.current;
      if (canvas) {
        try {
          const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
          const imgUrl = URL.createObjectURL(imageBlob);
          const a = document.createElement("a");
          a.href = imgUrl; a.download = `Coupon_${job.job_no||"dmedia"}.png`; a.click();
          setTimeout(() => URL.revokeObjectURL(imgUrl), 2000);
        } catch(imgErr) { console.warn("Coupon image download failed:", imgErr); }
      }

      const prodEntry = APPLICABLE_PRODUCTS.find(p => p.value === applicableProduct);
      const productLink = prodEntry?.link || "https://printe.in";
      const phone = (job.customer_phone || "").replace(/\D/g, "");
      const discAmountLabel = discountType === "fixed" ? `Rs.${couponDiscount}/-` : `${couponDiscount}%`;

      const waText = encodeURIComponent(
        `❤️ A Little Gift of Love from D Media!\n\n` +
        `Thank you for choosing us and allowing us to be a part of your special memories.\n\n` +
        `As a token of our appreciation, we've created a special discount code exclusively for you.\n\n` +
        `🎁 Flat for SP : ${discAmountLabel}\n` +
        `🏷️ Coupon Code: ${couponCode}\n\n` +
        `✨ This coupon is specially generated for you. Kindly do not share it with others, as it is intended for your personal use only.\n\n` +
        `Turn your precious moments into timeless keepsakes and celebrate the people you love.\n\n` +
        `📞 For redemption or any assistance, contact us on:\n` +
        `📱 73736 10000\n\n` +
        `Valid for one-time use only. Terms & Conditions apply.\n` +
        `${productLink}`
      );
      const waUrl = phone ? `https://wa.me/91${phone}?text=${waText}` : `https://wa.me/?text=${waText}`;
      window.open(waUrl, "_blank");

      setCouponSent(true);
      message.success(`Coupon ${couponCode} created & sent to ${job.customer_phone || "customer"} via WhatsApp!`);
      setTimeout(() => setCouponSent(false), 4000);
    } catch(err) {
      const msg = err.message || "Failed to send coupon";
      setCouponError(msg); message.error(msg);
    } finally { setCouponSending(false); }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a"); a.href = blobUrl; a.download = filename; a.click();
  };

  const handleWhatsApp = () => {
    if (!job) return;
    const phone = (job.customer_phone||"").replace(/\D/g,"");
    const jobNo = job.job_no||"—", name = job.customer_name||"Customer";
    const total = parseFloat(job.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2});
    const estDate = job.estimated_delivery_date?dayjs(job.estimated_delivery_date).format("DD MMM YYYY"):"—";
    const text = isQuotation
      ? encodeURIComponent(`Hello ${name},\n\nYour Quotation from D-Media:\n\n📋 Quotation No: ${jobNo}\n💰 Total: ₹${total}\n📅 Valid Until: ${estDate}\n\nPlease find the PDF quotation attached.\n\nThank you!\nD-Media Team\nwww.dmedia.in`)
      : encodeURIComponent(`Hello ${name},\n\nYour Job Sheet from D-Media:\n\n📋 Job No: ${jobNo}\n💰 Total: ₹${total}\n📅 Est. Delivery: ${estDate}\n\nPlease download your job sheet PDF attached.\n\nThank you!\nD-Media Team\nwww.dmedia.in`);
    window.open(phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
    if (pdfReady) setTimeout(handleDownload, 500);
  };

  const handleEmail = () => {
    if (!job) return;
    const name = job.customer_name||"Customer", jobNo = job.job_no||"—";
    const total = parseFloat(job.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2});
    const estDate = job.estimated_delivery_date?dayjs(job.estimated_delivery_date).format("DD MMM YYYY"):"—";
    const subject = isQuotation ? encodeURIComponent(`Quotation – ${jobNo} | D-Media`) : encodeURIComponent(`Job Sheet – ${jobNo} | D-Media`);
    const body = isQuotation
      ? encodeURIComponent(`Hello ${name},\n\nQuotation No : ${jobNo}\nTotal        : ₹${total}\nValid Until  : ${estDate}\n\nThank you,\nD-Media Team\nwww.dmedia.in`)
      : encodeURIComponent(`Hello ${name},\n\nJob No    : ${jobNo}\nTotal     : ₹${total}\nEst. Date : ${estDate}\n\nThank you,\nD-Media Team\nwww.dmedia.in`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    if (pdfReady) setTimeout(handleDownload, 500);
  };

  const handleNativeShare = async () => {
    if (!pdfReady||!blobRef) { message.warning("PDF is still generating…"); return; }
    try {
      const file = new File([blobRef], filename, {type:"application/pdf"});
      if (navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})) {
        await navigator.share({title:`${titleLabel} – ${job?.job_no||""}`,files:[file]});
      } else { handleDownload(); message.info("Direct sharing not supported — PDF downloaded instead."); }
    } catch(err) { if(err.name!=="AbortError") message.error("Share failed: "+err.message); }
  };

  const handleCopyJobInfo = () => {
    if (!job) return;
    const jobNo=job.job_no||"—", name=job.customer_name||"—", phone=job.customer_phone||"—";
    const total=parseFloat(job.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2});
    const estDate=job.estimated_delivery_date?dayjs(job.estimated_delivery_date).format("DD MMM YYYY"):"—";
    const text = isQuotation
      ? `Quotation No: ${jobNo}\nCustomer: ${name}\nPhone: ${phone}\nTotal: ₹${total}\nValid Until: ${estDate}`
      : `Job No: ${jobNo}\nCustomer: ${name}\nPhone: ${phone}\nTotal: ₹${total}\nEst. Delivery: ${estDate}`;
    navigator.clipboard.writeText(text).then(()=>{setCopyDone(true);setTimeout(()=>setCopyDone(false),2000);});
  };

  const shareOptions = [
    {key:"whatsapp",icon:<WhatsAppOutlined style={{fontSize:20}}/>,label:"WhatsApp",sub:"Send to customer",bg:"linear-gradient(135deg,#128C7E,#25D366)",onClick:handleWhatsApp},
    {key:"email",icon:<MailOutlined style={{fontSize:20}}/>,label:"Email",sub:"Open mail client",bg:"linear-gradient(135deg,#1e6fdc,#3b82f6)",onClick:handleEmail},
    {key:"share",icon:<ShareAltOutlined style={{fontSize:20}}/>,label:"Share",sub:"System share",bg:"linear-gradient(135deg,#7c3aed,#a855f7)",onClick:handleNativeShare},
    {key:"download",icon:<DownloadOutlined style={{fontSize:20}}/>,label:"Download",sub:"Save PDF",bg:isQuotation?"linear-gradient(135deg,#1e40af,#3b82f6)":"linear-gradient(135deg,#0f766e,#14b8a6)",onClick:handleDownload,disabled:!pdfReady},
    {key:"copy",icon:copyDone?<CheckCircleOutlined style={{fontSize:20}}/>:<CopyOutlined style={{fontSize:20}}/>,label:copyDone?"Copied!":"Copy Info",sub:"Copy details",bg:copyDone?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#475569,#64748b)",onClick:handleCopyJobInfo},
    {key:"coupon",icon:<GiftOutlined style={{fontSize:20}}/>,label:showCoupon?"Hide":"Coupon",sub:couponGenerated?"Code ready ✓":"Send offer code",bg:showCoupon?"linear-gradient(135deg,#1a1a1a,#c99d08)":"linear-gradient(135deg,#a07800,#f2c41a)",onClick:()=>{setShowCoupon(v=>!v);setCouponSent(false);setCouponError("");},isCoupon:true},
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={520} destroyOnClose
      title={
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {titleIcon}
          <span style={{fontWeight:700,color:THEME.textPrimary}}>{titleLabel}</span>
          {job && <Tag style={{fontFamily:"monospace",fontWeight:700,fontSize:11,background:isQuotation?"#eff6ff":"#f0fdfa",borderColor:isQuotation?"#93c5fd":"#99f6e4",color:accentColor}}>{job.job_no}</Tag>}
        </div>
      }
    >
      {/* PDF status bar */}
      <div style={{background:generating?"#f8fafc":bgReady,border:`1px solid ${generating?"#e5e7eb":borderReady}`,borderRadius:12,padding:"14px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
        {generating ? (
          <><Spin size="small"/><div><div style={{fontWeight:700,fontSize:13,color:THEME.textPrimary}}>Generating PDF…</div><div style={{fontSize:11,color:THEME.textMuted}}>Please wait</div></div></>
        ) : pdfReady ? (
          <>
            <div style={{width:38,height:38,borderRadius:10,background:accentGrad,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {isQuotation?<FileTextOutlined style={{color:"#fff",fontSize:18}}/>:<PrinterOutlined style={{color:"#fff",fontSize:18}}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,color:accentColor}}>PDF Ready</div>
              <div style={{fontSize:11,color:THEME.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{filename}</div>
            </div>
            <a href={blobUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:THEME.primary,fontWeight:600,whiteSpace:"nowrap"}}>Preview ↗</a>
          </>
        ) : (
          <div style={{color:THEME.danger,fontSize:13}}>Failed to generate PDF.</div>
        )}
      </div>

      {/* Customer summary */}
      {job && (
        <div style={{background:THEME.primaryLight,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"10px 14px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:THEME.textPrimary}}>{job.customer_name||"—"}</div>
            <div style={{fontSize:11,color:THEME.textSecondary}}>{job.customer_phone||""}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:15,color:THEME.primary}}>₹{parseFloat(job.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2})}</div>
            {job.estimated_delivery_date && <div style={{fontSize:11,color:THEME.textMuted}}>{isQuotation?"Valid: ":"Est. "}{dayjs(job.estimated_delivery_date).format("DD MMM YYYY")}</div>}
          </div>
        </div>
      )}

      {/* Share / Download buttons */}
      <div style={{marginBottom:6}}>
        <div style={{fontSize:11,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Share or Download</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
          {shareOptions.map(opt => (
            <button key={opt.key} onClick={opt.onClick} disabled={opt.disabled}
              style={{background:opt.disabled?"#f1f5f9":opt.bg,border:opt.isCoupon&&showCoupon?"2px solid #f2c41a":opt.isCoupon&&couponGenerated?"2px solid #c99d08":"none",borderRadius:12,padding:"12px 4px 10px",cursor:opt.disabled?"not-allowed":"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,opacity:opt.disabled?0.5:1,transition:"transform 0.15s, box-shadow 0.15s",boxShadow:opt.isCoupon&&showCoupon?"0 0 0 3px rgba(242,196,26,0.35), 0 2px 8px rgba(0,0,0,0.12)":"0 2px 8px rgba(0,0,0,0.12)",position:"relative"}}
              onMouseEnter={e=>{if(!opt.disabled){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.18)";}}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=opt.isCoupon&&showCoupon?"0 0 0 3px rgba(242,196,26,0.35), 0 2px 8px rgba(0,0,0,0.12)":"0 2px 8px rgba(0,0,0,0.12)";}}
            >
              {opt.isCoupon && couponGenerated && (
                <span style={{position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:"#22c55e",border:"1.5px solid #fff"}}/>
              )}
              <span style={{color:opt.disabled?THEME.textMuted:"#fff"}}>{opt.icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:opt.disabled?THEME.textMuted:"#fff",textAlign:"center",lineHeight:1.2}}>{opt.label}</span>
              <span style={{fontSize:9,color:opt.disabled?THEME.textMuted:"rgba(255,255,255,0.8)",textAlign:"center",lineHeight:1.2}}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Coupon Panel */}
      {showCoupon && job && (
        <div style={{marginTop:16,background:C.YELLOW_PALE,border:`2px solid ${C.YELLOW}`,borderRadius:14,padding:"16px 16px 14px",boxShadow:`0 4px 20px rgba(242,196,26,0.25)`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:32,height:32,borderRadius:8,background:C.YELLOW,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <GiftOutlined style={{color:C.BROWN_DARK,fontSize:15}}/>
            </div>
            <span style={{fontWeight:700,fontSize:13,color:C.BROWN_DARK}}>
              Coupon for {job.customer_name||"Customer"}
            </span>
            {couponGenerated && (
              <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:4,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"2px 8px",fontSize:11,color:"#16a34a",fontWeight:700}}>
                <CheckCircleOutlined style={{fontSize:10}}/> Code Ready
              </span>
            )}
            {job.customer_phone && !couponGenerated && (
              <Tag style={{fontFamily:"monospace",fontSize:11,marginLeft:"auto",background:C.YELLOW,borderColor:C.YELLOW_DARK,color:C.BROWN_DARK,fontWeight:700}}>
                {job.customer_phone}
              </Tag>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1.4fr 1.3fr 0.9fr 0.9fr 1.1fr",gap:10,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.BROWN_MID,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Coupon Code</div>
              <div style={{fontFamily:"monospace",fontWeight:700,fontSize:12,letterSpacing:"0.06em",background:couponGenerated?"rgba(242,196,26,0.22)":"#f5f5f5",border:`1px solid ${couponGenerated?C.YELLOW_DARK:"#d9d9d9"}`,borderRadius:6,padding:"5px 10px",color:couponGenerated?C.BROWN_DARK:"#aaa",userSelect:"all",cursor:"default",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:"22px",minHeight:32,display:"flex",alignItems:"center"}} title={couponCode}>
                {couponCode||"—"}
              </div>
              <div style={{fontSize:9,color:C.BROWN_LT,marginTop:3}}>{couponGenerated?"Ready · Re-generate to change":"Click Generate to create"}</div>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.BROWN_MID,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Discount Type</div>
              <Select value={discountType} onChange={v=>{setDiscountType(v);setCouponDiscount("10");invalidateCoupon();}} size="small" style={{width:"100%"}}>
                <Option value="percentage">Percentage (%)</Option>
                <Option value="fixed">Fixed Amount (₹)</Option>
              </Select>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.BROWN_MID,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{discountType==="fixed"?"Amount ₹":"Percent %"}</div>
              {discountType==="percentage" ? (
                <Select value={couponDiscount} onChange={v=>{setCouponDiscount(v);invalidateCoupon();}} size="small" style={{width:"100%"}}>
                  {["5","10","15","20","25"].map(v=><Option key={v} value={v}>{v}%</Option>)}
                </Select>
              ) : (
                <Input value={couponDiscount} onChange={e=>{setCouponDiscount(e.target.value.replace(/[^\d.]/g,""));invalidateCoupon();}} size="small" placeholder="100" prefix="₹" style={{borderColor:C.YELLOW}}/>
              )}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.BROWN_MID,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Valid (days)</div>
              <Select value={couponValidity} onChange={v=>{setCouponValidity(v);invalidateCoupon();}} size="small" style={{width:"100%"}}>
               {["6","7","14","30","60","90"].map(v=><Option key={v} value={v}>{v}d</Option>)}

              </Select>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.BROWN_MID,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Product</div>
              <Select value={applicableProduct} onChange={v=>{setApplicableProduct(v);invalidateCoupon();}} size="small" style={{width:"100%"}}>
                {APPLICABLE_PRODUCTS.map(p=><Option key={p.value} value={p.value}>{p.label}</Option>)}
              </Select>
            </div>
          </div>

          <div style={{borderRadius:12,overflow:"hidden",marginBottom:14,border:`2px solid ${C.YELLOW_DARK}`,boxShadow:"0 4px 16px rgba(0,0,0,0.12)"}}>
            <canvas ref={couponCanvasRef} style={{width:"100%",display:"block"}}/>
          </div>

          <button onClick={handleGenerateCoupon}
            style={{width:"100%",padding:"11px",background:`linear-gradient(135deg,${C.YELLOW_DARK},${C.YELLOW})`,border:"none",borderRadius:10,color:C.BROWN_DARK,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10,boxShadow:"0 2px 8px rgba(199,157,8,0.40)",transition:"all 0.15s"}}
          >
            <KeyOutlined style={{fontSize:15}}/>
            {couponGenerated?"Re-generate Code":"Generate Coupon"}
          </button>

          {couponGenerated && (
            <>
              <button onClick={handleSendCoupon} disabled={couponSending||!job.customer_phone}
                style={{width:"100%",padding:"12px",background:couponSent?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#128C7E,#25D366)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:couponSending||!job.customer_phone?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:!job.customer_phone?0.6:1,transition:"all 0.15s",marginBottom:couponError?8:0}}
              >
                {couponSent ? (
                  <><CheckCircleOutlined style={{fontSize:18}}/>Coupon Sent! Check WhatsApp</>
                ) : couponSending ? (
                  <><Spin size="small"/>Creating & Sending…</>
                ) : (
                  <><WhatsAppOutlined style={{fontSize:18}}/>Send Coupon to {job.customer_phone||"customer"}</>
                )}
              </button>
              {couponError && <div style={{padding:"8px 12px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,fontSize:12,color:"#dc2626",marginTop:8}}>⚠️ {couponError}</div>}
            </>
          )}

          {!job.customer_phone && (
            <div style={{marginTop:8,fontSize:11,color:C.BROWN_MID,textAlign:"center"}}>⚠️ No phone number found — coupon cannot be sent via WhatsApp.</div>
          )}

          <div style={{marginTop:10,fontSize:11,color:C.BROWN_MID,background:"rgba(242,196,26,0.18)",borderRadius:6,padding:"6px 10px",border:"1px solid rgba(242,196,26,0.45)"}}>
            💡 Click <strong>Generate Coupon</strong> to get a unique code, then send to the customer via WhatsApp.
          </div>
        </div>
      )}

      <div style={{marginTop:14,fontSize:11,color:THEME.textMuted,background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:"1px solid #e5e7eb"}}>
        💡 <strong>Tip:</strong> For WhatsApp & Email, the PDF is downloaded automatically so you can attach it manually.
      </div>
    </Modal>
  );
};

// ─── Job Detail View ──────────────────────────────────────────────────────────
const JobDetailView = ({ job, isMobile, onOpenJobSheetShare, onOpenQuotationShare, isQuotationAuthorized }) => {
  if (!job) return null;
  const addr = job.delivery_address || {};
  const fullAddress = [addr.street,addr.city,addr.state,addr.pincode,addr.country].filter(Boolean).join(", ");
  const showQuotationBtn = isQuotationAuthorized && job.job_status === "design";
  const grid2 = {display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:"4px 16px",marginBottom:12};
  const grid4 = {display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"4px 16px",marginBottom:12};

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#f0fdfa,#e0f2fe)",border:"1px solid #99f6e4",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#0f766e,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <PrinterOutlined style={{color:"#fff",fontSize:16}}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"#0f766e"}}>Job Documents</div>
            <div style={{fontSize:11,color:"#475569"}}>Download, share via WhatsApp or Email</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {showQuotationBtn && <Button icon={<FileTextOutlined/>} onClick={onOpenQuotationShare} style={{background:"#1e40af",borderColor:"#1e40af",color:"#fff",borderRadius:8,fontWeight:700,height:36,paddingInline:18}}>Quotation</Button>}
          <Button type="primary" icon={<ShareAltOutlined/>} onClick={onOpenJobSheetShare} style={{background:"#0f766e",borderColor:"#0f766e",borderRadius:8,fontWeight:700,height:36,paddingInline:18}}>Job Sheet</Button>
        </div>
      </div>

      <SectionDivider icon={<UserOutlined/>} title="Customer Info"/>
      <div style={grid2}>
        {[
          {label:"Name",value:job.customer_name},
          {label:"Company Name",value:job.company_name,icon:job.company_name?<ShopOutlined style={{color:THEME.primary,fontSize:12,flexShrink:0}}/>:null},
          {label:"Phone",value:job.customer_phone},
          {label:"Est. Delivery",value:job.estimated_delivery_date?dayjs(job.estimated_delivery_date).format("DD MMM YYYY, hh:mm A"):null},
        ].map(({label,value,icon:ic})=>(
          <div key={label} style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{label}</div>
            <div style={{fontSize:13,color:THEME.textPrimary,display:"flex",alignItems:"center",gap:5}}>{ic}{value??"—"}</div>
          </div>
        ))}
      </div>

      {fullAddress && (
        <><SectionDivider icon={<EyeOutlined/>} title="Delivery Address"/><p style={{fontSize:12,color:THEME.textSecondary,marginBottom:12,wordBreak:"break-word"}}>{fullAddress}</p></>
      )}

      <SectionDivider icon={<FileTextOutlined/>} title="Items"/>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {(job.cart_items||[]).map((it,i)=>{
          const isSqFt=it.quantity_type==="sq.ft"||parseFloat(it.sq_ft)>0;
          const lineTotal=isSqFt?(it.quantity||0)*(it.sq_ft||0)*(it.price||0):(it.quantity||0)*(it.price||0);
          return (
            <div key={i} style={{background:THEME.primaryLight,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"10px 14px",borderLeft:`4px solid ${THEME.primary}`}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                <div>
                  <span style={{fontWeight:700,fontSize:13,color:THEME.textPrimary,marginRight:8}}>{it.product_name||"—"}</span>
                  {it.variation&&<Tag style={{fontSize:10}}>{it.variation}</Tag>}
                  {it.printing_type&&<Tag color="blue" style={{fontSize:10}}>{it.printing_type}</Tag>}
                </div>
                <span style={{fontWeight:700,color:THEME.success,fontSize:13}}>₹{lineTotal.toFixed(2)}</span>
              </div>
              <div style={{fontSize:11,color:THEME.textSecondary,marginTop:4,display:"flex",gap:12,flexWrap:"wrap"}}>
                {isSqFt&&it.width?<span>Size: {it.width} × {it.height} {it.size_unit||""} ({it.sq_ft} ft²)</span>:it.width&&it.height?<span>Size: {it.width} × {it.height} {it.size_unit||"ft"}</span>:it.size?<span>Size: {it.size}</span>:null}
                <span>Qty: {it.quantity}</span>
                <span>Price: ₹{it.price}/{isSqFt?"sq.ft":"unit"}</span>
                {it.notes&&<span>Note: {it.notes}</span>}
              </div>
              {it.design_file&&<a href={it.design_file} target="_blank" rel="noreferrer" style={{fontSize:11,color:THEME.primary,marginTop:4,display:"inline-block"}}>View Design File ↗</a>}
            </div>
          );
        })}
      </div>

      <SectionDivider icon={<FileTextOutlined/>} title="Pricing"/>
      <div style={{background:`linear-gradient(135deg,${THEME.primaryLight},#f0f9ff)`,border:`1px solid ${THEME.border}`,borderRadius:10,padding:isMobile?"10px":"14px 16px",marginBottom:12}}>
        {[
          {label:"Subtotal",value:`₹${parseFloat(job.subtotal||0).toFixed(2)}`},
          ...(job.discount_amount>0?[{label:`Discount (${job.discount_percentage}%)`,value:`- ₹${parseFloat(job.discount_amount).toFixed(2)}`,green:true}]:[]),
          {label:"GST",value:`₹${parseFloat(job.tax_amount||0).toFixed(2)}`},
          {label:"Delivery",value:job.free_delivery?"Free 🎉":`₹${parseFloat(job.delivery_charges||0).toFixed(2)}`},
        ].map(({label,value,green})=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:green?THEME.success:THEME.textSecondary,marginBottom:4}}>
            <span>{label}</span><span style={{fontWeight:600}}>{value}</span>
          </div>
        ))}
        <Divider style={{margin:"8px 0",borderColor:THEME.border}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:15}}>
          <span style={{color:THEME.textPrimary}}>Grand Total</span>
          <span style={{color:THEME.primary}}>₹{parseFloat(job.total_amount||0).toFixed(2)}</span>
        </div>
      </div>

      {job.design_file && (
        <><SectionDivider icon={<FileTextOutlined/>} title="Design File"/><div style={{marginBottom:12}}><a href={job.design_file} target="_blank" rel="noreferrer"><img src={job.design_file} alt="Design" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,border:`1px solid ${THEME.border}`,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/></a></div></>
      )}
      {job.productionimg && (
        <><SectionDivider icon={<PlayCircleOutlined/>} title="Production Image"/><div style={{marginBottom:12}}><a href={job.productionimg} target="_blank" rel="noreferrer"><img src={job.productionimg} alt="Production" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,border:`1px solid ${THEME.border}`,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/></a></div></>
      )}

      <SectionDivider icon={<FileTextOutlined/>} title="Job Info"/>
      <div style={grid4}>
        {[
          {label:"Job No",value:job.job_no,mono:true},
          {label:"Status",value:<StatusTag status={job.job_status}/>},
          {label:"Company Name",value:job.company_name},
          {label:"Created By",value:job.created_by},
          {label:"Approved By",value:job.approved_by},
          {label:"GST No",value:job.gst_no},
          {label:"Payment Mode",value:job.payment_mode},
          {label:"Payment Amount",value:job.payment_amount?`₹${job.payment_amount}`:null},
          {label:"Order Date",value:job.order_date?dayjs(job.order_date).format("DD MMM YYYY"):null},
          ...(job.current_stage?.stage?[{label:"Stage",value:<StageTag stage={job.current_stage.stage}/>}]:[]),
          ...(job.current_stage?.assigned_to?.name?[{label:"Assigned To",value:job.current_stage.assigned_to.name}]:[]),
          {label:"Design Status",value:job.design_status},
          {label:"Design Uploaded By",value:job.design_uploaded_by},
          {label:"Production Status",value:job.production_status},
          {label:"QC Status",value:job.qc_status},
        ].map(({label,value,mono})=>(
          <div key={label} style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{label}</div>
            <div style={{fontSize:13,color:THEME.textPrimary,fontFamily:mono?"monospace":undefined,fontWeight:mono?600:400}}>{value??"—"}</div>
          </div>
        ))}
      </div>

      {job.notes && (
        <div style={{background:"#fefce8",border:"1px solid #fef08a",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#713f12"}}>
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
      <div style={{background:THEME.primaryLight,borderRadius:10,padding:"12px 14px",marginBottom:16,border:`1px solid ${THEME.border}`,borderLeft:`4px solid ${THEME.primary}`}}>
        <div style={{fontFamily:"monospace",fontWeight:700,color:THEME.primary,fontSize:14}}>{job.job_no}</div>
        <div style={{fontSize:13,color:THEME.textPrimary,marginTop:2}}>{job.customer_name||"—"}</div>
        <div style={{fontSize:11,color:THEME.textSecondary}}>{job.customer_phone||""}</div>
        <div style={{marginTop:6,fontSize:11}}>Status: <StatusTag status={job.job_status}/></div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontWeight:600,marginBottom:8,fontSize:13,color:THEME.textPrimary}}>Assign To <span style={{color:THEME.danger}}>*</span></label>
        <Select placeholder={membersLoading?"Loading…":"Choose a person"} style={{width:"100%"}} value={selected?._id||undefined} loading={membersLoading} disabled={membersLoading} onChange={id=>onSelect(members.find(d=>d._id===id)||null)} notFoundContent={membersLoading?"Loading…":"No members found"} size="large">
          {members.map(d=>(
            <Option key={d._id} value={d._id}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <UserOutlined style={{color:THEME.textMuted,fontSize:12}}/>
                <span>{d.name||d.fullName||d.username||d._id}</span>
                {d.role&&<span style={{fontSize:10,color:THEME.textMuted}}>({d.role})</span>}
              </div>
            </Option>
          ))}
        </Select>
        {!membersLoading&&members.length===0&&(
          <div style={{marginTop:8,fontSize:12,color:THEME.warning,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"6px 10px"}}>⚠️ No members found.</div>
        )}
      </div>
      <div style={{fontSize:12,color:THEME.textSecondary,background:THEME.primaryLight,padding:"8px 12px",borderRadius:6,border:`1px solid ${THEME.border}`}}>ℹ️ {infoText}</div>
    </div>
  );
};

// ─── Info Request Card ────────────────────────────────────────────────────────
const InfoRequestCard = ({ req, onApprove, onReject, acting }) => {
  const isPending = req.status === "pending";
  const isExpired = req.expires_at && new Date(req.expires_at) < new Date();
  const expiresIn = req.expires_at ? dayjs(req.expires_at).fromNow() : null;
  return (
    <div style={{background:"#fff",borderRadius:12,border:`1px solid ${isPending?"#fcd34d":"#e5e7eb"}`,boxShadow:isPending?"0 0 0 2px #fef3c7, 0 3px 10px rgba(0,0,0,0.06)":"0 2px 6px rgba(0,0,0,0.05)",overflow:"hidden",transition:"all 0.2s"}}>
      <div style={{padding:"8px 14px",background:isPending?"linear-gradient(135deg,#78350f,#d97706)":req.status==="approved"?"linear-gradient(135deg,#14532d,#16a34a)":"linear-gradient(135deg,#7f1d1d,#ef4444)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"monospace",fontWeight:800,fontSize:12,color:"#fff"}}>{req.job_no||req.job_id}</span>
        <InfoStatusBadge status={req.status}/>
      </div>
      <div style={{padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:"#eff6ff",border:"2px solid #bfdbfe",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <UserOutlined style={{color:"#3b82f6",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{req.requested_by?.name||"Unknown"}</div>
            <div style={{fontSize:11,color:"#6b7280"}}>{req.requested_by?.role||"Designer"}</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:11,color:"#9ca3af"}}><CalendarOutlined style={{marginRight:4}}/>{dayjs(req.createdAt).fromNow()}</div>
        </div>
        {req.request_reason && (
          <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#374151"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",marginBottom:3,textTransform:"uppercase"}}><InfoCircleOutlined style={{marginRight:4}}/>Reason</div>
            {req.request_reason}
          </div>
        )}
        {req.status==="approved"&&req.expires_at&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:isExpired?"#fef2f2":"#f0fdf4",border:`1px solid ${isExpired?"#fca5a5":"#86efac"}`,borderRadius:8,padding:"6px 10px",marginBottom:10,fontSize:11,color:isExpired?"#ef4444":"#16a34a",fontWeight:600}}>
            {isExpired?<LockOutlined/>:<UnlockOutlined/>}
            {isExpired?"Access expired":`Access expires ${expiresIn}`}
          </div>
        )}
        {req.review_notes&&(
          <div style={{background:req.status==="rejected"?"#fef2f2":"#f0fdf4",border:`1px solid ${req.status==="rejected"?"#fca5a5":"#86efac"}`,borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:11,color:req.status==="rejected"?"#7f1d1d":"#14532d"}}>
            <strong>Admin note:</strong> {req.review_notes}
          </div>
        )}
        {isPending&&(
          <div style={{display:"flex",gap:8}}>
            <Button type="primary" icon={<CheckCircleOutlined/>} size="small" loading={acting===`approve-${req._id}`} onClick={()=>onApprove(req)} style={{flex:1,height:30,fontWeight:700,fontSize:12,background:"#16a34a",border:"none",borderRadius:8}}>Approve</Button>
            <Button icon={<CloseCircleOutlined/>} size="small" danger loading={acting===`reject-${req._id}`} onClick={()=>onReject(req)} style={{flex:1,height:30,fontWeight:700,fontSize:12,borderRadius:8}}>Reject</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Info Requests Panel ──────────────────────────────────────────────────────
const InfoRequestsPanel = ({ userProfile }) => {
  const userId = userProfile._id;
  const userName = userProfile.name||userProfile.fullName||"Admin";
  const [requests,setRequests] = useState([]);
  const [loading,setLoading] = useState(false);
  const [infoTab,setInfoTab] = useState("pending");
  const [actionModal,setActionModal] = useState(false);
  const [actionTarget,setActionTarget] = useState(null);
  const [reviewNotes,setReviewNotes] = useState("");
  const [ttlHours,setTtlHours] = useState(24);
  const [submitting,setSubmitting] = useState(false);
  const [acting,setActing] = useState(null);

  const loadInfoRequests = useCallback(async (status) => {
    setLoading(true);
    try {
      const qs = status&&status!=="all"?`?status=${status}&limit=100`:"?limit=100";
      const res = await fetch(`${INFO_BASE}${qs}`,{headers:authHeader()});
      const d = await res.json();
      if(d.success) setRequests(d.data?.requests||[]);
    } catch(err) { message.error("Failed to load info requests: "+err.message); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{loadInfoRequests(infoTab);},[infoTab,loadInfoRequests]);

  const pendingCount = requests.filter(r=>r.status==="pending").length;
  const openApprove = (req)=>{setActionTarget({req,type:"approve"});setReviewNotes("");setTtlHours(24);setActionModal(true);};
  const openReject  = (req)=>{setActionTarget({req,type:"reject"});setReviewNotes("");setActionModal(true);};

  const submitAction = async () => {
    const {req,type} = actionTarget;
    setSubmitting(true); setActing(`${type}-${req._id}`);
    try {
      const body={reviewed_by:{user_id:userId,name:userName},review_notes:reviewNotes,...(type==="approve"?{ttl_hours:ttlHours}:{})};
      const res=await fetch(`${INFO_BASE}/${req._id}/${type}`,{method:"PATCH",headers:jsonHeader(),body:JSON.stringify(body)});
      const d=await res.json();
      if(!res.ok||!d.success) throw new Error(d.message||"Action failed");
      message.success(type==="approve"?`Access granted to ${req.requested_by?.name}.`:`Request from ${req.requested_by?.name} rejected.`);
      setActionModal(false); loadInfoRequests(infoTab);
    } catch(err) { message.error(err.message); }
    finally { setSubmitting(false); setActing(null); }
  };

  const shown = infoTab==="all"?requests:requests.filter(r=>r.status===infoTab);
  const infoTabItems = [
    {key:"pending",label:<span><HourglassOutlined style={{marginRight:4}}/>Pending{pendingCount>0&&infoTab!=="pending"&&<Badge count={pendingCount} style={{marginLeft:6,backgroundColor:"#f59e0b"}}/>}</span>},
    {key:"approved",label:<span><UnlockOutlined style={{marginRight:4}}/>Approved</span>},
    {key:"rejected",label:<span><CloseCircleOutlined style={{marginRight:4}}/>Rejected</span>},
    {key:"all",label:<span>All</span>},
  ];

  return (
    <div>
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #e5e7eb",padding:"12px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#d97706,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <KeyOutlined style={{color:"#fff",fontSize:16}}/>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:"#111827"}}>Customer Info Access Requests</div>
            <div style={{fontSize:12,color:"#6b7280"}}>Review designer requests to view customer contact details{pendingCount>0&&<span style={{marginLeft:8,color:"#d97706",fontWeight:700}}>· {pendingCount} pending</span>}</div>
          </div>
        </div>
        <Tooltip title="Refresh"><Button icon={<ReloadOutlined spin={loading}/>} onClick={()=>loadInfoRequests(infoTab)} style={{borderRadius:8}}/></Tooltip>
      </div>
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #e5e7eb",padding:"12px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <Tabs activeKey={infoTab} onChange={setInfoTab} items={infoTabItems} style={{marginBottom:14}}/>
        <Spin spinning={loading}>
          {shown.length===0&&!loading ? (
            <div style={{padding:"40px 0",textAlign:"center"}}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{color:"#9ca3af",fontSize:13}}>No {infoTab==="all"?"":infoTab} requests</span>}/></div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {shown.map(req=><InfoRequestCard key={req._id} req={req} onApprove={openApprove} onReject={openReject} acting={acting}/>)}
            </div>
          )}
        </Spin>
      </div>
      <Modal open={actionModal} onCancel={()=>!submitting&&setActionModal(false)}
        title={<div style={{display:"flex",alignItems:"center",gap:8}}>{actionTarget?.type==="approve"?<UnlockOutlined style={{color:"#16a34a"}}/>:<LockOutlined style={{color:"#ef4444"}}/>}<span style={{fontWeight:700}}>{actionTarget?.type==="approve"?"Grant Access":"Reject Request"}</span>{actionTarget?.req&&<Tag color={actionTarget.type==="approve"?"green":"red"} style={{fontFamily:"monospace",fontWeight:700,fontSize:11}}>{actionTarget.req.job_no}</Tag>}</div>}
        footer={[
          <Button key="c" onClick={()=>setActionModal(false)} disabled={submitting}>Cancel</Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={submitAction} style={{background:actionTarget?.type==="approve"?"#16a34a":"#ef4444",border:"none"}}>{actionTarget?.type==="approve"?"Grant Access":"Reject"}</Button>,
        ]}
        width={440} destroyOnClose
      >
        {actionTarget&&(
          <div>
            <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
              <div style={{fontSize:12,color:"#6b7280",marginBottom:2}}>Designer</div>
              <div style={{fontWeight:700,color:"#111827",fontSize:14}}>{actionTarget.req.requested_by?.name}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Job: <strong>{actionTarget.req.job_no}</strong></div>
              {actionTarget.req.request_reason&&<div style={{marginTop:6,fontSize:12,color:"#374151",fontStyle:"italic"}}>"{actionTarget.req.request_reason}"</div>}
            </div>
            {actionTarget.type==="approve"&&(
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Access Duration (hours)</label>
                <div style={{display:"flex",gap:8}}>
                  {[4,8,24,48].map(h=><Button key={h} size="small" type={ttlHours===h?"primary":"default"} onClick={()=>setTtlHours(h)} style={{borderRadius:8,fontWeight:600,...(ttlHours===h?{background:"#16a34a",border:"none",color:"#fff"}:{})}}>{h}h</Button>)}
                </div>
                <div style={{marginTop:6,fontSize:11,color:"#6b7280"}}>Designer will have access for {ttlHours} hour{ttlHours!==1?"s":""} after approval.</div>
              </div>
            )}
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{actionTarget.type==="approve"?"Note to Designer (optional)":"Rejection Reason"}</label>
            <TextArea rows={3} placeholder={actionTarget.type==="approve"?"e.g. Access granted for delivery coordination…":"e.g. Not required for design work…"} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} style={{borderRadius:8}}/>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Myjobs = () => {
  const { isMobile, isDesktop } = useBreakpoint();
  const [loading,setLoading] = useState(false);
  const [jobs,setJobs] = useState([]);
  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState(null);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(10);
  const [lastRefreshed,setLastRefreshed] = useState(dayjs());
  const [countdown,setCountdown] = useState(AUTO_REFRESH_MS/1000);
  const [mainTab,setMainTab] = useState("jobs");

  const [viewJob,setViewJob] = useState(null);
  const [deletingJob,setDeletingJob] = useState(null);
  const [deleteNotes,setDeleteNotes] = useState("");
  const [deleteLoading,setDeleteLoading] = useState(false);
  const [deleteError,setDeleteError] = useState("");

  const [approvingJob,setApprovingJob] = useState(null);
  const [designers,setDesigners] = useState([]);
  const [selectedDesigner,setSelectedDesigner] = useState(null);
  const [approving,setApproving] = useState(false);
  const [designersLoading,setDesignersLoading] = useState(false);

  const [qcJob,setQcJob] = useState(null);
  const [qcMembers,setQcMembers] = useState([]);
  const [selectedQcMember,setSelectedQcMember] = useState(null);
  const [qcAssigning,setQcAssigning] = useState(false);
  const [qcMembersLoading,setQcMembersLoading] = useState(false);

  const [pendingInfoCount,setPendingInfoCount] = useState(0);

  const [shareJob,setShareJob] = useState(null);
  const [shareModalOpen,setShareModalOpen] = useState(false);
  const [viewShareModalOpen,setViewShareModalOpen] = useState(false);

  const [quotationJob,setQuotationJob] = useState(null);
  const [quotationModalOpen,setQuotationModalOpen] = useState(false);
  const [viewQuotationModalOpen,setViewQuotationModalOpen] = useState(false);

  const autoRefreshRef = useRef(null);
  const countdownRef = useRef(null);
  const couponStoreRef = useRef(loadCouponStoreFromLS());

  const userProfile = useMemo(()=>getUserProfile(),[]);
  const isSuperAdmin = userProfile?.role === "super admin";

  const isQuotationAuthorized = useMemo(()=>{
    const userEmail = userProfile?.email||userProfile?.username||"";
    return ["admin@dmedia.in","admin@printe.in"].includes(userEmail.toLowerCase());
  },[userProfile]);

  const fetchAllAdmins = async () => {
    const res = await fetch(`${API_BASE}/admin/get_admin`,{headers:authHeader()});
    const data = await res.json();
    return data.data||[];
  };

  const loadJobs = useCallback(async(silent=false)=>{
    try {
      if(!silent) setLoading(true);
      const res = await fetch(`${API_BASE}/jobs`,{headers:authHeader()});
      const data = await res.json();
      let rows=[];
      if(Array.isArray(data?.data?.jobs)) rows=data.data.jobs;
      else if(Array.isArray(data?.data)) rows=data.data;
      else if(Array.isArray(data?.jobs)) rows=data.jobs;
      else if(Array.isArray(data)) rows=data;
      if(!isSuperAdmin) rows=rows.filter(j=>j.created_by_admin_id===userProfile?._id);
      setJobs(rows);
      setLastRefreshed(dayjs());
      setCountdown(AUTO_REFRESH_MS/1000);
    } catch(err) { message.error(err.message||"Failed to load jobs"); }
    finally { if(!silent) setLoading(false); }
  },[isSuperAdmin,userProfile?._id]);

  const pollPendingInfo = useCallback(async()=>{
    try {
      const res=await fetch(`${INFO_BASE}?status=pending&limit=1`,{headers:authHeader()});
      const d=await res.json();
      if(d.success) setPendingInfoCount(d.data?.total??d.data?.requests?.length??0);
    } catch {}
  },[]);

  const startAutoRefresh = useCallback(()=>{
    if(autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if(countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_MS/1000);
    countdownRef.current=setInterval(()=>setCountdown(p=>p<=1?AUTO_REFRESH_MS/1000:p-1),1000);
    autoRefreshRef.current=setInterval(()=>{loadJobs(true);pollPendingInfo();},AUTO_REFRESH_MS);
  },[loadJobs,pollPendingInfo]);

  useEffect(()=>{
    loadJobs(); pollPendingInfo(); startAutoRefresh();
    return()=>{if(autoRefreshRef.current)clearInterval(autoRefreshRef.current);if(countdownRef.current)clearInterval(countdownRef.current);};
  },[]);

  useEffect(()=>{setPage(1);},[search,statusFilter,pageSize]);

  const filteredJobs = useMemo(()=>{
    let rows=jobs;
    if(search){const q=search.toLowerCase();rows=rows.filter(j=>(j.customer_name||"").toLowerCase().includes(q)||(j.customer_phone||"").includes(q)||(j.job_no||"").toLowerCase().includes(q));}
    if(statusFilter) rows=rows.filter(j=>j.job_status===statusFilter);
    return rows;
  },[jobs,search,statusFilter]);

  const pagedJobs = useMemo(()=>{const s=(page-1)*pageSize;return filteredJobs.slice(s,s+pageSize);},[filteredJobs,page,pageSize]);

  const openApproveModal = async(job)=>{
    setApprovingJob(job);setSelectedDesigner(null);setDesignersLoading(true);
    try{const all=await fetchAllAdmins();setDesigners(all.filter(u=>u.role==="designing team"));}
    catch{message.error("Could not load designers list");setDesigners([]);}
    finally{setDesignersLoading(false);}
  };

  const handleApprove = async()=>{
    if(!selectedDesigner){message.error("Please select a designer.");return;}
    setApproving(true);
    try{
      const name=selectedDesigner.name||selectedDesigner.fullName||selectedDesigner.username||"Unknown";
      const res=await fetch(`${API_BASE}/jobs/${approvingJob._id}/approve`,{method:"POST",headers:jsonHeader(),body:JSON.stringify({job_status:"design",approved_by:userProfile?.name||null,approved_by_admin_id:userProfile?._id||null,assign_to:{user_id:selectedDesigner._id,name}})});
      const data=await res.json();
      if(!res.ok||!data.success) throw new Error(data.message||"Approval failed");
      message.success(`Job ${approvingJob.job_no} approved & assigned to ${name}`);
      setApprovingJob(null);setSelectedDesigner(null);loadJobs(true);
    } catch(err){message.error(err.message||"Failed to approve job");}
    finally{setApproving(false);}
  };

  const closeDeleteModal = ()=>{if(deleteLoading)return;setDeletingJob(null);setDeleteNotes("");setDeleteError("");};

  const handleDelete = async()=>{
    if(deleteNotes.trim().length<50){setDeleteError("Please provide at least 50 characters explaining the reason.");return;}
    setDeleteLoading(true);setDeleteError("");
    try{
      const res=await fetch(`${API_BASE}/jobs/${deletingJob._id}`,{method:"DELETE",headers:jsonHeader(),body:JSON.stringify({delete_notes:deleteNotes.trim(),adminId:userProfile?._id})});
      const data=await res.json();
      if(!res.ok||!data.success) throw new Error(data.message||"Failed to delete job");
      message.success(`Job ${deletingJob.job_no} deleted successfully.`);
      closeDeleteModal();loadJobs(true);
    } catch(err){setDeleteError(err.message||"Failed to delete job");}
    finally{setDeleteLoading(false);}
  };

  const openQcModal = async(job)=>{
    setQcJob(job);setSelectedQcMember(null);setQcMembersLoading(true);
    try{const all=await fetchAllAdmins();const qcList=all.filter(u=>u.role==="quality check");setQcMembers(qcList.length>0?qcList:all);}
    catch{message.error("Could not load QC members");setQcMembers([]);}
    finally{setQcMembersLoading(false);}
  };

  const handleAssignQc = async()=>{
    if(!selectedQcMember){message.error("Please select a QC assignee.");return;}
    setQcAssigning(true);
    try{
      const assigneeName=selectedQcMember.name||selectedQcMember.fullName||selectedQcMember.username||"Unknown";
      const payload={stage:"quality_check",stage_label:"quality_check",assigned_to:{user_id:selectedQcMember._id,name:assigneeName,role:selectedQcMember.role||""},assigned_by:{user_id:userProfile?._id||null,name:userProfile?.name||"Unknown",role:userProfile?.role||""},notes:"QC assigned via My Jobs page"};
      const res=await fetch(`${API_BASE}/jobs/${qcJob._id}/assign`,{method:"POST",headers:jsonHeader(),body:JSON.stringify(payload)});
      const data=await res.json();
      if(!res.ok||!data.success) throw new Error(data.message||"QC assignment failed");
      message.success(`Quality check assigned to ${assigneeName}`);
      setQcJob(null);setSelectedQcMember(null);loadJobs(true);
    } catch(err){message.error(err.message||"Failed to assign QC");}
    finally{setQcAssigning(false);}
  };

  const handleJobSheet        = (record)=>{setShareJob(record);setShareModalOpen(true);};
  const handleQuotation       = (record)=>{setQuotationJob(record);setQuotationModalOpen(true);};
  const handleJobSheetFromView  = ()=>{if(!viewJob)return;setViewShareModalOpen(true);};
  const handleQuotationFromView = ()=>{if(!viewJob)return;setViewQuotationModalOpen(true);};

  const fmtCountdown=(s)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const p=isMobile?8:16, g=isMobile?8:12;
  const slideUp=isMobile?{top:"auto",bottom:0,margin:0,maxWidth:"100vw",padding:0,paddingBottom:"env(safe-area-inset-bottom)"}:{};
  const modalBody={maxHeight:isMobile?"72dvh":"80vh",overflowY:"auto",padding:isMobile?12:16};

  const [couponStoreVersion, setCouponStoreVersion] = useState(0);
  const refreshCouponStore = () => setCouponStoreVersion(v => v + 1);

  const hasCouponForJob = useCallback((record) => {
    const jobKey = record._id || record.job_no;
    return couponStoreRef.current.has(jobKey);
  }, [couponStoreVersion]);

  const columns = [
    {title:"#",width:36,render:(_,__,i)=><span style={{color:THEME.textMuted,fontSize:11}}>{(page-1)*pageSize+i+1}</span>},
    {title:"Job No",dataIndex:"job_no",render:n=><Tag color="blue" style={{fontFamily:"monospace",fontWeight:600,fontSize:11}}>{n||"—"}</Tag>},
    {title:"Customer",key:"customer",render:(_,r)=>(
      <div>
        <div style={{fontWeight:600,fontSize:13,color:THEME.textPrimary}}>{r.customer_name||"—"}</div>
        <div style={{fontSize:11,color:THEME.textSecondary}}>{r.customer_phone||""}</div>
        {isMobile&&<StatusTag status={r.job_status} style={{marginTop:4,fontSize:10}}/>}
      </div>
    )},
    ...(!isMobile?[{title:"Date",dataIndex:"order_date",render:d=><span style={{fontSize:12,color:THEME.textSecondary,whiteSpace:"nowrap"}}>{d?dayjs(d).format("DD MMM YY"):"—"}</span>}]:[]),
    {title:"Total",dataIndex:"total_amount",render:a=><span style={{fontWeight:700,fontSize:13,color:THEME.primary,whiteSpace:"nowrap"}}>₹{parseFloat(a||0).toLocaleString("en-IN",{minimumFractionDigits:2})}</span>},
    ...(!isMobile?[{title:"Status",dataIndex:"job_status",render:s=><StatusTag status={s}/>}]:[]),
    ...(isDesktop?[{title:"Stage",key:"stage",render:(_,r)=><StageTag stage={r.current_stage?.stage}/>}]:[]),
    {title:"",width:isMobile?110:300,render:(_,record)=>{
      const isQC=record.job_status==="quality_check";
      const showQuotation=record.job_status==="design"&&isQuotationAuthorized;
      const hasCoupon=hasCouponForJob(record);
      return (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:isMobile?"flex-start":"flex-end",flexDirection:isMobile?"column":"row"}}>
          <Tooltip title="View Job Details">
            <Button icon={<EyeOutlined/>} size="small" style={{width:isMobile?"100%":"auto",borderColor:THEME.primary,color:THEME.primary}} onClick={()=>setViewJob(record)}>{!isMobile&&"View"}</Button>
          </Tooltip>
          {showQuotation&&(
            <Tooltip title="Quotation PDF & Share">
              <Button icon={<FileTextOutlined/>} size="small" style={{width:isMobile?"100%":"auto",background:"#1e40af",borderColor:"#1e40af",color:"#fff"}} onClick={()=>handleQuotation(record)}>{!isMobile&&"Quotation"}</Button>
            </Tooltip>
          )}
          <Tooltip title="Job Sheet PDF & Share">
            <Button icon={<PrinterOutlined/>} size="small" style={{width:isMobile?"100%":"auto",background:"#0f766e",borderColor:"#0f766e",color:"#fff"}} onClick={()=>handleJobSheet(record)}>{!isMobile&&"Job Sheet"}</Button>
          </Tooltip>
          <Tooltip title={hasCoupon?"Coupon ready — click to view/resend":"Generate & Send Coupon"}>
            <Button icon={<GiftOutlined/>} size="small"
              style={{width:isMobile?"100%":"auto",background:hasCoupon?"#c99d08":C.YELLOW,borderColor:hasCoupon?"#a07800":C.YELLOW_DARK,color:C.BROWN_DARK,fontWeight:700,position:"relative"}}
              onClick={()=>{handleJobSheet(record);}}
            >
              {!isMobile&&(hasCoupon?"Coupon ✓":"Coupon")}
            </Button>
          </Tooltip>
          {isQC&&(
            <Tooltip title="Assign Quality Check Person">
              <Button type="primary" icon={<SafetyCertificateOutlined/>} size="small" style={{background:THEME.purple,borderColor:THEME.purple,width:isMobile?"100%":"auto"}} onClick={()=>openQcModal(record)}>{!isMobile&&"Assign QC"}</Button>
            </Tooltip>
          )}
          <Tooltip title="Delete Job">
            <Button icon={<DeleteOutlined/>} size="small" danger style={{width:isMobile?"100%":"auto"}} onClick={()=>{setDeletingJob(record);setDeleteNotes("");setDeleteError("");}}>
              {!isMobile&&"Delete"}
            </Button>
          </Tooltip>
        </div>
      );
    }},
  ];

  const mainTabItems = [
    {
      key:"jobs",
      label:<span style={{display:"flex",alignItems:"center",gap:6,fontWeight:600}}><BranchesOutlined/>Jobs<Badge count={filteredJobs.length} showZero style={{backgroundColor:THEME.primary}}/></span>,
      children:(
        <div>
          <Card bodyStyle={{padding:`${p}px ${p+4}px`}} style={{borderRadius:12,border:`1px solid ${THEME.border}`,marginBottom:g,background:THEME.bgCard,boxShadow:"0 2px 12px rgba(30,111,220,0.08)"}}>
            <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:8}}>
              <Input.Search placeholder="Search name, phone, job no…" allowClear onSearch={v=>{setSearch(v);setPage(1);}} onChange={e=>{if(!e.target.value){setSearch("");setPage(1);}}} style={{flex:1}} size="middle"/>
              <Select placeholder="Filter by Status" allowClear size="middle" onChange={v=>{setStatusFilter(v||null);setPage(1);}} style={{width:isMobile?"100%":190}}>
                {Object.entries(STATUS_CONFIG).map(([k,{label,color}])=><Option key={k} value={k}><Tag color={color} style={{fontWeight:500}}>{label}</Tag></Option>)}
              </Select>
            </div>
          </Card>
          <Card bodyStyle={{padding:"0 0 8px 0"}} style={{borderRadius:12,border:`1px solid ${THEME.border}`,boxShadow:"0 2px 12px rgba(30,111,220,0.08)",background:THEME.bgCard,overflow:"hidden"}}>
            <Table dataSource={pagedJobs} loading={loading} columns={columns} scroll={{x:isMobile?360:1100}} rowKey={r=>r._id||r.job_no} size="small" rowClassName={(_,i)=>i%2===0?"row-alt":""}
              pagination={{current:page,pageSize,total:filteredJobs.length,showSizeChanger:!isMobile,pageSizeOptions:["10","25","50"],showTotal:isMobile?undefined:(total,[start,end])=>`${start}–${end} of ${total}`,onChange:(pg,ps)=>{setPage(pg);setPageSize(ps);},style:{padding:"8px 12px"},size:isMobile?"small":"default"}}
            />
          </Card>
        </div>
      ),
    },
    {
      key:"info-requests",
      label:<span style={{display:"flex",alignItems:"center",gap:6,fontWeight:600}}><KeyOutlined/>Info Requests{pendingInfoCount>0&&<Badge count={pendingInfoCount} style={{backgroundColor:"#d97706"}}/>}</span>,
      children:<InfoRequestsPanel userProfile={userProfile}/>,
    },
  ];

  return (
    <div style={{padding:p,background:THEME.bgPage,minHeight:"100vh"}}>
      <Card bodyStyle={{padding:`${p}px ${p+4}px`}} style={{borderRadius:14,border:`1px solid ${THEME.border}`,marginBottom:g,background:THEME.bgCard,boxShadow:"0 2px 12px rgba(30,111,220,0.08)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{margin:0,fontSize:isMobile?16:20,fontWeight:800,color:THEME.textPrimary,display:"flex",alignItems:"center",flexWrap:"wrap",gap:8,letterSpacing:"-0.02em"}}>
              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:30,height:30,background:THEME.primaryLight,borderRadius:8,marginRight:4}}>
                <BranchesOutlined style={{color:THEME.primary,fontSize:15}}/>
              </span>
              Job Management
              {isSuperAdmin&&<Tag color="gold" style={{fontSize:11,fontWeight:600}}>Super Admin</Tag>}
            </h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:THEME.textMuted}}>
              <strong style={{color:THEME.primary}}>{filteredJobs.length}</strong> jobs · Last refreshed {lastRefreshed.format("HH:mm:ss")}
              {pendingInfoCount>0&&<span style={{marginLeft:10,color:THEME.amber,fontWeight:700}}>· <KeyOutlined style={{marginRight:3}}/>{pendingInfoCount} info request{pendingInfoCount!==1?"s":""} pending</span>}
            </p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:5,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"4px 12px"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 0 2px #bbf7d0",display:"inline-block",animation:"pulse 1.5s infinite"}}/>
              <span style={{fontSize:11,color:"#15803d",fontWeight:700,fontFamily:"monospace"}}>{fmtCountdown(countdown)}</span>
            </div>
            <Tooltip title="Refresh now">
              <Button icon={<ReloadOutlined spin={loading}/>} onClick={()=>{loadJobs();pollPendingInfo();startAutoRefresh();}} style={{borderRadius:8,borderColor:THEME.border,color:THEME.primary}}/>
            </Tooltip>
          </div>
        </div>
      </Card>

      <Card bodyStyle={{padding:`${p}px ${p+4}px`}} style={{borderRadius:14,border:`1px solid ${THEME.border}`,background:THEME.bgCard,boxShadow:"0 2px 12px rgba(30,111,220,0.08)"}}>
        <Tabs activeKey={mainTab} onChange={k=>{setMainTab(k);if(k==="info-requests")pollPendingInfo();}} items={mainTabItems} size={isMobile?"small":"middle"}/>
      </Card>

      {/* View Modal */}
      <Modal open={!!viewJob} onCancel={()=>setViewJob(null)}
        footer={[
          ...(viewJob?.job_status==="design"&&isQuotationAuthorized?[<Button key="quotation" icon={<FileTextOutlined/>} onClick={handleQuotationFromView} style={{background:"#1e40af",borderColor:"#1e40af",color:"#fff",fontWeight:700,borderRadius:8}}>Quotation</Button>]:[]),
          <Button key="jobsheet" icon={<PrinterOutlined/>} onClick={handleJobSheetFromView} style={{background:"#0f766e",borderColor:"#0f766e",color:"#fff",fontWeight:700,borderRadius:8}}>Job Sheet</Button>,
          <Button key="close" onClick={()=>setViewJob(null)} style={{borderColor:THEME.border,color:THEME.textSecondary}}>Close</Button>,
        ]}
        title={<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><EyeOutlined style={{color:THEME.primary}}/><span style={{fontWeight:700,color:THEME.textPrimary}}>Job Details</span>{viewJob&&<Tag color="blue" style={{fontFamily:"monospace",fontWeight:600,fontSize:11}}>{viewJob.job_no}</Tag>}</div>}
        width={isMobile?"100vw":"min(96vw, 860px)"}
        style={isMobile?{top:0,margin:0,maxWidth:"100vw",padding:0,paddingBottom:"env(safe-area-inset-bottom)"}:{}}
        styles={{body:{maxHeight:isMobile?"90dvh":"85vh",overflowY:"auto",padding:isMobile?12:20}}}
        destroyOnClose
      >
        <JobDetailView job={viewJob} isMobile={isMobile} onOpenJobSheetShare={handleJobSheetFromView} onOpenQuotationShare={handleQuotationFromView} isQuotationAuthorized={isQuotationAuthorized}/>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deletingJob} onCancel={closeDeleteModal} maskClosable={!deleteLoading} closable={!deleteLoading}
        title={<div style={{display:"flex",alignItems:"center",gap:8}}><DeleteOutlined style={{color:THEME.danger}}/><span style={{fontWeight:700,color:THEME.danger}}>Delete Job</span></div>}
        footer={[
          <Button key="cancel" onClick={closeDeleteModal} disabled={deleteLoading} style={{borderColor:THEME.border}}>Cancel</Button>,
          <Button key="confirm" danger type="primary" loading={deleteLoading} disabled={deleteNotes.trim().length<50} onClick={handleDelete} icon={<DeleteOutlined/>}>Confirm Delete</Button>,
        ]}
        width={isMobile?"100vw":480} style={slideUp} styles={{body:modalBody}} destroyOnClose
      >
        {deletingJob&&(
          <div>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
              <ExclamationCircleOutlined style={{color:THEME.danger,fontSize:16,marginTop:2,flexShrink:0}}/>
              <div>
                <div style={{fontWeight:700,color:THEME.danger,fontSize:13}}>This action cannot be undone.</div>
                <div style={{fontSize:12,color:"#7f1d1d",marginTop:2}}>Job <strong>{deletingJob.job_no}</strong> for <strong>{deletingJob.customer_name}</strong> will be permanently deleted.</div>
              </div>
            </div>
            <div>
              <label style={{display:"block",fontWeight:600,fontSize:13,marginBottom:6,color:THEME.textPrimary}}>
                Reason for Deletion <span style={{color:THEME.danger}}>*</span>
                <span style={{marginLeft:8,fontSize:11,fontWeight:400,color:deleteNotes.trim().length>=50?THEME.success:THEME.textMuted}}>({deleteNotes.trim().length} / 50 min)</span>
              </label>
              <TextArea rows={4} placeholder="Explain why this job is being deleted…" value={deleteNotes} onChange={e=>{setDeleteNotes(e.target.value);if(deleteError)setDeleteError("");}} maxLength={500} showCount style={{borderRadius:8,borderColor:deleteError?"#f87171":deleteNotes.trim().length>=50?"#86efac":undefined}}/>
              {deleteError&&<div style={{color:THEME.danger,fontSize:12,marginTop:6}}>⚠ {deleteError}</div>}
              {deleteNotes.trim().length>0&&deleteNotes.trim().length<50&&<div style={{color:THEME.warning,fontSize:12,marginTop:6}}>{50-deleteNotes.trim().length} more characters needed.</div>}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal open={!!approvingJob} onCancel={()=>{if(!approving){setApprovingJob(null);setSelectedDesigner(null);setDesigners([]);}}} maskClosable={!approving} closable={!approving}
        title={<div style={{display:"flex",alignItems:"center",gap:8}}><CheckCircleOutlined style={{color:THEME.success}}/><span style={{fontWeight:700,color:THEME.textPrimary}}>Approve & Assign to Designer</span></div>}
        footer={[
          <Button key="cancel" disabled={approving} onClick={()=>{if(!approving){setApprovingJob(null);setSelectedDesigner(null);setDesigners([]);}}} style={{borderColor:THEME.border}}>Cancel</Button>,
          <Button key="approve" type="primary" loading={approving} disabled={!selectedDesigner||designersLoading} onClick={handleApprove} style={{background:THEME.success,borderColor:THEME.success}}>Approve & Assign</Button>,
        ]}
        width={isMobile?"100vw":480} style={slideUp} styles={{body:modalBody}} destroyOnClose
      >
        <AssignModalBody job={approvingJob} members={designers} membersLoading={designersLoading} selected={selectedDesigner} onSelect={setSelectedDesigner} infoText='Job will be approved and stage set to "Design".'/>
      </Modal>

      {/* QC Modal */}
      <Modal open={!!qcJob} onCancel={()=>{if(!qcAssigning){setQcJob(null);setSelectedQcMember(null);setQcMembers([]);}}} maskClosable={!qcAssigning} closable={!qcAssigning}
        title={<div style={{display:"flex",alignItems:"center",gap:8}}><SafetyCertificateOutlined style={{color:THEME.purple}}/><span style={{fontWeight:700,color:THEME.textPrimary}}>Assign Quality Check</span></div>}
        footer={[
          <Button key="cancel" disabled={qcAssigning} onClick={()=>{if(!qcAssigning){setQcJob(null);setSelectedQcMember(null);setQcMembers([]);}}} style={{borderColor:THEME.border}}>Cancel</Button>,
          <Button key="assign" type="primary" loading={qcAssigning} disabled={!selectedQcMember||qcMembersLoading} onClick={handleAssignQc} style={{background:THEME.purple,borderColor:THEME.purple}}>Assign QC</Button>,
        ]}
        width={isMobile?"100vw":480} style={slideUp} styles={{body:modalBody}} destroyOnClose
      >
        <AssignModalBody job={qcJob} members={qcMembers} membersLoading={qcMembersLoading} selected={selectedQcMember} onSelect={setSelectedQcMember} infoText="The selected person will perform quality check for this job."/>
      </Modal>

      {/* Job Sheet Share Modals */}
      <PdfShareModal type="jobsheet" open={shareModalOpen} onClose={()=>{setShareModalOpen(false);setShareJob(null);refreshCouponStore();}} job={shareJob} couponStoreRef={couponStoreRef}/>
      <PdfShareModal type="jobsheet" open={viewShareModalOpen} onClose={()=>{setViewShareModalOpen(false);refreshCouponStore();}} job={viewJob} couponStoreRef={couponStoreRef}/>

      {/* Quotation Share Modals */}
      <PdfShareModal type="quotation" open={quotationModalOpen} onClose={()=>{setQuotationModalOpen(false);setQuotationJob(null);refreshCouponStore();}} job={quotationJob} couponStoreRef={couponStoreRef}/>
      <PdfShareModal type="quotation" open={viewQuotationModalOpen} onClose={()=>{setViewQuotationModalOpen(false);refreshCouponStore();}} job={viewJob} couponStoreRef={couponStoreRef}/>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .ant-modal.css-dev-only-do-not-override-ch9ese {width:650px !important;}
        .row-alt td { background: ${THEME.bgRow} !important; }
        .ant-table-thead > tr > th { background: ${THEME.primaryLight} !important; color: ${THEME.primary} !important; font-weight: 700 !important; font-size: 12px !important; border-bottom: 2px solid ${THEME.border} !important; }
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