import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PageHeader } from "@/components/page-header";
import { SidebarPill } from "@/components/sidebar-pill";
import { usePanelLayout, usePersistedFlag } from "@/lib/prefs";
import { isTauri } from "@/lib/storage";
import { toMessage } from "@/lib/utils";
import { ConfirmDialog, type Confirm } from "@/gadgets/notebook/confirm-dialog";
import { FileTree } from "@/gadgets/notebook/file-tree";
import { FileViewer } from "@/gadgets/notebook/file-viewer";
import { removeEntry } from "@/gadgets/notebook/fs";
import { getWorkDir, setWorkDir } from "@/gadgets/notebook/workdir";

export const Route = createFileRoute("/_app/notebook")({ component: NotebookPage });

// Storage keys keep their original "notes" names so saved folder and layout carry over.
const LAYOUT_KEY = "ntopia.notes.layout";
const COLLAPSE_KEY = "ntopia.notes.sidebar-collapsed";
const DEFAULT_LAYOUT = { sidebar: 24, editor: 76 };

const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
const within = (path: string, dir: string) => path === dir || path.startsWith(dir + "/") || path.startsWith(dir + "\\");

function NotebookPage() {
  const [root, setRoot] = useState(() => getWorkDir());
  // Null while the saved folder is being checked; false when it can't be opened any more.
  const [rootOk, setRootOk] = useState<boolean | null>(root ? null : false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [collapsed, setCollapsed] = usePersistedFlag(COLLAPSE_KEY, false);
  const [layout, saveLayout] = usePanelLayout(LAYOUT_KEY, DEFAULT_LAYOUT);

  useEffect(() => {
    if (!root) return;
    let live = true;
    setRootOk(null);
    exists(root).then((ok) => live && setRootOk(ok)).catch(() => live && setRootOk(false));
    return () => { live = false; };
  }, [root]);

  async function chooseFolder() {
    try {
      const picked = await open({ directory: true, multiple: false, defaultPath: root || undefined, title: "Choose the notebook working folder" });
      if (typeof picked !== "string") return;
      await setWorkDir(picked);
      setSelected(null);
      setRoot(picked);
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  async function runDelete() {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    // Deselect first so the open file can't be re-saved after it is gone.
    if (selected && within(selected, target.path)) setSelected(null);
    try {
      await removeEntry(target.path, target.isDir);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  if (!isTauri() || !root || rootOk === false) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader title="Notebook" />
        <div className="flex flex-1 items-center justify-center border-t p-8">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <FolderOpen className="size-10 text-muted-foreground" />
            {!isTauri() ? (
              <p className="text-sm text-muted-foreground">Choosing a working folder needs the desktop app.</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Choose a working folder</h2>
                <p className="text-sm text-muted-foreground">
                  {root
                    ? `Can't open “${root}”. It may have been moved or deleted.`
                    : "Notebook shows the files in a folder on this computer. Text and Markdown files can be edited, and images are previewed."}
                </p>
                <Button onClick={() => void chooseFolder()}><FolderOpen /> Choose folder</Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="relative flex h-full min-h-0 flex-col">
      <FileTree
        root={root}
        rootName={baseName(root)}
        selected={selected}
        onSelect={setSelected}
        onRenamed={(from, to) => setSelected((s) => (s && within(s, from) ? to + s.slice(from.length) : s))}
        onDelete={setConfirm}
        onChangeFolder={() => void chooseFolder()}
        reloadKey={reloadKey}
      />
      <SidebarPill
        collapsed={false}
        onToggle={() => setCollapsed(true)}
        className="absolute top-1/2 right-0 -translate-y-1/2 rounded-r-none border-r-0"
      />
    </div>
  );

  const viewer = (
    <div className="flex h-full min-h-0 flex-col">
      {selected ? (
        <FileViewer path={selected} onDelete={() => setConfirm({ path: selected, name: baseName(selected), isDir: false })} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Select a file to view it.</div>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Notebook" />
      <div className="relative flex min-h-0 flex-1 border-t">
        {collapsed ? (
          <>
            <SidebarPill collapsed onToggle={() => setCollapsed(false)} className="absolute top-1/2 left-0 -translate-y-1/2 rounded-l-none border-l-0" />
            <div className="min-w-0 flex-1">{viewer}</div>
          </>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="notes-layout" defaultLayout={layout} onLayoutChanged={saveLayout}>
            <ResizablePanel id="sidebar" defaultSize={`${layout.sidebar}%`} minSize="15%" maxSize="40%" className="min-w-0">{sidebar}</ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="editor" defaultSize={`${layout.editor}%`} minSize="40%" className="min-w-0">{viewer}</ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={() => void runDelete()} />
    </div>
  );
}
