import { renderMarkdown, type RenderOutput } from "./engine";

export type Format = "html" | "eml" | "png";

const TEMPLATES = import.meta.glob("./templates/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const templateKey = (name: string) => `./templates/${name}.md`;

export async function listTemplates(): Promise<string[]> {
  return Object.keys(TEMPLATES).map((p) => p.slice("./templates/".length, -3)).sort();
}
export async function readTemplate(name: string) {
  const text = TEMPLATES[templateKey(name)];
  if (text === undefined) throw new Error(`Unknown template "${name}"`);
  return text;
}

/** Render Markdown to the requested formats; the live preview needs only the HTML, so ask for just that. */
export function render(markdown: string, formats: Format[]): Promise<RenderOutput> {
  return renderMarkdown(markdown, { eml: formats.includes("eml"), png: formats.includes("png") });
}
