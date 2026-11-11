import { createStore, newId, nowIso } from "@/lib/create-store";
import type { MessageKey } from "@/i18n";

const store = createStore<TodoItem[]>("todos", () => []);
export const TODO_STORAGE_KEY = store.key;

export type Remind = "none" | "at" | "10m" | "1h" | "1d";

export const REMIND_OPTIONS: { value: Remind; label: MessageKey; ms: number }[] = [
  { value: "none", label: "todo.remind.none", ms: 0 },
  { value: "at", label: "todo.remind.at", ms: 0 },
  { value: "10m", label: "todo.remind.10m", ms: 10 * 60_000 },
  { value: "1h", label: "todo.remind.1h", ms: 60 * 60_000 },
  { value: "1d", label: "todo.remind.1d", ms: 24 * 60 * 60_000 },
];

export type Urgency = "none" | "low" | "medium" | "high";

export const URGENCY_OPTIONS: { value: Urgency; label: string | MessageKey; rank: number }[] = [
  { value: "none", label: "todo.urgency.none", rank: 0 },
  { value: "low", label: "!", rank: 1 },
  { value: "medium", label: "!!", rank: 2 },
  { value: "high", label: "!!!", rank: 3 },
];

/** Exclamation marks for list badges; omit `"none"`. */
export const URGENCY_LABEL: Record<Exclude<Urgency, "none">, string> = {
  low: "!",
  medium: "!!",
  high: "!!!",
};

/** Badge colors by urgency — low muted, medium amber, high red. */
export const URGENCY_CLASS: Record<Exclude<Urgency, "none">, string> = {
  low: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
  medium: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "border-transparent bg-destructive/10 text-destructive",
};

export function urgencyRank(urgency: Urgency | undefined): number {
  return URGENCY_OPTIONS.find((o) => o.value === (urgency ?? "none"))?.rank ?? 0;
}

/** Split a comma-separated tag string into unique trimmed tags. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,]+/)) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

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
  /** Starred / pin-like marker for quick focus. */
  flagged?: boolean;
  /** Priority relative to other open tasks; `"none"` is never persisted. */
  urgency?: Urgency;
  /** Free-form labels. */
  tags?: string[];
  /** Set once the reminder has fired so it never repeats. */
  remindedAt?: string;
};

export type TodoInput = Partial<
  Pick<TodoItem, "dueDate" | "dueTime" | "remind" | "notes" | "location" | "flagged" | "urgency" | "tags">
> & { title: string };

export function listTodos(): TodoItem[] {
  return store.read();
}

function persist(items: TodoItem[]) {
  void store.save(items);
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
  if ("flagged" in out && !out.flagged) out.flagged = undefined;
  if (out.urgency === "none") out.urgency = undefined;
  if ("tags" in out) {
    const tags = (out.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    out.tags = tags.filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (out.tags.length === 0) out.tags = undefined;
  }
  return out;
}

export function addTodo(input: TodoInput): TodoItem {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const item: TodoItem = {
    id: newId(),
    done: false,
    createdAt: nowIso(),
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
