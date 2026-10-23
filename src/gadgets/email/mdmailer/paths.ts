import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

/** Scratch Markdown file used for live preview / export (not a user-facing draft library). */
export const WORK_NAME = "compose";

const PLACEHOLDER_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48"><rect width="160" height="48" rx="10" fill="#111827"/><text x="80" y="31" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">NTOPIA</text></svg>`;

export const root = async () => join(await appDataDir(), "email");
export const workDir = async () => join(await root(), "work");
// Use `out` (not `.out`): tauri-plugin-fs forbids leading-dot paths on Unix by default.
export const outDir = async () => join(await root(), "out");
export const brandingPath = async () => join(await root(), "branding.json");
export const workPath = async () => join(await workDir(), `${WORK_NAME}.md`);

export async function ensureWorkspace() {
  for (const d of [await root(), await workDir(), await outDir()]) {
    if (!(await exists(d))) await mkdir(d, { recursive: true });
  }
  const logo = await join(await root(), "logo.svg");
  if (!(await exists(logo))) await writeTextFile(logo, PLACEHOLDER_LOGO);
  // Bundled templates reference sample images (assets/images/…) relative to the work folder.
  const assets = await join(await workDir(), "assets");
  if (!(await exists(assets))) await seedSampleImages();
}

const SAMPLE_HOST_PHOTOS = import.meta.glob("./assets/hosts/*.jpg", { query: "?url", import: "default", eager: true }) as Record<string, string>;

async function seedSampleImages() {
  const dir = await join(await workDir(), "assets", "images", "hosts");
  await mkdir(dir, { recursive: true });
  try {
    for (const [file, url] of Object.entries(SAMPLE_HOST_PHOTOS)) {
      const res = await fetch(url);
      await writeFile(await join(dir, file.split("/").pop()!), new Uint8Array(await res.arrayBuffer()));
    }
  } catch {
    /* templates without images still work */
  }
}
