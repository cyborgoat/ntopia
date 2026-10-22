import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, ExternalLink, Mail, MailOpen, Trash2 } from "lucide-react";
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

type Status = "unread" | "read";

const TABS: { value: Status; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("unread");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["notifications", status, page],
    queryFn: async () =>
      (await orbit.GET("/api/notifications", { params: { query: { status, page, limit: PAGE_SIZE } } })).data,
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const setTab = (next: Status) => {
    setStatus(next);
    setPage(1);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => orbit.POST("/api/notifications/{id}/read", { params: { path: { id } } }),
    onSuccess: refresh,
  });
  const markUnread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await orbit.DELETE("/api/notifications/{id}/read", { params: { path: { id } } });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
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
      if (page > 1 && data?.items.length === 1) setPage(page - 1);
      void refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  type Item = NonNullable<typeof data>["items"][number];
  const open = (n: Item) => {
    if (status === "unread") markRead.mutate(n.id);
    const { link } = notificationTarget(n);
    if (link) void navigate(link as never);
  };

  const items = data?.items ?? [];
  const emptyCopy = status === "unread" ? "You're all caught up." : "No read notifications.";

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          status === "unread" ? (
            <Button size="sm" variant="outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck /> Mark all as read
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex gap-1 rounded-lg border p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
              status === t.value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">
        {data && items.length === 0 && (
          <div className="p-6"><Empty>{emptyCopy}</Empty></div>
        )}
        {items.map((n) => {
          const { icon: Icon, link } = notificationTarget(n);
          return (
            <ContextMenu key={n.id}>
              <ContextMenuTrigger className="block w-full">
                <div className="group/row relative">
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full items-start gap-3 p-4 pr-24 text-left transition-colors hover:bg-muted/50",
                      !link && status !== "unread" && "cursor-default",
                    )}
                  >
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", status === "unread" ? "bg-foreground" : "bg-transparent")} />
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm", status === "unread" && "font-medium")}>{n.title}</div>
                      <div className="text-sm text-muted-foreground">{n.body}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                        {n.audience === "DIRECTED" && <Badge variant="secondary">For you</Badge>}
                      </div>
                    </div>
                  </button>
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                    {status === "unread" && (
                      <Button variant="ghost" size="icon-sm" aria-label="Mark as read" onClick={() => markRead.mutate(n.id)}><Check /></Button>
                    )}
                    {status === "read" && (
                      <Button variant="ghost" size="icon-sm" aria-label="Mark as unread" onClick={() => markUnread.mutate(n.id)}><Mail /></Button>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => remove.mutate(n.id)}><Trash2 /></Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem disabled={!link} onClick={() => open(n)}><ExternalLink /> Open</ContextMenuItem>
                {status === "unread" && (
                  <ContextMenuItem onClick={() => markRead.mutate(n.id)}><Check /> Mark as read</ContextMenuItem>
                )}
                {status === "read" && (
                  <ContextMenuItem onClick={() => markUnread.mutate(n.id)}><MailOpen /> Mark as unread</ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => remove.mutate(n.id)}><Trash2 /> Dismiss</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
