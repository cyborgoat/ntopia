import { useMemo, useState } from "react";
import { usePersistedChoice } from "@/lib/prefs";
import { sortAndPage, sortValues, type SortOption } from "@/lib/sorting";

/**
 * Sort, page and remember the chosen sort order (per section) for a fully loaded list.
 * The first option is the default; changing the sort returns to page 1.
 */
export function useSortedList<K extends string, T>({
  storageKey,
  options,
  compare,
  items,
}: {
  storageKey: string;
  options: readonly SortOption<K>[];
  compare: (key: K) => (a: T, b: T) => number;
  /** `undefined` while loading. */
  items: readonly T[] | undefined;
}) {
  const [sort, setSortState] = usePersistedChoice<K>(storageKey, sortValues(options), options[0].value);
  const [page, setPage] = useState(1);
  const result = useMemo(
    // `compare` is a stable module-level function in every caller, so it is left out of the dependencies.
    () => (items ? sortAndPage(items, compare(sort), page) : undefined),
    [items, sort, page],
  );
  return {
    sort,
    setSort: (next: K) => {
      setSortState(next);
      setPage(1);
    },
    options,
    setPage,
    page: result?.current ?? page,
    pageItems: result?.pageItems,
    total: result?.sorted.length,
    sorted: result?.sorted,
  };
}
