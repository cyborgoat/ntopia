import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PostComposer } from "@/components/post-composer";
import { RequireAuth } from "@/components/require-auth";
import { orbit, unwrap } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/new")({
  component: () => (
    <RequireAuth>
      <NewThread />
    </RequireAuth>
  ),
});

function NewThread() {
  const qc = useQueryClient();
  return (
    <PostComposer
      pageTitle="Start a discussion"
      backTo="/discussions"
      submitLabel="Post thread"
      fields={{}}
      onPublish={async ({ title, content }) => {
        await unwrap(orbit.POST("/api/forum-posts", { body: { title, content } }));
        await qc.invalidateQueries({ queryKey: ["forum-posts"] });
      }}
    />
  );
}
