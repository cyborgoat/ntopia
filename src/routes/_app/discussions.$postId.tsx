import { useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, ArrowLeft, MessageSquare, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/$postId")({
  component: () => (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  ),
});

type Vote = 1 | -1 | 0;

function VoteBar({ score, mine, onVote }: { score: number; mine: Vote; onVote: (v: Vote) => void }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Button variant="ghost" size="icon-sm" className={mine === 1 ? "text-foreground" : "text-muted-foreground"} onClick={() => onVote(mine === 1 ? 0 : 1)}><ArrowBigUp /></Button>
      <span className="w-5 text-center tabular-nums">{score}</span>
      <Button variant="ghost" size="icon-sm" className={mine === -1 ? "text-foreground" : "text-muted-foreground"} onClick={() => onVote(mine === -1 ? 0 : -1)}><ArrowBigDown /></Button>
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
      <ContextMenuItem onClick={() => onVote(1)}><ArrowBigUp /> Upvote</ContextMenuItem>
      <ContextMenuItem onClick={() => onVote(-1)}><ArrowBigDown /> Downvote</ContextMenuItem>
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const { data: post } = useQuery({
    queryKey: key,
    queryFn: async () => (await orbit.GET("/forum-posts/{id}", { params: { path: { id } } })).data,
  });

  async function send() {
    setError("");
    const { error } = await orbit.POST("/forum-posts/{id}/comments", {
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
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const voteComment = (cid: string) => async (value: Vote) => {
    await orbit.PUT("/forum-comments/{id}/vote", { params: { path: { id: cid } }, body: { value } });
    refresh();
  };

  const votePost = async (value: Vote) => {
    await orbit.PUT("/forum-posts/{id}/vote", { params: { path: { id } }, body: { value } });
    refresh();
  };

  return (
    <>
      <Link to="/discussions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Discussions
      </Link>
      <ContextMenu>
        <ContextMenuTrigger className="block">
          <article className="space-y-3 rounded-lg border p-5">
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

      <h2 className="mb-3 mt-8 text-sm font-medium">{post.comments.length} comments</h2>
      <div className="space-y-4">
        {post.comments.map((c) => (
          <div key={c.id} className="space-y-3">
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs text-muted-foreground">{c.author.fullName} · {new Date(c.createdAt).toLocaleString()}</p>
                  <Markdown>{c.content}</Markdown>
                  <div className="mt-2 flex items-center gap-2">
                    <VoteBar score={c.score} mine={c.myVote} onVote={voteComment(c.id)} />
                    <Button variant="ghost" size="sm" onClick={() => startReply(c.id)}>Reply</Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <VoteMenuItems mine={c.myVote} onVote={(v) => void voteComment(c.id)(v)} onReply={() => startReply(c.id)} />
              </ContextMenuContent>
            </ContextMenu>
            {c.replies.map((r) => (
              <ContextMenu key={r.id}>
                <ContextMenuTrigger className="block">
                  <div className="ml-8 rounded-lg border bg-muted/30 p-4">
                    <p className="mb-1 text-xs text-muted-foreground">{r.author.fullName} · {new Date(r.createdAt).toLocaleString()}</p>
                    <Markdown>{r.content}</Markdown>
                    <div className="mt-2"><VoteBar score={r.score} mine={r.myVote} onVote={voteComment(r.id)} /></div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <VoteMenuItems mine={r.myVote} onVote={(v) => void voteComment(r.id)(v)} />
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {replyTo && (
          <p className="text-xs text-muted-foreground">
            Replying to a comment · <button className="underline" onClick={() => setReplyTo(null)}>cancel</button>
          </p>
        )}
        <Textarea
          ref={composerRef}
          rows={3}
          placeholder="Write a comment (Markdown)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={!text.trim()} onClick={send}>Comment</Button>
      </div>
    </>
  );
}
