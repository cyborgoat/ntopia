/** Which frontmatter keys mdmailer reads for each email `type` (see mdmailer's dist/cli.js). */

export const EMAIL_TYPES = [
  { value: "news", label: "News update", description: "Newsletter-style update with a date" },
  { value: "notification", label: "Notification", description: "Short announcement with a banner and headline" },
  { value: "event", label: "Event", description: "Date, location, hosts and agenda" },
  { value: "meeting", label: "Meeting", description: "Meeting invite with a join link" },
  { value: "webinar", label: "Webinar", description: "Online session with hosts and a join link" },
  { value: "invitation", label: "Invitation", description: "Formal invitation with an RSVP link" },
] as const;
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
  notification: {
    en: { name: "Notification", description: "A short announcement with a banner, headline and explanation." },
    zh: { name: "通知公告", description: "简短的公告，包含横幅、标题和说明。" },
  },
  event: {
    en: { name: "Event invitation", description: "An event with date, location, hosts, agenda and a join link." },
    zh: { name: "活动邀请", description: "包含日期、地点、主持人、议程和参加链接的活动邀请。" },
  },
  meeting: {
    en: { name: "Meeting invite", description: "A meeting with a time, room and call link, plus a host." },
    zh: { name: "会议邀请", description: "包含时间、会议室、线上链接和主持人的会议邀请。" },
  },
  webinar: {
    en: { name: "Webinar invite", description: "An online session with speakers, agenda and a registration link." },
    zh: { name: "线上研讨会", description: "包含主讲人、议程和报名链接的线上研讨会邀请。" },
  },
  invitation: {
    en: { name: "Formal invitation", description: "A formal invitation with hosts and an RSVP link." },
    zh: { name: "正式邀请函", description: "包含主办人和回执链接的正式邀请函。" },
  },
};

/** Split a template file name such as `invitation.zh` into its base name and language. */
export function parseTemplate(file: string): { base: string; lang: string } {
  const m = file.match(/^(.*)\.([a-z]{2})$/);
  return m ? { base: m[1], lang: m[2] } : { base: file, lang: "en" };
}

export type FieldDef = { key: string; label: string };

const EVENT_TYPES = new Set(["event", "meeting", "webinar", "invitation"]);
export const isEventType = (type: string) => EVENT_TYPES.has(type);

/** Type-specific frontmatter keys (beyond title, type, lang, theme) that mdmailer reads. */
export function typeFields(type: string): FieldDef[] {
  if (type === "notification") {
    return [
      { key: "headline", label: "Headline" },
      { key: "banner", label: "Banner" },
      { key: "date", label: "Date" },
    ];
  }
  if (isEventType(type)) {
    return [
      { key: "eventName", label: "Event name" },
      { key: "startsAt", label: "Date" },
      { key: "time", label: "Time" },
      { key: "location", label: "Location" },
      type === "invitation" ? { key: "rsvpUrl", label: "RSVP link" } : { key: "joinUrl", label: "Join link" },
      { key: "kicker", label: "Header label" },
    ];
  }
  return [{ key: "date", label: "Date" }];
}
