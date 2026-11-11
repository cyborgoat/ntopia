import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EMAIL_TYPES } from "./fields";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Pick a language, then a template",
    body: "Open Templates, choose English or 中文, then click a card. Cards marked Default come with the app and can't be deleted; cards marked Yours are your own and can be deleted. “Blank email” starts empty.",
  },
  {
    title: "Write in Markdown",
    body: "The editor holds the whole email. The block between the --- lines at the top is the frontmatter (title, type, language, dates, links). Use the details button in the toolbar to fold or unfold it; everything below is the message body.",
  },
  {
    title: "Choose the email type",
    body: (
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {EMAIL_TYPES.map((t) => (
          <li key={t.value}><code>{t.value}</code> — {t.description}</li>
        ))}
      </ul>
    ),
  },
  {
    title: "Check the preview",
    body: "The preview updates as you type. Use the eye button to hide or show it. If a field is missing or misspelled, the editor flags it and the export fills in a sensible default.",
  },
  {
    title: "Add images",
    body: "Open the Image library to import pictures, then click an image to copy its path. Paste it after photo: in the frontmatter or into ![](…) in the body.",
  },
  {
    title: "Set your branding",
    body: "Branding sets the organization name, tagline, footer and logo shown in every email header and footer.",
  },
  {
    title: "Export or send",
    body: "Export as Markdown, HTML, EML or PNG, export everything at once, or use Open in Mail to hand the email to your mail app.",
  },
  {
    title: "Keep your own templates",
    body: "Click Save as template to keep the current email, or open Templates → Add template to write one or import a .md file. Templates are stored on this device.",
  },
];

/** Toolbar button + dialog explaining how the composer works. */
export function EmailHelp() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="How it works" />} />}>
          <CircleHelp />
        </TooltipTrigger>
        <TooltipContent>How it works</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>How the email composer works</DialogTitle>
          <DialogDescription>Write Markdown, preview it as a branded email, then export or send it.</DialogDescription>
        </DialogHeader>
        <ol className="max-h-[60vh] space-y-4 overflow-auto pr-1 text-sm">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="text-muted-foreground">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
