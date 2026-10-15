import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, CalendarDays, Home, Megaphone, MessagesSquare, Newspaper, Settings, Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";
import { useNotificationsSocket } from "@/lib/realtime";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/discussions", label: "Discussions", icon: MessagesSquare },
  { to: "/gadgets", label: "Gadgets", icon: Sparkles },
] as const;

export function AppShell() {
  const { user } = useAuth();
  useNotificationsSocket();
  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await orbit.GET("/notifications", { params: { query: { limit: 100 } } })).data,
  });
  const unread = data?.items.filter((n) => !n.read).length ?? 0;

  const item = "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const active = { className: "bg-accent font-medium text-foreground" };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30 p-3">
        <div className="px-2.5 py-2 text-sm font-semibold tracking-tight">NTOPIA</div>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={item} activeProps={active} activeOptions={{ exact: to === "/" }}>
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t pt-2">
          <Link to="/notifications" className={item} activeProps={active}>
            <Bell className="size-4" />
            Notifications
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-foreground px-1.5 text-xs text-background">{unread}</span>
            )}
          </Link>
          <Link to="/settings" className={item} activeProps={active}>
            <Settings className="size-4" />
            Settings
          </Link>
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs">{user?.fullName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-xs">
              <div className="truncate font-medium">{user?.fullName}</div>
              <div className="text-muted-foreground">{user?.role.toLowerCase()}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
