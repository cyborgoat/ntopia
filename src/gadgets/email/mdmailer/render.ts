import { join } from "@tauri-apps/api/path";
import { readDir, readFile, readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { ensureConfig } from "./branding";
import { WORK_NAME, cliPath, ensureWorkspace, outDir, templatesDir, workDir, workPath } from "./paths";

export type Format = "html" | "eml" | "png";

export async function listTemplates(): Promise<string[]> {
  const dir = await templatesDir();
  return (await readDir(dir)).filter((e) => e.name.endsWith(".md")).map((e) => e.name.slice(0, -3)).sort();
}
export async function readTemplate(name: string) {
  return readTextFile(await join(await templatesDir(), `${name}.md`));
}

export type Rendered = { html?: string; pngUrl?: string; paths: Partial<Record<Format, string>> };

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
