import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { cn, toMessage } from "@/lib/utils";
import { usePanelLayout, usePersistedFlag } from "@/lib/prefs";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Eye, EyeOff, FileCode, FileImage, FileText, FolderOpen, Loader2, Mail, Mailbox, PanelTop } from "lucide-react";
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
import { SourceEditor } from "@/gadgets/email/source-editor";
import { toggleFrontmatter } from "@/gadgets/email/frontmatter-extensions";
import { Branding } from "@/gadgets/email/branding-dialog";
import { ImageLibrary } from "@/gadgets/email/image-library";
import { useEmailExport } from "@/gadgets/email/use-email-export";
import { useLivePreview } from "@/gadgets/email/use-live-preview";
import { TemplateGallery, TemplatePicker } from "@/gadgets/email/template-picker";
import { splitDoc } from "@/gadgets/email/frontmatter";
import { loadDraft, saveDraft } from "@/gadgets/email/draft";
import { SaveTemplate } from "@/gadgets/email/save-template";
import { USER_PREFIX, deleteUserTemplate, isUserTemplate, loadUserTemplates, saveUserTemplate } from "@/gadgets/email/user-templates";
import * as mm from "@/gadgets/email/mdmailer";

export const Route = createFileRoute("/_app/gadgets/email")({ component: EmailGadget });

const BLANK_DOC = "---\ntitle: Untitled\ntype: news\nlang: en\n---\n\n## Hello\n\nWrite your message…\n";
const LAYOUT_KEY = "ntopia.email-composer.layout";
const PREVIEW_KEY = "ntopia.email-composer.preview";
/** Header toggle that is switched on: a clearly darker fill than the hover state. */
const PRESSED = "bg-foreground/15 text-foreground hover:bg-foreground/20 dark:bg-foreground/20 dark:hover:bg-foreground/25";
const DEFAULT_LAYOUT = { editor: 50, preview: 50 };

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
  const [doc, setDoc] = useState(saved?.doc ?? BLANK_DOC);
  // Only the title and language are read out of the frontmatter (file names, template defaults).
  const meta = useMemo(() => splitDoc(doc).data, [doc]);
  // Bumped whenever a different document is loaded, so the editor starts fresh (frontmatter collapsed).
  const [loadId, setLoadId] = useState(0);
  // The document as last loaded (blank or a template); anything else counts as an unsaved edit.
  const [baseline, setBaseline] = useState(saved?.baseline ?? BLANK_DOC);
  const [showPreview, setShowPreview] = usePersistedFlag(PREVIEW_KEY, true);
  const { html, busy, error, retry: retryPreview, reset: resetPreviewOutput, setError } = useLivePreview(started, doc);
  const [templates, setTemplates] = useState<string[]>([]);
  const [userTemplates, setUserTemplates] = useState(loadUserTemplates);
  const savedDocs = useMemo(() => userTemplates.map((t) => t.doc), [userTemplates]);
  const [layout, saveLayout] = usePanelLayout(LAYOUT_KEY, DEFAULT_LAYOUT);

  const togglePreview = () => setShowPreview((v) => !v);

  // The editor owns the frontmatter fold; the header button mirrors it.
  const editorRef = useRef<EditorView | null>(null);
  const [fmOpen, setFmOpen] = useState(false);
  const [fmAvailable, setFmAvailable] = useState(true);

  // Keep the draft across navigation and restarts; the cleanup flushes the pending write on unmount.
  useEffect(() => {
    if (!started) return;
    const draft = { doc, baseline };
    const t = setTimeout(() => saveDraft(draft), 300);
    return () => {
      clearTimeout(t);
      saveDraft(draft);
    };
  }, [started, doc, baseline]);

  useEffect(() => {
    mm.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function startDraft(nextDoc: string) {
    setDoc(nextDoc);
    setLoadId((n) => n + 1);
    setBaseline(nextDoc);
    resetPreviewOutput();
    setStarted(true);
  }

  async function loadTemplate(t: string) {
    try {
      const mine = isUserTemplate(t) ? userTemplates.find((u) => USER_PREFIX + u.id === t) : undefined;
      if (isUserTemplate(t) && !mine) throw new Error("Template no longer exists");
      await startDraft(mine ? mine.doc : await mm.readTemplate(t));
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
          <Branding />
          <ImageLibrary doc={doc} savedDocs={savedDocs} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* View */}
          <div className="flex items-center gap-1" role="group" aria-label="View">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(fmOpen && PRESSED)}
                  aria-pressed={fmOpen}
                  disabled={!started || !fmAvailable}
                  aria-label={fmOpen ? "Hide details" : "Show details"}
                  onClick={() => editorRef.current && toggleFrontmatter(editorRef.current)}
                />
              }
            >
              <PanelTop />
            </TooltipTrigger>
            <TooltipContent>{fmOpen ? "Hide details (frontmatter)" : "Edit details (frontmatter)"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(showPreview && PRESSED)}
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
          </div>
          <Separator orientation="vertical" className="h-5 self-center" />
          {/* Output: export, open in Mail, and keep as a template */}
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
            <TooltipTrigger render={<Button variant="outline" size="icon-sm" disabled={!started} aria-label="Open in Mail" onClick={() => void openInMail()} />}>
              <Mail />
            </TooltipTrigger>
            <TooltipContent>Open in Mail</TooltipContent>
          </Tooltip>
          {started && <SaveTemplate defaultName={meta.title === "Untitled" ? "" : String(meta.title ?? "")} existingNames={userTemplates.map((t) => t.name)} onSave={saveAsTemplate} />}
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
              onBlank={() => void startDraft(BLANK_DOC).catch((e) => toast.error(toMessage(e)))}
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
            <ContextMenu>
              <ContextMenuTrigger className="flex min-h-0 flex-1 flex-col">
                <SourceEditor
                  key={loadId}
                  value={doc}
                  onChange={setDoc}
                  editorRef={editorRef}
                  onFrontmatterChange={(open, available) => { setFmOpen(open); setFmAvailable(available); }}
                />
              </ContextMenuTrigger>
              <ContextMenuContent>{exportMenuItems}</ContextMenuContent>
            </ContextMenu>
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
