import { useEffect, useEffectEvent, useRef, useState } from "react";
import { dirname, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { Check, FileQuestion, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/markdown-editor";
import { cn, toMessage } from "@/lib/utils";
import { fileSize, formatBytes, imageBlobUrl, kindOf, readText, writeText } from "./fs";
import { t, useT } from "@/i18n";

const AUTOSAVE_MS = 500;
type SaveStatus = "saved" | "saving" | "unsaved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  const tr = useT();
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums", status === "unsaved" && "text-amber-700 dark:text-amber-400")} aria-live="polite">
      {status === "saving" && <><Loader2 className="size-3 animate-spin" /> {tr("notebook.saving")}</>}
      {status === "saved" && <><Check className="size-3" /> {tr("notebook.saved")}</>}
      {status === "unsaved" && tr("notebook.unsaved")}
    </span>
  );
}

function Header({ name, path, status, onDelete }: { name: string; path: string; status?: SaveStatus; onDelete: () => void }) {
  const tr = useT();
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-medium" title={path}>{name}</p>
      {status && <SaveIndicator status={status} />}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={tr("notebook.deleteFile")} title={tr("notebook.deleteFile")} onClick={onDelete}><Trash2 /></Button>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">{children}</div>;
}

/** Loads a text file and writes edits back 500 ms after typing stops (and when the file is closed). */
function TextFile({ path, name, markdown, onDelete }: { path: string; name: string; markdown: boolean; onDelete: () => void }) {
  useT();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gen = useRef(0);
  const latest = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    readText(path).then((t) => live && (latest.current = t, setContent(t))).catch((e) => live && setError(toMessage(e)));
    return () => { live = false; };
  }, [path]);

  const flush = useEffectEvent(async (text: string) => {
    const token = ++gen.current;
    setStatus("saving");
    try {
      await writeText(path, text);
      if (token === gen.current) setStatus("saved");
    } catch (e) {
      if (token !== gen.current) return;
      setStatus("unsaved");
      toast.error(t("notebook.saveFailed", { name, reason: toMessage(e) }));
    }
  });

  const change = (next: string) => {
    latest.current = next;
    setContent(next);
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flush(next); }, AUTOSAVE_MS);
  };

  // Switching files must not drop a pending edit.
  useEffect(() => () => {
    if (timer.current && latest.current != null) {
      clearTimeout(timer.current);
      const text = latest.current;
      // A file deleted or renamed in the meantime must not be recreated.
      void exists(path).then(async (there) => { if (there) await writeText(path, text); }).catch(() => toast.error(t("notebook.saveFailedShort", { name })));
    }
  }, [path, name]);

  // Relative image paths in Markdown resolve against the file's own folder.
  const previewImage = async (src: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src;
    return imageBlobUrl(await join(await dirname(path), decodeURI(src)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header name={name} path={path} status={content == null ? undefined : status} onDelete={onDelete} />
      {error ? (
        <Notice>{error}</Notice>
      ) : content == null ? (
        <Notice><Loader2 className="size-4 animate-spin" /></Notice>
      ) : markdown ? (
        <div className="min-h-0 flex-1">
          <MarkdownEditor fillHeight variant="full" value={content} onChange={change} placeholder={t("notebook.writePlaceholder")} className="h-full rounded-none border-0" imagePreviewHandler={previewImage} />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => change(e.target.value)}
          spellCheck={false}
          aria-label={name}
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
        />
      )}
    </div>
  );
}

function ImageFile({ path, name, onDelete }: { path: string; name: string; onDelete: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState<number>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | undefined;
    let live = true;
    imageBlobUrl(path).then((u) => { if (live) { url = u; setSrc(u); } else URL.revokeObjectURL(u); }).catch((e) => live && setError(toMessage(e)));
    fileSize(path).then((n) => live && setSize(n)).catch(() => {});
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header name={name} path={path} onDelete={onDelete} />
      {error ? <Notice>{error}</Notice> : !src ? <Notice><Loader2 className="size-4 animate-spin" /></Notice> : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-auto p-6">
          <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
          {size != null && <p className="text-xs text-muted-foreground">{formatBytes(size)}</p>}
        </div>
      )}
    </div>
  );
}

function OtherFile({ path, name, onDelete }: { path: string; name: string; onDelete: () => void }) {
  const tr = useT();
  const [size, setSize] = useState<number>();
  useEffect(() => {
    let live = true;
    fileSize(path).then((n) => live && setSize(n)).catch(() => {});
    return () => { live = false; };
  }, [path]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header name={name} path={path} onDelete={onDelete} />
      <Notice>
        <div className="flex flex-col items-center gap-2 text-center">
          <FileQuestion className="size-8" />
          <p>{tr("notebook.noPreview")}</p>
          {size != null && <p className="text-xs">{formatBytes(size)}</p>}
        </div>
      </Notice>
    </div>
  );
}

/** Shows the selected file: editable text and Markdown, images, or a placeholder for anything else. */
export function FileViewer({ path, onDelete }: { path: string; onDelete: () => void }) {
  const name = path.split(/[\\/]/).pop() ?? path;
  const kind = kindOf(name);
  if (kind === "markdown" || kind === "text") return <TextFile key={path} path={path} name={name} markdown={kind === "markdown"} onDelete={onDelete} />;
  if (kind === "image") return <ImageFile key={path} path={path} name={name} onDelete={onDelete} />;
  return <OtherFile key={path} path={path} name={name} onDelete={onDelete} />;
}
