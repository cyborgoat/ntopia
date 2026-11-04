import { useEffect, useMemo, useState } from "react";
import { cn, toMessage } from "@/lib/utils";
import { usePanelLayout, usePersistedChoice, usePersistedFlag } from "@/lib/prefs";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Eye, EyeOff, FileCode, FileImage, FileText, FolderOpen, ListChecks, Loader2, Mail, Mailbox, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { isTauri } from "@/lib/storage";
import { DetailsPanel } from "@/gadgets/email/details-panel";
import { SourceEditor } from "@/gadgets/email/source-editor";
import { Branding } from "@/gadgets/email/branding-dialog";
import { useEmailExport } from "@/gadgets/email/use-email-export";
import { useLivePreview } from "@/gadgets/email/use-live-preview";
import { TemplateGallery, TemplatePicker } from "@/gadgets/email/template-picker";
import { joinDoc, splitDoc, type Frontmatter } from "@/gadgets/email/frontmatter";
import { loadDraft, saveDraft } from "@/gadgets/email/draft";
import { SaveTemplate } from "@/gadgets/email/save-template";
import { USER_PREFIX, deleteUserTemplate, isUserTemplate, loadUserTemplates, saveUserTemplate } from "@/gadgets/email/user-templates";
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

function EmailGadget() {
  if (!isTauri()) {
    return <p className="text-sm text-muted-foreground">The email composer needs the desktop app (run with <code>pnpm tauri dev</code>).</p>;
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
  // The document as last loaded (blank or a template); anything else counts as an unsaved edit.
  const [baseline, setBaseline] = useState(saved?.baseline ?? joinDoc(BLANK_META, BLANK_BODY));
  const [showPreview, setShowPreview] = usePersistedFlag(PREVIEW_KEY, true);
  const { html, busy, error, retry: retryPreview, reset: resetPreviewOutput, setError } = useLivePreview(started, doc);
  const [templates, setTemplates] = useState<string[]>([]);
  const [userTemplates, setUserTemplates] = useState(loadUserTemplates);
  const [layout, saveLayout] = usePanelLayout(LAYOUT_KEY, DEFAULT_LAYOUT);

  const togglePreview = () => setShowPreview((v) => !v);

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
    mm.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function startDraft(data: Frontmatter, nextBody: string) {
    await mm.clearPastedImages();
    setMeta(data);
    setBody(nextBody);
    setBaseline(joinDoc(data, nextBody));
    resetPreviewOutput();
    setStarted(true);
  }

  async function loadTemplate(t: string) {
    try {
      const mine = isUserTemplate(t) ? userTemplates.find((u) => USER_PREFIX + u.id === t) : undefined;
      if (isUserTemplate(t) && !mine) throw new Error("Template no longer exists");
      const { data, body: templateBody } = splitDoc(mine ? mine.doc : await mm.readTemplate(t));
      await startDraft(data, templateBody.replace(/^\n+/, ""));
    } catch (e) {
      const msg = toMessage(e);
      setError(msg);
      toast.error(msg);
    }
  }

  function saveAsTemplate(name: string) {
    setUserTemplates(saveUserTemplate(name, doc, String(meta.lang ?? "en")));
    toast.success(`Saved template “${name}”`);
  }

  const { exportMd, exportOne, exportAll, openInMail } = useEmailExport(meta, doc);

  const exportMenuItems = (
    <>
      <ContextMenuItem onClick={() => void openInMail()}><Mail /> Open in Mail</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void exportMd()}><FileText /> Markdown</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("html")}><FileCode /> HTML</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("eml")}><Mailbox /> EML</ContextMenuItem>
      <ContextMenuItem onClick={() => void exportOne("png")}><FileImage /> PNG</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void exportAll()}><FolderOpen /> Export all…</ContextMenuItem>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        {/* Start: where the draft comes from */}
        <div className="flex items-center gap-1" role="group" aria-label="Start">
          {started && (
            <TemplatePicker
              templates={templates}
              userTemplates={userTemplates}
              onDeleteUser={(id) => setUserTemplates(deleteUserTemplate(id))}
              dirty={doc !== baseline}
              onPick={(t) => void loadTemplate(t)}
            />
          )}
          {started && <SaveTemplate defaultName={meta.title === "Untitled" ? "" : String(meta.title ?? "")} existingNames={userTemplates.map((t) => t.name)} onSave={saveAsTemplate} />}
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
            <Tooltip>
              <TooltipTrigger render={<DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" disabled={!started} aria-label="Export" />} />}>
                <Download />
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void exportMd()}><FileText /> Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("html")}><FileCode /> HTML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("eml")}><Mailbox /> EML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportOne("png")}><FileImage /> PNG</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void exportAll()}><FolderOpen /> Export all…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<Button size="icon-sm" disabled={!started} aria-label="Open in Mail" onClick={() => void openInMail()} />}>
              <Mail />
            </TooltipTrigger>
            <TooltipContent>Open in Mail</TooltipContent>
          </Tooltip>
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
              userTemplates={userTemplates}
              onDeleteUser={(id) => setUserTemplates(deleteUserTemplate(id))}
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
                  <span className="text-sm font-medium">Preview</span>
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
                      <Button size="sm" variant="outline" onClick={retryPreview}>Retry</Button>
                    </div>
                  )}
                  {html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
                  {!html && !error && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground" role="status">
                      <Loader2 className="size-6 animate-spin" />
                      <p>Rendering preview…</p>
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
