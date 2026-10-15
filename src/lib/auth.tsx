import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { components } from "@goatcheese/team-orbit-client";
import { errorMessage, getToken, orbit, setToken, setUnauthorizedHandler } from "./orbit";

export type User = components["schemas"]["UserDto"];

type AuthValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (p: components["schemas"]["RegisterDto"]) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken() ?? null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!token) return setLoading(false);
    orbit.GET("/auth/me").then(({ data }) => {
      if (data) setUser(data);
      else logout();
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      loading,
      isAdmin: user?.role === "ADMIN" || user?.role === "SUPERUSER",
      setUser,
      logout,
      async login(email, password) {
        const { data, error } = await orbit.POST("/auth/login", { body: { email, password } });
        if (!data) throw new Error(errorMessage(error));
        setToken(data.accessToken);
        setTokenState(data.accessToken);
        setUser(data.user);
      },
      async register(body) {
        const { error } = await orbit.POST("/auth/register", { body });
        if (error) throw new Error(errorMessage(error));
      },
    }),
    [user, token, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
