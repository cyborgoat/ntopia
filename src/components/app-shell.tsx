import { Fragment, useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, CalendarDays, ChevronRight, ChevronsUpDown, Home, KeyRound, ListTodo, LogIn, LogOut, Megaphone, MessagesSquare, Newspaper, Server, Toolbox, UserRound,
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
import { SettingsDialog, type SettingsPanel } from "@/components/settings-dialogs";
import { PageChromeProvider, usePageChrome } from "@/components/page-chrome";
import { useAuth } from "@/lib/auth";
import { orbit } from "@/lib/orbit";
import { useNotificationsSocket } from "@/lib/realtime";

const localNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/todo", label: "Todo", icon: ListTodo },
] as const;

const orbitNav = [
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/discussions", label: "Discussions", icon: MessagesSquare },
] as const;

const FULL_BLEED = ["/gadgets/email", "/todo", "/blog/new", "/news/new", "/discussions/new"];
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

/** "Gadgets" parent item that expands in place to list each gadget; each entry opens the gadget directly. */
function GadgetsMenu({ pathname }: { pathname: string }) {
  const { state, setOpen } = useSidebar();
  const inGadget = pathname.startsWith("/gadgets");
  const [open, setOpenGroup] = useState(inGadget);
  useEffect(() => {
    if (inGadget) setOpenGroup(true);
  }, [inGadget]);

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
        <CollapsibleTrigger render={<SidebarMenuButton tooltip="Gadgets" isActive={inGadget && !open} />}>
          <Toolbox />
          <span>Gadgets</span>
          <ChevronRight className="ml-auto transition-transform group-data-[open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {gadgets.map((g) => (
              <SidebarMenuSubItem key={g.id}>
                <SidebarMenuSubButton render={<Link to={g.to} />} isActive={pathname === g.to || pathname.startsWith(`${g.to}/`)}>
                  <g.icon />
                  <span>{g.name}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
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
  const { title, crumbs, setSlot } = usePageChrome();
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
      <div className="flex h-12 items-center gap-3 px-4">
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
  const { user, token, logout, loading, unreachable } = useAuth();
  const [panel, setPanel] = useState<SettingsPanel | null>(null);
  useNotificationsSocket();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await orbit.GET("/api/notifications", { params: { query: { limit: 100 } } })).data,
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
                <GadgetsMenu pathname={pathname} />
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
                          <DropdownMenuItem onClick={() => setPanel("profile")}><UserRound /> Profile</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPanel("password")}><KeyRound /> Password</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPanel("server")}><Server /> Server</DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={logout}><LogOut /> Sign out</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ) : (
                  // Signed in but the profile didn't load (server unreachable): always leave a way out.
                  !loading && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setPanel("server")} tooltip="Can't reach the server">
                          <Server />
                          <span>{unreachable ? "Can't reach server" : "Server"}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout} tooltip="Sign out">
                          <LogOut />
                          <span>Sign out</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )
                )
              ) : (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setPanel("server")} tooltip="Server">
                      <Server />
                      <span>Server</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<Link to="/login" />} tooltip="Sign in">
                      <LogIn />
                      <span>Sign in</span>
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
              <div className={fullBleed ? "h-full min-h-0" : "mx-auto flex min-h-full max-w-4xl flex-col px-8 pt-4 pb-8"}>
                <Outlet />
              </div>
            </div>
          </SidebarInset>
        </PageChromeProvider>
        <SettingsDialog panel={panel} onClose={() => setPanel(null)} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
