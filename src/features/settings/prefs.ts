import { readPref, writePref } from "@/lib/prefs";

/** Per-device appearance and notification preferences (localStorage; see lib/prefs). */

export const TEXT_SIZES = [
  { value: "small", label: "Small", px: 14 },
  { value: "default", label: "Default", px: 16 },
  { value: "large", label: "Large", px: 18 },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]["value"];

export const TEXT_SIZE_KEY = "pref:text-size";

export function readTextSize(): TextSize {
  const raw = readPref(TEXT_SIZE_KEY);
  return TEXT_SIZES.find((s) => s.value === raw)?.value ?? "default";
}

export function applyTextSize(size: TextSize) {
  const px = TEXT_SIZES.find((s) => s.value === size)?.px ?? 16;
  document.documentElement.style.fontSize = size === "default" ? "" : `${px}px`;
}

export function setTextSize(size: TextSize) {
  writePref(TEXT_SIZE_KEY, size);
  applyTextSize(size);
}

/** Run before first render so the saved look doesn't flash. */
export function applySavedAppearance() {
  applyTextSize(readTextSize());
}

/** Notification switches. Reads are synchronous so non-React code (sockets, timers) can check them. */
export const NOTIFY_KEYS = {
  native: "pref:notify-native",
  todo: "pref:notify-todo",
  orbit: "pref:notify-orbit",
} as const;
export type NotifyKey = keyof typeof NOTIFY_KEYS;

export function notifyEnabled(key: NotifyKey): boolean {
  return readPref(NOTIFY_KEYS[key]) !== "0";
}

const NOTIFY_EVENT = "ntopia:notify-pref";

/** Writes a notification switch and tells listeners (settings UI, tray menu) it changed. */
export function setNotifyEnabled(key: NotifyKey, on: boolean) {
  writePref(NOTIFY_KEYS[key], on ? "1" : "0");
  window.dispatchEvent(new Event(NOTIFY_EVENT));
}

export function onNotifyChange(cb: () => void) {
  window.addEventListener(NOTIFY_EVENT, cb);
  return () => window.removeEventListener(NOTIFY_EVENT, cb);
}
