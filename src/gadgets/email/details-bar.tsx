import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailsSheet } from "./details-sheet";
import { isEventType, themeLabel, typeLabel } from "./fields";
import type { Frontmatter } from "./frontmatter";

const str = (v: unknown) => (v == null ? "" : String(v));

/** Always-visible summary of the email's frontmatter; the full form lives in a side sheet. */
export function DetailsBar({ meta, onChange }: { meta: Frontmatter; onChange: (meta: Frontmatter) => void }) {
  const [open, setOpen] = useState(false);
  const type = str(meta.type) || "news";
  const theme = typeof meta.theme === "object" && meta.theme ? "Custom" : str(meta.theme) && themeLabel(str(meta.theme));
  const when = str(isEventType(type) ? meta.startsAt : meta.date);

  return (
    <div className="flex h-11 items-center gap-2 border-b bg-muted/20 px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{str(meta.title) || "Untitled"}</span>
        <span className="flex shrink-0 items-center gap-1">
          <Badge variant="secondary">{typeLabel(type)}</Badge>
          {theme && <Badge variant="outline">{theme}</Badge>}
          {meta.lang != null && <Badge variant="outline">{str(meta.lang)}</Badge>}
          {when && <span className="text-xs text-muted-foreground">{when}</span>}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Edit details
      </Button>
      <DetailsSheet open={open} onOpenChange={setOpen} meta={meta} onChange={onChange} />
    </div>
  );
}
