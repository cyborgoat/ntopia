import { createTeamOrbitClient } from "@goatcheese/team-orbit-client";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getItem, isTauri, setItem } from "./storage";

/** Preset via VITE_DEFAULT_SERVER; dev builds fall back to a local server, release builds start blank. */
export const DEFAULT_SERVER: string =
  import.meta.env.VITE_DEFAULT_SERVER ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
export const STORAGE_KEYS = ["serverUrl", "token"];

export const getServerUrl = () => getItem<string>("serverUrl") ?? DEFAULT_SERVER;
export const getToken = () => getItem<string>("token");
export const setToken = (t: string | null) => setItem("token", t);
export const setServerUrl = (u: string) => setItem("serverUrl", u.replace(/\/+$/, ""));

/** Absolute URL for a server-relative path such as `/uploads/x.png`. */
export const assetUrl = (path?: string | null) =>
  !path ? undefined : /^https?:/.test(path) ? path : `${getServerUrl()}${path}`;

/** Root-relative URLs in content (`/uploads/…`, `/demo/…`) live on the Team Orbit server, not this app. */
export function serverUrlFor(url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? `${getServerUrl()}${url}` : url;
}

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

/** Persist a new server URL and rebuild the client against it. */
export async function applyServerUrl(url: string) {
  await setServerUrl(url);
  resetOrbit();
}

export function errorMessage(error: unknown, response?: Response): string {
  const m = (error as { message?: string | string[] } | undefined)?.message;
  if (m) return Array.isArray(m) ? m.join(", ") : m;
  // No parseable error body, e.g. a proxy/gateway error page.
  if (response?.status && response.status >= 500)
    return `The server at ${getServerUrl()} is unavailable (HTTP ${response.status}). Try again later.`;
  if (response?.status === 404)
    return `No Team Orbit API found at ${getServerUrl()} (HTTP 404). Check the server URL.`;
  if (response?.status) return `Request failed (HTTP ${response.status}).`;
  return "Something went wrong";
}

/** Run a client call, turning network failures into a message naming the server. */
export async function reachable<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch {
    throw new Error(`Can't reach the server at ${getServerUrl()}. Check the server URL and that it is running.`);
  }
}
