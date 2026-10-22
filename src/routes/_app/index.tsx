import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomeDigest } from "@/components/home-digest";
import { PageHeader } from "@/components/page-header";
import { SignInNotice } from "@/components/sign-in-notice";
import { TodayPanel } from "@/features/todo/today-panel";
import { useNow } from "@/features/todo/use-now";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/")({ component: Home });

function greeting(hour: number) {
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Home() {
  const { token, user } = useAuth();
  const now = useNow();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () =>
      (await orbit.GET("/api/notifications", { params: { query: { status: "unread", limit: 1 } } })).data,
    enabled: !!token,
  });
  const unreadCount = unread.data?.total ?? 0;
  const first = user?.fullName.split(" ")[0];

  return (
    <>
      <PageHeader title="Home" />
      <div className="space-y-10 pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting(now.getHours())}{first ? `, ${first}` : ""}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {token && unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
        </div>
        <TodayPanel />
        {token ? (
          <HomeDigest />
        ) : (
          <SignInNotice>Local tools work offline. Sign in to see announcements, events, news and discussions from Team Orbit.</SignInNotice>
        )}
      </div>
    </>
  );
}
