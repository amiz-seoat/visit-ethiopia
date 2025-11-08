import axios from "axios";

// 🔹 Configure base API client
const api = axios.create({
  // VITE_BACKEND_URL should include the API path the front-end expects.
  // Default to port 3000 to match backend's default (server.js uses PORT || 3000).
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api/v1/users",
  withCredentials: true, // allow cookies (for jwt)
});

// 🔹 Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
