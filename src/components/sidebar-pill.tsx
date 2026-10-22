import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small pill on a panel edge that collapses or expands the panel. */
export function SidebarPill({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = collapsed ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onToggle}
      className={cn(
        "z-10 flex h-10 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
        className,
      )}
    >
      <Icon className="size-3" />
    </button>
  );
}
