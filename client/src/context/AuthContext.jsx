
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user ?? data);
    } catch {
      setUser(null);
      localStorage.removeItem("civicconnect_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", {
      email: email.trim(),
      password,
    });

    if (!data.token) {
      throw new Error("Login response did not contain an authentication token.");
    }

    localStorage.setItem("civicconnect_token", data.token);
    setUser(data.user);

    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);

    if (data.token) {
      localStorage.setItem("civicconnect_token", data.token);
      setUser(data.user);
    }

    return data;
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("civicconnect_token");
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}
