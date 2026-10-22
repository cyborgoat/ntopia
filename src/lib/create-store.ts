import { getItem, setItem } from "@/lib/storage";

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/**
 * A value persisted under one storage key. Reads are synchronous (storage is loaded at boot),
 * and `save` resolves once the write is durable. The key must be listed in `main.tsx`'s `initStorage`.
 */
export function createStore<T>(key: string, empty: () => T) {
  return {
    key,
    read: (): T => getItem<T>(key) ?? empty(),
    save: (value: T): Promise<void> => setItem(key, value),
  };
}
