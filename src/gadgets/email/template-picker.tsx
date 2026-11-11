import { useMemo, useState } from "react";
import { ChevronLeft, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readPref, writePref } from "@/lib/prefs";
import { AddTemplate } from "./add-template";
import { EMAIL_LANGS, TEMPLATE_INFO, parseTemplate } from "./fields";
import { USER_PREFIX, isUserTemplate, type UserTemplate } from "./user-templates";

type Entry = { file: string; name: string; description: string; lang: string };

const LANG_KEY = "ntopia.email-composer.lang";
type Lang = (typeof EMAIL_LANGS)[number]["value"];

function rememberedLang(): Lang {
  const raw = readPref(LANG_KEY);
  return EMAIL_LANGS.find((l) => l.value === raw)?.value ?? "en";
}

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

const langLabel = (lang: string) => EMAIL_LANGS.find((l) => l.value === lang)?.label ?? lang;

/** Two steps: choose a language, then a template card in that language. */
export function TemplateGallery({
  templates,
  dirty,
  onPick,
  onBlank,
  userTemplates = [],
  onDeleteUser,
  onAddUser,
}: {
  templates: string[];
  /** Templates the user saved; listed first. Bundled templates can't be deleted. */
  userTemplates?: UserTemplate[];
  onDeleteUser?: (id: string) => void;
  /** Saves a template the user wrote or imported. */
  onAddUser?: (name: string, doc: string, lang: string) => void;
  /** The current draft has edits that picking a template would overwrite. */
  dirty: boolean;
  onPick: (file: string) => void;
  /** Adds a "Blank email" card in front of the templates; receives the chosen language. */
  onBlank?: (lang: string) => void;
}) {
  const [step, setStep] = useState<"language" | "cards">("language");
  const [lang, setLang] = useState<Lang>(rememberedLang);
  const [pending, setPending] = useState<Entry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const entries = useMemo(
    () => [...userTemplates.map((u) => USER_PREFIX + u.id), ...templates].map((f) => describe(f, userTemplates)),
    [templates, userTemplates],
  );
  const shown = entries.filter((e) => e.lang === lang);

  function chooseLang(next: Lang) {
    setLang(next);
    writePref(LANG_KEY, next);
    setPending(null);
    setConfirmDelete(null);
    setStep("cards");
  }

  function choose(e: Entry) {
    if (dirty && pending?.file !== e.file) return setPending(e);
    onPick(e.file);
  }

  if (step === "language") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">1. Choose a language</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {EMAIL_LANGS.map((l) => {
            const count = entries.filter((e) => e.lang === l.value).length;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => chooseLang(l.value)}
                className="flex flex-col gap-1 rounded-lg border p-5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground/40 aria-pressed:bg-muted/40"
                aria-pressed={lang === l.value}
              >
                <span className="text-lg font-semibold">{l.label}</span>
                <span className="text-sm text-muted-foreground">
                  {count} template{count === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setPending(null); setStep("language"); }}>
          <ChevronLeft /> Change language
        </Button>
        <p className="text-sm font-medium">2. Pick a template</p>
        <Badge variant="secondary">{langLabel(lang)}</Badge>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span className="mr-auto">Replace your current draft with “{pending.name}”?</span>
          <Button size="sm" variant="outline" onClick={() => setPending(null)}>Cancel</Button>
          <Button size="sm" onClick={() => choose(pending)}>Replace</Button>
        </div>
      )}

      <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {onBlank && (
          <button
            type="button"
            onClick={() => onBlank(lang)}
            className="flex flex-col gap-1.5 rounded-lg border border-dashed p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium">Blank email</span>
            <span className="text-sm text-muted-foreground">Start from an empty message.</span>
          </button>
        )}
        {shown.map((e) => {
          const mine = isUserTemplate(e.file);
          return (
            <div key={e.file} className="relative">
              <button
                type="button"
                onClick={() => choose(e)}
                className="flex h-full w-full flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 pr-6">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant={mine ? "secondary" : "outline"}>{mine ? "Yours" : "Default"}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">{e.description}</span>
              </button>
              {mine && onDeleteUser && (
                confirmDelete === e.file ? (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs shadow-sm">
                    <span className="px-1">Delete?</span>
                    <Button size="xs" variant="destructive" onClick={() => { setConfirmDelete(null); onDeleteUser(e.file.slice(USER_PREFIX.length)); }}>Yes</Button>
                    <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2 top-2"
                    aria-label={`Delete template ${e.name}`}
                    onClick={() => setConfirmDelete(e.file)}
                  >
                    <Trash2 />
                  </Button>
                )
              )}
            </div>
          );
        })}
        {onAddUser && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-1.5 font-medium"><Plus className="size-4" /> Add template</span>
            <span className="text-sm text-muted-foreground">Write or import your own.</span>
          </button>
        )}
      </div>

      {onAddUser && (
        <AddTemplate
          open={adding}
          onOpenChange={setAdding}
          lang={lang}
          existingNames={userTemplates.map((t) => t.name)}
          onSave={onAddUser}
        />
      )}
    </div>
  );
}

/** Toolbar button + dialog gallery for starting a draft from a template. */
export function TemplatePicker({
  templates,
  dirty,
  onPick,
  userTemplates,
  onDeleteUser,
  onAddUser,
}: {
  templates: string[];
  dirty: boolean;
  onPick: (file: string) => void;
  userTemplates?: UserTemplate[];
  onDeleteUser?: (id: string) => void;
  onAddUser?: (name: string, doc: string, lang: string) => void;
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
          <DialogDescription>Pick a language, then a ready-made layout. You can change every detail afterwards.</DialogDescription>
        </DialogHeader>
        {/* Remounted per open so the step and confirm state reset when the dialog closes. */}
        {open && (
          <TemplateGallery
            templates={templates}
            dirty={dirty}
            userTemplates={userTemplates}
            onDeleteUser={onDeleteUser}
            onAddUser={onAddUser}
            onPick={(f) => { setOpen(false); onPick(f); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
