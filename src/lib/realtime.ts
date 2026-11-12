import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { getServerUrl } from "./orbit";
import { notifyUser } from "./notify";
import { t } from "@/i18n";

/** Live notifications from team-orbit: refresh queries, toast when focused, native alert when hidden/unfocused. */
export function useNotificationsSocket() {
  const { token } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const socket = io(getServerUrl(), { auth: { token }, transports: ["websocket"] });
    socket.on("notification:new", (p: { title?: string; body?: string }) => {
      qc.invalidateQueries();
      void notifyUser({ title: p.title ?? t("notif.fallbackTitle"), body: p.body, prefKey: "orbit" });
    });
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [token, qc]);
}
