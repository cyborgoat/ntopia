import { useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

/** Add `text` (one tag, or several separated by commas) to `tags`, trimmed and without duplicates. */
export function addTags(tags: string[], text: string): string[] {
  const next = [...tags];
  for (const raw of text.split(",")) {
    const tag = raw.trim();
    if (tag && !next.some((t) => t.toLowerCase() === tag.toLowerCase())) next.push(tag);
  }
  return next;
}

/**
 * Tags as removable chips. Enter or a comma turns the typed text into a chip, Backspace on an empty field removes
 * the last chip. The text still being typed is controlled (`draft`) so the form can include it when it submits.
 */
export function TagInput({
  id,
  value,
  onChange,
  draft,
  onDraftChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const tr = useT();
  const input = useRef<HTMLInputElement>(null);

  function commit(text = draft) {
    if (text.trim()) onChange(addTags(value, text));
    onDraftChange("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
      onClick={() => input.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="h-6 gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={tr("tag.remove", { tag })}
            className="grid size-4 place-items-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((t) => t !== tag));
            }}
          >
            <X />
          </button>
        </Badge>
      ))}
      <input
        ref={input}
        id={id}
        value={draft}
        placeholder={value.length ? "" : (placeholder ?? tr("tag.placeholder"))}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        onChange={(e) => {
          const text = e.target.value;
          // A typed or pasted comma finishes the tag(s) before it.
          if (text.includes(",")) {
            const last = text.lastIndexOf(",");
            onChange(addTags(value, text.slice(0, last)));
            onDraftChange(text.slice(last + 1).trimStart());
          } else onDraftChange(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit()}
      />
    </div>
  );
}
