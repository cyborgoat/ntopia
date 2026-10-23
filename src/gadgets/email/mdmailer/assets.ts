import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ensureWorkspace, workDir, workPath } from "./paths";

export const MIME_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const EXT_BY_MIME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext])),
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

/** Read a file and expose it as a blob URL typed from its extension; the caller revokes it. */
export async function blobUrlFor(path: string): Promise<string> {
  const bytes = await readFile(path);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return URL.createObjectURL(new Blob([bytes], { type: MIME_BY_EXT[ext] ?? "application/octet-stream" }));
}

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
