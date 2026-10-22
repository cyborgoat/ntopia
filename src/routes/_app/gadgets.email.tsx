import { useEffect, useMemo, useRef, useState } from "react";
import { cn, toMessage, copyText } from "@/lib/utils";
import { usePanelLayout, usePersistedChoice, usePersistedFlag } from "@/lib/prefs";
import { createFileRoute } from "@tanstack/react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { ChevronDown, Copy, Download, Eye, EyeOff, FileText, FolderOpen, ImagePlus, ListChecks, Loader2, Mail, Palette, PenLine, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { TemplateGallery, TemplatePicker } from "@/gadgets/email/template-picker";
import { joinDoc, splitDoc, type Frontmatter } from "@/gadgets/email/frontmatter";
import { loadDraft, saveDraft } from "@/gadgets/email/draft";
import * as mm from "@/gadgets/email/mdmailer";

export const Route = createFileRoute("/_app/gadgets/email")({ component: EmailGadget });

const BLANK_META: Frontmatter = { title: "Untitled", type: "news", lang: "en" };
const BLANK_BODY = "## Hello\n\nWrite your message…\n";
const LAYOUT_KEY = "ntopia.email-composer.layout";
const PREVIEW_KEY = "ntopia.email-composer.preview";
const TAB_KEY = "ntopia.email-composer.tab";
const HINT_KEY = "ntopia.email-composer.hint-dismissed";
const DEFAULT_LAYOUT = { editor: 50, preview: 50 };

type Tab = "details" | "message";
const TABS = ["details", "message"] as const;

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
  // A saved draft is restored on mount; without one the user is asked to pick a template first.
  const [saved] = useState(loadDraft);
  const [started, setStarted] = useState(saved != null);
  const [meta, setMeta] = useState<Frontmatter>(saved?.meta ?? BLANK_META);
  const [body, setBody] = useState(saved?.body ?? BLANK_BODY);
  const doc = useMemo(() => joinDoc(meta, body), [meta, body]);
  const docRef = useRef(doc);
  docRef.current = doc;
  // The document as last loaded (blank or a template); anything else counts as an unsaved edit.
  const [baseline, setBaseline] = useState(saved?.baseline ?? joinDoc(BLANK_META, BLANK_BODY));
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState("");
  const [showPreview, setShowPreview] = usePersistedFlag(PREVIEW_KEY, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const versionRef = useRef(0);
  const [layout, saveLayout] = usePanelLayout(LAYOUT_KEY, DEFAULT_LAYOUT);

  const togglePreview = () => setShowPreview((v) => !v);

  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = usePersistedChoice<Tab>(TAB_KEY, TABS, "details");
  const [hintDismissed, setHintDismissed] = usePersistedFlag(HINT_KEY, false);

  const dismissHint = () => setHintDismissed(true);

  // Keep the draft across navigation and restarts; the cleanup flushes the pending write on unmount.
  useEffect(() => {
    if (!started) return;
    const draft = { meta, body, baseline };
    const t = setTimeout(() => saveDraft(draft), 300);
    return () => {
      clearTimeout(t);
      saveDraft(draft);
    };
  }, [started, meta, body, baseline]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setError("");
    mm.acquirePreview(docRef.current, { keepImages: true })
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
  }, [attempt, started]);

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

  async function startDraft(data: Frontmatter, nextBody: string) {
    await mm.clearPastedImages();
    setMeta(data);
    setBody(nextBody);
    setBaseline(joinDoc(data, nextBody));
    setHtml("");
    await mm.writeWorking(joinDoc(data, nextBody));
    setStarted(true);
    setError("");
  }

  async function loadTemplate(t: string) {
    try {
      const { data, body: templateBody } = splitDoc(await mm.readTemplate(t));
      await startDraft(data, templateBody.replace(/^\n+/, ""));
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

  const copyHtml = () => copyText(html, "HTML");

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        {/* Start: where the draft comes from */}
        <div className="flex items-center gap-1" role="group" aria-label="Start">
          {started && <TemplatePicker templates={templates} dirty={doc !== baseline} onPick={(t) => void loadTemplate(t)} />}
          <Branding />
        </div>
        <Separator orientation="vertical" className="h-5 self-center" />
        {/* Edit: which part of the email is being edited */}
        <div
          className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", !started && "pointer-events-none opacity-50")}
          role="tablist"
          aria-label="Email content"
        >
          <SegmentButton active={tab === "details"} onClick={() => setTab("details")} hint="Subject, date, location, hosts, theme">
            <ListChecks /> Details
          </SegmentButton>
          <SegmentButton active={tab === "message"} onClick={() => setTab("message")} hint="The Markdown text of the email">
            <PenLine /> Message
          </SegmentButton>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* View */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showPreview ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-pressed={showPreview}
                  disabled={!started}
                  aria-label={showPreview ? "Hide preview" : "Show preview"}
                  onClick={togglePreview}
                />
              }
            >
              {showPreview ? <EyeOff /> : <Eye />}
            </TooltipTrigger>
            <TooltipContent>{showPreview ? "Hide preview" : "Show preview"}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5 self-center" />
          {/* Output: Export is secondary, Open in Mail is the primary action */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Output">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={!started} />}>
              <Download /> Export <ChevronDown className="opacity-60" />
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
          <Button size="sm" disabled={!started} onClick={() => void openInMail()}><Mail /> Open in Mail</Button>
          </div>
        </div>
      </div>

      {!started ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Choose a template to start</h2>
              <p className="text-sm text-muted-foreground">Pick a ready-made layout. You can change every detail afterwards.</p>
            </div>
            <TemplateGallery
              templates={templates}
              dirty={false}
              onPick={(t) => void loadTemplate(t)}
              onBlank={() => void startDraft(BLANK_META, BLANK_BODY).catch((e) => toast.error(toMessage(e)))}
            />
          </div>
        </div>
      ) : (
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1"
        id="email-composer"
        defaultLayout={layout}
        onLayoutChanged={(next) => {
          if (showPreview) saveLayout(next);
        }}
      >
        <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="25%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
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
                <div className="flex h-10 items-center justify-between gap-2 border-b px-4">
                  <span className="text-sm font-medium">Preview <span className="font-normal text-muted-foreground">· Details + Message</span></span>
                  {busy && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                      <Loader2 className="size-3.5 animate-spin" /> Rendering…
                    </span>
                  )}
                </div>
                <div className="relative min-h-0 flex-1 overflow-auto bg-muted/40">
                  {error && (
                    <div className="m-3 space-y-2 rounded-md border border-destructive/30 bg-background p-3">
                      <pre className="whitespace-pre-wrap text-xs text-destructive">{error}</pre>
                      {!previewUrl && <Button size="sm" variant="outline" onClick={() => void retryPreview()}>Restart preview</Button>}
                    </div>
                  )}
                  {html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
                  {!html && !error && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground" role="status">
                      <Loader2 className="size-6 animate-spin" />
                      <p>{previewUrl ? "Rendering preview…" : "Starting live preview…"}</p>
                    </div>
                  )}
                </div>
              </section>
            </ContextMenuTrigger>
            <ContextMenuContent>{exportMenuItems}</ContextMenuContent>
          </ContextMenu>
        </ResizablePanel>}
      </ResizablePanelGroup>
      )}
    </div>
  );
}

function SegmentButton({ active, onClick, hint, children }: { active: boolean; onClick: () => void; hint: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={hint}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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
