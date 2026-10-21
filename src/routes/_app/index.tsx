import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { SignInNotice } from "@/components/sign-in-notice";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/")({ component: Home });

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function GuestHome() {
  return (
    <>
      <PageHeader title="Home" />
      <SignInNotice>Local tools work offline. Sign in to use Team Orbit: announcements, events, news and discussions.</SignInNotice>
    </>
  );
}

function SignedInHome() {
  const ann = useQuery({ queryKey: ["announcements", "home"], queryFn: async () => (await orbit.GET("/api/announcements", { params: { query: { limit: 3 } } })).data });
  const ev = useQuery({ queryKey: ["events", "home"], queryFn: async () => (await orbit.GET("/api/events", { params: { query: { limit: 3 } } })).data });
  const news = useQuery({ queryKey: ["news", "home"], queryFn: async () => (await orbit.GET("/api/news", { params: { query: { limit: 3 } } })).data });
  const forum = useQuery({ queryKey: ["forum-posts", "home"], queryFn: async () => (await orbit.GET("/api/forum-posts", { params: { query: { limit: 3 } } })).data });
  const muted = <span className="text-muted-foreground">Nothing yet.</span>;

  return (
    <>
      <PageHeader title="Home" />
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Announcements" to="/announcements">
          {ann.data?.items.length ? ann.data.items.map((a) => <div key={a.id} className="truncate">{a.title}</div>) : muted}
        </Section>
        <Section title="Upcoming events" to="/events">
          {ev.data?.items.length ? ev.data.items.map((e) => (
            <div key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.title}</span><span className="shrink-0 text-muted-foreground">{new Date(e.startAt).toLocaleDateString()}</span></div>
          )) : muted}
        </Section>
        <Section title="News" to="/news">
          {news.data?.items.length ? news.data.items.map((n) => <div key={n.id} className="truncate">{n.title}</div>) : muted}
        </Section>
        <Section title="Discussions" to="/discussions">
          {forum.data?.items.length ? forum.data.items.map((p) => <div key={p.id} className="truncate">{p.title}</div>) : muted}
        </Section>
      </div>
    </>
  );
}

function Home() {
  const { token } = useAuth();
  return token ? <SignedInHome /> : <GuestHome />;
}
