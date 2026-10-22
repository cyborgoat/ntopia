import { useEffect, useRef, useState } from "react";
import * as mm from "@/gadgets/email/mdmailer";
import { toMessage } from "@/lib/utils";

/**
 * Runs the mdmailer preview server while `started` and keeps it in sync with `doc`:
 * the document is written to the working file (debounced) and the rendered HTML is polled back.
 */
export function useLivePreview(started: boolean, doc: string) {
  const docRef = useRef(doc);
  docRef.current = doc;
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const versionRef = useRef(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setError("");
    mm.acquirePreview(docRef.current, { keepImages: true })
      .then(({ url }) => {
        if (cancelled) return;
        setPreviewUrl(url);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(toMessage(e));
      });
    return () => {
      cancelled = true;
      mm.releasePreview();
    };
  }, [attempt, started]);

  async function retry() {
    setReady(false);
    setPreviewUrl(null);
    await mm.resetPreview();
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    if (!previewUrl) return;
    let stopped = false;
    const tick = async () => {
      try {
        const state = await mm.fetchPreviewState(previewUrl, versionRef.current);
        if (stopped) return;
        setBusy(state.updating);
        if (state.error) setError(state.error);
        else if (state.html !== undefined) {
          setHtml(state.html);
          versionRef.current = state.version;
          setError("");
        } else if (!state.updating) {
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(toMessage(e));
      }
      if (!stopped) timer = setTimeout(tick, 500);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void mm.writeWorking(doc).catch((e) => setError(toMessage(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [doc, ready]);

  /** Forget the rendered output and any error (a new draft is about to load). */
  const reset = () => {
    setHtml("");
    setError("");
  };

  return { html, busy, error, previewUrl, retry, reset, setError };
}
