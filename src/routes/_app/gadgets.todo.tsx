import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHeader } from "@/components/page-header";
import {
  addTodo,
  clearCompleted,
  deleteTodo,
  listTodos,
  toggleTodo,
  type TodoItem,
} from "@/gadgets/todo/store";

export const Route = createFileRoute("/_app/gadgets/todo")({ component: TodoGadget });

function TodoGadget() {
  const [items, setItems] = useState<TodoItem[]>(() => listTodos());
  const [title, setTitle] = useState("");

  const refresh = (next: TodoItem[]) => setItems(next);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addTodo(title);
      setTitle("");
      refresh(listTodos());
    } catch {
      /* empty title */
    }
  };

  const open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);

  return (
    <>
      <PageHeader
        title="Todo"
        description="A simple local checklist. Stored on this device."
        actions={
          done.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => refresh(clearCompleted())}>
              Clear completed
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Add
        </Button>
      </form>

      {items.length === 0 ? (
        <Empty>No tasks yet. Add one above.</Empty>
      ) : (
        <ul className="divide-y rounded-lg border">
          {[...open, ...done].map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => refresh(toggleTodo(t.id))}
                className="size-4 accent-foreground"
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
              />
              <span className={`min-w-0 flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
                {t.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => refresh(deleteTodo(t.id))}
                aria-label="Delete"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
