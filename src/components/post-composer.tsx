import { useRef, useState } from "react";
import { toMessage } from "@/lib/utils";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Tag as TagIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/markdown-editor";
import { TagInput, addTags } from "@/components/tag-input";
import { releaseStagedImages, stageImage, uploadImage, uploadStagedImages } from "@/components/image-upload";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { assetUrl, imagePreviewUrl } from "@/lib/orbit";
import { t, useT } from "@/i18n";

export type PostDraft = { title: string; content: string; tags: string[]; coverImageUrl?: string };

type Errors = { title?: string; content?: string; general?: string };

const SUBMIT_HINT = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘↵" : "Ctrl+↵";

/** Full-page composer for Markdown posts (blog, news, discussion threads). */
export function PostComposer({
  pageTitle,
  backTo,
  submitLabel,
  fields = { tags: true, cover: true },
  onPublish,
}: {
  pageTitle: string;
  backTo: "/blog" | "/news" | "/discussions";
  submitLabel?: string;
  fields?: { tags?: boolean; cover?: boolean };
  /** Persists the post; throw to show an error. */
  onPublish: (draft: PostDraft) => Promise<void>;
}) {
  const tr = useT();
  const submitText = submitLabel ?? tr("composer.publish");
  usePageTitle(pageTitle);
  const section = tr({ "/blog": "nav.blog", "/news": "nav.news", "/discussions": "nav.discussions" }[backTo] as "nav.blog");
  usePageCrumbs([{ label: tr("nav.home"), to: "/" }, { label: section, to: backTo }, { label: tr("common.new") }]);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // The tag still being typed; it counts as a tag when the post is published.
  const [tagDraft, setTagDraft] = useState("");
  const [cover, setCover] = useState<string>();
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const published = useRef(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const editor = useRef<MarkdownEditorHandle>(null);

  const dirty = !!(title.trim() || content.trim() || tags.length || tagDraft.trim() || cover);
  useBlocker({
    shouldBlockFn: () => dirty && !published.current && !window.confirm(t("composer.discard")),
    enableBeforeUnload: () => dirty && !published.current,
  });

  async function publish() {
    if (busy) return;
    const next: Errors = {};
    if (!title.trim()) next.title = t("composer.needTitle");
    if (!content.trim()) next.content = t("composer.needContent");
    setErrors(next);
    if (next.title) return titleInput.current?.focus();
    if (next.content) return editor.current?.focus();

    setBusy(true);
    try {
      await onPublish({
        title: title.trim(),
        content: await uploadStagedImages(content),
        tags: addTags(tags, tagDraft),
        coverImageUrl: cover,
      });
      releaseStagedImages(content);
      published.current = true;
      await navigate({ to: backTo });
    } catch (e) {
      setErrors({ general: toMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function pickCover(file: File) {
    setCoverBusy(true);
    try {
      setCover(await uploadImage(file));
      setErrors((e) => ({ ...e, general: undefined }));
    } catch (err) {
      setErrors((e) => ({ ...e, general: toMessage(err) }));
    } finally {
      setCoverBusy(false);
    }
  }

  const hasDetails = fields.tags || fields.cover;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-8">
        <div className="shrink-0 pt-4">
          <Input
            ref={titleInput}
            autoFocus
            aria-label={tr("composer.title")}
            placeholder={tr("composer.title")}
            value={title}
            aria-invalid={!!errors.title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
            }}
            className="h-auto rounded-none border-0 border-b border-input bg-transparent px-0 py-2 text-2xl font-semibold tracking-tight shadow-none placeholder:font-normal focus-visible:border-foreground focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0 md:text-2xl dark:bg-transparent"
          />
          <p className="min-h-5 pt-1 text-xs text-destructive" role={errors.title ? "alert" : undefined}>{errors.title}</p>
        </div>

        {hasDetails && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pb-3">
            {fields.tags && (
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <TagIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <TagInput
                  value={tags}
                  onChange={setTags}
                  draft={tagDraft}
                  onDraftChange={setTagDraft}
                  placeholder={tr("composer.addTags")}
                  className="min-h-8 flex-1 border-transparent bg-transparent px-0 py-0 focus-within:border-transparent focus-within:ring-0 dark:bg-transparent"
                />
              </div>
            )}
            {fields.cover && (
              <div className="flex items-center gap-1.5">
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void pickCover(f);
                  }}
                />
                {cover && <img src={assetUrl(cover)} alt={tr("composer.coverPreview")} className="aspect-video h-8 rounded border object-cover" />}
                <Button type="button" variant="ghost" size="sm" disabled={coverBusy} onClick={() => coverInput.current?.click()}>
                  <ImagePlus /> {coverBusy ? tr("upload.uploading") : cover ? tr("composer.changeCover") : tr("composer.addCover")}
                </Button>
                {cover && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={tr("composer.removeCover")} title={tr("composer.removeCover")} onClick={() => setCover(undefined)}>
                    <X />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col pb-3">
          <MarkdownEditor
            ref={editor}
            fillHeight
            value={content}
            onChange={(v) => {
              setContent(v);
              if (errors.content) setErrors((x) => ({ ...x, content: undefined }));
            }}
            placeholder={tr("composer.placeholder")}
            imageUploadHandler={stageImage}
            imagePreviewHandler={imagePreviewUrl}
            onSubmit={() => void publish()}
            className="md-editor-flush rounded-none border-0"
          />
          <p className="min-h-5 pt-1 text-sm text-destructive" role={errors.content ? "alert" : undefined}>{errors.content}</p>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-8 py-3">
          {errors.general ? (
            <p className="min-w-0 truncate text-sm text-destructive" role="alert" title={errors.general}>{errors.general}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{tr("composer.toSubmit", { key: SUBMIT_HINT, action: submitText.toLowerCase() })}</p>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" render={<Link to={backTo} />}>{tr("common.cancel")}</Button>
            <Button disabled={busy} onClick={() => void publish()}>{busy ? tr("composer.publishing") : submitText}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
