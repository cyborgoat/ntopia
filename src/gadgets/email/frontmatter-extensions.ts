import { autocompletion, snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { linter, type Diagnostic } from "@codemirror/lint";
import { StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { EMAIL_LANGS, EMAIL_TYPES, THEME_PRESETS, isEventType, typeFields } from "./fields";
import { checkDoc, findFrontmatter, splitDoc } from "./frontmatter";
import { t, type MessageKey } from "@/i18n";

// ---------------------------------------------------------------------------------------------
// Folding: the frontmatter collapses to a one-line summary chip; click it (or use the toolbar) to edit.
// ---------------------------------------------------------------------------------------------

const setFolded = StateEffect.define<boolean>();

function summarize(doc: string, warn: boolean): string {
  const { data } = splitDoc(doc);
  const type = String(data.type ?? "").toLowerCase().trim();
  const typeLabel = EMAIL_TYPES.find((x) => x.value === type)?.label;
  const label = typeLabel ? t(typeLabel) : (type || t("email.noType"));
  const date = data.date ?? data.startsAt;
  const parts = [label, data.lang ?? data.locale ?? data.language, date, data.title].filter((p) => p != null && String(p).trim() !== "");
  return `${warn ? "⚠ " : ""}${parts.join(" · ")}`;
}

class SummaryWidget extends WidgetType {
  constructor(readonly text: string, readonly warn: boolean) {
    super();
  }
  eq(other: SummaryWidget) {
    return other.text === this.text && other.warn === this.warn;
  }
  toDOM(view: EditorView) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cm-frontmatter-chip" + (this.warn ? " cm-frontmatter-chip-warn" : "");
    chip.title = t("email.chipTitle");
    chip.textContent = this.text;
    chip.onmousedown = (e) => e.preventDefault();
    chip.onclick = () => {
      view.dispatch({ effects: setFolded.of(false) });
      view.focus();
    };
    return chip;
  }
  ignoreEvent() {
    return true;
  }
}

type FoldState = { folded: boolean; decos: DecorationSet };

function build(doc: string, folded: boolean): FoldState {
  const fm = findFrontmatter(doc);
  if (!fm || !folded) return { folded: fm ? folded : false, decos: Decoration.none };
  // Hide both fences; keep the line break after the closing one so the body stays on its own line.
  const to = doc[fm.end - 1] === "\n" ? fm.end - (doc[fm.end - 2] === "\r" ? 2 : 1) : fm.end;
  const warn = checkDoc(doc).length > 0;
  const deco = Decoration.replace({ widget: new SummaryWidget(summarize(doc, warn), warn), block: true }).range(0, to);
  return { folded, decos: Decoration.set([deco]) };
}

const foldField = StateField.define<FoldState>({
  // A document opened with frontmatter starts expanded.
  create: (state) => build(state.doc.toString(), false),
  update(value, tr) {
    let folded = value.folded;
    for (const e of tr.effects) if (e.is(setFolded)) folded = e.value;
    if (!tr.docChanged && folded === value.folded) return value;
    return build(tr.state.doc.toString(), folded);
  },
  provide: (f) => [
    EditorView.decorations.from(f, (v) => v.decos),
    EditorView.atomicRanges.of((view) => view.state.field(f).decos),
  ],
});

/** True when the document has frontmatter and it is expanded for editing. */
export function isFrontmatterOpen(state: EditorState): boolean {
  return !state.field(foldField).folded && findFrontmatter(state.doc.toString()) !== null;
}

/** Whether there is a frontmatter block to show or hide. */
export function hasFrontmatter(state: EditorState): boolean {
  return findFrontmatter(state.doc.toString()) !== null;
}

/** Show or hide the frontmatter block. */
export function toggleFrontmatter(view: EditorView) {
  if (!hasFrontmatter(view.state)) return;
  view.dispatch({ effects: setFolded.of(!view.state.field(foldField).folded) });
}

const chipTheme = EditorView.baseTheme({
  ".cm-frontmatter-chip": {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    margin: "4px 0",
    padding: "2px 10px",
    border: "1px solid var(--border, rgba(128,128,128,.35))",
    borderRadius: "6px",
    background: "var(--muted, rgba(128,128,128,.12))",
    color: "var(--muted-foreground, inherit)",
    font: "inherit",
    fontSize: "0.85em",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-frontmatter-chip:hover": { color: "var(--foreground, inherit)" },
  ".cm-frontmatter-chip-warn": { borderColor: "rgba(217,119,6,.6)" },
});

// ---------------------------------------------------------------------------------------------
// Autocomplete between the fences: keys at the start of a line, values after `type:`, `lang:`, `theme:`.
// ---------------------------------------------------------------------------------------------

const BASE_KEYS: { key: string; detail: MessageKey }[] = [
  { key: "title", detail: "email.key.title" },
  { key: "type", detail: "email.key.type" },
  { key: "lang", detail: "email.key.lang" },
  { key: "theme", detail: "email.key.theme" },
];

function keyCompletions(doc: string, present: Set<string>): Completion[] {
  const type = String(splitDoc(doc).data.type ?? "").toLowerCase().trim();
  const options: Completion[] = BASE_KEYS.map(({ key, detail }) => ({ label: key, detail: t(detail), apply: `${key}: `, type: "property" }));
  for (const f of typeFields(type)) options.push({ label: f.key, detail: t(f.label), apply: `${f.key}: `, type: "property" });
  if (isEventType(type)) {
    options.push(
      snippetCompletion("hosts:\n  - name: ${}\n    role: ${}", { label: "hosts", detail: t("email.key.hosts"), type: "property" }),
      snippetCompletion("agenda:\n  - time: ${}\n    title: ${}", { label: "agenda", detail: t("email.key.agenda"), type: "property" }),
    );
  }
  return options.filter((o) => !present.has(o.label));
}

const VALUES: Record<string, Completion[]> = {
  type: EMAIL_TYPES.map((x) => ({ label: x.value, detail: t(x.label), info: t(x.description), type: "enum" })),
  lang: EMAIL_LANGS.map((l) => ({ label: l.value, detail: l.label, type: "enum" })),
  theme: THEME_PRESETS.map((t) => ({ label: t, type: "enum" })),
};

function frontmatterCompletions(context: CompletionContext): CompletionResult | null {
  const doc = context.state.doc.toString();
  const fm = findFrontmatter(doc);
  if (!fm || context.pos < fm.innerFrom || context.pos >= fm.innerTo) return null;
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const value = /^([A-Za-z]\w*)[ \t]*:[ \t]*([\w-]*)$/.exec(before);
  if (value) {
    const options = VALUES[value[1]];
    return options ? { from: context.pos - value[2].length, options, validFor: /^[\w-]*$/ } : null;
  }
  const key = /^[A-Za-z]*$/.exec(before);
  if (key && (key[0] !== "" || context.explicit)) {
    const present = new Set(fm.text.split(/\r?\n/).map((l) => /^([A-Za-z]\w*)\s*:/.exec(l)?.[1]).filter((k): k is string => !!k));
    return { from: line.from, options: keyCompletions(doc, present), validFor: /^[A-Za-z]*$/ };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Lint: the shared checker in frontmatter.ts, shown as underlines with one-click fixes.
// ---------------------------------------------------------------------------------------------

const frontmatterLinter = linter(
  (view): Diagnostic[] =>
    checkDoc(view.state.doc.toString()).map((issue) => ({
      from: issue.from,
      to: Math.max(issue.to, issue.from),
      severity: issue.severity,
      message: issue.message,
      actions: issue.fix
        ? [{ name: issue.fix.label, apply: (v, _from, _to) => v.dispatch({ changes: { from: issue.fix!.from, to: issue.fix!.to, insert: issue.fix!.insert } }) }]
        : undefined,
    })),
  { delay: 400 },
);

/** Everything the unified editor needs for the leading frontmatter block. */
export function frontmatterExtensions(onChange?: (open: boolean, available: boolean) => void): Extension[] {
  const notify = EditorView.updateListener.of((u) => {
    if (!onChange) return;
    const open = isFrontmatterOpen(u.state);
    const available = hasFrontmatter(u.state);
    if (open !== isFrontmatterOpen(u.startState) || available !== hasFrontmatter(u.startState)) onChange(open, available);
  });
  return [foldField, chipTheme, autocompletion({ override: [frontmatterCompletions] }), frontmatterLinter, notify];
}
