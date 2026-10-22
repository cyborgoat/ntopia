import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { components } from "@goatcheese/teamorbit-client";
import { errorMessage, getToken, orbit, reachable, setToken, setUnauthorizedHandler } from "./orbit";

export type User = components["schemas"]["UserDto"];

type AuthValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** The stored session could not be verified because the server did not answer. */
  unreachable: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (p: components["schemas"]["RegisterDto"]) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken() ?? null);
  const [loading, setLoading] = useState(!!getToken());
  const [unreachable, setUnreachable] = useState(false);

  const logout = useCallback(() => {
    void setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Restore the session from the persisted token. Only clear it on a real 401;
  // network / server errors must keep the token so reopen still looks signed-in.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, response } = await orbit.GET("/api/auth/me");
        if (cancelled) return;
        setUnreachable(false);
        if (data) setUser(data);
        else if (response.status === 401) logout();
      } catch {
        // offline / unreachable — keep token for the next successful check
        if (!cancelled) setUnreachable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      loading,
      unreachable,
      isAdmin: user?.role === "ADMIN" || user?.role === "SUPERUSER",
      setUser,
      logout,
      async login(identifier, password) {
        // Same rule as the client's `auth.login` helper: an `@` means email, anything else is a username.
        const body = identifier.includes("@") ? { email: identifier, password } : { username: identifier, password };
        const { data, error, response } = await reachable(orbit.POST("/api/auth/login", { body }));
        if (!data) throw new Error(errorMessage(error, response));
        await setToken(data.accessToken);
        setTokenState(data.accessToken);
        setUser(data.user);
      },
      async register(body) {
        const { error, response } = await reachable(orbit.POST("/api/auth/register", { body }));
        if (error) throw new Error(errorMessage(error, response));
      },
    }),
    [user, token, loading, unreachable, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
