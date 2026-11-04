import { useMemo, useState } from "react";
import { LayoutTemplate, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EMAIL_LANGS, TEMPLATE_INFO, parseTemplate } from "./fields";
import { USER_PREFIX, isUserTemplate, type UserTemplate } from "./user-templates";

type Entry = { file: string; name: string; description: string; lang: string };

function describe(file: string, user: UserTemplate[]): Entry {
  if (isUserTemplate(file)) {
    const t = user.find((u) => USER_PREFIX + u.id === file);
    return { file, lang: t?.lang ?? "en", name: t?.name ?? "Template", description: "Your saved template." };
  }
  const { base, lang } = parseTemplate(file);
  const info = TEMPLATE_INFO[base]?.[lang === "zh" ? "zh" : "en"];
  const fallback = base.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return {
    file,
    lang,
    name: info?.name ?? fallback,
    description: info?.description ?? (lang === "zh" ? "自定义模板。" : "Custom template."),
  };
}

/** Language filter, replace-confirm bar and card grid for choosing a bundled template. */
export function TemplateGallery({
  templates,
  dirty,
  onPick,
  onBlank,
  userTemplates = [],
  onDeleteUser,
}: {
  templates: string[];
  /** Templates the user saved; listed first. */
  userTemplates?: UserTemplate[];
  onDeleteUser?: (id: string) => void;
  /** The current draft has edits that picking a template would overwrite. */
  dirty: boolean;
  onPick: (file: string) => void;
  /** Adds a "Blank email" card in front of the templates. */
  onBlank?: () => void;
}) {
  const [lang, setLang] = useState<string>("all");
  const [pending, setPending] = useState<Entry | null>(null);
  const entries = useMemo(
    () => [...userTemplates.map((u) => USER_PREFIX + u.id), ...templates].map((f) => describe(f, userTemplates)),
    [templates, userTemplates],
  );
  const shown = lang === "all" ? entries : entries.filter((e) => e.lang === lang);

  function choose(e: Entry) {
    if (dirty && pending?.file !== e.file) return setPending(e);
    onPick(e.file);
  }

  return (
    <>
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

      {shown.length === 0 && !onBlank ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No templates available.</p>
      ) : (
        <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {onBlank && (
            <button
              type="button"
              onClick={onBlank}
              className="flex flex-col gap-1.5 rounded-lg border border-dashed p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium">Blank email</span>
              <span className="text-sm text-muted-foreground">Start from an empty message.</span>
            </button>
          )}
          {shown.map((e) => (
            <div key={e.file} className="relative">
              <button
                type="button"
                onClick={() => choose(e)}
                className="flex h-full w-full flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 pr-6">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="outline">{EMAIL_LANGS.find((l) => l.value === e.lang)?.label ?? e.lang}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">{e.description}</span>
              </button>
              {isUserTemplate(e.file) && onDeleteUser && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2 top-2"
                  aria-label={`Delete template ${e.name}`}
                  onClick={() => onDeleteUser(e.file.slice(USER_PREFIX.length))}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Toolbar button + dialog gallery for starting a draft from one of the bundled templates. */
export function TemplatePicker({
  templates,
  dirty,
  onPick,
  userTemplates,
  onDeleteUser,
}: {
  templates: string[];
  dirty: boolean;
  onPick: (file: string) => void;
  userTemplates?: UserTemplate[];
  onDeleteUser?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Templates" />} />}>
          <LayoutTemplate />
        </TooltipTrigger>
        <TooltipContent>Templates</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>Pick a ready-made layout. You can change every detail afterwards.</DialogDescription>
        </DialogHeader>
        {/* Remounted per open so the replace-confirm state resets when the dialog closes. */}
        {open && <TemplateGallery templates={templates} dirty={dirty} userTemplates={userTemplates} onDeleteUser={onDeleteUser} onPick={(f) => { setOpen(false); onPick(f); }} />}
      </DialogContent>
    </Dialog>
  );
}
