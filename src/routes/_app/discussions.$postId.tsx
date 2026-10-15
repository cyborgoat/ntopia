import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { errorMessage, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/$postId")({ component: Thread });

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

function Thread() {
  const { postId: id } = Route.useParams();
  const qc = useQueryClient();
  const key = ["forum-post", id];
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");
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

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const voteComment = (cid: string) => async (value: Vote) => {
    await orbit.PUT("/forum-comments/{id}/vote", { params: { path: { id: cid } }, body: { value } });
    refresh();
  };

  return (
    <>
      <Link to="/discussions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Discussions
      </Link>
      <article className="space-y-3 rounded-lg border p-5">
        <h1 className="text-lg font-semibold tracking-tight">{post.title}</h1>
        <p className="text-xs text-muted-foreground">{post.author.fullName} · {new Date(post.createdAt).toLocaleString()}</p>
        <Markdown>{post.content}</Markdown>
        <VoteBar score={post.score} mine={post.myVote} onVote={async (value) => {
          await orbit.PUT("/forum-posts/{id}/vote", { params: { path: { id } }, body: { value } });
          refresh();
        }} />
      </article>

      <h2 className="mb-3 mt-8 text-sm font-medium">{post.comments.length} comments</h2>
      <div className="space-y-4">
        {post.comments.map((c) => (
          <div key={c.id} className="space-y-3">
            <div className="rounded-lg border p-4">
              <p className="mb-1 text-xs text-muted-foreground">{c.author.fullName} · {new Date(c.createdAt).toLocaleString()}</p>
              <Markdown>{c.content}</Markdown>
              <div className="mt-2 flex items-center gap-2">
                <VoteBar score={c.score} mine={c.myVote} onVote={voteComment(c.id)} />
                <Button variant="ghost" size="sm" onClick={() => setReplyTo(c.id)}>Reply</Button>
              </div>
            </div>
            {c.replies.map((r) => (
              <div key={r.id} className="ml-8 rounded-lg border bg-muted/30 p-4">
                <p className="mb-1 text-xs text-muted-foreground">{r.author.fullName} · {new Date(r.createdAt).toLocaleString()}</p>
                <Markdown>{r.content}</Markdown>
                <div className="mt-2"><VoteBar score={r.score} mine={r.myVote} onVote={voteComment(r.id)} /></div>
              </div>
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
        <Textarea rows={3} placeholder="Write a comment (Markdown)…" value={text} onChange={(e) => setText(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={!text.trim()} onClick={send}>Comment</Button>
      </div>
    </>
  );
}
