import { useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import { t } from "@/i18n";
import { isTauri } from "@/lib/storage";
import { toMessage } from "@/lib/utils";

const TOAST_ID = "app-update";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15_000;

let busy = false;
let promptedVersion: string | undefined;

export const appVersion = () => (isTauri() ? getVersion() : Promise.resolve(""));

/** Download and install the update with a progress toast, then restart into the new version. */
async function install(update: Update) {
  if (busy) return;
  busy = true;
  let total = 0;
  let done = 0;
  const show = () => toast.loading(t("update.downloading", { percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0 }), { id: TOAST_ID });
  show();
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        done += event.data.chunkLength;
        show();
      } else toast.loading(t("update.installing"), { id: TOAST_ID });
    });
    await relaunch();
  } catch (e) {
    toast.error(t("update.failed", { reason: toMessage(e) }), { id: TOAST_ID });
  } finally {
    busy = false;
  }
}

function prompt(update: Update) {
  toast(t("update.available", { version: update.version }), {
    id: TOAST_ID,
    duration: Infinity,
    action: { label: t("update.install"), onClick: () => void install(update) },
  });
}

/**
 * Looks for a newer version. Automatic checks stay quiet unless an update exists (and only announce each
 * version once); manual checks always report the outcome.
 */
export async function runUpdateCheck(manual: boolean) {
  if (!isTauri()) {
    if (manual) toast.info(t("update.unavailable"));
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const update = await check();
    if (!update) {
      if (manual) toast.success(t("update.upToDate"));
    } else if (manual || promptedVersion !== update.version) {
      promptedVersion = update.version;
      prompt(update);
    }
  } catch (e) {
    if (manual) toast.error(t("update.failed", { reason: toMessage(e) }));
  } finally {
    busy = false;
  }
}

/** Checks shortly after launch and every few hours, and answers the tray's "Check for Updates…". */
export function useUpdater() {
  useEffect(() => {
    if (!isTauri()) return;
    const first = import.meta.env.DEV ? undefined : setTimeout(() => void runUpdateCheck(false), FIRST_CHECK_DELAY_MS);
    const every = import.meta.env.DEV ? undefined : setInterval(() => void runUpdateCheck(false), CHECK_EVERY_MS);
    const off = listen("tray-check-updates", () => void runUpdateCheck(true));
    return () => {
      clearTimeout(first);
      clearInterval(every);
      void off.then((fn) => fn());
    };
  }, []);
}
