import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayTitle, type Note } from "@/gadgets/notes/store";
import { formatDateTime } from "@/lib/utils";

export function TrashDialog({
  open,
  onOpenChange,
  trashed,
  onRestore,
  onPurge,
  onEmpty,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trashed: Note[];
  onRestore: (note: Note) => void;
  onPurge: (note: Note) => void;
  onEmpty: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trash</DialogTitle>
          <DialogDescription>
            {trashed.length === 0
              ? "Trash is empty."
              : `${trashed.length} ${trashed.length === 1 ? "note" : "notes"} in trash. Restore or delete them for good.`}
          </DialogDescription>
        </DialogHeader>
        {trashed.length > 0 && (
          <ul className="max-h-72 space-y-0.5 overflow-auto">
            {trashed.map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-tight font-medium">{displayTitle(n)}</span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                    Deleted {formatDateTime(n.deletedAt ?? n.updatedAt)}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Restore" onClick={() => onRestore(n)}>
                  <RotateCcw />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete forever" onClick={() => onPurge(n)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="destructive" disabled={trashed.length === 0} onClick={onEmpty}>
            Empty trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
