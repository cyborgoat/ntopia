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

export function joinDoc(data: Frontmatter, body: string): string {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v != null));
  return `---\n${YAML.stringify(clean).trimEnd()}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

/** Update frontmatter keys in a document, leaving the body untouched. */
export function patchDoc(doc: string, patch: Frontmatter): string {
  const { data, body } = splitDoc(doc);
  return joinDoc({ ...data, ...patch }, body);
}
