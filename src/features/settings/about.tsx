import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { appVersion, runUpdateCheck } from "@/lib/updater";
import { Group, Row } from "./layout";

export function AboutSettings() {
  const tr = useT();
  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => { void appVersion().then(setVersion).catch(() => {}); }, []);

  return (
    <Group title={tr("settings.updates")} description={tr("settings.updatesHint")}>
      <Row label={tr("settings.version")} hint={version ? `NTOPIA ${version}` : undefined}>
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={async () => { setChecking(true); await runUpdateCheck(true); setChecking(false); }}
        >
          {tr("settings.checkUpdates")}
        </Button>
      </Row>
    </Group>
  );
}
