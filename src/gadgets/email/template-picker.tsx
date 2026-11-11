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
import { t, useT } from "@/i18n";

type Entry = { file: string; name: string; description: string; lang: string };

const LANG_KEY = "ntopia.email-composer.lang";
type Lang = (typeof EMAIL_LANGS)[number]["value"];

function rememberedLang(): Lang {
  const raw = readPref(LANG_KEY);
  return EMAIL_LANGS.find((l) => l.value === raw)?.value ?? "en";
}

function describe(file: string, user: UserTemplate[]): Entry {
  if (isUserTemplate(file)) {
    const mine = user.find((u) => USER_PREFIX + u.id === file);
    return { file, lang: mine?.lang ?? "en", name: mine?.name ?? "Template", description: t("email.tpl.yourSaved") };
  }
  const { base, lang } = parseTemplate(file);
  const info = TEMPLATE_INFO[base]?.[lang === "zh" ? "zh" : "en"];
  const fallback = base.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return {
    file,
    lang,
    name: info?.name ?? fallback,
    description: info?.description ?? t("email.tpl.custom"),
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
  const tr = useT();
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
        <p className="text-sm font-medium">{tr("email.tpl.step1")}</p>
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
                  {tr(count === 1 ? "email.tpl.count1" : "email.tpl.countN", { n: count })}
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
          <ChevronLeft /> {tr("email.tpl.changeLang")}
        </Button>
        <p className="text-sm font-medium">{tr("email.tpl.step2")}</p>
        <Badge variant="secondary">{langLabel(lang)}</Badge>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span className="mr-auto">{tr("email.tpl.replaceDraft", { name: pending.name })}</span>
          <Button size="sm" variant="outline" onClick={() => setPending(null)}>{tr("common.cancel")}</Button>
          <Button size="sm" onClick={() => choose(pending)}>{tr("email.tpl.replace")}</Button>
        </div>
      )}

      <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {onBlank && (
          <button
            type="button"
            onClick={() => onBlank(lang)}
            className="flex flex-col gap-1.5 rounded-lg border border-dashed p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium">{tr("email.tpl.blank")}</span>
            <span className="text-sm text-muted-foreground">{tr("email.tpl.blankDesc")}</span>
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
                  <Badge variant={mine ? "secondary" : "outline"}>{mine ? tr("email.tpl.yours") : tr("email.tpl.default")}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">{e.description}</span>
              </button>
              {mine && onDeleteUser && (
                confirmDelete === e.file ? (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs shadow-sm">
                    <span className="px-1">{tr("email.tpl.deleteQ")}</span>
                    <Button size="xs" variant="destructive" onClick={() => { setConfirmDelete(null); onDeleteUser(e.file.slice(USER_PREFIX.length)); }}>{tr("common.yes")}</Button>
                    <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(null)}>{tr("common.no")}</Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2 top-2"
                    aria-label={tr("email.tpl.deleteAria", { name: e.name })}
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
            <span className="flex items-center gap-1.5 font-medium"><Plus className="size-4" /> {tr("email.tpl.add")}</span>
            <span className="text-sm text-muted-foreground">{tr("email.tpl.addDesc")}</span>
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
  const tr = useT();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tr("email.tpl.title")} />} />}>
          <LayoutTemplate />
        </TooltipTrigger>
        <TooltipContent>{tr("email.tpl.title")}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tr("email.tpl.startFrom")}</DialogTitle>
          <DialogDescription>{tr("email.tpl.startFromHint")}</DialogDescription>
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
