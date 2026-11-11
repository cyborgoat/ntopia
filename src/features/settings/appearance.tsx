import { useState } from "react";
import { useTheme } from "next-themes";
import { LANGS, useLang, useT } from "@/i18n";
import { Group, Segmented } from "./layout";
import { readTextSize, setTextSize, type TextSize } from "./prefs";

export function AppearanceSettings() {
  const tr = useT();
  const { theme = "system", setTheme } = useTheme();
  const [lang, setLang] = useLang();
  const [size, setSizeState] = useState<TextSize>(readTextSize);

  const themes = [
    { value: "system", label: tr("settings.theme.system") },
    { value: "light", label: tr("settings.theme.light") },
    { value: "dark", label: tr("settings.theme.dark") },
  ] as const;
  const sizes = [
    { value: "small", label: tr("settings.size.small") },
    { value: "default", label: tr("settings.size.default") },
    { value: "large", label: tr("settings.size.large") },
  ] as const;

  return (
    <>
      <Group title={tr("settings.language")} description={tr("settings.languageHint")}>
        <Segmented value={lang} options={LANGS} onChange={setLang} />
      </Group>
      <Group title={tr("settings.theme")} description={tr("settings.themeHint")}>
        <Segmented value={themes.find((t) => t.value === theme)?.value ?? "system"} options={themes} onChange={setTheme} />
      </Group>
      <Group title={tr("settings.textSize")} description={tr("settings.textSizeHint")}>
        <Segmented value={size} options={sizes} onChange={(v) => { setSizeState(v); setTextSize(v); }} />
      </Group>
    </>
  );
}
