import { createContext, useContext, useEffect, useMemo, useState } from "react";

type PageChrome = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const PageChromeContext = createContext<PageChrome | null>(null);

export function PageChromeProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
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
