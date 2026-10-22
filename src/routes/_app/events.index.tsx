import { DateChip } from "@/components/date-chip";
import { useState } from "react";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Lock, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeedCard } from "@/components/feed-card";
import { Field, FormDialog } from "@/components/form-dialog";
import { ImageUploadButton } from "@/components/image-upload";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { UserPicker, type PickedUser } from "@/components/user-picker";
import { useAuth } from "@/lib/auth";
import { errorMessage, orbit } from "@/lib/orbit";
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
  const del = useMutation({
    mutationFn: (id: string) => orbit.DELETE("/api/events/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

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
                const { error } = await orbit.POST("/api/events", {
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
                });
                if (error) throw new Error(errorMessage(error));
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
                <select
                  value={f.audience}
                  onChange={(e) => setF({ ...f, audience: e.target.value as Audience, recipients: e.target.value === "GLOBAL" ? [] : f.recipients })}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="GLOBAL">Everyone</option>
                  <option value="INVITE_ONLY">Invite only</option>
                </select>
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
          <ContextMenu key={ev.id}>
            <ContextMenuTrigger className="block w-full">
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
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => void navigate({ to: "/events/$id", params: { id: ev.id } })}>
                <ExternalLink /> Open
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(ev.title).then(() => toast.success("Title copied"))}>
                <Copy /> Copy title
              </ContextMenuItem>
              {isAdmin && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onClick={() => del.mutate(ev.id)}>
                    <Trash2 /> Delete
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
