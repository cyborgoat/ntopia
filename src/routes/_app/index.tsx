import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomeDigest } from "@/components/home-digest";
import { PageHeader } from "@/components/page-header";
import { SignInNotice } from "@/components/sign-in-notice";
import { TodayPanel } from "@/features/todo/today-panel";
import { useNow } from "@/features/todo/use-now";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";
import { dateLocale, getLang, t, useT } from "@/i18n";

export const Route = createFileRoute("/_app/")({ component: Home });

function greeting(hour: number) {
  return hour < 5 ? t("home.greeting.evening") : hour < 12 ? t("home.greeting.morning") : hour < 18 ? t("home.greeting.afternoon") : t("home.greeting.evening");
}

function Home() {
  const tr = useT();
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
      <PageHeader title={tr("nav.home")} />
      <div className="space-y-10 pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting(now.getHours())}{first ? (getLang() === "zh" ? `，${first}` : `, ${first}`) : ""}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString(dateLocale(), { weekday: "long", month: "long", day: "numeric" })}
            {token && unreadCount > 0 && ` · ${tr("home.unreadSuffix", { n: unreadCount })}`}
          </p>
        </div>
        <TodayPanel />
        {token ? (
          <HomeDigest />
        ) : (
          <SignInNotice>{tr("home.signInNotice")}</SignInNotice>
        )}
      </div>
    </>
  );
}
