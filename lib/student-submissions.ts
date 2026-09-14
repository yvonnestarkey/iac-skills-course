import { getSupabase } from "./supabase";

export type SubmissionStatus = "submitted" | "approved" | "rejected";

export interface StudentSubmission {
  id?: string;
  student_id: string;
  lesson_id: string;
  body: string;
  link_url: string;
  status: SubmissionStatus;
  updated_at?: string;
}

function asStatus(value: unknown): SubmissionStatus {
  if (value === "approved" || value === "rejected" || value === "submitted") return value;
  return "submitted";
}

export function submissionFromRow(row: {
  id?: string;
  student_id: string;
  lesson_id: string;
  body?: string | null;
  link_url?: string | null;
  status?: string | null;
  updated_at?: string | null;
}): StudentSubmission {
  return {
    id: row.id,
    student_id: row.student_id,
    lesson_id: row.lesson_id,
    body: row.body || "",
    link_url: row.link_url || "",
    status: asStatus(row.status),
    updated_at: row.updated_at || undefined,
  };
}

export async function fetchStudentSubmissions(studentId: string): Promise<Record<string, StudentSubmission>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("student_submissions").select("*").eq("student_id", studentId);
  if (error || !data) return {};
  const map: Record<string, StudentSubmission> = {};
  data.forEach((row) => {
    const item = submissionFromRow(row);
    map[item.lesson_id] = item;
  });
  return map;
}

export async function fetchLessonSubmission(
  studentId: string,
  lessonId: string
): Promise<StudentSubmission | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from("student_submissions")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return submissionFromRow(data);
}

export async function saveStudentSubmission(input: {
  studentId: string;
  lessonId: string;
  body: string;
  linkUrl: string;
}): Promise<{ ok: boolean; error?: string; submission?: StudentSubmission }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const row = {
    student_id: input.studentId,
    lesson_id: input.lessonId,
    body: input.body.trim(),
    link_url: input.linkUrl.trim(),
    status: "submitted" as const,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("student_submissions").upsert(row, { onConflict: "student_id,lesson_id" }).select("*").maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    submission: data ? submissionFromRow(data) : { ...row, student_id: input.studentId, lesson_id: input.lessonId, link_url: row.link_url },
  };
}
