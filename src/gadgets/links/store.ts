import { getItem, setItem } from "@/lib/storage";

export const LINKS_STORAGE_KEY = "gadget-links";

export type ShelfLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

export function listLinks(): ShelfLink[] {
  return getItem<ShelfLink[]>(LINKS_STORAGE_KEY) ?? [];
}

function persist(items: ShelfLink[]) {
  void setItem(LINKS_STORAGE_KEY, items);
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return `https://${t}`;
}

export function addLink(input: { title: string; url: string }): ShelfLink {
  const url = normalizeUrl(input.url);
  if (!url) throw new Error("URL is required");
  const title = input.title.trim() || url;
  const link: ShelfLink = {
    id: crypto.randomUUID(),
    title,
    url,
    createdAt: new Date().toISOString(),
  };
  persist([link, ...listLinks()]);
  return link;
}

export function deleteLink(id: string): ShelfLink[] {
  const next = listLinks().filter((l) => l.id !== id);
  persist(next);
  return next;
}
