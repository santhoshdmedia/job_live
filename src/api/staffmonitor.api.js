// src/api/staffMonitor.api.js
import axios from "axios";
import { admintoken } from "../helper/notification_helper";

const http = axios.create({ baseURL: "https://api.dmedia.in/api/staff-monitor", timeout: 12000 });
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(admintoken) || localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const smApi = {
  recordLogin:     (staffId, extras = {}) => http.post("/session/login",  { staffId, ...extras }),
  recordLogout:    (staffId)              => http.post("/session/logout", { staffId }),
  startBreak:      (staffId, breakType)   => http.post("/session/break/start", { staffId, breakType }),
  endBreak:        (staffId)              => http.post("/session/break/end", { staffId }),
  getSession: (staffId) => http.get(`/session/${staffId}`),
  getMonitorList:  ()                     => http.get("/monitor"),
  getStaffDetails: (id)                   => http.get(`/monitor/${id}/details`),
  getStaffJobTime: (id)                   => http.get(`/monitor/${id}/job-time`),
  submitTaskLog:   (payload)              => http.post("/task-log", payload),
  deleteTaskLog:   (logId)               => http.delete(`/task-log/${logId}`),
};