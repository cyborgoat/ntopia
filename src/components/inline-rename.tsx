import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export /** Text input that replaces a label in place. Enter/blur commit, Escape cancels. */
function InlineRename({
  value,
  onCommit,
  onCancel,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // Defer so a closing context menu does not steal focus back.
    const t = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const finish = (commit: boolean, next?: string) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(next ?? value);
    else onCancel();
  };

  return (
    <Input
      ref={ref}
      defaultValue={value}
      aria-label={t("notebook.rename")}
      className={cn("h-6 min-w-0 flex-1 px-1.5 text-sm", className)}
      onBlur={(e) => finish(true, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        if (e.key === "Escape") finish(false);
      }}
    />
  );
}
