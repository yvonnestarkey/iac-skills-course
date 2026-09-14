import { getSupabase } from "./supabase";
import { fetchStudentProfiles } from "./profiles";
import type { CommunicationAudience } from "./types";

export type NotificationType = "announcement" | "assignment_feedback" | "question" | "reply";

export interface StudentNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUserId(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

export function notificationFromRow(row: NotificationRow | Record<string, unknown> | null | undefined): StudentNotification | null {
  if (!row || typeof row !== "object") return null;
  const data = row as NotificationRow & {
    student_id?: string;
    body?: string;
    kind?: string;
    title?: string;
    message?: string;
    type?: string;
  };
  const id = data.id != null ? String(data.id) : "";
  if (!id || id === "undefined" || id === "null") return null;
  const kind = String(data.type || data.kind || "announcement");
  if (kind === "question" || kind === "reply") return null;
  return {
    id,
    userId: data.user_id != null ? String(data.user_id) : data.student_id != null ? String(data.student_id) : "",
    title: String(data.title || (kind === "assignment_feedback" ? "Assignment feedback" : "Announcement")),
    message: String(data.message || data.body || ""),
    type: kind === "assignment_feedback" ? "assignment_feedback" : "announcement",
    read: Boolean(data.read),
    createdAt: String(data.created_at || ""),
  };
}

export function asNotificationList(value: unknown): StudentNotification[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === "object" && "id" in row && "title" in row ? (row as StudentNotification) : notificationFromRow(row as NotificationRow)))
    .filter((item): item is StudentNotification => Boolean(item?.id));
}

async function authClient() {
  const client = getSupabase();
  if (!client) return { client: null, user: null, error: "Supabase is not configured." };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null, error: "Sign in required." };
  return { client, user: data.user, error: null };
}

export async function fetchOwnNotifications(): Promise<{
  ok: boolean;
  error?: string;
  data: StudentNotification[];
}> {
  try {
    const { client, user, error: authError } = await authClient();
    if (!client || !user) return { ok: false, error: authError || "Sign in required.", data: [] };

    let { data, error } = await client
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      const fallback = await client
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { ok: false, error: describe(error), data: [] };
    return { ok: true, data: asNotificationList((data || []).map((row) => notificationFromRow(row as NotificationRow))) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load notifications.", data: [] };
  }
}

export async function fetchUnreadNotifications(userId: string): Promise<{
  ok: boolean;
  error?: string;
  data: StudentNotification[];
}> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required.", data: [] };

  const { data, error } = await client
    .from("notifications")
    .select("id, user_id, title, message, type, read, created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: describe(error), data: [] };
  return { ok: true, data: asNotificationList((data || []).map((row) => notificationFromRow(row as NotificationRow))) };
}

export async function markOwnNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const { error } = await client.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export interface NotificationTarget {
  id: string;
  email: string;
}

export function notificationRowsForStudents(input: {
  students: NotificationTarget[];
  title: string;
  message: string;
  kind: NotificationType;
}) {
  const title = input.title.trim();
  const message = input.message.trim();
  return input.students.filter((student) => isUserId(student.id)).map((student) => ({
    user_id: student.id,
    student_id: student.id,
    student_email: student.email,
    from_role: "coach" as const,
    kind: input.kind,
    type: input.kind,
    title,
    message,
    body: message,
    read: false,
  }));
}

export async function resolveNotificationTargets(input: {
  audience: CommunicationAudience;
  recipientIds: string[];
  students?: { id: string; email: string }[];
}): Promise<NotificationTarget[]> {
  const roster = await fetchStudentProfiles();
  const live = roster.data || [];
  const byId = new Map(live.map((row) => [row.id, { id: row.id, email: row.email }]));
  const byEmail = new Map(live.map((row) => [row.email.toLowerCase(), { id: row.id, email: row.email }]));

  if (input.audience === "all") return live.map((row) => ({ id: row.id, email: row.email }));

  const matched = new Map<string, NotificationTarget>();
  input.recipientIds.forEach((id) => {
    const hit = byId.get(id);
    if (hit) matched.set(hit.id, hit);
  });
  (input.students || []).forEach((student) => {
    if (!input.recipientIds.includes(student.id)) return;
    const hit = byId.get(student.id) || byEmail.get(student.email.toLowerCase());
    if (hit) matched.set(hit.id, hit);
  });

  if (!matched.size && (input.audience === "cohort" || input.audience === "filtered")) {
    return live.map((row) => ({ id: row.id, email: row.email }));
  }
  return [...matched.values()];
}

function logInsertError(error: { message?: string; details?: string; hint?: string; code?: string }, rows: unknown) {
  console.error("Supabase notifications insert failed", error, rows);
}

export async function insertCoachNotifications(input: {
  students: NotificationTarget[];
  title: string;
  message: string;
  kind: NotificationType;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, count: 0, error: "Supabase is not configured." };

  const { data: sessionData, error: sessionError } = await client.auth.getUser();
  if (sessionError || !sessionData.user) {
    const error = "Sign in at /student/login with your coach account. The demo coach switcher does not create a Supabase session.";
    console.error(error, sessionError);
    return { ok: false, count: 0, error };
  }

  const title = input.title.trim();
  const message = input.message.trim();
  const rows = notificationRowsForStudents({ ...input, title, message });
  if (!title || !message) return { ok: false, count: 0, error: "Write a title and message first." };
  if (!rows.length) {
    const error = "No registered students to notify. Demo roster IDs are not saved to Supabase.";
    console.error(error, input.students);
    return { ok: false, count: 0, error };
  }

  const first = await client.from("notifications").insert(rows).select("id");
  if (!first.error) return { ok: true, count: first.data?.length || rows.length };

  logInsertError(first.error, rows);

  const fallback = await client.from("notifications").insert(
    rows.map((row) => ({
      user_id: row.user_id,
      student_id: row.student_id,
      student_email: row.student_email,
      from_role: row.from_role,
      kind: row.kind,
      body: row.body,
    }))
  ).select("id");
  if (!fallback.error) return { ok: true, count: fallback.data?.length || rows.length };

  logInsertError(fallback.error, rows);
  return { ok: false, count: 0, error: describe(fallback.error) };
}

/** One-student assignment feedback from the coach inbox. */
export async function notifyAssignmentFeedback(input: {
  studentId?: string | null;
  studentEmail?: string;
  title: string;
  message: string;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  let userId = input.studentId || "";
  if (!isUserId(userId) && input.studentEmail) {
    const client = getSupabase();
    if (client) {
      const { data } = await client.from("profiles").select("id").ilike("email", input.studentEmail).maybeSingle();
      userId = data?.id || "";
    }
  }
  if (!isUserId(userId)) return { ok: false, count: 0, error: "No student account to notify." };
  return insertCoachNotifications({
    students: [{ id: userId, email: input.studentEmail || "" }],
    title: input.title,
    message: input.message,
    kind: "assignment_feedback",
  });
}

/** Coach announcement: one row per recipient, or every active student for a broadcast. */
export async function deliverAnnouncement(input: {
  title: string;
  message: string;
  audience: CommunicationAudience;
  recipientIds: string[];
  students?: { id: string; email: string }[];
}): Promise<{ ok: boolean; count: number; error?: string }> {
  const targets = await resolveNotificationTargets(input);
  return insertCoachNotifications({
    students: targets,
    title: input.title,
    message: input.message,
    kind: "announcement",
  });
}
