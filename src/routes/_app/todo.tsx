import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check, ChevronDown, ChevronRight, Circle, MapPin, Pencil, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Empty, PageHeader } from "@/components/page-header";
import { DatePicker } from "@/features/todo/date-picker";
import { toDateKey } from "@/features/todo/dates";
import { dueLabel, groupTodos } from "@/features/todo/group";
import { TODO_REMINDER_EVENT } from "@/features/todo/reminders";
import {
  addTodo,
  clearCompleted,
  deleteTodo,
  listTodos,
  toggleTodo,
  updateTodo,
  type TodoItem,
} from "@/features/todo/store";
import { useNow } from "@/features/todo/use-now";
import { TodoDialog } from "@/features/todo/todo-dialog";

export const Route = createFileRoute("/_app/todo")({ component: TodoPage });

function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>(() => listTodos());
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(() => toDateKey(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = items.find((t) => t.id === editingId);
  // Groups are open by default except Completed; keyed by section id.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const isCollapsed = (id: string) => (id === "done") !== toggled.has(id);
  const toggleSection = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const inputRef = useRef<HTMLInputElement>(null);
  const now = useNow();

  // A reminder firing stamps the stored item; pick that up.
  useEffect(() => {
    const sync = () => setItems(listTodos());
    window.addEventListener(TODO_REMINDER_EVENT, sync);
    return () => window.removeEventListener(TODO_REMINDER_EVENT, sync);
  }, []);

  const focusAdd = () => inputRef.current?.focus();
  const doneCount = items.filter((t) => t.done).length;
  const sections = groupTodos(items, now);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addTodo({ title, dueDate: dueDate || undefined });
      setTitle("");
      setItems(listTodos());
    } catch {
      /* empty title */
    }
  };

  const listMenu = (
    <ContextMenuContent>
      <ContextMenuItem onClick={focusAdd}>Focus add field</ContextMenuItem>
      <ContextMenuItem disabled={doneCount === 0} onClick={() => setItems(clearCompleted())}>
        Clear completed
      </ContextMenuItem>
    </ContextMenuContent>
  );

  const row = (t: TodoItem, tone?: "overdue" | "today") => (
    <li key={t.id}>
      <ContextMenu>
        <ContextMenuTrigger className="group flex h-8 w-full items-center gap-2.5 rounded-md px-2 hover:bg-muted/60">
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => setItems(toggleTodo(t.id))}
            className="size-3.5 shrink-0 accent-foreground"
            aria-label={t.done ? "Mark incomplete" : "Mark complete"}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setEditingId(t.id)}
          >
            <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
              {t.title}
            </span>
            <span className="flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground">
              {t.location && (
                <span className="flex max-w-32 items-center gap-1 truncate"><MapPin className="size-3 shrink-0" /><span className="truncate">{t.location}</span></span>
              )}
              {t.notes && <StickyNote className="size-3" aria-label="Has notes" />}
              {t.remind && <Bell className="size-3" aria-label="Reminder set" />}
              {t.dueDate && (
                <span className={`tabular-nums ${tone === "overdue" && !t.done ? "text-destructive" : ""}`}>
                  {dueLabel(t.dueDate, t.dueTime, now)}
                </span>
              )}
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => setItems(deleteTodo(t.id))}
            aria-label="Delete"
          >
            <Trash2 />
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setEditingId(t.id)}><Pencil /> Edit</ContextMenuItem>
          <ContextMenuItem onClick={() => setItems(toggleTodo(t.id))}>
            {t.done ? <Circle /> : <Check />}
            {t.done ? "Mark incomplete" : "Mark complete"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setItems(deleteTodo(t.id))}>
            <Trash2 /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-8 pt-4 pb-4">
      <PageHeader
        title="Todo"
        actions={
          doneCount > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setItems(clearCompleted())}>
              Clear completed
            </Button>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {items.length === 0 ? (
          <ContextMenu>
            <ContextMenuTrigger className="block">
              <Empty>No tasks yet. Add one below.</Empty>
            </ContextMenuTrigger>
            {listMenu}
          </ContextMenu>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger className="block">
              {!sections.some((s) => s.id === "today") && (
                <p className="px-2 text-xs text-muted-foreground">Nothing due today.</p>
              )}
              {sections.map((s, i) => {
                const collapsed = isCollapsed(s.id);
                return (
                  // A faint rule between groups keeps them reading as one list.
                  <section key={s.id} className={i > 0 ? "mt-3 border-t border-border/40 pt-3" : undefined}>
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      onClick={() => toggleSection(s.id)}
                      className={`flex h-7 w-full items-center gap-1.5 rounded-md px-1 text-left hover:bg-muted/60 ${
                        s.tone === "overdue" ? "text-destructive" : s.tone === "today" ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      <span className={`text-xs uppercase tracking-wide ${s.tone === "today" ? "font-semibold" : "font-medium"}`}>{s.label}</span>
                      {s.hint && <span className="text-xs text-muted-foreground">{s.hint}</span>}
                      <span className="ml-auto rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{s.items.length}</span>
                    </button>
                    {!collapsed && <ul className="mt-0.5">{s.items.map((t) => row(t, s.tone))}</ul>}
                  </section>
                );
              })}
            </ContextMenuTrigger>
            {listMenu}
          </ContextMenu>
        )}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t pt-3">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="h-8"
          autoFocus
        />
        <DatePicker value={dueDate} onChange={setDueDate} className="w-44 shrink-0" />
        <Button type="submit" size="sm" className="h-8" disabled={!title.trim()}>
          Add
        </Button>
      </form>

      {editing && (
        <TodoDialog
          key={editing.id}
          todo={editing}
          onSave={(patch) => {
            updateTodo(editing.id, patch);
            setItems(listTodos());
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
