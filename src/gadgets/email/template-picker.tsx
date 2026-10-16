import { useMemo, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EMAIL_LANGS, TEMPLATE_INFO, parseTemplate } from "./fields";

type Entry = { file: string; name: string; description: string; lang: string };

function describe(file: string): Entry {
  const { base, lang } = parseTemplate(file);
  const info = TEMPLATE_INFO[base];
  const fallback = base.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { file, lang, name: info?.name ?? fallback, description: info?.description ?? "Custom template." };
}

/** Toolbar button + dialog gallery for starting a draft from one of the bundled templates. */
export function TemplatePicker({
  templates,
  dirty,
  onPick,
}: {
  templates: string[];
  /** The current draft has edits that picking a template would overwrite. */
  dirty: boolean;
  onPick: (file: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<string>("all");
  const [pending, setPending] = useState<Entry | null>(null);
  const entries = useMemo(() => templates.map(describe), [templates]);
  const shown = lang === "all" ? entries : entries.filter((e) => e.lang === lang);

  function choose(e: Entry) {
    if (dirty && pending?.file !== e.file) return setPending(e);
    setOpen(false);
    onPick(e.file);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPending(null); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <LayoutTemplate /> Templates
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>Pick a ready-made layout. You can change every detail afterwards.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1" role="group" aria-label="Language">
          {[{ value: "all", label: "All" }, ...EMAIL_LANGS].map((l) => (
            <Button key={l.value} size="sm" variant={lang === l.value ? "secondary" : "ghost"} aria-pressed={lang === l.value} onClick={() => setLang(l.value)}>
              {l.label}
            </Button>
          ))}
        </div>

        {pending && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <span className="mr-auto">Replace your current draft with “{pending.name}”?</span>
            <Button size="sm" variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" onClick={() => choose(pending)}>Replace</Button>
          </div>
        )}

        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No templates available.</p>
        ) : (
          <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2">
            {shown.map((e) => (
              <button
                key={e.file}
                type="button"
                onClick={() => choose(e)}
                className="flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="outline">{EMAIL_LANGS.find((l) => l.value === e.lang)?.label ?? e.lang}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">{e.description}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
