import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getLang, t, useT } from "@/i18n";
import { notifyEnabled, onNotifyChange, setNotifyEnabled } from "@/features/settings/prefs";
import { isTauri } from "@/lib/storage";

/** Keeps the native tray menu in step with the webview: labels, navigation and the mute switch. */
export function useTraySync() {
  const navigate = useNavigate();
  const lang = getLang();
  useT(); // re-render on language change

  useEffect(() => {
    if (!isTauri()) return;
    const labels = {
      open: t("tray.open"),
      home: t("nav.home"),
      todo: t("nav.todo"),
      notebook: t("nav.notebook"),
      notifications: t("nav.notifications"),
      settings: t("nav.settings"),
      mute: t("tray.mute"),
      quit: t("tray.quit"),
      tooltip: t("tray.tooltip"),
    };
    invoke("set_tray_labels", { labels }).catch(() => {});
  }, [lang]);

  useEffect(() => {
    if (!isTauri()) return;
    const pushMute = () => invoke("set_tray_mute_checked", { checked: !notifyEnabled("native") }).catch(() => {});
    pushMute();
    const offPref = onNotifyChange(pushMute);
    const unlisten = [
      listen<string>("tray-navigate", (e) => navigate({ to: e.payload as never })),
      listen("tray-toggle-mute", () => setNotifyEnabled("native", !notifyEnabled("native"))),
    ];
    return () => {
      offPref();
      unlisten.forEach((p) => p.then((fn) => fn()));
    };
  }, [navigate]);
}
