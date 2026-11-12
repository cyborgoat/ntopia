import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { notifyEnabled, type NotifyKey } from "@/features/settings/prefs";
import { isTauri } from "./storage";

/**
 * Alerts the user: an in-app toast while the window is visible and focused,
 * otherwise a native system notification (hidden to the tray, minimized or in the background).
 */
export async function notifyUser({ title, body, prefKey }: { title: string; body?: string; prefKey: NotifyKey }) {
  if (!notifyEnabled(prefKey)) return;
  const active = document.visibilityState === "visible" && document.hasFocus();
  if (active || !isTauri()) {
    toast.message(title, { description: body });
    return;
  }
  if (!notifyEnabled("native")) return;
  try {
    const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* notifications unavailable on this system */
  }
}
