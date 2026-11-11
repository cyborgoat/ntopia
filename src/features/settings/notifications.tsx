import { useState } from "react";
import { useT } from "@/i18n";
import { writePref } from "@/lib/prefs";
import { isTauri } from "@/lib/storage";
import { Group, Row, Toggle } from "./layout";
import { notifyEnabled, NOTIFY_KEYS, type NotifyKey } from "./prefs";

function Switch({ id, label, hint }: { id: NotifyKey; label: string; hint: string }) {
  const [on, setOn] = useState(() => notifyEnabled(id));
  return (
    <Row label={label} hint={hint}>
      <Toggle
        label={label}
        checked={on}
        onChange={(v) => { setOn(v); writePref(NOTIFY_KEYS[id], v ? "1" : "0"); }}
      />
    </Row>
  );
}

export function NotificationSettings() {
  const tr = useT();
  return (
    <>
      <Group title={tr("settings.alerts")} description={tr("settings.alertsHint")}>
        <Switch id="todo" label={tr("settings.todoReminders")} hint={tr("settings.todoRemindersHint")} />
        <Switch id="orbit" label={tr("settings.orbitActivity")} hint={tr("settings.orbitActivityHint")} />
      </Group>
      <Group title={tr("settings.desktop")} description={tr("settings.desktopHint")}>
        <Switch
          id="native"
          label={tr("settings.desktopNotifications")}
          hint={isTauri() ? tr("settings.desktopNotificationsHint") : tr("settings.desktopOnly")}
        />
      </Group>
    </>
  );
}
