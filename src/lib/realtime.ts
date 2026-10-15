import { useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";
import { useAuth } from "./auth";
import { getServerUrl } from "./orbit";
import { isTauri } from "./storage";

/** Live notifications from team-orbit: toast, refresh queries, native alert when unfocused. */
export function useNotificationsSocket() {
  const { token } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const socket = io(getServerUrl(), { auth: { token }, transports: ["websocket"] });
    socket.on("notification:new", async (p: { title?: string; body?: string }) => {
      toast.message(p.title ?? "Notification", { description: p.body });
      qc.invalidateQueries();
      if (isTauri() && !document.hasFocus() && (await isPermissionGranted())) {
        sendNotification({ title: p.title ?? "NTOPIA", body: p.body });
      }
    });
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [token, qc]);
}
