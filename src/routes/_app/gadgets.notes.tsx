import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePanelLayout, usePersistedFlag } from "@/lib/prefs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Empty, PageHeader } from "@/components/page-header";
import {
  addFolder,
  addNote,
  deleteFolder,
  displayTitle,
  emptyTrash,
  finalizeTitle,
  listActiveNotes,
  listFolders,
  loadState,
  moveNote,
  pruneEmptyNotes,
  purgeNote,
  renameFolder,
  restoreNote,
  trashNote,
  updateNote,
  updateNoteAndWait,
  type Note,
  type NoteFolder,
} from "@/gadgets/notes/store";
import { cn, copyText, formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/gadgets/notes")({ component: NotesGadget });

const LAYOUT_KEY = "ntopia.notes.layout";
const COLLAPSE_KEY = "ntopia.notes.sidebar-collapsed";
const DEFAULT_LAYOUT = { sidebar: 24, editor: 76 };
const AUTOSAVE_MS = 500;

type SaveStatus = "saved" | "saving" | "unsaved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums",
        status === "unsaved" && "text-amber-700 dark:text-amber-400",
      )}
      aria-live="polite"
    >
      {status === "saving" && <><Loader2 className="size-3 animate-spin" /> Saving…</>}
      {status === "saved" && <><Check className="size-3" /> Saved</>}
      {status === "unsaved" && "Unsaved"}
    </span>
  );
}

function SidebarPill({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = collapsed ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onToggle}
      className={cn(
        "z-10 flex h-10 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
        className,
      )}
    >
      <Icon className="size-3" />
    </button>
  );
}

/** Text input that replaces a label in place. Enter/blur commit, Escape cancels. */
function InlineRename({
  value,
  onCommit,
  onCancel,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // Defer so a closing context menu does not steal focus back.
    const t = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const finish = (commit: boolean, next?: string) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(next ?? value);
    else onCancel();
  };

  return (
    <Input
      ref={ref}
      defaultValue={value}
      aria-label="Rename"
      className={cn("h-6 min-w-0 flex-1 px-1.5 text-sm", className)}
      onBlur={(e) => finish(true, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        if (e.key === "Escape") finish(false);
      }}
    />
  );
}

type Confirm =
  | { kind: "empty-trash" }
  | { kind: "purge"; noteId: string; title: string }
  | { kind: "delete-folder"; folderId: string; name: string; noteCount: number }
  | null;

function NotesGadget() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const state = useMemo(() => loadState(), [tick]);
  const folders = state.folders;
  const active = state.notes.filter((n) => !n.deletedAt);
  const trashed = state.notes.filter((n) => !!n.deletedAt);

  const [selectedId, setSelectedId] = useState<string | null>(() => listActiveNotes()[0]?.id ?? null);
  const [collapsed, setCollapsed] = usePersistedFlag(COLLAPSE_KEY, false);
  const [layout, saveLayout] = usePanelLayout(LAYOUT_KEY, DEFAULT_LAYOUT);
  const [openFolders, setOpenFolders] = useState<string[]>(() => listFolders().map((f) => f.id));
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const selected = active.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !active.some((n) => n.id === selectedId)) {
      setSelectedId(active[0]?.id ?? null);
    }
  }, [active, selectedId]);

  // Empty notes are discarded as soon as they stop being the selected note.
  useEffect(() => {
    if (pruneEmptyNotes(selectedId)) refresh();
  }, [selectedId]);
  useEffect(() => () => void pruneEmptyNotes(), []);

  // Pointer-based drag & drop: native HTML5 drags are intercepted by the Tauri webview.
  const [drag, setDrag] = useState<{ noteId: string; title: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const justDragged = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const startNoteDrag = (e: React.PointerEvent, n: Note) => {
    if (e.button !== 0) return;
    stopDrag.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let lastTarget: string | null = null;
    let expandTimer: ReturnType<typeof setTimeout> | undefined;
    const targetAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]")?.dataset.drop ?? null;

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("select-none", "cursor-grabbing");
      clearTimeout(expandTimer);
      stopDrag.current = null;
      setDrag(null);
      setDropTarget(null);
    };
    function onMove(ev: PointerEvent) {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        active = true;
        document.body.classList.add("select-none", "cursor-grabbing");
      }
      const target = targetAt(ev.clientX, ev.clientY);
      setDrag({ noteId: n.id, title: displayTitle(n), x: ev.clientX, y: ev.clientY });
      setDropTarget(target);
      if (target !== lastTarget) {
        lastTarget = target;
        clearTimeout(expandTimer);
        if (target && target !== "root") {
          expandTimer = setTimeout(
            () => setOpenFolders((v) => (v.includes(target) ? v : [...v, target])),
            500,
          );
        }
      }
    }
    function onUp(ev: PointerEvent) {
      if (active) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 0);
        const target = targetAt(ev.clientX, ev.clientY);
        if (target && target !== (n.folderId ?? "root")) {
          const folderId = target === "root" ? null : target;
          moveNote(n.id, folderId);
          refresh();
          if (folderId) setOpenFolders((v) => (v.includes(folderId) ? v : [...v, folderId]));
          const name = folderId ? folders.find((f) => f.id === folderId)?.name : null;
          toast.success(name ? `Moved to ${name}` : "Moved to top level");
        }
      }
      cleanup();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") cleanup();
    }
    stopDrag.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("keydown", onKey);
  };

  const rootNotes = active.filter((n) => !n.folderId);
  const draggedNote = drag ? active.find((n) => n.id === drag.noteId) : undefined;

  const createNote = (folderId: string | null = null) => {
    const n = addNote({ folderId });
    refresh();
    setSelectedId(n.id);
    if (folderId && !openFolders.includes(folderId)) setOpenFolders((v) => [...v, folderId]);
  };

  const createFolder = () => {
    const f = addFolder();
    refresh();
    setOpenFolders((v) => [...v, f.id]);
    setRenamingFolderId(f.id);
  };

  const softDelete = (id: string) => {
    trashNote(id);
    refresh();
    if (selectedId === id) setSelectedId(null);
    toast.success("Moved to trash");
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "empty-trash") {
      emptyTrash();
      refresh();
      toast.success("Trash emptied");
    } else if (confirm.kind === "purge") {
      purgeNote(confirm.noteId);
      refresh();
      toast.success("Note permanently deleted");
    } else if (confirm.kind === "delete-folder") {
      deleteFolder(confirm.folderId);
      refresh();
      setOpenFolders((v) => v.filter((id) => id !== confirm.folderId));
      toast.success("Folder deleted");
    }
    setConfirm(null);
  };

  const noteRow = (n: Note) => (
    <li key={n.id}>
      <ContextMenu>
        <ContextMenuTrigger className="block w-full">
          {renamingNoteId === n.id ? (
            <div className="flex h-9 items-center rounded-md bg-muted px-2">
              <InlineRename
                value={displayTitle(n)}
                onCancel={() => setRenamingNoteId(null)}
                onCommit={(next) => {
                  updateNote(n.id, { title: next });
                  finalizeTitle(n.id);
                  refresh();
                  setRenamingNoteId(null);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => startNoteDrag(e, n)}
              onClick={() => { if (!justDragged.current) setSelectedId(n.id); }}
              onDoubleClick={() => setRenamingNoteId(n.id)}
              className={cn(
                "flex h-9 w-full cursor-grab flex-col justify-center rounded-md px-2 text-left transition-colors hover:bg-muted/60",
                n.id === selectedId && "bg-muted",
                drag?.noteId === n.id && "opacity-50",
              )}
            >
              <span className="block truncate text-sm leading-tight font-medium">{displayTitle(n)}</span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {formatDateTime(n.updatedAt)}
              </span>
            </button>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setRenamingNoteId(n.id)}>
            <Pencil /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copyText(n.content, "Markdown")}>
            <Copy /> Copy markdown
          </ContextMenuItem>
          {folders.length > 0 && (
            <>
              <ContextMenuSeparator />
              {folders.map((f) => (
                <ContextMenuItem
                  key={f.id}
                  disabled={n.folderId === f.id}
                  onClick={() => { moveNote(n.id, f.id); refresh(); }}
                >
                  Move to {f.name}
                </ContextMenuItem>
              ))}
              {n.folderId && (
                <ContextMenuItem onClick={() => { moveNote(n.id, null); refresh(); }}>
                  Move to top level
                </ContextMenuItem>
              )}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => softDelete(n.id)}>
            <Trash2 /> Move to trash
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );

  const folderSection = (folder: NoteFolder) => {
    const id = folder.id;
    const label = folder.name;
    const notes = active.filter((n) => n.folderId === folder.id);
    const isOpen = openFolders.includes(id);
    const FolderGlyph = isOpen ? FolderOpen : FolderIcon;
    const renaming = renamingFolderId === folder.id;
    const actionClass =
      "opacity-0 transition-opacity group-hover/folder:opacity-100 group-focus-within/folder:opacity-100";
    const header = (
      <div className="group/folder flex h-8 items-center gap-0.5 pr-1">
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center px-2">
            <InlineRename
              value={label}
              onCancel={() => setRenamingFolderId(null)}
              onCommit={(next) => {
                renameFolder(folder.id, next);
                refresh();
                setRenamingFolderId(null);
              }}
            />
          </div>
        ) : (
          <AccordionTrigger
            className="min-w-0 flex-1 items-center px-2 py-0 hover:no-underline"
            onDoubleClick={() => setRenamingFolderId(folder.id)}
          >
            <FolderGlyph className="mr-1.5 size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
            <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">{notes.length}</span>
          </AccordionTrigger>
        )}
        {!renaming && (
          <div className={cn("flex shrink-0 items-center", actionClass)}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="New note in folder"
              onClick={() => createNote(folder.id)}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete folder"
              onClick={() =>
                setConfirm({ kind: "delete-folder", folderId: folder.id, name: folder.name, noteCount: notes.length })
              }
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    );
    return (
      <AccordionItem
        key={id}
        value={id}
        data-drop={id}
        className={cn(
          "rounded-md border-b-0 transition-colors",
          drag && dropTarget === id && "bg-primary/10 ring-1 ring-primary/40",
        )}
      >
        <ContextMenu>
          <ContextMenuTrigger className="block w-full">{header}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setRenamingFolderId(folder.id)}>
                <Pencil /> Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => createNote(folder.id)}><Plus /> New note</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => setConfirm({ kind: "delete-folder", folderId: folder.id, name: folder.name, noteCount: notes.length })}
              >
                <Trash2 /> Delete folder
              </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
        <AccordionContent className="pb-1">
          {notes.length === 0 ? (
            <p className="py-1 pr-2 pl-6 text-xs text-muted-foreground">Empty — drag notes here</p>
          ) : (
            <ul className="space-y-0.5 pl-4">{notes.map((n) => noteRow(n))}</ul>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const sidebar = (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="border-b p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
          onClick={createFolder}
        >
          <FolderPlus />
          New folder
        </Button>
      </div>
      <div data-drop="root" className="min-h-0 flex-1 overflow-auto p-1.5">
        {draggedNote?.folderId && (
          <div
            className={cn(
              "mb-1.5 rounded-md border border-dashed px-2 py-2 text-center text-xs text-muted-foreground transition-colors",
              dropTarget === "root" && "border-primary/40 bg-primary/10 text-foreground",
            )}
          >
            Drop here to move to top level
          </div>
        )}
        {rootNotes.length > 0 && <ul className="space-y-0.5">{rootNotes.map((n) => noteRow(n))}</ul>}
        {rootNotes.length > 0 && folders.length > 0 && <div className="my-1.5 h-px bg-border" />}
        {folders.length > 0 && (
          <Accordion multiple value={openFolders} onValueChange={setOpenFolders}>
            {folders.map((f) => folderSection(f))}
          </Accordion>
        )}
        {rootNotes.length === 0 && folders.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">No notes yet. Create one with New, or add a folder.</p>
        )}
      </div>
      <div className="border-t p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setTrashOpen(true)}
        >
          <Trash2 />
          <span className="flex-1 text-left">Trash</span>
          {trashed.length > 0 && <span className="text-xs tabular-nums">{trashed.length}</span>}
        </Button>
      </div>
      <SidebarPill
        collapsed={false}
        onToggle={() => setCollapsed(true)}
        className="absolute top-1/2 right-0 -translate-y-1/2 rounded-r-none border-r-0"
      />
    </div>
  );

  const editor = (
    <div className="flex h-full min-h-0 flex-col">
      {!selected ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <Empty>
            No note selected.{" "}
            <button type="button" className="underline" onClick={() => createNote(null)}>
              Create one
            </button>
            .
          </Empty>
        </div>
      ) : (
        <NoteEditor
          key={selected.id}
          note={selected}
          onRefresh={refresh}
          onTrash={() => softDelete(selected.id)}
        />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Notes"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => createNote(null)}>
              <Plus /> New
            </Button>
          </div>
        }
      />
      <div className="relative flex min-h-0 flex-1 border-t">
        {collapsed ? (
          <>
            <SidebarPill
              collapsed
              onToggle={() => setCollapsed(false)}
              className="absolute top-1/2 left-0 -translate-y-1/2 rounded-l-none border-l-0"
            />
            <div className="min-w-0 flex-1">{editor}</div>
          </>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
            id="notes-layout"
            defaultLayout={layout}
            onLayoutChanged={saveLayout}
          >
            <ResizablePanel id="sidebar" defaultSize={`${layout.sidebar}%`} minSize="15%" maxSize="40%" className="min-w-0">
              {sidebar}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="40%" className="min-w-0">
              {editor}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex max-w-48 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-sm shadow-md"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{drag.title}</span>
        </div>
      )}

      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trash</DialogTitle>
            <DialogDescription>
              {trashed.length === 0
                ? "Trash is empty."
                : `${trashed.length} ${trashed.length === 1 ? "note" : "notes"} in trash. Restore or delete them for good.`}
            </DialogDescription>
          </DialogHeader>
          {trashed.length > 0 && (
            <ul className="max-h-72 space-y-0.5 overflow-auto">
              {trashed.map((n) => (
                <li key={n.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-tight font-medium">{displayTitle(n)}</span>
                    <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                      Deleted {formatDateTime(n.deletedAt ?? n.updatedAt)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Restore"
                    onClick={() => { restoreNote(n.id); refresh(); toast.success("Restored"); }}
                  >
                    <RotateCcw />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete forever"
                    onClick={() => setConfirm({ kind: "purge", noteId: n.id, title: displayTitle(n) })}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTrashOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={trashed.length === 0}
              onClick={() => setConfirm({ kind: "empty-trash" })}
            >
              Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "empty-trash" && "Empty trash?"}
              {confirm?.kind === "purge" && "Delete forever?"}
              {confirm?.kind === "delete-folder" && "Delete folder?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "empty-trash" &&
                `Permanently delete ${trashed.length} ${trashed.length === 1 ? "note" : "notes"}. This cannot be undone.`}
              {confirm?.kind === "purge" &&
                `“${confirm.title}” will be permanently deleted. This cannot be undone.`}
              {confirm?.kind === "delete-folder" &&
                (confirm.noteCount > 0
                  ? `Delete "${confirm.name}"? Its ${confirm.noteCount} ${confirm.noteCount === 1 ? "note" : "notes"} will move to the top level.`
                  : `Delete empty folder "${confirm.name}"?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === "delete-folder" ? "default" : "destructive"}
              onClick={runConfirm}
            >
              {confirm?.kind === "empty-trash" && "Empty trash"}
              {confirm?.kind === "purge" && "Delete forever"}
              {confirm?.kind === "delete-folder" && "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NoteEditor({
  note,
  onRefresh,
  onTrash,
}: {
  note: Note;
  onRefresh: () => void;
  onTrash: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gen = useRef(0);

  const flush = useEffectEvent(async (nextTitle: string, nextContent: string) => {
    const token = ++gen.current;
    setSaveStatus("saving");
    try {
      await updateNoteAndWait(note.id, { title: nextTitle, content: nextContent });
      if (token !== gen.current) return;
      setSaveStatus("saved");
      onRefresh();
    } catch {
      if (token !== gen.current) return;
      setSaveStatus("unsaved");
      toast.error("Could not save note");
    }
  });

  const scheduleSave = (nextTitle: string, nextContent: string) => {
    setSaveStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush(nextTitle, nextContent);
    }, AUTOSAVE_MS);
  };

  const latest = useRef({ title, content });
  latest.current = { title, content };
  useEffect(() => () => {
    // Persist a pending edit so switching notes never drops typed text.
    if (timer.current) {
      clearTimeout(timer.current);
      updateNote(note.id, latest.current);
    }
  }, [note.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Input
          value={title}
          placeholder="Untitled"
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            scheduleSave(next, content);
          }}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void (async () => {
              await flush(title, content);
              finalizeTitle(note.id);
              const finalized = loadState().notes.find((n) => n.id === note.id);
              if (finalized) setTitle(finalized.title);
              onRefresh();
            })();
          }}
          className="h-8 border-0 bg-transparent px-1 text-base font-semibold shadow-none focus-visible:ring-0"
          aria-label="Note title"
        />
        <SaveIndicator status={saveStatus} />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Move to trash" onClick={onTrash}>
          <Trash2 />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          fillHeight
          variant="full"
          value={content}
          onChange={(next) => {
            setContent(next);
            scheduleSave(title, next);
          }}
          placeholder="Write a scratch note…"
          className="h-full rounded-none border-0"
        />
      </div>
    </div>
  );
}
