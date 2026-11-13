import { Fragment, type MouseEvent, useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, CalendarDays, ChevronRight, ChevronsUpDown, Home, ListTodo, LogIn, LogOut, Megaphone, MessagesSquare, Newspaper, NotebookText, Server, Settings, Toolbox, UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { gadgets } from "@/gadgets/registry";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageChromeProvider, usePageChrome } from "@/components/page-chrome";
import { useAuthDialog } from "@/components/auth-dialog";
import { useAuth } from "@/lib/auth";
import { isPrivileged } from "@/lib/roles";
import { orbit } from "@/lib/orbit";
import { useNotificationsSocket } from "@/lib/realtime";
import { useTraySync } from "@/lib/tray";
import { useUpdater } from "@/lib/updater";
import { useT, type MessageKey } from "@/i18n";

const localNav = [
  { to: "/", label: "nav.home", icon: Home },
  { to: "/todo", label: "nav.todo", icon: ListTodo },
  { to: "/notebook", label: "nav.notebook", icon: NotebookText },
] as const;

const orbitNav = [
  { to: "/announcements", label: "nav.announcements", icon: Megaphone },
  { to: "/events", label: "nav.events", icon: CalendarDays },
  { to: "/news", label: "nav.news", icon: Newspaper },
  { to: "/blog", label: "nav.blog", icon: BookOpen },
  { to: "/discussions", label: "nav.discussions", icon: MessagesSquare },
] as const;

/** Team Orbit areas: guests see a sign-in prompt here instead of failing API calls. */
const ORBIT_PATHS = [...orbitNav.map((n) => n.to), "/notifications"];
const FULL_BLEED = ["/gadgets/email", "/notebook", "/todo", "/blog/new", "/news/new", "/discussions/new"];
const MARK = "text-[1.65rem] font-semibold tracking-[-0.06em]";

/** In the icon rail, a click expands the sidebar instead of navigating. */
function useExpandWhenCollapsed() {
  const { state, isMobile, setOpen } = useSidebar();
  return (e: MouseEvent) => {
    if (state !== "collapsed" || isMobile) return;
    e.preventDefault();
    setOpen(true);
  };
}

function NavItems({
  items,
  pathname,
}: {
  items: readonly { to: string; label: MessageKey; icon: typeof Home }[];
  pathname: string;
}) {
  const tr = useT();
  const expandIfCollapsed = useExpandWhenCollapsed();
  return (
    <SidebarMenu>
      {items.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
        return (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              render={<Link to={to} />}
              onClick={expandIfCollapsed}
              isActive={active}
              tooltip={tr(label)}
            >
              <Icon />
              <span>{tr(label)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/** "Gadgets" parent item that expands in place to list each gadget; each entry opens the gadget directly. */
function GadgetsMenu({ pathname }: { pathname: string }) {
  const tr = useT();
  const { state, setOpen } = useSidebar();
  const { user } = useAuth();
  const visible = gadgets.filter((g) => !g.privileged || isPrivileged(user));
  const inGadget = pathname.startsWith("/gadgets");
  const [open, setOpenGroup] = useState(inGadget);
  useEffect(() => {
    if (inGadget) setOpenGroup(true);
  }, [inGadget]);

  if (visible.length === 0) return null;

  return (
    <SidebarMenu>
      <Collapsible
        render={<SidebarMenuItem />}
        open={open}
        onOpenChange={(next) => {
          // In the icon rail there is no room for the sub-list: expand the sidebar and show it.
          if (state === "collapsed") {
            setOpen(true);
            setOpenGroup(true);
          } else {
            setOpenGroup(next);
          }
        }}
        className="group/collapsible"
      >
        <CollapsibleTrigger render={<SidebarMenuButton tooltip={tr("nav.gadgets")} isActive={inGadget && !open} />}>
          <Toolbox />
          <span>{tr("nav.gadgets")}</span>
          <ChevronRight className="ml-auto transition-transform group-data-[open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visible.map((g) => (
              <SidebarMenuSubItem key={g.id}>
                <SidebarMenuSubButton render={<Link to={g.to} />} isActive={pathname === g.to || pathname.startsWith(`${g.to}/`)}>
                  <g.icon />
                  <span>{tr(g.name)}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenu>
  );
}

function NotificationsItem({ pathname, unread }: { pathname: string; unread: number }) {
  const tr = useT();
  const expandIfCollapsed = useExpandWhenCollapsed();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to="/notifications" />}
        onClick={expandIfCollapsed}
        isActive={pathname.startsWith("/notifications")}
        tooltip={tr("nav.notifications")}
      >
        <Bell />
        <span>{tr("nav.notifications")}</span>
      </SidebarMenuButton>
      {unread > 0 && <SidebarMenuBadge>{unread}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

function BrandToggle() {
  const tr = useT();
  const { toggleSidebar, state } = useSidebar();
  return (
    <SidebarMenuButton
      size="lg"
      onClick={toggleSidebar}
      tooltip={state === "collapsed" ? tr("nav.expandSidebar") : tr("nav.collapseSidebar")}
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

/** Same content column as the shell outlet so titles and feed cards share one width. */
const CONTENT_COL = "mx-auto w-full max-w-4xl px-8";

function InsetHeader({ fullBleed }: { fullBleed: boolean }) {
  const tr = useT();
  const { title, crumbs, setSlot } = usePageChrome();
  const label = title ?? (fullBleed ? tr("gadget.email.name") : null);
  const col = fullBleed ? "w-full px-4" : CONTENT_COL;

  return (
    <header className="flex shrink-0 flex-col gap-2 pt-2">
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb className={col}>
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
      <div className={`flex h-12 items-center gap-3 ${col}`}>
        {label && (
          <h1 className={`min-w-0 truncate ${MARK}`}>{label}</h1>
        )}
        <div ref={setSlot} className="ml-auto flex shrink-0 items-center gap-2" />
      </div>
      <div className="h-px w-full bg-border" />
    </header>
  );
}

export function AppShell() {
  const tr = useT();
  const { user, token, logout, loading, unreachable } = useAuth();
  const openAuth = useAuthDialog();
  const navigate = useNavigate();
  useNotificationsSocket();
  useTraySync();
  useUpdater();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const needsAuth = ORBIT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const fullBleed = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () =>
      (await orbit.GET("/api/notifications", { params: { query: { status: "unread", limit: 1 } } })).data,
    enabled: !!token,
  });
  const unread = data?.total ?? 0;

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader className="gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <BrandToggle />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <NavItems items={localNav} pathname={pathname} />
                <GadgetsMenu pathname={pathname} />
              </SidebarGroupContent>
            </SidebarGroup>

            {token && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarGroupLabel>{tr("nav.teamOrbit")}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <NavItems items={orbitNav} pathname={pathname} />
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <SidebarMenu>
              {token && (
                <NotificationsItem pathname={pathname} unread={unread} />
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/settings" search={{ section: "appearance" }} />}
                  isActive={pathname === "/settings"}
                  tooltip={tr("nav.settings")}
                >
                  <Settings />
                  <span>{tr("nav.settings")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {token ? (
                user ? (
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={user.fullName} />}>
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatarUrl} alt="" />
                          <AvatarFallback className="text-xs">{user.fullName.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                          <span className="truncate font-medium">{user.fullName}</span>
                          <span className="truncate text-muted-foreground">{user.role.toLowerCase()}</span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="min-w-56">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarImage src={user.avatarUrl} alt="" />
                              <AvatarFallback className="text-xs">{user.fullName.slice(0, 1)}</AvatarFallback>
                            </Avatar>
                            <div className="grid min-w-0 text-left text-xs leading-tight">
                              <span className="truncate font-medium text-foreground">{user.fullName}</span>
                              <span className="truncate">@{user.username}</span>
                            </div>
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => void navigate({ to: "/settings", search: { section: "account" } })}><UserRound /> {tr("nav.account")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void navigate({ to: "/settings", search: { section: "appearance" } })}><Settings /> {tr("nav.settings")}</DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={logout}><LogOut /> {tr("nav.signOut")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ) : (
                  // Signed in but the profile didn't load (server unreachable): always leave a way out.
                  !loading && (
                    <>
                      {unreachable && (
                        <SidebarMenuItem>
                          <SidebarMenuButton className="pointer-events-none text-muted-foreground" tooltip={tr("nav.cantReach")}>
                            <Server />
                            <span>{tr("nav.cantReach")}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                      <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout} tooltip={tr("nav.signOut")}>
                          <LogOut />
                          <span>{tr("nav.signOut")}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )
                )
              ) : (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => openAuth("login")} tooltip={tr("nav.signIn")}>
                      <LogIn />
                      <span>{tr("nav.signIn")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
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
              <div className={fullBleed ? "h-full min-h-0" : `${CONTENT_COL} flex min-h-full flex-col pt-4 pb-8`}>
                {needsAuth ? <RequireAuth><Outlet /></RequireAuth> : <Outlet />}
              </div>
            </div>
          </SidebarInset>
        </PageChromeProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
