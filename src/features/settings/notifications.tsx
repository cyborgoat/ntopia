import { useState } from "react";
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
  return (
    <>
      <Group title="Alerts" description="Choose what interrupts you. In-app toasts always follow these switches too.">
        <Switch id="todo" label="Todo reminders" hint="Alert when a todo with a reminder comes due." />
        <Switch id="orbit" label="Team Orbit activity" hint="Alert on new announcements, comments and mentions." />
      </Group>
      <Group title="Desktop" description="System notifications sent while the app is running.">
        <Switch
          id="native"
          label="Desktop notifications"
          hint={isTauri() ? "Show OS notifications for the alerts above." : "Only available in the desktop app."}
        />
      </Group>
    </>
  );
}
