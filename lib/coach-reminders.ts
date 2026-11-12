import { isoDate, isoToSastDateAndTime } from "./dates";
import { getSupabase } from "./supabase";

export const COACH_REMINDERS_SQL_HINT =
  "Paste supabase/coach-reminders.sql in the Supabase SQL editor, then try again.";

export type CoachReminder = {
  id: string;
  body: string;
  dueOn: string | null;
  done: boolean;
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CoachReminderWrite = {
  id?: string;
  body: string;
  dueOn: string | null;
  done?: boolean;
  studentIds: string[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tableMissing(message: string): boolean {
  return /coach_reminders|does not exist|schema cache|could not find/i.test(message);
}

function reminderError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return COACH_REMINDERS_SQL_HINT;
  }
  return message || "Could not update that reminder.";
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

export function reminderFromRow(row: Record<string, unknown>): CoachReminder {
  return {
    id: String(row.id),
    body: asText(row.body),
    dueOn: asText(row.due_on) || null,
    done: row.done === true,
    studentIds: asIdList(row.student_ids),
    createdAt: asText(row.created_at),
    updatedAt: asText(row.updated_at),
  };
}

export function reminderWriteRow(
  input: CoachReminderWrite
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write what you want to remember." };
  const dueOn = String(input.dueOn || "").trim() || null;
  return {
    ok: true,
    row: {
      body,
      due_on: dueOn,
      done: input.done === true,
      student_ids: asIdList(input.studentIds),
      updated_at: new Date().toISOString(),
    },
  };
}

export function reminderDueLabel(reminder: CoachReminder, now: Date = new Date()): "overdue" | "today" | "upcoming" | "none" {
  if (!reminder.dueOn) return "none";
  const today = isoToSastDateAndTime(now).date || isoDate(now);
  if (reminder.dueOn < today) return "overdue";
  if (reminder.dueOn === today) return "today";
  return "upcoming";
}

export function sortCoachReminders(reminders: CoachReminder[], now: Date = new Date()): CoachReminder[] {
  const today = isoToSastDateAndTime(now).date || isoDate(now);
  const rank = (reminder: CoachReminder) => {
    if (reminder.done) return 4;
    if (!reminder.dueOn) return 3;
    if (reminder.dueOn < today) return 0;
    if (reminder.dueOn === today) return 1;
    return 2;
  };
  return [...reminders].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    return String(a.dueOn || a.createdAt).localeCompare(String(b.dueOn || b.createdAt));
  });
}

export function dueOnInDays(days: number, now: Date = new Date()): string {
  const today = isoToSastDateAndTime(now).date || isoDate(now);
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(year, (month || 1) - 1, (day || 1) + days);
  return isoDate(next);
}

export async function listCoachReminders(): Promise<{ ok: boolean; error?: string; reminders: CoachReminder[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", reminders: [] };
  const { data, error } = await client.from("coach_reminders").select("*").order("created_at", { ascending: false });
  if (error) return { ok: false, error: reminderError(error.message), reminders: [] };
  return { ok: true, reminders: sortCoachReminders(((data || []) as Record<string, unknown>[]).map(reminderFromRow)) };
}

export async function saveCoachReminder(
  input: CoachReminderWrite
): Promise<{ ok: true; reminder: CoachReminder } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const built = reminderWriteRow(input);
  if (built.ok === false) return built;
  const { data: session } = await client.auth.getUser();
  const row = { ...built.row, created_by: session.user?.id || null };
  const query = input.id
    ? client.from("coach_reminders").update(row).eq("id", input.id).select("*").maybeSingle()
    : client.from("coach_reminders").insert(row).select("*").maybeSingle();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: reminderError(error?.message || "Could not save that reminder.") };
  return { ok: true, reminder: reminderFromRow(data as Record<string, unknown>) };
}

export async function deleteCoachReminder(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("coach_reminders").delete().eq("id", id);
  if (error) return { ok: false, error: reminderError(error.message) };
  return { ok: true };
}
