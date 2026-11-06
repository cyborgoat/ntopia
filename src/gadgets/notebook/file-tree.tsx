import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, File as FileIcon, FilePlus, FileText, Folder, FolderOpen, FolderPlus, Image as ImageIcon, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { InlineRename } from "@/components/inline-rename";
import { cn, toMessage } from "@/lib/utils";
import { createFile, createFolder, isWithin, kindOf, listDir, moveEntry, parentOf, renameEntry, type Entry } from "./fs";
import type { Confirm } from "./confirm-dialog";

type Creating = { dir: string; kind: "file" | "folder" } | null;

type Ctx = {
  selected: string | null;
  open: Set<string>;
  version: number;
  creating: Creating;
  renaming: string | null;
  toggle: (path: string) => void;
  onSelect: (path: string) => void;
  startCreate: (dir: string, kind: "file" | "folder") => void;
  setRenaming: (path: string | null) => void;
  commitCreate: (name: string) => void;
  cancelCreate: () => void;
  commitRename: (entry: Entry, name: string) => void;
  askDelete: (c: NonNullable<Confirm>) => void;
  dragging: string | null;
  setDragging: (path: string | null) => void;
  dropTarget: string | null;
  /** Drag-and-drop handlers that make `dir` accept the dragged entry. */
  dropProps: (dir: string) => Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
};

function FileTypeIcon({ name }: { name: string }) {
  const kind = kindOf(name);
  const cls = "size-4 shrink-0 text-muted-foreground";
  if (kind === "image") return <ImageIcon className={cls} />;
  if (kind === "markdown" || kind === "text") return <FileText className={cls} />;
  return <FileIcon className={cls} />;
}

function NewRow({ ctx, depth, kind }: { ctx: Ctx; depth: number; kind: "file" | "folder" }) {
  return (
    <li className="flex h-8 items-center gap-1.5 rounded-md bg-muted px-2" style={{ paddingLeft: 8 + depth * 14 }}>
      {kind === "folder" ? <Folder className="size-4 shrink-0 text-muted-foreground" /> : <FileIcon className="size-4 shrink-0 text-muted-foreground" />}
      <InlineRename value="" onCommit={ctx.commitCreate} onCancel={ctx.cancelCreate} />
    </li>
  );
}

function Children({ dir, depth, ctx }: { dir: string; depth: number; ctx: Ctx }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listDir(dir).then((e) => live && (setEntries(e), setError(null))).catch((e) => live && setError(toMessage(e)));
    return () => { live = false; };
  }, [dir, ctx.version]);

  if (error) return <p className="px-2 py-1 text-xs text-destructive" style={{ paddingLeft: 8 + depth * 14 }}>{error}</p>;
  if (!entries) return null;
  const adding = ctx.creating?.dir === dir ? ctx.creating.kind : null;
  if (entries.length === 0 && !adding) {
    return <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: 8 + depth * 14 + 20 }}>Empty</p>;
  }
  return (
    <ul>
      {adding && <NewRow ctx={ctx} depth={depth} kind={adding} />}
      {entries.map((e) => <Row key={e.path} entry={e} depth={depth} ctx={ctx} />)}
    </ul>
  );
}

function Row({ entry, depth, ctx }: { entry: Entry; depth: number; ctx: Ctx }) {
  const isOpen = entry.isDir && ctx.open.has(entry.path);
  const pad = { paddingLeft: 8 + depth * 14 };

  if (ctx.renaming === entry.path) {
    return (
      <li className="flex h-8 items-center gap-1.5 rounded-md bg-muted px-2" style={pad}>
        {entry.isDir ? <Folder className="size-4 shrink-0 text-muted-foreground" /> : <FileTypeIcon name={entry.name} />}
        <InlineRename value={entry.name} onCommit={(n) => ctx.commitRename(entry, n)} onCancel={() => ctx.setRenaming(null)} />
      </li>
    );
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger className="block w-full">
          <button
            type="button"
            style={pad}
            onClick={() => (entry.isDir ? ctx.toggle(entry.path) : ctx.onSelect(entry.path))}
            onDoubleClick={() => ctx.setRenaming(entry.path)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", entry.path);
              ctx.setDragging(entry.path);
            }}
            onDragEnd={() => ctx.setDragging(null)}
            {...(entry.isDir ? ctx.dropProps(entry.path) : { onDragOver: (e: React.DragEvent) => e.stopPropagation() })}
            className={cn(
              "flex h-8 w-full items-center gap-1.5 rounded-md pr-2 text-left text-sm transition-colors hover:bg-muted/60",
              ctx.selected === entry.path && "bg-muted",
              ctx.dragging === entry.path && "opacity-50",
              ctx.dropTarget === entry.path && "bg-accent ring-1 ring-ring",
            )}
            aria-expanded={entry.isDir ? isOpen : undefined}
          >
            {entry.isDir ? (
              <>
                <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                {isOpen ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <FileTypeIcon name={entry.name} />
              </>
            )}
            <span className="truncate">{entry.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {entry.isDir && (
            <>
              <ContextMenuItem onClick={() => ctx.startCreate(entry.path, "file")}><FilePlus /> New file</ContextMenuItem>
              <ContextMenuItem onClick={() => ctx.startCreate(entry.path, "folder")}><FolderPlus /> New folder</ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => ctx.setRenaming(entry.path)}><Pencil /> Rename</ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => ctx.askDelete({ path: entry.path, name: entry.name, isDir: entry.isDir })}>
            <Trash2 /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {isOpen && <Children dir={entry.path} depth={depth + 1} ctx={ctx} />}
    </li>
  );
}

/** Lazy folder tree of the working directory. All files are listed; only the viewer decides what can be previewed. */
export function FileTree({
  root,
  rootName,
  selected,
  onSelect,
  onRenamed,
  onDelete,
  onChangeFolder,
  reloadKey,
}: {
  root: string;
  rootName: string;
  selected: string | null;
  onSelect: (path: string) => void;
  /** A file or folder was renamed on disk. */
  onRenamed: (from: string, to: string) => void;
  onDelete: (c: NonNullable<Confirm>) => void;
  onChangeFolder: () => void;
  /** Bump to reload the listing after a change made outside the tree (e.g. a delete). */
  reloadKey: number;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([root]));
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState<Creating>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const hoverOpen = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDrag = () => {
    if (hoverOpen.current) clearTimeout(hoverOpen.current);
    hoverOpen.current = null;
    setDragging(null);
    setDropTarget(null);
  };

  const canDropFrom = (from: string, dir: string) => parentOf(from) !== dir && !isWithin(dir, from);

  /** A drop onto `dir` is allowed unless it would be a no-op or move a folder into itself. */
  const canDrop = (dir: string) => !!dragging && parentOf(dragging) !== dir && !isWithin(dir, dragging);

  const dropProps = (dir: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.stopPropagation();
      if (!canDrop(dir)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== dir) {
        setDropTarget(dir);
        // Hovering over a closed folder opens it so the target can be nested deeper.
        if (hoverOpen.current) clearTimeout(hoverOpen.current);
        hoverOpen.current = setTimeout(() => setOpen((s) => new Set(s).add(dir)), 700);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDropTarget((t) => (t === dir ? null : t));
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const from = dragging;
      clearDrag();
      if (!from || !canDropFrom(from, dir)) return;
      try {
        const to = await moveEntry(from, dir);
        onRenamed(from, to);
        setOpen((s) => new Set(s).add(dir));
        refresh();
      } catch (err) {
        toast.error(toMessage(err));
      }
    },
  });

  // A different folder starts with a fresh tree.
  useEffect(() => {
    setOpen(new Set([root]));
    setCreating(null);
    setRenaming(null);
  }, [root]);

  const ctx: Ctx = {
    selected,
    open,
    version: version + reloadKey,
    creating,
    renaming,
    toggle: (p) => setOpen((s) => { const n = new Set(s); if (!n.delete(p)) n.add(p); return n; }),
    onSelect,
    startCreate: (dir, kind) => {
      setOpen((s) => new Set(s).add(dir));
      setCreating({ dir, kind });
    },
    setRenaming,
    cancelCreate: () => setCreating(null),
    commitCreate: async (name) => {
      const c = creating;
      setCreating(null);
      if (!c || !name.trim()) return;
      try {
        const path = c.kind === "file" ? await createFile(c.dir, name) : await createFolder(c.dir, name);
        refresh();
        if (c.kind === "file") onSelect(path);
        else setOpen((s) => new Set(s).add(path));
      } catch (e) {
        toast.error(toMessage(e));
      }
    },
    commitRename: async (entry, name) => {
      setRenaming(null);
      if (!name.trim() || name.trim() === entry.name) return;
      try {
        const next = await renameEntry(entry.path, name);
        onRenamed(entry.path, next);
        refresh();
      } catch (e) {
        toast.error(toMessage(e));
      }
    },
    askDelete: onDelete,
    dragging,
    setDragging,
    dropTarget,
    dropProps,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex items-center gap-1 border-b p-1.5", dropTarget === root && "bg-accent")} {...dropProps(root)}>
        <button
          type="button"
          onClick={onChangeFolder}
          title={`${root} — click to change folder`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-medium hover:bg-muted/60"
        >
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{rootName}</span>
        </button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="New file" title="New file" onClick={() => ctx.startCreate(root, "file")}><FilePlus /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="New folder" title="New folder" onClick={() => ctx.startCreate(root, "folder")}><FolderPlus /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh" title="Refresh" onClick={refresh}><RefreshCw /></Button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto p-1.5", dropTarget === root && "bg-accent/40")} {...dropProps(root)}>
        <Children dir={root} depth={0} ctx={ctx} />
      </div>
    </div>
  );
}
