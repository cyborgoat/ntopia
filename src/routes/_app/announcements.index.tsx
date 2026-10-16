import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
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
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";
import { errorMessage, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/announcements/")({
  component: () => (
    <RequireAuth>
      <Announcements />
    </RequireAuth>
  ),
});

function Announcements() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", description: "" });
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await orbit.GET("/announcements", { params: { query: { limit: 50 } } })).data,
  });
  const del = useMutation({
    mutationFn: (id: string) => orbit.DELETE("/announcements/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        crumbs={[{ label: "Home", to: "/" }, { label: "Announcements" }]}
        actions={
          isAdmin && (
            <FormDialog
              title="New announcement"
              triggerLabel="New"
              onSubmit={async () => {
                const { error } = await orbit.POST("/announcements", { body: f });
                if (error) throw new Error(errorMessage(error));
                setF({ title: "", description: "" });
                qc.invalidateQueries({ queryKey: ["announcements"] });
              }}
            >
              <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Description"><Textarea required rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            </FormDialog>
          )
        }
      />
      <div className="space-y-3">
        {data?.items.length === 0 && <Empty>No announcements yet.</Empty>}
        {data?.items.map((a) => (
          <ContextMenu key={a.id}>
            <ContextMenuTrigger className="block">
              <div className="relative">
                <Link
                  to="/announcements/$id"
                  params={{ id: a.id }}
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <h2 className={`font-medium ${isAdmin ? "pr-10" : ""}`}>{a.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{a.author.fullName} · {new Date(a.createdAt).toLocaleString()}</p>
                </Link>
                {isAdmin && (
                  <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={() => del.mutate(a.id)} aria-label="Delete">
                    <Trash2 />
                  </Button>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => void navigate({ to: "/announcements/$id", params: { id: a.id } })}>
                <ExternalLink /> Open
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(a.title).then(() => toast.success("Title copied"))}>
                <Copy /> Copy title
              </ContextMenuItem>
              {isAdmin && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onClick={() => del.mutate(a.id)}>
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
