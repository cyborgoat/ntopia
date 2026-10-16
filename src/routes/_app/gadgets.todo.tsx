import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Circle, Trash2 } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const focusAdd = () => inputRef.current?.focus();
  const doneCount = items.filter((t) => t.done).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addTodo(title);
      setTitle("");
      setItems(listTodos());
    } catch {
      /* empty title */
    }
  };

  const open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);

  const listMenu = (
    <ContextMenuContent>
      <ContextMenuItem onClick={focusAdd}>Focus add field</ContextMenuItem>
      <ContextMenuItem disabled={doneCount === 0} onClick={() => setItems(clearCompleted())}>
        Clear completed
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <>
      <PageHeader
        title="Todo"
        description="A simple local checklist. Stored on this device."
        actions={
          doneCount > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setItems(clearCompleted())}>
              Clear completed
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <Input
          ref={inputRef}
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
        <ContextMenu>
          <ContextMenuTrigger className="block">
            <Empty>No tasks yet. Add one above.</Empty>
          </ContextMenuTrigger>
          {listMenu}
        </ContextMenu>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger className="block">
            <ul className="divide-y rounded-lg border">
              {[...open, ...done].map((t) => (
                <li key={t.id}>
                  <ContextMenu>
                    <ContextMenuTrigger className="flex w-full items-center gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => setItems(toggleTodo(t.id))}
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
                        onClick={() => setItems(deleteTodo(t.id))}
                        aria-label="Delete"
                      >
                        <Trash2 />
                      </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
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
              ))}
            </ul>
          </ContextMenuTrigger>
          {listMenu}
        </ContextMenu>
      )}
    </>
  );
}
