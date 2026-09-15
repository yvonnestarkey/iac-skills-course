export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function midnight(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function today(): Date {
  return midnight(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDate(date: Date): string {
  const d = midnight(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function parseISO(value: string): Date {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return today();
  return new Date(y, m - 1, d);
}

export function shiftISO(days: number): string {
  return isoDate(addDays(new Date(), days));
}

export function longDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function daysAgo(iso?: string): number | null {
  if (!iso) return null;
  return Math.round((today().getTime() - parseISO(iso).getTime()) / 86400000);
}

export function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function nowLabel(): string {
  return "Just now";
}

/** All student-facing session times are locked to South Africa Standard Time. */
export const SAST_TIMEZONE = "Africa/Johannesburg";
export const SAST_LABEL = "SAST";

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value || "";
}

/**
 * Parse a timestamp for display. Offset/Z values stay absolute.
 * Naive `YYYY-MM-DD HH:mm` values are treated as SAST, not the browser zone.
 */
export function parsePortalTimestamp(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const dateTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dateTime) {
    const year = Number(dateTime[1]);
    const month = Number(dateTime[2]) - 1;
    const day = Number(dateTime[3]);
    const hour = Number(dateTime[4]);
    const minute = Number(dateTime[5]);
    const second = Number(dateTime[6] || 0);
    return new Date(Date.UTC(year, month, day, hour - 2, minute, second));
  }
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), -2, 0, 0));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Example: "Sep 22, 2026 @ 18:00 SAST" — identical for every browser timezone. */
export function formatSastDateTime(value: string | Date | null | undefined): string {
  const date = parsePortalTimestamp(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const year = partValue(parts, "year");
  const hour = partValue(parts, "hour").padStart(2, "0");
  const minute = partValue(parts, "minute").padStart(2, "0");
  if (!month || !day || !year) return "";
  return `${month} ${day}, ${year} @ ${hour}:${minute} ${SAST_LABEL}`;
}
