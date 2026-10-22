import { useIsDark } from "@/hooks/use-is-dark";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  BlockTypeSelect, BoldItalicUnderlineToggles, ChangeCodeMirrorLanguage, CodeToggle, ConditionalContents,
  CreateLink, DiffSourceToggleWrapper, InsertCodeBlock, InsertTable, InsertThematicBreak,
  ListsToggle, MDXEditor, Separator, StrikeThroughSupSubToggles, UndoRedo,
  codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, headingsPlugin, imagePlugin, linkDialogPlugin,
  linkPlugin, listsPlugin, markdownShortcutPlugin, quotePlugin, tablePlugin, thematicBreakPlugin, toolbarPlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/storage";
import { cn } from "@/lib/utils";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const MIME: Record<string, string> = { svg: "image/svg+xml", jpg: "image/jpeg" };

/** Opens the OS file explorer and returns the chosen images as Files. */
async function pickImages(): Promise<File[]> {
  if (isTauri()) {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    const paths = picked ? (Array.isArray(picked) ? picked : [picked]) : [];
    return Promise.all(
      paths.map(async (path) => {
        const name = path.split(/[\\/]/).pop() ?? "image";
        const ext = name.split(".").pop()?.toLowerCase() ?? "png";
        return new File([await readFile(path)], name, { type: MIME[ext] ?? `image/${ext}` });
      }),
    );
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function ImageButton({ onPick }: { onPick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" title="Insert image from files" aria-label="Insert image" onClick={onPick}>
      <ImagePlus />
    </Button>
  );
}

const CODE_BLOCK_LANGUAGES = {
  txt: "Plain text", js: "JavaScript", ts: "TypeScript", tsx: "TypeScript (React)",
  css: "CSS", html: "HTML", json: "JSON", bash: "Bash", python: "Python", yaml: "YAML",
};

export type MarkdownEditorHandle = { focus: () => void; setMarkdown: (md: string) => void };

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** Fill the parent's height with an internal scroller instead of growing with content. */
  fillHeight?: boolean;
  variant?: "full" | "compact";
  className?: string;
  autoFocus?: boolean;
  /** Enables paste/drop/toolbar images. Returns the URL written into the markdown. */
  imageUploadHandler?: (file: File) => Promise<string>;
  /** Maps an image src from the markdown to something the webview can display. */
  imagePreviewHandler?: (src: string) => Promise<string>;
  /** Called on Mod+Enter. */
  onSubmit?: () => void;
};

// Tables inside MDXEditor swallow wheel events; forward them to the nearest scroller.
function forwardTableWheel(wrapper: HTMLElement, event: WheelEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.closest("table")) return;
  let node: HTMLElement | null = target.parentElement;
  let scroller: HTMLElement | null = null;
  while (node && wrapper.contains(node)) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      scroller = node;
      break;
    }
    node = node.parentElement;
  }
  scroller ??= document.scrollingElement as HTMLElement | null;
  if (!scroller) return;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const next = Math.min(max, Math.max(0, scroller.scrollTop + event.deltaY));
  if (next !== scroller.scrollTop) {
    scroller.scrollTop = next;
    event.preventDefault();
  }
}

function FullToolbar({ onPickImage }: { onPickImage?: () => void }) {
  return (
    <DiffSourceToggleWrapper options={["rich-text", "source"]}>
      <ConditionalContents
        options={[
          { when: (e) => e?.editorType === "codeblock", contents: () => <ChangeCodeMirrorLanguage /> },
          {
            fallback: () => (
              <>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles />
                <StrikeThroughSupSubToggles options={["Strikethrough"]} />
                <CodeToggle />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                {onPickImage && <ImageButton onPick={onPickImage} />}
                <InsertTable />
                <InsertThematicBreak />
                <InsertCodeBlock />
              </>
            ),
          },
        ]}
      />
    </DiffSourceToggleWrapper>
  );
}

function CompactToolbar({ onPickImage }: { onPickImage?: () => void }) {
  return (
    <>
      <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
      <CodeToggle />
      <Separator />
      <ListsToggle options={["bullet", "number"]} />
      <Separator />
      <CreateLink />
      {onPickImage && <ImageButton onPick={onPickImage} />}
    </>
  );
}

/** WYSIWYG Markdown editor (MDXEditor) with a rich-text / source toggle. */
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  {
    value, onChange, placeholder = "Start writing…", fillHeight, variant = "full", className, autoFocus,
    imageUploadHandler, imagePreviewHandler, onSubmit,
  },
  ref,
) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const dark = useIsDark();

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(undefined, { defaultSelection: "rootEnd" }),
    setMarkdown: (md) => {
      lastEmitted.current = md;
      editorRef.current?.setMarkdown(md);
    },
  }));

  // MDXEditor is uncontrolled: push only external changes, never echoes of our own onChange.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    editorRef.current?.setMarkdown(value);
  }, [value]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => forwardTableWheel(wrapper, e);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && submitRef.current) {
        e.preventDefault();
        submitRef.current();
      }
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    wrapper.addEventListener("keydown", onKey, true);
    return () => {
      wrapper.removeEventListener("wheel", onWheel);
      wrapper.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const uploadRef = useRef(imageUploadHandler);
  uploadRef.current = imageUploadHandler;

  async function insertFiles(files: File[]) {
    const upload = uploadRef.current;
    if (!upload) return;
    for (const file of files) {
      try {
        const url = await upload(file);
        editorRef.current?.insertMarkdown(`![${file.name.replace(/\.[^.]+$/, "")}](${url})`);
      } catch (err) {
        toast.error(`Couldn't upload ${file.name}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  }
  const insertFromFiles = async () => insertFiles(await pickImages());
  const insertRef = useRef(insertFiles);
  insertRef.current = insertFiles;

  // Pasted images (clipboard files or screenshots) are uploaded and inserted at the caret.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!files.length || !uploadRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      void insertRef.current(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `pasted-${Date.now()}-${i}.${f.type.split("/")[1] || "png"}`, { type: f.type }))));
    };
    wrapper.addEventListener("paste", onPaste, true);
    return () => wrapper.removeEventListener("paste", onPaste, true);
  }, []);

  // Plugins are read once on mount, so handlers must be stable for the editor's lifetime.
  const images = !!imageUploadHandler;
  const plugins = useRef([
    headingsPlugin(),
    quotePlugin(),
    listsPlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
    codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
    ...(images ? [imagePlugin({ imageUploadHandler, imagePreviewHandler })] : []),
    markdownShortcutPlugin(),
    diffSourcePlugin({ viewMode: "rich-text" }),
    toolbarPlugin({
      toolbarContents: () => (variant === "compact" ? <CompactToolbar onPickImage={images ? insertFromFiles : undefined} /> : <FullToolbar onPickImage={images ? insertFromFiles : undefined} />),
      toolbarClassName: "md-editor-toolbar",
    }),
  ]).current;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "md-editor overflow-hidden rounded-lg border bg-background",
        fillHeight && "md-editor-fill flex min-h-0 flex-1 flex-col",
        variant === "compact" && "md-editor-compact",
        className,
      )}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(md, initialNormalize) => {
          // Skip the normalization pass on load so opening content doesn't mark it dirty.
          if (initialNormalize) return;
          lastEmitted.current = md;
          onChange(md);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("md-editor-root", dark && "dark-theme")}
        contentEditableClassName="prose-ntopia md-editor-content"
        plugins={plugins}
      />
    </div>
  );
});
