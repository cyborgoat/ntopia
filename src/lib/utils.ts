import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Plain-text preview of a Markdown string, cut to `max` characters. */
export function excerpt(md: string, max = 160) {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Message text of a caught value, which is not necessarily an `Error`. */
export function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function formatDateTime(d: string) {
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
