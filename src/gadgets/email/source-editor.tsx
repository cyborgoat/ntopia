import { useCallback, useMemo, useRef } from "react";
import { toMessage } from "@/lib/utils";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { open } from "@tauri-apps/plugin-dialog";
import { Bold, Code, Code2, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Strikethrough } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsDark } from "@/hooks/use-is-dark";
import { frontmatterExtensions, hasFrontmatter, isFrontmatterOpen } from "./frontmatter-extensions";
import { insertImageRef } from "./image-refs";
import * as mm from "./mdmailer";
import { t } from "@/i18n";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const Sep = () => <span className="mx-1 h-4 w-px bg-border" />;

/** Wrap the selection (or insert the markers around the cursor); unwrap if already wrapped. */
function wrap(view: EditorView, before: string, after = before, placeholder = "text") {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const selected = doc.sliceString(from, to);
  const hasOuter =
    from >= before.length && doc.sliceString(from - before.length, from) === before && doc.sliceString(to, to + after.length) === after;
  if (hasOuter) {
    view.dispatch({
      changes: [{ from: from - before.length, to: from }, { from: to, to: to + after.length }],
      selection: { anchor: from - before.length, head: to - before.length },
    });
  } else {
    const text = selected || placeholder;
    view.dispatch({
      changes: { from, to, insert: before + text + after },
      selection: { anchor: from + before.length, head: from + before.length + text.length },
    });
  }
  view.focus();
}

/** Toggle a line prefix on every selected line. `numbered` renumbers 1., 2., … */
function prefixLines(view: EditorView, prefix: string, numbered = false) {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const first = doc.lineAt(from).number;
  const last = doc.lineAt(to).number;
  const re = numbered ? /^\d+\.\s/ : new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const lines = Array.from({ length: last - first + 1 }, (_, i) => doc.line(first + i));
  const allHave = lines.every((l) => re.test(l.text));
  const changes = lines.map((l, i) => {
    const m = l.text.match(re);
    if (allHave) return { from: l.from, to: l.from + (m?.[0].length ?? 0) };
    return { from: l.from, to: l.from + (numbered && m ? m[0].length : 0), insert: numbered ? `${i + 1}. ` : prefix };
  });
  view.dispatch({ changes });
  view.focus();
}

function link(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const text = view.state.doc.sliceString(from, to) || "link text";
  const url = "https://";
  view.dispatch({
    changes: { from, to, insert: `[${text}](${url})` },
    selection: { anchor: from + text.length + 3, head: from + text.length + 3 + url.length },
  });
  view.focus();
}

function insertBlock(view: EditorView, text: string, cursorOffset = text.length) {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lead = from === line.from && line.text === "" ? "" : "\n\n";
  view.dispatch({ changes: { from, to, insert: lead + text }, selection: { anchor: from + lead.length + cursorOffset } });
  view.focus();
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </Button>
  );
}

const errText = toMessage;

/** Markdown editor for the whole email file (frontmatter + body), with image import (button, paste and drop). */
export function SourceEditor({
  value,
  onChange,
  editorRef,
  onFrontmatterChange,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Receives the editor view, so the page header can drive it (e.g. show or hide the frontmatter). */
  editorRef?: React.MutableRefObject<EditorView | null>;
  /** Called when the frontmatter is expanded or collapsed, or appears or disappears. */
  onFrontmatterChange?: (open: boolean, available: boolean) => void;
}) {
  const onFmRef = useRef(onFrontmatterChange);
  onFmRef.current = onFrontmatterChange;
  const viewRef = useRef<EditorView | null>(null);
  const dark = useIsDark();

  /** Add each file to the image library and reference it at the cursor (a `photo:` line, or the body). */
  const insertImages = useCallback(async (files: File[], view = viewRef.current) => {
    if (!view) return;
    try {
      for (const f of files) {
        const rel = await mm.savePastedImage(new Uint8Array(await f.arrayBuffer()), f.type || "image/png", f.name);
        insertImageRef(view, rel, f.name.replace(/\.[^.]+$/, "") || "image");
      }
    } catch (e) {
      toast.error(errText(e));
    }
  }, []);

  const run = (fn: (v: EditorView) => void) => () => {
    if (viewRef.current) fn(viewRef.current);
  };

  const extensions = useMemo(() => {
    const imageFiles = (dt: DataTransfer | null) => Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
    return [
      markdown(),
      frontmatterExtensions((open, available) => onFmRef.current?.(open, available)),
      EditorView.lineWrapping,
      keymap.of([
        { key: "Mod-b", run: (v) => (wrap(v, "**"), true) },
        { key: "Mod-i", run: (v) => (wrap(v, "*"), true) },
        { key: "Mod-k", run: (v) => (link(v), true) },
      ]),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = imageFiles(event.clipboardData);
          if (!files.length) return false;
          event.preventDefault();
          void insertImages(files, view);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer);
          if (!files.length) return false;
          event.preventDefault();
          void insertImages(files, view);
          return true;
        },
      }),
    ];
  }, [insertImages]);

  async function pickImage() {
    try {
      const picked = await open({ multiple: true, filters: [{ name: "Images", extensions: IMAGE_EXTS }] });
      const view = viewRef.current;
      if (!picked || !view) return;
      for (const p of Array.isArray(picked) ? picked : [picked]) {
        const name = p.split(/[\\/]/).pop() ?? "image";
        insertImageRef(view, await mm.importWorkAsset(p), name.replace(/\.[^.]+$/, ""));
      }
    } catch (e) {
      toast.error(errText(e));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b bg-muted/40 px-4 py-1">
        <ToolButton label={t("email.tool.heading")} onClick={run((v) => prefixLines(v, "## "))}><Heading2 /></ToolButton>
        <ToolButton label={t("email.tool.bold")} onClick={run((v) => wrap(v, "**"))}><Bold /></ToolButton>
        <ToolButton label={t("email.tool.italic")} onClick={run((v) => wrap(v, "*"))}><Italic /></ToolButton>
        <ToolButton label={t("email.tool.strike")} onClick={run((v) => wrap(v, "~~"))}><Strikethrough /></ToolButton>
        <ToolButton label={t("email.tool.code")} onClick={run((v) => wrap(v, "`", "`", "code"))}><Code /></ToolButton>
        <Sep />
        <ToolButton label={t("email.tool.bullets")} onClick={run((v) => prefixLines(v, "- "))}><List /></ToolButton>
        <ToolButton label={t("email.tool.numbers")} onClick={run((v) => prefixLines(v, "1. ", true))}><ListOrdered /></ToolButton>
        <ToolButton label={t("email.tool.quote")} onClick={run((v) => prefixLines(v, "> "))}><Quote /></ToolButton>
        <Sep />
        <ToolButton label={t("email.tool.link")} onClick={run(link)}><Link2 /></ToolButton>
        <ToolButton label={t("email.tool.codeBlock")} onClick={run((v) => insertBlock(v, "```\n\n```\n", 4))}><Code2 /></ToolButton>
        <ToolButton label={t("email.tool.divider")} onClick={run((v) => insertBlock(v, "---\n"))}><Minus /></ToolButton>
        <Sep />
        <ToolButton label={t("email.tool.importImage")} onClick={() => void pickImage()}><ImagePlus /></ToolButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-sm">
        <CodeMirror
          value={value}
          theme={dark ? "dark" : "light"}
          extensions={extensions}
          basicSetup={{ lineNumbers: false, foldGutter: false, autocompletion: false }}
          onChange={onChange}
          onCreateEditor={(view) => {
            viewRef.current = view;
            if (editorRef) editorRef.current = view;
            onFmRef.current?.(isFrontmatterOpen(view.state), hasFrontmatter(view.state));
          }}
          height="100%"
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
