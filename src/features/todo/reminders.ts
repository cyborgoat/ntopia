import { useEffect } from "react";
import { t as tr } from "@/i18n";
import { notifyUser } from "@/lib/notify";
import { dueAt } from "./dates";
import { listTodos, REMIND_OPTIONS, updateTodoSilently } from "./store";

const CHECK_MS = 30_000;
export const TODO_REMINDER_EVENT = "todos:changed";

function checkReminders() {
  const now = Date.now();
  for (const t of listTodos()) {
    if (t.done || !t.dueDate || !t.remind || t.remindedAt) continue;
    const lead = REMIND_OPTIONS.find((o) => o.value === t.remind)?.ms ?? 0;
    if (dueAt(t.dueDate, t.dueTime).getTime() - lead > now) continue;
    updateTodoSilently(t.id, { remindedAt: new Date().toISOString() });
    const when = t.dueTime ? tr("todo.dueAt", { time: t.dueTime }) : tr("todo.dueToday");
    void notifyUser({ title: t.title, body: [when, t.location].filter(Boolean).join(" · "), prefKey: "todo" });
    window.dispatchEvent(new Event(TODO_REMINDER_EVENT));
  }
}

/** App-wide: fires each todo's reminder once while the app is running (missed ones fire on launch). */
export function useTodoReminders() {
  useEffect(() => {
    checkReminders();
    const id = window.setInterval(checkReminders, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);
}
