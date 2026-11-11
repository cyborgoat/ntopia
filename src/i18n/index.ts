import { useSyncExternalStore } from "react";
import { readPref, writePref } from "@/lib/prefs";
import * as common from "./messages/common";
import * as shell from "./messages/shell";
import * as todo from "./messages/todo";
import * as notebook from "./messages/notebook";
import * as settings from "./messages/settings";
import * as orbit from "./messages/orbit";
import * as email from "./messages/email";

export const LANGS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;
export type Lang = (typeof LANGS)[number]["value"];

const sections = [common, shell, todo, notebook, settings, orbit, email];
const en = Object.assign({}, ...sections.map((s) => s.en)) as typeof common.en &
  typeof shell.en & typeof todo.en & typeof notebook.en & typeof settings.en & typeof orbit.en & typeof email.en;
const zh = Object.assign({}, ...sections.map((s) => s.zh)) as Record<keyof typeof en, string>;

export type MessageKey = keyof typeof en;
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, zh };

const LANG_KEY = "ntopia-lang";

function initialLang(): Lang {
  const saved = readPref(LANG_KEY);
  const found = LANGS.find((l) => l.value === saved);
  if (found) return found.value;
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

function syncDocument() {
  if (typeof document !== "undefined") document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
}
syncDocument();

export const getLang = () => current;

export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  writePref(LANG_KEY, next);
  syncDocument();
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export type Vars = Record<string, string | number>;

/** Translate outside React (toasts in event handlers, helpers). Inside components use `useT`. */
export function t(key: MessageKey, vars?: Vars): string {
  const text = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

/** Subscribes the component to language changes and returns `t`. */
export function useT() {
  useSyncExternalStore(subscribe, getLang);
  return t;
}

export function useLang() {
  return [useSyncExternalStore(subscribe, getLang), setLang] as const;
}

/** BCP 47 tag for `toLocale*String` and `Intl`. */
export const dateLocale = () => (current === "zh" ? "zh-CN" : "en");
