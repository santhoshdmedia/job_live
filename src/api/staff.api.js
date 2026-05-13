// src/api/staff.api.js
// Drop this next to your other api files and import from here.
// All functions mirror your existing pattern: axios instance + returning the response.

import axios from "axios"; // or import your configured axios instance

const API = axios.create({
  baseURL:  "https://api.dmedia.in/api",
});

// Attach token on every request (same pattern as your existing api files)
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Staff CRUD ────────────────────────────────────────────────────────────────
export const getAllStaff        = (params = {}) => API.get("/staff", { params });
export const getSingleStaff     = (id)          => API.get(`/staff/${id}`);
export const createStaff        = (data)        => API.post("/staff", data);
export const updateStaff        = (id, data)    => API.put(`/staff/${id}`, data);
export const deleteStaff        = (id)          => API.delete(`/staff/${id}`);
export const toggleStaffAvail   = (id)          => API.patch(`/staff/${id}/toggle-available`);
export const updatePermissions  = (id, perms)   => API.patch(`/staff/${id}/permissions`, { pagePermissions: perms });