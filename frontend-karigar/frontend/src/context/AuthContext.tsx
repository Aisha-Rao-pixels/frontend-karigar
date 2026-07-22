import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiFetch, setToken, clearToken, getToken } from "@/src/api/client";

export type Role = "karigar" | "admin";

export interface AuthUser {
  id: string;
  phone: string;
  role: Role;
  name?: string;
  has_profile: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  register: (phone: string, password: string, role: Role, referredByCode?: string) => Promise<AuthUser>;
  login: (phone: string, password: string) => Promise<AuthUser>;
  refresh: () => Promise<void>;
  setHasProfile: (v: boolean) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) {
        try {
          const me = await apiFetch<AuthUser>("/auth/me");
          setUser(me);
        } catch (e: any) {
          // Only clear token if it's actually invalid (401)
          // NOT on network errors (backend sleeping on Render free tier)
          if (e?.status === 401) {
            await clearToken();
            setUser(null);
          }
          // Otherwise keep the token and retry next time
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

 const register = async (phone: string, password: string, role: Role, referredByCode?: string) => {
    const res = await apiFetch<{ access_token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: { phone, password, role, referred_by_code: referredByCode || undefined },
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const login = async (phone: string, password: string) => {
    const res = await apiFetch<{ access_token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { phone, password },
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const refresh = async () => {
    const me = await apiFetch<AuthUser>("/auth/me");
    setUser(me);
  };

  const setHasProfile = (v: boolean) => {
    setUser((u) => (u ? { ...u, has_profile: v } : u));
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        register,
        login,
        refresh,
        setHasProfile,
        logout,
        isAdmin: !!user && user.role === "admin",
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
