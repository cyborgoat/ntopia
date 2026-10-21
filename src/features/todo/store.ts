import { getItem, setItem } from "@/lib/storage";

export const TODO_STORAGE_KEY = "todos";

export type Remind = "none" | "at" | "10m" | "1h" | "1d";

export const REMIND_OPTIONS: { value: Remind; label: string; ms: number }[] = [
  { value: "none", label: "No reminder", ms: 0 },
  { value: "at", label: "At due time", ms: 0 },
  { value: "10m", label: "10 minutes before", ms: 10 * 60_000 },
  { value: "1h", label: "1 hour before", ms: 60 * 60_000 },
  { value: "1d", label: "1 day before", ms: 24 * 60 * 60_000 },
];

export type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  /** Local `YYYY-MM-DD`. */
  dueDate?: string;
  /** Local `HH:mm`; only meaningful with `dueDate`. */
  dueTime?: string;
  remind?: Remind;
  notes?: string;
  location?: string;
  /** Set once the reminder has fired so it never repeats. */
  remindedAt?: string;
};

export type TodoInput = Partial<Pick<TodoItem, "dueDate" | "dueTime" | "remind" | "notes" | "location">> & { title: string };

export function listTodos(): TodoItem[] {
  return getItem<TodoItem[]>(TODO_STORAGE_KEY) ?? [];
}

function persist(items: TodoItem[]) {
  setItem(TODO_STORAGE_KEY, items);
}

/** Drops empty optional fields so stored items stay small. */
function clean(patch: Partial<TodoItem>): Partial<TodoItem> {
  const out = { ...patch };
  for (const k of ["notes", "location", "dueTime"] as const) {
    if (k in out) out[k] = out[k]?.trim() || undefined;
  }
  if ("dueDate" in out && !out.dueDate) {
    out.dueDate = undefined;
    out.dueTime = undefined;
    out.remind = undefined;
  }
  if (out.remind === "none") out.remind = undefined;
  return out;
}

export function addTodo(input: TodoInput): TodoItem {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const item: TodoItem = {
    id: crypto.randomUUID(),
    done: false,
    createdAt: new Date().toISOString(),
    ...clean(input),
    title,
  };
  persist([item, ...listTodos()]);
  return item;
}

export function updateTodo(id: string, patch: Partial<Omit<TodoItem, "id" | "createdAt">>): TodoItem[] {
  const next = listTodos().map((t) => {
    if (t.id !== id) return t;
    const merged = { ...t, ...clean(patch) };
    if (!merged.title.trim()) merged.title = t.title;
    // Rescheduling or changing the lead time re-arms the reminder.
    if ("dueDate" in patch || "dueTime" in patch || "remind" in patch) merged.remindedAt = undefined;
    return merged;
  });
  persist(next);
  return next;
}

/** Patch without re-arming the reminder (used when stamping `remindedAt`). */
export function updateTodoSilently(id: string, patch: Pick<TodoItem, "remindedAt">) {
  persist(listTodos().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function toggleTodo(id: string): TodoItem[] {
  const next = listTodos().map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  persist(next);
  return next;
}

export function deleteTodo(id: string): TodoItem[] {
  const next = listTodos().filter((t) => t.id !== id);
  persist(next);
  return next;
}

export function clearCompleted(): TodoItem[] {
  const next = listTodos().filter((t) => !t.done);
  persist(next);
  return next;
}
