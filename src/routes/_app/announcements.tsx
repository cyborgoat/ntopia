import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";
import { errorMessage, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/announcements")({
  component: () => (
    <RequireAuth>
      <Announcements />
    </RequireAuth>
  ),
});

function Announcements() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
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
        description="Short notices for the whole team."
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
          <article key={a.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{a.title}</h2>
              {isAdmin && (
                <Button variant="ghost" size="icon-sm" onClick={() => del.mutate(a.id)} aria-label="Delete">
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">{a.author.fullName} · {new Date(a.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </>
  );
}
