import { inboxMessageEmailText } from "./inbox";
import { notificationRowsForStudents } from "./notifications";
import { requestClassroomEmails } from "./student-classroom-email";
import { getServiceSupabase } from "./supabase-admin";
import {
  SCHEDULED_SEND_SQL_HINT,
  scheduledSendDue,
  scheduledSendFromRow,
  scheduledTableMissing,
  validateScheduledSendWrite,
  type ScheduledRecipient,
  type ScheduledSend,
  type ScheduledSendWrite,
} from "./scheduled-sends";
import type { SupabaseClient } from "@supabase/supabase-js";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

export async function listScheduledSendsAdmin(): Promise<{ ok: boolean; data: ScheduledSend[]; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, data: [], error: "Supabase is not configured." };
  const listed = await client.from("scheduled_sends").select("*").is("cancelled_at", null).order("created_at", { ascending: false });
  if (listed.error) {
    if (scheduledTableMissing(listed.error.message)) return { ok: false, data: [], error: SCHEDULED_SEND_SQL_HINT };
    return { ok: false, data: [], error: listed.error.message };
  }
  const counts = await client.from("scheduled_send_deliveries").select("send_id");
  const tally = new Map<string, number>();
  if (!counts.error) {
    (counts.data || []).forEach((row) => {
      const id = asText((row as { send_id?: string }).send_id);
      if (id) tally.set(id, (tally.get(id) || 0) + 1);
    });
  }
  return {
    ok: true,
    data: (listed.data || [])
      .map((row) => scheduledSendFromRow(row as Record<string, unknown>, tally.get(asText((row as { id?: string }).id)) || 0))
      .filter((row): row is ScheduledSend => Boolean(row))
      .filter((row) => row.deliveredCount < row.recipients.length),
  };
}

export async function createScheduledSendAdmin(
  input: ScheduledSendWrite,
  createdBy?: string | null
): Promise<{ ok: boolean; data?: ScheduledSend; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const checked = validateScheduledSendWrite(input);
  if (checked.ok === false) return { ok: false, error: checked.error };
  const write = checked.write;
  const inserted = await client
    .from("scheduled_sends")
    .insert({
      channel: write.channel,
      message_kind: write.messageKind || "reply",
      title: write.title || "",
      body: write.body,
      pdf_url: write.pdfUrl || null,
      pdf_name: write.pdfName || null,
      audience: write.audience || "student",
      audience_label: write.audienceLabel || "",
      recipients: write.recipients,
      trigger_type: write.trigger,
      send_at: write.sendAt || null,
      lesson_id: write.lessonId || null,
      task_id: write.taskId || null,
      created_by: createdBy || null,
    })
    .select("*")
    .maybeSingle();
  if (inserted.error) {
    if (scheduledTableMissing(inserted.error.message)) return { ok: false, error: SCHEDULED_SEND_SQL_HINT };
    return { ok: false, error: inserted.error.message };
  }
  const next = scheduledSendFromRow((inserted.data || {}) as Record<string, unknown>);
  if (!next) return { ok: false, error: "Could not schedule that send." };
  const claimed = await claimDueScheduledSends({ sendId: next.id });
  return { ok: true, data: { ...next, deliveredCount: claimed.inserted || 0 } };
}

export async function cancelScheduledSendAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const updated = await client
    .from("scheduled_sends")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("cancelled_at", null);
  if (updated.error) {
    if (scheduledTableMissing(updated.error.message)) return { ok: false, error: SCHEDULED_SEND_SQL_HINT };
    return { ok: false, error: updated.error.message };
  }
  return { ok: true };
}

async function loadOpenSends(client: SupabaseClient, sendId?: string): Promise<ScheduledSend[]> {
  let query = client.from("scheduled_sends").select("*").is("cancelled_at", null);
  if (sendId) query = query.eq("id", sendId);
  const listed = await query;
  if (listed.error) return [];
  return (listed.data || [])
    .map((row) => scheduledSendFromRow(row as Record<string, unknown>))
    .filter((row): row is ScheduledSend => Boolean(row));
}

async function loadDelivered(client: SupabaseClient, studentId?: string): Promise<Set<string>> {
  let query = client.from("scheduled_send_deliveries").select("send_id, student_id");
  if (studentId) query = query.eq("student_id", studentId);
  const listed = await query;
  const keys = new Set<string>();
  (listed.data || []).forEach((row) => {
    const sendId = asText((row as { send_id?: string }).send_id);
    const id = asText((row as { student_id?: string }).student_id);
    if (sendId && id) keys.add(`${sendId}:${id}`);
  });
  return keys;
}

async function deliverNotification(client: SupabaseClient, send: ScheduledSend, student: ScheduledRecipient): Promise<boolean> {
  const rows = notificationRowsForStudents({
    students: [{ id: student.id, email: student.email, name: student.name }],
    title: send.title || "Message from your coach",
    message: inboxMessageEmailText(send.body, send.pdfName, send.pdfUrl),
    kind: "announcement",
    audience: send.audience === "all" ? "all" : send.recipients.length > 1 ? send.audience : "student",
  });
  if (!rows.length) return false;
  const inserted = await client.from("notifications").insert(rows).select("id, user_id");
  let recordId = asText((inserted.data?.[0] as { id?: string } | undefined)?.id);
  if (inserted.error) {
    const fallback = await client
      .from("notifications")
      .insert(
        rows.map((row) => ({
          user_id: row.user_id,
          student_id: row.student_id,
          student_email: row.student_email,
          from_role: row.from_role,
          kind: row.kind,
          body: row.body,
          title: row.title,
          message: row.message,
        }))
      )
      .select("id");
    if (fallback.error) {
      console.error("scheduled notification insert failed", fallback.error);
      return false;
    }
    recordId = asText((fallback.data?.[0] as { id?: string } | undefined)?.id);
  }
  if (student.email.includes("@")) {
    await requestClassroomEmails({
      kind: "announcement",
      title: send.title || "Message from your coach",
      message: inboxMessageEmailText(send.body, send.pdfName, send.pdfUrl),
      recipients: [{ email: student.email, name: student.name, userId: student.id, recordId: recordId || null }],
    });
  }
  return true;
}

async function deliverMessage(client: SupabaseClient, send: ScheduledSend, student: ScheduledRecipient): Promise<boolean> {
  const inserted = await client
    .from("inbox_messages")
    .insert({
      student_id: student.id,
      student_email: student.email,
      from_role: "coach",
      kind: send.messageKind,
      body: send.body,
      context:
        send.messageKind === "feedback"
          ? send.title && send.title !== "Message from your coach"
            ? send.title
            : "Assignment feedback"
          : "Coach reply",
      pdf_url: send.pdfUrl || null,
      pdf_name: send.pdfName || null,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error) {
    console.error("scheduled inbox insert failed", inserted.error);
    return false;
  }
  if (student.email.includes("@")) {
    await requestClassroomEmails({
      kind: send.messageKind === "feedback" ? "assignment_feedback" : "message",
      title: send.title || (send.messageKind === "feedback" ? "Assignment feedback" : "Message from your coach"),
      message: inboxMessageEmailText(send.body, send.pdfName, send.pdfUrl),
      recipients: [
        {
          email: student.email,
          name: student.name,
          userId: student.id,
          recordId: asText((inserted.data as { id?: string } | null)?.id) || null,
        },
      ],
    });
  }
  return true;
}

async function deliverOne(client: SupabaseClient, send: ScheduledSend, student: ScheduledRecipient): Promise<boolean> {
  const ok =
    send.channel === "message" ? await deliverMessage(client, send, student) : await deliverNotification(client, send, student);
  if (!ok) return false;
  const logged = await client.from("scheduled_send_deliveries").insert({ send_id: send.id, student_id: student.id });
  if (logged.error && !/duplicate|unique/i.test(logged.error.message)) {
    console.error("scheduled delivery insert failed", logged.error);
  }
  return true;
}

export async function claimDueScheduledSends(input?: {
  studentId?: string;
  sendId?: string;
  now?: Date;
}): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, inserted: 0, error: "Supabase is not configured." };
  const sends = await loadOpenSends(client, input?.sendId);
  if (!sends.length) return { ok: true, inserted: 0 };

  const delivered = await loadDelivered(client, input?.studentId);
  const pending = sends.flatMap((send) =>
    send.recipients
      .filter((student) => !input?.studentId || student.id === input.studentId)
      .filter((student) => !delivered.has(`${send.id}:${student.id}`))
      .map((student) => ({ send, student }))
  );
  if (!pending.length) return { ok: true, inserted: 0 };

  const needsProgress = pending.some((item) => item.send.trigger === "lesson_completed");
  const needsSubmit = pending.some((item) => item.send.trigger === "task_submitted");
  const completedByUser = new Map<string, string[]>();
  const submittedByUser = new Map<string, string[]>();
  const studentIds = [...new Set(pending.map((item) => item.student.id))];

  if (needsProgress) {
    let query = client.from("lesson_progress").select("user_id, lesson_id").eq("completed", true);
    if (input?.studentId) query = query.eq("user_id", input.studentId);
    else query = query.in("user_id", studentIds);
    const progress = await query;
    (progress.data || []).forEach((row) => {
      const userId = asText((row as { user_id?: string }).user_id);
      const lessonId = asText((row as { lesson_id?: string }).lesson_id);
      if (!userId || !lessonId) return;
      completedByUser.set(userId, [...(completedByUser.get(userId) || []), lessonId]);
    });
  }
  if (needsSubmit) {
    let query = client.from("student_submissions").select("student_id, lesson_id");
    if (input?.studentId) query = query.eq("student_id", input.studentId);
    else query = query.in("student_id", studentIds);
    const submissions = await query;
    (submissions.data || []).forEach((row) => {
      const userId = asText((row as { student_id?: string }).student_id);
      const lessonId = asText((row as { lesson_id?: string }).lesson_id);
      if (!userId || !lessonId) return;
      submittedByUser.set(userId, [...(submittedByUser.get(userId) || []), lessonId]);
    });
  }

  const now = input?.now || new Date();
  let inserted = 0;
  for (const item of pending) {
    if (
      !scheduledSendDue(item.send, {
        now,
        completedLessonIds: completedByUser.get(item.student.id) || [],
        submittedLessonIds: submittedByUser.get(item.student.id) || [],
      })
    ) {
      continue;
    }
    if (await deliverOne(client, item.send, item.student)) inserted += 1;
  }
  return { ok: true, inserted };
}
