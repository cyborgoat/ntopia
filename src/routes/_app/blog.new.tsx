import { createFileRoute } from "@tanstack/react-router";
import { NewFeedPost } from "@/components/markdown-feed";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/_app/blog/new")({
  component: () => (
    <RequireAuth>
      <NewFeedPost kind="/blog-posts" title="Blog" />
    </RequireAuth>
  ),
});
