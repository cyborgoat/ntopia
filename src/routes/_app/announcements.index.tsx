import { useState } from "react";
import { ListPagination } from "@/components/list-pagination";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeedCard } from "@/components/feed-card";
import { FeedItemMenu, useDeleteMutation } from "@/components/feed-item-menu";
import { Field, FormDialog } from "@/components/form-dialog";
import { Empty, PageHeader } from "@/components/page-header";
import { SortMenu } from "@/components/sort-menu";
import { useSortedList } from "@/hooks/use-sorted-list";
import { feedQueries } from "@/lib/feeds";
import { ANNOUNCEMENT_SORT } from "@/lib/sorting";
import { useAuth } from "@/lib/auth";
import { orbit, unwrap } from "@/lib/orbit";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_app/announcements/")({
  component: Announcements,
});

function Announcements() {
  const tr = useT();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", description: "" });
  // The API cannot sort, so the whole list is loaded and ordered here (newest first by default).
  const { data: all } = useQuery(feedQueries.announcements);
  const list = useSortedList({ storageKey: "ntopia.sort.announcements", ...ANNOUNCEMENT_SORT, items: all });
  const del = useDeleteMutation(["announcements"], (id) =>
    orbit.DELETE("/api/announcements/{id}", { params: { path: { id } } }),
  );

  return (
    <>
      <PageHeader
        title={tr("nav.announcements")}
        crumbs={[{ label: tr("nav.home"), to: "/" }, { label: tr("nav.announcements") }]}
        actions={
          <>
          <SortMenu value={list.sort} options={list.options} onChange={list.setSort} />
          {isAdmin && (
            <FormDialog
              title={tr("ann.new")}
              triggerLabel={tr("common.new")}
              onSubmit={async () => {
                await unwrap(orbit.POST("/api/announcements", { body: f }));
                setF({ title: "", description: "" });
                qc.invalidateQueries({ queryKey: ["announcements"] });
              }}
            >
              <Field label={tr("ann.titleField")}><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label={tr("ann.description")}><Textarea required rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            </FormDialog>
          )}
          </>
        }
      />
      <div className="space-y-2">
        {list.total === 0 && <Empty>{tr("ann.empty")}</Empty>}
        {list.pageItems?.map((a) => (
          <FeedItemMenu
            key={a.id}
            onOpen={() => void navigate({ to: "/announcements/$id", params: { id: a.id } })}
            copy={{ text: a.title, label: tr("feed.title") }}
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
                  <Button variant="ghost" size="icon-xs" onClick={() => del.mutate(a.id)} aria-label={tr("common.delete")}>
                    <Trash2 />
                  </Button>
                ) : undefined}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={list.page} total={list.total} onPageChange={list.setPage} />
    </>
  );
}
