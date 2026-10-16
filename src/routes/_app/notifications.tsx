import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/notifications")({
  component: () => (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  ),
});

function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => (await orbit.GET("/api/notifications", { params: { query: { limit: 50 } } })).data,
  });
  const read = async (id: string) => {
    await orbit.POST("/api/notifications/{id}/read", { params: { path: { id } } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <>
      <PageHeader title="Notifications" />
      <div className="divide-y rounded-lg border">
        {data?.items.length === 0 && <Empty>You're all caught up.</Empty>}
        {data?.items.map((n) => (
          <ContextMenu key={n.id}>
            <ContextMenuTrigger className="block w-full">
              <button
                type="button"
                onClick={() => !n.read && void read(n.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50"
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-foreground"}`} />
                <div>
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-sm text-muted-foreground">{n.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem disabled={n.read} onClick={() => void read(n.id)}>
                <Check /> Mark as read
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </>
  );
}
