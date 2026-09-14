import { getSupabase } from "./supabase";
import { insertCoachNotifications, isUserId, notifyAssignmentFeedback } from "./notifications";

export type InboxRole = "student" | "coach";
export type InboxKind = "question" | "reply" | "feedback";

export interface InboxMessage {
  id: string;
  studentId: string | null;
  studentEmail: string;
  from: InboxRole;
  kind: InboxKind;
  body: string;
  context: string | null;
  lessonId: string | null;
  createdAt: string;
}

export interface InboxThread {
  studentEmail: string;
  studentId: string | null;
  messages: InboxMessage[];
  waiting: boolean;
  lastAt: string;
}

export interface InboxDraft {
  studentId?: string | null;
  studentEmail: string;
  from: InboxRole;
  kind: InboxKind;
  body: string;
  context?: string;
  lessonId?: string;
}

interface InboxRow {
  id: string;
  student_id: string | null;
  student_email: string;
  from_role: InboxRole;
  kind: InboxKind;
  body: string;
  context: string | null;
  lesson_id: string | null;
  created_at: string;
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

function fromRow(row: InboxRow): InboxMessage {
  return {
    id: row.id,
    studentId: row.student_id,
    studentEmail: row.student_email,
    from: row.from_role,
    kind: row.kind,
    body: row.body,
    context: row.context,
    lessonId: row.lesson_id,
    createdAt: row.created_at,
  };
}

export function formatInboxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function isWaiting(messages: InboxMessage[]): boolean {
  const last = messages[messages.length - 1];
  return Boolean(last && last.from === "student");
}

export function groupInboxByStudent(messages: InboxMessage[]): InboxThread[] {
  const grouped = new Map<string, InboxMessage[]>();
  messages.forEach((message) => {
    const list = grouped.get(message.studentEmail) || [];
    list.push(message);
    grouped.set(message.studentEmail, list);
  });
  return [...grouped.entries()]
    .map(([studentEmail, thread]) => {
      const sorted = [...thread].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        studentEmail,
        studentId: sorted.find((item) => item.studentId)?.studentId || null,
        messages: sorted,
        waiting: isWaiting(sorted),
        lastAt: sorted[sorted.length - 1]?.createdAt || "",
      };
    })
    .sort((a, b) => {
      if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
      return b.lastAt.localeCompare(a.lastAt);
    });
}

async function authClient() {
  const client = getSupabase();
  if (!client) return { client: null, user: null, error: "Supabase is not configured." };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null, error: "Sign in to load your messages." };
  return { client, user: data.user, error: null };
}

/** Coach roster view. RLS still hides other students' rows from non-staff. */
export async function fetchInboxMessages(studentEmail?: string): Promise<{ ok: boolean; error?: string; data: InboxMessage[] }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, error: authError || "Supabase is not configured.", data: [] };
  if (!user) return { ok: false, error: authError || "Sign in required.", data: [] };

  let query = client.from("inbox_messages").select("*").order("created_at", { ascending: true });
  if (studentEmail) query = query.eq("student_email", studentEmail);

  const { data, error } = await query;
  if (error) return { ok: false, error: describe(error), data: [] };
  return { ok: true, data: ((data || []) as InboxRow[]).map(fromRow) };
}

function notificationRowToMessage(row: Record<string, unknown>, fallbackEmail: string): InboxMessage | null {
  const id = row.id != null ? String(row.id) : "";
  if (!id) return null;
  const kindRaw = String(row.kind || row.type || "");
  const from: InboxRole = row.from_role === "student" || kindRaw === "question" ? "student" : "coach";
  const kind: InboxKind = kindRaw === "question" || kindRaw === "feedback" ? kindRaw : "reply";
  const body = String(row.body || row.message || row.title || "").trim();
  if (!body) return null;
  return {
    id,
    studentId: row.student_id ? String(row.student_id) : row.user_id ? String(row.user_id) : null,
    studentEmail: String(row.student_email || fallbackEmail),
    from,
    kind,
    body,
    context: row.context || row.title ? String(row.context || row.title) : null,
    lessonId: row.lesson_id ? String(row.lesson_id) : null,
    createdAt: String(row.created_at || ""),
  };
}

function matchesStudent(row: Record<string, unknown>, student: { id: string; email: string }): boolean {
  const email = student.email.toLowerCase();
  const rowEmail = String(row.student_email || "").toLowerCase();
  if (email && rowEmail && rowEmail === email) return true;
  if (isUserId(student.id) && (String(row.student_id || "") === student.id || String(row.user_id || "") === student.id)) {
    return true;
  }
  return false;
}

function mergeThread(rows: InboxMessage[]): InboxMessage[] {
  const unique = new Map<string, InboxMessage>();
  rows.forEach((row) => {
    if (row?.id) unique.set(row.id, row);
  });
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function studentRowMatches(
  row: Record<string, unknown> | null | undefined,
  student: { id: string; email: string }
): boolean {
  if (!row) return false;
  return matchesStudent(row, student);
}

/** Coach student-detail thread from notifications (and inbox_messages if present). */
export async function fetchCoachStudentThread(student: {
  id: string;
  email: string;
}): Promise<{ ok: boolean; error?: string; data: InboxMessage[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };

  const email = student.email.trim();
  const merged: InboxMessage[] = [];

  try {
    if (email) {
      const byEmail = await client
        .from("notifications")
        .select("*")
        .eq("student_email", email)
        .order("created_at", { ascending: true });
      if (byEmail.error) console.error("notifications email query failed", byEmail.error);
      else {
        (byEmail.data || []).forEach((row) => {
          const message = notificationRowToMessage(row as Record<string, unknown>, email);
          if (message) merged.push(message);
        });
      }
    }

    if (isUserId(student.id)) {
      const byId = await client
        .from("notifications")
        .select("*")
        .or(`student_id.eq.${student.id},user_id.eq.${student.id}`)
        .order("created_at", { ascending: true });
      if (byId.error) console.error("notifications student_id query failed", byId.error);
      else {
        (byId.data || []).forEach((row) => {
          const message = notificationRowToMessage(row as Record<string, unknown>, email);
          if (message) merged.push(message);
        });
      }
    }

    let inboxQuery = client.from("inbox_messages").select("*").order("created_at", { ascending: true });
    if (email) inboxQuery = inboxQuery.eq("student_email", email);
    else if (isUserId(student.id)) inboxQuery = inboxQuery.eq("student_id", student.id);
    const inbox = await inboxQuery;
    if (inbox.error) console.error("inbox_messages query failed", inbox.error);
    else (inbox.data || []).forEach((row) => merged.push(fromRow(row as InboxRow)));
  } catch (error) {
    console.error("fetchCoachStudentThread failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load this student's messages.",
      data: mergeThread(merged),
    };
  }

  return { ok: true, data: mergeThread(merged) };
}
export async function fetchOwnInboxMessages(): Promise<{ ok: boolean; error?: string; data: InboxMessage[] }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required.", data: [] };

  const { data, error } = await client
    .from("inbox_messages")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: describe(error), data: [] };
  return { ok: true, data: ((data || []) as InboxRow[]).map(fromRow) };
}

export async function postInboxMessage(draft: InboxDraft): Promise<{ ok: boolean; error?: string; message?: InboxMessage }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, error: authError || "Supabase is not configured." };
  if (!user) return { ok: false, error: authError || "Sign in required." };

  const body = draft.body.trim();
  if (!body) return { ok: false, error: "Write a message first." };

  const studentOwned = draft.from === "student";
  const { data, error } = await client
    .from("inbox_messages")
    .insert({
      student_id: studentOwned ? user.id : draft.studentId || null,
      student_email: studentOwned ? user.email || draft.studentEmail : draft.studentEmail,
      from_role: draft.from,
      kind: draft.kind,
      body,
      context: draft.context || null,
      lesson_id: draft.lessonId || null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: describe(error) };
  const message = fromRow(data as InboxRow);
  if (draft.kind === "feedback" && draft.from === "coach") {
    await notifyAssignmentFeedback({
      studentId: message.studentId,
      studentEmail: message.studentEmail,
      title: draft.context || "Assignment feedback",
      message: body,
    });
  } else if (draft.from === "coach" && draft.kind === "reply") {
    let studentId = message.studentId || draft.studentId || "";
    if (!isUserId(studentId) && message.studentEmail) {
      const profile = await client.from("profiles").select("id").ilike("email", message.studentEmail).maybeSingle();
      studentId = profile.data?.id || "";
    }
    if (isUserId(studentId)) {
      await insertCoachNotifications({
        students: [{ id: studentId, email: message.studentEmail }],
        title: draft.context || "Coach reply",
        message: body,
        kind: "reply",
      });
    }
  }
  return { ok: true, message };
}

export function messageLabel(message: InboxMessage, viewer: InboxRole): string {
  if (message.kind === "feedback") return "Assignment feedback";
  if (message.from === "student") return viewer === "student" ? "You asked" : "Student asked";
  return viewer === "coach" ? "You replied" : "Coach";
}
