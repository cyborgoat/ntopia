import { dirname, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { t } from "@/i18n";

export type FileKind = "markdown" | "text" | "image" | "other";
export type Entry = { name: string; path: string; isDir: boolean };

const MARKDOWN = new Set(["md", "markdown", "mdx"]);
const TEXT = new Set([
  "txt", "text", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "csv", "tsv", "log",
  "xml", "html", "htm", "css", "scss", "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "rs", "go", "java", "c", "h",
  "cpp", "sh", "zsh", "sql", "rst", "tex",
]);
const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif",
};

/** Largest text file opened in the editor. */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;

const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** How a file is shown: decided by extension only, so unknown files are never read. */
export function kindOf(name: string): FileKind {
  const ext = extOf(name);
  if (MARKDOWN.has(ext)) return "markdown";
  if (TEXT.has(ext)) return "text";
  if (ext in IMAGE_MIME) return "image";
  return "other";
}

/** A single file or folder name: no separators, no traversal. */
export function validName(name: string): string {
  const n = name.trim();
  if (!n || n === "." || n === ".." || /[\\/]/.test(n)) throw new Error(t("notebook.invalidName", { name }));
  return n;
}

/** Folders first, then files, A–Z. Hidden (dot) entries are skipped. */
export async function listDir(dir: string): Promise<Entry[]> {
  const items = await readDir(dir);
  const entries = await Promise.all(
    items.filter((i) => !i.name.startsWith(".")).map(async (i) => ({ name: i.name, path: await join(dir, i.name), isDir: i.isDirectory })),
  );
  return entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export const fileSize = async (path: string) => (await stat(path)).size;

export async function readText(path: string): Promise<string> {
  if ((await fileSize(path)) > MAX_TEXT_BYTES) throw new Error(t("notebook.tooLarge"));
  return readTextFile(path);
}

export const writeText = (path: string, content: string) => writeTextFile(path, content);

/** Create an empty file; fails rather than overwrite an existing one. */
export async function createFile(dir: string, name: string): Promise<string> {
  const path = await join(dir, validName(name));
  if (await exists(path)) throw new Error(t("notebook.exists", { name }));
  await writeTextFile(path, "");
  return path;
}

export async function createFolder(dir: string, name: string): Promise<string> {
  const path = await join(dir, validName(name));
  if (await exists(path)) throw new Error(t("notebook.exists", { name }));
  await mkdir(path);
  return path;
}

export async function renameEntry(path: string, name: string): Promise<string> {
  const next = await join(await dirname(path), validName(name));
  if (next === path) return path;
  if (await exists(next)) throw new Error(t("notebook.exists", { name }));
  await rename(path, next);
  return next;
}

const SEP = /[\\/]/;
export const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));

/** Whether `path` is `dir` itself or inside it. */
export const isWithin = (path: string, dir: string) => path === dir || path.startsWith(dir + "/") || path.startsWith(dir + "\\");

/** Move a file or folder into another folder, keeping its name. Returns the new path. */
export async function moveEntry(path: string, targetDir: string): Promise<string> {
  if (isWithin(targetDir, path)) throw new Error(t("notebook.moveIntoSelf"));
  const name = path.split(SEP).pop()!;
  const next = await join(targetDir, name);
  if (next === path) return path;
  if (await exists(next)) throw new Error(t("notebook.existsInFolder", { name }));
  await rename(path, next);
  return next;
}

export const removeEntry = (path: string, isDir: boolean) => remove(path, { recursive: isDir });

/** Read an image into a blob URL; the caller revokes it. */
export async function imageBlobUrl(path: string): Promise<string> {
  const bytes = await readFile(path);
  return URL.createObjectURL(new Blob([bytes], { type: IMAGE_MIME[extOf(path)] ?? "application/octet-stream" }));
}

export const isImagePath = (path: string) => kindOf(path) === "image";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
