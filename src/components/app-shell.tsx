import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, CalendarDays, Home, Megaphone, MessagesSquare, Newspaper, Settings, Toolbox,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  { to: "/gadgets", label: "Gadgets", icon: Toolbox },
] as const;

const FULL_BLEED = ["/gadgets/email"];

export function AppShell() {
  const { user } = useAuth();
  useNotificationsSocket();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await orbit.GET("/notifications", { params: { query: { limit: 100 } } })).data,
  });
  const unread = data?.items.filter((n) => !n.read).length ?? 0;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" render={<Link to="/" />} tooltip="NTOPIA">
                  <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                    N
                  </span>
                  <span className="font-semibold tracking-tight">NTOPIA</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map(({ to, label, icon: Icon }) => {
                    const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
                    return (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton
                          render={<Link to={to} />}
                          isActive={active}
                          tooltip={label}
                        >
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/notifications" />}
                  isActive={pathname.startsWith("/notifications")}
                  tooltip="Notifications"
                >
                  <Bell />
                  <span>Notifications</span>
                </SidebarMenuButton>
                {unread > 0 && <SidebarMenuBadge>{unread}</SidebarMenuBadge>}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/settings" />}
                  isActive={pathname.startsWith("/settings")}
                  tooltip="Settings"
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="pointer-events-none" tooltip={user?.fullName}>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{user?.fullName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{user?.fullName}</span>
                    <span className="truncate text-muted-foreground">{user?.role.toLowerCase()}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-h-svh overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            {fullBleed && (
              <span className="text-sm text-muted-foreground">Email composer</span>
            )}
          </header>
          <div
            className={
              fullBleed
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "flex-1 overflow-auto"
            }
          >
            <div className={fullBleed ? "h-full min-h-0" : "mx-auto max-w-4xl p-8"}>
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
