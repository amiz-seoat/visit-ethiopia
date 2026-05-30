import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMyProfile,
  loginUser as apiLogin,
  logoutUser as apiLogout,
  signupUser as apiSignup,
} from "../api/auth";
import type { User, UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    FirstName: string;
    LastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
  }) => Promise<{ message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("token"));

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await getMyProfile();
      if (profile) {
        setUser(profile);
        localStorage.setItem("user", JSON.stringify(profile));
      }
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    setUser(res.data.user);
  }, []);

  const signup = useCallback(
    async (data: {
      FirstName: string;
      LastName: string;
      email: string;
      password: string;
      passwordConfirm: string;
    }) => {
      return apiSignup(data);
    },
    []
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      const normalized = user.role === "user" ? "customer" : user.role;
      return roles.some(
        (role) => role === user.role || role === normalized
      );
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && !!localStorage.getItem("token"),
      isLoading,
      login,
      signup,
      logout,
      refreshProfile,
      hasRole,
    }),
    [user, isLoading, login, signup, logout, refreshProfile, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
