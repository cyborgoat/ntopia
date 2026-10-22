import { createFileRoute } from "@tanstack/react-router";
import { FeedPostDetail } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/blog/$id")({
  component: () => <FeedPostDetail kind="/blog-posts" id={Route.useParams().id} />,
});
