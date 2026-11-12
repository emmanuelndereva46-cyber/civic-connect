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
      setUser(data?.user ?? data ?? null);
    } catch (error) {
      // A 401 on first page load is expected when no session exists.
      if (error?.response?.status !== 401) {
        console.error("Unable to restore CivicConnect session:", error);
      }
      setUser(null);
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

    const authenticatedUser = data?.user ?? (
      data?.id ? { id: data.id, fullName: data.fullName, role: data.role } : null
    );

    if (!authenticatedUser?.role) {
      throw new Error("The server did not return a valid user profile.");
    }

    // Authentication is maintained by the HttpOnly cookie. Do not store the
    // session token in localStorage.
    localStorage.removeItem("civicconnect_token");
    setUser(authenticatedUser);
    return { ...data, user: authenticatedUser };
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
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
