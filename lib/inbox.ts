import { shouldNotifyCoachOfStudentMessage } from "./inbox-notify";
import { getSupabase } from "./supabase";
import { isUserId, notifyAssignmentFeedback } from "./notifications";
import { requestClassroomEmails } from "./student-classroom-email";

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
  pdfUrl: string | null;
  pdfName: string | null;
  createdAt: string;
  read: boolean;
  readAt: string | null;
}

export interface InboxThread {
  studentEmail: string;
  studentId: string | null;
  messages: InboxMessage[];
  waiting: boolean;
  queued: boolean;
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
  pdfUrl?: string | null;
  pdfName?: string | null;
  file?: File | null;
}

export type CoachSentMessageStat = {
  count: number;
  lastAt: string | null;
};

export const EMPTY_COACH_SENT_STAT: CoachSentMessageStat = { count: 0, lastAt: null };

export const INBOX_PDF_SQL_HINT =
  "Paste supabase/inbox-pdfs.sql in the Supabase SQL editor, then try again.";

export function canPostInboxMessage(body: string, hasPdf = false): boolean {
  return Boolean(body.trim() || hasPdf);
}

export function inboxPreviewText(message: Pick<InboxMessage, "body" | "pdfName" | "pdfUrl">): string {
  const body = String(message.body || "").trim();
  if (body) return body;
  if (message.pdfUrl) return message.pdfName || "PDF";
  return "";
}

export function inboxMessageEmailText(body: string, pdfName?: string | null, pdfUrl?: string | null): string {
  const text = body.trim();
  const pdf = pdfUrl ? `${pdfName || "PDF"}\n${pdfUrl}` : "";
  return [text, pdf].filter(Boolean).join("\n\n");
}

export function sanitizeInboxPdfName(name: string): string {
  const cleaned = String(name || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "file"}.pdf`;
}

export function inboxPdfStoragePath(ownerId: string, fileName: string, now = Date.now()): string {
  const owner = String(ownerId || "shared").replace(/[^A-Za-z0-9._-]+/g, "-") || "shared";
  return `inbox/${owner}/${now}-${sanitizeInboxPdfName(fileName)}`;
}

export function studentMessagesHref(studentId: string): string {
  return `/coach/students/${studentId}/messages`;
}

/** How many inbox messages Yvonne has sent each student, keyed by student id. */
export function coachSentStatsByStudentId(
  messages: Array<Pick<InboxMessage, "from" | "studentId" | "studentEmail" | "createdAt">>,
  students: Array<{ id: string; email: string }>
): Record<string, CoachSentMessageStat> {
  const sent = messages.filter((message) => message.from === "coach");
  const out: Record<string, CoachSentMessageStat> = {};
  for (const student of students) {
    const email = String(student.email || "")
      .trim()
      .toLowerCase();
    const mine = sent.filter(
      (message) =>
        (message.studentId && message.studentId === student.id) ||
        String(message.studentEmail || "")
          .trim()
          .toLowerCase() === email
    );
    out[student.id] = {
      count: mine.length,
      lastAt: mine.reduce<string | null>((latest, message) => {
        if (!latest || message.createdAt > latest) return message.createdAt;
        return latest;
      }, null),
    };
  }
  return out;
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
  pdf_url?: string | null;
  pdf_name?: string | null;
  created_at: string;
  read?: boolean | null;
  read_at?: string | null;
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

function inboxPdfMissing(message: string): boolean {
  return /pdf_url|pdf_name|does not exist|schema cache|could not find/i.test(message);
}

function inboxError(message: string): string {
  if (inboxPdfMissing(message) || /storage|inbox\/|not allowed|policy/i.test(message)) {
    return INBOX_PDF_SQL_HINT;
  }
  return message || "Could not send that message.";
}

function fromRow(row: InboxRow): InboxMessage {
  const readAt = row.read_at || null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentEmail: row.student_email,
    from: row.from_role,
    kind: row.kind,
    body: row.body,
    context: row.context,
    lessonId: row.lesson_id,
    pdfUrl: String(row.pdf_url || "").trim() || null,
    pdfName: String(row.pdf_name || "").trim() || null,
    createdAt: row.created_at,
    read: row.read === true || Boolean(readAt),
    readAt,
  };
}

export function formatInboxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const INBOX_MARKED_READ_CONTEXT = "inbox:marked-read";

export function isInboxReceipt(message: Pick<InboxMessage, "from" | "context">): boolean {
  return message.from === "coach" && message.context === INBOX_MARKED_READ_CONTEXT;
}

export function isWaiting(messages: InboxMessage[]): boolean {
  const last = messages[messages.length - 1];
  return Boolean(last && last.from === "student");
}

export function threadNeedsCoachAction(messages: InboxMessage[]): boolean {
  return isWaiting(messages);
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
        queued: threadNeedsCoachAction(sorted),
        lastAt: sorted[sorted.length - 1]?.createdAt || "",
      };
    })
    .sort((a, b) => {
      if (a.queued !== b.queued) return a.queued ? -1 : 1;
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

export async function fetchCoachSentMessages(): Promise<{ ok: boolean; error?: string; data: InboxMessage[] }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, error: authError || "Supabase is not configured.", data: [] };
  if (!user) return { ok: false, error: authError || "Sign in required.", data: [] };

  const { data, error } = await client.from("inbox_messages").select("*").eq("from_role", "coach").order("created_at", { ascending: true });
  if (error) return { ok: false, error: describe(error), data: [] };
  return { ok: true, data: ((data || []) as InboxRow[]).map(fromRow) };
}

/** Legacy Ask-the-Coach questions may live only in notifications. Coach replies and announcements are copies of inbox/notification rows and must not join the thread. */
export function notificationRowToMessage(row: Record<string, unknown>, fallbackEmail: string): InboxMessage | null {
  const id = row.id != null ? String(row.id) : "";
  if (!id) return null;
  const kindRaw = String(row.kind || row.type || "");
  if (kindRaw !== "question") return null;
  const body = String(row.body || row.message || row.title || "").trim();
  if (!body) return null;
  return {
    id,
    studentId: row.student_id ? String(row.student_id) : row.user_id ? String(row.user_id) : null,
    studentEmail: String(row.student_email || fallbackEmail),
    from: "student",
    kind: "question",
    body,
    context: row.context || row.title ? String(row.context || row.title) : null,
    lessonId: row.lesson_id ? String(row.lesson_id) : null,
    pdfUrl: String(row.pdf_url || "").trim() || null,
    pdfName: String(row.pdf_name || "").trim() || null,
    createdAt: String(row.created_at || ""),
    read: Boolean(row.read) || Boolean(row.read_at),
    readAt: row.read_at ? String(row.read_at) : null,
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

export function threadContentKey(row: InboxMessage): string {
  return `${row.from}|${row.body.trim()}|${row.pdfUrl || ""}|${(row.createdAt || "").slice(0, 16)}`;
}

export function mergeThread(rows: InboxMessage[]): InboxMessage[] {
  const unique = new Map<string, InboxMessage>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row) continue;
    if (row.id && unique.has(row.id)) continue;
    const content = threadContentKey(row);
    if (seen.has(content)) continue;
    unique.set(row.id || content, row);
    seen.add(content);
  }
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function studentRowMatches(
  row: Record<string, unknown> | null | undefined,
  student: { id: string; email: string }
): boolean {
  if (!row) return false;
  return matchesStudent(row, student);
}

/** Coach student-detail thread: inbox first, plus leftover question notifications. */
export async function fetchCoachStudentThread(student: {
  id: string;
  email: string;
}): Promise<{ ok: boolean; error?: string; data: InboxMessage[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };

  const email = student.email.trim();
  const merged: InboxMessage[] = [];

  try {
    let inboxQuery = client.from("inbox_messages").select("*").order("created_at", { ascending: true });
    if (email) inboxQuery = inboxQuery.eq("student_email", email);
    else if (isUserId(student.id)) inboxQuery = inboxQuery.eq("student_id", student.id);
    const inbox = await inboxQuery;
    if (inbox.error) console.error("inbox_messages query failed", inbox.error);
    else (inbox.data || []).forEach((row) => merged.push(fromRow(row as InboxRow)));

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

export async function markOwnInboxRead(): Promise<{ ok: boolean; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [{ read: true, read_at: now }, { read: true }, { read_at: now }];
  let lastError = "";

  for (const patch of attempts) {
    let query = client.from("inbox_messages").update(patch).eq("student_id", user.id).eq("from_role", "coach");
    if ("read" in patch) query = query.eq("read", false);
    else query = query.is("read_at", null);
    const { error } = await query;
    if (!error) return { ok: true };
    lastError = describe(error);
  }

  if (user.email) {
    const byEmail = await client
      .from("inbox_messages")
      .update({ read: true, read_at: now })
      .eq("student_email", user.email)
      .eq("from_role", "coach")
      .eq("read", false);
    if (!byEmail.error) return { ok: true };
    lastError = describe(byEmail.error);
  }

  return { ok: false, error: lastError || "Could not mark inbox messages as read." };
}

export function unreadStudentThreadCount(messages: InboxMessage[]): number {
  return groupInboxByStudent(messages).filter((thread) => thread.queued).length;
}

export const COACH_ALERTS_EVENT = "coach-alerts-refresh";

export function refreshCoachAlerts(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COACH_ALERTS_EVENT));
}

export async function markAllCoachInboxRead(): Promise<{ ok: boolean; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [{ read: true, read_at: now }, { read: true }];
  let lastError = "";

  for (const patch of attempts) {
    let query = client.from("inbox_messages").update(patch).eq("from_role", "student");
    if ("read" in patch) query = query.eq("read", false);
    const { error } = await query;
    if (!error) return { ok: true };
    lastError = describe(error);
  }

  return { ok: false, error: lastError || "Could not mark inbox messages as read." };
}

export async function markCoachThreadResolved(student: {
  studentId?: string | null;
  studentEmail: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [{ read: true, read_at: now }, { read: true }];
  let lastError = "";

  for (const patch of attempts) {
    let query = client.from("inbox_messages").update(patch).eq("from_role", "student");
    if ("read" in patch) query = query.eq("read", false);
    if (student.studentId) query = query.eq("student_id", student.studentId);
    else query = query.eq("student_email", student.studentEmail);
    const { error } = await query;
    if (!error) return { ok: true };
    lastError = describe(error);
  }

  return { ok: false, error: lastError || "Could not resolve this thread." };
}

export async function markCoachThreadRead(student: {
  studentId?: string | null;
  studentEmail: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resolved = await markCoachThreadResolved(student);
  if (!resolved.ok) return resolved;

  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const receipt = await client.from("inbox_messages").insert({
    student_id: student.studentId || null,
    student_email: student.studentEmail,
    from_role: "coach",
    kind: "reply",
    body: "Marked as read.",
    context: INBOX_MARKED_READ_CONTEXT,
  });
  if (receipt.error) return { ok: false, error: describe(receipt.error) };
  return { ok: true };
}

export async function uploadInboxPdf(
  file: File,
  ownerId?: string | null
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, error: authError || "Supabase is not configured." };
  if (!user) return { ok: false, error: authError || "Sign in required." };
  if (!file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "That PDF is larger than 20 MB. Compress it, then try again." };
  const looksLikePdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) return { ok: false, error: "Please attach a PDF file." };
  const path = inboxPdfStoragePath(ownerId || user.id, file.name);
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: inboxError(uploaded.error.message) };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that PDF." };
  return { ok: true, url: data.publicUrl, name: file.name.trim() || "file.pdf" };
}

export async function postInboxMessage(
  draft: InboxDraft
): Promise<{ ok: boolean; error?: string; message?: InboxMessage; emailError?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, error: authError || "Supabase is not configured." };
  if (!user) return { ok: false, error: authError || "Sign in required." };

  const body = draft.body.trim();
  let pdfUrl = String(draft.pdfUrl || "").trim();
  let pdfName = String(draft.pdfName || "").trim();
  if (draft.file) {
    const uploaded = await uploadInboxPdf(draft.file, draft.from === "student" ? user.id : draft.studentId || user.id);
    if (uploaded.ok === false) return { ok: false, error: uploaded.error };
    pdfUrl = uploaded.url;
    pdfName = uploaded.name;
  }
  if (!canPostInboxMessage(body, Boolean(pdfUrl))) return { ok: false, error: "Write a message or attach a PDF." };

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
      pdf_url: pdfUrl || null,
      pdf_name: pdfName || null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: inboxError(describe(error)) };
  const message = fromRow(data as InboxRow);
  if (draft.from === "coach") {
    await markCoachThreadResolved({
      studentId: message.studentId || draft.studentId,
      studentEmail: message.studentEmail,
    });
  }
  const emailText = inboxMessageEmailText(body, message.pdfName, message.pdfUrl);
  let emailError = "";
  if (draft.from === "coach" && message.studentEmail.includes("@")) {
    const emailed = await requestClassroomEmails({
      kind: draft.kind === "feedback" ? "assignment_feedback" : "message",
      title: draft.context || (draft.kind === "feedback" ? "Assignment feedback" : "Message from your coach"),
      message: emailText,
      recipients: [
        {
          email: message.studentEmail,
          userId: message.studentId,
          recordId: message.id,
        },
      ],
    });
    if (emailed.failed && !emailed.sent) {
      emailError = emailed.error || "The student email was not sent.";
    }
  }
  if (draft.kind === "feedback" && draft.from === "coach") {
    await notifyAssignmentFeedback({
      studentId: message.studentId,
      studentEmail: message.studentEmail,
      title: draft.context || "Assignment feedback",
      message: emailText,
      sendEmail: false,
    });
  }
  if (draft.from === "student" && shouldNotifyCoachOfStudentMessage(message.studentEmail) && message.id) {
    void fetch("/api/student/inbox-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messageId: message.id, context: draft.context || "" }),
    });
  }
  return { ok: true, message, emailError: emailError || undefined };
}

export async function postInboxMessagesToStudents(
  students: Array<{ id: string; email: string }>,
  body: string,
  file?: File | null
): Promise<{ ok: boolean; sent: number; error?: string; emailError?: string }> {
  const text = body.trim();
  if (!canPostInboxMessage(text, Boolean(file))) return { ok: false, sent: 0, error: "Write a message or attach a PDF." };
  if (!students.length) return { ok: false, sent: 0, error: "Pick at least one student." };
  let pdfUrl = "";
  let pdfName = "";
  if (file) {
    const uploaded = await uploadInboxPdf(file, students[0]?.id);
    if (uploaded.ok === false) return { ok: false, sent: 0, error: uploaded.error };
    pdfUrl = uploaded.url;
    pdfName = uploaded.name;
  }
  let sent = 0;
  let lastError = "";
  let emailError = "";
  for (const student of students) {
    const result = await postInboxMessage({
      studentId: student.id,
      studentEmail: student.email,
      from: "coach",
      kind: "reply",
      body: text,
      context: "Coach reply",
      pdfUrl,
      pdfName,
    });
    if (result.ok) sent += 1;
    else lastError = result.error || lastError;
    if (result.emailError) emailError = result.emailError;
  }
  return {
    ok: sent === students.length,
    sent,
    error: sent === students.length ? undefined : lastError || "Could not send every message.",
    emailError: emailError || undefined,
  };
}

export function messageLabel(message: InboxMessage, viewer: InboxRole): string {
  if (message.kind === "feedback") return "Assignment feedback";
  if (message.from === "student") return viewer === "student" ? "You asked" : "Student asked";
  return viewer === "coach" ? "You replied" : "Coach";
}
