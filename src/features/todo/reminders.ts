import { useEffect } from "react";
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { isTauri } from "@/lib/storage";
import { dueAt } from "./dates";
import { listTodos, REMIND_OPTIONS, updateTodoSilently } from "./store";

const CHECK_MS = 30_000;
export const TODO_REMINDER_EVENT = "todos:changed";

async function notify(title: string, body?: string) {
  toast.message(title, { description: body });
  if (!isTauri()) return;
  try {
    const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* notifications unavailable; the toast still shows */
  }
}

function checkReminders() {
  const now = Date.now();
  for (const t of listTodos()) {
    if (t.done || !t.dueDate || !t.remind || t.remindedAt) continue;
    const lead = REMIND_OPTIONS.find((o) => o.value === t.remind)?.ms ?? 0;
    if (dueAt(t.dueDate, t.dueTime).getTime() - lead > now) continue;
    updateTodoSilently(t.id, { remindedAt: new Date().toISOString() });
    const when = t.dueTime ? `Due ${t.dueTime}` : "Due today";
    void notify(t.title, [when, t.location].filter(Boolean).join(" · "));
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
