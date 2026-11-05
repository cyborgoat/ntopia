import { DateChip } from "@/components/date-chip";
import { DateTimeInput } from "@/components/date-time-input";
import { useState } from "react";
import { ListPagination } from "@/components/list-pagination";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Lock, MapPin, Trash2 } from "lucide-react";
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
import { SortMenu } from "@/components/sort-menu";
import { useSortedList } from "@/hooks/use-sorted-list";
import { feedQueries } from "@/lib/feeds";
import { EVENT_SORT } from "@/lib/sorting";
import { UserPicker, type PickedUser } from "@/components/user-picker";
import { useAuth } from "@/lib/auth";
import { usePersistedFlag } from "@/lib/prefs";
import { orbit, unwrap } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/events/")({
  component: Events,
});

const SHOW_PAST_KEY = "ntopia.events.show-past";

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
  const [showPast, setShowPast] = usePersistedFlag(SHOW_PAST_KEY, true);
  // The API pages in creation order with no date filter or sort, so load every event and order/paginate here.
  const { data: all } = useQuery(feedQueries.events);
  const now = Date.now();
  const endOf = (ev: { startAt: string; endAt?: string }) => new Date(ev.endAt ?? ev.startAt).getTime();
  const shown = all?.filter((ev) => showPast || endOf(ev) >= now);
  // Event date is the default order: what's coming first (soonest on top), then what's over (most recent first).
  const list = useSortedList({ storageKey: "ntopia.sort.events", ...EVENT_SORT, items: shown });
  const events = list.pageItems;
  const del = useDeleteMutation(["events"], (id) =>
    orbit.DELETE("/api/events/{id}", { params: { path: { id } } }),
  );

  return (
    <>
      <PageHeader
        title="Events"
        crumbs={[{ label: "Home", to: "/" }, { label: "Events" }]}
        actions={
          <>
            <SortMenu value={list.sort} options={list.options} onChange={list.setSort} />
            <Button
              variant={showPast ? "secondary" : "outline"}
              size="sm"
              aria-pressed={showPast}
              onClick={() => { setShowPast(!showPast); list.setPage(1); }}
            >
              <History /> Past events
            </Button>
            {isAdmin && (
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
              <Field label="Starts"><DateTimeInput required value={f.startAt} onChange={(startAt) => setF((p) => ({ ...p, startAt }))} /></Field>
              <Field label="Ends"><DateTimeInput required value={f.endAt} onChange={(endAt) => setF((p) => ({ ...p, endAt }))} /></Field>
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
            )}
          </>
        }
      />
      <div className="space-y-2">
        {events?.length === 0 && <Empty>{all?.length ? "No upcoming events." : "No events scheduled."}</Empty>}
        {events?.map((ev) => (
          <FeedItemMenu
            key={ev.id}
            onOpen={() => void navigate({ to: "/events/$id", params: { id: ev.id } })}
            copy={{ text: ev.title, label: "Title" }}
            onDelete={isAdmin ? () => del.mutate(ev.id) : undefined}
          >
              <div className={endOf(ev) < now ? "opacity-60 transition-opacity hover:opacity-100" : undefined}>
                <FeedCard
                  to="/events/$id"
                  params={{ id: ev.id }}
                  title={ev.title}
                  author={ev.createdBy.fullName}
                  createdAt={ev.startAt}
                  content={ev.description}
                  leading={<DateChip iso={ev.startAt} muted={endOf(ev) < now} className="m-2 self-center" />}
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
              </div>
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={list.page} total={list.total} onPageChange={list.setPage} />
    </>
  );
}
