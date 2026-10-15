import { LazyStore } from "@tauri-apps/plugin-store";

export const isTauri = () => "__TAURI_INTERNALS__" in window;

const store = new LazyStore("ntopia.json");
const cache = new Map<string, unknown>();

/** Load persisted values into memory so reads are synchronous afterwards. */
export async function initStorage(keys: string[]) {
  await Promise.all(
    keys.map(async (k) => {
      try {
        const v = isTauri() ? await store.get(k) : JSON.parse(localStorage.getItem(k) ?? "null");
        if (v != null) cache.set(k, v);
      } catch {
        /* ignore */
      }
    }),
  );
}

export function getItem<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/** Write through the in-memory cache and persist. Await when durability matters (e.g. auth token). */
export async function setItem(key: string, value: unknown): Promise<void> {
  if (value == null) cache.delete(key);
  else cache.set(key, value);
  if (isTauri()) {
    if (value == null) await store.delete(key);
    else await store.set(key, value);
    await store.save();
  } else if (value == null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
