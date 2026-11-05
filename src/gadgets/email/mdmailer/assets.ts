import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { ensureWorkspace, workDir } from "./paths";

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

/** Where imported images live, relative to the work dir (mdmailer's cwd). Shared by every email and never wiped. */
export const LIBRARY_DIR = "assets/library";

const IMAGE_EXTS = new Set(Object.keys(MIME_BY_EXT));
const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** Absolute path of a work-relative reference; refuses anything that could leave the work folder. */
async function workFile(rel: string): Promise<string> {
  const parts = rel.replace(/^\.\//, "").split("/");
  if (!rel || rel.startsWith("/") || /^[a-zA-Z]:/.test(rel) || parts.some((p) => p === ".." || p === "")) {
    throw new Error(`"${rel}" is not a path inside the image library.`);
  }
  return join(await workDir(), ...parts);
}

/** File-name friendly form of a title: lowercase words joined by dashes (CJK is kept). */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "image";
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type LibraryImage = {
  /** Work-relative path as written into Markdown, e.g. `assets/library/maya-thompson.jpg`. */
  path: string;
  name: string;
};

/** Every image under the work folder's `assets/`: the library itself plus the bundled samples and older pasted images. */
export async function listLibrary(): Promise<LibraryImage[]> {
  await ensureWorkspace();
  const out: LibraryImage[] = [];
  async function walk(rel: string) {
    const dir = await join(await workDir(), ...rel.split("/"));
    if (!(await exists(dir))) return;
    for (const entry of await readDir(dir)) {
      if (entry.isDirectory) await walk(`${rel}/${entry.name}`);
      else if (IMAGE_EXTS.has(extOf(entry.name))) out.push({ path: `${rel}/${entry.name}`, name: entry.name });
    }
  }
  await walk("assets");
  // Imported images first, then the bundled samples and older pasted images.
  return out.sort((a, b) => Number(b.path.startsWith(LIBRARY_DIR)) - Number(a.path.startsWith(LIBRARY_DIR)) || a.path.localeCompare(b.path));
}

/**
 * Add an image to the library and return its work-relative path. An identical image already in the library is
 * reused instead of copied again; otherwise the name comes from `nameHint` (made unique with -2, -3, …).
 */
export async function addToLibrary(bytes: Uint8Array, mimeOrExt = "image/png", nameHint = ""): Promise<string> {
  await ensureWorkspace();
  const dir = await join(await workDir(), ...LIBRARY_DIR.split("/"));
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  const ext = (EXT_BY_MIME[mimeOrExt] ?? (mimeOrExt.replace(/^\./, "") || "png")).toLowerCase();

  const taken = new Set<string>();
  const hash = await sha256(bytes);
  for (const entry of await readDir(dir)) {
    taken.add(entry.name.toLowerCase());
    if (entry.isDirectory || !IMAGE_EXTS.has(extOf(entry.name))) continue;
    const existing = await readFile(await join(dir, entry.name));
    if (existing.length === bytes.length && (await sha256(existing)) === hash) return `${LIBRARY_DIR}/${entry.name}`;
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/\D/g, "").replace(/^(\d{8})(\d{6})$/, "$1-$2");
  const base = nameHint ? slugify(nameHint.replace(/\.[^.]+$/, "")) : `pasted-${stamp}`;
  let name = `${base}.${ext}`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}-${n}.${ext}`;
  await writeFile(await join(dir, name), bytes);
  return `${LIBRARY_DIR}/${name}`;
}

/** Add a pasted or dropped image to the library. */
export const savePastedImage = (bytes: Uint8Array, mimeOrExt = "image/png", nameHint = "") => addToLibrary(bytes, mimeOrExt, nameHint);

/** Remove one image from the work folder. */
export async function removeLibraryImage(rel: string) {
  await remove(await workFile(rel));
  forgetAssetUrl(rel);
}

/** The bytes of a work-relative image, for export. */
export async function readWorkAsset(rel: string): Promise<Uint8Array> {
  return readFile(await workFile(rel));
}

const assetUrlCache = new Map<string, Promise<string>>();

function forgetAssetUrl(src: string) {
  const cached = assetUrlCache.get(src);
  assetUrlCache.delete(src);
  void cached?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
}

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

/** Add a picked file (e.g. a host photo) to the library, keeping its file name, and return its relative path. */
export async function importWorkAsset(sourcePath: string): Promise<string> {
  const bytes = await readFile(sourcePath);
  const file = sourcePath.split(/[\\/]/).pop() ?? "image";
  return addToLibrary(bytes, extOf(file) || "png", file);
}
