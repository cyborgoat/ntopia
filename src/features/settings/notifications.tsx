import { useState } from "react";
import { useT } from "@/i18n";
import { writePref } from "@/lib/prefs";
import { isTauri } from "@/lib/storage";
import { Group, Row, Toggle } from "./layout";
import { notifyEnabled, NOTIFY_KEYS, type NotifyKey } from "./prefs";

function useNotifyPref(id: NotifyKey) {
  const [on, setOn] = useState(() => notifyEnabled(id));
  return [on, (v: boolean) => { setOn(v); writePref(NOTIFY_KEYS[id], v ? "1" : "0"); }] as const;
}

function Switch({ id, label, hint }: { id: NotifyKey; label: string; hint: string }) {
  const [on, set] = useNotifyPref(id);
  return (
    <Row label={label} hint={hint}>
      <Toggle label={label} checked={on} onChange={set} />
    </Row>
  );
}

/** A single control: its label and description sit on the left, the switch on the same line. */
function DesktopSwitch() {
  const tr = useT();
  const [on, set] = useNotifyPref("native");
  const label = tr("settings.desktopNotifications");
  return (
    <section className="border-b pb-6 last:border-b-0">
      <Row label={label} hint={isTauri() ? tr("settings.desktopNotificationsHint") : tr("settings.desktopOnly")}>
        <Toggle label={label} checked={on} onChange={set} />
      </Row>
    </section>
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
      <DesktopSwitch />
    </>
  );
}
