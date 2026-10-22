import { DateChip } from "@/components/date-chip";
import { useState } from "react";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { FeedCard } from "@/components/feed-card";
import { FeedItemMenu, useDeleteMutation } from "@/components/feed-item-menu";
import { Field, FormDialog } from "@/components/form-dialog";
import { ImageUploadButton } from "@/components/image-upload";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { UserPicker, type PickedUser } from "@/components/user-picker";
import { useAuth } from "@/lib/auth";
import { orbit, unwrap } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/events/")({
  component: () => (
    <RequireAuth>
      <Events />
    </RequireAuth>
  ),
});

type Audience = "GLOBAL" | "INVITE_ONLY";

const blank = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  location: "",
  coverImageUrl: "",
  audience: "GLOBAL" as Audience,
  recipients: [] as PickedUser[],
};

function Events() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["events", page],
    queryFn: async () => (await orbit.GET("/api/events", { params: { query: { page, limit: PAGE_SIZE } } })).data,
    placeholderData: keepPreviousData,
  });
  const del = useDeleteMutation(["events"], (id) =>
    orbit.DELETE("/api/events/{id}", { params: { path: { id } } }),
  );

  return (
    <>
      <PageHeader
        title="Events"
        crumbs={[{ label: "Home", to: "/" }, { label: "Events" }]}
        actions={
          isAdmin && (
            <FormDialog
              title="New event"
              triggerLabel="New"
              onSubmit={async () => {
                if (f.audience === "INVITE_ONLY" && f.recipients.length === 0) {
                  throw new Error("Pick at least one invitee for invite-only events.");
                }
                await unwrap(orbit.POST("/api/events", {
                  body: {
                    title: f.title,
                    description: f.description,
                    startAt: new Date(f.startAt).toISOString(),
                    endAt: new Date(f.endAt).toISOString(),
                    location: f.location,
                    coverImageUrl: f.coverImageUrl || undefined,
                    audience: f.audience,
                    ...(f.audience === "INVITE_ONLY" ? { recipientIds: f.recipients.map((r) => r.id) } : {}),
                  },
                }));
                setF(blank);
                qc.invalidateQueries({ queryKey: ["events"] });
              }}
            >
              <Field label="Title"><Input required value={f.title} onChange={set("title")} /></Field>
              <Field label="Description"><Textarea required rows={3} value={f.description} onChange={set("description")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts"><Input required type="datetime-local" value={f.startAt} onChange={set("startAt")} /></Field>
                <Field label="Ends"><Input required type="datetime-local" value={f.endAt} onChange={set("endAt")} /></Field>
              </div>
              <Field label="Location"><Input required value={f.location} onChange={set("location")} /></Field>
              <Field label="Audience">
                <NativeSelect
                  value={f.audience}
                  onChange={(e) => setF({ ...f, audience: e.target.value as Audience, recipients: e.target.value === "GLOBAL" ? [] : f.recipients })}
                >
                  <option value="GLOBAL">Everyone</option>
                  <option value="INVITE_ONLY">Invite only</option>
                </NativeSelect>
              </Field>
              {f.audience === "INVITE_ONLY" && (
                <Field label="Invitees">
                  <UserPicker
                    value={f.recipients}
                    onChange={(recipients) => setF({ ...f, recipients })}
                    excludeIds={user ? [user.id] : []}
                  />
                </Field>
              )}
              <div className="flex items-center gap-3">
                <ImageUploadButton label="Cover image" onUploaded={(u) => setF((p) => ({ ...p, coverImageUrl: u }))} />
                {f.coverImageUrl && <span className="truncate text-xs text-muted-foreground">{f.coverImageUrl}</span>}
              </div>
            </FormDialog>
          )
        }
      />
      <div className="space-y-2">
        {data?.items.length === 0 && <Empty>No events scheduled.</Empty>}
        {data?.items.map((ev) => (
          <FeedItemMenu
            key={ev.id}
            onOpen={() => void navigate({ to: "/events/$id", params: { id: ev.id } })}
            copy={{ text: ev.title, label: "Title" }}
            onDelete={isAdmin ? () => del.mutate(ev.id) : undefined}
          >
              <FeedCard
                to="/events/$id"
                params={{ id: ev.id }}
                title={ev.title}
                author={ev.createdBy.fullName}
                createdAt={ev.startAt}
                content={ev.description}
                leading={<DateChip iso={ev.startAt} className="m-2 self-center" />}
                meta={
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTime(ev.startAt)}</span>
                    {ev.audience === "INVITE_ONLY" && (
                      <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                        <Lock className="size-2.5" /> Invite only
                      </Badge>
                    )}
                  </p>
                }
                footer={
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </p>
                }
                action={isAdmin ? (
                  <Button variant="ghost" size="icon-xs" onClick={() => del.mutate(ev.id)} aria-label="Delete"><Trash2 /></Button>
                ) : undefined}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
