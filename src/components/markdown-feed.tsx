import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { DetailPage } from "@/components/detail-page";
import { Markdown } from "@/components/markdown";
import { Empty, PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { useAuth } from "@/lib/auth";
import { assetUrl, errorMessage, orbit } from "@/lib/orbit";
import { excerpt } from "@/lib/utils";

type Kind = "/news" | "/blog-posts";

const SECTION = {
  "/news": { label: "News", to: "/news" },
  "/blog-posts": { label: "Blog", to: "/blog" },
} as const;

/** News and blog posts share one shape, so they share one page. */
export function MarkdownFeed({ kind, title, description }: { kind: Kind; title: string; description: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = [kind];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () =>
      kind === "/news"
        ? (await orbit.GET("/news", { params: { query: { limit: 50 } } })).data
        : (await orbit.GET("/blog-posts", { params: { query: { limit: 50 } } })).data,
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      kind === "/news"
        ? orbit.DELETE("/news/{id}", { params: { path: { id } } })
        : orbit.DELETE("/blog-posts/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        crumbs={[{ label: "Home", to: "/" }, { label: title }]}
        actions={
          isAdmin && (
            <Button size="sm" render={<Link to={kind === "/news" ? "/news/new" : "/blog/new"} />}>
              <Plus /> New
            </Button>
          )
        }
      />
      <div className="space-y-4">
        {data?.items.length === 0 && <Empty>Nothing here yet.</Empty>}
        {data?.items.map((p) => (
          <ContextMenu key={p.id}>
            <ContextMenuTrigger className="block">
              <div className="relative">
                <Link
                  to={kind === "/news" ? "/news/$id" : "/blog/$id"}
                  params={{ id: p.id }}
                  className="flex overflow-hidden rounded-lg border transition-colors hover:bg-muted/50"
                >
                  {p.coverImageUrl && <img src={assetUrl(p.coverImageUrl)} alt="" className="w-32 shrink-0 object-cover" />}
                  <div className="min-w-0 flex-1 space-y-1.5 p-4">
                    <h2 className={`truncate font-semibold tracking-tight ${isAdmin ? "pr-10" : ""}`}>{p.title}</h2>
                    <p className="text-xs text-muted-foreground">{p.author.fullName} · {new Date(p.createdAt).toLocaleDateString()}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt(p.content)}</p>
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                    )}
                  </div>
                </Link>
                {isAdmin && (
                  <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={() => del.mutate(p.id)} aria-label="Delete"><Trash2 /></Button>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => void navigate({ to: kind === "/news" ? "/news/$id" : "/blog/$id", params: { id: p.id } })}
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
    </>
  );
}

/** Full content of one news or blog post. */
export function FeedPostDetail({ kind, id }: { kind: Kind; id: string }) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: [kind, id],
    queryFn: async () =>
      (kind === "/news"
        ? await orbit.GET("/news/{id}", { params: { path: { id } } })
        : await orbit.GET("/blog-posts/{id}", { params: { path: { id } } })
      ).data ?? null,
  });
  const del = useMutation({
    mutationFn: () =>
      kind === "/news"
        ? orbit.DELETE("/news/{id}", { params: { path: { id } } })
        : orbit.DELETE("/blog-posts/{id}", { params: { path: { id } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [kind] }),
  });

  return (
    <DetailPage
      section={SECTION[kind]}
      itemTitle={data?.title}
      loading={isPending}
      notFound={!data}
      onDelete={() => del.mutateAsync()}
    >
      {data && (
        <>
          {data.coverImageUrl && <img src={assetUrl(data.coverImageUrl)} alt="" className="h-56 w-full rounded-lg object-cover" />}
          <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
          <p className="text-xs text-muted-foreground">{data.author.fullName} · {new Date(data.createdAt).toLocaleString()}</p>
          <Markdown>{data.content}</Markdown>
          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{data.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
          )}
        </>
      )}
    </DetailPage>
  );
}

/** Full-page composer for a new news or blog post (admins only). */
export function NewFeedPost({ kind, title }: { kind: Kind; title: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  if (!isAdmin) return <Empty>Only admins can publish {title.toLowerCase()} posts.</Empty>;
  return (
    <PostComposer
      pageTitle={`New ${title.toLowerCase()} post`}
      backTo={kind === "/news" ? "/news" : "/blog"}
      onPublish={async (body) => {
        const { error } = kind === "/news" ? await orbit.POST("/news", { body }) : await orbit.POST("/blog-posts", { body });
        if (error) throw new Error(errorMessage(error));
        await qc.invalidateQueries({ queryKey: [kind] });
      }}
    />
  );
}
