/** Which frontmatter keys mdmailer reads for each email `type` (see mdmailer's dist/cli.js). */

export const EMAIL_TYPES = ["news", "notification", "event", "meeting", "webinar", "invitation"] as const;
export const EMAIL_LANGS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;
export const THEME_PRESETS = ["classic", "navy-gold", "forest-cream"] as const;

export type FieldDef = {
  key: string;
  label: string;
  input?: "text" | "date" | "url";
  placeholder?: string;
  wide?: boolean;
};

const EVENT_TYPES = new Set(["event", "meeting", "webinar", "invitation"]);
export const isEventType = (type: string) => EVENT_TYPES.has(type);

export function typeFields(type: string): FieldDef[] {
  if (type === "notification") {
    return [
      { key: "headline", label: "Headline", placeholder: "Defaults to the subject", wide: true },
      { key: "banner", label: "Banner", placeholder: "e.g. Schedule change" },
      { key: "date", label: "Date", input: "date" },
    ];
  }
  if (isEventType(type)) {
    return [
      { key: "eventName", label: "Event name", placeholder: "Defaults to the subject", wide: true },
      { key: "startsAt", label: "Date", input: "date" },
      { key: "time", label: "Time", placeholder: "e.g. 15:00–16:00 UTC" },
      { key: "location", label: "Location", placeholder: "Room, address or “Online”" },
      type === "invitation"
        ? { key: "rsvpUrl", label: "RSVP link", input: "url", placeholder: "https://…" }
        : { key: "joinUrl", label: "Join link", input: "url", placeholder: "https://…" },
      { key: "kicker", label: "Kicker", placeholder: "Small label above the title" },
    ];
  }
  return [{ key: "date", label: "Date", input: "date" }];
}

/** Keys the details form edits for this type; anything else shows under "Other fields". */
export function knownKeys(type: string): Set<string> {
  const keys = ["title", "type", "lang", "theme", ...typeFields(type).map((f) => f.key)];
  if (isEventType(type)) keys.push("hosts", "agenda");
  return new Set(keys);
}

export type Host = { name?: string; role?: string; photo?: string; bio?: string };
export type AgendaItem = { time?: string; title?: string };
