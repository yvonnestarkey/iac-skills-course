import { DEFAULT_COHORT_ID, normalizeCohortId } from "./cohorts";
import {
  dripFromRow,
  dripIsDue,
  dripRowFromWrite,
  dripTableMissing,
  validateDripWrite,
  type DripMessage,
  type DripStudentContext,
  type DripWrite,
} from "./drip-messages";
import { notificationRowsForStudents } from "./notifications";
import { profileDisplayName } from "./profiles";
import { isCoachAccount } from "./roles";
import { requestClassroomEmails } from "./student-classroom-email";
import { getServiceSupabase } from "./supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const MISSING_SQL = "Paste supabase/drip-messages.sql in the Supabase SQL editor, then try again.";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

export async function listDripMessages(): Promise<{ ok: boolean; data: DripMessage[]; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, data: [], error: "Supabase is not configured." };

  const listed = await client.from("drip_messages").select("*").order("created_at", { ascending: false });
  if (listed.error) {
    if (dripTableMissing(listed.error.message)) return { ok: false, data: [], error: MISSING_SQL };
    return { ok: false, data: [], error: listed.error.message };
  }

  const counts = await client.from("drip_deliveries").select("drip_id");
  const tally = new Map<string, number>();
  if (!counts.error) {
    (counts.data || []).forEach((row) => {
      const id = asText((row as { drip_id?: string }).drip_id);
      if (!id) return;
      tally.set(id, (tally.get(id) || 0) + 1);
    });
  }

  return {
    ok: true,
    data: (listed.data || [])
      .map((row) => dripFromRow(row as Record<string, unknown>, tally.get(asText((row as { id?: string }).id)) || 0))
      .filter((row): row is DripMessage => Boolean(row)),
  };
}

export async function saveDripMessage(
  input: DripWrite,
  createdBy?: string | null
): Promise<{ ok: boolean; data?: DripMessage; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const checked = validateDripWrite(input);
  if (checked.ok === false) return { ok: false, error: checked.error };

  const row = dripRowFromWrite(checked.write, createdBy);
  const saved = checked.write.id
    ? await client.from("drip_messages").update(row).eq("id", checked.write.id).select("*").maybeSingle()
    : await client.from("drip_messages").insert(row).select("*").maybeSingle();

  if (saved.error) {
    if (dripTableMissing(saved.error.message)) return { ok: false, error: MISSING_SQL };
    return { ok: false, error: saved.error.message };
  }
  const next = dripFromRow((saved.data || row) as Record<string, unknown>);
  return next ? { ok: true, data: next } : { ok: false, error: "Could not save that drip message." };
}

export async function deleteDripMessage(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const removed = await client.from("drip_messages").delete().eq("id", id);
  if (removed.error) {
    if (dripTableMissing(removed.error.message)) return { ok: false, error: MISSING_SQL };
    return { ok: false, error: removed.error.message };
  }
  return { ok: true };
}

export async function setDripMessageActive(id: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const updated = await client
    .from("drip_messages")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updated.error) {
    if (dripTableMissing(updated.error.message)) return { ok: false, error: MISSING_SQL };
    return { ok: false, error: updated.error.message };
  }
  return { ok: true };
}

async function loadActiveDrips(client: SupabaseClient): Promise<{ ok: boolean; data: DripMessage[]; error?: string }> {
  const listed = await client.from("drip_messages").select("*").eq("is_active", true);
  if (listed.error) {
    if (dripTableMissing(listed.error.message)) return { ok: true, data: [] };
    return { ok: false, data: [], error: listed.error.message };
  }
  return {
    ok: true,
    data: (listed.data || [])
      .map((row) => dripFromRow(row as Record<string, unknown>))
      .filter((row): row is DripMessage => Boolean(row)),
  };
}

async function loadDeliveredIds(client: SupabaseClient, userId?: string): Promise<Set<string>> {
  let query = client.from("drip_deliveries").select("drip_id, user_id");
  if (userId) query = query.eq("user_id", userId);
  const listed = await query;
  const keys = new Set<string>();
  if (listed.error) return keys;
  (listed.data || []).forEach((row) => {
    const dripId = asText((row as { drip_id?: string }).drip_id);
    const studentId = asText((row as { user_id?: string }).user_id);
    if (dripId && studentId) keys.add(`${dripId}:${studentId}`);
  });
  return keys;
}

async function loadTaskLessonMap(client: SupabaseClient, taskIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (!ids.length) return map;
  const listed = await client.from("lessons").select("id, chapter_id").in("chapter_id", ids);
  if (listed.error) return map;
  (listed.data || []).forEach((row) => {
    const chapterId = asText((row as { chapter_id?: string }).chapter_id);
    const lessonId = asText((row as { id?: string }).id);
    if (!chapterId || !lessonId) return;
    const current = map.get(chapterId) || [];
    current.push(lessonId);
    map.set(chapterId, current);
  });
  return map;
}

async function deliverOne(
  client: SupabaseClient,
  drip: DripMessage,
  student: DripStudentContext
): Promise<boolean> {
  const rows = notificationRowsForStudents({
    students: [
      {
        id: student.userId,
        email: student.email,
        cohort: student.cohort,
        name: student.name || undefined,
      },
    ],
    title: drip.title,
    message: drip.body,
    kind: "announcement",
    audience: "student",
  });
  if (!rows.length) return false;

  const inserted = await client.from("notifications").insert(rows).select("id, user_id");
  let notificationId = asText((inserted.data?.[0] as { id?: string } | undefined)?.id);
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
          read: false,
          audience: "student",
          cohort: row.cohort,
        }))
      )
      .select("id, user_id");
    if (fallback.error) {
      console.error("drip notification insert failed", fallback.error);
      return false;
    }
    notificationId = asText((fallback.data?.[0] as { id?: string } | undefined)?.id);
  }

  const logged = await client.from("drip_deliveries").insert({
    drip_id: drip.id,
    user_id: student.userId,
    notification_id: notificationId || null,
  });
  if (logged.error && !/duplicate|unique/i.test(logged.error.message)) {
    console.error("drip delivery insert failed", logged.error);
  }

  if (student.email.includes("@")) {
    await requestClassroomEmails({
      kind: "announcement",
      title: drip.title,
      message: drip.body,
      recipients: [
        {
          email: student.email,
          name: student.name,
          userId: student.userId,
          recordId: notificationId || null,
        },
      ],
    });
  }
  return true;
}

export async function claimDueDripMessagesForStudent(input: {
  studentId: string;
  email?: string | null;
  now?: Date;
}): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, inserted: 0, error: "Supabase is not configured." };

  const drips = await loadActiveDrips(client);
  if (!drips.ok) return { ok: false, inserted: 0, error: drips.error };
  if (!drips.data.length) return { ok: true, inserted: 0 };

  const profile = await client
    .from("profiles")
    .select("id, email, full_name, cohort, created_at, role")
    .eq("id", input.studentId)
    .maybeSingle();
  if (profile.error) return { ok: false, inserted: 0, error: profile.error.message };
  if (!profile.data) return { ok: true, inserted: 0 };

  const email = asText(input.email || profile.data.email);
  if (
    isCoachAccount({
      id: input.studentId,
      email,
      role: asText(profile.data.role),
    })
  ) {
    return { ok: true, inserted: 0 };
  }

  const delivered = await loadDeliveredIds(client, input.studentId);
  const pending = drips.data.filter((drip) => !delivered.has(`${drip.id}:${input.studentId}`));
  if (!pending.length) return { ok: true, inserted: 0 };

  const needsProgress = pending.some((drip) => drip.trigger === "lesson_completed" || drip.trigger === "task_completed");
  const completedLessonIds: string[] = [];
  if (needsProgress) {
    const progress = await client
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", input.studentId)
      .eq("completed", true);
    (progress.data || []).forEach((row) => {
      const lessonId = asText((row as { lesson_id?: string }).lesson_id);
      if (lessonId) completedLessonIds.push(lessonId);
    });
  }

  const taskMap = await loadTaskLessonMap(
    client,
    pending.filter((drip) => drip.trigger === "task_completed").map((drip) => drip.taskId || "")
  );

  const studentBase = {
    userId: input.studentId,
    email,
    name: profileDisplayName(email, asText(profile.data.full_name)),
    cohort: normalizeCohortId(asText(profile.data.cohort) || DEFAULT_COHORT_ID),
    enrolledAt: asText(profile.data.created_at),
    completedLessonIds,
  };

  let inserted = 0;
  const now = input.now || new Date();
  for (const drip of pending) {
    const student: DripStudentContext = {
      ...studentBase,
      taskLessonIds: drip.taskId ? taskMap.get(drip.taskId) || [] : [],
    };
    if (!dripIsDue(drip, student, now)) continue;
    if (await deliverOne(client, drip, student)) inserted += 1;
  }
  return { ok: true, inserted };
}

export async function claimDueDripMessagesForAllStudents(now = new Date()): Promise<{
  ok: boolean;
  inserted: number;
  error?: string;
}> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, inserted: 0, error: "Supabase is not configured." };

  const drips = await loadActiveDrips(client);
  if (!drips.ok) return { ok: false, inserted: 0, error: drips.error };
  if (!drips.data.length) return { ok: true, inserted: 0 };

  const profiles = await client.from("profiles").select("id, email, full_name, cohort, created_at, role").eq("role", "student");
  if (profiles.error) return { ok: false, inserted: 0, error: profiles.error.message };

  const students = (profiles.data || []).filter((row) => {
    const email = asText(row.email);
    return !isCoachAccount({ id: asText(row.id), email, role: asText(row.role) });
  });
  if (!students.length) return { ok: true, inserted: 0 };

  const delivered = await loadDeliveredIds(client);
  const needsProgress = drips.data.some((drip) => drip.trigger === "lesson_completed" || drip.trigger === "task_completed");
  const completedByUser = new Map<string, string[]>();
  if (needsProgress) {
    const progress = await client.from("lesson_progress").select("user_id, lesson_id").eq("completed", true);
    (progress.data || []).forEach((row) => {
      const userId = asText((row as { user_id?: string }).user_id);
      const lessonId = asText((row as { lesson_id?: string }).lesson_id);
      if (!userId || !lessonId) return;
      const current = completedByUser.get(userId) || [];
      current.push(lessonId);
      completedByUser.set(userId, current);
    });
  }
  const taskMap = await loadTaskLessonMap(
    client,
    drips.data.filter((drip) => drip.trigger === "task_completed").map((drip) => drip.taskId || "")
  );

  let inserted = 0;
  for (const row of students) {
    const userId = asText(row.id);
    const email = asText(row.email);
    if (!userId) continue;
    const completedLessonIds = completedByUser.get(userId) || [];
    for (const drip of drips.data) {
      if (delivered.has(`${drip.id}:${userId}`)) continue;
      const student: DripStudentContext = {
        userId,
        email,
        name: profileDisplayName(email, asText(row.full_name)),
        cohort: normalizeCohortId(asText(row.cohort) || DEFAULT_COHORT_ID),
        enrolledAt: asText(row.created_at),
        completedLessonIds,
        taskLessonIds: drip.taskId ? taskMap.get(drip.taskId) || [] : [],
      };
      if (!dripIsDue(drip, student, now)) continue;
      if (await deliverOne(client, drip, student)) {
        delivered.add(`${drip.id}:${userId}`);
        inserted += 1;
      }
    }
  }
  return { ok: true, inserted };
}
