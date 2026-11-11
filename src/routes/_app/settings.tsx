import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Palette, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AccountSettings } from "@/features/settings/account";
import { AppearanceSettings } from "@/features/settings/appearance";
import { NotificationSettings } from "@/features/settings/notifications";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSettings },
  { id: "account", label: "Account", icon: UserRound, component: AccountSettings },
  { id: "notifications", label: "Notifications", icon: Bell, component: NotificationSettings },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (s: Record<string, unknown>): { section: SectionId } => ({
    section: SECTIONS.find((x) => x.id === s.section)?.id ?? "appearance",
  }),
  component: Settings,
});

function Settings() {
  const { section } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const Active = active.component;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 sm:flex-row">
        <nav className="flex shrink-0 gap-1 sm:w-44 sm:flex-col" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => void navigate({ search: { section: id }, replace: true })}
              aria-current={id === section ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                id === section ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-6">
          <h2 className="text-lg font-semibold">{active.label}</h2>
          <Active />
        </div>
      </div>
    </>
  );
}
