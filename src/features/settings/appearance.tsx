import { useState } from "react";
import { useTheme } from "next-themes";
import { Group, Segmented } from "./layout";
import { readTextSize, setTextSize, TEXT_SIZES, type TextSize } from "./prefs";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function AppearanceSettings() {
  const { theme = "system", setTheme } = useTheme();
  const [size, setSizeState] = useState<TextSize>(readTextSize);

  return (
    <>
      <Group title="Theme" description="Follow your system or pick one.">
        <Segmented value={THEMES.find((t) => t.value === theme)?.value ?? "system"} options={THEMES} onChange={setTheme} />
      </Group>
      <Group title="Text size" description="Scales the whole interface.">
        <Segmented value={size} options={TEXT_SIZES} onChange={(v) => { setSizeState(v); setTextSize(v); }} />
      </Group>
    </>
  );
}
