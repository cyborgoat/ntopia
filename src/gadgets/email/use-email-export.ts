import { open, save } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { Frontmatter } from "@/gadgets/email/frontmatter";
import { localImageRefs } from "@/gadgets/email/image-refs";
import * as mm from "@/gadgets/email/mdmailer";
import { toMessage } from "@/lib/utils";

function exportBasename(meta: Frontmatter) {
  const title = meta.title;
  const raw = String(title ?? "email").trim() || "email";
  return raw.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 64) || "email";
}

async function writeOutput(path: string, format: mm.Format, r: Awaited<ReturnType<typeof mm.render>>) {
  if (format === "png") await writeFile(path, r.png!);
  else await writeTextFile(path, format === "eml" ? r.eml! : r.html);
}

/** Exports quietly fix a missing or misspelled type/language; say so, so a wrong-kind email never goes out unnoticed. */
function warnDefaults(r: { defaults: string[] }) {
  if (r.defaults.length) toast.warning(r.defaults.join(" "));
}

/**
 * Write the Markdown and, next to it, the images it refers to under the same relative paths (`assets/…`), so the
 * file opens correctly anywhere. Returns how many images were copied and which were missing from the library.
 */
async function writeMarkdownWithAssets(target: string, doc: string) {
  await writeTextFile(target, doc);
  const dir = await dirname(target);
  let copied = 0;
  const missing: string[] = [];
  for (const ref of localImageRefs(doc)) {
    try {
      const bytes = await mm.readWorkAsset(ref);
      const dest = await join(dir, ...ref.split("/"));
      const parent = await dirname(dest);
      if (!(await exists(parent))) await mkdir(parent, { recursive: true });
      await writeFile(dest, bytes);
      copied++;
    } catch {
      missing.push(ref);
    }
  }
  return { copied, missing };
}

function reportMarkdown({ copied, missing }: { copied: number; missing: string[] }, what = "Markdown") {
  toast.success(copied ? `Saved ${what} and ${copied} image${copied === 1 ? "" : "s"} in assets/` : `Saved ${what}`);
  if (missing.length) toast.warning(`Not in the image library, so not copied: ${missing.join(", ")}`);
}

/** Save / export actions for the current document; every action reports its own errors with a toast. */
export function useEmailExport(meta: Frontmatter, doc: string) {
  const base = exportBasename(meta);

  async function exportMd() {
    try {
      const target = await save({ defaultPath: `${base}.md`, filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (target) reportMarkdown(await writeMarkdownWithAssets(target, doc));
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function exportOne(format: mm.Format) {
    try {
      const r = await mm.render(doc, [format]);
      warnDefaults(r);
      const target = await save({ defaultPath: `${base}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (target) {
        await writeOutput(target, format, r);
        toast.success(`Saved ${format.toUpperCase()}`);
      }
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function exportAll() {
    try {
      const dir = await open({ directory: true, title: "Export to folder" });
      if (!dir || Array.isArray(dir)) return;
      const md = await writeMarkdownWithAssets(await join(dir, `${base}.md`), doc);
      const r = await mm.render(doc, ["html", "eml", "png"]);
      warnDefaults(r);
      for (const f of ["html", "eml", "png"] as const) {
        await writeOutput(await join(dir, `${base}.${f}`), f, r);
      }
      toast.success("Exported Markdown, HTML, EML and PNG");
      if (md.missing.length) toast.warning(`Not in the image library, so not copied: ${md.missing.join(", ")}`);
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function openInMail() {
    try {
      const r = await mm.render(doc, ["eml"]);
      warnDefaults(r);
      const target = await join(await mm.outDir(), `${base}.eml`);
      await writeOutput(target, "eml", r);
      await openPath(target);
    } catch (e) { toast.error(toMessage(e)); }
  }

  return { exportMd, exportOne, exportAll, openInMail };
}
