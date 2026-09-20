import { getSupabase } from "./supabase";
import type { Submission, SubmissionStatus } from "../types/database";

export type { Submission, SubmissionStatus };
export type StudentSubmission = Submission;

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

export async function fetchSubmissionsAwaitingFeedback(): Promise<{
  ok: boolean;
  rows: { studentId: string; lessonId: string }[];
}> {
  const client = getSupabase();
  if (!client) return { ok: false, rows: [] };
  const { data, error } = await client
    .from("student_submissions")
    .select("student_id, lesson_id, status")
    .eq("status", "submitted");
  if (error || !data) return { ok: false, rows: [] };
  return {
    ok: true,
    rows: data.map((row) => ({ studentId: String(row.student_id), lessonId: String(row.lesson_id) })),
  };
}

export async function fetchSubmissionCountsByStudent(): Promise<Record<string, number>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("student_submissions").select("student_id");
  if (error || !data) return {};
  const map: Record<string, number> = {};
  data.forEach((row) => {
    const id = String(row.student_id || "");
    if (!id) return;
    map[id] = (map[id] || 0) + 1;
  });
  return map;
}

export async function fetchAllSubmissionBodies(): Promise<Record<string, Record<string, string>>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("student_submissions").select("student_id, lesson_id, body, link_url");
  if (error || !data) return {};
  const map: Record<string, Record<string, string>> = {};
  data.forEach((row) => {
    const studentId = String(row.student_id || "");
    const lessonId = String(row.lesson_id || "");
    if (!studentId || !lessonId) return;
    const text = String(row.body || "").trim() || String(row.link_url || "").trim();
    if (!text) return;
    map[studentId] = map[studentId] || {};
    map[studentId][lessonId] = text;
  });
  return map;
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

export async function uploadAssignmentFile(
  studentId: string,
  lessonId: string,
  file: File
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "submission.pdf";
  const path = `assignment-submissions/${studentId}/${lessonId}/${Date.now()}-${safeName}`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: "Could not upload that file. Try a PDF." };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that file." };
  return { ok: true, url: data.publicUrl, name: file.name };
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
