import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailPage } from "@/components/detail-page";
import { CommentThread } from "@/components/comments";
import { RequireAuth } from "@/components/require-auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/announcements/$id")({
  component: () => (
    <RequireAuth>
      <AnnouncementDetail />
    </RequireAuth>
  ),
});

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["announcements", id],
    queryFn: async () => (await orbit.GET("/api/announcements/{id}", { params: { path: { id } } })).data ?? null,
  });
  const del = useMutation({
    mutationFn: () => orbit.DELETE("/api/announcements/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <DetailPage
      section={{ label: "Announcements", to: "/announcements" }}
      itemTitle={data?.title}
      loading={isPending}
      notFound={!data}
      onDelete={() => del.mutateAsync()}
    >
      {data && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <p className="text-xs text-muted-foreground">{data.author.fullName} · {new Date(data.createdAt).toLocaleString()}</p>
          <p className="whitespace-pre-wrap text-sm">{data.description}</p>
          <CommentThread resourceType="announcement" resourceId={id} />
        </>
      )}
    </DetailPage>
  );
}
