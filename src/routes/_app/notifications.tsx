import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
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
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { notificationTarget } from "@/lib/notification-link";
import { errorMessage, orbit } from "@/lib/orbit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notifications")({
  component: () => (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  ),
});

function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["notifications", "all", page],
    queryFn: async () => (await orbit.GET("/api/notifications", { params: { query: { page, limit: PAGE_SIZE } } })).data,
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const markRead = useMutation({
    mutationFn: (id: string) => orbit.POST("/api/notifications/{id}/read", { params: { path: { id } } }),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await orbit.POST("/api/notifications/read-all");
      if (error) throw new Error(errorMessage(error));
      return data;
    },
    onSuccess: (d) => { toast.success(d?.marked ? `Marked ${d.marked} as read` : "Nothing to mark"); void refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await orbit.DELETE("/api/notifications/{id}", { params: { path: { id } } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      // Deleting the last row of the last page would leave an empty page behind.
      if (page > 1 && data?.items.length === 1) setPage(page - 1);
      void refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  type Item = NonNullable<typeof data>["items"][number];
  const open = (n: Item) => {
    if (!n.read) markRead.mutate(n.id);
    const { link } = notificationTarget(n);
    if (link) void navigate(link as never);
  };

  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);

  const row = (n: Item) => {
    const { icon: Icon, link } = notificationTarget(n);
    return (
      <ContextMenu key={n.id}>
        <ContextMenuTrigger className="block w-full">
          <div className="group/row relative">
            <button
              type="button"
              onClick={() => open(n)}
              className={cn("flex w-full items-start gap-3 p-4 pr-24 text-left transition-colors hover:bg-muted/50", !link && n.read && "cursor-default")}
            >
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-foreground")} />
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", !n.read && "font-medium")}>{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                  {n.audience === "DIRECTED" && <Badge variant="secondary">For you</Badge>}
                </div>
              </div>
            </button>
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
              {!n.read && (
                <Button variant="ghost" size="icon-sm" aria-label="Mark as read" onClick={() => markRead.mutate(n.id)}><Check /></Button>
              )}
              <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove.mutate(n.id)}><Trash2 /></Button>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={!link} onClick={() => open(n)}><ExternalLink /> Open</ContextMenuItem>
          <ContextMenuItem disabled={n.read} onClick={() => markRead.mutate(n.id)}><Check /> Mark as read</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => remove.mutate(n.id)}><Trash2 /> Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const group = (label: string, list: Item[]) =>
    list.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label} · {list.length}</h2>
        <div className="divide-y overflow-hidden rounded-lg border">{list.map(row)}</div>
      </section>
    );

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button size="sm" variant="outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <div className="space-y-6">
        {data && items.length === 0 && <Empty>You're all caught up.</Empty>}
        {data && items.length > 0 && unread.length === 0 && page === 1 && <Empty>No unread notifications.</Empty>}
        {group("Unread", unread)}
        {group("Read", read)}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
