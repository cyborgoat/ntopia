import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/gadgets/timer")({ component: TimerGadget });

const PRESETS = [
  { label: "Focus 25", seconds: 25 * 60 },
  { label: "Short 5", seconds: 5 * 60 },
  { label: "Long 15", seconds: 15 * 60 },
] as const;

const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59;

function clampInt(raw: string, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

function partsFromSeconds(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function secondsFromParts(h: number, m: number, s: number) {
  return Math.min(MAX_SECONDS, h * 3600 + m * 60 + s);
}

function format(total: number) {
  const { h, m, s } = partsFromSeconds(total);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function UnitField({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(clampInt(e.target.value, max))}
        className="h-9 w-20 text-center tabular-nums"
      />
    </div>
  );
}

function TimerGadget() {
  const [duration, setDuration] = useState(PRESETS[0].seconds);
  const [remaining, setRemaining] = useState(PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const custom = partsFromSeconds(duration);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          toast.success("Time's up");
          void import("@tauri-apps/plugin-notification")
            .then(({ sendNotification }) => sendNotification({ title: "NTOPIA timer", body: "Focus session finished." }))
            .catch(() => undefined);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const pick = (seconds: number) => {
    const next = Math.max(0, Math.min(MAX_SECONDS, seconds));
    setRunning(false);
    setDuration(next);
    setRemaining(next);
  };

  const setCustomPart = (part: "h" | "m" | "s", value: number) => {
    const cur = partsFromSeconds(duration);
    const next = { ...cur, [part]: value };
    pick(secondsFromParts(next.h, next.m, next.s));
  };

  const reset = () => {
    setRunning(false);
    setRemaining(duration);
  };

  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const presetActive = PRESETS.some((p) => p.seconds === duration);

  return (
    <>
      <PageHeader title="Timer" />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={duration === p.seconds && !running ? "default" : "outline"}
              onClick={() => pick(p.seconds)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex items-end gap-3">
          <UnitField label="Hours" value={custom.h} max={99} disabled={running} onChange={(n) => setCustomPart("h", n)} />
          <UnitField label="Minutes" value={custom.m} max={59} disabled={running} onChange={(n) => setCustomPart("m", n)} />
          <UnitField label="Seconds" value={custom.s} max={59} disabled={running} onChange={(n) => setCustomPart("s", n)} />
        </div>
        {!presetActive && duration > 0 && (
          <p className="text-xs text-muted-foreground">Custom · {format(duration)}</p>
        )}

        <div className="relative flex size-52 items-center justify-center">
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              className="stroke-foreground transition-[stroke-dashoffset] duration-200"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
            />
          </svg>
          <p className={cn("font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl", remaining === 0 && "text-muted-foreground")}>
            {format(remaining)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setRunning((r) => !r)} disabled={(remaining === 0 || duration === 0) && !running}>
            {running ? <><Pause /> Pause</> : <><Play /> Start</>}
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={remaining === duration && !running}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>
    </>
  );
}
