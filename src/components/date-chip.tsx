import { cn } from "@/lib/utils";
import { dateLocale } from "@/i18n";

/**
 * Calendar-leaf style chip: short month over the day number.
 * Today gets the Apple Calendar look (red month band on a light leaf); `muted` dims it for past dates.
 */
export function DateChip({ iso, muted, className }: { iso: string; muted?: boolean; className?: string }) {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  const month = d.toLocaleDateString(dateLocale(), { month: "short" });
  return (
    <span
      className={cn(
        "flex w-9 shrink-0 flex-col items-center overflow-hidden rounded-md leading-tight",
        today ? "bg-card shadow-sm ring-1 ring-border" : "bg-muted py-0.5",
        muted && "opacity-80",
        className,
      )}
    >
      <span
        className={cn(
          "text-[10px] uppercase",
          today ? "w-full bg-red-500 py-px text-center font-semibold text-white" : "text-muted-foreground",
        )}
      >
        {month}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", today && "py-0.5")}>{d.getDate()}</span>
    </span>
  );
}
