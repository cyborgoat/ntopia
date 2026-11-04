import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

/** Toolbar button + dialog that stores the current draft as a reusable template. */
export function SaveTemplate({
  defaultName,
  existingNames,
  onSave,
}: {
  defaultName: string;
  existingNames: string[];
  onSave: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const replaces = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    onSave(trimmed);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setName(defaultName); }}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Save as template" />} />}>
          <BookmarkPlus />
        </TooltipTrigger>
        <TooltipContent>Save as template</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>Save the current details and message so you can start from them again.</DialogDescription>
          </DialogHeader>
          <Input autoFocus aria-label="Template name" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
          {replaces && <p className="text-xs text-amber-600 dark:text-amber-400">A template with this name exists and will be replaced.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!trimmed}>{replaces ? "Replace" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
