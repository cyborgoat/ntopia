import { useCallback, useState } from "react";

/**
 * Per-device UI preferences (panel sizes, collapsed state, drafts) kept in localStorage.
 * Every access is guarded: storage can be missing or throw (private windows, blocked site data).
 */

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function readJsonPref<T>(key: string, isValid: (v: unknown) => v is T): T | undefined {
  const raw = readPref(key);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeJsonPref(key: string, value: unknown) {
  writePref(key, JSON.stringify(value));
}

/** A boolean stored as "1" / "0"; `fallback` applies until the user has chosen. */
export function usePersistedFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => {
    const raw = readPref(key);
    return raw === null ? fallback : raw === "1";
  });
  const set = useCallback(
    (next: boolean | ((v: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writePref(key, resolved ? "1" : "0");
        return resolved;
      });
    },
    [key],
  );
  return [value, set] as const;
}

/** A string restricted to `allowed`; anything else falls back to `fallback`. */
export function usePersistedChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = readPref(key);
    return allowed.find((a) => a === raw) ?? fallback;
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writePref(key, next);
    },
    [key],
  );
  return [value, set] as const;
}

/** Saved react-resizable-panels sizes; `defaults` also defines which panel ids must be present. */
export function usePanelLayout<K extends string>(key: string, defaults: Record<K, number>) {
  const [layout, setLayout] = useState<Record<K, number>>(() => {
    const saved = readJsonPref(
      key,
      (v): v is Record<K, number> =>
        typeof v === "object" && v !== null && (Object.keys(defaults) as K[]).every((id) => (v as Record<string, unknown>)[id] != null),
    );
    return saved ?? defaults;
  });
  const save = useCallback(
    (next: Record<string, number>) => {
      setLayout(next as Record<K, number>);
      writeJsonPref(key, next);
    },
    [key],
  );
  return [layout, save] as const;
}
