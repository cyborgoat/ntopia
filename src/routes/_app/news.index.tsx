import { createFileRoute } from "@tanstack/react-router";
import { MarkdownFeed } from "@/components/markdown-feed";

export const Route = createFileRoute("/_app/news/")({
  component: () => <MarkdownFeed kind="/news" title="News" />,
});
