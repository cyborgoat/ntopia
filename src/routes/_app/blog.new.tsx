import { createFileRoute } from "@tanstack/react-router";
import { NewFeedPost } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/blog/new")({
  component: () => <NewFeedPost kind="/blog-posts" />,
});
