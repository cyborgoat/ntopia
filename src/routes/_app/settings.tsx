import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Info, Palette, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AboutSettings } from "@/features/settings/about";
import { AccountSettings } from "@/features/settings/account";
import { AppearanceSettings } from "@/features/settings/appearance";
import { NotificationSettings } from "@/features/settings/notifications";
import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "appearance", label: "settings.appearance" as MessageKey, icon: Palette, component: AppearanceSettings },
  { id: "account", label: "settings.account" as MessageKey, icon: UserRound, component: AccountSettings },
  { id: "notifications", label: "settings.notifications" as MessageKey, icon: Bell, component: NotificationSettings },
  { id: "about", label: "settings.about" as MessageKey, icon: Info, component: AboutSettings },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (s: Record<string, unknown>): { section: SectionId } => ({
    section: SECTIONS.find((x) => x.id === s.section)?.id ?? "appearance",
  }),
  component: Settings,
});

function Settings() {
  const tr = useT();
  const { section } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const Active = active.component;

  return (
    <>
      <PageHeader title={tr("settings.title")} />
      <div className="flex flex-col gap-6 sm:flex-row">
        <nav className="flex shrink-0 gap-1 sm:w-44 sm:flex-col" aria-label={tr("settings.nav")}>
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
              <Icon className="size-4" /> {tr(label)}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-6">
          <h2 className="text-lg font-semibold">{tr(active.label)}</h2>
          <Active />
        </div>
      </div>
    </>
  );
}
