import { readJsonPref, writeJsonPref } from "@/lib/prefs";
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
  return (
    readJsonPref(
      DRAFT_KEY,
      (d): d is Draft =>
        typeof d === "object" && d !== null && !!(d as Draft).meta && typeof (d as Draft).body === "string" && typeof (d as Draft).baseline === "string",
    ) ?? null
  );
}

export function saveDraft(d: Draft) {
  writeJsonPref(DRAFT_KEY, d);
}
