import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";

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
  const tr = useT();
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
        <TooltipTrigger render={<DialogTrigger render={<Button variant="outline" size="icon-sm" aria-label={tr("email.tpl.saveAs")} />} />}>
          <BookmarkPlus />
        </TooltipTrigger>
        <TooltipContent>{tr("email.tpl.saveAs")}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{tr("email.tpl.saveAs")}</DialogTitle>
            <DialogDescription>{tr("email.tpl.saveAsHint")}</DialogDescription>
          </DialogHeader>
          <Input autoFocus aria-label={tr("email.tpl.nameField")} placeholder={tr("email.tpl.nameField")} value={name} onChange={(e) => setName(e.target.value)} />
          {replaces && <p className="text-xs text-amber-600 dark:text-amber-400">{tr("email.tpl.exists")}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tr("common.cancel")}</Button>
            <Button type="submit" disabled={!trimmed}>{replaces ? tr("email.tpl.replace") : tr("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
