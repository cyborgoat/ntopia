import { PAGE_SIZE } from "@/components/list-pagination";

/** What every Team Orbit item has: when it was published (the API has no separate publish date) and a stable id. */
type Dated = { id: string; createdAt: string };
type Titled = Dated & { title: string };
type Viewed = Titled & { viewCount: number };
type Thread = Viewed & { score: number; commentCount: number };
type Scheduled = Titled & { startAt: string; endAt?: string };

export type SortOption<K extends string> = { value: K; label: string };
type Compare<T> = (a: T, b: T) => number;

const time = (iso: string) => new Date(iso).getTime();
const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/** Newest publish date first; the id keeps equal timestamps in a stable order. */
export const newest: Compare<Dated> = (a, b) => time(b.createdAt) - time(a.createdAt) || a.id.localeCompare(b.id);
const oldest: Compare<Dated> = (a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id);
const byTitle: Compare<Titled> = (a, b) => text(a.title, b.title) || newest(a, b);
/** Largest number first, newest first among ties. */
const most = <T extends Dated>(get: (t: T) => number): Compare<T> => (a, b) => get(b) - get(a) || newest(a, b);

/** Each section: its options (first is the default) and how to order items for each. */
export const NEWS_SORT = {
  options: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "views", label: "Most viewed" },
    { value: "title", label: "Title A–Z" },
  ] as const satisfies readonly SortOption<string>[],
  compare: (key: "newest" | "oldest" | "views" | "title"): Compare<Viewed> =>
    ({ newest, oldest, views: most<Viewed>((p) => p.viewCount), title: byTitle })[key],
};

export const DISCUSSION_SORT = {
  options: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "top", label: "Top voted" },
    { value: "comments", label: "Most comments" },
    { value: "views", label: "Most viewed" },
  ] as const satisfies readonly SortOption<string>[],
  compare: (key: "newest" | "oldest" | "top" | "comments" | "views"): Compare<Thread> =>
    ({
      newest,
      oldest,
      top: most<Thread>((p) => p.score),
      comments: most<Thread>((p) => p.commentCount),
      views: most<Thread>((p) => p.viewCount),
    })[key],
};

export const ANNOUNCEMENT_SORT = {
  options: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "title", label: "Title A–Z" },
  ] as const satisfies readonly SortOption<string>[],
  compare: (key: "newest" | "oldest" | "title"): Compare<Titled> => ({ newest, oldest, title: byTitle })[key],
};

/** Events are ordered by when they happen, not when they were posted. */
export const EVENT_SORT = {
  options: [
    { value: "upcoming", label: "Upcoming first" },
    { value: "latest", label: "Event date, latest" },
    { value: "earliest", label: "Event date, earliest" },
    { value: "added", label: "Recently added" },
    { value: "title", label: "Title A–Z" },
  ] as const satisfies readonly SortOption<string>[],
  compare: (key: "upcoming" | "latest" | "earliest" | "added" | "title", now = Date.now()): Compare<Scheduled> => {
    const start = (e: Scheduled) => time(e.startAt);
    const isPast = (e: Scheduled) => time(e.endAt ?? e.startAt) < now;
    const latest: Compare<Scheduled> = (a, b) => start(b) - start(a) || newest(a, b);
    const earliest: Compare<Scheduled> = (a, b) => start(a) - start(b) || newest(a, b);
    // What's still ahead, soonest first; then what's over, most recent first.
    const upcoming: Compare<Scheduled> = (a, b) =>
      Number(isPast(a)) - Number(isPast(b)) || (isPast(a) ? latest(a, b) : earliest(a, b));
    return {
      upcoming,
      latest,
      earliest,
      added: newest,
      title: byTitle,
    }[key];
  },
};

/** The values of a sort definition, for validating a saved choice. */
export const sortValues = <K extends string>(options: readonly SortOption<K>[]) => options.map((o) => o.value);

/** Sort a copy of `items` and cut out one page of it. */
export function sortAndPage<T>(items: readonly T[], compare: Compare<T>, page: number) {
  const sorted = [...items].sort(compare);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Deleting the last item of a page must not strand the list on an empty page.
  const current = Math.min(Math.max(1, page), pages);
  return { sorted, current, pageItems: sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) };
}
