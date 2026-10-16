import { useRef, useState } from "react";
import { toMessage } from "@/lib/utils";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/markdown-editor";
import { uploadImage } from "@/components/image-upload";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { assetUrl, imagePreviewUrl } from "@/lib/orbit";

export type PostDraft = { title: string; content: string; tags: string[]; coverImageUrl?: string };

/** Full-page composer for Markdown posts (blog, news, discussion threads). */
export function PostComposer({
  pageTitle,
  backTo,
  submitLabel = "Publish",
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
  usePageTitle(pageTitle);
  const section = { "/blog": "Blog", "/news": "News", "/discussions": "Discussions" }[backTo];
  usePageCrumbs([{ label: "Home", to: "/" }, { label: section, to: backTo }, { label: "New" }]);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState<string>();
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const published = useRef(false);
  const coverInput = useRef<HTMLInputElement>(null);

  const dirty = !!(title.trim() || content.trim() || tags.trim() || cover);
  useBlocker({
    shouldBlockFn: () => dirty && !published.current && !window.confirm("Discard this draft?"),
    enableBeforeUnload: () => dirty && !published.current,
  });

  async function publish() {
    if (!title.trim() || !content.trim()) return setError("Add a title and some content first.");
    setBusy(true);
    setError("");
    try {
      await onPublish({
        title: title.trim(),
        content,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        coverImageUrl: cover,
      });
      published.current = true;
      await navigate({ to: backTo });
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-3 px-8 pt-2 pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Back" render={<Link to={backTo} />}><ArrowLeft /></Button>
        <Input
          autoFocus
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 flex-1 border-none px-1 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-xl"
        />
        <Button variant="ghost" size="sm" render={<Link to={backTo} />}>Cancel</Button>
        <Button size="sm" disabled={busy} onClick={() => void publish()}>{busy ? "Publishing…" : submitLabel}</Button>
      </div>

      {(fields.tags || fields.cover) && (
        <div className="flex flex-wrap items-center gap-2">
          {fields.tags && (
            <Input placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} className="h-8 max-w-xs text-sm" />
          )}
          {fields.cover && (
            <>
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setCoverBusy(true);
                  try {
                    setCover(await uploadImage(f));
                  } catch (err) {
                    setError(toMessage(err));
                  } finally {
                    setCoverBusy(false);
                  }
                }}
              />
              {cover ? (
                <div className="flex items-center gap-1.5 rounded-md border p-0.5 pr-1">
                  <img src={assetUrl(cover)} alt="" className="h-7 w-12 rounded object-cover" />
                  <span className="text-xs text-muted-foreground">Cover</span>
                  <Button variant="ghost" size="icon-xs" aria-label="Remove cover" onClick={() => setCover(undefined)}><X /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={coverBusy} onClick={() => coverInput.current?.click()}>
                  <ImagePlus /> {coverBusy ? "Uploading…" : "Cover image"}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <MarkdownEditor
        fillHeight
        value={content}
        onChange={setContent}
        placeholder="Write your post… Markdown shortcuts like #, -, > and ``` work as you type."
        imageUploadHandler={uploadImage}
        imagePreviewHandler={imagePreviewUrl}
      />
    </div>
  );
}
