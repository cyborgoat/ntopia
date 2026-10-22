import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/markdown-editor";
import { finalizeTitle, loadState, updateNote, updateNoteAndWait, type Note } from "@/gadgets/notes/store";
import { cn } from "@/lib/utils";

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

export function NoteEditor({
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
