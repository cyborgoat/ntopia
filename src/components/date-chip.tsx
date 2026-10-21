import { cn } from "@/lib/utils";

/** Calendar-leaf style chip: short month over the day number. */
export function DateChip({ iso, className }: { iso: string; className?: string }) {
  const d = new Date(iso);
  return (
    <span className={cn("flex w-9 shrink-0 flex-col items-center rounded-md bg-muted py-0.5 leading-tight", className)}>
      <span className="text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString([], { month: "short" })}</span>
      <span className="text-sm font-semibold tabular-nums">{d.getDate()}</span>
    </span>
  );
}
