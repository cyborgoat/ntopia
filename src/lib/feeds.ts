import { orbit } from "@/lib/orbit";

const FETCH_SIZE = 50;

type Page<T> = { items: T[]; total: number } | undefined;

/**
 * The Team Orbit API pages its lists but cannot sort them, so a sorted section needs every item. Loads all pages
 * (the result is cached under one query key, so a section and the home digest share it).
 */
export async function fetchAll<T>(page: (page: number, limit: number) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  for (let p = 1; ; p++) {
    const res = await page(p, FETCH_SIZE);
    if (!res) break;
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) break;
  }
  return items;
}

/** Query options for the complete list of each section. Their keys start with the section's own key, so invalidating that refreshes them. */
export const feedQueries = {
  news: {
    queryKey: ["/news", "all"],
    queryFn: () => fetchAll(async (page, limit) => (await orbit.GET("/api/news", { params: { query: { page, limit } } })).data),
  },
  blog: {
    queryKey: ["/blog-posts", "all"],
    queryFn: () => fetchAll(async (page, limit) => (await orbit.GET("/api/blog-posts", { params: { query: { page, limit } } })).data),
  },
  announcements: {
    queryKey: ["announcements", "all"],
    queryFn: () => fetchAll(async (page, limit) => (await orbit.GET("/api/announcements", { params: { query: { page, limit } } })).data),
  },
  events: {
    queryKey: ["events", "all"],
    queryFn: () => fetchAll(async (page, limit) => (await orbit.GET("/api/events", { params: { query: { page, limit } } })).data),
  },
  /** `q` is the search text; the server filters, then everything that matches is loaded. */
  discussions: (q = "") => ({
    queryKey: ["forum-posts", "all", q],
    queryFn: () => fetchAll(async (page, limit) => (await orbit.GET("/api/forum-posts", { params: { query: { page, limit, q: q || undefined } } })).data),
  }),
};
