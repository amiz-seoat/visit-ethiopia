import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeOrg = localStorage.getItem("activeOrganizationId");
  if (activeOrg && !config.headers["X-Org-Context"]) {
    config.headers["X-Org-Context"] = activeOrg;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;

    if (status === 401 && !window.location.pathname.includes("/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (!error.response) {
      return "We couldn't reach the server. Please check your connection and try again.";
    }
    if (status === 401) return message || "Please sign in to continue.";
    if (status === 403) return message || "You are not authorized to perform this action.";
    if (status === 404) return message || "The requested resource was not found.";
    if (status === 409) {
      if (message?.toLowerCase().includes("idempotency")) {
        return message || "This booking request conflicts with an earlier request.";
      }
      if (
        message?.toLowerCase().includes("spot") ||
        message?.toLowerCase().includes("inventory") ||
        message?.toLowerCase().includes("available") ||
        message?.toLowerCase().includes("capacity")
      ) {
        return message || "This departure no longer has enough available seats.";
      }
      return message || "This request conflicts with the current booking state.";
    }
    if (status === 503) return message || "The server is temporarily unavailable. Please try again later.";
    if (status === 500) return message || "Server error. Please try again later.";
    if (message) return message;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}
