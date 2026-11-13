import type { MessageKey } from "@/i18n";
/** Which frontmatter keys mdmailer reads for each email `type` (see mdmailer's dist/cli.js). */

export const EMAIL_TYPES: readonly { value: string; label: MessageKey; description: MessageKey }[] = [
  { value: "news", label: "email.type.news.label", description: "email.type.news.desc" },
  { value: "notification", label: "email.type.notification.label", description: "email.type.notification.desc" },
  { value: "event", label: "email.type.event.label", description: "email.type.event.desc" },
  { value: "meeting", label: "email.type.meeting.label", description: "email.type.meeting.desc" },
  { value: "webinar", label: "email.type.webinar.label", description: "email.type.webinar.desc" },
  { value: "invitation", label: "email.type.invitation.label", description: "email.type.invitation.desc" },
];
export const EMAIL_LANGS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;
export const THEME_PRESETS = ["classic", "navy-gold", "forest-cream"] as const;

type TemplateText = { name: string; description: string };

/** Display text for the bundled mdmailer templates, keyed by base file name (without `.zh`), then language. */
export const TEMPLATE_INFO: Record<string, Record<"en" | "zh", TemplateText>> = {
  news: {
    en: { name: "News update", description: "A newsletter-style update showing every supported Markdown element." },
    zh: { name: "新闻动态", description: "通讯稿风格的更新，展示所有支持的 Markdown 元素。" },
  },
  event: {
    en: { name: "Event invitation", description: "An event with date, location, hosts, agenda and a join link." },
    zh: { name: "活动邀请", description: "包含日期、地点、主持人、议程和参加链接的活动邀请。" },
  },
  webinar: {
    en: { name: "Webinar invite", description: "An online session with speakers, agenda and a registration link." },
    zh: { name: "线上研讨会", description: "包含主讲人、议程和报名链接的线上研讨会邀请。" },
  },
};

/** Split a template file name such as `invitation.zh` into its base name and language. */
export function parseTemplate(file: string): { base: string; lang: string } {
  const m = file.match(/^(.*)\.([a-z]{2})$/);
  return m ? { base: m[1], lang: m[2] } : { base: file, lang: "en" };
}

export type FieldDef = { key: string; label: MessageKey };

const EVENT_TYPES = new Set(["event", "meeting", "webinar", "invitation"]);
export const isEventType = (type: string) => EVENT_TYPES.has(type);

/** Type-specific frontmatter keys (beyond title, type, lang, theme) that mdmailer reads. */
export function typeFields(type: string): FieldDef[] {
  if (type === "notification") {
    return [
      { key: "headline", label: "email.field.headline" },
      { key: "banner", label: "email.field.banner" },
      { key: "date", label: "email.field.date" },
    ];
  }
  if (isEventType(type)) {
    return [
      { key: "eventName", label: "email.field.eventName" },
      { key: "startsAt", label: "email.field.date" },
      { key: "time", label: "email.field.time" },
      { key: "location", label: "email.field.location" },
      type === "invitation" ? { key: "rsvpUrl", label: "email.field.rsvpUrl" } : { key: "joinUrl", label: "email.field.joinUrl" },
      { key: "kicker", label: "email.field.kicker" },
    ];
  }
  return [{ key: "date", label: "email.field.date" }];
}
