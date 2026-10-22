import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
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
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Empty, PageHeader } from "@/components/page-header";
import {
  addFolder,
  addNote,
  defaultFolderId,
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
  type Note,
  type NoteFolder,
} from "@/gadgets/notes/store";
import { ConfirmDialog, type Confirm } from "@/gadgets/notes/confirm-dialog";
import { TrashDialog } from "@/gadgets/notes/trash-dialog";
import { NoteEditor } from "@/gadgets/notes/note-editor";
import { useNoteDrag } from "@/gadgets/notes/use-note-drag";
import { InlineRename } from "@/components/inline-rename";
import { SidebarPill } from "@/components/sidebar-pill";
import { cn, copyText, formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/gadgets/notes")({ component: NotesGadget });

const LAYOUT_KEY = "ntopia.notes.layout";
const COLLAPSE_KEY = "ntopia.notes.sidebar-collapsed";
const DEFAULT_LAYOUT = { sidebar: 24, editor: 76 };

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

  const openFolder = (id: string) => setOpenFolders((v) => (v.includes(id) ? v : [...v, id]));
  const { drag, dropTarget, justDragged, startNoteDrag } = useNoteDrag({
    onMoved: (folderId) => {
      refresh();
      openFolder(folderId);
    },
    onHoverFolder: openFolder,
  });

  /** New notes go in the selected note’s folder, else Default. */
  const targetFolderId = () => selected?.folderId ?? defaultFolderId(state);

  const createNote = (folderId: string = targetFolderId()) => {
    const n = addNote({ folderId });
    refresh();
    setSelectedId(n.id);
    if (!openFolders.includes(folderId)) setOpenFolders((v) => [...v, folderId]);
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
          {folders.length > 1 && (
            <>
              <ContextMenuSeparator />
              {folders.map((f) => (
                <ContextMenuItem
                  key={f.id}
                  disabled={n.folderId === f.id}
                  onClick={() => { moveNote(n.id, f.id); refresh(); openFolder(f.id); }}
                >
                  Move to {f.name}
                </ContextMenuItem>
              ))}
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
            className="min-w-0 flex-1 items-center rounded-md border-0 bg-transparent px-2 py-0 shadow-none hover:bg-muted/60 hover:no-underline focus-visible:border-transparent focus-visible:ring-0"
            onDoubleClick={() => setRenamingFolderId(folder.id)}
          >
            <FolderGlyph className="mr-1.5 size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
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
          "rounded-md border-0 bg-transparent shadow-none not-last:border-b-0 transition-colors",
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
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        <Accordion multiple value={openFolders} onValueChange={setOpenFolders}>
          {folders.map((f) => folderSection(f))}
        </Accordion>
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
            <button type="button" className="underline" onClick={() => createNote()}>
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
            <Button size="sm" onClick={() => createNote()}>
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

      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        trashed={trashed}
        onRestore={(n) => { restoreNote(n.id); refresh(); toast.success("Restored"); }}
        onPurge={(n) => setConfirm({ kind: "purge", noteId: n.id, title: displayTitle(n) })}
        onEmpty={() => setConfirm({ kind: "empty-trash" })}
      />

      <ConfirmDialog
        confirm={confirm}
        trashedCount={trashed.length}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}

