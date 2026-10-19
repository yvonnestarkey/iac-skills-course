import { isoToSastDateAndTime } from "@/lib/dates";

export type RegistrationAction = "deregister" | "set_expiry" | "restore";

export function asAccessDate(value: unknown): string | null {
  const text = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function sastTodayDate(now: Date = new Date()): string {
  return isoToSastDateAndTime(now).date;
}

export function isCourseAccessClosed(
  input: { accessExpiresOn?: string | null; deregisteredAt?: string | null },
  now: Date = new Date()
): boolean {
  if (String(input.deregisteredAt || "").trim()) return true;
  const expiresOn = asAccessDate(input.accessExpiresOn);
  if (!expiresOn) return false;
  const today = sastTodayDate(now);
  return Boolean(today && today > expiresOn);
}

export function registrationLabel(input: {
  accessActive?: boolean;
  accessExpiresOn?: string | null;
  deregisteredAt?: string | null;
}): "Deregistered" | "Expires" | null {
  if (input.accessActive === false || isCourseAccessClosed(input)) return "Deregistered";
  if (asAccessDate(input.accessExpiresOn)) return "Expires";
  return null;
}

export function accountStatusLabel(input: {
  status?: "active" | "paused" | string | null;
  accessActive?: boolean;
}): "Deregistered" | "Paused" | "Active" {
  if (input.accessActive === false) return "Deregistered";
  if (input.status === "paused") return "Paused";
  return "Active";
}

export function showInactiveOnRoster(search: string): boolean {
  return Boolean(search.trim());
}
