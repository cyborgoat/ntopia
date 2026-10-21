import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, fromDateKey, startOfWeek, toDateKey } from "./dates";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Compact date field whose calendar opens above the field (the native picker always drops down). */
export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "No date",
}: {
  /** `YYYY-MM-DD` or "". */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromDateKey(value) : null;
  const [month, setMonth] = useState(() => new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1));
  const todayKey = toDateKey(new Date());

  const first = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const rows = days[35].getMonth() === month.getMonth() ? 6 : 5;
  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1));
      }}
    >
      <Popover.Trigger
        type="button"
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {selected ? selected.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : placeholder}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={6} collisionAvoidance={{ side: "none" }} className="isolate z-[60]">
          <Popover.Popup className="w-64 rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <div className="mb-2 flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft /></Button>
              <span className="text-sm font-medium">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight /></Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((d) => <span key={d} className="py-1 text-[11px] text-muted-foreground">{d}</span>)}
              {days.slice(0, rows * 7).map((d) => {
                const key = toDateKey(d);
                const inMonth = d.getMonth() === month.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(key)}
                    className={cn(
                      "h-8 rounded-md text-xs tabular-nums hover:bg-muted",
                      !inMonth && "text-muted-foreground/50",
                      key === todayKey && "font-semibold text-primary",
                      key === value && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between border-t pt-2">
              <Button type="button" variant="ghost" size="xs" onClick={() => pick(todayKey)}>Today</Button>
              <Button type="button" variant="ghost" size="xs" disabled={!value} onClick={() => pick("")}><X /> Clear</Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
