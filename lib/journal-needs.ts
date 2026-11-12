import { JOURNAL_NEEDS, journalChoiceLabel } from "./study-journal";
import { getSupabase } from "./supabase";
import { isUserId } from "./notifications";

export const JOURNAL_NEEDS_SQL_HINT =
  "Paste supabase/student-journal-needs.sql in the Supabase SQL editor, then try again.";

export type JournalNeedEvent = {
  id: string;
  userId: string;
  weekStart: string;
  needId: string;
  needOther: string;
  selectedAt: string;
  clearedAt: string | null;
  contactedAt: string | null;
};

export type JournalNeedAlert = {
  eventIds: string[];
  studentId: string;
  studentName: string;
  weekStart: string;
  needOther: string;
  selectedAt: string;
};

export type CoachJournalNeedGroup = {
  id: string;
  label: string;
  alerts: JournalNeedAlert[];
};

export function isOpenJournalNeed(event: Pick<JournalNeedEvent, "needId" | "clearedAt" | "contactedAt">): boolean {
  return Boolean(event.needId) && !event.clearedAt && !event.contactedAt;
}

export function journalNeedEventKey(userId: string, weekStart: string, needId: string): string {
  return `${userId}:${weekStart}:${needId}`;
}

export function applyJournalNeedChange(
  openEvents: JournalNeedEvent[],
  nextNeed: string,
  nextOther = ""
): { keepId: string | null; clearIds: string[]; insert: boolean } {
  const need = nextNeed.trim();
  const other = need === "other" ? nextOther.trim() : "";
  if (!need) return { keepId: null, clearIds: openEvents.map((event) => event.id), insert: false };
  const match = openEvents.find((event) => event.needId === need && event.needOther === other);
  if (match) {
    return { keepId: match.id, clearIds: openEvents.filter((event) => event.id !== match.id).map((event) => event.id), insert: false };
  }
  return { keepId: null, clearIds: openEvents.map((event) => event.id), insert: true };
}

export function mergeOpenJournalNeeds(
  events: JournalNeedEvent[],
  journalRows: Array<{ userId: string; weekStart: string; needId: string; needOther: string; updatedAt: string }>,
  privateIds: Set<string>
): JournalNeedEvent[] {
  const visibleEvents = events.filter((event) => !privateIds.has(event.userId));
  const covered = new Set(
    visibleEvents.map((event) => journalNeedEventKey(event.userId, event.weekStart, event.needId))
  );
  const open = visibleEvents.filter(isOpenJournalNeed);
  journalRows.forEach((row) => {
    if (!row.needId || privateIds.has(row.userId)) return;
    const key = journalNeedEventKey(row.userId, row.weekStart, row.needId);
    if (covered.has(key)) return;
    open.push({
      id: `journal:${key}`,
      userId: row.userId,
      weekStart: row.weekStart,
      needId: row.needId,
      needOther: row.needId === "other" ? row.needOther : "",
      selectedAt: row.updatedAt,
      clearedAt: null,
      contactedAt: null,
    });
  });
  return open;
}

export function groupCoachJournalNeeds(
  openEvents: JournalNeedEvent[],
  names: Record<string, string>
): CoachJournalNeedGroup[] {
  const latest = new Map<string, JournalNeedEvent>();
  openEvents.forEach((event) => {
    const key = `${event.userId}:${event.needId}`;
    const current = latest.get(key);
    if (!current || event.selectedAt > current.selectedAt || event.weekStart > current.weekStart) {
      latest.set(key, event);
    }
  });
  const extras = new Map<string, string[]>();
  openEvents.forEach((event) => {
    const key = `${event.userId}:${event.needId}`;
    extras.set(key, [...(extras.get(key) || []), event.id]);
  });
  return JOURNAL_NEEDS.map((option) => ({
    id: option.id,
    label: option.label,
    alerts: [...latest.values()]
      .filter((event) => event.needId === option.id)
      .sort((a, b) => b.selectedAt.localeCompare(a.selectedAt))
      .map((event) => ({
        eventIds: [...new Set(extras.get(`${event.userId}:${event.needId}`) || [event.id])],
        studentId: event.userId,
        studentName: names[event.userId] || "Student",
        weekStart: event.weekStart,
        needOther: event.needOther,
        selectedAt: event.selectedAt,
      })),
  }));
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDate(value: unknown): string {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function tableMissing(message: string): boolean {
  return /student_journal_need_events|does not exist|schema cache|could not find/i.test(message);
}

function needsError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return JOURNAL_NEEDS_SQL_HINT;
  }
  return message || "Could not update journal needs.";
}

export function journalNeedEventFromRow(row: Record<string, unknown>): JournalNeedEvent {
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    weekStart: asDate(row.week_start),
    needId: asText(row.need_id),
    needOther: asText(row.need_other),
    selectedAt: asText(row.selected_at),
    clearedAt: asText(row.cleared_at) || null,
    contactedAt: asText(row.contacted_at) || null,
  };
}

export async function recordJournalNeedChange(
  userId: string,
  weekStart: string,
  needId: string,
  needOther = ""
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client || !isUserId(userId) || !weekStart) return { ok: true };
  const { data, error } = await client
    .from("student_journal_need_events")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .is("cleared_at", null)
    .is("contacted_at", null);
  if (error) return { ok: tableMissing(error.message), error: needsError(error.message) };
  const open = (data || []).map((row) => journalNeedEventFromRow(row as Record<string, unknown>));
  const change = applyJournalNeedChange(open, needId, needOther);
  if (change.clearIds.length) {
    const cleared = await client
      .from("student_journal_need_events")
      .update({ cleared_at: new Date().toISOString() })
      .in("id", change.clearIds);
    if (cleared.error) return { ok: tableMissing(cleared.error.message), error: needsError(cleared.error.message) };
  }
  if (!change.insert) return { ok: true };
  const inserted = await client.from("student_journal_need_events").insert({
    user_id: userId,
    week_start: weekStart,
    need_id: needId.trim(),
    need_other: needId.trim() === "other" ? needOther.trim() : "",
  });
  if (inserted.error) return { ok: tableMissing(inserted.error.message), error: needsError(inserted.error.message) };
  return { ok: true };
}

export async function fetchCoachJournalNeeds(
  students: Array<{ id: string; name: string }>
): Promise<{ ok: boolean; error?: string; groups: CoachJournalNeedGroup[] }> {
  const empty = groupCoachJournalNeeds([], {});
  const client = getSupabase();
  if (!client) return { ok: true, groups: empty };
  const names = Object.fromEntries(students.map((student) => [student.id, student.name]));
  const settings = await client.from("student_study_journal_settings").select("user_id, private");
  const privateIds = new Set(
    (settings.data || [])
      .filter((row) => (row as { private?: boolean }).private === true)
      .map((row) => String((row as { user_id?: string }).user_id || ""))
      .filter(Boolean)
  );
  const events = await client.from("student_journal_need_events").select("*").order("selected_at", { ascending: false });
  if (events.error && !tableMissing(events.error.message)) {
    return { ok: false, error: needsError(events.error.message), groups: empty };
  }
  const journals = await client
    .from("student_study_journal")
    .select("user_id, week_start, week_need, week_need_other, updated_at")
    .neq("week_need", "");
  const open = mergeOpenJournalNeeds(
    (events.data || []).map((row) => journalNeedEventFromRow(row as Record<string, unknown>)),
    (journals.data || []).map((row) => ({
      userId: String((row as { user_id?: string }).user_id || ""),
      weekStart: asDate((row as { week_start?: string }).week_start),
      needId: asText((row as { week_need?: string }).week_need),
      needOther: asText((row as { week_need_other?: string }).week_need_other),
      updatedAt: asText((row as { updated_at?: string }).updated_at),
    })),
    privateIds
  );
  return { ok: true, error: events.error ? needsError(events.error.message) : undefined, groups: groupCoachJournalNeeds(open, names) };
}

export async function markJournalNeedContacted(
  eventIds: string[],
  studentId: string,
  weekStart: string,
  needId: string,
  needOther = ""
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: true };
  const stamp = new Date().toISOString();
  const realIds = eventIds.filter((id) => isUserId(id));
  if (realIds.length) {
    const updated = await client.from("student_journal_need_events").update({ contacted_at: stamp }).in("id", realIds);
    if (updated.error) return { ok: false, error: needsError(updated.error.message) };
    return { ok: true };
  }
  if (!isUserId(studentId) || !weekStart || !needId) return { ok: false, error: "Missing journal need." };
  const inserted = await client.from("student_journal_need_events").insert({
    user_id: studentId,
    week_start: weekStart,
    need_id: needId,
    need_other: needId === "other" ? needOther : "",
    selected_at: stamp,
    contacted_at: stamp,
  });
  if (inserted.error) return { ok: false, error: needsError(inserted.error.message) };
  return { ok: true };
}

export async function fetchCoachJournalNeedAudit(studentId: string): Promise<{
  ok: boolean;
  error?: string;
  hidden: boolean;
  events: JournalNeedEvent[];
}> {
  if (!isUserId(studentId)) return { ok: true, hidden: false, events: [] };
  const client = getSupabase();
  if (!client) return { ok: true, hidden: false, events: [] };
  const settings = await client.from("student_study_journal_settings").select("private").eq("user_id", studentId).maybeSingle();
  if ((settings.data as { private?: boolean } | null)?.private) {
    return { ok: true, hidden: true, events: [] };
  }
  const { data, error } = await client
    .from("student_journal_need_events")
    .select("*")
    .eq("user_id", studentId)
    .order("selected_at", { ascending: false });
  if (error) {
    return { ok: tableMissing(error.message), error: needsError(error.message), hidden: false, events: [] };
  }
  return { ok: true, hidden: false, events: (data || []).map((row) => journalNeedEventFromRow(row as Record<string, unknown>)) };
}

export function journalNeedAuditLabel(event: JournalNeedEvent): string {
  const label = journalChoiceLabel(JOURNAL_NEEDS, event.needId) || event.needId;
  return event.needOther ? `${label} · ${event.needOther}` : label;
}
