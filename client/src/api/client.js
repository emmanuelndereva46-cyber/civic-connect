import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const api = axios.create({
  baseURL: (configuredApiUrl || "/api").replace(/\/+$/, ""),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("civicconnect_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error.response?.data?.message;
    const serverError = error.response?.data?.error;

    if (typeof serverMessage === "string") {
      error.userMessage = serverMessage;
    } else if (typeof serverError === "string") {
      error.userMessage = serverError;
    } else if (typeof error.message === "string") {
      error.userMessage = error.message;
    }

    return Promise.reject(error);
  }
);

export default api;
