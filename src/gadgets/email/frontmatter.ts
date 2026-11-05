import YAML from "yaml";
import { EMAIL_LANGS, EMAIL_TYPES, THEME_PRESETS } from "./fields";

export type Frontmatter = Record<string, unknown>;

const OPEN = /^---[ \t]*\r?\n/;
const CLOSE = /^---[ \t]*(?:\r?\n|$)/gm;

type FrontmatterBlock = {
  /** Offset just after the opening `---` line. */
  innerFrom: number;
  /** Offset where the closing `---` line starts. */
  innerTo: number;
  /** Offset just after the closing `---` line (where the body begins). */
  end: number;
  /** The YAML between the fences. */
  text: string;
};

/** Locate the leading `---` … `---` block, or null when the document has none. */
export function findFrontmatter(doc: string): FrontmatterBlock | null {
  const open = OPEN.exec(doc);
  if (!open) return null;
  CLOSE.lastIndex = open[0].length;
  const close = CLOSE.exec(doc);
  if (!close) return null;
  const innerFrom = open[0].length;
  return { innerFrom, innerTo: close.index, end: close.index + close[0].length, text: doc.slice(innerFrom, close.index) };
}

function asRecord(v: unknown): Frontmatter | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Frontmatter) : null;
}

export function splitDoc(doc: string): { data: Frontmatter; body: string } {
  const fm = findFrontmatter(doc);
  if (!fm) return { data: {}, body: doc };
  try {
    return { data: asRecord(YAML.parse(fm.text)) ?? {}, body: doc.slice(fm.end) };
  } catch {
    return { data: {}, body: doc.slice(fm.end) };
  }
}

/**
 * Serialize frontmatter as YAML 1.1-safe text. mdmailer parses with gray-matter (js-yaml, YAML 1.1),
 * where unquoted `15:00` is the integer 900 and `yes` is `true`, so ambiguous strings must be quoted.
 */
export function stringifyMeta(data: Frontmatter): string {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v != null));
  if (Object.keys(clean).length === 0) return "";
  return YAML.stringify(clean, { version: "1.1", lineWidth: 0 }).trimEnd();
}

export function joinDoc(data: Frontmatter, body: string): string {
  return `---\n${stringifyMeta(data)}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

// ---------------------------------------------------------------------------------------------
// Validation. One checker feeds both the editor's lint and the render-time defaults, so what the
// user is warned about is exactly what the preview and exports quietly fix up.
// ---------------------------------------------------------------------------------------------

const DEFAULT_TYPE = "news";
const TYPES: string[] = EMAIL_TYPES.map((t) => t.value);
const LANGS: string[] = EMAIL_LANGS.map((l) => l.value);
const THEMES: string[] = [...THEME_PRESETS];

// Same aliases mdmailer-core accepts (resolveLocale).
const LANG_ALIASES: Record<string, string> = {
  zh: "zh", "zh-cn": "zh", "zh-hans": "zh", chinese: "zh",
  en: "en", "en-us": "en", english: "en",
};

const CJK = /[぀-ヿ㐀-鿿가-힯]/;
/** Best guess at the email language from its text. */
const inferLang = (text: string) => (CJK.test(text) ? "zh" : "en");

type Fix = { label: string; from: number; to: number; insert: string };
export type Issue = {
  severity: "error" | "warning";
  message: string;
  /** Range to underline, in document offsets. */
  from: number;
  to: number;
  fix?: Fix;
  /** True when preview and export apply `fix` on their own, so a missing field never blocks rendering. */
  defaulted?: boolean;
};

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** The allowed value closest to `value`, if it is plausibly a typo of it. */
function closest(value: string, allowed: string[]): string | undefined {
  const v = value.toLowerCase().trim();
  let best: { word: string; d: number } | undefined;
  for (const word of allowed) {
    const d = distance(v, word);
    if (!best || d < best.d) best = { word, d };
  }
  return best && best.d <= Math.max(1, Math.min(2, Math.floor(best.word.length / 2))) ? best.word : undefined;
}

/** Offsets of the top-level `key: value` line (relative to `text`), or null if it is not written that way. */
function keyLine(text: string, key: string): { from: number; to: number } | null {
  const m = new RegExp(`^${key}[ \\t]*:.*$`, "m").exec(text);
  return m ? { from: m.index, to: m.index + m[0].length } : null;
}

type FieldSpec = {
  /** Frontmatter keys mdmailer reads for this field, in priority order; the first is written by fixes. */
  keys: string[];
  /** Normalize a raw value to an allowed one, or undefined if it isn't allowed. */
  resolve: (raw: string) => string | undefined;
  allowed: string[];
  noun: string;
};

const SPECS: Record<"type" | "lang", FieldSpec> = {
  type: {
    keys: ["type"],
    resolve: (raw) => (TYPES.includes(raw.toLowerCase().trim()) ? raw.toLowerCase().trim() : undefined),
    allowed: TYPES,
    noun: "type",
  },
  lang: {
    keys: ["lang", "locale", "language"],
    resolve: (raw) => LANG_ALIASES[raw.toLowerCase().trim()],
    allowed: LANGS,
    noun: "language",
  },
};

/** Problems with the document's frontmatter, most important first. Pure: no rendering involved. */
export function checkDoc(doc: string): Issue[] {
  const lang = inferLang(doc);
  const fm = findFrontmatter(doc);

  if (!fm) {
    return [{
      severity: "warning",
      message: `No frontmatter — the email needs a type and a language. Using ${DEFAULT_TYPE} / ${lang}.`,
      from: 0,
      to: Math.min(doc.length, doc.indexOf("\n") < 0 ? doc.length : doc.indexOf("\n")),
      fix: { label: "Add frontmatter", from: 0, to: 0, insert: `---\ntype: ${DEFAULT_TYPE}\nlang: ${lang}\n---\n\n` },
      defaulted: true,
    }];
  }

  const openLine = { from: 0, to: Math.max(0, fm.innerFrom - 1) };
  const ydoc = YAML.parseDocument(fm.text);
  if (ydoc.errors.length) {
    return ydoc.errors.map((e) => ({
      severity: "error" as const,
      message: e.message.split("\n")[0].replace(/ at line \d+.*$/, ""),
      from: fm.innerFrom + Math.min(e.pos[0], fm.text.length),
      to: fm.innerFrom + Math.min(Math.max(e.pos[1], e.pos[0] + 1), fm.text.length),
    }));
  }
  const data = asRecord(ydoc.toJS()) ?? (fm.text.trim() === "" ? {} : null);
  if (!data) {
    return [{ severity: "error", message: "Frontmatter must be `key: value` lines.", ...openLine }];
  }

  const issues: Issue[] = [];
  const field = (name: "type" | "lang", suggestedMissing: string) => {
    const spec = SPECS[name];
    const key = spec.keys.find((k) => data[k] != null && String(data[k]).trim() !== "");
    const insertFix = (value: string): Fix => ({ label: `Set ${name}: ${value}`, from: fm.innerFrom, to: fm.innerFrom, insert: `${name}: ${value}\n` });

    if (!key) {
      // Present-but-empty (`type:`) must be replaced, not duplicated.
      const empty = keyLine(fm.text, name);
      const fix: Fix = empty
        ? { label: `Set ${name}: ${suggestedMissing}`, from: fm.innerFrom + empty.from, to: fm.innerFrom + empty.to, insert: `${name}: ${suggestedMissing}` }
        : insertFix(suggestedMissing);
      issues.push({
        severity: "warning",
        message: `No ${spec.noun} set — using ${suggestedMissing}.`,
        ...(empty ? { from: fm.innerFrom + empty.from, to: fm.innerFrom + empty.to } : openLine),
        fix,
        defaulted: true,
      });
      return;
    }
    const raw = String(data[key]);
    if (spec.resolve(raw)) return;
    const guess = closest(raw, spec.allowed) ?? suggestedMissing;
    const line = keyLine(fm.text, key);
    const hint = closest(raw, spec.allowed) ? ` Did you mean "${guess}"?` : ` Use ${spec.allowed.join(", ")}.`;
    issues.push({
      severity: "warning",
      message: `Unknown ${spec.noun} "${raw}".${hint} Using ${guess} for now.`,
      ...(line ? { from: fm.innerFrom + line.from, to: fm.innerFrom + line.to } : openLine),
      fix: line
        ? { label: `Change to ${key}: ${guess}`, from: fm.innerFrom + line.from, to: fm.innerFrom + line.to, insert: `${key}: ${guess}` }
        : insertFix(guess),
      defaulted: Boolean(line),
    });
  };
  field("type", DEFAULT_TYPE);
  field("lang", lang);

  // Themes can also be objects with custom colors; only a bare name can be checked.
  if (typeof data.theme === "string" && !THEMES.includes(data.theme)) {
    const line = keyLine(fm.text, "theme");
    const guess = closest(data.theme, THEMES);
    issues.push({
      severity: "warning",
      message: `Unknown theme "${data.theme}".${guess ? ` Did you mean "${guess}"?` : ` Use ${THEMES.join(", ")}.`}`,
      ...(line ? { from: fm.innerFrom + line.from, to: fm.innerFrom + line.to } : openLine),
      fix: guess && line ? { label: `Change to theme: ${guess}`, from: fm.innerFrom + line.from, to: fm.innerFrom + line.to, insert: `theme: ${guess}` } : undefined,
    });
  }

  // gray-matter reads an unquoted `15:00` as the number 900 (YAML 1.1), so times need quotes.
  if (YAML.isMap(ydoc.contents)) {
    for (const pair of ydoc.contents.items) {
      const node = pair.value;
      if (!YAML.isScalar(node) || node.type !== "PLAIN" || !node.range) continue;
      const raw = fm.text.slice(node.range[0], node.range[1]);
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) continue;
      const from = fm.innerFrom + node.range[0];
      issues.push({
        severity: "warning",
        message: `Unquoted ${raw} is read as a number. Wrap it in quotes.`,
        from,
        to: fm.innerFrom + node.range[1],
        fix: { label: `Quote "${raw}"`, from, to: fm.innerFrom + node.range[1], insert: `"${raw}"` },
      });
    }
  }
  return issues;
}

/**
 * Fill in what's missing or misspelled in `type` and `lang` so the email still renders. Only the text is
 * patched (the user's YAML is never re-serialized); `applied` lists what was changed, for a warning.
 */
export function withDefaults(doc: string): { text: string; applied: string[] } {
  const fixes = checkDoc(doc).filter((i) => i.defaulted && i.fix);
  if (!fixes.length) return { text: doc, applied: [] };
  // Back to front so earlier offsets stay valid; a replacement goes before an insertion at the same spot.
  const edits = fixes.map((i) => i.fix!).sort((a, b) => b.from - a.from || b.to - a.to);
  let text = doc;
  for (const e of edits) text = text.slice(0, e.from) + e.insert + text.slice(e.to);
  return { text, applied: fixes.map((i) => i.message) };
}
