import { useEffect, useMemo, useRef, useState } from "react";
import { toMessage } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { Copy, Download, Eye, EyeOff, FileText, FolderOpen, ImagePlus, ListChecks, Mail, Palette, PenLine, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Field } from "@/components/form-dialog";
import { isTauri } from "@/lib/storage";
import { DetailsPanel } from "@/gadgets/email/details-panel";
import { SourceEditor } from "@/gadgets/email/source-editor";
import { TemplatePicker } from "@/gadgets/email/template-picker";
import { joinDoc, splitDoc, type Frontmatter } from "@/gadgets/email/frontmatter";
import * as mm from "@/gadgets/email/mdmailer";

export const Route = createFileRoute("/_app/gadgets/email")({ component: EmailGadget });

const BLANK_META: Frontmatter = { title: "Untitled", type: "news", lang: "en" };
const BLANK_BODY = "## Hello\n\nWrite your message…\n";
const LAYOUT_KEY = "ntopia.email-composer.layout";
const PREVIEW_KEY = "ntopia.email-composer.preview";
const TAB_KEY = "ntopia.email-composer.tab";
const HINT_KEY = "ntopia.email-composer.hint-dismissed";
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

function loadShowPreview() {
  try {
    return localStorage.getItem(PREVIEW_KEY) !== "0";
  } catch {
    return true;
  }
}

type Tab = "details" | "message";

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "message" ? "message" : "details";
  } catch {
    return "details";
  }
}

function loadHintDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function exportBasename(meta: Frontmatter) {
  const title = meta.title;
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
  const [meta, setMeta] = useState<Frontmatter>(BLANK_META);
  const [body, setBody] = useState(BLANK_BODY);
  const doc = useMemo(() => joinDoc(meta, body), [meta, body]);
  // The document as last loaded (blank or a template); anything else counts as an unsaved edit.
  const [baseline, setBaseline] = useState(() => joinDoc(BLANK_META, BLANK_BODY));
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState("");
  const [showPreview, setShowPreview] = useState(loadShowPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const versionRef = useRef(0);
  const layout = useMemo(() => loadLayout(), []);

  function togglePreview() {
    setShowPreview((v) => {
      try {
        localStorage.setItem(PREVIEW_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }

  const [attempt, setAttempt] = useState(0);
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [hintDismissed, setHintDismissed] = useState(loadHintDismissed);

  function setTab(next: Tab) {
    setTabState(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function dismissHint() {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    mm.acquirePreview(joinDoc(BLANK_META, BLANK_BODY))
      .then(({ url }) => {
        if (cancelled) return;
        setPreviewUrl(url);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(toMessage(e));
      });
    return () => {
      cancelled = true;
      mm.releasePreview();
    };
  }, [attempt]);

  useEffect(() => {
    mm.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function retryPreview() {
    setReady(false);
    setPreviewUrl(null);
    await mm.resetPreview();
    setAttempt((n) => n + 1);
  }

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
        } else if (!state.updating) {
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(toMessage(e));
      }
      if (!stopped) timer = setTimeout(tick, 500);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void mm.writeWorking(doc).catch((e) => setError(toMessage(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [doc, ready]);

  async function loadTemplate(t: string) {
    try {
      const text = await mm.readTemplate(t);
      const { data, body: templateBody } = splitDoc(text);
      const nextBody = templateBody.replace(/^\n+/, "");
      setMeta(data);
      setBody(nextBody);
      setBaseline(joinDoc(data, nextBody));
      setHtml("");
      await mm.writeWorking(text);
      setError("");
    } catch (e) {
      const msg = toMessage(e);
      setError(msg);
      toast.error(msg);
    }
  }

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
      const r = await mm.render([format]);
      const target = await save({ defaultPath: `${base}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (target) {
        await mm.exportTo(r.paths[format]!, target);
        toast.success(`Saved ${format.toUpperCase()}`);
      }
    } catch (e) { toast.error(toMessage(e)); }
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
    } catch (e) { toast.error(toMessage(e)); }
  }

  async function openInMail() {
    try {
      const r = await mm.render(["eml"]);
      await openPath(r.paths.eml!);
    } catch (e) { toast.error(toMessage(e)); }
  }

  const copyHtml = () => void navigator.clipboard.writeText(html).then(() => toast.success("HTML copied"));

  const exportMenuItems = (
    <>
      <ContextMenuItem onClick={() => void openInMail()}><Mail /> Open in Mail</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void exportMd()}><FileText /> Save Markdown</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("html")}><Download /> Save HTML</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("eml")}><Download /> Save EML</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("png")}><Download /> Save PNG</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!html} onClick={copyHtml}><Copy /> Copy HTML</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportAll()}><FolderOpen /> Export all…</ContextMenuItem>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Branding />
        <TemplatePicker templates={templates} dirty={doc !== baseline} onPick={(t) => void loadTemplate(t)} />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" aria-pressed={showPreview} onClick={togglePreview}>
            {showPreview ? <EyeOff /> : <Eye />} {showPreview ? "Hide preview" : "Show preview"}
          </Button>
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
              <DropdownMenuItem disabled={!html} onClick={copyHtml}>
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
          if (!showPreview) return;
          try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }}
      >
        <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="25%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b px-4 py-1.5" role="tablist" aria-label="Email content">
              <Button role="tab" aria-selected={tab === "details"} size="sm" variant={tab === "details" ? "secondary" : "ghost"} onClick={() => setTab("details")}>
                <ListChecks /> Details
              </Button>
              <Button role="tab" aria-selected={tab === "message"} size="sm" variant={tab === "message" ? "secondary" : "ghost"} onClick={() => setTab("message")}>
                <PenLine /> Message
              </Button>
              <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground">
                {tab === "details" ? "Subject, date, location, hosts, theme" : "The Markdown text of the email"}
              </span>
            </div>
            {!hintDismissed && (
              <div className="flex items-start gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                <p className="flex-1">
                  The preview is built from two parts: <strong className="text-foreground">Details</strong> (the header, event card, hosts
                  and agenda) and <strong className="text-foreground">Message</strong> (the Markdown body). Switch tabs to edit each;
                  the preview updates as you type.
                </p>
                <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={dismissHint}><X /></Button>
              </div>
            )}
            {tab === "details" ? (
              <div className="min-h-0 flex-1 pt-1"><DetailsPanel meta={meta} onChange={setMeta} /></div>
            ) : (
              <ContextMenu>
                <ContextMenuTrigger className="flex min-h-0 flex-1 flex-col">
                  <SourceEditor value={body} onChange={setBody} />
                </ContextMenuTrigger>
                <ContextMenuContent>{exportMenuItems}</ContextMenuContent>
              </ContextMenu>
            )}
          </div>
        </ResizablePanel>
        {showPreview && <ResizableHandle withHandle />}
        {showPreview && <ResizablePanel id="preview" defaultSize={`${layout.preview}%`} minSize="25%" className="min-w-0">
          <ContextMenu>
            <ContextMenuTrigger className="flex h-full min-h-0 flex-col">
              <section className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                  <span className="text-sm font-medium">Preview <span className="font-normal text-muted-foreground">· Details + Message</span></span>
                  {busy && <span className="text-xs text-muted-foreground">Rendering…</span>}
                </div>
                <div className="relative min-h-0 flex-1 overflow-auto bg-muted/40">
                  {error && (
                    <div className="m-3 space-y-2 rounded-md border border-destructive/30 bg-background p-3">
                      <pre className="whitespace-pre-wrap text-xs text-destructive">{error}</pre>
                      {!previewUrl && <Button size="sm" variant="outline" onClick={() => void retryPreview()}>Restart preview</Button>}
                    </div>
                  )}
                  {html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
                  {!html && !busy && !error && (
                    <p className="p-6 text-sm text-muted-foreground">{previewUrl ? "Rendering preview…" : "Starting live preview…"}</p>
                  )}
                </div>
              </section>
            </ContextMenuTrigger>
            <ContextMenuContent>{exportMenuItems}</ContextMenuContent>
          </ContextMenu>
        </ResizablePanel>}
      </ResizablePanelGroup>
    </div>
  );
}

/** Logo tile: the preview itself is the button (click to choose a new file), like an avatar upload. */
function LogoPicker({ name, onPick, onReset }: { name: string; onPick: () => void; onReset?: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    setUrl(undefined);
    mm.logoBlobUrl(name).then((u) => {
      if (live) setUrl((made = u));
      else URL.revokeObjectURL(u);
    }).catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [name]);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPick}
        aria-label="Change logo"
        className="group relative flex h-14 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {url ? <img src={url} alt="Logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/80 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Upload className="size-3.5" /> Change
        </span>
      </button>
      <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
        <p>Shown in the email header. SVG, PNG or JPG.</p>
        {onReset && <button type="button" onClick={onReset} className="underline underline-offset-2 hover:text-foreground">Use default logo</button>}
      </div>
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
          <Field label="Tagline"><Input value={b.tagline} onChange={set("tagline")} /></Field>
          <Field label="Footer"><Input value={b.footerText} onChange={set("footerText")} /></Field>
          <Field label="Logo">
            <LogoPicker
              name={b.logo}
              onPick={async () => {
                const f = await open({ filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg"] }] });
                if (f && !Array.isArray(f)) setB({ ...b, logo: await mm.setLogo(f) });
              }}
              onReset={b.logo.startsWith("logo-custom") ? () => setB({ ...b, logo: mm.DEFAULT_BRANDING.logo }) : undefined}
            />
          </Field>
          <Button className="w-full" onClick={async () => { await mm.saveBranding(b); toast.success("Branding saved"); setOpenDlg(false); }}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
