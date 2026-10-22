import { useEffect, useRef, useState } from "react";
import { displayTitle, moveNote, type Note } from "@/gadgets/notes/store";

type Drag = { noteId: string; title: string; x: number; y: number };

/**
 * Pointer-based drag & drop of notes onto folders (`data-drop="<folderId>"`).
 * Native HTML5 drags are intercepted by the Tauri webview, so this tracks the pointer itself.
 *
 * Listeners attach only after the pointer moves past a small threshold, and we never put
 * `select-none` on `document.body` (that breaks contenteditable / IME typing).
 */
export function useNoteDrag({
  onMoved,
  onHoverFolder,
}: {
  /** Called after a note moved into a folder. */
  onMoved: (folderId: string) => void;
  /** Called when the pointer rests on a folder for a moment, so it can be opened. */
  onHoverFolder: (folderId: string) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const justDragged = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clear a leftover grab cursor if a previous drag was interrupted (HMR / crash).
    document.body.classList.remove("cursor-grabbing");
    return () => stopDrag.current?.();
  }, []);

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
      document.body.classList.remove("cursor-grabbing");
      clearTimeout(expandTimer);
      stopDrag.current = null;
      setDrag(null);
      setDropTarget(null);
    };
    function onMove(ev: PointerEvent) {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        active = true;
        document.body.classList.add("cursor-grabbing");
        // Escape only matters once a drag has started — avoid a standing keydown
        // listener on every note click (breaks IME composition in Tauri).
        window.addEventListener("keydown", onKey);
      }
      const target = targetAt(ev.clientX, ev.clientY);
      setDrag({ noteId: n.id, title: displayTitle(n), x: ev.clientX, y: ev.clientY });
      setDropTarget(target);
      if (target !== lastTarget) {
        lastTarget = target;
        clearTimeout(expandTimer);
        if (target) expandTimer = setTimeout(() => onHoverFolder(target), 500);
      }
    }
    function onUp(ev: PointerEvent) {
      if (active) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 0);
        const target = targetAt(ev.clientX, ev.clientY);
        if (target && target !== n.folderId) {
          moveNote(n.id, target);
          onMoved(target);
        }
      }
      cleanup();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup();
      }
    }
    stopDrag.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  };

  return { drag, dropTarget, justDragged, startNoteDrag };
}
