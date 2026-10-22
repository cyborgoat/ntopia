import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Lock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CoverImage, DetailPage, DetailTitle } from "@/components/detail-page";
import { useDeleteMutation } from "@/components/feed-item-menu";
import { orbit } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/events/$id")({
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { data, isPending } = useQuery({
    queryKey: ["events", id],
    queryFn: async () => (await orbit.GET("/api/events/{id}", { params: { path: { id } } })).data ?? null,
  });
  const del = useDeleteMutation<void>(["events"], () =>
    orbit.DELETE("/api/events/{id}", { params: { path: { id } } }),
  );

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
          <CoverImage src={data.coverImageUrl} />
          <div className="flex flex-wrap items-center gap-2">
            <DetailTitle>{data.title}</DetailTitle>
            <Badge variant={data.audience === "INVITE_ONLY" ? "secondary" : "outline"} className="gap-1">
              {data.audience === "INVITE_ONLY" ? <><Lock className="size-3" /> Invite only</> : "Everyone"}
            </Badge>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDateTime(data.startAt)} → {formatDateTime(data.endAt)}</p>
            <p className="flex items-center gap-1.5"><MapPin className="size-4" />{data.location}</p>
            {data.audience === "INVITE_ONLY" && data.recipients.length > 0 && (
              <p className="flex items-start gap-1.5">
                <Users className="mt-0.5 size-4 shrink-0" />
                <span>{data.recipients.map((r) => r.fullName).join(", ")}</span>
              </p>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{data.description}</p>
        </>
      )}
    </DetailPage>
  );
}
