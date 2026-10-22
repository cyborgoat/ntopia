import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flag, MapPin, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dueLabel, groupTodos } from "./group";
import { TODO_REMINDER_EVENT } from "./reminders";
import { addTodo, listTodos, toggleTodo, URGENCY_CLASS, URGENCY_LABEL, type TodoItem } from "./store";
import { toDateKey } from "./dates";
import { useNow } from "./use-now";

/** Overdue and due-today tasks with tick-off and quick add; shared data with the Todo page. */
export function TodayPanel() {
  const [items, setItems] = useState<TodoItem[]>(() => listTodos());
  const [title, setTitle] = useState("");
  const now = useNow();

  useEffect(() => {
    const sync = () => setItems(listTodos());
    window.addEventListener(TODO_REMINDER_EVENT, sync);
    return () => window.removeEventListener(TODO_REMINDER_EVENT, sync);
  }, []);

  const sections = groupTodos(items, now);
  const focus = sections.filter((s) => s.id === "overdue" || s.id === "today");
  const overdueCount = sections.find((s) => s.id === "overdue")?.items.length ?? 0;
  const openToday = overdueCount + (sections.find((s) => s.id === "today")?.items.length ?? 0);
  const coming = sections.filter((s) => !["overdue", "today", "nodate", "done"].includes(s.id)).flatMap((s) => s.items).slice(0, 3);
  const next = sections.find((s) => s.id !== "overdue" && s.id !== "today" && s.id !== "nodate" && s.id !== "done")?.items[0];

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTodo({ title, dueDate: toDateKey(now) });
    setTitle("");
    setItems(listTodos());
  };

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {openToday === 0 ? "Nothing on your plate." : `${openToday} ${openToday === 1 ? "task" : "tasks"} to do${overdueCount ? `, ${overdueCount} overdue` : ""}`}
          </p>
        </div>
        <Link to="/todo" className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Open Todo <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="min-h-20 flex-1">
        {focus.map((s, i) => (
          <div key={s.id} className={i > 0 ? "mt-4 border-t border-border/40 pt-4" : undefined}>
            {s.id === "overdue" && <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-destructive">Overdue</p>}
            {s.id === "today" && focus.length > 1 && <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>}
            <ul>
              {s.items.map((t) => (
                <li key={t.id} className="flex h-10 items-center gap-3 rounded-lg px-2 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => setItems(toggleTodo(t.id))}
                    className="size-4 shrink-0 accent-foreground"
                    aria-label="Mark complete"
                  />
                  {t.flagged && <Flag className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-label="Flagged" />}
                  <span className="min-w-0 flex-1 truncate text-base">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-2.5 text-sm text-muted-foreground">
                    {t.urgency && t.urgency !== "none" && (
                      <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${URGENCY_CLASS[t.urgency]}`}>
                        {URGENCY_LABEL[t.urgency]}
                      </Badge>
                    )}
                    {t.location && <span className="flex max-w-24 items-center gap-1"><MapPin className="size-3 shrink-0" /><span className="truncate">{t.location}</span></span>}
                    {t.dueDate && (
                      <span className={`tabular-nums ${s.id === "overdue" ? "text-destructive" : ""}`}>
                        {s.id === "overdue" ? dueLabel(t.dueDate, t.dueTime, now) : t.dueTime}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {focus.length === 0 && (
          <p className="px-2 py-2 text-base text-muted-foreground">
            You're clear for today.
            {next?.dueDate && <> Next up: <span className="text-foreground">{next.title}</span> · {dueLabel(next.dueDate, next.dueTime, now)}</>}
          </p>
        )}
        {coming.length > 0 && focus.length > 0 && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming up</p>
            <ul>
              {coming.map((t) => (
                <li key={t.id} className="flex h-9 items-center gap-3 rounded-lg px-2 text-sm text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.dueDate && <span className="shrink-0 tabular-nums">{dueLabel(t.dueDate, t.dueTime, now)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={add} className="mt-6 flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for today…" className="h-10 text-base" />
        <Button type="submit" size="icon" className="size-10" disabled={!title.trim()} aria-label="Add task"><Plus /></Button>
      </form>
    </section>
  );
}
