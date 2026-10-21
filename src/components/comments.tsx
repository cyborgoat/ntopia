import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, MessageSquare, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Divider } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/markdown-editor";
import { releaseStagedImages, stageImage, uploadStagedImages } from "@/components/image-upload";
import { errorMessage, imagePreviewUrl, orbit } from "@/lib/orbit";

export type Vote = 1 | -1 | 0;
export type ResourceType = "announcement" | "event" | "news" | "blog" | "forum";

// Solid arrow = the current user's vote; outlined = not voted.
export function VoteBar({ score, mine, onVote }: { score: number; mine: Vote; onVote: (v: Vote) => void }) {
  const arrow = (dir: 1 | -1) => {
    const active = mine === dir;
    const Icon = dir === 1 ? ArrowBigUp : ArrowBigDown;
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={dir === 1 ? "Upvote" : "Downvote"}
        aria-pressed={active}
        className={active ? "text-primary" : "text-muted-foreground"}
        onClick={() => onVote(active ? 0 : dir)}
      >
        <Icon className={active ? "fill-current" : undefined} />
      </Button>
    );
  };
  return (
    <div className="flex items-center gap-1 text-sm">
      {arrow(1)}
      <span className={`w-5 text-center tabular-nums ${mine !== 0 ? "font-medium text-primary" : ""}`}>{score}</span>
      {arrow(-1)}
    </div>
  );
}

export function VoteMenuItems({
  mine,
  onVote,
  onReply,
}: {
  mine: Vote;
  onVote: (v: Vote) => void;
  onReply?: () => void;
}) {
  return (
    <>
      <ContextMenuItem onClick={() => onVote(1)}><ArrowBigUp className={mine === 1 ? "fill-current" : undefined} /> Upvote</ContextMenuItem>
      <ContextMenuItem onClick={() => onVote(-1)}><ArrowBigDown className={mine === -1 ? "fill-current" : undefined} /> Downvote</ContextMenuItem>
      <ContextMenuItem disabled={mine === 0} onClick={() => onVote(0)}><Undo2 /> Clear vote</ContextMenuItem>
      {onReply && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onReply}><MessageSquare /> Reply</ContextMenuItem>
        </>
      )}
    </>
  );
}

/** Votable, one-level-nested comment thread for any resource type. */
export function CommentThread({
  resourceType,
  resourceId,
}: {
  resourceType: ResourceType;
  resourceId: string;
}) {
  const qc = useQueryClient();
  const key = ["comments", resourceType, resourceId];
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const composerRef = useRef<MarkdownEditorHandle>(null);
  const composerBox = useRef<HTMLDivElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const { data } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await orbit.GET("/api/comments", { params: { query: { resourceType, resourceId } } })).data?.items ?? [],
  });
  const comments = data ?? [];
  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  async function send() {
    if (!text.trim()) return;
    setError("");
    let content: string;
    try {
      content = await uploadStagedImages(text);
    } catch (e) {
      return setError(errorMessage(e));
    }
    const { error } = await orbit.POST("/api/comments", {
      body: { resourceType, resourceId, content, ...(replyTo ? { parentId: replyTo } : {}) },
    });
    if (error) return setError(errorMessage(error));
    releaseStagedImages(text);
    setText("");
    setReplyTo(null);
    refresh();
    qc.invalidateQueries({ queryKey: ["forum-posts"] });
  }

  function startReply(commentId: string | null) {
    setReplyTo(commentId);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const vote = async (cid: string, value: Vote) => {
    await orbit.PUT("/api/comments/{id}/vote", { params: { path: { id: cid } }, body: { value } });
    refresh();
  };

  return (
    <section>
      <Divider />
      <h2 className="mb-4 text-sm font-medium">{total} {total === 1 ? "comment" : "comments"}</h2>
      <div className="space-y-6">
        {comments.map((c) => (
          <div key={c.id} className="space-y-3">
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{c.author.fullName} · {new Date(c.createdAt).toLocaleString()}</p>
                  <Markdown>{c.content}</Markdown>
                  <div className="mt-2 flex items-center gap-2">
                    <VoteBar score={c.score} mine={c.myVote} onVote={(v) => vote(c.id, v)} />
                    <Button variant="ghost" size="sm" onClick={() => startReply(c.id)}>Reply</Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <VoteMenuItems mine={c.myVote} onVote={(v) => void vote(c.id, v)} onReply={() => startReply(c.id)} />
              </ContextMenuContent>
            </ContextMenu>
            {c.replies.map((r) => (
              <ContextMenu key={r.id}>
                <ContextMenuTrigger className="block">
                  <div className="ml-8">
                    <p className="mb-1 text-xs text-muted-foreground">{r.author.fullName} · {new Date(r.createdAt).toLocaleString()}</p>
                    <Markdown>{r.content}</Markdown>
                    <div className="mt-2"><VoteBar score={r.score} mine={r.myVote} onVote={(v) => vote(r.id, v)} /></div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <VoteMenuItems mine={r.myVote} onVote={(v) => void vote(r.id, v)} />
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ))}
      </div>

      <Divider />
      <div className="space-y-2">
        {replyTo && (
          <p className="text-xs text-muted-foreground">
            Replying to a comment · <button className="underline" onClick={() => setReplyTo(null)}>cancel</button>
          </p>
        )}
        <div ref={composerBox}>
          <MarkdownEditor
            ref={composerRef}
            variant="compact"
            placeholder="Write a comment… (⌘↵ to send)"
            value={text}
            onChange={setText}
            onSubmit={() => void send()}
            imageUploadHandler={stageImage}
            imagePreviewHandler={imagePreviewUrl}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={!text.trim()} onClick={() => void send()}>Comment</Button>
      </div>
    </section>
  );
}
