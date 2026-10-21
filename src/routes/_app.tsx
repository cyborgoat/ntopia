import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTodoReminders } from "@/features/todo/reminders";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: function Guard() {
    const { loading } = useAuth();
    useTodoReminders();
    if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
    return <AppShell />;
  },
});
