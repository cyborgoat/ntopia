import { appDataDir, join, resolveResource } from "@tauri-apps/api/path";
import {
  copyFile, exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile,
} from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Child, Command } from "@tauri-apps/plugin-shell";

export type Format = "html" | "eml" | "png";

export type Branding = {
  organization: string;
  primaryColor: string;
  tagline: string;
  footerText: string;
  preset: "classic" | "navy-gold" | "forest-cream";
  /** File name of a logo inside the branding folder. */
  logo: string;
};

export const DEFAULT_BRANDING: Branding = {
  organization: "My Team",
  primaryColor: "#111827",
  tagline: "",
  footerText: "© {{organization}}",
  preset: "classic",
  logo: "logo.svg",
};

const PLACEHOLDER_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48"><rect width="160" height="48" rx="10" fill="#111827"/><text x="80" y="31" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">NTOPIA</text></svg>`;

const root = async () => join(await appDataDir(), "email");
export const draftsDir = async () => join(await root(), "drafts");
// Use `out` (not `.out`): tauri-plugin-fs forbids leading-dot paths on Unix by default
// (`require_literal_leading_dot`), which made create/import fail with "forbidden path …/.out".
const outDir = async () => join(await root(), "out");
const brandingPath = async () => join(await root(), "branding.json");
const configPath = async () => join(await root(), "mdmailer.config.json");

export async function ensureWorkspace() {
  for (const d of [await root(), await draftsDir(), await outDir()]) {
    if (!(await exists(d))) await mkdir(d, { recursive: true });
  }
  const logo = await join(await root(), "logo.svg");
  if (!(await exists(logo))) await writeTextFile(logo, PLACEHOLDER_LOGO);
  // Bundled templates reference sample images (assets/images/…) relative to the drafts folder.
  // Asset copy must not block creating/editing drafts if the sidecar resources are missing.
  const assets = await join(await draftsDir(), "assets");
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

// ---- branding -------------------------------------------------------------

export async function loadBranding(): Promise<Branding> {
  await ensureWorkspace();
  const p = await brandingPath();
  if (!(await exists(p))) return DEFAULT_BRANDING;
  return { ...DEFAULT_BRANDING, ...JSON.parse(await readTextFile(p)) };
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
          primaryColor: b.primaryColor,
          ...(b.tagline && { tagline: b.tagline }),
          footerText: b.footerText,
          preset: b.preset,
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

// ---- drafts ---------------------------------------------------------------

export async function listDrafts(): Promise<string[]> {
  await ensureWorkspace();
  const entries = await readDir(await draftsDir());
  return entries.filter((e) => e.isFile && e.name.endsWith(".md")).map((e) => e.name.slice(0, -3)).sort();
}

const draftPath = async (name: string) => join(await draftsDir(), `${name}.md`);
export const readDraft = async (name: string) => {
  await ensureWorkspace();
  return readTextFile(await draftPath(name));
};
export const writeDraft = async (name: string, text: string) => {
  await ensureWorkspace();
  await writeTextFile(await draftPath(name), text);
};
export const deleteDraft = async (name: string) => {
  await ensureWorkspace();
  await remove(await draftPath(name));
};
export async function renameDraft(from: string, to: string) {
  await rename(await draftPath(from), await draftPath(to));
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
  const cfg = await configPath();
  if (!(await exists(cfg))) await saveBranding(await loadBranding());
  return cfg;
}

async function cliPath() {
  return join(await mdmailerDir(), "dist", "cli.js");
}

/** Run mdmailer on a saved draft; outputs land in a scratch folder named after the draft. */
export async function render(name: string, formats: Format[]): Promise<Rendered> {
  await ensureWorkspace();
  const cfg = await ensureConfig();

  const out = await outDir();
  const cmd = Command.sidecar(
    "binaries/node",
    [await cliPath(), await draftPath(name), "--output", out, "--config", cfg, "--format", formats.join(",")],
    { cwd: await draftsDir() },
  );
  const res = await cmd.execute();
  if (res.code !== 0) throw new Error((res.stderr || res.stdout || "mdmailer failed").trim());

  const paths: Rendered["paths"] = {};
  for (const f of formats) paths[f] = await join(out, `${name}.${f}`);
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
export async function stopPreview() {
  previewGeneration++;
  const child = previewChild;
  previewChild = null;
  if (child) {
    try {
      await child.kill();
    } catch {
      /* already exited */
    }
  }
}

/**
 * Start `mdmailer preview` for a draft on a free port.
 * Restarts if a previous preview is still running.
 */
export async function startPreview(name: string): Promise<{ url: string }> {
  await ensureWorkspace();
  await ensureConfig();
  await stopPreview();

  const generation = previewGeneration;
  const cfg = await configPath();
  const draft = await draftPath(name);
  const cmd = Command.sidecar(
    "binaries/node",
    [await cliPath(), "preview", draft, "--config", cfg, "--port", "0"],
    { cwd: await draftsDir() },
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
