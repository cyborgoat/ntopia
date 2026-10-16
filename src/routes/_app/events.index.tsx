import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Field, FormDialog } from "@/components/form-dialog";
import { ImageUploadButton } from "@/components/image-upload";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";
import { assetUrl, errorMessage, orbit } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/events/")({
  component: () => (
    <RequireAuth>
      <Events />
    </RequireAuth>
  ),
});

const blank = { title: "", description: "", startAt: "", endAt: "", location: "", coverImageUrl: "" };

function Events() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const { data } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await orbit.GET("/events", { params: { query: { limit: 50 } } })).data,
  });
  const del = useMutation({
    mutationFn: (id: string) => orbit.DELETE("/events/{id}", { params: { path: { id } } }),
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
                const { error } = await orbit.POST("/events", {
                  body: {
                    ...f,
                    startAt: new Date(f.startAt).toISOString(),
                    endAt: new Date(f.endAt).toISOString(),
                    coverImageUrl: f.coverImageUrl || undefined,
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
              <div className="flex items-center gap-3">
                <ImageUploadButton label="Cover image" onUploaded={(u) => setF((p) => ({ ...p, coverImageUrl: u }))} />
                {f.coverImageUrl && <span className="truncate text-xs text-muted-foreground">{f.coverImageUrl}</span>}
              </div>
            </FormDialog>
          )
        }
      />
      <div className="space-y-3">
        {data?.items.length === 0 && <Empty>No events scheduled.</Empty>}
        {data?.items.map((ev) => (
          <ContextMenu key={ev.id}>
            <ContextMenuTrigger className="block">
              <div className="relative">
                <Link
                  to="/events/$id"
                  params={{ id: ev.id }}
                  className="flex overflow-hidden rounded-lg border transition-colors hover:bg-muted/50"
                >
                  {ev.coverImageUrl && <img src={assetUrl(ev.coverImageUrl)} alt="" className="w-28 shrink-0 object-cover" />}
                  <div className="min-w-0 flex-1 p-4">
                    <h2 className={`truncate font-medium ${isAdmin ? "pr-10" : ""}`}>{ev.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(ev.startAt)}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{ev.location}</span></p>
                  </div>
                </Link>
                {isAdmin && (
                  <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={() => del.mutate(ev.id)} aria-label="Delete"><Trash2 /></Button>
                )}
              </div>
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
    </>
  );
}
