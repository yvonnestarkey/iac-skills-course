import { getSupabase } from "./supabase";
import { notifyAssignmentFeedback } from "./notifications";

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

export function formatInboxTime(iso: string): string {
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

/** Student inbox: only rows owned by auth.uid(). */
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
  }
  return { ok: true, message };
}

export function messageLabel(message: InboxMessage, viewer: InboxRole): string {
  if (message.kind === "feedback") return "Assignment feedback";
  if (message.from === "student") return viewer === "student" ? "You asked" : "Student asked";
  return viewer === "coach" ? "You replied" : "Coach";
}
