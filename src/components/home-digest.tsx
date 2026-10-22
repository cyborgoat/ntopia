import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, MapPin, MessageSquare, ThumbsUp } from "lucide-react";
import { DateChip } from "@/components/date-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationTarget } from "@/lib/notification-link";
import { orbit } from "@/lib/orbit";
import { getItem, setItem } from "@/lib/storage";
import { excerpt, timeAgo } from "@/lib/utils";

export const HOME_SEEN_KEY = "homeLastSeen";

/** Timestamp of the previous visit, captured at mount; the new one is stored on leaving. */
function useLastSeen() {
  const prev = useRef<number>(getItem<number>(HOME_SEEN_KEY) ?? 0);
  useEffect(() => () => void setItem(HOME_SEEN_KEY, Date.now()), []);
  return prev.current;
}

function NewDot({ at, seen }: { at: string; seen: number }) {
  return new Date(at).getTime() > seen ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="New" /> : null;
}

type Q = { isPending: boolean; isError: boolean; data?: { items: unknown[] } };

function Card({ title, to, q, empty, children }: { title: string; to: string; q: Q; empty: string; children: React.ReactNode }) {
  const body = q.isPending ? (
    <div className="space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/3" /></div>
  ) : q.isError ? (
    <p className="text-muted-foreground">Couldn't load.</p>
  ) : q.data?.items.length ? (
    children
  ) : (
    <p className="text-muted-foreground">{empty}</p>
  );
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
      </div>
      <div className="space-y-1 text-sm">{body}</div>
    </section>
  );
}

const rowCls = "flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60";

function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", "unread", "digest"],
    queryFn: async () =>
      (await orbit.GET("/api/notifications", { params: { query: { status: "unread", page: 1, limit: 3 } } })).data,
  });
  const markAll = useMutation({
    mutationFn: () => orbit.POST("/api/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.items ?? [];
  const total = data?.total ?? 0;
  if (total === 0) return null;

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">{total} unread {total === 1 ? "notification" : "notifications"}</h2>
        <Button variant="ghost" size="xs" disabled={markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck /> Mark all read</Button>
      </div>
      <ul className="space-y-0.5 text-sm">
        {unread.map((n) => {
          const { icon: Icon, link } = notificationTarget(n);
          const inner = (
            <>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
            </>
          );
          return <li key={n.id}>{link ? <Link {...link} className={rowCls}>{inner}</Link> : <div className={rowCls}>{inner}</div>}</li>;
        })}
      </ul>
    </section>
  );
}

/** "What's new" from Team Orbit: unread notifications plus recent announcements, events, posts and discussions. */
export function HomeDigest() {
  const seen = useLastSeen();
  const ann = useQuery({ queryKey: ["announcements", "home"], queryFn: async () => (await orbit.GET("/api/announcements", { params: { query: { limit: 3 } } })).data });
  const ev = useQuery({
    queryKey: ["events", "home"],
    queryFn: async () => {
      const data = (await orbit.GET("/api/events", { params: { query: { limit: 20 } } })).data;
      if (!data) return data;
      const upcoming = data.items.filter((e) => new Date(e.endAt).getTime() >= Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt));
      return { ...data, items: upcoming.slice(0, 3) };
    },
  });
  const news = useQuery({ queryKey: ["news", "home"], queryFn: async () => (await orbit.GET("/api/news", { params: { query: { limit: 3 } } })).data });
  const blog = useQuery({ queryKey: ["blog", "home"], queryFn: async () => (await orbit.GET("/api/blog-posts", { params: { query: { limit: 3 } } })).data });
  const forum = useQuery({ queryKey: ["forum-posts", "home"], queryFn: async () => (await orbit.GET("/api/forum-posts", { params: { query: { limit: 3 } } })).data });

  const posts = [
    ...(news.data?.items ?? []).map((p) => ({ ...p, kind: "News" as const })),
    ...(blog.data?.items ?? []).map((p) => ({ ...p, kind: "Blog" as const })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const postsQ: Q = { isPending: news.isPending || blog.isPending, isError: news.isError && blog.isError, data: { items: posts } };

  return (
    <div className="space-y-6">
      <Notifications />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Announcements" to="/announcements" q={ann} empty="No announcements yet.">
          {ann.data?.items.map((a) => (
            <Link key={a.id} to="/announcements/$id" params={{ id: a.id }} className={rowCls}>
              <NewDot at={a.createdAt} seen={seen} />
              <span className="min-w-0 flex-1 truncate">{a.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.author.fullName.split(" ")[0]} · {timeAgo(a.createdAt)}</span>
            </Link>
          ))}
        </Card>
        <Card title="Upcoming events" to="/events" q={ev} empty="No upcoming events.">
          {ev.data?.items.map((e) => {
            const d = new Date(e.startAt);
            return (
              <Link key={e.id} to="/events/$id" params={{ id: e.id }} className={rowCls}>
                <DateChip iso={e.startAt} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.title}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    {e.location && <><MapPin className="size-3 shrink-0" />{e.location}</>}
                  </span>
                </span>
                <NewDot at={e.createdAt} seen={seen} />
              </Link>
            );
          })}
        </Card>
        <Card title="Latest posts" to="/news" q={postsQ} empty="No posts yet.">
          {posts.map((p) => (
            <Link key={`${p.kind}-${p.id}`} to={p.kind === "News" ? "/news/$id" : "/blog/$id"} params={{ id: p.id }} className={`${rowCls} items-start`}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <NewDot at={p.createdAt} seen={seen} />
                  <span className="truncate">{p.title}</span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">{excerpt(p.content, 80)}</span>
              </span>
              <Badge variant="secondary" className="shrink-0">{p.kind}</Badge>
            </Link>
          ))}
        </Card>
        <Card title="Discussions" to="/discussions" q={forum} empty="No discussions yet.">
          {forum.data?.items.map((p) => (
            <Link key={p.id} to="/discussions/$postId" params={{ postId: p.id }} className={rowCls}>
              <NewDot at={p.createdAt} seen={seen} />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5"><ThumbsUp className="size-3" />{p.score}</span>
                <span className="flex items-center gap-0.5"><MessageSquare className="size-3" />{p.commentCount}</span>
              </span>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
