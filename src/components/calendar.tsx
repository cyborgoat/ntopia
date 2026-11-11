import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateLocale, useT } from "@/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Sunday-first short weekday names in the current language. */
const weekdays = () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(dateLocale(), { weekday: "short" }));

/** Month grid for picking one day. `value` and `onSelect` use `YYYY-MM-DD`. */
export function Calendar({ value, onSelect }: { value?: string; onSelect: (iso: string) => void }) {
  const tr = useT();
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [month, setMonth] = useState(() => {
    const base = selected && !Number.isNaN(selected.getTime()) ? selected : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = iso(new Date());
  const lead = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <div className="w-[15.5rem] space-y-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-xs" aria-label={tr("date.prevMonth")} onClick={() => shift(-1)}><ChevronLeft /></Button>
        <span className="text-sm font-medium">{month.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={tr("date.nextMonth")} onClick={() => shift(1)}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {weekdays().map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso(d))}
              className={cn(
                "mx-auto flex size-8 items-center justify-center rounded-md text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                iso(d) === today && "font-semibold text-red-500",
                iso(d) === value && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {d.getDate()}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}
