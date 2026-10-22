import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Copy,
  FolderPlus,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
  purgeNote,
  renameFolder,
  restoreNote,
  trashNote,
  updateNoteAndWait,
  type Note,
  type NoteFolder,
} from "@/gadgets/notes/store";
import { cn } from "@/lib/utils";

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

type Confirm =
  | { kind: "empty-trash" }
  | { kind: "purge"; noteId: string; title: string }
  | { kind: "delete-folder"; folderId: string; name: string; noteCount: number }
  | null;

function loadLayout(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (parsed.sidebar != null && parsed.editor != null) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

function NotesGadget() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const state = useMemo(() => loadState(), [tick]);
  const folders = state.folders;
  const active = state.notes.filter((n) => !n.deletedAt);
  const trashed = state.notes.filter((n) => !!n.deletedAt);

  const [selectedId, setSelectedId] = useState<string | null>(() => listActiveNotes()[0]?.id ?? null);
  const [view, setView] = useState<"notes" | "trash">("notes");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [layout, setLayout] = useState(loadLayout);
  const [openFolders, setOpenFolders] = useState<string[]>(() => ["unfiled", ...listFolders().map((f) => f.id)]);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const selected =
    (view === "notes" ? active : trashed).find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    const pool = view === "notes" ? active : trashed;
    if (selectedId && !pool.some((n) => n.id === selectedId)) {
      setSelectedId(pool[0]?.id ?? null);
    }
  }, [active, trashed, selectedId, view]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const createNote = (folderId: string | null = null) => {
    const n = addNote({ folderId });
    refresh();
    setView("notes");
    setSelectedId(n.id);
    if (folderId && !openFolders.includes(folderId)) {
      setOpenFolders((v) => [...v, folderId]);
    }
    if (!folderId && !openFolders.includes("unfiled")) {
      setOpenFolders((v) => [...v, "unfiled"]);
    }
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
      setSelectedId(null);
      toast.success("Trash emptied");
    } else if (confirm.kind === "purge") {
      purgeNote(confirm.noteId);
      refresh();
      if (selectedId === confirm.noteId) setSelectedId(null);
      toast.success("Note permanently deleted");
    } else if (confirm.kind === "delete-folder") {
      deleteFolder(confirm.folderId);
      refresh();
      setOpenFolders((v) => v.filter((id) => id !== confirm.folderId));
      toast.success("Folder deleted");
    }
    setConfirm(null);
  };

  const noteRow = (n: Note, inTrash: boolean) => (
    <ContextMenu key={n.id}>
      <ContextMenuTrigger className="block w-full">
        <button
          type="button"
          onClick={() => setSelectedId(n.id)}
          className={cn(
            "w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
            n.id === selectedId && "bg-muted",
          )}
        >
          <span className="block truncate text-sm font-medium">{displayTitle(n)}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {new Date(inTrash ? (n.deletedAt ?? n.updatedAt) : n.updatedAt).toLocaleString()}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!inTrash && (
          <>
            <ContextMenuItem onClick={() => void navigator.clipboard.writeText(n.content).then(() => toast.success("Copied"))}>
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
                    Move to Unfiled
                  </ContextMenuItem>
                )}
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => softDelete(n.id)}>
              <Trash2 /> Move to trash
            </ContextMenuItem>
          </>
        )}
        {inTrash && (
          <>
            <ContextMenuItem onClick={() => { restoreNote(n.id); refresh(); toast.success("Restored"); }}>
              <RotateCcw /> Restore
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => setConfirm({ kind: "purge", noteId: n.id, title: displayTitle(n) })}
            >
              <Trash2 /> Delete forever
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  const folderSection = (folder: NoteFolder | null) => {
    const id = folder?.id ?? "unfiled";
    const label = folder?.name ?? "Unfiled";
    const notes = active.filter((n) => (folder ? n.folderId === folder.id : n.folderId == null));
    const header = (
      <div className="group/folder flex items-center gap-0.5 pr-1">
        <AccordionTrigger className="min-w-0 flex-1 px-2 py-1.5 hover:no-underline">
          <span className="truncate">{label}</span>
          <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">{notes.length}</span>
        </AccordionTrigger>
        {folder && renamingFolderId !== folder.id && (
          <div className="flex shrink-0 opacity-0 transition-opacity group-hover/folder:opacity-100 group-focus-within/folder:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="New note in folder"
              onClick={(e) => { e.stopPropagation(); createNote(folder.id); }}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete folder"
              onClick={(e) => {
                e.stopPropagation();
                setConfirm({ kind: "delete-folder", folderId: folder.id, name: folder.name, noteCount: notes.length });
              }}
            >
              <Trash2 />
            </Button>
          </div>
        )}
        {!folder && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover/folder:opacity-100 group-focus-within/folder:opacity-100"
            aria-label="New unfiled note"
            onClick={(e) => { e.stopPropagation(); createNote(null); }}
          >
            <Plus />
          </Button>
        )}
      </div>
    );
    return (
      <AccordionItem key={id} value={id} className="border-b-0">
        {folder ? (
          <ContextMenu>
            <ContextMenuTrigger className="block w-full">{header}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setRenamingFolderId(folder.id)}>Rename</ContextMenuItem>
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
        ) : (
          header
        )}
        {folder && renamingFolderId === folder.id && (
          <div className="px-2 pb-1">
            <Input
              autoFocus
              defaultValue={folder.name}
              className="h-7 text-sm"
              onBlur={(e) => {
                renameFolder(folder.id, e.target.value);
                refresh();
                setRenamingFolderId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenamingFolderId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <AccordionContent className="pb-1">
          {notes.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Empty</p>
          ) : (
            <ul className="space-y-0.5 px-1">{notes.map((n) => noteRow(n, false))}</ul>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  // Double-click folder name to rename — attach via context on accordion label area
  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <div className="flex flex-1 gap-0.5">
          <Button
            type="button"
            size="xs"
            variant={view === "notes" ? "secondary" : "ghost"}
            onClick={() => setView("notes")}
          >
            Notes
          </Button>
          <Button
            type="button"
            size="xs"
            variant={view === "trash" ? "secondary" : "ghost"}
            onClick={() => setView("trash")}
          >
            Trash{trashed.length > 0 ? ` · ${trashed.length}` : ""}
          </Button>
        </div>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)}>
          <PanelLeftClose />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        {view === "notes" ? (
          <>
            <Accordion multiple value={openFolders} onValueChange={setOpenFolders}>
              {folders.map((f) => (
                <div
                  key={f.id}
                  onDoubleClick={() => setRenamingFolderId(f.id)}
                >
                  {folderSection(f)}
                </div>
              ))}
              {folderSection(null)}
            </Accordion>
            {active.length === 0 && folders.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">No notes yet.</p>
            )}
          </>
        ) : (
          <div className="space-y-2 p-1">
            {trashed.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Trash is empty.</p>
            ) : (
              <>
                <div className="flex justify-end px-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    onClick={() => setConfirm({ kind: "empty-trash" })}
                  >
                    Empty trash
                  </Button>
                </div>
                <ul className="space-y-0.5">{trashed.map((n) => noteRow(n, true))}</ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const editor = (
    <div className="flex h-full min-h-0 flex-col">
      {!selected ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <Empty>
            {view === "trash"
              ? (trashed.length === 0 ? "Trash is empty." : "Select a trashed note.")
              : (
                <>
                  No note selected.{" "}
                  <button type="button" className="underline" onClick={() => createNote(null)}>
                    Create one
                  </button>
                  .
                </>
              )}
          </Empty>
        </div>
      ) : (
        <NoteEditor
          key={selected.id}
          note={selected}
          readOnly={view === "trash"}
          onRefresh={refresh}
          onTrash={() => softDelete(selected.id)}
          onRestore={() => { restoreNote(selected.id); refresh(); setView("notes"); toast.success("Restored"); }}
          onPurge={() => setConfirm({ kind: "purge", noteId: selected.id, title: displayTitle(selected) })}
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
            <Button size="sm" variant="outline" onClick={createFolder}>
              <FolderPlus /> Folder
            </Button>
            <Button size="sm" onClick={() => createNote(null)}>
              <Plus /> New
            </Button>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 border-t">
        {collapsed ? (
          <>
            <div className="flex w-9 shrink-0 flex-col items-center border-r py-2">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Expand sidebar" onClick={() => setCollapsed(false)}>
                <PanelLeft />
              </Button>
            </div>
            <div className="min-w-0 flex-1">{editor}</div>
          </>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
            id="notes-layout"
            defaultLayout={layout}
            onLayoutChanged={(next) => {
              setLayout(next);
              try {
                localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
              } catch {
                /* ignore */
              }
            }}
          >
            <ResizablePanel id="sidebar" defaultSize={`${layout.sidebar}%`} minSize="15%" maxSize="40%" className="min-w-0 border-r">
              {sidebar}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="40%" className="min-w-0">
              {editor}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

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
                  ? `Delete "${confirm.name}"? Its ${confirm.noteCount} ${confirm.noteCount === 1 ? "note" : "notes"} will move to Unfiled.`
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
  readOnly,
  onRefresh,
  onTrash,
  onRestore,
  onPurge,
}: {
  note: Note;
  readOnly: boolean;
  onRefresh: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
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
    timer.current = setTimeout(() => void flush(nextTitle, nextContent), AUTOSAVE_MS);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Input
          value={title}
          placeholder="Untitled"
          disabled={readOnly}
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            if (!readOnly) scheduleSave(next, content);
          }}
          onBlur={() => {
            if (readOnly) return;
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
        {!readOnly && <SaveIndicator status={saveStatus} />}
        {readOnly ? (
          <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Restore" onClick={onRestore}>
              <RotateCcw />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete forever" onClick={onPurge}>
              <Trash2 />
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move to trash" onClick={onTrash}>
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          fillHeight
          variant="full"
          value={content}
          onChange={(next) => {
            if (readOnly) return;
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
