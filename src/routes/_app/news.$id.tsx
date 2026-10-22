import { createFileRoute } from "@tanstack/react-router";
import { FeedPostDetail } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/news/$id")({
  component: () => <FeedPostDetail kind="/news" id={Route.useParams().id} />,
});
