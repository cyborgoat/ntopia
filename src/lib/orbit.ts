import { createTeamOrbitClient } from "@goatcheese/team-orbit-client";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getItem, isTauri, setItem } from "./storage";

export const DEFAULT_SERVER = "http://localhost:3000";
export const STORAGE_KEYS = ["serverUrl", "token"];

export const getServerUrl = () => getItem<string>("serverUrl") ?? DEFAULT_SERVER;
export const getToken = () => getItem<string>("token");
export const setToken = (t: string | null) => setItem("token", t);
export const setServerUrl = (u: string) => setItem("serverUrl", u.replace(/\/+$/, ""));

/** Absolute URL for a server-relative path such as `/uploads/x.png`. */
export const assetUrl = (path?: string | null) =>
  !path ? undefined : /^https?:/.test(path) ? path : `${getServerUrl()}${path}`;

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export function createOrbit() {
  const client = createTeamOrbitClient({
    baseUrl: getServerUrl(),
    token: () => getToken(),
    // Tauri's HTTP plugin avoids webview CORS restrictions.
    fetch: isTauri() ? (tauriFetch as typeof fetch) : undefined,
  });
  client.use({
    onResponse({ response, schemaPath }) {
      if (response.status === 401 && !schemaPath.startsWith("/auth/login")) onUnauthorized();
    },
  });
  return client;
}

export let orbit = createOrbit();
/** Rebuild the client after the server URL changes. */
export const resetOrbit = () => (orbit = createOrbit());

export function errorMessage(error: unknown): string {
  const m = (error as { message?: string | string[] } | undefined)?.message;
  return Array.isArray(m) ? m.join(", ") : (m ?? "Something went wrong");
}
