import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed-card";
import { FeedStats } from "@/components/feed-stats";
import { FeedItemMenu } from "@/components/feed-item-menu";
import { ListPagination } from "@/components/list-pagination";
import { Empty, PageHeader } from "@/components/page-header";
import { SortMenu } from "@/components/sort-menu";
import { useSortedList } from "@/hooks/use-sorted-list";
import { feedQueries } from "@/lib/feeds";
import { DISCUSSION_SORT } from "@/lib/sorting";

export const Route = createFileRoute("/_app/discussions/")({
  component: Discussions,
});

function threadUrl(id: string) {
  return `${window.location.origin}${window.location.pathname}#/discussions/${id}`;
}

function Discussions() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // The API cannot sort, so every matching thread is loaded and ordered here (newest first by default).
  const { data: all } = useQuery({ ...feedQueries.discussions(q), placeholderData: keepPreviousData });
  const list = useSortedList({ storageKey: "ntopia.sort.discussions", ...DISCUSSION_SORT, items: all });

  return (
    <>
      <PageHeader
        title="Discussions"
        crumbs={[{ label: "Home", to: "/" }, { label: "Discussions" }]}
        actions={
          <>
            <SortMenu value={list.sort} options={list.options} onChange={list.setSort} />
            <Button size="sm" render={<Link to="/discussions/new" />}>
              <Plus /> New thread
            </Button>
          </>
        }
      />
      <Input placeholder="Search threads…" value={q} onChange={(e) => { setQ(e.target.value); list.setPage(1); }} className="mb-4" />
      <div className="space-y-2">
        {list.total === 0 && <Empty>No threads yet. Start one!</Empty>}
        {list.pageItems?.map((p) => (
          <FeedItemMenu
            key={p.id}
            onOpen={() => void navigate({ to: "/discussions/$postId", params: { postId: p.id } })}
            openLabel="Open thread"
            copy={{ text: threadUrl(p.id), label: "Link" }}
          >
              <FeedCard
                to="/discussions/$postId"
                params={{ postId: p.id }}
                title={p.title}
                author={p.author.fullName}
                createdAt={p.createdAt}
                content={p.content}
                stats={<FeedStats score={p.score} comments={p.commentCount} views={p.viewCount} />}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={list.page} total={list.total} onPageChange={list.setPage} />
    </>
  );
}
