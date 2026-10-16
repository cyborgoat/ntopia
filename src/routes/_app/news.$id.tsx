import { createFileRoute } from "@tanstack/react-router";
import { FeedPostDetail } from "@/components/markdown-feed";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/_app/news/$id")({
  component: () => (
    <RequireAuth>
      <FeedPostDetail kind="/news" id={Route.useParams().id} />
    </RequireAuth>
  ),
});
