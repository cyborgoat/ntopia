import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentThread } from "@/components/comments";
import { FeedCard } from "@/components/feed-card";
import { FeedItemMenu, useDeleteMutation } from "@/components/feed-item-menu";
import { Byline, CoverImage, DetailPage, DetailTitle } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { Empty, PageHeader } from "@/components/page-header";
import { PostComposer, type PostDraft } from "@/components/post-composer";
import { useAuth } from "@/lib/auth";
import { assetUrl, orbit, unwrap } from "@/lib/orbit";

type Kind = "/news" | "/blog-posts";

/** Everything that differs between the two feeds: route targets and the typed API calls. */
const FEED = {
  "/news": {
    section: { label: "News", to: "/news" },
    newTo: "/news/new",
    detailTo: "/news/$id",
    list: async (page: number) => (await orbit.GET("/api/news", { params: { query: { page, limit: PAGE_SIZE } } })).data,
    get: async (id: string) => (await orbit.GET("/api/news/{id}", { params: { path: { id } } })).data ?? null,
    remove: (id: string) => orbit.DELETE("/api/news/{id}", { params: { path: { id } } }),
    create: (body: PostDraft) => orbit.POST("/api/news", { body }),
  },
  "/blog-posts": {
    section: { label: "Blog", to: "/blog" },
    newTo: "/blog/new",
    detailTo: "/blog/$id",
    list: async (page: number) => (await orbit.GET("/api/blog-posts", { params: { query: { page, limit: PAGE_SIZE } } })).data,
    get: async (id: string) => (await orbit.GET("/api/blog-posts/{id}", { params: { path: { id } } })).data ?? null,
    remove: (id: string) => orbit.DELETE("/api/blog-posts/{id}", { params: { path: { id } } }),
    create: (body: PostDraft) => orbit.POST("/api/blog-posts", { body }),
  },
} as const;

/** Blog is open to every member; news is admin-only. */
const canPublish = (kind: Kind, isAdmin: boolean) => kind === "/blog-posts" || isAdmin;

/** News and blog posts share one shape, so they share one page. */
export function MarkdownFeed({ kind, title }: { kind: Kind; title: string }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const feed = FEED[kind];
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: [kind, "list", page], queryFn: () => feed.list(page), placeholderData: keepPreviousData });

  const del = useDeleteMutation([kind], feed.remove);

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Home", to: "/" }, { label: title }]}
        actions={
          canPublish(kind, isAdmin) && (
            <Button size="sm" render={<Link to={feed.newTo} />}>
              <Plus /> New
            </Button>
          )
        }
      />
      <div className="space-y-2">
        {data?.items.length === 0 && <Empty>Nothing here yet.</Empty>}
        {data?.items.map((p) => (
          <FeedItemMenu
            key={p.id}
            onOpen={() => void navigate({ to: feed.detailTo, params: { id: p.id } })}
            copy={{ text: p.title, label: "Title" }}
            onDelete={isAdmin ? () => del.mutate(p.id) : undefined}
          >
              <FeedCard
                to={feed.detailTo}
                params={{ id: p.id }}
                title={p.title}
                author={p.author.fullName}
                createdAt={p.createdAt}
                content={p.content}
                leading={p.coverImageUrl ? <img src={assetUrl(p.coverImageUrl)} alt="" className="w-24 shrink-0 object-cover" /> : undefined}
                footer={p.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">{p.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                ) : undefined}
                action={isAdmin ? (
                  <Button variant="ghost" size="icon-xs" onClick={() => del.mutate(p.id)} aria-label="Delete"><Trash2 /></Button>
                ) : undefined}
              />
          </FeedItemMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
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
export function NewFeedPost({ kind, title }: { kind: Kind; title: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  if (!canPublish(kind, isAdmin)) return <Empty>Only admins can publish {title.toLowerCase()} posts.</Empty>;
  return (
    <PostComposer
      pageTitle={`New ${title.toLowerCase()} post`}
      backTo={kind === "/news" ? "/news" : "/blog"}
      onPublish={async (body) => {
        await unwrap(FEED[kind].create(body));
        await qc.invalidateQueries({ queryKey: [kind] });
      }}
    />
  );
}
