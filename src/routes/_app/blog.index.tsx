import { createFileRoute } from "@tanstack/react-router";
import { MarkdownFeed } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/blog/")({
  component: () => <MarkdownFeed kind="/blog-posts" title="Blog" />,
});
