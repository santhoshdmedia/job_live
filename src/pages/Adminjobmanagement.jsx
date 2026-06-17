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
  UploadOutlined,
} from "@ant-design/icons";
import CustomTable from "../components/CustomTable";
import { ERROR_NOTIFICATION, SUCCESS_NOTIFICATION } from "../helper/notification_helper";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

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

const OverdueBadge = ({ estimated_delivery_date }) => {
  const info = getOverdueInfo(estimated_delivery_date);
  if (!info) return null;
  if (!info.isOverdue && !info.isDueToday && info.diff < -3) return null;
  return (
    <Tooltip title={`${info.label} · Est: ${dayjs(estimated_delivery_date).format("DD MMM YYYY")}`}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:10, border:`1px solid ${info.border}`, background:info.bg, color:info.color, fontFamily:"monospace", whiteSpace:"nowrap" }}>
        {info.isOverdue && <ExclamationCircleOutlined style={{ fontSize:9 }} />}
        {info.badge}d
      </span>
    </Tooltip>
  );
};

// ─── Payment Due Badge ────────────────────────────────────────────────────────
const PaymentDueBadge = ({ next_due_date, balance_amount }) => {
  if (!next_due_date || !balance_amount || parseFloat(balance_amount) <= 0) return null;
  const today = dayjs().startOf("day");
  const due = dayjs(next_due_date).startOf("day");
  const diff = due.diff(today, "day");
  let color, bg, border, label;
  if (diff < 0) { color="#991b1b"; bg="#fee2e2"; border="#fca5a5"; label=`Payment overdue ${Math.abs(diff)}d`; }
  else if (diff === 0) { color="#92400e"; bg="#fef3c7"; border="#fcd34d"; label="Payment due today"; }
  else if (diff <= 3) { color="#92400e"; bg="#fff7ed"; border="#fdba74"; label=`Payment due in ${diff}d`; }
  else { color="#1e40af"; bg="#eff6ff"; border="#93c5fd"; label=`Payment due ${dayjs(next_due_date).format("DD MMM")}`; }
  return (
    <Tooltip title={`Balance ₹${parseFloat(balance_amount).toFixed(2)} · Due ${dayjs(next_due_date).format("DD MMM YYYY")}`}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, border:`1px solid ${border}`, background:bg, color, whiteSpace:"nowrap" }}>
        <WalletOutlined style={{ fontSize:9 }} /> {label}
      </span>
    </Tooltip>
  );
};

// ─── Next Due Date Helpers ────────────────────────────────────────────────────
const getDefaultNextDueDate = (paymentMode, paidAmount, totalAmount) => {
  const balance = totalAmount - paidAmount;
  if (balance <= 0) return null;
  const modeDefaults = { "Cash":0, "Cash on Delivery":0, "UPI":0, "Card":0, "Bank Transfer":7, "Cheque":14 };
  const days = modeDefaults[paymentMode] ?? 30;
  return days === 0 ? null : dayjs().add(days, "day");
};

const NextDueDatePreview = ({ paymentMode, paidAmount, totalAmount, nextDueDate }) => {
  const balance = (totalAmount || 0) - (parseFloat(paidAmount) || 0);
  if (balance <= 0) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, marginTop:8 }}>
      <CheckOutlined style={{ color:"#16a34a", fontSize:16 }} />
      <div>
        <div style={{ fontWeight:700, color:"#15803d", fontSize:13 }}>Fully Paid</div>
        <div style={{ fontSize:11, color:"#4ade80" }}>No outstanding balance.</div>
      </div>
    </div>
  );
  const suggested = getDefaultNextDueDate(paymentMode, parseFloat(paidAmount)||0, totalAmount||0);
  const displayDate = nextDueDate || suggested;
  let urgencyColor="#1e40af", urgencyBg="#eff6ff", urgencyBorder="#93c5fd", urgencyMsg="";
  if (displayDate) {
    const diff = dayjs(displayDate).startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff < 0) { urgencyColor="#991b1b"; urgencyBg="#fee2e2"; urgencyBorder="#fca5a5"; urgencyMsg=`Payment is already overdue by ${Math.abs(diff)} day${Math.abs(diff)>1?"s":""}!`; }
    else if (diff === 0) { urgencyColor="#92400e"; urgencyBg="#fef3c7"; urgencyBorder="#fcd34d"; urgencyMsg="Payment is due today."; }
    else if (diff <= 3) { urgencyColor="#c2410c"; urgencyBg="#fff7ed"; urgencyBorder="#fdba74"; urgencyMsg=`Payment is due very soon — in ${diff} day${diff>1?"s":""}.`; }
    else { urgencyMsg=`Customer has ${diff} days to pay the balance.`; }
  }
  return (
    <div style={{ marginTop:8, padding:"12px 14px", background:urgencyBg, border:`1px solid ${urgencyBorder}`, borderRadius:10 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <CalendarOutlined style={{ color:urgencyColor, fontSize:18, marginTop:2, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, color:urgencyColor, fontSize:13, marginBottom:4 }}>Balance Due: ₹{balance.toFixed(2)}</div>
          {displayDate ? (
            <>
              <div style={{ fontSize:12, color:urgencyColor, marginBottom:4 }}>Next payment due: <strong>{dayjs(displayDate).format("dddd, DD MMM YYYY")}</strong></div>
              <div style={{ fontSize:11, color:urgencyColor, opacity:0.85 }}>{urgencyMsg}</div>
            </>
          ) : (
            <div style={{ fontSize:12, color:urgencyColor }}>Set a due date below so the customer knows when to pay.</div>
          )}
          {suggested && !nextDueDate && (
            <div style={{ marginTop:6, fontSize:11, color:urgencyColor, opacity:0.75, fontStyle:"italic" }}>
              Suggested for "{paymentMode}": {dayjs(suggested).format("DD MMM YYYY")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Site Visit Badge ─────────────────────────────────────────────────────────
const SiteVisitBadge = () => (
  <Tooltip title="Created from a Site Visit">
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"linear-gradient(135deg,#7c3aed22,#4f46e522)", border:"1px solid #a78bfa", color:"#6d28d9", whiteSpace:"nowrap" }}>
      <CompassOutlined style={{ fontSize:9 }} /> Site Visit
    </span>
  </Tooltip>
);

// ─── Static Configs ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:       { label:"Draft",       color:"default",  icon:<FileTextOutlined /> },
  sent:        { label:"Sent",        color:"blue",     icon:<SendOutlined /> },
  viewed:      { label:"Viewed",      color:"cyan",     icon:<EyeOutlined /> },
  accepted:    { label:"Accepted",    color:"green",    icon:<CheckCircleOutlined /> },
  design:      { label:"Design",      color:"blue",     icon:<FileTextOutlined /> },
  in_progress: { label:"In Progress", color:"gold",     icon:<PlayCircleOutlined /> },
  on_hold:     { label:"On Hold",     color:"orange",   icon:<PauseCircleOutlined /> },
  rejected:    { label:"Rejected",    color:"red",      icon:<CloseCircleOutlined /> },
  expired:     { label:"Expired",     color:"volcano",  icon:<ClockCircleOutlined /> },
  completed:   { label:"Completed",   color:"purple",   icon:<CheckCircleOutlined /> },
  converted:   { label:"Converted",   color:"geekblue", icon:<SwapOutlined /> },
};

const WORKFLOW_STAGES = [
  { value:"design",        label:"Design" },
  { value:"prepress",      label:"Prepress" },
  { value:"printing",      label:"Printing" },
  { value:"finishing",     label:"Finishing" },
  { value:"quality_check", label:"Quality Check" },
  { value:"dispatch",      label:"Dispatch" },
  { value:"delivered",     label:"Delivered" },
  { value:"custom",        label:"Custom" },
];

const PRODUCTS = [
  {
    product_id: "P001",
    product_name: "flex",
    printing_type: ["Solvent", "Latex", "UV"],
    variations: ["Normal Flex","Flex BB -230gsm","Flex BB -280gsm","Flex BB -240gsm","Flex Star Backlight","Flex Backlight","Flex BB Star"],
  },
];

const UNIT_OPTIONS    = [{ value:"ft", label:"ft" },{ value:"inch", label:"inch" },{ value:"cm", label:"cm" }];
const QTY_TYPE_OPTIONS = [{ value:"sq.ft", label:"Sq. Ft" },{ value:"quantity", label:"Quantity" }];
const GST_OPTIONS     = [0, 5, 12, 18, 28];
const PAYMENT_MODES   = ["Cash","UPI","Bank Transfer","Cheque","Card","Cash on Delivery"];

const OFFICE_WORK_TYPES = [
  { value:"website",      label:"Website",      icon:"🌐", calc:"days"   },
  { value:"design",       label:"Design",       icon:"🎨", calc:"hours"  },
  { value:"social_media", label:"Social Media", icon:"📱", calc:"counts" },
  { value:"photo_shoot",  label:"Photo Shoot",  icon:"📷", calc:"hours"  },
];

// ─── Empty templates ──────────────────────────────────────────────────────────
const EMPTY_PRODUCT_ITEM = {
  item_category:"product", product_id:"", product_name:"", variation:"", printing_type:"",
  width:"", height:"", size_unit:"inch", sq_ft:0, sq_ft_manual:false,
  quantity_type:"sq.ft", quantity:1, price:0, gst_percentage:0, design_file:"", notes:"",
};
const EMPTY_OFFICE_ITEM = {
  item_category:"service_office", service_name:"", office_type:"website",
  days:1, hours:1, reels_count:0, post_count:0, price:0, gst_percentage:0, notes:"",
};
const EMPTY_LABOUR_ITEM = {
  item_category:"service_labour", service_name:"",
  sq_ft:0, hours:0, price_per_sqft:0, price_per_hour:0, gst_percentage:0, notes:"",
};

const DEFAULT_EDIT_FORM = {
  customer_name:"", customer_phone:"", company_name:"",
  estimated_delivery_date:"",
  address_line1:"", address_line2:"", city:"", state:"", pincode:"", country:"India",
  gst_no:"", delivery_charges:0, free_delivery:false,
  design_charges:0, discount_amount:0,
  payment_mode:"", payment_amount:"", next_due_date:null,
  notes:"",
  terms_and_conditions:"Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w)||0, hn = parseFloat(h)||0;
  if (!wn || !hn) return 0;
  if (unit==="ft")   return wn*hn;
  if (unit==="inch") return (wn/12)*(hn/12);
  if (unit==="cm")   return (wn/30.48)*(hn/30.48);
  return wn*hn;
};

const computeProductLineTotal = (item) => {
  const base = item.quantity_type==="sq.ft"
    ? (item.quantity||0)*(item.sq_ft||0)*(item.price||0)
    : (item.quantity||0)*(item.price||0);
  const gstAmt = base*((item.gst_percentage||0)/100);
  return { base, gstAmt, total:base+gstAmt };
};

const computeOfficeServiceLineTotal = (item) => {
  let qty = 0;
  if (item.office_type==="website")           qty = item.days||0;
  else if (item.office_type==="design")       qty = item.hours||0;
  else if (item.office_type==="social_media") qty = (item.reels_count||0)+(item.post_count||0);
  else if (item.office_type==="photo_shoot")  qty = item.hours||0;
  const base = qty*(item.price||0);
  const gstAmt = base*((item.gst_percentage||0)/100);
  return { base, gstAmt, total:base+gstAmt, qty };
};

const computeLabourLineTotal = (item) => {
  const sqFtAmt  = (item.sq_ft||0)*(item.price_per_sqft||0);
  const hoursAmt = (item.hours||0)*(item.price_per_hour||0);
  const base     = sqFtAmt+hoursAmt;
  const gstAmt   = base*((item.gst_percentage||0)/100);
  return { base, gstAmt, total:base+gstAmt, sqFtAmt, hoursAmt };
};

// legacy total calculator used in view modal
const calcJobTotals = (job) => {
  let subtotal=0, taxAmount=0;
  (job.cart_items||[]).forEach(it => {
    const cat = it.item_category;
    let base=0, gstAmt=0;
    if (cat==="service_office") { const r=computeOfficeServiceLineTotal(it); base=r.base; gstAmt=r.gstAmt; }
    else if (cat==="service_labour") { const r=computeLabourLineTotal(it); base=r.base; gstAmt=r.gstAmt; }
    else { const r=computeProductLineTotal(it); base=r.base; gstAmt=r.gstAmt; }
    subtotal+=base; taxAmount+=gstAmt;
  });
  let discountAmt=parseFloat(job.discount_amount)||0;
  if (!discountAmt && job.discount_percentage) discountAmt=subtotal*((parseFloat(job.discount_percentage)||0)/100);
  const taxableAmount=subtotal-discountAmt;
  const designCharges=parseFloat(job.design_charges)||0;
  const deliveryCharges=job.free_delivery?0:parseFloat(job.delivery_charges)||0;
  return { subtotal, discountAmt, taxableAmount, taxAmount, designCharges, deliveryCharges, grandTotal:taxableAmount+taxAmount+designCharges+deliveryCharges, freeDelivery:!!job.free_delivery };
};

const isSiteVisitJob = (r) => !!(r?.site_visit_id || r?.site_visit_no);
const extractJobs    = (d) => Array.isArray(d?.data?.jobs)?d.data.jobs:Array.isArray(d?.data)?d.data:Array.isArray(d?.jobs)?d.jobs:Array.isArray(d)?d:[];
const extractTotal   = (d, fb) => typeof d?.data?.pagination?.total==="number"?d.data.pagination.total:typeof d?.data?.total==="number"?d.data.total:typeof d?.total==="number"?d.total:fb;

const AUTO_REFRESH_INTERVAL = 5*60*1000;

// ─── Shared UI ────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, badge }) => (
  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
    <span style={{ color:"#2563eb", fontSize:14 }}>{icon}</span>
    <span style={{ fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.06em" }}>{title}</span>
    {badge}
    <div style={{ flex:1, height:1, background:"#e5e7eb", marginLeft:6 }} />
  </div>
);

const FormField = ({ label, required, children, hint }) => (
  <div>
    <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#6b7280", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>
      {label}{required && <span style={{ color:"#ef4444", marginLeft:2 }}>*</span>}
    </label>
    {children}
    {hint && <div style={{ fontSize:10, color:"#9ca3af", marginTop:3 }}>{hint}</div>}
  </div>
);

const InfoRow = ({ label, value, valueStyle }) => (
  <div>
    <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
    <div style={{ fontSize:13, fontWeight:600, color:"#1a1a2e", ...valueStyle }}>{value||"—"}</div>
  </div>
);

const SummaryRow = ({ label, value, color, bold, borderTop }) => (
  <div style={{ display:"flex", justifyContent:"space-between", fontSize:bold?15:13, fontWeight:bold?800:600, color:color||"#4b5563", marginBottom:bold?0:4, paddingTop:borderTop?8:0, borderTop:borderTop?"1px solid #e5e7eb":"none" }}>
    <span style={{ color:bold?"#1a1a2e":undefined }}>{label}</span>
    <span style={{ color:color||(bold?"#2563eb":undefined) }}>{value}</span>
  </div>
);

// ─── Site Visit Photos ────────────────────────────────────────────────────────
const SiteVisitPhotosPanel = ({ photos }) => {
  if (!photos?.length) return null;
  return (
    <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe22)", border:"1px solid #c4b5fd", borderRadius:10, padding:"12px 14px" }}>
      <SectionHeader icon={<CameraOutlined style={{ color:"#7c3aed" }} />} title={`Site Visit Photos (${photos.length})`} />
      <Image.PreviewGroup>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8 }}>
          {photos.map((photo, i) => (
            <div key={photo._id||i}>
              <Image src={photo.url} alt={photo.caption||`Photo ${i+1}`} style={{ width:"100%", height:90, objectFit:"cover", borderRadius:8, border:"2px solid #c4b5fd", cursor:"pointer" }} preview={{ mask:<EyeOutlined style={{ fontSize:16 }} /> }} />
              {photo.caption && <div style={{ fontSize:10, color:"#6b7280", marginTop:3, textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{photo.caption}</div>}
              {photo.taken_at && <div style={{ fontSize:9, color:"#9ca3af", textAlign:"center" }}>{dayjs(photo.taken_at).format("DD MMM, HH:mm")}</div>}
            </div>
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  );
};

// ─── Payment Info Panel ───────────────────────────────────────────────────────
const PaymentInfoPanel = ({ job }) => {
  const paid = parseFloat(job.payment_amount||0);
  const balance = parseFloat(job.balance_amount||0);
  const nextDue = job.next_due_date;
  const hasDue  = nextDue && balance>0;
  if (!job.payment_mode && paid<=0) return null;
  let dueColor="#1e40af", dueBg="#eff6ff", dueBorder="#93c5fd", dueMsg="";
  if (hasDue) {
    const diff = dayjs(nextDue).startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff<0)  { dueColor="#991b1b"; dueBg="#fee2e2"; dueBorder="#fca5a5"; dueMsg=`Overdue by ${Math.abs(diff)} day${Math.abs(diff)>1?"s":""}`; }
    else if (diff===0) { dueColor="#92400e"; dueBg="#fef3c7"; dueBorder="#fcd34d"; dueMsg="Due today"; }
    else if (diff<=3)  { dueColor="#c2410c"; dueBg="#fff7ed"; dueBorder="#fdba74"; dueMsg=`Due in ${diff} day${diff>1?"s":""}`; }
    else { dueMsg=`Due in ${diff} days`; }
  }
  return (
    <div style={{ background:"#f0fdf4", borderRadius:10, padding:"12px 14px", border:"1px solid #bbf7d0" }}>
      <SectionHeader icon={<WalletOutlined />} title="Payment" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:hasDue?12:0 }}>
        <InfoRow label="Payment Mode" value={job.payment_mode||"—"} />
        <InfoRow label="Amount Paid" value={paid>0?`₹${paid.toFixed(2)}`:"Unpaid"} valueStyle={{ color:paid>0?"#16a34a":"#dc2626" }} />
        {balance>0 && <InfoRow label="Balance Due" value={`₹${balance.toFixed(2)}`} valueStyle={{ color:"#dc2626", fontWeight:800 }} />}
        {hasDue && <InfoRow label="Next Due Date" value={dayjs(nextDue).format("DD MMM YYYY")} valueStyle={{ color:dueColor, fontWeight:700 }} />}
      </div>
      {hasDue && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", background:dueBg, border:`1px solid ${dueBorder}`, borderRadius:8 }}>
          <CalendarOutlined style={{ color:dueColor, fontSize:16, flexShrink:0, marginTop:2 }} />
          <div>
            <div style={{ fontWeight:700, color:dueColor, fontSize:13 }}>₹{balance.toFixed(2)} balance due on {dayjs(nextDue).format("dddd, DD MMM YYYY")}</div>
            <div style={{ fontSize:11, color:dueColor, opacity:0.8, marginTop:2 }}>{dueMsg}</div>
          </div>
        </div>
      )}
      {balance<=0 && paid>0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:8 }}>
          <CheckCircleOutlined style={{ color:"#16a34a", fontSize:16 }} />
          <span style={{ fontWeight:700, color:"#065f46", fontSize:13 }}>Fully paid — no outstanding balance</span>
        </div>
      )}
    </div>
  );
};

// ─── DesignFileUpload (inline, no external helper needed) ─────────────────────
const DesignFileUpload = ({ value, onChange }) => {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => { onChange(e.target.result); setBusy(false); };
      reader.onerror = () => setBusy(false);
      reader.readAsDataURL(file);
    } catch { setBusy(false); }
  };

  return (
    <div>
      <input ref={fileRef}   type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>handleFile(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e=>handleFile(e.target.files?.[0])} />
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <Button size="small" icon={<UploadOutlined />} loading={busy} onClick={()=>fileRef.current?.click()} style={{ borderRadius:6, fontSize:12 }}>
          {value?"Change":"Upload Design"}
        </Button>
        {!busy && <Button size="small" icon={<CameraOutlined />} onClick={()=>cameraRef.current?.click()} style={{ borderRadius:6, fontSize:12 }}>Camera</Button>}
        {value && !busy && <Button size="small" danger type="text" onClick={()=>onChange("")} style={{ fontSize:12 }}>Remove</Button>}
      </div>
      {value && !busy && (
        <div style={{ marginTop:8, border:"1px solid #e5e7eb", borderRadius:8, background:"#f9fafb", padding:4, display:"flex", justifyContent:"center", maxHeight:120, overflow:"hidden" }}>
          <img src={value} alt="Design Preview" style={{ maxHeight:110, maxWidth:"100%", objectFit:"contain", borderRadius:4 }} onError={e=>{e.currentTarget.style.display="none";}} />
        </div>
      )}
    </div>
  );
};

// ─── ProductItemRow ───────────────────────────────────────────────────────────
const ProductItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile, isTablet }) => {
  const [showSuggest, setShowSuggest] = useState(false);
  const ref = useRef(null);
  const matched  = PRODUCTS.filter(p=>p.product_name.toLowerCase().includes((item.product_name||"").toLowerCase()));
  const selected = PRODUCTS.find(p=>p.product_name.toLowerCase()===(item.product_name||"").toLowerCase());

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sizeChange = (field, val) => {
    const updated = { ...item, [field]:val };
    if (!updated.sq_ft_manual) updated.sq_ft = parseFloat(toSqFt(updated.width, updated.height, updated.size_unit).toFixed(4));
    onChange(idx, updated);
  };
  const set = (f, v) => onChange(idx, { ...item, [f]:v });
  const handleQtyTypeChange = (val) => onChange(idx, { ...item, quantity_type:val, ...(val==="quantity"?{sq_ft:0,sq_ft_manual:false,width:"",height:""}:{}) });

  const isSqFtMode = item.quantity_type==="sq.ft";
  const { base, gstAmt, total:lineTotal } = computeProductLineTotal(item);
  const productCols = isMobile?"1fr":isTablet?"1fr 1fr":"1fr 1fr 1fr";
  const sizeCols    = isSqFtMode?(isMobile?"1fr 1fr":"1fr 1fr 90px 1fr"):(isMobile?"1fr 1fr":"1fr 1fr 90px");
  const priceCols   = isMobile?"1fr 1fr":"repeat(3,1fr)";

  return (
    <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, padding:isMobile?10:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#374151", background:"#e0e7ff", padding:"2px 10px", borderRadius:20 }}>Item {idx+1}</span>
          <Radio.Group size="small" value={item.quantity_type} onChange={e=>handleQtyTypeChange(e.target.value)} buttonStyle="solid">
            {QTY_TYPE_OPTIONS.map(o=>(
              <Radio.Button key={o.value} value={o.value} style={{ fontSize:11, fontWeight:600, height:24, lineHeight:"22px", padding:"0 10px" }}>{o.label}</Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <Popconfirm title="Remove this item?" onConfirm={()=>onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:productCols, gap:8, marginBottom:10 }}>
        <FormField label="Product Name" required>
          <div style={{ position:"relative" }} ref={ref}>
            <Input placeholder="Type product…" value={item.product_name} size="small" autoComplete="off" style={{ borderRadius:6 }}
              onChange={e=>{ onChange(idx,{...item,product_name:e.target.value,variation:"",printing_type:""}); setShowSuggest(true); }}
              onFocus={()=>setShowSuggest(true)} />
            {showSuggest && matched.length>0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, zIndex:9999, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", overflow:"hidden" }}>
                {matched.map(p=>(
                  <div key={p.product_id}
                    onMouseDown={()=>{ onChange(idx,{...item,product_name:p.product_name,product_id:p.product_id,variation:"",printing_type:""}); setShowSuggest(false); }}
                    style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, color:"#1a1a2e", fontWeight:600, borderBottom:"1px solid #f3f4f6" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    🖨️ {p.product_name}
                    <span style={{ marginLeft:6, fontSize:10, color:"#6b7280", fontWeight:400 }}>{p.printing_type?.join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormField>
        <FormField label="Material">
          <Select placeholder={selected?"Select variation":"—"} value={item.variation||undefined} size="small" style={{ width:"100%" }} disabled={!selected} onChange={v=>set("variation",v)}>
            {(selected?.variations||[]).map(v=><Option key={v} value={v}>{v}</Option>)}
          </Select>
        </FormField>
        <FormField label="Printing Type">
          <Select placeholder={selected?"Select type":"—"} value={item.printing_type||undefined} size="small" style={{ width:"100%" }} disabled={!selected} onChange={v=>set("printing_type",v)}>
            {(selected?.printing_type||[]).map(t=><Option key={t} value={t}>{t}</Option>)}
          </Select>
        </FormField>
      </div>

        {isSqFtMode && (
      <div style={{ display:"grid", gridTemplateColumns:sizeCols, gap:8, marginBottom:10, alignItems:"end" }}>
        <FormField label="Width" required={isSqFtMode}>
          <Input size="small" placeholder="0" type="number" min={0} value={item.width} prefix={<span style={{ fontSize:10,color:"#6b7280",fontWeight:700 }}>W</span>} style={{ borderRadius:6 }} onChange={e=>sizeChange("width",e.target.value)} />
        </FormField>
        <FormField label="Height" required={isSqFtMode}>
          <Input size="small" placeholder="0" type="number" min={0} value={item.height} prefix={<span style={{ fontSize:10,color:"#6b7280",fontWeight:700 }}>H</span>} style={{ borderRadius:6 }} onChange={e=>sizeChange("height",e.target.value)} />
        </FormField>
        <FormField label="Unit">
          <Select value={item.size_unit} size="small" style={{ width:"100%" }} onChange={v=>sizeChange("size_unit",v)}>
            {UNIT_OPTIONS.map(u=><Option key={u.value} value={u.value}>{u.label}</Option>)}
          </Select>
        </FormField>
          <FormField label="Sq. Ft">
            <InputNumber size="small" min={0} precision={4} value={item.sq_ft}
              style={{ width:"100%", borderRadius:6, background:item.sq_ft>0?"#ecfdf5":undefined, borderColor:item.sq_ft>0?"#6ee7b7":undefined }}
              onChange={v=>onChange(idx,{...item,sq_ft:parseFloat((v||0).toFixed(4)),sq_ft_manual:true})} />
          </FormField>
      </div>
        )}

      <div style={{ marginBottom:10 }}>
        <FormField label="Notes / Specs">
          <Input placeholder="Custom text, specs…" value={item.notes} size="small" style={{ borderRadius:6 }} onChange={e=>set("notes",e.target.value)} />
        </FormField>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:priceCols, gap:8, marginBottom:10 }}>
        <FormField label="Quantity" required>
          <InputNumber min={1} value={item.quantity} size="small" style={{ width:"100%", borderRadius:6 }} onChange={v=>set("quantity",v||1)} />
        </FormField>
        <FormField label={isSqFtMode?"Price / sq.ft (₹)":"Unit Price (₹)"} required>
          <InputNumber min={0} value={item.price} size="small" style={{ width:"100%", borderRadius:6 }} prefix="₹" onChange={v=>set("price",v||0)} />
        </FormField>
        <FormField label="GST %">
          <Select value={item.gst_percentage??0} size="small" style={{ width:"100%" }} onChange={v=>set("gst_percentage",v)}>
            {GST_OPTIONS.map(g=><Option key={g} value={g}>{g===0?"No GST":`${g}%`}</Option>)}
          </Select>
        </FormField>
      </div>

      <div style={{ marginBottom:10 }}>
        <FormField label="Design File">
          <DesignFileUpload value={item.design_file} onChange={path=>set("design_file",path)} />
        </FormField>
      </div>

      <div style={{ background:"#fff", border:"1px solid #d1fae5", borderRadius:8, padding:"8px 14px", textAlign:"right" }}>
        <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>
          Base: <span style={{ fontWeight:600, color:"#374151" }}>₹{base.toFixed(2)}</span>
          {isSqFtMode && item.sq_ft>0 && <span style={{ marginLeft:6, fontSize:10, color:"#9ca3af" }}>({item.quantity} qty × {item.sq_ft} ft² × ₹{item.price}/ft²)</span>}
          {!isSqFtMode && <span style={{ marginLeft:6, fontSize:10, color:"#9ca3af" }}>({item.quantity} qty × ₹{item.price})</span>}
          {(item.gst_percentage||0)>0 && <span style={{ marginLeft:8 }}>+ GST ({item.gst_percentage}%): <span style={{ fontWeight:600, color:"#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:"#065f46" }}>Item Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── OfficeServiceItemRow ─────────────────────────────────────────────────────
const OfficeServiceItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile }) => {
  const set = (f, v) => onChange(idx, { ...item, [f]:v });
  const selectedType = OFFICE_WORK_TYPES.find(t=>t.value===item.office_type);
  const { base, gstAmt, total:lineTotal, qty } = computeOfficeServiceLineTotal(item);

  const renderCalcFields = () => {
    const calc = selectedType?.calc;
    if (calc==="days") return (
      <FormField label="Number of Days" required>
        <InputNumber min={1} value={item.days} size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="days" onChange={v=>set("days",v||1)} />
      </FormField>
    );
    if (calc==="hours") return (
      <FormField label="Number of Hours" required>
        <InputNumber min={0} step={0.5} value={item.hours} size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="hrs" onChange={v=>set("hours",v||0)} />
      </FormField>
    );
    if (calc==="counts") return (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <FormField label="Reels Count"><InputNumber min={0} value={item.reels_count} size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="reels" onChange={v=>set("reels_count",v||0)} /></FormField>
        <FormField label="Post Count"><InputNumber min={0} value={item.post_count} size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="posts" onChange={v=>set("post_count",v||0)} /></FormField>
      </div>
    );
    return null;
  };

  const getUnitLabel = () => {
    const calc = selectedType?.calc;
    if (calc==="days") return "Price / Day (₹)";
    if (calc==="hours") return "Price / Hour (₹)";
    return "Price / Item (₹)";
  };

  const getQtyLabel = () => {
    const calc = selectedType?.calc;
    if (calc==="days") return `${qty} day${qty!==1?"s":""}`;
    if (calc==="hours") return `${qty} hr${qty!==1?"s":""}`;
    return `${item.reels_count||0} reels + ${item.post_count||0} posts`;
  };

  return (
    <div style={{ background:"#fafaf9", border:"1px solid #e5e7eb", borderRadius:10, padding:isMobile?10:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#374151", background:"#fef3c7", padding:"2px 10px", borderRadius:20 }}>
          {selectedType?.icon} {selectedType?.label||"Office Work"} #{idx+1}
        </span>
        <Popconfirm title="Remove this service?" onConfirm={()=>onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:10 }}>
        <FormField label="Service Name">
          <Input placeholder="e.g. Company Website…" value={item.service_name} size="small" style={{ borderRadius:6 }} onChange={e=>set("service_name",e.target.value)} />
        </FormField>
        <FormField label="Service Type" required>
          <Select value={item.office_type} size="small" style={{ width:"100%" }} onChange={v=>onChange(idx,{...item,office_type:v,days:1,hours:1,reels_count:0,post_count:0})}>
            {OFFICE_WORK_TYPES.map(t=><Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>)}
          </Select>
        </FormField>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":(item.office_type==="social_media"?"1fr":"1fr 1fr 1fr"), gap:8, marginBottom:10, alignItems:"end" }}>
        <div style={{ gridColumn:item.office_type==="social_media"?"1/-1":undefined }}>{renderCalcFields()}</div>
        {item.office_type!=="social_media" && (
          <>
            <FormField label={getUnitLabel()} required>
              <InputNumber min={0} value={item.price} size="small" style={{ width:"100%", borderRadius:6 }} prefix="₹" onChange={v=>set("price",v||0)} />
            </FormField>
            <FormField label="GST %">
              <Select value={item.gst_percentage} size="small" style={{ width:"100%" }} onChange={v=>set("gst_percentage",v)}>
                {GST_OPTIONS.map(g=><Option key={g} value={g}>{g===0?"No GST":`${g}%`}</Option>)}
              </Select>
            </FormField>
          </>
        )}
      </div>

      {item.office_type==="social_media" && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:10 }}>
          <FormField label="Price / Item (₹)" required>
            <InputNumber min={0} value={item.price} size="small" style={{ width:"100%", borderRadius:6 }} prefix="₹" onChange={v=>set("price",v||0)} />
          </FormField>
          <FormField label="GST %">
            <Select value={item.gst_percentage} size="small" style={{ width:"100%" }} onChange={v=>set("gst_percentage",v)}>
              {GST_OPTIONS.map(g=><Option key={g} value={g}>{g===0?"No GST":`${g}%`}</Option>)}
            </Select>
          </FormField>
        </div>
      )}

      <div style={{ marginBottom:10 }}>
        <FormField label="Notes">
          <Input placeholder="Additional notes…" value={item.notes} size="small" style={{ borderRadius:6 }} onChange={e=>set("notes",e.target.value)} />
        </FormField>
      </div>

      <div style={{ background:"#fff", border:"1px solid #fde68a", borderRadius:8, padding:"8px 14px", textAlign:"right" }}>
        <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>
          {getQtyLabel()} × ₹{item.price} = <span style={{ fontWeight:600, color:"#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage>0 && <span style={{ marginLeft:8 }}>GST ({item.gst_percentage}%): <span style={{ fontWeight:600, color:"#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:"#92400e" }}>Service Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── LabourItemRow ────────────────────────────────────────────────────────────
const LabourItemRow = ({ item, idx, onChange, onRemove, isOnly, isMobile }) => {
  const set = (f, v) => onChange(idx, { ...item, [f]:v });
  const { base, gstAmt, total:lineTotal, sqFtAmt, hoursAmt } = computeLabourLineTotal(item);

  return (
    <div style={{ background:"#fafaf9", border:"1px solid #e5e7eb", borderRadius:10, padding:isMobile?10:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#374151", background:"#f3e8ff", padding:"2px 10px", borderRadius:20 }}>🔧 Labour #{idx+1}</span>
        <Popconfirm title="Remove this labour entry?" onConfirm={()=>onRemove(idx)} disabled={isOnly} okText="Yes" cancelText="No">
          <Button icon={<DeleteOutlined />} size="small" danger type="text" disabled={isOnly} />
        </Popconfirm>
      </div>

      <div style={{ marginBottom:10 }}>
        <FormField label="Work Description">
          <Input placeholder="e.g. Flex installation, cutting, finishing…" value={item.service_name} size="small" style={{ borderRadius:6 }} onChange={e=>set("service_name",e.target.value)} />
        </FormField>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:8, marginBottom:10 }}>
        <FormField label="Sq. Ft"><InputNumber min={0} step={0.5} value={item.sq_ft||undefined} placeholder="0" size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="ft²" onChange={v=>set("sq_ft",v||0)} /></FormField>
        <FormField label="Price / Sq. Ft (₹)"><InputNumber min={0} value={item.price_per_sqft||undefined} placeholder="0" size="small" style={{ width:"100%", borderRadius:6 }} prefix="₹" onChange={v=>set("price_per_sqft",v||0)} /></FormField>
        <FormField label="Hours"><InputNumber min={0} step={0.5} value={item.hours||undefined} placeholder="0" size="small" style={{ width:"100%", borderRadius:6 }} addonAfter="hrs" onChange={v=>set("hours",v||0)} /></FormField>
        <FormField label="Price / Hour (₹)"><InputNumber min={0} value={item.price_per_hour||undefined} placeholder="0" size="small" style={{ width:"100%", borderRadius:6 }} prefix="₹" onChange={v=>set("price_per_hour",v||0)} /></FormField>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:10 }}>
        <FormField label="GST %">
          <Select value={item.gst_percentage} size="small" style={{ width:"100%" }} onChange={v=>set("gst_percentage",v)}>
            {GST_OPTIONS.map(g=><Option key={g} value={g}>{g===0?"No GST":`${g}%`}</Option>)}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Input placeholder="Notes…" value={item.notes} size="small" style={{ borderRadius:6 }} onChange={e=>set("notes",e.target.value)} />
        </FormField>
      </div>

      <div style={{ background:"#fff", border:"1px solid #e9d5ff", borderRadius:8, padding:"8px 14px", textAlign:"right" }}>
        <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>
          {item.sq_ft>0 && <span>{item.sq_ft} ft² × ₹{item.price_per_sqft} = ₹{sqFtAmt.toFixed(2)}</span>}
          {item.sq_ft>0 && item.hours>0 && <span style={{ margin:"0 6px", color:"#9ca3af" }}>+</span>}
          {item.hours>0 && <span>{item.hours} hrs × ₹{item.price_per_hour} = ₹{hoursAmt.toFixed(2)}</span>}
        </div>
        <div style={{ fontSize:11, color:"#6b7280", marginBottom:2 }}>
          Base: <span style={{ fontWeight:600, color:"#374151" }}>₹{base.toFixed(2)}</span>
          {item.gst_percentage>0 && <span style={{ marginLeft:8 }}>GST ({item.gst_percentage}%): <span style={{ fontWeight:600, color:"#d97706" }}>₹{gstAmt.toFixed(2)}</span></span>}
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:"#6b21a8" }}>Labour Total: ₹{lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ─── JobItemsSection ──────────────────────────────────────────────────────────
const JobItemsSection = ({ productItems, officeItems, labourItems, onProductChange, onOfficeChange, onLabourChange, onAddProduct, onAddOffice, onAddLabour, onRemoveProduct, onRemoveOffice, onRemoveLabour, isMobile, isTablet }) => {
  const tabItems = [
    {
      key:"product",
      label:(
        <span style={{ display:"flex", alignItems:"center", gap:6 }}>
          <AppstoreOutlined /> Product
          {productItems.length>0 && <Tag color="blue" style={{ margin:0, fontSize:10, lineHeight:"16px", padding:"0 5px" }}>{productItems.length}</Tag>}
        </span>
      ),
      children:(
        <div style={{ display:"flex", flexDirection:"column", gap:10, paddingTop:8 }}>
          {productItems.map((item,idx)=>(
            <ProductItemRow key={idx} item={item} idx={idx} onChange={onProductChange} onRemove={onRemoveProduct}
              isOnly={productItems.length===1 && officeItems.length===0 && labourItems.length===0}
              isMobile={isMobile} isTablet={isTablet} />
          ))}
          <Button icon={<PlusOutlined />} onClick={onAddProduct} style={{ borderStyle:"dashed", borderRadius:8, color:"#6b7280", height:40, borderColor:"#93c5fd" }}>Add Product Item</Button>
        </div>
      ),
    },
    {
      key:"service",
      label:(
        <span style={{ display:"flex", alignItems:"center", gap:6 }}>
          <ToolOutlined /> Service
          {(officeItems.length+labourItems.length)>0 && <Tag color="orange" style={{ margin:0, fontSize:10, lineHeight:"16px", padding:"0 5px" }}>{officeItems.length+labourItems.length}</Tag>}
        </span>
      ),
      children:(
        <Tabs size="small" type="card" items={[
          {
            key:"office",
            label:(<span style={{ display:"flex", alignItems:"center", gap:5 }}><AppstoreOutlined style={{ fontSize:12 }}/> Office Work {officeItems.length>0&&<Tag color="gold" style={{ margin:0, fontSize:10, lineHeight:"14px", padding:"0 4px" }}>{officeItems.length}</Tag>}</span>),
            children:(
              <div style={{ display:"flex", flexDirection:"column", gap:10, paddingTop:8 }}>
                {officeItems.map((item,idx)=>(
                  <OfficeServiceItemRow key={idx} item={item} idx={idx} onChange={onOfficeChange} onRemove={onRemoveOffice} isOnly={officeItems.length===1} isMobile={isMobile} />
                ))}
                <Button icon={<PlusOutlined />} onClick={onAddOffice} style={{ borderStyle:"dashed", borderRadius:8, color:"#6b7280", height:40, borderColor:"#fcd34d" }}>Add Office Work</Button>
              </div>
            ),
          },
          {
            key:"labour",
            label:(<span style={{ display:"flex", alignItems:"center", gap:5 }}><ToolOutlined style={{ fontSize:12 }}/> Labour Work {labourItems.length>0&&<Tag color="purple" style={{ margin:0, fontSize:10, lineHeight:"14px", padding:"0 4px" }}>{labourItems.length}</Tag>}</span>),
            children:(
              <div style={{ display:"flex", flexDirection:"column", gap:10, paddingTop:8 }}>
                {labourItems.map((item,idx)=>(
                  <LabourItemRow key={idx} item={item} idx={idx} onChange={onLabourChange} onRemove={onRemoveLabour} isOnly={labourItems.length===1} isMobile={isMobile} />
                ))}
                <Button icon={<PlusOutlined />} onClick={onAddLabour} style={{ borderStyle:"dashed", borderRadius:8, color:"#6b7280", height:40, borderColor:"#c4b5fd" }}>Add Labour Work</Button>
              </div>
            ),
          },
        ]} />
      ),
    },
  ];
  return <Tabs defaultActiveKey="product" type="card" size="middle" style={{ marginBottom:14 }} items={tabItems} />;
};

// ─── ViewCartItems ────────────────────────────────────────────────────────────
// Read-only display of cart items in view modal
const ViewCartItems = ({ cartItems, isMobile }) => {
  if (!cartItems?.length) return <div style={{ color:"#9ca3af", fontSize:13, padding:"8px 0" }}>No items.</div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {cartItems.map((it, i) => {
        const cat = it.item_category;
        let lineTotal = 0, summary = "";
        if (cat==="service_office") {
          const r = computeOfficeServiceLineTotal(it);
          lineTotal = r.total;
          summary = `${it.office_type} · ₹${r.base.toFixed(2)} base`;
        } else if (cat==="service_labour") {
          const r = computeLabourLineTotal(it);
          lineTotal = r.total;
          summary = `${it.sq_ft||0} ft² + ${it.hours||0} hrs · ₹${r.base.toFixed(2)} base`;
        } else {
          const r = computeProductLineTotal(it);
          lineTotal = r.total;
          summary = it.quantity_type==="sq.ft"
            ? `${it.quantity} × ${it.sq_ft} ft² × ₹${it.price}/ft² = ₹${r.base.toFixed(2)}`
            : `${it.quantity} × ₹${it.price} = ₹${r.base.toFixed(2)}`;
        }
        const isProduct = !cat || cat==="product";
        const bgColor   = cat==="service_office"?"#fffbeb":cat==="service_labour"?"#faf5ff":"#fff";
        const borderColor = cat==="service_office"?"#fde68a":cat==="service_labour"?"#e9d5ff":"#e5e7eb";
        return (
          <div key={it._id||it.item_id||i} style={{ background:bgColor, border:`1px solid ${borderColor}`, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:6, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#374151", background:"#e0e7ff", padding:"2px 8px", borderRadius:20 }}>#{i+1}</span>
                <span style={{ fontWeight:700, fontSize:14, color:"#1a1a2e", textTransform:"capitalize" }}>{it.product_name||it.service_name||"—"}</span>
                {it.variation && <Tag style={{ fontSize:10, margin:0 }}>{it.variation}</Tag>}
                {it.printing_type && <Tag color="blue" style={{ fontSize:10, margin:0 }}>{it.printing_type}</Tag>}
                {cat==="service_office" && <Tag color="gold" style={{ fontSize:10, margin:0 }}>Office Work</Tag>}
                {cat==="service_labour" && <Tag color="purple" style={{ fontSize:10, margin:0 }}>Labour</Tag>}
              </div>
              <div style={{ fontWeight:700, color:"#065f46", fontSize:15, background:"#d1fae5", padding:"2px 10px", borderRadius:8 }}>₹{lineTotal.toFixed(2)}</div>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>{summary}</div>
            {isProduct && it.size && <div style={{ fontSize:11, color:"#374151" }}>Size: {it.size}</div>}
            {it.notes && <div style={{ marginTop:6, fontSize:12, color:"#6b7280", fontStyle:"italic", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:6, padding:"4px 8px" }}>Note: "{it.notes}"</div>}
            {/* design files */}
            {(it.design_files||[]).length>0 && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", marginBottom:4, textTransform:"uppercase" }}>Design Files</div>
                <Image.PreviewGroup>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {(it.design_files||[]).map((df,di)=>(
                      <div key={df._id||di} style={{ textAlign:"center" }}>
                        <Image src={df.url} alt={df.file_name||`Design ${di+1}`} style={{ height:70, width:70, objectFit:"cover", borderRadius:6, border:"1px solid #e5e7eb", cursor:"pointer" }} preview={{ mask:<EyeOutlined /> }} />
                        {df.label && <div style={{ fontSize:9, color:"#6b7280", marginTop:2 }}>{df.label}</div>}
                      </div>
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            )}
            {it.design_file && !(it.design_files||[]).length && (
              <div style={{ marginTop:8 }}>
                <img src={it.design_file} alt="Design" style={{ maxHeight:80, maxWidth:"100%", borderRadius:6, objectFit:"contain", border:"1px solid #e5e7eb" }} onError={e=>{e.currentTarget.style.display="none";}} />
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
  const [viewModal, setViewModal]   = useState(false);
  const [viewJob,   setViewJob]     = useState(null);
  const [loading,   setLoading]     = useState(false);
  const [jobs,      setJobs]        = useState([]);
  const [total,     setTotal]       = useState(0);
  const [search,    setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [page,     setPage]         = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [lastRefreshed, setLastRefreshed] = useState(dayjs());
  const [countdown, setCountdown]   = useState(AUTO_REFRESH_INTERVAL/1000);

  // Edit modal
  const [editModal,   setEditModal]   = useState(false);
  const [editJob,     setEditJob]     = useState(null);
  const [editForm,    setEditForm]    = useState({...DEFAULT_EDIT_FORM});
  const [editProductItems, setEditProductItems] = useState([{...EMPTY_PRODUCT_ITEM}]);
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

  const autoRefreshRef = useRef(null);
  const countdownRef   = useRef(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadJobs = useCallback(async (silent=false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch("https://api.dmedia.in/api/jobs", { headers:{ Authorization:`Bearer ${localStorage.getItem("authToken")}` } });
      const data = await res.json();
      const rows = extractJobs(data);
      setJobs(rows);
      setTotal(extractTotal(data, rows.length));
      setLastRefreshed(dayjs());
      setCountdown(AUTO_REFRESH_INTERVAL/1000);
    } catch (err) {
      ERROR_NOTIFICATION({ message:err.message||"Failed to load jobs" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    clearInterval(autoRefreshRef.current);
    clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_INTERVAL/1000);
    countdownRef.current   = setInterval(()=>setCountdown(p=>p<=1?AUTO_REFRESH_INTERVAL/1000:p-1), 1000);
    autoRefreshRef.current = setInterval(()=>loadJobs(true), AUTO_REFRESH_INTERVAL);
  }, [loadJobs]);

  useEffect(()=>{ loadJobs(); startAutoRefresh(); return ()=>{ clearInterval(autoRefreshRef.current); clearInterval(countdownRef.current); }; }, []);
  useEffect(()=>{ setPage(1); }, [search, statusFilter, pageSize]);

  // ── Designers ──────────────────────────────────────────────────────────────
  const fetchDesigners = async () => {
    setDesignersLoading(true);
    try {
      const res  = await fetch("https://api.dmedia.in/api/admin/get_admin", { headers:{ Authorization:`Bearer ${localStorage.getItem("authToken")}` } });
      const data = await res.json();
      const team = (data.data||[]).filter(u=>u.role==="designing team");
      setDesigners(team); return team;
    } catch { ERROR_NOTIFICATION({ message:"Could not load designers list" }); return []; }
    finally { setDesignersLoading(false); }
  };

  const openApproveModal = async (job) => { setApprovingJob(job); setSelectedDesigner(null); setApproveModalOpen(true); await fetchDesigners(); };

  const handleApproveWithDesigner = async () => {
    if (!selectedDesigner) { ERROR_NOTIFICATION({ message:"Please select a designer." }); return; }
    setApproving(true);
    try {
      const profile = localStorage.getItem("userprofile") ? JSON.parse(localStorage.getItem("userprofile")) : {};
      const isCustomer = selectedDesigner._id==="customer_designed";
      const body = isCustomer
        ? { job_status:"design", approved_by:profile.name||null, approved_by_admin_id:profile._id||null, is_customer_designed:true }
        : { job_status:"design", approved_by:profile.name||null, approved_by_admin_id:profile._id||null, assign_to:{ user_id:selectedDesigner._id, name:selectedDesigner.name||selectedDesigner.fullName||"Unknown" } };
      const res  = await fetch(`https://api.dmedia.in/api/jobs/${approvingJob._id}/approve`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("authToken")}`}, body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok||!data.success) throw new Error(data.message||"Approval failed");
      SUCCESS_NOTIFICATION({ message:isCustomer?`Job ${approvingJob.job_no} approved (customer design)`:`Job ${approvingJob.job_no} approved & assigned to ${selectedDesigner.name||"designer"}` });
      setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null);
      loadJobs(true);
    } catch (err) { ERROR_NOTIFICATION({ message:err.message||"Failed to approve" }); }
    finally { setApproving(false); }
  };

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const openEditModal = (record) => {
    setEditJob(record); setEditError("");
    const addr        = record.delivery_address||{};
    const streetParts = (addr.street||"").split(", ");
    const storedDisc  = parseFloat(record.discount_amount)||0;
    const legacyPct   = parseFloat(record.discount_percentage)||0;
    let legacyDisc=0;
    if (!storedDisc && legacyPct>0) {
      const sub=(record.cart_items||[]).reduce((acc,it)=>acc+computeProductLineTotal(it).base,0);
      legacyDisc=sub*(legacyPct/100);
    }
    setEditForm({
      customer_name:           record.customer_name||"",
      customer_phone:          record.customer_phone||"",
      company_name:            record.company_name||"",
      estimated_delivery_date: record.estimated_delivery_date?dayjs(record.estimated_delivery_date).format("YYYY-MM-DDTHH:mm"):"",
      address_line1: streetParts[0]||"",
      address_line2: streetParts.slice(1).join(", ")||"",
      city:    addr.city||"", state: addr.state||"", pincode: addr.pincode||"", country: addr.country||"India",
      gst_no:           record.gst_no||"",
      delivery_charges: record.delivery_charges??0,
      free_delivery:    record.free_delivery??false,
      design_charges:   record.design_charges??0,
      discount_amount:  storedDisc||legacyDisc||0,
      payment_mode:     record.payment_mode||"",
      payment_amount:   record.payment_amount||"",
      next_due_date:    record.next_due_date?dayjs(record.next_due_date):null,
      notes:            record.notes||"",
      terms_and_conditions: record.terms_and_conditions||"Payment due within 30 days.\nPrices subject to change without notice.\nDelivery: 7-10 business days after confirmation.",
    });

    const allItems = record.cart_items||[];

    // Products
    const products = allItems.filter(it=>it.item_category==="product"||!it.item_category);
    const mappedProducts = products.map(it=>{
      let width=String(it.width||""), height=String(it.height||""), size_unit=it.size_unit||"ft";
      if ((!width||!height)&&it.size){ const m=it.size.match(/^([\d.]+)\s*[×xX]\s*([\d.]+)\s*(\w+)/); if(m){width=m[1];height=m[2];size_unit=m[3]||"ft";} }
      const quantity_type=it.quantity_type||(parseFloat(width)>0&&parseFloat(height)>0?"sq.ft":"quantity");
      const sq_ft=it.sq_ft?parseFloat(it.sq_ft):quantity_type==="sq.ft"?parseFloat(toSqFt(width,height,size_unit).toFixed(4)):0;
      return { ...EMPTY_PRODUCT_ITEM,...it, item_category:"product", width, height, size_unit, sq_ft, quantity_type, gst_percentage:it.gst_percentage??0 };
    });
    setEditProductItems(mappedProducts.length?mappedProducts:[{...EMPTY_PRODUCT_ITEM}]);

    // Office
    const offices = allItems.filter(it=>it.item_category==="service_office");
    setEditOfficeItems(offices.map(it=>({...EMPTY_OFFICE_ITEM,...it,item_category:"service_office",gst_percentage:it.gst_percentage??0})));

    // Labour
    const labours = allItems.filter(it=>it.item_category==="service_labour");
    setEditLabourItems(labours.map(it=>({...EMPTY_LABOUR_ITEM,...it,item_category:"service_labour",gst_percentage:it.gst_percentage??0})));

    setEditModal(true);
  };

  const resetEditModal = () => {
    setEditModal(false); setEditJob(null); setEditError("");
    setEditForm({...DEFAULT_EDIT_FORM});
    setEditProductItems([{...EMPTY_PRODUCT_ITEM}]);
    setEditOfficeItems([]);
    setEditLabourItems([]);
  };

  const handleEditInput = (k, v) => setEditForm(p=>({...p,[k]:v}));

  const handlePaymentModeChange = (v) => {
    const newMode=v||"";
    const currentBalance=(editTotals?.grandTotal||0)-(parseFloat(editForm.payment_amount)||0);
    if (!editForm.next_due_date && currentBalance>0) {
      const suggested=getDefaultNextDueDate(newMode,parseFloat(editForm.payment_amount)||0,editTotals?.grandTotal||0);
      setEditForm(p=>({...p,payment_mode:newMode,next_due_date:suggested}));
    } else {
      setEditForm(p=>({...p,payment_mode:newMode}));
    }
  };

  const handlePaymentAmountChange = (v) => {
    const paid=v||0, grandTotal=editTotals?.grandTotal||0, balance=grandTotal-paid;
    if (balance<=0) {
      setEditForm(p=>({...p,payment_amount:v,next_due_date:null}));
    } else if (!editForm.next_due_date&&editForm.payment_mode) {
      const suggested=getDefaultNextDueDate(editForm.payment_mode,paid,grandTotal);
      setEditForm(p=>({...p,payment_amount:v,next_due_date:suggested}));
    } else {
      setEditForm(p=>({...p,payment_amount:v}));
    }
  };

  const editTotals = useMemo(()=>{
    let subtotal=0, taxAmount=0;
    editProductItems.forEach(it=>{ const r=computeProductLineTotal(it); subtotal+=r.base; taxAmount+=r.gstAmt; });
    editOfficeItems.forEach(it=>{  const r=computeOfficeServiceLineTotal(it); subtotal+=r.base; taxAmount+=r.gstAmt; });
    editLabourItems.forEach(it=>{  const r=computeLabourLineTotal(it); subtotal+=r.base; taxAmount+=r.gstAmt; });
    const discountAmt    =Math.min(parseFloat(editForm.discount_amount)||0,subtotal);
    const taxableAmount  =subtotal-discountAmt;
    const designCharges  =parseFloat(editForm.design_charges)||0;
    const deliveryCharges=editForm.free_delivery?0:parseFloat(editForm.delivery_charges)||0;
    const grandTotal     =taxableAmount+taxAmount+designCharges+deliveryCharges;
    const paid           =parseFloat(editForm.payment_amount)||0;
    const balance        =grandTotal-paid;
    return { subtotal, taxAmount, discountAmt, taxableAmount, designCharges, deliveryCharges, grandTotal, paid, balance };
  }, [editProductItems, editOfficeItems, editLabourItems, editForm]);

  const handleEditSubmit = async () => {
    setEditLoading(true); setEditError("");
    try {
      if (!editForm.customer_name.trim())    throw new Error("Customer name is required");
      if (!editForm.customer_phone.trim())   throw new Error("Phone number is required");
      if (!editForm.estimated_delivery_date) throw new Error("Estimated delivery date is required");

      const validProducts=editProductItems.filter(it=>{
        if (!it.product_name||!it.quantity_type) return false;
        if (it.quantity_type==="sq.ft"&&(it.sq_ft||0)<=0) return false;
        return (it.quantity||0)>0&&(it.price||0)>0;
      });
      const validOffice =editOfficeItems.filter(it=>it.office_type&&(it.price||0)>0);
      const validLabour =editLabourItems.filter(it=>it.sq_ft>0||it.hours>0);
      if (!validProducts.length&&!validOffice.length&&!validLabour.length) throw new Error("Add at least one valid item with price/qty");

      const cartItems=[
        ...validProducts.map(it=>{
          const { base,gstAmt,total }=computeProductLineTotal(it);
          const isSqFt=it.quantity_type==="sq.ft";
          return { item_category:"product", product_id:it.product_id||"", product_name:it.product_name, variation:it.variation||"", printing_type:it.printing_type||"", quantity:it.quantity, quantity_type:it.quantity_type, price:it.price, gst_percentage:it.gst_percentage||0, gst_amount:parseFloat(gstAmt.toFixed(2)), line_base:parseFloat(base.toFixed(2)), line_total:parseFloat(total.toFixed(2)), design_file:it.design_file||"", notes:it.notes||"", width:isSqFt?it.width:"", height:isSqFt?it.height:"", size_unit:isSqFt?it.size_unit:"pcs", sq_ft:isSqFt?it.sq_ft:0, sq_ft_manual:it.sq_ft_manual||false, size:isSqFt&&it.width&&it.height?`${it.width}×${it.height} ${it.size_unit} (${it.sq_ft} sq.ft)`:"" };
        }),
        ...validOffice.map(it=>{
          const { base,gstAmt,total,qty }=computeOfficeServiceLineTotal(it);
          return { item_category:"service_office", product_name:it.service_name||it.office_type, office_type:it.office_type, days:it.days||0, hours:it.hours||0, reels_count:it.reels_count||0, post_count:it.post_count||0, quantity:qty, quantity_type:it.office_type==="website"?"days":it.office_type==="social_media"?"items":"hours", price:it.price, gst_percentage:it.gst_percentage||0, gst_amount:parseFloat(gstAmt.toFixed(2)), line_base:parseFloat(base.toFixed(2)), line_total:parseFloat(total.toFixed(2)), notes:it.notes||"" };
        }),
        ...validLabour.map(it=>{
          const { base,gstAmt,total }=computeLabourLineTotal(it);
          return { item_category:"service_labour", product_name:it.service_name||"Labour Work", sq_ft:it.sq_ft||0, hours:it.hours||0, price_per_sqft:it.price_per_sqft||0, price_per_hour:it.price_per_hour||0, quantity:1, quantity_type:"labour", price:base||0, gst_percentage:it.gst_percentage||0, gst_amount:parseFloat(gstAmt.toFixed(2)), line_base:parseFloat(base.toFixed(2)), line_total:parseFloat(total.toFixed(2)), notes:it.notes||"" };
        }),
      ];

      const payload={
        customer_name:           editForm.customer_name.trim(),
        customer_phone:          editForm.customer_phone.trim(),
        company_name:            (editForm.company_name||"").trim(),
        estimated_delivery_date: dayjs(editForm.estimated_delivery_date).toISOString(),
        delivery_address:{ street:[editForm.address_line1,editForm.address_line2].filter(Boolean).join(", "), city:editForm.city, state:editForm.state, pincode:editForm.pincode, country:editForm.country },
        cart_items:          cartItems,
        gst_no:              editForm.gst_no.trim(),
        delivery_charges:    editTotals.deliveryCharges,
        free_delivery:       editForm.free_delivery,
        design_charges:      editTotals.designCharges,
        discount_amount:     parseFloat(editTotals.discountAmt.toFixed(2)),
        discount_percentage: 0,
        subtotal:            parseFloat(editTotals.subtotal.toFixed(2)),
        taxable_amount:      parseFloat(editTotals.taxableAmount.toFixed(2)),
        tax_amount:          parseFloat(editTotals.taxAmount.toFixed(2)),
        total_amount:        parseFloat(editTotals.grandTotal.toFixed(2)),
        payment_mode:        editForm.payment_mode||"",
        payment_amount:      parseFloat(editForm.payment_amount)||0,
        balance_amount:      parseFloat(editTotals.balance.toFixed(2)),
        next_due_date:       editTotals.balance>0&&editForm.next_due_date?dayjs(editForm.next_due_date).toISOString():null,
        notes:               editForm.notes,
        terms_and_conditions:editForm.terms_and_conditions,
      };

      const res  = await fetch(`https://api.dmedia.in/api/jobs/${editJob._id}`, { method:"PUT", headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("authToken")}`}, body:JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok||!data.success) throw new Error(data.message||"Failed to update job");
      SUCCESS_NOTIFICATION({ message:"Job updated successfully!" });
      resetEditModal(); loadJobs(true);
    } catch (err) { setEditError(err.message||"Failed to update job"); }
    finally { setEditLoading(false); }
  };

  // ── Layout vars ────────────────────────────────────────────────────────────
  const p   = isMobile?8:12;
  const g   = isMobile?8:12;
  const c2  = isMobile?"1fr":"1fr 1fr";
  const c3  = isMobile?"1fr":isTablet?"1fr 1fr":"1fr 1fr 1fr";
  const c4  = isMobile?"1fr 1fr":"repeat(4,1fr)";
  const c5  = isMobile?"1fr 1fr":isTablet?"1fr 1fr 1fr":"repeat(4,1fr)";
  const formatCountdown = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const modalWidth  = isMobile?"100vw":isTablet?"94vw":"min(96vw,900px)";
  const mobileStyle = isMobile?{top:0,margin:0,maxWidth:"100vw",padding:0}:{};
  const modalBody   = { maxHeight:isMobile?"calc(100dvh - 56px)":"85vh", overflowY:"auto", padding:isMobile?10:16 };
  const sheetStyle  = isMobile?{top:"auto",bottom:0,margin:0,maxWidth:"100vw",padding:0}:{};
  const sheetBody   = { maxHeight:isMobile?"72dvh":"80vh", overflowY:"auto", padding:isMobile?12:16 };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    { title:"#", width:36, render:(_,__,i)=><span style={{ color:"#9ca3af",fontSize:11 }}>{(page-1)*pageSize+i+1}</span> },
    {
      title:"Job No", dataIndex:"job_no",
      render:(n,record)=>{
        const isSV=isSiteVisitJob(record);
        const hasPaymentDue=record.next_due_date&&parseFloat(record.balance_amount||0)>0;
        return (
          <div style={{ display:"flex",flexDirection:"column",gap:3,alignItems:"flex-start" }}>
            <OverdueBadge estimated_delivery_date={record.estimated_delivery_date} />
            {hasPaymentDue && <PaymentDueBadge next_due_date={record.next_due_date} balance_amount={record.balance_amount} />}
            {isSV && <SiteVisitBadge />}
            <Tag color="blue" style={{ fontFamily:"monospace",fontWeight:600,fontSize:11,margin:0,border:isSV?"1px solid #a78bfa":undefined }}>{n||"—"}</Tag>
          </div>
        );
      },
    },
    {
      title:"Customer", key:"customer",
      render:(_,r)=>{
        const isSV=isSiteVisitJob(r);
        return (
          <div>
            <div style={{ fontWeight:600,fontSize:13,color:"#1a1a2e" }}>{r.customer_name||"—"}</div>
            {r.company_name && <div style={{ fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:3 }}><BankOutlined style={{ fontSize:10 }}/> {r.company_name}</div>}
            <div style={{ fontSize:11,color:"#6b7280" }}>{r.customer_phone||""}</div>
            {isSV&&r.site_visit_no && <div style={{ fontSize:10,color:"#7c3aed",fontWeight:600,display:"flex",alignItems:"center",gap:3,marginTop:2 }}><CompassOutlined style={{ fontSize:9 }}/> {r.site_visit_no}</div>}
            {isMobile&&(()=>{ const cfg=STATUS_CONFIG[r.job_status]||STATUS_CONFIG.draft; return <Tag color={cfg.color} icon={cfg.icon} style={{ marginTop:4,fontSize:10 }}>{cfg.label}</Tag>; })()}
          </div>
        );
      },
    },
    ...(!isMobile?[{
      title:"Est. Delivery", dataIndex:"estimated_delivery_date",
      render:(d)=>{
        if (!d) return <span style={{ color:"#9ca3af",fontSize:12 }}>—</span>;
        const info=getOverdueInfo(d);
        return (
          <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
            <span style={{ fontSize:12,color:"#374151",whiteSpace:"nowrap" }}>{dayjs(d).format("DD MMM YY")}</span>
            {info && <span style={{ fontSize:10,fontWeight:600,color:info.color,whiteSpace:"nowrap" }}>{info.isDueToday?"⚡ Today":info.isOverdue?`⚠ ${info.label}`:info.label}</span>}
          </div>
        );
      },
    }]:[]),
    {
      title:"Amount", key:"amount",
      render:(_,r)=>{
        const balance=parseFloat(r.balance_amount||0), paid=parseFloat(r.payment_amount||0);
        return (
          <div>
            <div style={{ fontWeight:700,fontSize:13,color:"#1a1a2e",whiteSpace:"nowrap" }}>₹{parseFloat(r.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2})}</div>
            {balance>0  && <div style={{ fontSize:10,color:"#dc2626",fontWeight:600 }}>Bal: ₹{balance.toLocaleString("en-IN",{minimumFractionDigits:2})}</div>}
            {balance<=0&&paid>0 && <div style={{ fontSize:10,color:"#16a34a",fontWeight:600 }}>✓ Paid</div>}
          </div>
        );
      },
    },
    ...(!isMobile?[{
      title:"Status", dataIndex:"job_status",
      render:(s)=>{ const c=STATUS_CONFIG[s]||STATUS_CONFIG.draft; return <Tag color={c.color} icon={c.icon} style={{ fontWeight:500 }}>{c.label}</Tag>; },
    }]:[]),
    ...(isDesktop?[{
      title:"Stage", key:"stage",
      render:(_,r)=>{ const stage=r.current_stage?.stage, label=WORKFLOW_STAGES.find(s=>s.value===stage)?.label; return stage?<Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize:11 }}>{label}</Tag>:<span style={{ color:"#9ca3af",fontSize:12 }}>—</span>; },
    }]:[]),
    {
      title:"Approved By", key:"approved_by", width:isMobile?100:130,
      render:(_,r)=>{
        if (!r.approved_by&&!r.approved_by_admin_id) return <span style={{ color:"#9ca3af",fontSize:12 }}>—</span>;
        return (
          <Tooltip title={r.approved_by_admin_id?`Admin ID: ${r.approved_by_admin_id}`:""}>
            <div style={{ display:"flex",alignItems:"center",gap:4 }}>
              <UserOutlined style={{ color:"#6b7280",fontSize:11 }}/>
              <span style={{ fontSize:12,fontWeight:500,color:"#374151" }}>{r.approved_by||"Unknown"}</span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title:"", width:isMobile?90:150,
      render:(_,record)=>(
        <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
          <Tooltip title="View Job"><Button icon={<EyeOutlined />} size="small" style={{ color:"#6b7280",borderColor:"#e5e7eb" }} onClick={()=>{ setViewJob(record); setViewModal(true); }}>{!isMobile&&"View"}</Button></Tooltip>
          <Tooltip title="Edit Job"><Button icon={<EditOutlined />} size="small" style={{ color:"#2563eb",borderColor:"#bfdbfe" }} onClick={()=>openEditModal(record)}>{!isMobile&&"Edit"}</Button></Tooltip>
          {record.job_status==="draft" && <Tooltip title="Approve & Assign"><Button type="primary" icon={<CheckCircleOutlined />} size="small" style={{ background:"#16a34a",borderColor:"#16a34a" }} onClick={()=>openApproveModal(record)}>{!isMobile&&"Approve"}</Button></Tooltip>}
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:p, background:"#f8fafc", minHeight:"100vh" }}>

      {/* Header */}
      <Card bodyStyle={{ padding:`${p}px ${p+4}px` }} style={{ borderRadius:12, border:"1px solid #e5e7eb", marginBottom:g, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <h2 style={{ margin:0, fontSize:isMobile?15:18, fontWeight:700, color:"#1a1a2e" }}>Job Management</h2>
            <p style={{ margin:0, fontSize:12, color:"#6b7280" }}><strong>{total}</strong> jobs · Refreshed {lastRefreshed.format("HH:mm:ss")}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"4px 10px" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 0 2px #bbf7d0", display:"inline-block", animation:"pulse 1.5s infinite" }} />
              <span style={{ fontSize:11, color:"#15803d", fontWeight:600, fontFamily:"monospace" }}>{formatCountdown(countdown)}</span>
            </div>
            <Tooltip title="Refresh now"><Button icon={<ReloadOutlined spin={loading} />} onClick={()=>{ loadJobs(); startAutoRefresh(); }} style={{ borderRadius:8 }} /></Tooltip>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card bodyStyle={{ padding:`${p}px ${p+4}px` }} style={{ borderRadius:12, border:"1px solid #e5e7eb", marginBottom:g, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", flexDirection:isMobile?"column":"row", gap:8 }}>
          <Input.Search placeholder="Search name, phone, job no…" allowClear onSearch={v=>{ setSearch(v); setPage(1); }} onChange={e=>{ if (!e.target.value){ setSearch(""); setPage(1); } }} style={{ flex:1 }} size="middle" />
          <Select placeholder="Filter Status" allowClear onChange={v=>{ setStatusFilter(v||null); setPage(1); }} size="middle" style={{ width:isMobile?"100%":180 }}>
            {Object.entries(STATUS_CONFIG).map(([k,{label,color}])=><Option key={k} value={k}><Tag color={color} style={{ fontWeight:500 }}>{label}</Tag></Option>)}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding:"0 0 8px 0" }} style={{ borderRadius:12, border:"1px solid #e5e7eb", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", overflow:"hidden" }}>
        <CustomTable dataSource={jobs} loading={loading} columns={columns} scroll={{ x:isMobile?360:820 }} rowKey={r=>r._id||r.job_no} size="small"
          rowClassName={record=>isSiteVisitJob(record)?"site-visit-row":""}
          pagination={{ current:page, pageSize, total, showSizeChanger:!isMobile, pageSizeOptions:["10","25","50"], showTotal:isMobile?undefined:(t,r)=>`${r[0]}-${r[1]} of ${t}`, onChange:(pg,ps)=>{ setPage(pg); setPageSize(ps); }, style:{ padding:"8px 12px" }, size:isMobile?"small":"default" }} />
      </Card>

      {/* ══ VIEW MODAL ══ */}
      <Modal open={viewModal} onCancel={()=>{ setViewModal(false); setViewJob(null); }}
        footer={<Button onClick={()=>{ setViewModal(false); setViewJob(null); }} style={{ borderRadius:8 }}>Close</Button>}
        title={
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <EyeOutlined style={{ color:"#6b7280" }} />
            <span style={{ fontWeight:700 }}>View Job</span>
            {viewJob && <Tag color="blue" style={{ fontFamily:"monospace",fontWeight:600,fontSize:11 }}>{viewJob.job_no}</Tag>}
            {viewJob && isSiteVisitJob(viewJob) && <SiteVisitBadge />}
            {viewJob?.estimated_delivery_date && <OverdueBadge estimated_delivery_date={viewJob.estimated_delivery_date} />}
            {viewJob?.next_due_date && parseFloat(viewJob.balance_amount||0)>0 && <PaymentDueBadge next_due_date={viewJob.next_due_date} balance_amount={viewJob.balance_amount} />}
          </div>
        }
        width={isMobile?"100vw":"min(96vw,760px)"} style={mobileStyle} styles={{ body:modalBody }} destroyOnClose>
        {viewJob&&(()=>{
          const cfg=STATUS_CONFIG[viewJob.job_status]||STATUS_CONFIG.draft;
          const addr=viewJob.delivery_address||{};
          const totals=calcJobTotals(viewJob);
          const overdueInfo=getOverdueInfo(viewJob.estimated_delivery_date);
          const isFromSV=isSiteVisitJob(viewJob);
          const fullAddress=[addr.street,addr.city,addr.state,addr.pincode,addr.country].filter(Boolean).join(", ");
          const stageCfg=viewJob.current_stage;
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* Site Visit Banner */}
              {isFromSV && (
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:"linear-gradient(135deg,#f5f3ff 0%,#ede9fe55 100%)", border:"2px solid #a78bfa", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, width:4, height:"100%", background:"linear-gradient(180deg,#7c3aed,#a78bfa)" }} />
                  <CompassOutlined style={{ color:"#7c3aed", fontSize:22, marginLeft:6, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:"#5b21b6", fontSize:13 }}>Created from a Site Visit</div>
                    {viewJob.site_visit_no && <div style={{ marginTop:4 }}><span style={{ fontSize:12, color:"#7c3aed" }}>Visit No: <strong style={{ fontFamily:"monospace" }}>{viewJob.site_visit_no}</strong></span></div>}
                  </div>
                </div>
              )}

              {/* Site Visit Photos */}
              {isFromSV && viewJob.site_visit_photos?.length>0 && <SiteVisitPhotosPanel photos={viewJob.site_visit_photos} />}

              {/* Overdue Alert */}
              {overdueInfo&&(overdueInfo.isOverdue||overdueInfo.isDueToday) && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, background:overdueInfo.bg, border:`1px solid ${overdueInfo.border}` }}>
                  <ExclamationCircleOutlined style={{ color:overdueInfo.color, fontSize:16, flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:700, color:overdueInfo.color, fontSize:13 }}>{overdueInfo.isDueToday?"⚡ Delivery due today!":`⚠ ${overdueInfo.label}`}</div>
                    <div style={{ fontSize:11, color:overdueInfo.color, opacity:0.85 }}>Est. delivery was {dayjs(viewJob.estimated_delivery_date).format("DD MMM YYYY")}</div>
                  </div>
                </div>
              )}

              {/* Status & Stage */}
              <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:8, justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight:600, fontSize:13, padding:"3px 10px" }}>{cfg.label}</Tag>
                  {stageCfg?.stage && <Tag color="purple" icon={<BranchesOutlined />} style={{ fontSize:11 }}>{WORKFLOW_STAGES.find(s=>s.value===stageCfg.stage)?.label||stageCfg.stage_label}</Tag>}
                </div>
                {viewJob.order_date && <span style={{ fontSize:12, color:"#6b7280" }}>Ordered: {dayjs(viewJob.order_date).format("DD MMM YYYY, HH:mm")}</span>}
              </div>

              {/* Customer Info */}
              <div style={{ background:"#f9fafb", borderRadius:10, padding:"12px 14px", border:"1px solid #e5e7eb" }}>
                <SectionHeader icon={<UserOutlined />} title="Customer Info" />
                <div style={{ display:"grid", gridTemplateColumns:c2, gap:10 }}>
                  <InfoRow label="Name"         value={viewJob.customer_name} />
                  <InfoRow label="Phone"        value={viewJob.customer_phone} />
                  {viewJob.company_name && <InfoRow label="Company" value={viewJob.company_name} />}
                  <InfoRow label="Est. Delivery" value={viewJob.estimated_delivery_date?dayjs(viewJob.estimated_delivery_date).format("DD MMM YYYY, HH:mm"):"—"} />
                  <InfoRow label="GST Number"   value={viewJob.gst_no||"—"} />
                  <InfoRow label="Created By"   value={viewJob.created_by||"—"} />
                </div>
              </div>

              {/* Assigned Designer */}
              {stageCfg?.assigned_to?.name && (
                <div style={{ background:"#eff6ff", borderRadius:10, padding:"10px 14px", border:"1px solid #bfdbfe", display:"flex", alignItems:"center", gap:10 }}>
                  <UserOutlined style={{ color:"#2563eb", fontSize:16 }} />
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#2563eb", textTransform:"uppercase" }}>Assigned Designer</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#1e3a8a" }}>{stageCfg.assigned_to.name} <span style={{ fontSize:11, fontWeight:400, color:"#3b82f6" }}>{stageCfg.assigned_to.role}</span></div>
                    {stageCfg.since && <div style={{ fontSize:11, color:"#6b7280" }}>Since {dayjs(stageCfg.since).format("DD MMM YYYY, HH:mm")}</div>}
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              {fullAddress && (
                <div style={{ background:"#f9fafb", borderRadius:10, padding:"12px 14px", border:"1px solid #e5e7eb" }}>
                  <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
                  <div style={{ fontSize:13, color:"#374151", lineHeight:1.8 }}>{fullAddress}</div>
                </div>
              )}

              {/* Cart Items */}
              <div>
                <SectionHeader icon={<ShoppingCartOutlined />} title={`Job Items (${(viewJob.cart_items||[]).length})`} />
                <ViewCartItems cartItems={viewJob.cart_items} isMobile={isMobile} />
              </div>

              {/* Order Summary */}
              <div style={{ background:"linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border:"1px solid #bfdbfe", borderRadius:10, padding:isMobile?12:"14px 16px" }}>
                <div style={{ fontWeight:700, color:"#1e40af", marginBottom:12, fontSize:14, display:"flex", alignItems:"center", gap:6 }}><WalletOutlined /> Order Summary</div>
                <SummaryRow label="Subtotal (base)"   value={`₹${totals.subtotal.toFixed(2)}`} />
                {totals.discountAmt>0 && <SummaryRow label="Discount" value={`− ₹${totals.discountAmt.toFixed(2)}`} color="#059669" />}
                <SummaryRow label="Total GST"         value={`₹${totals.taxAmount.toFixed(2)}`} color="#d97706" />
                {totals.designCharges>0 && <SummaryRow label="Design Charges" value={`₹${totals.designCharges.toFixed(2)}`} color="#7c3aed" />}
                <SummaryRow label="Delivery"          value={totals.freeDelivery?"Free":`₹${totals.deliveryCharges.toFixed(2)}`} color={totals.freeDelivery?"#059669":undefined} />
                <Divider style={{ margin:"10px 0" }} />
                <SummaryRow label="Grand Total"       value={`₹${totals.grandTotal.toFixed(2)}`} bold />
              </div>

              {/* Payment Info */}
              <PaymentInfoPanel job={viewJob} />

              {/* Notes */}
              {viewJob.notes && (
                <div style={{ fontSize:13, color:"#374151", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#92400e", textTransform:"uppercase", marginBottom:4 }}>Notes</div>
                  {viewJob.notes}
                </div>
              )}
              {viewJob.terms_and_conditions && (
                <div style={{ fontSize:12, color:"#6b7280", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#374151", textTransform:"uppercase", marginBottom:4 }}>Terms & Conditions</div>
                  <div style={{ whiteSpace:"pre-line", lineHeight:1.7 }}>{viewJob.terms_and_conditions}</div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ══ EDIT MODAL ══ */}
      <Modal open={editModal} onCancel={resetEditModal} footer={null}
        title={
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <EditOutlined style={{ color:"#2563eb" }} />
            <span style={{ fontWeight:700, fontSize:isMobile?14:15 }}>Edit Job</span>
            {editJob && <Tag color="blue" style={{ fontFamily:"monospace",fontWeight:600,fontSize:11 }}>{editJob.job_no}</Tag>}
            {editJob && isSiteVisitJob(editJob) && <SiteVisitBadge />}
          </div>
        }
        width={modalWidth} style={mobileStyle}
        styles={{ body:modalBody, header:{ padding:`${isMobile?10:14}px ${isMobile?12:16}px`, borderBottom:"1px solid #f0f0f0" } }}
        destroyOnClose>
        <Spin spinning={editLoading}>

          {/* Site Visit Banner */}
          {editJob&&isSiteVisitJob(editJob) && (
            <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"linear-gradient(135deg,#f5f3ff,#ede9fe44)", border:"2px solid #a78bfa", display:"flex", gap:12, alignItems:"flex-start", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, width:4, height:"100%", background:"linear-gradient(180deg,#7c3aed,#a78bfa)" }} />
              <CompassOutlined style={{ color:"#7c3aed", fontSize:18, marginLeft:6, flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:"#5b21b6", fontSize:13, marginBottom:4 }}>Site Visit Job — fill in all details</div>
                {editJob.site_visit_no && <span style={{ fontSize:11, color:"#6d28d9", background:"#ede9fe", padding:"2px 8px", borderRadius:10 }}><CompassOutlined style={{ marginRight:4 }}/>{editJob.site_visit_no}</span>}
                {editJob.site_visit_photos?.length>0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", marginBottom:6 }}>Site Visit Photos — Reference for sizing</div>
                    <Image.PreviewGroup>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {editJob.site_visit_photos.map((photo,i)=>(
                          <Image key={photo._id||i} src={photo.url} alt={photo.caption||`Photo ${i+1}`} style={{ height:64, width:64, objectFit:"cover", borderRadius:6, border:"2px solid #c4b5fd", cursor:"pointer" }} preview={{ mask:<EyeOutlined style={{ fontSize:12 }} /> }} />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  </div>
                )}
              </div>
            </div>
          )}

          {editError && (
            <div style={{ marginBottom:12, padding:"10px 14px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, color:"#b91c1c", fontSize:13 }}>⚠ {editError}</div>
          )}

          {/* Customer Info */}
          <SectionHeader icon={<UserOutlined />} title="Customer Info" />
          <div style={{ display:"grid", gridTemplateColumns:c3, gap:g, marginBottom:g }}>
            <FormField label="Customer Name" required><Input prefix={<UserOutlined style={{ color:"#9ca3af" }} />} placeholder="Full name" value={editForm.customer_name} onChange={e=>handleEditInput("customer_name",e.target.value)} style={{ borderRadius:8 }} /></FormField>
            <FormField label="Phone" required><Input prefix={<PhoneOutlined style={{ color:"#9ca3af" }} />} placeholder="10-digit mobile" value={editForm.customer_phone} maxLength={10} onChange={e=>handleEditInput("customer_phone",e.target.value)} style={{ borderRadius:8 }} /></FormField>
            <FormField label="Est. Delivery Date" required><Input type="datetime-local" value={editForm.estimated_delivery_date} onChange={e=>handleEditInput("estimated_delivery_date",e.target.value)} style={{ borderRadius:8 }} /></FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:c2, gap:g, marginBottom:14 }}>
            <FormField label="Company Name"><Input prefix={<BankOutlined style={{ color:"#9ca3af" }} />} placeholder="Company / Business name" value={editForm.company_name} onChange={e=>handleEditInput("company_name",e.target.value)} style={{ borderRadius:8 }} /></FormField>
            <FormField label="GST Number"><Input placeholder="GSTIN (15 chars)" maxLength={15} value={editForm.gst_no} onChange={e=>handleEditInput("gst_no",e.target.value.toUpperCase())} style={{ borderRadius:8 }} /></FormField>
          </div>

          {/* Delivery Address */}
          <SectionHeader icon={<EnvironmentOutlined />} title="Delivery Address" />
          <div style={{ display:"flex", flexDirection:"column", gap:g, marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:c2, gap:g }}>
              <FormField label="Address Line 1"><Input placeholder="Flat / Door No, Building" value={editForm.address_line1} onChange={e=>handleEditInput("address_line1",e.target.value)} style={{ borderRadius:8 }} /></FormField>
              <FormField label="Address Line 2"><Input placeholder="Street, Area, Landmark" value={editForm.address_line2} onChange={e=>handleEditInput("address_line2",e.target.value)} style={{ borderRadius:8 }} /></FormField>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:c4, gap:g }}>
              {[["city","City","City"],["state","State","State"],["pincode","Pincode","6-digit"],["country","Country","Country"]].map(([k,label,ph])=>(
                <FormField key={k} label={label}><Input placeholder={ph} value={editForm[k]} onChange={e=>handleEditInput(k,e.target.value)} style={{ borderRadius:8 }} /></FormField>
              ))}
            </div>
          </div>

          {/* Job Items — tabbed */}
          <SectionHeader icon={<ShoppingCartOutlined />} title="Job Items" />
          <JobItemsSection
            productItems={editProductItems} officeItems={editOfficeItems} labourItems={editLabourItems}
            onProductChange={(i,u)=>setEditProductItems(p=>p.map((it,j)=>j===i?u:it))}
            onOfficeChange={(i,u)=>setEditOfficeItems(p=>p.map((it,j)=>j===i?u:it))}
            onLabourChange={(i,u)=>setEditLabourItems(p=>p.map((it,j)=>j===i?u:it))}
            onAddProduct={()=>setEditProductItems(p=>[...p,{...EMPTY_PRODUCT_ITEM}])}
            onAddOffice={()=>setEditOfficeItems(p=>[...p,{...EMPTY_OFFICE_ITEM}])}
            onAddLabour={()=>setEditLabourItems(p=>[...p,{...EMPTY_LABOUR_ITEM}])}
            onRemoveProduct={i=>setEditProductItems(p=>p.filter((_,j)=>j!==i))}
            onRemoveOffice={i=>setEditOfficeItems(p=>p.filter((_,j)=>j!==i))}
            onRemoveLabour={i=>setEditLabourItems(p=>p.filter((_,j)=>j!==i))}
            isMobile={isMobile} isTablet={isTablet}
          />

          {/* Pricing */}
          <SectionHeader icon={<TagOutlined />} title="Pricing & Tax" />
          <div style={{ display:"grid", gridTemplateColumns:c5, gap:g, marginBottom:14 }}>
            <FormField label="Discount (₹)"><InputNumber min={0} value={editForm.discount_amount} style={{ width:"100%", borderRadius:8 }} prefix="₹" onChange={v=>handleEditInput("discount_amount",v||0)} /></FormField>
            <FormField label="Delivery Charges (₹)"><InputNumber min={0} value={editForm.free_delivery?0:editForm.delivery_charges} disabled={editForm.free_delivery} style={{ width:"100%", borderRadius:8 }} prefix="₹" onChange={v=>handleEditInput("delivery_charges",v||0)} /></FormField>
            <FormField label="Design Charges (₹)"><InputNumber min={0} value={editForm.design_charges} style={{ width:"100%", borderRadius:8 }} prefix="₹" onChange={v=>handleEditInput("design_charges",v||0)} /></FormField>
            <FormField label="Free Delivery">
              <div onClick={()=>handleEditInput("free_delivery",!editForm.free_delivery)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", background:editForm.free_delivery?"#f0fdf4":"#f9fafb", border:`1px solid ${editForm.free_delivery?"#86efac":"#e5e7eb"}`, borderRadius:8, padding:"6px 12px", userSelect:"none" }}>
                <div style={{ width:36, height:20, borderRadius:10, background:editForm.free_delivery?"#22c55e":"#d1d5db", position:"relative" }}>
                  <div style={{ position:"absolute", top:2, left:editForm.free_delivery?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:editForm.free_delivery?"#16a34a":"#6b7280" }}>{editForm.free_delivery?"Free":"Paid"}</span>
              </div>
            </FormField>
          </div>

          {/* Payment */}
          <SectionHeader icon={<WalletOutlined />} title="Payment" />
          <div style={{ display:"grid", gridTemplateColumns:c2, gap:g, marginBottom:10 }}>
            <FormField label="Payment Mode" hint="Changing mode auto-suggests next due date">
              <Select placeholder="Select payment mode" value={editForm.payment_mode||undefined} style={{ width:"100%" }} allowClear onChange={handlePaymentModeChange}>
                {PAYMENT_MODES.map(m=><Option key={m} value={m}>{m}</Option>)}
              </Select>
            </FormField>
            <FormField label="Amount Paid (₹)" hint="Balance calculated automatically">
              <InputNumber min={0} placeholder="0.00" value={editForm.payment_amount||undefined} style={{ width:"100%", borderRadius:8 }} prefix="₹" onChange={handlePaymentAmountChange} />
            </FormField>
          </div>

          <NextDueDatePreview paymentMode={editForm.payment_mode} paidAmount={editForm.payment_amount} totalAmount={editTotals.grandTotal} nextDueDate={editForm.next_due_date} />

          {editTotals.balance>0 && (
            <div style={{ marginTop:12, marginBottom:14 }}>
              <FormField label="Next Payment Due Date" hint="When should the customer pay the remaining balance?">
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <DatePicker value={editForm.next_due_date?dayjs(editForm.next_due_date):null} onChange={d=>handleEditInput("next_due_date",d)} format="DD MMM YYYY" style={{ flex:1, borderRadius:8 }} disabledDate={d=>d&&d.isBefore(dayjs().startOf("day"))} placeholder="Pick a due date" />
                  {editForm.next_due_date && <Button size="small" onClick={()=>handleEditInput("next_due_date",null)} style={{ color:"#6b7280" }}>Clear</Button>}
                </div>
                <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                  {[["7 days",7],["15 days",15],["30 days",30],["45 days",45]].map(([label,days])=>(
                    <button key={days} onClick={()=>handleEditInput("next_due_date",dayjs().add(days,"day"))}
                      style={{ fontSize:11, padding:"3px 10px", borderRadius:20, border:"1px solid #d1d5db", background:"#f9fafb", color:"#374151", cursor:"pointer", fontWeight:600 }}
                      onMouseEnter={e=>e.target.style.background="#eff6ff"} onMouseLeave={e=>e.target.style.background="#f9fafb"}>
                      +{label}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          )}
          {editTotals.balance<=0 && <div style={{ marginBottom:14 }} />}

          {/* Notes */}
          <SectionHeader icon={<FileTextOutlined />} title="Notes" />
          <div style={{ marginBottom:14 }}>
            <FormField label="Notes"><TextArea rows={3} placeholder="Additional notes…" value={editForm.notes} onChange={e=>handleEditInput("notes",e.target.value)} style={{ borderRadius:8 }} /></FormField>
          </div>

          {/* Order Summary */}
          <div style={{ background:"linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)", border:"1px solid #bfdbfe", borderRadius:10, padding:isMobile?12:"14px 16px", marginBottom:14 }}>
            <div style={{ fontWeight:700, color:"#1e40af", marginBottom:10, fontSize:14, display:"flex", alignItems:"center", gap:6 }}><FileTextOutlined /> Order Summary</div>
            <SummaryRow label="Subtotal (items base)" value={`₹${editTotals.subtotal.toFixed(2)}`} />
            {editTotals.discountAmt>0 && <SummaryRow label="Discount" value={`− ₹${editTotals.discountAmt.toFixed(2)}`} color="#059669" />}
            <SummaryRow label="Total GST"             value={`₹${editTotals.taxAmount.toFixed(2)}`} color="#d97706" />
            {editTotals.designCharges>0 && <SummaryRow label="Design Charges" value={`₹${editTotals.designCharges.toFixed(2)}`} color="#7c3aed" />}
            <SummaryRow label="Delivery"              value={editForm.free_delivery?"Free":`₹${editTotals.deliveryCharges.toFixed(2)}`} color={editForm.free_delivery?"#059669":undefined} />
            <Divider style={{ margin:"8px 0" }} />
            <SummaryRow label="Grand Total"           value={`₹${editTotals.grandTotal.toFixed(2)}`} bold />
            {(editTotals.paid>0||editForm.payment_mode) && (
              <>
                <div style={{ height:6 }} />
                <SummaryRow label={`Paid${editForm.payment_mode?` (${editForm.payment_mode})`:""}`} value={`− ₹${editTotals.paid.toFixed(2)}`} color="#059669" />
                <Divider style={{ margin:"6px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:800 }}>
                  <span style={{ color:"#1a1a2e" }}>Balance Due</span>
                  <span style={{ color:editTotals.balance<=0?"#059669":"#dc2626", background:editTotals.balance<=0?"#f0fdf4":"#fef2f2", padding:"2px 10px", borderRadius:6 }}>
                    {editTotals.balance<=0?`✓ Paid${Math.abs(editTotals.balance)>0.01?` (Advance ₹${Math.abs(editTotals.balance).toFixed(2)})`:""}` : `₹${editTotals.balance.toFixed(2)}`}
                  </span>
                </div>
                {editTotals.balance>0&&editForm.next_due_date && (
                  <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8 }}>
                    <CalendarOutlined style={{ color:"#d97706", fontSize:14 }} />
                    <span style={{ fontSize:12, color:"#92400e", fontWeight:600 }}>
                      Next payment due: {dayjs(editForm.next_due_date).format("DD MMM YYYY")} · {dayjs(editForm.next_due_date).diff(dayjs(),"day")} day{dayjs(editForm.next_due_date).diff(dayjs(),"day")!==1?"s":""} away
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Button onClick={resetEditModal} style={{ borderRadius:8, height:40, flex:isMobile?1:undefined }}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleEditSubmit} loading={editLoading} style={{ background:"#2563eb", border:"none", borderRadius:8, height:40, fontWeight:600, flex:isMobile?1:undefined }}>Save Changes</Button>
          </div>
        </Spin>
      </Modal>

      {/* ══ APPROVE MODAL ══ */}
      <Modal
        title={<div style={{ display:"flex", alignItems:"center", gap:8 }}><CheckCircleOutlined style={{ color:"#16a34a" }} /><span style={{ fontWeight:700 }}>Approve & Assign Job</span></div>}
        open={approveModalOpen}
        onCancel={()=>{ if(approving)return; setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); }}
        maskClosable={!approving} closable={!approving}
        footer={[
          <Button key="cancel" onClick={()=>{ if(approving)return; setApproveModalOpen(false); setApprovingJob(null); setSelectedDesigner(null); setDesigners([]); }} disabled={approving}>Cancel</Button>,
          <Button key="submit" type="primary" loading={approving} disabled={!selectedDesigner||designersLoading} onClick={handleApproveWithDesigner} style={{ background:"#16a34a", borderColor:"#16a34a" }}>Approve & Assign</Button>,
        ]}
        width={isMobile?"100vw":480} style={sheetStyle} styles={{ body:sheetBody }} destroyOnClose>
        {approvingJob && (
          <div>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", marginBottom:16, border:"1px solid #e5e7eb" }}>
              <div style={{ fontFamily:"monospace", fontWeight:700, color:"#2563eb", fontSize:14 }}>{approvingJob.job_no}</div>
              <div style={{ fontSize:13, color:"#374151", marginTop:2 }}>{approvingJob.customer_name||"—"}</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>{approvingJob.customer_phone||""}</div>
              {isSiteVisitJob(approvingJob) && (
                <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                  <CompassOutlined style={{ color:"#7c3aed", fontSize:11 }} />
                  <span style={{ fontSize:11, color:"#7c3aed", fontWeight:600 }}>Site Visit: {approvingJob.site_visit_no||approvingJob.site_visit_id}</span>
                </div>
              )}
              {(()=>{ const cfg=STATUS_CONFIG[approvingJob.job_status]||STATUS_CONFIG.draft; return <div style={{ marginTop:6, fontSize:11 }}>Status: <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag></div>; })()}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontWeight:600, marginBottom:8, fontSize:13 }}>Assign Designer <span style={{ color:"#ef4444" }}>*</span></label>
              <Select placeholder={designersLoading?"Loading designers…":"Choose a designer"} style={{ width:"100%" }} value={selectedDesigner?._id||undefined} loading={designersLoading} disabled={designersLoading}
                onChange={id=>{ if(id==="customer_designed") setSelectedDesigner({_id:"customer_designed",name:"Customer Designed",type:"external"}); else setSelectedDesigner(designers.find(d=>d._id===id)||null); }}
                notFoundContent={designersLoading?"Loading…":"No designers found"}>
                <Option value="customer_designed">
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <UserOutlined style={{ color:"#f59e0b", fontSize:12 }} />
                    <span style={{ fontWeight:600, color:"#d97706" }}>🎨 Designed By Customer</span>
                    <Tag color="orange" style={{ fontSize:10, marginLeft:4 }}>Customer Provided</Tag>
                  </div>
                </Option>
                {designers.length>0 && <Option disabled value="divider"><Divider style={{ margin:8 }} orientation="left" plain><span style={{ fontSize:11, color:"#9ca3af" }}>Internal Designers</span></Divider></Option>}
                {designers.map(d=>(
                  <Option key={d._id} value={d._id}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}><UserOutlined style={{ color:"#6b7280", fontSize:12 }}/><span>{d.name||d.fullName||d.username||d._id}</span></div>
                  </Option>
                ))}
              </Select>
              {selectedDesigner?._id==="customer_designed" && (
                <div style={{ marginTop:8, color:"#d97706", fontSize:12, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:6, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                  <InfoCircleOutlined style={{ color:"#f59e0b" }}/><span>No internal designer assigned — customer-provided design.</span>
                </div>
              )}
              {!designersLoading&&designers.length===0&&selectedDesigner?._id!=="customer_designed" && (
                <div style={{ marginTop:8, color:"#b45309", fontSize:12, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:6, padding:"6px 10px" }}>
                  No designers found. Add a user with role "designing team" first.
                </div>
              )}
            </div>
            <div style={{ fontSize:12, color:"#6b7280", background:"#fefce8", padding:"8px 10px", borderRadius:6, border:"1px solid #fef08a" }}>
              Job will be approved and assigned to the selected designer, moving to <strong>Design</strong> stage.
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .site-visit-row > td { background: linear-gradient(90deg,#f5f3ff55,transparent) !important; }
        .site-visit-row:hover > td { background: linear-gradient(90deg,#ede9fe88,#f0f0ff44) !important; }
        .site-visit-row > td:first-child { border-left: 3px solid #a78bfa !important; }
      `}</style>
    </div>
  );
};

export default AdminJobManagement;