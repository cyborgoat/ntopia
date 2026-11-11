import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Parses a typed time: `15:30`, `1530`, `3:30 pm`, `3pm`, `12 AM`, `15:30 PM` (a 24-hour hour wins over the suffix).
 * Returns `HH:mm`, or null when it isn't a time.
 */
export function parseTime(text: string): string | null {
  const m = /^\s*(\d{1,2})(?::?(\d{2}))?\s*(?:([ap])\.?m?\.?)?\s*$/i.exec(text);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const suffix = m[3]?.toLowerCase();
  if (minute > 59) return null;
  if (suffix) {
    if (hour === 0 || hour > 23) return null;
    if (hour <= 12) hour = suffix === "p" ? (hour % 12) + 12 : hour % 12;
  } else if (hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function isoDate(y: number, mo: number, d: number): string | null {
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${pad(mo)}-${pad(d)}`;
}

/**
 * Parses a typed date: `2026-10-23`, `2026/10/23`, `10/23/2026`, `10/23` (this year), `Oct 23`, `23 Oct 2026`, `today`, `tomorrow`.
 * Returns `YYYY-MM-DD`, or null when it isn't a date.
 */
export function parseDate(text: string, now = new Date()): string | null {
  const t = text.trim();
  if (!t) return null;
  const word = t.toLowerCase();
  if (word === "today") return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (word === "tomorrow") return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate() + 1);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{4}))?$/.exec(t);
  if (m) return isoDate(Number(m[3] ?? now.getFullYear()), Number(m[1]), Number(m[2]));
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(t) && /(^|\D)\d{1,2}(\D|$)/.test(t)) {
    // "Oct 23", "October 23, 2026", "23 Oct 2026": let the engine read month names; default the year.
    const withYear = /\b\d{4}\b/.test(t) ? t : `${t} ${now.getFullYear()}`;
    const parsed = new Date(withYear);
    if (!Number.isNaN(parsed.getTime())) return isoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return null;
}


/**
 * Typed date plus typed time, with a calendar popover for picking the date. Reports `YYYY-MM-DDTHH:mm`
 * (what `datetime-local` used), or "" until both parts are valid. `value` only seeds the fields;
 * the component keeps its own state, so remount it (e.g. via `key`) to reset it.
 */
export function DateTimeInput({ value, onChange, required, id }: { value: string; onChange: (value: string) => void; required?: boolean; id?: string }) {
  const tr = useT();
  const [initialDate = "", initialTime = ""] = value.split("T");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const parsedDate = parseDate(date);
  const parsedTime = parseTime(time);
  const combined = parsedDate && parsedTime ? `${parsedDate}T${parsedTime}` : "";

  const emitted = useRef(value);
  useEffect(() => {
    if (combined === emitted.current) return;
    emitted.current = combined;
    onChange(combined);
  }, [combined, onChange]);

  useEffect(() => {
    dateRef.current?.setCustomValidity(date.trim() && !parsedDate ? tr("date.dateHint") : "");
  }, [date, parsedDate]);
  useEffect(() => {
    timeRef.current?.setCustomValidity(time.trim() && !parsedTime ? tr("date.timeHint") : "");
  }, [time, parsedTime]);

  return (
    <div className="flex gap-1.5">
      <div className="relative min-w-0 flex-1">
        <Input
          ref={dateRef}
          id={id}
          required={required}
          placeholder="2026-10-23"
          aria-label={tr("date.date")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => parsedDate && setDate(parsedDate)}
          className="pr-8"
        />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={<Button type="button" variant="ghost" size="icon-xs" className="absolute top-1/2 right-1 -translate-y-1/2" aria-label={tr("date.pick")} />}
          >
            <CalendarDays />
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              value={parsedDate ?? undefined}
              onSelect={(picked) => {
                setDate(picked);
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <Input
        ref={timeRef}
        required={required}
        placeholder="12:00"
        aria-label={tr("date.time")}
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={() => parsedTime && setTime(parsedTime)}
        className="w-28 shrink-0"
      />
    </div>
  );
}
