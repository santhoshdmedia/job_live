const API_BASE = "http://localhost:8000/api/jobs";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("authToken")}`,
});

const handleResponse = async (res) => {
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const fetchJobs = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}?${query}`, { headers: authHeader() });
  return handleResponse(res);
};

export const createJob = async (payload) => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const updateJobStatus = async (jobId, status) => {
  const res = await fetch(`${API_BASE}/${jobId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
};

export const fetchWorkflowLog = async (jobId) => {
  const res = await fetch(`${API_BASE}/${jobId}/workflow`, { headers: authHeader() });
  const data = await handleResponse(res);
  return data.workflow_log || [];
};