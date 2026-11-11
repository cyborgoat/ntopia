import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PostComposer } from "@/components/post-composer";
import { orbit, unwrap } from "@/lib/orbit";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_app/discussions/new")({
  component: NewThread,
});

function NewThread() {
  const tr = useT();
  const qc = useQueryClient();
  return (
    <PostComposer
      pageTitle={tr("disc.start")}
      backTo="/discussions"
      submitLabel={tr("disc.post")}
      fields={{}}
      onPublish={async ({ title, content }) => {
        await unwrap(orbit.POST("/api/forum-posts", { body: { title, content } }));
        await qc.invalidateQueries({ queryKey: ["forum-posts"] });
      }}
    />
  );
}
