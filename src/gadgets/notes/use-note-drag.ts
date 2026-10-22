import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { displayTitle, moveNote, type Note, type NoteFolder } from "@/gadgets/notes/store";

type Drag = { noteId: string; title: string; x: number; y: number };

/**
 * Pointer-based drag & drop of notes onto folders (`data-drop="<folderId>"`) or the top level
 * (`data-drop="root"`). Native HTML5 drags are intercepted by the Tauri webview, so this tracks the pointer itself.
 */
export function useNoteDrag({
  folders,
  onMoved,
  onHoverFolder,
}: {
  folders: NoteFolder[];
  /** Called after a note moved; `folderId` is null for the top level. */
  onMoved: (folderId: string | null) => void;
  /** Called when the pointer rests on a folder for a moment, so it can be opened. */
  onHoverFolder: (folderId: string) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
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
        if (target && target !== "root") expandTimer = setTimeout(() => onHoverFolder(target), 500);
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
          onMoved(folderId);
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

  return { drag, dropTarget, justDragged, startNoteDrag };
}
