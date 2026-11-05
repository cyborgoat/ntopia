import type { EditorView } from "@codemirror/view";
import { findFrontmatter, splitDoc } from "./frontmatter";

/** Frontmatter keys whose value is an image (a host's `photo`, etc.). */
const IMAGE_KEYS = new Set(["photo", "image", "avatar"]);
const MD_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Remote (`https:`), embedded (`data:`) and absolute references are not part of the image library. */
const isLibraryRef = (ref: string) => !HAS_SCHEME.test(ref) && !ref.startsWith("/") && !ref.startsWith("//");

const normalize = (ref: string) => ref.trim().replace(/^\.\//, "");

function collect(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => collect(v, out));
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (IMAGE_KEYS.has(key) && typeof v === "string") out.add(v);
      else collect(v, out);
    }
  }
}

/** Work-relative images the email refers to: host photos in the frontmatter and `![](…)` images in the body. */
export function localImageRefs(doc: string): string[] {
  const { data, body } = splitDoc(doc);
  const refs = new Set<string>();
  collect(data, refs);
  for (const m of body.matchAll(MD_IMAGE)) refs.add(m[1]);
  return [...refs].map(normalize).filter((r) => r && isLibraryRef(r));
}

const needsQuotes = (v: string) => /\s|#|: |^[[\]{}&*!|>'"%@`-]/.test(v);

const PHOTO_LINE = /^(\s*(?:-\s+)?(?:photo|image|avatar)\s*:\s*)(.*)$/;

type InsertResult = "field" | "body" | "body-start";

/**
 * Put an image reference into the editor. On a `photo:` / `image:` / `avatar:` line of the frontmatter it sets
 * that value; anywhere else it inserts a Markdown image. The cursor is never left inside the frontmatter, so
 * an image can't end up in the YAML, and a collapsed frontmatter (cursor at the very start) goes to the body.
 */
export function insertImageRef(view: EditorView, ref: string, alt = "image"): InsertResult {
  const state = view.state;
  const { from, to } = state.selection.main;
  const fm = findFrontmatter(state.doc.toString());

  if (fm && from >= fm.innerFrom && from < fm.innerTo) {
    const line = state.doc.lineAt(from);
    const m = PHOTO_LINE.exec(line.text);
    if (m) {
      const value = needsQuotes(ref) ? JSON.stringify(ref) : ref;
      const start = line.from + m[1].length;
      view.dispatch({ changes: { from: start, to: line.to, insert: value }, selection: { anchor: start + value.length }, scrollIntoView: true });
      view.focus();
      return "field";
    }
  }

  const text = `![${alt.replace(/[[\]]/g, "")}](${ref})\n`;
  if (fm && from < fm.end) {
    // Inside (or collapsed over) the frontmatter: add at the start of the body instead.
    const lead = state.doc.sliceString(fm.end, fm.end + 1) === "\n" || fm.end >= state.doc.length ? "" : "\n";
    const insert = `${lead}${text}`;
    view.dispatch({ changes: { from: fm.end, insert }, selection: { anchor: fm.end + insert.length }, scrollIntoView: true });
    view.focus();
    return "body-start";
  }
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
  view.focus();
  return "body";
}
