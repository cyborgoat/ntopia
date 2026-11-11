import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orbit } from "@/lib/orbit";
import { useT } from "@/i18n";

export type PickedUser = { id: string; fullName: string };

/**
 * Multi-select member search for invite-only events.
 * Lists ACTIVE users via `GET /api/users` with optional `q`.
 */
export function UserPicker({
  value,
  onChange,
  excludeIds = [],
}: {
  value: PickedUser[];
  onChange: (next: PickedUser[]) => void;
  excludeIds?: string[];
}) {
  const tr = useT();
  const [q, setQ] = useState("");
  const selected = new Set(value.map((u) => u.id));
  const excluded = new Set(excludeIds);

  const { data } = useQuery({
    queryKey: ["users", "picker", q],
    queryFn: async () =>
      (await orbit.GET("/api/users", { params: { query: { status: "ACTIVE", page: 1, limit: 20, q: q || undefined } } })).data,
  });

  const results = (data?.items ?? []).filter((u) => !selected.has(u.id) && !excluded.has(u.id));

  const add = (u: PickedUser) => onChange([...value, u]);
  const remove = (id: string) => onChange(value.filter((u) => u.id !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
              {u.fullName}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => remove(u.id)}
                aria-label={tr("user.remove", { name: u.fullName })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("user.search")}
        className="h-8"
      />
      <ul className="max-h-36 overflow-auto rounded-lg border">
        {results.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">{q ? tr("user.noMatches") : tr("user.typeToSearch")}</li>
        ) : (
          results.map((u) => (
            <li key={u.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start rounded-none px-3 text-sm font-normal"
                onClick={() => add({ id: u.id, fullName: u.fullName })}
              >
                <span className="truncate">{u.fullName}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">@{u.username}</span>
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
