import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch { return null; }
};

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access") || null);
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh") || null);
  const isAuthenticated = !!access;
  const refreshTimer = useRef(null);

  const login = async (username, password) => {
    const headers = { headers: { "Content-Type": "application/json" }, timeout: 10000 };
    const endpoints = ["/api/login/"];
    const payloads = [{ username: username.trim(), password }];

    let tokens = null;
    let lastError = null;
    const extractTokens = (data) => {
      if (!data || typeof data !== "object") return null;
      if (data.access && data.refresh) return { access: data.access, refresh: data.refresh };
      if (data.access_token && data.refresh_token) return { access: data.access_token, refresh: data.refresh_token };
      if (data.tokens?.access && data.tokens?.refresh) return { access: data.tokens.access, refresh: data.tokens.refresh };
      return null;
    };

    for (const url of endpoints) {
      for (const p of payloads) {
        try {
          const res = await axios.post(url, p, headers);
          tokens = extractTokens(res?.data);
          if (tokens) break;
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      if (tokens) break;
    }

    if (!tokens) {
      if (lastError) throw lastError;
      throw new Error("Login failed: No known auth endpoint returned a token pair");
    }

    setAccess(tokens.access);
    setRefresh(tokens.refresh);
    localStorage.setItem("access", tokens.access);
    localStorage.setItem("refresh", tokens.refresh);
  };

  const signup = async (username, password) => {
    await axios.post("/api/signup/", {
      username: username.trim(),
      password,
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
  };

  const logout = () => {
    setAccess(null);
    setRefresh(null);
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
  };

  const scheduleProactiveRefresh = (token, refreshToken) => {
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
    if (!token || !refreshToken) return;
    const payload = parseJwt(token);
    const now = Math.floor(Date.now() / 1000);
    const exp = payload?.exp || now + 60;
    const delayMs = Math.max(0, (exp - now - 30) * 1000); // refresh 30s before expiry
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await axios.post("/api/token/refresh/", { refresh: refreshToken });
        const newAccess = res?.data?.access;
        if (!newAccess) throw new Error("no access");
        setAccess(newAccess);
        localStorage.setItem("access", newAccess);
        scheduleProactiveRefresh(newAccess, refreshToken);
      } catch {
        logout();
        if (typeof window !== "undefined") window.location.href = "/login";
      }
    }, delayMs);
  };

  useEffect(() => {
    const r = localStorage.getItem("refresh");
    const a = localStorage.getItem("access");
    if (r && !a) {
      axios.post("/api/token/refresh/", { refresh: r })
        .then(res => {
          const newAccess = res?.data?.access;
          if (!newAccess) throw new Error("no access");
          setAccess(newAccess);
          localStorage.setItem("access", newAccess);
          scheduleProactiveRefresh(newAccess, r);
        })
        .catch(() => logout());
    }
  }, []);

  useEffect(() => {
    scheduleProactiveRefresh(access, refresh);
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [access, refresh]);

  return (
    <AuthContext.Provider value={{ access, refresh, isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
