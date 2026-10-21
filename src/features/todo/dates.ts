const pad = (n: number) => String(n).padStart(2, "0");

/** Local `YYYY-MM-DD` for a Date. */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parses a `YYYY-MM-DD` key as a local-midnight Date. */
export const fromDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Monday of the week containing `d`, at local midnight. */
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** Due moment in local time; a date without a time counts as 09:00. */
export function dueAt(dueDate: string, dueTime?: string): Date {
  const [h, m] = (dueTime || "09:00").split(":").map(Number);
  const d = fromDateKey(dueDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Parses typed 24-hour input ("15:30", "9:05", "1530", "15") into `HH:mm`.
 * A trailing am/pm is tolerated ("3:30 pm" → "15:30"). Returns null when invalid.
 */
export function parseTime(input: string): string | null {
  const m = input.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}
