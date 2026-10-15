import YAML from "yaml";

export type Frontmatter = Record<string, unknown>;

const FENCE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;

export function splitDoc(doc: string): { data: Frontmatter; body: string } {
  const m = doc.match(FENCE);
  if (!m) return { data: {}, body: doc };
  try {
    return { data: (YAML.parse(m[1]) as Frontmatter) ?? {}, body: doc.slice(m[0].length) };
  } catch {
    return { data: {}, body: doc.slice(m[0].length) };
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

/** Update frontmatter keys in a document, leaving the body untouched. */
export function patchDoc(doc: string, patch: Frontmatter): string {
  const { data, body } = splitDoc(doc);
  return joinDoc({ ...data, ...patch }, body);
}
