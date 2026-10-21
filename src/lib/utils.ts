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

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
