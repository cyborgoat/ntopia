import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT, type MessageKey } from "@/i18n";
import { EMAIL_TYPES } from "./fields";

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Toolbar button + dialog explaining how the composer works. */
export function EmailHelp() {
  const tr = useT();
  const key = (n: number, part: "title" | "body") => `email.help.s${n}.${part}` as MessageKey;

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tr("email.help.tip")} />} />}>
          <CircleHelp />
        </TooltipTrigger>
        <TooltipContent>{tr("email.help.tip")}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tr("email.help.title")}</DialogTitle>
          <DialogDescription>{tr("email.help.desc")}</DialogDescription>
        </DialogHeader>
        <ol className="max-h-[60vh] space-y-4 overflow-auto pr-1 text-sm">
          {STEPS.map((n) => (
            <li key={n} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{n}</span>
              <div>
                <div className="font-medium">{tr(key(n, "title"))}</div>
                <div className="text-muted-foreground">
                  {n === 3 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {EMAIL_TYPES.map((type) => (
                        <li key={type.value}><code>{type.value}</code> — {tr(type.description)}</li>
                      ))}
                    </ul>
                  ) : (
                    tr(key(n, "body"))
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
