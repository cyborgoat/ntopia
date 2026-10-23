import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { Frontmatter } from "@/gadgets/email/frontmatter";
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

/** Save / export actions for the current document; every action reports its own errors with a toast. */
export function useEmailExport(meta: Frontmatter, doc: string) {
  const base = exportBasename(meta);

  async function exportMd() {
    try {
      const target = await save({ defaultPath: `${base}.md`, filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (target) {
        await writeTextFile(target, doc);
        toast.success("Saved Markdown");
      }
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function exportOne(format: mm.Format) {
    try {
      const r = await mm.render(doc, [format]);
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
      await writeTextFile(await join(dir, `${base}.md`), doc);
      const r = await mm.render(doc, ["html", "eml", "png"]);
      for (const f of ["html", "eml", "png"] as const) {
        await writeOutput(await join(dir, `${base}.${f}`), f, r);
      }
      toast.success("Exported Markdown, HTML, EML and PNG");
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function openInMail() {
    try {
      const r = await mm.render(doc, ["eml"]);
      const target = await join(await mm.outDir(), `${base}.eml`);
      await writeOutput(target, "eml", r);
      await openPath(target);
    } catch (e) { toast.error(toMessage(e)); }
  }

  return { exportMd, exportOne, exportAll, openInMail };
}
