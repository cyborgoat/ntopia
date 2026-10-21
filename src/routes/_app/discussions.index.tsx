import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowBigUp, Copy, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed-card";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/")({
  component: () => (
    <RequireAuth>
      <Discussions />
    </RequireAuth>
  ),
});

function threadUrl(id: string) {
  return `${window.location.origin}${window.location.pathname}#/discussions/${id}`;
}

function Discussions() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["forum-posts", q, page],
    queryFn: async () => (await orbit.GET("/api/forum-posts", { params: { query: { page, limit: PAGE_SIZE, q: q || undefined } } })).data,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Discussions"
        crumbs={[{ label: "Home", to: "/" }, { label: "Discussions" }]}
        actions={
          <Button size="sm" render={<Link to="/discussions/new" />}>
            <Plus /> New thread
          </Button>
        }
      />
      <Input placeholder="Search threads…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="mb-4" />
      <div className="space-y-2">
        {data?.items.length === 0 && <Empty>No threads yet. Start one!</Empty>}
        {data?.items.map((p) => (
          <ContextMenu key={p.id}>
            <ContextMenuTrigger className="block w-full">
              <FeedCard
                to="/discussions/$postId"
                params={{ postId: p.id }}
                title={p.title}
                author={p.author.fullName}
                createdAt={p.createdAt}
                content={p.content}
                aside={
                  <>
                    <span className="flex items-center gap-1"><ArrowBigUp className="size-4" />{p.score}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="size-4" />{p.commentCount}</span>
                  </>
                }
              />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => void navigate({ to: "/discussions/$postId", params: { postId: p.id } })}>
                <ExternalLink /> Open thread
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(threadUrl(p.id)).then(() => toast.success("Link copied"))}>
                <Copy /> Copy link
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}
