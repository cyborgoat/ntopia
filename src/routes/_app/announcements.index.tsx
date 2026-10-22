import { useState } from "react";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeedCard } from "@/components/feed-card";
import { FeedItemMenu, useDeleteMutation } from "@/components/feed-item-menu";
import { Field, FormDialog } from "@/components/form-dialog";
import { Empty, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { orbit, unwrap } from "@/lib/orbit";

export const Route = createFileRoute("/_app/announcements/")({
  component: Announcements,
});

function Announcements() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", description: "" });
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["announcements", page],
    queryFn: async () => (await orbit.GET("/api/announcements", { params: { query: { page, limit: PAGE_SIZE } } })).data,
    placeholderData: keepPreviousData,
  });
  const del = useDeleteMutation(["announcements"], (id) =>
    orbit.DELETE("/api/announcements/{id}", { params: { path: { id } } }),
  );

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
                await unwrap(orbit.POST("/api/announcements", { body: f }));
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
      <div className="space-y-2">
        {data?.items.length === 0 && <Empty>No announcements yet.</Empty>}
        {data?.items.map((a) => (
          <FeedItemMenu
            key={a.id}
            onOpen={() => void navigate({ to: "/announcements/$id", params: { id: a.id } })}
            copy={{ text: a.title, label: "Title" }}
            onDelete={isAdmin ? () => del.mutate(a.id) : undefined}
          >
              <FeedCard
                to="/announcements/$id"
                params={{ id: a.id }}
                title={a.title}
                author={a.author.fullName}
                createdAt={a.createdAt}
                content={a.description}
                action={isAdmin ? (
                  <Button variant="ghost" size="icon-xs" onClick={() => del.mutate(a.id)} aria-label="Delete">
                    <Trash2 />
                  </Button>
                ) : undefined}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
