import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { uploadImage } from "@/components/image-upload";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, imagePreviewUrl, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/$postId")({
  component: () => (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  ),
});

type Vote = 1 | -1 | 0;

// Filled arrow = the current user's vote; outlined = not voted.
function VoteBar({ score, mine, onVote }: { score: number; mine: Vote; onVote: (v: Vote) => void }) {
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

function VoteMenuItems({
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

function Thread() {
  const { postId: id } = Route.useParams();
  const qc = useQueryClient();
  const key = ["forum-post", id];
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const composerRef = useRef<MarkdownEditorHandle>(null);
  const composerBox = useRef<HTMLDivElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const { data: post } = useQuery({
    queryKey: key,
    queryFn: async () => (await orbit.GET("/api/forum-posts/{id}", { params: { path: { id } } })).data,
  });

  async function send() {
    if (!text.trim()) return;
    setError("");
    const { error } = await orbit.POST("/api/forum-posts/{id}/comments", {
      params: { path: { id } },
      body: { content: text, ...(replyTo ? { parentId: replyTo } : {}) },
    });
    if (error) return setError(errorMessage(error));
    setText("");
    setReplyTo(null);
    refresh();
  }

  function startReply(commentId: string | null) {
    setReplyTo(commentId);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  usePageTitle("Discussions");
  usePageCrumbs([{ label: "Home", to: "/" }, { label: "Discussions", to: "/discussions" }, { label: post?.title ?? "…" }]);

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const voteComment = async (cid: string, value: Vote) => {
    await orbit.PUT("/api/forum-comments/{id}/vote", { params: { path: { id: cid } }, body: { value } });
    refresh();
  };

  const votePost = async (value: Vote) => {
    await orbit.PUT("/api/forum-posts/{id}/vote", { params: { path: { id } }, body: { value } });
    refresh();
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="block">
          <article className="space-y-3">
            <h1 className="text-lg font-semibold tracking-tight">{post.title}</h1>
            <p className="text-xs text-muted-foreground">{post.author.fullName} · {new Date(post.createdAt).toLocaleString()}</p>
            <Markdown>{post.content}</Markdown>
            <VoteBar score={post.score} mine={post.myVote} onVote={votePost} />
          </article>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <VoteMenuItems mine={post.myVote} onVote={(v) => void votePost(v)} onReply={() => startReply(null)} />
        </ContextMenuContent>
      </ContextMenu>

      <Divider />
      <h2 className="mb-4 text-sm font-medium">{post.comments.length} comments</h2>
      <div className="space-y-6">
        {post.comments.map((c) => (
          <div key={c.id} className="space-y-3">
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{c.author.fullName} · {new Date(c.createdAt).toLocaleString()}</p>
                  <Markdown>{c.content}</Markdown>
                  <div className="mt-2 flex items-center gap-2">
                    <VoteBar score={c.score} mine={c.myVote} onVote={(v) => voteComment(c.id, v)} />
                    <Button variant="ghost" size="sm" onClick={() => startReply(c.id)}>Reply</Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <VoteMenuItems mine={c.myVote} onVote={(v) => void voteComment(c.id, v)} onReply={() => startReply(c.id)} />
              </ContextMenuContent>
            </ContextMenu>
            {c.replies.map((r) => (
              <ContextMenu key={r.id}>
                <ContextMenuTrigger className="block">
                  <div className="ml-8">
                    <p className="mb-1 text-xs text-muted-foreground">{r.author.fullName} · {new Date(r.createdAt).toLocaleString()}</p>
                    <Markdown>{r.content}</Markdown>
                    <div className="mt-2"><VoteBar score={r.score} mine={r.myVote} onVote={(v) => voteComment(r.id, v)} /></div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <VoteMenuItems mine={r.myVote} onVote={(v) => void voteComment(r.id, v)} />
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
            imageUploadHandler={uploadImage}
            imagePreviewHandler={imagePreviewUrl}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={!text.trim()} onClick={() => void send()}>Comment</Button>
      </div>
    </>
  );
}
