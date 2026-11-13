import { t } from "@/i18n";
import { EMAIL_LANGS, EMAIL_TYPES, THEME_PRESETS, isEventType, typeFields } from "./fields";

export type GuideRow = { code: string; desc: string };
export type GuideSection = { title: string; text?: string; rows?: GuideRow[]; code?: string };

const SKELETON = `---
title: "Subject line"
type: news
lang: en
---

The message body, written in Markdown.`;

const HOSTS_SNIPPET = `hosts:
  - name: Priya Nair
    role: Staff Platform Engineer
    bio: One or two sentences about the person.
    photo: assets/images/priya.jpg
agenda:
  - time: "16:00"
    title: "Opening"
  - time: "16:45"
    title: "Live Q&A"`;

const EXAMPLE = `---
title: "You're invited: Shipping reliable APIs in 2026"
type: webinar
lang: en
eventName: "Shipping reliable APIs in 2026"
startsAt: 2026-10-15
time: "16:00–17:00 UTC"
location: "Online — Zoom"
joinUrl: "https://example.com/zoom/api-webinar"
hosts:
  - name: Priya Nair
    role: Staff Platform Engineer
    bio: Leads API reliability across our edge services.
agenda:
  - time: "16:00"
    title: "What breaks at scale"
  - time: "16:45"
    title: "Live Q&A"
---

A one-hour online session on designing APIs that stay calm under load.`;

/** Everything about writing the Markdown file. The Writing guide tab and the copyable prompt both render this. */
export function buildGuide(): GuideSection[] {
  const typeRows = EMAIL_TYPES.map((type) => {
    const keys = typeFields(type.value).map((f) => f.key);
    if (isEventType(type.value)) keys.push("hosts", "agenda");
    return { code: `type: ${type.value}`, desc: `${t(type.description)} ${t("email.guide.types.keys")} ${keys.join(", ")}` };
  });

  return [
    { title: t("email.guide.structure.title"), text: t("email.guide.structure.text"), code: SKELETON },
    {
      title: t("email.guide.common.title"),
      rows: [
        { code: "title", desc: t("email.guide.common.title.desc") },
        { code: "type", desc: t("email.guide.common.type.desc", { list: EMAIL_TYPES.map((x) => x.value).join(", ") }) },
        { code: "lang", desc: t("email.guide.common.lang.desc", { list: EMAIL_LANGS.map((l) => l.value).join(", ") }) },
        { code: "theme", desc: t("email.guide.common.theme.desc", { list: THEME_PRESETS.join(", ") }) },
      ],
    },
    { title: t("email.guide.types.title"), text: t("email.guide.types.text"), rows: typeRows },
    { title: t("email.guide.hosts.title"), text: t("email.guide.hosts.text"), code: HOSTS_SNIPPET },
    {
      title: t("email.guide.syntax.title"),
      rows: [
        { code: "## Heading", desc: t("email.tool.heading") },
        { code: "**bold**  *italic*  ~~strike~~", desc: `${t("email.tool.bold")} / ${t("email.tool.italic")} / ${t("email.tool.strike")}` },
        { code: "`code`", desc: t("email.tool.code") },
        { code: "[text](https://example.com)", desc: t("email.tool.link") },
        { code: "- item", desc: t("email.tool.bullets") },
        { code: "1. item", desc: t("email.tool.numbers") },
        { code: "- [x] done   - [ ] to do", desc: t("email.guide.syntax.task") },
        { code: "| A | B |\n| --- | --- |\n| 1 | 2 |", desc: t("email.guide.syntax.table") },
        { code: "> quote", desc: t("email.tool.quote") },
        { code: "```\ncode block\n```", desc: t("email.tool.codeBlock") },
        { code: "---", desc: t("email.tool.divider") },
        { code: "![alt text](assets/images/photo.jpg)", desc: t("email.guide.syntax.image") },
      ],
    },
    { title: t("email.guide.tips.title"), text: t("email.guide.tips.text") },
    { title: t("email.guide.example.title"), code: EXAMPLE },
  ];
}

/** The guide as plain text, wrapped with instructions so an LLM or agent can write a file the composer accepts. */
export function buildEmailPrompt(): string {
  const body = buildGuide()
    .map((s) => {
      const parts = [`## ${s.title}`];
      if (s.text) parts.push(s.text);
      if (s.rows) parts.push(s.rows.map((r) => (r.code.includes("\n") ? `${r.desc}:\n\`\`\`\n${r.code}\n\`\`\`` : `- \`${r.code}\` — ${r.desc}`)).join("\n"));
      if (s.code) parts.push(`\`\`\`markdown\n${s.code}\n\`\`\``);
      return parts.join("\n\n");
    })
    .join("\n\n");
  return `${t("email.guide.prompt.intro")}\n\n${body}\n\n${t("email.guide.prompt.outro")}\n`;
}
