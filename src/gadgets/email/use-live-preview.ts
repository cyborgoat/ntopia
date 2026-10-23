import { useEffect, useState } from "react";
import * as mm from "@/gadgets/email/mdmailer";
import { toMessage } from "@/lib/utils";

/** Renders `doc` in-process (debounced, latest edit wins) while `started`; the last good preview stays on screen if a render fails. */
export function useLivePreview(started: boolean, doc: string) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!started) return;
    let stale = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const out = await mm.render(doc, ["html"]);
        if (stale) return;
        setHtml(out.html);
        setError("");
      } catch (e) {
        if (!stale) setError(toMessage(e));
      } finally {
        if (!stale) setBusy(false);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [started, doc, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  /** Forget the rendered output and any error (a new draft is about to load). */
  const reset = () => {
    setHtml("");
    setError("");
  };

  return { html, busy, error, retry, reset, setError };
}
