import type { Frontmatter } from "./frontmatter";

const DRAFT_KEY = "ntopia.email-composer.draft";

export type Draft = {
  meta: Frontmatter;
  body: string;
  /** The document as last loaded (blank or a template); anything else counts as an unsaved edit. */
  baseline: string;
};

/** The saved draft, or null when the user has not started one yet. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (d.meta && typeof d.body === "string" && typeof d.baseline === "string") return d as Draft;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
