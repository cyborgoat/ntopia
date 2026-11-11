import { dateLocale, t } from "@/i18n";
import { addDays, fromDateKey, startOfWeek, toDateKey } from "./dates";
import { urgencyRank, type TodoItem } from "./store";

export type TodoSection = {
  id: string;
  label: string;
  /** Secondary label, e.g. the date under a weekday. */
  hint?: string;
  tone?: "overdue" | "today";
  items: TodoItem[];
};

/** Flagged first, then higher urgency, then earlier due date/time, then newest. */
const byDue = (a: TodoItem, b: TodoItem) =>
  Number(!!b.flagged) - Number(!!a.flagged) ||
  urgencyRank(b.urgency) - urgencyRank(a.urgency) ||
  (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
  (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99") ||
  b.createdAt.localeCompare(a.createdAt);

/**
 * Today first, then the rest of the Mon–Sun week by weekday. Open items before today are
 * overdue; items after this week are upcoming. Completed items go last.
 */
export function groupTodos(items: TodoItem[], now: Date): TodoSection[] {
  const today = toDateKey(now);
  const weekEnd = toDateKey(addDays(startOfWeek(now), 6));
  const open = items.filter((t) => !t.done).sort(byDue);

  const sections: TodoSection[] = [
    { id: "overdue", label: t("todo.overdue"), tone: "overdue", items: open.filter((t) => t.dueDate && t.dueDate < today) },
    { id: "today", label: t("todo.today"), tone: "today", hint: now.toLocaleDateString(dateLocale(), { weekday: "long", month: "short", day: "numeric" }), items: open.filter((t) => t.dueDate === today) },
  ];

  for (let i = 1; toDateKey(addDays(now, i)) <= weekEnd; i++) {
    const day = addDays(now, i);
    const key = toDateKey(day);
    sections.push({
      id: key,
      label: i === 1 ? t("todo.tomorrow") : day.toLocaleDateString(dateLocale(), { weekday: "long" }),
      hint: day.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }),
      items: open.filter((t) => t.dueDate === key),
    });
  }

  sections.push(
    { id: "upcoming", label: t("todo.upcoming"), items: open.filter((t) => t.dueDate && t.dueDate > weekEnd) },
    { id: "nodate", label: t("todo.noDate"), items: open.filter((t) => !t.dueDate) },
    { id: "done", label: t("todo.completed"), items: items.filter((t) => t.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) },
  );
  return sections.filter((s) => s.items.length > 0);
}

/** Short human label for a due date relative to today. */
export function dueLabel(dueDate: string, dueTime: string | undefined, now: Date): string {
  const today = toDateKey(now);
  const d = fromDateKey(dueDate);
  const day =
    dueDate === today ? t("todo.today")
    : dueDate === toDateKey(addDays(now, 1)) ? t("todo.tomorrow")
    : dueDate === toDateKey(addDays(now, -1)) ? t("todo.yesterday")
      : d.toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" });
  return dueTime ? `${day}, ${dueTime}` : day;
}
