import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTodoReminders } from "@/features/todo/reminders";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_app")({
  component: function Guard() {
    const { loading } = useAuth();
    const tr = useT();
    useTodoReminders();
    if (loading) return <div className="p-8 text-sm text-muted-foreground">{tr("page.loading")}</div>;
    return <AppShell />;
  },
});
