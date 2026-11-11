import { useState } from "react";
import { open as pickFile } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toMessage } from "@/lib/utils";
import { EMAIL_LANGS } from "./fields";
import { joinDoc, splitDoc } from "./frontmatter";
import { useT } from "@/i18n";

const STARTER = "---\ntitle: My template\ntype: news\n---\n\n## Hello\n\nWrite your message…\n";

/** Dialog for adding a template by writing Markdown or importing a .md file. */
export function AddTemplate({
  open,
  onOpenChange,
  lang: initialLang,
  existingNames,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: string;
  existingNames: string[];
  onSave: (name: string, doc: string, lang: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Remounted per open so the form starts fresh. */}
        {open && <Form initialLang={initialLang} existingNames={existingNames} onCancel={() => onOpenChange(false)} onSave={(n, d, l) => { onSave(n, d, l); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  initialLang,
  existingNames,
  onCancel,
  onSave,
}: {
  initialLang: string;
  existingNames: string[];
  onCancel: () => void;
  onSave: (name: string, doc: string, lang: string) => void;
}) {
  const tr = useT();
  const [name, setName] = useState("");
  const [lang, setLang] = useState(EMAIL_LANGS.find((l) => l.value === initialLang)?.value ?? "en");
  const [source, setSource] = useState(STARTER);
  const trimmed = name.trim();
  const replaces = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  async function importFile() {
    try {
      const picked = await pickFile({ filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }] });
      if (!picked || Array.isArray(picked)) return;
      setSource(await readTextFile(picked));
      if (!trimmed) setName((picked.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || !source.trim()) return;
    // The stored language and the document's own `lang` must agree.
    const { data, body } = splitDoc(source);
    onSave(trimmed, joinDoc({ ...data, lang }, body), lang);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{tr("email.tpl.add")}</DialogTitle>
        <DialogDescription>{tr("email.tpl.addHint")}</DialogDescription>
      </DialogHeader>
      <div className="flex gap-3">
        <Input autoFocus aria-label={tr("email.tpl.nameField")} placeholder={tr("email.tpl.nameField")} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex shrink-0 gap-1 rounded-lg border p-1" role="radiogroup" aria-label={tr("settings.language")}>
          {EMAIL_LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={lang === l.value}
              onClick={() => setLang(l.value)}
              className={`rounded-md px-3 text-sm ${lang === l.value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        aria-label={tr("email.tpl.sourceField")}
        className="max-h-[45vh] min-h-48 font-mono text-xs"
        spellCheck={false}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      {replaces && <p className="text-xs text-amber-600 dark:text-amber-400">{tr("email.tpl.exists")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" className="mr-auto" onClick={() => void importFile()}><FileUp /> {tr("email.tpl.import")}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{tr("common.cancel")}</Button>
        <Button type="submit" disabled={!trimmed || !source.trim()}>{replaces ? tr("email.tpl.replace") : tr("common.add")}</Button>
      </DialogFooter>
    </form>
  );
}
