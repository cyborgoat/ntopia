import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortOption } from "@/lib/sorting";
import { useT } from "@/i18n";

/** "Sort by" dropdown for a section's page header; shows the current choice. */
export function SortMenu<K extends string>({
  value,
  options,
  onChange,
}: {
  value: K;
  options: readonly SortOption<K>[];
  onChange: (value: K) => void;
}) {
  const tr = useT();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label={tr("sort.byValue", { value: tr(current.label) })} />}>
        <ArrowUpDown /> {tr(current.label)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tr("sort.by")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as K)}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>{tr(o.label)}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
