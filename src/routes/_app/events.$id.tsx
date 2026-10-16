import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { DetailPage } from "@/components/detail-page";
import { RequireAuth } from "@/components/require-auth";
import { assetUrl, orbit } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/events/$id")({
  component: () => (
    <RequireAuth>
      <EventDetail />
    </RequireAuth>
  ),
});


function EventDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["events", id],
    queryFn: async () => (await orbit.GET("/events/{id}", { params: { path: { id } } })).data ?? null,
  });
  const del = useMutation({
    mutationFn: () => orbit.DELETE("/events/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  return (
    <DetailPage
      section={{ label: "Events", to: "/events" }}
      itemTitle={data?.title}
      loading={isPending}
      notFound={!data}
      onDelete={() => del.mutateAsync()}
    >
      {data && (
        <>
          {data.coverImageUrl && <img src={assetUrl(data.coverImageUrl)} alt="" className="h-56 w-full rounded-lg object-cover" />}
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDateTime(data.startAt)} → {formatDateTime(data.endAt)}</p>
            <p className="flex items-center gap-1.5"><MapPin className="size-4" />{data.location}</p>
          </div>
          <p className="whitespace-pre-wrap text-sm">{data.description}</p>
        </>
      )}
    </DetailPage>
  );
}
