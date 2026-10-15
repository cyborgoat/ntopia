import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
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
import { Markdown } from "@/components/markdown";
import { Empty, PageHeader } from "@/components/page-header";
import { PostComposer } from "@/components/post-composer";
import { useAuth } from "@/lib/auth";
import { assetUrl, errorMessage, orbit } from "@/lib/orbit";

type Kind = "/news" | "/blog-posts";

/** News and blog posts share one shape, so they share one page. */
export function MarkdownFeed({ kind, title, description }: { kind: Kind; title: string; description: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
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
              <article className="overflow-hidden rounded-lg border">
                {p.coverImageUrl && <img src={assetUrl(p.coverImageUrl)} alt="" className="h-40 w-full object-cover" />}
                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{p.title}</h2>
                    {isAdmin && (
                      <Button variant="ghost" size="icon-sm" onClick={() => del.mutate(p.id)} aria-label="Delete"><Trash2 /></Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.author.fullName} · {new Date(p.createdAt).toLocaleDateString()}</p>
                  <Markdown>{p.content}</Markdown>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                  )}
                </div>
              </article>
            </ContextMenuTrigger>
            <ContextMenuContent>
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
