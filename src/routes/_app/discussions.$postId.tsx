import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { CommentThread, VoteBar, VoteMenuItems, type Vote } from "@/components/comments";
import { Markdown } from "@/components/markdown";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { RequireAuth } from "@/components/require-auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/$postId")({
  component: () => (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  ),
});

function Thread() {
  const { postId: id } = Route.useParams();
  const qc = useQueryClient();
  const key = ["forum-post", id];

  const { data: post } = useQuery({
    queryKey: key,
    queryFn: async () => (await orbit.GET("/api/forum-posts/{id}", { params: { path: { id } } })).data,
  });

  usePageTitle("Discussions");
  usePageCrumbs([{ label: "Home", to: "/" }, { label: "Discussions", to: "/discussions" }, { label: post?.title ?? "…" }]);

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const votePost = async (value: Vote) => {
    await orbit.PUT("/api/forum-posts/{id}/vote", { params: { path: { id } }, body: { value } });
    qc.invalidateQueries({ queryKey: key });
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
          <VoteMenuItems mine={post.myVote} onVote={(v) => void votePost(v)} />
        </ContextMenuContent>
      </ContextMenu>

      <CommentThread resourceType="forum" resourceId={id} />
    </>
  );
}
