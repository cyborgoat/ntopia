import { readJsonPref, writeJsonPref } from "@/lib/prefs";

const KEY = "ntopia.email-composer.user-templates";
/** Prefix that tells user templates apart from bundled template file names. */
export const USER_PREFIX = "user:";

export type UserTemplate = { id: string; name: string; doc: string; lang: string };

export const isUserTemplate = (file: string) => file.startsWith(USER_PREFIX);

export function loadUserTemplates(): UserTemplate[] {
  return (
    readJsonPref(
      KEY,
      (v): v is UserTemplate[] =>
        Array.isArray(v) && v.every((t) => t && typeof t.id === "string" && typeof t.name === "string" && typeof t.doc === "string"),
    ) ?? []
  );
}

/** Saves a template, replacing an existing one with the same name. Returns the updated list. */
export function saveUserTemplate(name: string, doc: string, lang: string): UserTemplate[] {
  const trimmed = name.trim();
  const list = loadUserTemplates();
  const existing = list.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const next = existing
    ? list.map((t) => (t === existing ? { ...t, doc, lang } : t))
    : [...list, { id: crypto.randomUUID(), name: trimmed, doc, lang }];
  writeJsonPref(KEY, next);
  return next;
}

export function deleteUserTemplate(id: string): UserTemplate[] {
  const next = loadUserTemplates().filter((t) => t.id !== id);
  writeJsonPref(KEY, next);
  return next;
}
