import { createFileRoute } from "@tanstack/react-router";
import { MarkdownFeed } from "@/components/markdown-feed";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/_app/blog")({
  component: () => (
    <RequireAuth>
      <MarkdownFeed kind="/blog-posts" title="Blog" description="Longer reads and stories." />
    </RequireAuth>
  ),
});
