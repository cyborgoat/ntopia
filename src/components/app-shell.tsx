import { Fragment, useEffect, useRef } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, CalendarDays, Home, LogIn, Megaphone, MessagesSquare, Newspaper, Settings, Toolbox,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageChromeProvider, usePageChrome } from "@/components/page-chrome";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";
import { useNotificationsSocket } from "@/lib/realtime";

const localNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/gadgets", label: "Gadgets", icon: Toolbox },
] as const;

const orbitNav = [
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/discussions", label: "Discussions", icon: MessagesSquare },
] as const;

const FULL_BLEED = ["/gadgets/email", "/blog/new", "/news/new", "/discussions/new"];
const MARK = "text-[1.65rem] font-semibold tracking-[-0.06em]";

function NavItems({
  items,
  pathname,
}: {
  items: readonly { to: string; label: string; icon: typeof Home }[];
  pathname: string;
}) {
  return (
    <SidebarMenu>
      {items.map(({ to, label, icon: Icon }) => {
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
  );
}

function BrandToggle() {
  const { toggleSidebar, state } = useSidebar();
  return (
    <SidebarMenuButton
      size="lg"
      onClick={toggleSidebar}
      tooltip={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
      className="text-sidebar-foreground hover:text-sidebar-foreground"
    >
      <span className="hidden size-8 items-center justify-center text-lg font-semibold tracking-tight group-data-[collapsible=icon]:flex">
        N
      </span>
      <span className={`${MARK} group-data-[collapsible=icon]:hidden`}>
        NTOPIA
      </span>
    </SidebarMenuButton>
  );
}

// Collapse the sidebar when entering a gadget (/gadgets/<name>) from elsewhere.
// Only the transition triggers it, so a manual toggle sticks while in gadgets.
function AutoCollapseForGadgets({ pathname }: { pathname: string }) {
  const { setOpen } = useSidebar();
  const inGadget = /^\/gadgets\/[^/]+/.test(pathname);
  const wasInGadget = useRef(false);
  useEffect(() => {
    if (inGadget && !wasInGadget.current) setOpen(false);
    wasInGadget.current = inGadget;
  }, [inGadget, setOpen]);
  return null;
}

function InsetHeader({ fullBleed }: { fullBleed: boolean }) {
  const { title, crumbs } = usePageChrome();
  const label = title ?? (fullBleed ? "Email composer" : null);

  return (
    <header className="flex shrink-0 flex-col gap-2 pt-2">
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb className="px-4">
          <BreadcrumbList>
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {c.to && i < crumbs.length - 1 ? (
                    <Link to={c.to} className="truncate hover:text-foreground">{c.label}</Link>
                  ) : (
                    <BreadcrumbPage>{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex h-12 items-center px-4">
        {label && (
          <h1 className={`min-w-0 truncate ${MARK}`}>{label}</h1>
        )}
      </div>
      <div className="h-px w-full bg-border" />
    </header>
  );
}

export function AppShell() {
  const { user, token } = useAuth();
  useNotificationsSocket();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await orbit.GET("/notifications", { params: { query: { limit: 100 } } })).data,
    enabled: !!token,
  });
  const unread = data?.items.filter((n) => !n.read).length ?? 0;

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AutoCollapseForGadgets pathname={pathname} />
        <Sidebar collapsible="icon">
          <SidebarHeader className="gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <BrandToggle />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <NavItems items={localNav} pathname={pathname} />
              </SidebarGroupContent>
            </SidebarGroup>

            {token && (
              <SidebarGroup>
                <SidebarGroupLabel>Team Orbit</SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavItems items={orbitNav} pathname={pathname} />
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <SidebarMenu>
              {token && (
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
              )}
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
              {token ? (
                user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg" className="pointer-events-none" tooltip={user.fullName}>
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{user.fullName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                        <span className="truncate font-medium">{user.fullName}</span>
                        <span className="truncate text-muted-foreground">{user.role.toLowerCase()}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/login" />} tooltip="Sign in">
                    <LogIn />
                    <span>Sign in</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <PageChromeProvider>
          <SidebarInset className="min-h-0 overflow-hidden">
            <InsetHeader fullBleed={fullBleed} />
            <div
              className={
                fullBleed
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                  : "flex-1 overflow-auto"
              }
            >
              <div className={fullBleed ? "h-full min-h-0" : "mx-auto max-w-4xl px-8 pt-4 pb-8"}>
                <Outlet />
              </div>
            </div>
          </SidebarInset>
        </PageChromeProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
