import { createFileRoute } from "@tanstack/react-router";
import { MarkdownFeed } from "@/components/markdown-feed";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/_app/news/")({
  component: () => (
    <RequireAuth>
      <MarkdownFeed kind="/news" title="News" description="Updates from around the team." />
    </RequireAuth>
  ),
});
