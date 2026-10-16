import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Crumb = { label: string; to?: string };

type PageChrome = {
  title: string | null;
  setTitle: (title: string | null) => void;
  crumbs: Crumb[] | null;
  setCrumbs: (crumbs: Crumb[] | null) => void;
  /** Element in the shell header where a page's description and actions are portaled. */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
};

const PageChromeContext = createContext<PageChrome | null>(null);

export function PageChromeProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ title, setTitle, crumbs, setCrumbs, slot, setSlot }), [title, crumbs, slot]);
  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}

export function usePageChrome() {
  const ctx = useContext(PageChromeContext);
  if (!ctx) throw new Error("usePageChrome outside PageChromeProvider");
  return ctx;
}

/** Register a page title into the shell header for the lifetime of the caller. */
export function usePageTitle(title: string) {
  const { setTitle } = usePageChrome();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}

/** Register breadcrumbs (last one is the current page) into the shell header. */
export function usePageCrumbs(crumbs: Crumb[] | undefined) {
  const { setCrumbs } = usePageChrome();
  const key = crumbs ? JSON.stringify(crumbs) : "";
  useEffect(() => {
    setCrumbs(key ? (JSON.parse(key) as Crumb[]) : null);
    return () => setCrumbs(null);
  }, [key, setCrumbs]);
}
