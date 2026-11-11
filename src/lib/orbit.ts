import { createTeamOrbitClient } from "@goatcheese/teamorbit-client";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getItem, isTauri, setItem } from "./storage";
import { t } from "@/i18n";

/** Preset via VITE_DEFAULT_SERVER; dev builds fall back to a local server, release builds start blank. */
const DEFAULT_SERVER: string =
  import.meta.env.VITE_DEFAULT_SERVER ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
export const STORAGE_KEYS = ["serverUrl", "token"];

/** The API client adds `/api` itself, so accept a server URL pasted with or without it. */
const normalizeServerUrl = (u: string) => u.trim().replace(/\/+$/, "").replace(/\/api$/, "");

export const getServerUrl = () => normalizeServerUrl(getItem<string>("serverUrl") ?? DEFAULT_SERVER);
export const getToken = () => getItem<string>("token");
export const setToken = (t: string | null) => setItem("token", t);
const setServerUrl = (u: string) => setItem("serverUrl", normalizeServerUrl(u));

/** Absolute URL for a server-relative path such as `/uploads/x.png`. */
export const assetUrl = (path?: string | null) =>
  !path ? undefined : /^https?:/.test(path) ? path : `${getServerUrl()}${path}`;

/** `MarkdownEditor` image-preview handler: stored server-relative srcs become displayable URLs. */
export const imagePreviewUrl = async (src: string) => (src.startsWith("blob:") ? src : assetUrl(src) ?? src);

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
      if (response.status === 401 && !schemaPath.startsWith("/api/auth/login")) onUnauthorized();
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
    return t("err.unavailable", { url: getServerUrl(), status: response.status });
  if (response?.status === 404)
    return t("err.notFound", { url: getServerUrl() });
  if (response?.status) return t("err.failed", { status: response.status });
  return t("err.generic");
}

/** Resolves with the response data; an API error response becomes a thrown `Error` with a readable message. */
export async function unwrap<D>(call: Promise<{ data?: D; error?: unknown; response?: Response }>): Promise<D> {
  const { data, error, response } = await call;
  if (error) throw new Error(errorMessage(error, response));
  return data as D;
}

/** Run a client call, turning network failures into a message naming the server. */
export async function reachable<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(t("err.unreachable", { url: getServerUrl(), reason }));
  }
}
