import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PostComposer } from "@/components/post-composer";
import { orbit, unwrap } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/new")({
  component: NewThread,
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
