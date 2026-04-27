import { FaPaperclip, FaPlusCircle, FaPowerOff, FaRegEye } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import { IoIosArrowForward } from "react-icons/io";
import { LuClipboardList, LuWallpaper } from "react-icons/lu";
import { MdDeleteOutline, MdEditNote, MdOutlineDeleteOutline, MdOutlineFileDownload, MdOutlineGridView, MdOutlineHomeWork, MdOutlineRateReview, MdRateReview, MdStorefront } from "react-icons/md";
import { RiSettings3Line, RiShoppingBag4Line } from "react-icons/ri";
import { RxInput } from "react-icons/rx";
import { RiAdminLine } from "react-icons/ri";
import { FaRegUser } from "react-icons/fa6";
import { CiCircleMore, CiDeliveryTruck } from "react-icons/ci";
import { PiArrowArcLeftBold, PiContactlessPayment, PiImagesBold } from "react-icons/pi";
import { GrBlog } from "react-icons/gr";
import { SiBloglovin, SiPinboard } from "react-icons/si";
import { IoMail, IoMailOutline } from "react-icons/io5";
import { GiQuillInk } from "react-icons/gi";
import { LiaExternalLinkAltSolid, LiaMoneyBillWaveSolid } from "react-icons/lia";
import { TbTruckDelivery } from "react-icons/tb";
import { AiOutlineFileExcel } from "react-icons/ai";
import { RiCoupon2Line } from "react-icons/ri";
import { GrLogout } from "react-icons/gr";

export const ICON_HELPER = {
  HOME_ICON: MdOutlineHomeWork,
  ORDERS_ICON: RiShoppingBag4Line,
  PRODUCT_ICON: LuWallpaper,
  SETTINGS_ICON: RiSettings3Line,
  RIGHT_ARROW_ICON: IoIosArrowForward,
  CATEGORY_ICON: LuClipboardList,
  Logout: GrLogout,
  FORM_ICON: RxInput,
  UPLOAD_ICON: FiUpload,
  ADMIN_ICON: RiAdminLine,
  USER_ICON: FaRegUser,
  ORDER_ICON: CiDeliveryTruck,
  BANNER_ICON: PiImagesBold,
  EDIT_ICON: MdEditNote,
  DELETE_ICON: MdDeleteOutline,
  EYE_ICON: FaRegEye,
  REVIEW_ICON: MdOutlineRateReview,
  BLOG_ICONS: GrBlog,
  MORE_ICON: MdOutlineGridView,
  DELETE_ICON2: MdOutlineDeleteOutline,
  VENDORS_ICON: MdStorefront,
  MAIL_ICON: IoMailOutline,
  PIN_ICON: SiPinboard,
  CLIP_ICON: FaPaperclip,
  SKETCH_ICON: GiQuillInk,
  LINK_SHARE_ICON: LiaExternalLinkAltSolid,

  LEFTARROW_ICON: PiArrowArcLeftBold,
  CASHON_DELIVERY: LiaMoneyBillWaveSolid,
  ONLINE_PAYMENT: PiContactlessPayment,
  DELIVERY_ICON: TbTruckDelivery,
  DOWNLOAD_ICON: MdOutlineFileDownload,

  EXCELICON: AiOutlineFileExcel,

  PLUS_ICON: FaPlusCircle,
  COUPON_ICON: RiCoupon2Line,

};
