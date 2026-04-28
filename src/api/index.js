import axios from "axios";
import { admintoken } from "../helper/notification_helper";

const BASE_URL = "http://localhost:8000/api";
const UPLOAD_BASE_URL = "http://localhost:8000/api";
export const CLIENT_URL = "http://localhost:8000";

export const login = async (formdata) =>
  await axios.post(`${BASE_URL}/auth/login`, formdata);

const custom_request = axios.create();

custom_request.interceptors.request.use((config) => {
  const token = localStorage.getItem(admintoken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const checkloginstatus = async () =>
  await custom_request.get(`${BASE_URL}/auth/check_login`);
export const uploadImage = async (formdata) =>
  await custom_request.post(`${UPLOAD_BASE_URL}/upload_images`, formdata);
export const changePassword = async (oldPassword, newPassword) =>
  await custom_request.post(`${BASE_URL}/auth/change_password`, {
    newPassword,
    oldPassword,
  });
export const getMainCategory = async () =>
  await axios.get(`${BASE_URL}/category/all_main_category_name`);
export const getAllCategoryProducts = async () =>
  await axios.get(`${BASE_URL}/category/get_all_category`);
export const addMainCategory = async (data) =>
  await axios.post(`${BASE_URL}/category/main_category_name`, data);
export const editMainCategory = async (data, id) =>
  await axios.put(`${BASE_URL}/category/edit_main_category_name/${id}`, data);
export const deleteMainCategory = async (data) =>
  await axios.delete(
    `${BASE_URL}/category/delete_main_category_name/${data._id}`
  );

//sub category
export const addSubCategory = async (formdata) =>
  await axios.post(`${BASE_URL}/category/sub_category_name`, formdata);
export const getSubCategory = async (filter) =>
  await axios.get(`${BASE_URL}/category/get_sub_category`, {
    params: {
      filter,
    },
  });
export const editSubCategory = async (formdata, id) =>
  await axios.put(`${BASE_URL}/category/edit_sub_category/${id}`, formdata);
export const deleteSubCategory = async (id) =>
  await axios.delete(`${BASE_URL}/category/delete_sub_category/${id}`);

// Sub product category
export const addSubProductCategory = async (formdata) =>
  await custom_request.post(
    `${BASE_URL}/category/add_sub_product_categrory`,
    formdata
  );
export const getSubProductCategory = async (filter) =>
  await custom_request.get(`${BASE_URL}/category/get_sub_product_category`, {
    params: {
      filter,
    },
  });
export const editSubProductCategory = async (formdata, id) =>
  await custom_request.put(
    `${BASE_URL}/category/edit_sub_product_category/${id}`,
    formdata
  );
export const deleteSubProductCategory = async (id) =>
  await custom_request.delete(
    `${BASE_URL}/category/delete_sub_product_category/${id}`
  );

//admin users
export const addAdmin = async (formdata) =>
  await custom_request.post(`${BASE_URL}/admin/add_admin`, formdata);
export const getAdmin = async () =>
  await axios.get(`${BASE_URL}/admin/get_admin`);
export const updateAdmin = async (formdata) =>
  await custom_request.put(
    `${BASE_URL}/admin/update_admin/${formdata._id}`,
    formdata
  );
export const deleteAdmin = async (id) =>
  await custom_request.delete(`${BASE_URL}/admin/delete_admin/${id}`);

//client-user
export const getClient = async (query) =>
  await axios.get(`${BASE_URL}/client_user/get_all_client_users/${query}`);
export const getSingleClient = async (id) =>
  await custom_request.get(`${BASE_URL}/client_user/get_sinlge_client/${id}`);

//product
export const addproduct = async (formdata) =>
  await custom_request.post(`${BASE_URL}/product/add_product`, formdata);
export const getProduct = async (
  id,
  search,
  isAdmin = false,
  filterByProduct_category,
  filterByType,
  filterByProduct_subcategory,
  vendor_filter
) =>
  await axios.get(`${BASE_URL}/product/get_product/${id}`, {
    params: {
      search,
      isAdmin,
      filterByProduct_category,
      filterByType,
      filterByProduct_subcategory,
      vendor_filter,
    },
  });
export const editProduct = async (formdata, id) =>
  await custom_request.put(`${BASE_URL}/product/edit_product/${id}`, formdata);
export const deleteProduct = async (id) =>
  await custom_request.delete(`${BASE_URL}/product/delete_product/${id}`);

// order
export const collectallorders = async (query) =>
  await custom_request.get(`${BASE_URL}/order/collect_all_orders/${query}`);
export const toggleOrderCancellation = async (query) =>
  await custom_request.put(`${BASE_URL}/order/toggle-cancellation`,query);
export const getAssignedOrders = (userId) =>
  custom_request.get(`${BASE_URL}/team/Get-task/${userId}`);
export const updateorderstatus = async (formdata) =>
  await custom_request.put(`${BASE_URL}/order/update_order_status`, formdata);
export const assignOrder = async (formdata) =>
  await custom_request.post(`${BASE_URL}/team/Assign`, formdata);
export const GetTeam = async (role) =>
  await custom_request.get(
    `${BASE_URL}/team/get-team?role=${encodeURIComponent(role)}`
  );
export const getOrderAssignments = async (role) =>
  await custom_request.get(
    `${BASE_URL}/team/get-task/${encodeURIComponent(role)}`
  );

// dashboard

export const getAllDataCounts = async () =>
  await axios.get(`${BASE_URL}/dashboard/get_dashboard_data_count`);

// banner
export const getAllBannerProducts = async () =>
  await custom_request.get(`${BASE_URL}/banner/getproducts_forbanner`);
export const addBanner = async (formdata) =>
  await custom_request.post(`${BASE_URL}/banner/add_banner`, formdata);
export const editBanner = async (formdata, id) =>
  await custom_request.put(`${BASE_URL}/banner/edit_banner/${id}`, formdata);
export const getAllBanners = async (id = "") =>
  await custom_request.get(`${BASE_URL}/banner/get_all_banners/${id}`);
export const reorderBanners = async (formdata) =>
  await custom_request.put(`${BASE_URL}/banner/reorder`, formdata);
// Toggle banner visibility
export const toggleBannerVisibility = async (id) => {
  try {
    await custom_request.put(`${BASE_URL}/banner/${id}/toggle-visibility`,);
  } catch (error) {
    throw error;
  }
};

// Get visible banners only (for frontend/public)
export const getVisibleBanners = async () => {
  try {
    await custom_request.get(`${BASE_URL}/banner/visible`,);
  } catch (error) {
    throw error;
  }
};

// Get banner statistics
export const getBannerStats = async () => {
  try {
    await custom_request.get(`${BASE_URL}/banner/stats`,);
  } catch (error) {
    throw error;
  }
};
export const deleteBanner = async (id) =>
  await custom_request.delete(`${BASE_URL}/banner/delete_banner/${id}`);

// review
export const getAllUserReviews = async () =>
  await custom_request.get(`${BASE_URL}/review/get_all_review/:search`);

//blog
export const addBlog = async (formdata) =>
  await custom_request.post(`${BASE_URL}/blog/add_blog`, formdata);
export const editBlog = async (formdata, id) =>
  await custom_request.put(`${BASE_URL}/blog/edit_blog/${id}`, formdata);
export const deleteBlog = async (id) =>
  await custom_request.delete(`${BASE_URL}/blog/delete_blog/${id}`);
export const getBlog = async () =>
  await custom_request.get(`${BASE_URL}/blog/get_all_blog`);

// vendor
export const addVendor = async (formdata) =>
  await custom_request.post(`${BASE_URL}/vendor/add_vendor`, formdata);
export const editVendor = async (formdata, id) =>
  await custom_request.put(`${BASE_URL}/vendor/edit_vendor/${id}`, formdata);
export const getAllVendor = async (id = "null") =>
  await custom_request.get(`${BASE_URL}/vendor/get_all_vendors/${id}`);
export const deleteVendor = async (id) =>
  await custom_request.delete(`${BASE_URL}/vendor/delete_vendor/${id}`);
export const getSingleVendor = async (id) =>
  await custom_request.get(`${BASE_URL}/vendor/get_single_vendor/${id}`);

// corporate and deler
export const addCustomUser = async (formdata) =>
  await custom_request.post(`${BASE_URL}/client_user/custom_signup`, formdata);
export const getCustomUser = async () =>
  await custom_request.get(`${BASE_URL}/client_user/get_all_custom_users`);

export const sendMailDealer = async (formdata) =>
  await custom_request.post(`${BASE_URL}/mail/send_Dealer_mail`, formdata);

//enquires
export const getInquires = async () =>
  await custom_request.get(`${BASE_URL}/help/get_enquires`);

// bulk enquires
export const getBulkInquires = async () =>
  await custom_request.get(`${BASE_URL}/bulk/get_all_bulk`);

export const getSingelInquires = async (id) =>
  await custom_request.get(`${BASE_URL}/help/get_single_enquires/${id}`);

// customer page
export const addCustomerSection = async (formData) =>
  await custom_request.post(
    `${BASE_URL}/customer_section/add_customerSection`,
    formData
  );

export const getAllCustomerSections = async (id = "null") =>
  await custom_request.get(
    `${BASE_URL}/customer_section/get_all_customerSection/${id}`
  );

export const editCustomerSection = async (id = "", formData) =>
  await custom_request.put(
    `${BASE_URL}/customer_section/edit_customerSection/${id}`,
    formData
  );

export const deleteBannerCustomerSections = async (id = "") =>
  await custom_request.delete(
    `${BASE_URL}/customer_section/delete_customerSection/${id}`
  );

// product description
export const addProductDescription = async (formData) =>
  await custom_request.post(
    `${BASE_URL}/product/add_product_descriptions`,
    formData
  );
export const getProductDescription = async () =>
  await custom_request.get(
    `${BASE_URL}/product/get_product_descriptions/${null}`
  );
export const updateProductDescription = async (id, formData) =>
  await custom_request.put(
    `${BASE_URL}/product/update_product_descriptions/${id}`,
    formData
  );
export const deleteProductDescription = async (id) =>
  await custom_request.delete(
    `${BASE_URL}/product/delete_product_descriptions/${id}`
  );

//order update
export const updateDesign = async (formdata) =>
  await custom_request.put(`${BASE_URL}/order/update-design`, formdata);
export const assignVendorToOrder = async (formdata) =>
  await custom_request.put(`${BASE_URL}/order/update-vendor`, formdata);

// coupen
export const addCoupen = async (formdata) =>
  await custom_request.post(`${BASE_URL}/coupen`, formdata);
export const getAllCoupens = async () =>
  await custom_request.get(`${BASE_URL}/coupen`);
export const getSingleCoupen = async (id) =>
  await custom_request.get(`${BASE_URL}/coupen/${id}`);
export const editCoupen = async (formdata, id) =>
  await custom_request.put(`${BASE_URL}/coupen/${id}`, formdata);
export const deleteCoupen = async (id) =>
  await custom_request.delete(`${BASE_URL}/coupen/${id}`);
export const verifyUser = async (id, data) =>
  await custom_request.put(`${BASE_URL}/client_user/update_client_user/${id}`, data);

