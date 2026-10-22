import { appDataDir, join, resolveResource } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir, writeTextFile } from "@tauri-apps/plugin-fs";

/** Scratch Markdown file used for live preview / export (not a user-facing draft library). */
export const WORK_NAME = "compose";

const PLACEHOLDER_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48"><rect width="160" height="48" rx="10" fill="#111827"/><text x="80" y="31" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">NTOPIA</text></svg>`;

export const root = async () => join(await appDataDir(), "email");
export const workDir = async () => join(await root(), "work");
// Use `out` (not `.out`): tauri-plugin-fs forbids leading-dot paths on Unix by default.
export const outDir = async () => join(await root(), "out");
export const brandingPath = async () => join(await root(), "branding.json");
export const configPath = async () => join(await root(), "mdmailer.config.json");
export const workPath = async () => join(await workDir(), `${WORK_NAME}.md`);

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

export const mdmailerDir = async () => resolveResource("resources/mdmailer/node_modules/@goatcheese/mdmailer");
export const templatesDir = async () => join(await mdmailerDir(), "templates");
export async function cliPath() {
  return join(await mdmailerDir(), "dist", "cli.js");
}
