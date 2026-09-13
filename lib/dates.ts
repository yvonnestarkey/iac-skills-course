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
