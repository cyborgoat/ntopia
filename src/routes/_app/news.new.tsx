import { createFileRoute } from "@tanstack/react-router";
import { NewFeedPost } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/news/new")({
  component: () => <NewFeedPost kind="/news" title="News" />,
});
