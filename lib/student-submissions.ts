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

function isPdfFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function storageUploadError(message: string): string {
  if (/row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return "Could not store that PDF. Paste supabase/assignment-upload-storage.sql in the Supabase SQL editor, then try again.";
  }
  return message || "Could not upload that file.";
}

export function fileNameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return last.replace(/^\d+-/, "") || "Uploaded PDF";
  } catch {
    return "Uploaded PDF";
  }
}

export async function uploadAssignmentFile(
  studentId: string,
  lessonId: string,
  file: File
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  if (!file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: "That PDF is larger than 50 MB. Compress it or split it, then try again." };
  if (!isPdfFile(file)) return { ok: false, error: "Please upload a PDF file." };
  const ownerId = session.user.id || studentId;
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "submission.pdf";
  const stamp = Date.now();
  const paths = [
    `assignment-submissions/${ownerId}/${lessonId}/${stamp}-${safeName}`,
    `survey-responses/assignment-submissions/${ownerId}/${lessonId}/${stamp}-${safeName}`,
  ];
  let lastError = "";
  for (const path of paths) {
    const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
      upsert: false,
      contentType: "application/pdf",
    });
    if (!uploaded.error) {
      const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
      if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that file." };
      return { ok: true, url: data.publicUrl, name: file.name };
    }
    lastError = uploaded.error.message || lastError;
  }
  return { ok: false, error: storageUploadError(lastError) };
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
