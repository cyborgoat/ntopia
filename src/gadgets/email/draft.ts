import { readJsonPref, writeJsonPref } from "@/lib/prefs";
import { joinDoc, type Frontmatter } from "./frontmatter";

const DRAFT_KEY = "ntopia.email-composer.draft";

export type Draft = {
  /** The whole email file: frontmatter and body. */
  doc: string;
  /** The document as last loaded (blank or a template); anything else counts as an unsaved edit. */
  baseline: string;
};

/** Drafts saved before the editor was unified kept the frontmatter and body apart. */
type LegacyDraft = { meta: Frontmatter; body: string; baseline: string };

const isObject = (d: unknown): d is Record<string, unknown> => typeof d === "object" && d !== null;

/** The saved draft, or null when the user has not started one yet. */
export function loadDraft(): Draft | null {
  const saved = readJsonPref(
    DRAFT_KEY,
    (d): d is Draft | LegacyDraft =>
      isObject(d) && typeof d.baseline === "string" && (typeof d.doc === "string" || (isObject(d.meta) && typeof d.body === "string")),
  );
  if (!saved) return null;
  if ("doc" in saved) return saved;
  return { doc: joinDoc(saved.meta, saved.body), baseline: saved.baseline };
}

export function saveDraft(d: Draft) {
  writeJsonPref(DRAFT_KEY, d);
}
