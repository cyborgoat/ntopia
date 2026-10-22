import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Byline, DetailPage, DetailTitle } from "@/components/detail-page";
import { useDeleteMutation } from "@/components/feed-item-menu";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/announcements/$id")({
  component: AnnouncementDetail,
});

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const { data, isPending } = useQuery({
    queryKey: ["announcements", id],
    queryFn: async () => (await orbit.GET("/api/announcements/{id}", { params: { path: { id } } })).data ?? null,
  });
  const del = useDeleteMutation<void>(["announcements"], () =>
    orbit.DELETE("/api/announcements/{id}", { params: { path: { id } } }),
  );

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
          <DetailTitle>{data.title}</DetailTitle>
          <Byline author={data.author.fullName} createdAt={data.createdAt} />
          <p className="whitespace-pre-wrap text-sm">{data.description}</p>
        </>
      )}
    </DetailPage>
  );
}
