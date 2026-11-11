import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentThread } from "@/components/comments";
import { FeedCard } from "@/components/feed-card";
import { FeedStats } from "@/components/feed-stats";
import { FeedItemMenu, useDeleteMutation } from "@/components/feed-item-menu";
import { Byline, CoverImage, DetailPage, DetailTitle } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
import { ListPagination } from "@/components/list-pagination";
import { SortMenu } from "@/components/sort-menu";
import { useSortedList } from "@/hooks/use-sorted-list";
import { Empty, PageHeader } from "@/components/page-header";
import { PostComposer, type PostDraft } from "@/components/post-composer";
import { useAuth } from "@/lib/auth";
import { feedQueries } from "@/lib/feeds";
import { assetUrl, orbit, unwrap } from "@/lib/orbit";
import { NEWS_SORT } from "@/lib/sorting";
import { useT } from "@/i18n";

type Kind = "/news" | "/blog-posts";

/** Everything that differs between the two feeds: route targets and the typed API calls. */
const FEED = {
  "/news": {
    section: { label: "nav.news", to: "/news" },
    newTo: "/news/new",
    detailTo: "/news/$id",
    all: feedQueries.news,
    sortKey: "ntopia.sort.news",
    get: async (id: string) => (await orbit.GET("/api/news/{id}", { params: { path: { id } } })).data ?? null,
    remove: (id: string) => orbit.DELETE("/api/news/{id}", { params: { path: { id } } }),
    create: (body: PostDraft) => orbit.POST("/api/news", { body }),
  },
  "/blog-posts": {
    section: { label: "nav.blog", to: "/blog" },
    newTo: "/blog/new",
    detailTo: "/blog/$id",
    all: feedQueries.blog,
    sortKey: "ntopia.sort.blog",
    get: async (id: string) => (await orbit.GET("/api/blog-posts/{id}", { params: { path: { id } } })).data ?? null,
    remove: (id: string) => orbit.DELETE("/api/blog-posts/{id}", { params: { path: { id } } }),
    create: (body: PostDraft) => orbit.POST("/api/blog-posts", { body }),
  },
} as const;

/** Blog is open to every member; news is admin-only. */
const canPublish = (kind: Kind, isAdmin: boolean) => kind === "/blog-posts" || isAdmin;

/** News and blog posts share one shape, so they share one page. */
export function MarkdownFeed({ kind }: { kind: Kind }) {
  const tr = useT();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const feed = FEED[kind];
  const title = tr(feed.section.label);
  // The API cannot sort, so the whole list is loaded and ordered here (newest publish date first by default).
  const { data: all } = useQuery(feed.all);
  const list = useSortedList({ storageKey: feed.sortKey, ...NEWS_SORT, items: all });

  const del = useDeleteMutation([kind], feed.remove);

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: tr("nav.home"), to: "/" }, { label: title }]}
        actions={
          <>
            <SortMenu value={list.sort} options={list.options} onChange={list.setSort} />
            {canPublish(kind, isAdmin) && (
              <Button size="sm" render={<Link to={feed.newTo} />}>
                <Plus /> {tr("common.new")}
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-2">
        {list.total === 0 && <Empty>{tr("feed.nothingYet")}</Empty>}
        {list.pageItems?.map((p) => (
          <FeedItemMenu
            key={p.id}
            onOpen={() => void navigate({ to: feed.detailTo, params: { id: p.id } })}
            copy={{ text: p.title, label: tr("feed.title") }}
            onDelete={isAdmin ? () => del.mutate(p.id) : undefined}
          >
              <FeedCard
                to={feed.detailTo}
                params={{ id: p.id }}
                title={p.title}
                author={p.author.fullName}
                createdAt={p.createdAt}
                content={p.content}
                stats={<FeedStats views={p.viewCount} />}
                leading={p.coverImageUrl ? <img src={assetUrl(p.coverImageUrl)} alt="" className="w-24 shrink-0 object-cover" /> : undefined}
                footer={p.tags.length > 0 ? (
                  <div className="flex gap-1 overflow-hidden">{p.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                ) : undefined}
                action={isAdmin ? (
                  <Button variant="ghost" size="icon-xs" onClick={() => del.mutate(p.id)} aria-label={tr("common.delete")}><Trash2 /></Button>
                ) : undefined}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={list.page} total={list.total} onPageChange={list.setPage} />
    </>
  );
}

/** Full content of one news or blog post. */
export function FeedPostDetail({ kind, id }: { kind: Kind; id: string }) {
  const feed = FEED[kind];
  const { data, isPending } = useQuery({ queryKey: [kind, id], queryFn: () => feed.get(id) });
  const del = useDeleteMutation<void>([kind], () => feed.remove(id));

  return (
    <DetailPage
      section={FEED[kind].section}
      itemTitle={data?.title}
      loading={isPending}
      notFound={!data}
      onDelete={() => del.mutateAsync()}
    >
      {data && (
        <>
          <CoverImage src={data.coverImageUrl} />
          <DetailTitle>{data.title}</DetailTitle>
          <Byline author={data.author.fullName} createdAt={data.createdAt} views={data.viewCount} />
          <Markdown>{data.content}</Markdown>
          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{data.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
          )}
          <CommentThread resourceType={kind === "/news" ? "news" : "blog"} resourceId={id} />
        </>
      )}
    </DetailPage>
  );
}

/** Full-page composer for a new news (admins only) or blog (any member) post. */
export function NewFeedPost({ kind }: { kind: Kind }) {
  const tr = useT();
  const title = tr(FEED[kind].section.label);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  if (!canPublish(kind, isAdmin)) return <Empty>{tr("feed.only", { section: title })}</Empty>;
  return (
    <PostComposer
      pageTitle={tr("feed.newPost", { section: title })}
      backTo={kind === "/news" ? "/news" : "/blog"}
      onPublish={async (body) => {
        await unwrap(FEED[kind].create(body));
        await qc.invalidateQueries({ queryKey: [kind] });
      }}
    />
  );
}
