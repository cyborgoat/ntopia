import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { Copy, Download, FileText, FolderOpen, Mail, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Field } from "@/components/form-dialog";
import { isTauri } from "@/lib/storage";
import { splitDoc } from "@/gadgets/email/frontmatter";
import * as mm from "@/gadgets/email/mdmailer";

export const Route = createFileRoute("/_app/gadgets/email")({ component: EmailGadget });

const THEMES = ["classic", "navy-gold", "forest-cream"] as const;
const BLANK = "---\ntitle: \"Untitled\"\ntype: news\nlang: en\n---\n\n## Hello\n\nWrite your message…\n";
const LAYOUT_KEY = "ntopia.email-composer.layout";
const DEFAULT_LAYOUT = { editor: 50, preview: 50 };

function loadLayout(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (parsed.editor != null && parsed.preview != null) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

function exportBasename(doc: string) {
  const title = splitDoc(doc).data.title;
  const raw = String(title ?? "email").trim() || "email";
  return raw.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 64) || "email";
}

function EmailGadget() {
  if (!isTauri()) {
    return <p className="text-sm text-muted-foreground">The email composer needs the desktop app (run with <code>pnpm tauri:dev</code>).</p>;
  }
  return <Composer />;
}

function Composer() {
  const [doc, setDoc] = useState(BLANK);
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState("");
  const [pngUrl, setPngUrl] = useState<string>();
  const [tab, setTab] = useState<"html" | "png">("html");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const versionRef = useRef(0);
  const pngUrlRef = useRef<string | undefined>(undefined);
  const layout = useMemo(() => loadLayout(), []);

  const clearPng = useCallback(() => {
    if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    pngUrlRef.current = undefined;
    setPngUrl(undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await mm.clearPastedImages();
        await mm.writeWorking(BLANK);
        const { url } = await mm.startPreview();
        if (cancelled) return;
        setPreviewUrl(url);
        setReady(true);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    mm.listTemplates().then(setTemplates).catch(() => {});
    return () => {
      cancelled = true;
      void mm.stopPreview();
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    };
  }, []);

  const pasteImages = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste(event: ClipboardEvent, view: EditorView) {
          const dt = event.clipboardData;
          if (!dt) return false;
          const files: File[] = [];
          for (const item of dt.items) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
          for (const f of Array.from(dt.files)) {
            if (f.type.startsWith("image/") && !files.includes(f)) files.push(f);
          }
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.state.selection.main.head;
          void (async () => {
            try {
              const chunks: string[] = [];
              for (const file of files) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const rel = await mm.savePastedImage(bytes, file.type || "image/png");
                const alt = file.name.replace(/\.[^.]+$/, "") || "image";
                chunks.push(`![${alt}](${rel})`);
              }
              const insert = `${chunks.join("\n")}\n`;
              view.dispatch({
                changes: { from: pos, to: pos, insert },
                selection: { anchor: pos + insert.length },
              });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e));
            }
          })();
          return true;
        },
      }),
    [],
  );

  useEffect(() => {
    if (!previewUrl) return;
    let stopped = false;
    const tick = async () => {
      try {
        const state = await mm.fetchPreviewState(previewUrl, versionRef.current);
        if (stopped) return;
        setBusy(state.updating);
        if (state.error) setError(state.error);
        else if (state.html !== undefined) {
          setHtml(state.html);
          versionRef.current = state.version;
          setError("");
          clearPng();
        } else if (!state.updating) {
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
      if (!stopped) timer = setTimeout(tick, 500);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [previewUrl, clearPng]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void mm.writeWorking(doc).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [doc, ready]);

  useEffect(() => {
    if (tab !== "png" || !ready || pngUrl || error) return;
    let cancelled = false;
    setBusy(true);
    mm.render(["png"])
      .then((r) => {
        if (cancelled) {
          if (r.pngUrl) URL.revokeObjectURL(r.pngUrl);
          return;
        }
        if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
        pngUrlRef.current = r.pngUrl;
        setPngUrl(r.pngUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, ready, pngUrl, error, html]);

  async function loadTemplate(t: string) {
    try {
      const text = await mm.readTemplate(t);
      setDoc(text);
      clearPng();
      setHtml("");
      await mm.writeWorking(text);
      setError("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  }

  const base = exportBasename(doc);

  async function exportMd() {
    try {
      const target = await save({ defaultPath: `${base}.md`, filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (target) {
        await writeTextFile(target, doc);
        toast.success("Saved Markdown");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function exportOne(format: mm.Format) {
    try {
      const r = await mm.render([format]);
      const target = await save({ defaultPath: `${base}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (target) {
        await mm.exportTo(r.paths[format]!, target);
        toast.success(`Saved ${format.toUpperCase()}`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function exportAll() {
    try {
      const dir = await open({ directory: true, title: "Export to folder" });
      if (!dir || Array.isArray(dir)) return;
      await writeTextFile(await join(dir, `${base}.md`), doc);
      const r = await mm.render(["html", "eml", "png"]);
      for (const f of ["html", "eml", "png"] as const) {
        await mm.exportTo(r.paths[f]!, await join(dir, `${base}.${f}`));
      }
      toast.success("Exported Markdown, HTML, EML and PNG");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function openInMail() {
    try {
      const r = await mm.render(["eml"]);
      await openPath(r.paths.eml!);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Branding />
        {templates.length > 0 && (
          <Select onValueChange={(t) => { if (typeof t === "string") void loadTemplate(t); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Template…" /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" onClick={() => void openInMail()}><Mail /> Open in Mail</Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void exportMd()}><FileText /> Save Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("html")}><Download /> Save HTML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("eml")}><Download /> Save EML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("png")}><Download /> Save PNG</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!html} onClick={() => void navigator.clipboard.writeText(html).then(() => toast.success("HTML copied"))}>
                <Copy /> Copy HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAll()}><FolderOpen /> Export all…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1"
        id="email-composer"
        defaultLayout={layout}
        onLayoutChanged={(next) => {
          try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }}
      >
        <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="25%" className="min-w-0">
          <div className="h-full min-h-0 overflow-auto text-sm">
            <CodeMirror
              value={doc}
              extensions={[markdown(), pasteImages]}
              basicSetup={{ lineNumbers: false, foldGutter: false }}
              onChange={setDoc}
              height="100%"
              style={{ height: "100%" }}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="preview" defaultSize={`${layout.preview}%`} minSize="25%" className="min-w-0">
          <section className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "html" | "png")}>
                <TabsList><TabsTrigger value="html">Email</TabsTrigger><TabsTrigger value="png">PNG card</TabsTrigger></TabsList>
              </Tabs>
              {busy && <span className="text-xs text-muted-foreground">Rendering…</span>}
            </div>
            <div className="relative min-h-0 flex-1 overflow-auto bg-muted/40">
              {error && <pre className="m-3 whitespace-pre-wrap rounded-md border border-destructive/30 bg-background p-3 text-xs text-destructive">{error}</pre>}
              {tab === "html" && html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
              {tab === "png" && !error && pngUrl && <img src={pngUrl} alt="PNG card" className="mx-auto max-w-full p-4" />}
              {tab === "html" && !html && !busy && !error && (
                <p className="p-6 text-sm text-muted-foreground">Waiting for live preview…</p>
              )}
            </div>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function Branding() {
  const [b, setB] = useState<mm.Branding>(mm.DEFAULT_BRANDING);
  const [openDlg, setOpenDlg] = useState(false);
  useEffect(() => { if (openDlg) mm.loadBranding().then(setB); }, [openDlg]);
  const set = (k: keyof mm.Branding) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });

  return (
    <Dialog open={openDlg} onOpenChange={setOpenDlg}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Branding" />}><Palette /></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Email branding</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Organization"><Input value={b.organization} onChange={set("organization")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary color"><Input type="color" value={b.primaryColor} onChange={set("primaryColor")} /></Field>
            <Field label="Default theme">
              <Select value={b.preset} onValueChange={(v) => v && setB({ ...b, preset: v as mm.Branding["preset"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Tagline"><Input value={b.tagline} onChange={set("tagline")} /></Field>
          <Field label="Footer"><Input value={b.footerText} onChange={set("footerText")} /></Field>
          <Field label="Logo">
            <Button variant="outline" size="sm" onClick={async () => {
              const f = await open({ filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg"] }] });
              if (f && !Array.isArray(f)) setB({ ...b, logo: await mm.setLogo(f) });
            }}>{b.logo.startsWith("logo-custom") ? "Replace logo" : "Choose logo"}</Button>
          </Field>
          <Button className="w-full" onClick={async () => { await mm.saveBranding(b); toast.success("Branding saved"); setOpenDlg(false); }}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
