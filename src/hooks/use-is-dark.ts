import { useSyncExternalStore } from "react";

/** Tracks the `.dark` class on <html>, which is what the app's dark tokens key off. */
export function useIsDark() {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
  );
}
