import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  // The API and SPA share the Vercel origin; the HttpOnly session cookie
  // must accompany /api requests and be accepted from login responses.
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  // Remove credentials from the legacy localStorage-token implementation.
  // The backend now uses the HttpOnly cookie exclusively.
  if (typeof window !== "undefined") {
    localStorage.removeItem("civicconnect_token");
  }
  if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

export default api;
