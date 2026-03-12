
import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:7500/api",
});
export const getBTCData = () => {
  return api.get("/crypto/btc/");
};

let isRefreshing = false;
let pendingRequests = [];
let didForceLogout = false;

const flushPendingRequests = (token) => {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
};

const forceLogout = () => {
  if (didForceLogout) return;
  didForceLogout = true;
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  } catch {}
  if (typeof window !== "undefined") {
    setTimeout(() => { window.location.href = "/login"; }, 0);
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem("refresh");
    if (!refresh) {
      forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/token/refresh/", {
        refresh,
      });

      const newAccess = res?.data?.access;
      if (!newAccess) {
        throw new Error("No access token returned from refresh endpoint");
      }

      localStorage.setItem("access", newAccess);
      flushPendingRequests(newAccess);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushPendingRequests(null);
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
