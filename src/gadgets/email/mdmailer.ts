import { appDataDir, join, resolveResource } from "@tauri-apps/api/path";
import {
  copyFile, exists, mkdir, readDir, readFile, readTextFile, remove, writeFile, writeTextFile,
} from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Child, Command } from "@tauri-apps/plugin-shell";

export type Format = "html" | "eml" | "png";

export type Branding = {
  organization: string;
  tagline: string;
  footerText: string;
  /** File name of a logo inside the branding folder. */
  logo: string;
};

export const DEFAULT_BRANDING: Branding = {
  organization: "My Team",
  tagline: "",
  footerText: "© {{organization}}",
  logo: "logo.svg",
};

/** mdmailer requires a primary color; the visible look comes from the theme preset chosen per email. */
const PRIMARY_COLOR = "#111827";

/** Scratch Markdown file used for live preview / export (not a user-facing draft library). */
const WORK_NAME = "compose";

const PLACEHOLDER_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48"><rect width="160" height="48" rx="10" fill="#111827"/><text x="80" y="31" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">NTOPIA</text></svg>`;

const root = async () => join(await appDataDir(), "email");
const workDir = async () => join(await root(), "work");
// Use `out` (not `.out`): tauri-plugin-fs forbids leading-dot paths on Unix by default.
const outDir = async () => join(await root(), "out");
const brandingPath = async () => join(await root(), "branding.json");
const configPath = async () => join(await root(), "mdmailer.config.json");
const workPath = async () => join(await workDir(), `${WORK_NAME}.md`);

export async function ensureWorkspace() {
  for (const d of [await root(), await workDir(), await outDir()]) {
    if (!(await exists(d))) await mkdir(d, { recursive: true });
  }
  const logo = await join(await root(), "logo.svg");
  if (!(await exists(logo))) await writeTextFile(logo, PLACEHOLDER_LOGO);
  // Bundled templates reference sample images (assets/images/…) relative to the work folder.
  const assets = await join(await workDir(), "assets");
  if (!(await exists(assets))) {
    try {
      const bundled = await join(await mdmailerDir(), "assets");
      if (await exists(bundled)) await copyDir(bundled, assets);
    } catch {
      /* templates without images still work */
    }
  }
}

async function copyDir(from: string, to: string) {
  await mkdir(to, { recursive: true });
  for (const e of await readDir(from)) {
    const [src, dst] = [await join(from, e.name), await join(to, e.name)];
    if (e.isDirectory) await copyDir(src, dst);
    else if (e.isFile) await copyFile(src, dst);
  }
}

const MIME_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const EXT_BY_MIME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext])),
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

// ---- branding -------------------------------------------------------------

export async function loadBranding(): Promise<Branding> {
  await ensureWorkspace();
  const p = await brandingPath();
  if (!(await exists(p))) return DEFAULT_BRANDING;
  const saved = JSON.parse(await readTextFile(p)) as Partial<Branding>;
  // Pick known keys only, which also drops the old primaryColor/preset fields.
  return {
    organization: saved.organization ?? DEFAULT_BRANDING.organization,
    tagline: saved.tagline ?? DEFAULT_BRANDING.tagline,
    footerText: saved.footerText ?? DEFAULT_BRANDING.footerText,
    logo: saved.logo ?? DEFAULT_BRANDING.logo,
  };
}

export async function saveBranding(b: Branding) {
  await ensureWorkspace();
  await writeTextFile(await brandingPath(), JSON.stringify(b, null, 2));
  await writeTextFile(
    await configPath(),
    JSON.stringify(
      {
        organization: { name: b.organization, logoUrl: b.logo },
        theme: {
          primaryColor: PRIMARY_COLOR,
          ...(b.tagline && { tagline: b.tagline }),
          footerText: b.footerText,
        },
      },
      null,
      2,
    ),
  );
}

/** Copy a user-picked logo next to the config (logo paths are relative to it). */
export async function setLogo(sourcePath: string): Promise<string> {
  const ext = sourcePath.split(".").pop()?.toLowerCase() || "png";
  const name = `logo-custom.${ext}`;
  await copyFile(sourcePath, await join(await root(), name));
  return name;
}

/** Blob URL for a logo in the branding folder; the caller revokes it. */
export async function logoBlobUrl(name: string): Promise<string> {
  return blobUrlFor(await join(await root(), name));
}

/** Read a file and expose it as a blob URL typed from its extension; the caller revokes it. */
async function blobUrlFor(path: string): Promise<string> {
  const bytes = await readFile(path);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return URL.createObjectURL(new Blob([bytes], { type: MIME_BY_EXT[ext] ?? "application/octet-stream" }));
}

// ---- working document -----------------------------------------------------

export async function writeWorking(text: string) {
  await ensureWorkspace();
  await writeTextFile(await workPath(), text);
}

/** Relative to the work dir (mdmailer cwd), e.g. `assets/pasted/img-….png`. */
const pastedDir = async () => join(await workDir(), "assets", "pasted");

/** Persist a pasted/dropped image and return a Markdown-relative path under `assets/pasted/`. */
export async function savePastedImage(bytes: Uint8Array, mimeOrExt = "image/png"): Promise<string> {
  await ensureWorkspace();
  const dir = await pastedDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  const ext = (EXT_BY_MIME[mimeOrExt] ?? (mimeOrExt.replace(/^\./, "") || "png")).toLowerCase();
  const name = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(await join(dir, name), bytes);
  return `assets/pasted/${name}`;
}

const assetUrlCache = new Map<string, Promise<string>>();

/**
 * Displayable URL for an image src in the working document. Relative paths (pasted images,
 * template host photos) resolve against the work dir and are served as blob URLs.
 */
export function workAssetUrl(src: string): Promise<string> {
  if (/^(https?:|data:|blob:)/.test(src)) return Promise.resolve(src);
  let url = assetUrlCache.get(src);
  if (!url) {
    url = (async () => blobUrlFor(await join(await workDir(), ...src.replace(/^\.\//, "").split("/"))))();
    url.catch(() => assetUrlCache.delete(src));
    assetUrlCache.set(src, url);
  }
  return url;
}

/** Save a picked file (e.g. a host photo) into the workspace and return its relative path. */
export async function importWorkAsset(sourcePath: string): Promise<string> {
  const bytes = await readFile(sourcePath);
  const ext = sourcePath.split(".").pop()?.toLowerCase() ?? "png";
  return savePastedImage(bytes, ext);
}

/** Clear paste scratch images (called when starting a fresh compose session). */
export async function clearPastedImages() {
  await ensureWorkspace();
  const dir = await pastedDir();
  if (await exists(dir)) await remove(dir, { recursive: true });
}

export async function listTemplates(): Promise<string[]> {
  const dir = await templatesDir();
  return (await readDir(dir)).filter((e) => e.name.endsWith(".md")).map((e) => e.name.slice(0, -3)).sort();
}
const mdmailerDir = async () => resolveResource("resources/mdmailer/node_modules/@goatcheese/mdmailer");
const templatesDir = async () => join(await mdmailerDir(), "templates");
export async function readTemplate(name: string) {
  return readTextFile(await join(await templatesDir(), `${name}.md`));
}

// ---- rendering ------------------------------------------------------------

export type Rendered = { html?: string; pngUrl?: string; paths: Partial<Record<Format, string>> };

async function ensureConfig() {
  // Always rewritten so configs saved by older versions (custom color, default preset) are replaced.
  await saveBranding(await loadBranding());
  return configPath();
}

async function cliPath() {
  return join(await mdmailerDir(), "dist", "cli.js");
}

/** Run mdmailer on the working file; outputs land in the scratch out folder. */
export async function render(formats: Format[]): Promise<Rendered> {
  await ensureWorkspace();
  const cfg = await ensureConfig();

  const out = await outDir();
  const cmd = Command.sidecar(
    "binaries/node",
    [await cliPath(), await workPath(), "--output", out, "--config", cfg, "--format", formats.join(",")],
    { cwd: await workDir() },
  );
  const res = await cmd.execute();
  if (res.code !== 0) throw new Error((res.stderr || res.stdout || "mdmailer failed").trim());

  const paths: Rendered["paths"] = {};
  for (const f of formats) paths[f] = await join(out, `${WORK_NAME}.${f}`);
  const result: Rendered = { paths };
  if (paths.html) result.html = await readTextFile(paths.html);
  if (paths.png) {
    const bytes = await readFile(paths.png);
    result.pngUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  }
  return result;
}

/** Copy generated files to user-chosen locations. */
export async function exportTo(source: string, target: string) {
  await writeFile(target, await readFile(source));
}

// ---- live preview ---------------------------------------------------------

let previewChild: Child | null = null;
let previewGeneration = 0;

const PREVIEW_URL_RE = /https?:\/\/127\.0\.0\.1:\d+/;

export type PreviewState = {
  file: string;
  version: number;
  updating: boolean;
  error: string;
  html?: string;
};

/** Stop the running mdmailer preview server, if any. */
async function stopPreview() {
  previewGeneration++;
  const child = previewChild;
  previewChild = null;
  if (child) {
    try {
      // Never let a stuck kill block the next start.
      await withTimeout(child.kill(), 2_000, "kill");
    } catch {
      /* already exited or unresponsive */
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`mdmailer preview: ${what} timed out`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// One shared preview session per app. React StrictMode and Fast Refresh mount/unmount the composer
// in quick succession; reference-counting keeps them on the same server instead of racing two starts.
let session: Promise<{ url: string }> | null = null;
let sessionUsers = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Start (or join) the live preview session. A fresh session resets the working file to `initialDoc`.
 * Rejects within ~25s instead of hanging. Pair every call with `releasePreview()`.
 */
export function acquirePreview(initialDoc: string): Promise<{ url: string }> {
  sessionUsers++;
  clearTimeout(stopTimer);
  if (!session) {
    const s = withTimeout(
      (async () => {
        await clearPastedImages();
        await writeWorking(initialDoc);
        return startPreview();
      })(),
      25_000,
      "start",
    );
    session = s;
    s.catch(() => {
      if (session === s) session = null;
    });
  }
  return session;
}

export function releasePreview() {
  sessionUsers = Math.max(0, sessionUsers - 1);
  if (sessionUsers > 0) return;
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (sessionUsers > 0) return;
    session = null;
    void stopPreview();
  }, 500);
}

/** Drop the current session (e.g. after an error) so the next acquire starts a new server. */
export async function resetPreview() {
  session = null;
  await stopPreview();
}

/**
 * Start `mdmailer preview` for the working file on a free port.
 * Restarts if a previous preview is still running.
 */
async function startPreview(): Promise<{ url: string }> {
  await ensureWorkspace();
  await ensureConfig();
  await stopPreview();

  const generation = previewGeneration;
  const cfg = await configPath();
  const cmd = Command.sidecar(
    "binaries/node",
    [await cliPath(), "preview", await workPath(), "--config", cfg, "--port", "0"],
    { cwd: await workDir() },
  );

  let settled = false;
  let buf = "";
  const spawned = { child: null as Child | null };

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };
      const timeout = setTimeout(() => {
        finish(() => reject(new Error("mdmailer preview did not start (timed out waiting for URL)")));
      }, 15_000);

      const onChunk = (chunk: string) => {
        buf += chunk;
        const m = buf.match(PREVIEW_URL_RE);
        if (m) finish(() => resolve(m[0]));
      };

      cmd.stdout.on("data", onChunk);
      cmd.stderr.on("data", onChunk);
      cmd.on("error", (e) => finish(() => reject(new Error(e))));
      cmd.on("close", ({ code }) => {
        finish(() => reject(new Error(`mdmailer preview exited early (code ${code ?? "?"})`)));
      });

      void cmd
        .spawn()
        .then((child) => {
          spawned.child = child;
          if (generation === previewGeneration) previewChild = child;
          else void child.kill().catch(() => {});
        })
        .catch((e) => {
          finish(() => reject(e instanceof Error ? e : new Error(String(e))));
        });
    });

    if (generation !== previewGeneration) {
      if (spawned.child) void spawned.child.kill().catch(() => {});
      throw new Error("Preview superseded");
    }

    return { url };
  } catch (e) {
    if (generation === previewGeneration) {
      previewChild = null;
      if (spawned.child) {
        try {
          await spawned.child.kill();
        } catch {
          /* already exited */
        }
      }
    }
    throw e;
  }
}

/** Poll the preview server `/state` endpoint (bypasses webview CORS via Tauri HTTP). */
export async function fetchPreviewState(url: string, version: number): Promise<PreviewState> {
  const res = await tauriFetch(`${url}/state?version=${version}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Preview server returned ${res.status}`);
  return (await res.json()) as PreviewState;
}
