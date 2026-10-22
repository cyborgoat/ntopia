import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
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
import { CommentThread } from "@/components/comments";
import { FeedCard } from "@/components/feed-card";
import { DetailPage } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
import { ListPagination, PAGE_SIZE } from "@/components/list-pagination";
import { Empty, PageHeader } from "@/components/page-header";
import { PostComposer, type PostDraft } from "@/components/post-composer";
import { useAuth } from "@/lib/auth";
import { assetUrl, errorMessage, orbit } from "@/lib/orbit";

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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const feed = FEED[kind];
  const key = [kind];
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: [kind, "list", page], queryFn: () => feed.list(page), placeholderData: keepPreviousData });

  const del = useMutation({
    mutationFn: feed.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

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
          <ContextMenu key={p.id}>
            <ContextMenuTrigger className="block w-full">
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
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => void navigate({ to: feed.detailTo, params: { id: p.id } })}
              >
                <ExternalLink /> Open
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(p.title).then(() => toast.success("Title copied"))}>
                <Copy /> Copy title
              </ContextMenuItem>
              {isAdmin && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onClick={() => del.mutate(p.id)}>
                    <Trash2 /> Delete
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <ListPagination page={page} total={data?.total} onPageChange={setPage} />
    </>
  );
}

/** Full content of one news or blog post. */
export function FeedPostDetail({ kind, id }: { kind: Kind; id: string }) {
  const qc = useQueryClient();
  const feed = FEED[kind];
  const { data, isPending } = useQuery({ queryKey: [kind, id], queryFn: () => feed.get(id) });
  const del = useMutation({
    mutationFn: () => feed.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [kind] }),
  });

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
          {data.coverImageUrl && <img src={assetUrl(data.coverImageUrl)} alt="" className="h-56 w-full rounded-lg object-cover" />}
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <p className="text-xs text-muted-foreground">
            {data.author.fullName} · {new Date(data.createdAt).toLocaleString()} · {data.viewCount} {data.viewCount === 1 ? "view" : "views"}
          </p>
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
        const { error } = await FEED[kind].create(body);
        if (error) throw new Error(errorMessage(error));
        await qc.invalidateQueries({ queryKey: [kind] });
      }}
    />
  );
}
