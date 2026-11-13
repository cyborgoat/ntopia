import { useState } from "react";
import { CircleHelp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT, type MessageKey } from "@/i18n";
import { cn, copyText } from "@/lib/utils";
import { buildEmailPrompt, buildGuide } from "./email-guide";
import { EMAIL_TYPES } from "./fields";

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const TABS = [
  { id: "how", label: "email.help.tab.how" },
  { id: "write", label: "email.help.tab.write" },
] as const satisfies readonly { id: string; label: MessageKey }[];
type TabId = (typeof TABS)[number]["id"];

function HowItWorks() {
  const tr = useT();
  const key = (n: number, part: "title" | "body") => `email.help.s${n}.${part}` as MessageKey;
  return (
    <ol className="space-y-4 text-sm">
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
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-xs leading-relaxed">{children}</pre>;
}

function WritingGuide() {
  useT(); // rebuild when the language changes
  return (
    <div className="space-y-5 text-sm">
      {buildGuide().map((s) => (
        <section key={s.title} className="space-y-2">
          <h3 className="font-medium">{s.title}</h3>
          {s.text && <p className="text-muted-foreground">{s.text}</p>}
          {s.rows && (
            <dl className="divide-y rounded-md border">
              {s.rows.map((r) => (
                <div key={r.code} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
                  <dt><code className="whitespace-pre-wrap break-words text-xs">{r.code}</code></dt>
                  <dd className="text-muted-foreground">{r.desc}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.code && <Code>{s.code}</Code>}
        </section>
      ))}
    </div>
  );
}

/** Toolbar button + dialog: how the composer works, and a complete guide to writing the Markdown file. */
export function EmailHelp() {
  const tr = useT();
  const [tab, setTab] = useState<TabId>("how");

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tr("email.help.tip")} />} />}>
          <CircleHelp />
        </TooltipTrigger>
        <TooltipContent>{tr("email.help.tip")}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-10">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle>{tr("email.help.title")}</DialogTitle>
            {tab === "write" && (
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copyText(buildEmailPrompt(), tr("email.help.prompt.label"))}>
                <Copy /> {tr("email.help.prompt.button")}
              </Button>
            )}
          </div>
          <DialogDescription>{tr("email.help.desc")}</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="flex gap-1 border-b">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === x.id ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tr(x.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="max-h-[60vh] overflow-auto pr-1">
          {tab === "how" ? <HowItWorks /> : <WritingGuide />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
