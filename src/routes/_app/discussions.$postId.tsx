import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { CommentThread, VoteBar, VoteMenuItems, type Vote } from "@/components/comments";
import { Byline, DetailPage, DetailTitle } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
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

  const { data: post, isPending } = useQuery({
    queryKey: key,
    queryFn: async () => (await orbit.GET("/api/forum-posts/{id}", { params: { path: { id } } })).data ?? null,
  });

  const votePost = async (value: Vote) => {
    await orbit.PUT("/api/forum-posts/{id}/vote", { params: { path: { id } }, body: { value } });
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <DetailPage
      section={{ label: "Discussions", to: "/discussions" }}
      itemTitle={post?.title}
      loading={isPending}
      notFound={!post}
    >
      {post && (
        <>
          <ContextMenu>
            <ContextMenuTrigger className="block">
              <div className="space-y-5">
                <DetailTitle>{post.title}</DetailTitle>
                <Byline author={post.author.fullName} createdAt={post.createdAt} views={post.viewCount} />
                <Markdown>{post.content}</Markdown>
                <VoteBar score={post.score} mine={post.myVote} onVote={votePost} />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <VoteMenuItems mine={post.myVote} onVote={(v) => void votePost(v)} />
            </ContextMenuContent>
          </ContextMenu>
          <CommentThread resourceType="forum" resourceId={id} />
        </>
      )}
    </DetailPage>
  );
}
