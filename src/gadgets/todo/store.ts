import { getItem, setItem } from "@/lib/storage";

export const TODO_STORAGE_KEY = "todos";

export type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export function listTodos(): TodoItem[] {
  return getItem<TodoItem[]>(TODO_STORAGE_KEY) ?? [];
}

function persist(items: TodoItem[]) {
  setItem(TODO_STORAGE_KEY, items);
}

export function addTodo(title: string): TodoItem {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");
  const item: TodoItem = {
    id: crypto.randomUUID(),
    title: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };
  persist([item, ...listTodos()]);
  return item;
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
