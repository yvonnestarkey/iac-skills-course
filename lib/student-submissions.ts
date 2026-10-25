import type { SurveyResponseStatus, SurveySubmissionRow } from "./custom-surveys";
import { getSupabase } from "./supabase";
import type { Submission, SubmissionStatus } from "../types/database";

export type { Submission, SubmissionStatus };
export type StudentSubmission = Submission;

function asStatus(value: unknown): SubmissionStatus {
  if (value === "approved" || value === "rejected" || value === "submitted") return value;
  return "submitted";
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isMissingColumn(message: string, column: string): boolean {
  return new RegExp(`'${column}' column`, "i").test(message);
}

/** Live table stores work in `content`; the repo schema uses `body` + `link_url`. */
export function unpackSubmissionContent(row: {
  body?: string | null;
  link_url?: string | null;
  content?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
}): { body: string; link_url: string; updated_at?: string } {
  const body = String(row.body || "").trim();
  const linkUrl = String(row.link_url || "").trim();
  const stamp = row.updated_at || row.submitted_at || undefined;
  if (body || linkUrl) return { body, link_url: linkUrl, updated_at: stamp };

  const content = String(row.content || "").trim();
  if (!content) return { body: "", link_url: "", updated_at: stamp };
  if (content.startsWith("{")) {
    try {
      const parsed = JSON.parse(content) as { body?: unknown; link_url?: unknown; url?: unknown };
      if (parsed && typeof parsed === "object") {
        const parsedBody = String(parsed.body || "").trim();
        const parsedLink = String(parsed.link_url || parsed.url || "").trim();
        if (parsedBody || parsedLink) return { body: parsedBody, link_url: parsedLink, updated_at: stamp };
      }
    } catch {
      /* treat as plain text */
    }
  }
  if (looksLikeUrl(content)) return { body: "", link_url: content, updated_at: stamp };
  return { body: content, link_url: "", updated_at: stamp };
}

export function packSubmissionContent(body: string, linkUrl: string): string {
  const trimmedBody = body.trim();
  const trimmedLink = linkUrl.trim();
  if (trimmedLink && !trimmedBody) return trimmedLink;
  if (trimmedBody && !trimmedLink) return trimmedBody;
  if (!trimmedBody && !trimmedLink) return "";
  return JSON.stringify({ body: trimmedBody, link_url: trimmedLink });
}

export function submissionFromRow(row: {
  id?: string;
  student_id: string;
  lesson_id: string;
  body?: string | null;
  link_url?: string | null;
  content?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
}): StudentSubmission {
  const unpacked = unpackSubmissionContent(row);
  return {
    id: row.id,
    student_id: row.student_id,
    lesson_id: row.lesson_id,
    body: unpacked.body,
    link_url: unpacked.link_url,
    status: asStatus(row.status),
    updated_at: unpacked.updated_at,
  };
}

export function lessonStatusToQueue(status: SubmissionStatus): SurveyResponseStatus {
  if (status === "approved") return "graded";
  if (status === "rejected") return "rejected";
  return "submitted";
}

export function shouldNotifyCoachOfLessonSubmission(email?: string | null): boolean {
  return !String(email || "").toLowerCase().includes("@test");
}

export function assignmentSubmittedNotifySubject(studentName: string, lessonTitle: string): string {
  const name = studentName.trim() || "Student";
  const lesson = lessonTitle.trim() || "Assignment";
  return `New assignment submission — ${name} · ${lesson}`;
}

export function assignmentSubmittedNotifyKey(studentId: string, lessonId: string): string {
  return `assignment-submitted-${studentId}-${lessonId}`;
}

export async function fetchLessonSubmissionsForCoach(): Promise<{
  ok: boolean;
  data: SurveySubmissionRow[];
}> {
  const client = getSupabase();
  if (!client) return { ok: false, data: [] };
  const { data, error } = await client.from("student_submissions").select("*");
  if (error || !data) return { ok: false, data: [] };
  const rows = data as Array<Record<string, unknown>>;
  const studentIds = [...new Set(rows.map((row) => String(row.student_id || "")).filter(Boolean))];
  const lessonIds = [...new Set(rows.map((row) => String(row.lesson_id || "")).filter(Boolean))];
  const [profiles, lessons] = await Promise.all([
    studentIds.length
      ? client.from("profiles").select("id, full_name, email").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string; full_name?: string | null; email?: string | null }[] }),
    lessonIds.length
      ? client.from("lessons").select("id, title").in("id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; title?: string | null }[] }),
  ]);
  const names = new Map<string, { name: string; email: string }>();
  (profiles.data || []).forEach((profile) => {
    names.set(String(profile.id), {
      name: String(profile.full_name || "").trim() || String(profile.email || "Student"),
      email: String(profile.email || ""),
    });
  });
  const titles = new Map<string, string>();
  (lessons.data || []).forEach((lesson) => {
    titles.set(String(lesson.id), String(lesson.title || lesson.id));
  });
  return {
    ok: true,
    data: rows
      .map((row) => {
        const item = submissionFromRow({
          id: row.id != null ? String(row.id) : undefined,
          student_id: String(row.student_id || ""),
          lesson_id: String(row.lesson_id || ""),
          body: row.body != null ? String(row.body) : null,
          link_url: row.link_url != null ? String(row.link_url) : null,
          content: row.content != null ? String(row.content) : null,
          status: row.status != null ? String(row.status) : null,
          submitted_at: row.submitted_at != null ? String(row.submitted_at) : null,
          updated_at: row.updated_at != null ? String(row.updated_at) : null,
        });
        const student = names.get(item.student_id) || { name: "Student", email: "" };
        const when = item.updated_at || String(row.submitted_at || row.created_at || "");
        const reviewed = item.status === "approved" || item.status === "rejected";
        const rowOut: SurveySubmissionRow = {
          id: `lesson:${item.id || `${item.student_id}:${item.lesson_id}`}`,
          surveyId: item.lesson_id,
          studentId: item.student_id,
          studentName: student.name,
          studentEmail: student.email,
          answers: {},
          status: lessonStatusToQueue(item.status),
          grade: null,
          feedback: "",
          feedbackFileUrl: "",
          gradedBy: "",
          gradedByName: "",
          gradedAt: reviewed ? when : "",
          createdAt: String(row.submitted_at || when),
          updatedAt: when,
          surveyTitle: titles.get(item.lesson_id) || item.lesson_id,
          isAssignment: true,
          requiresGrade: false,
          href: `/coach/students/${item.student_id}`,
        };
        return rowOut;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
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
  const { data, error } = await client.from("student_submissions").select("*");
  if (error || !data) return {};
  const map: Record<string, Record<string, string>> = {};
  data.forEach((row) => {
    const item = submissionFromRow(row);
    const text = item.body.trim() || item.link_url.trim();
    if (!text) return;
    map[item.student_id] = map[item.student_id] || {};
    map[item.student_id][item.lesson_id] = text;
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
    .limit(1);
  const row = data?.[0];
  if (error || !row) return null;
  return submissionFromRow(row);
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

async function writeStudentSubmissionRow(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  row: Record<string, unknown>
) {
  const existing = await client
    .from("student_submissions")
    .select("id")
    .eq("student_id", row.student_id as string)
    .eq("lesson_id", row.lesson_id as string)
    .limit(1);
  if (existing.error) return existing;
  const id = existing.data?.[0]?.id;
  if (id) {
    return client.from("student_submissions").update(row).eq("id", id).select("*").limit(1).maybeSingle();
  }
  return client.from("student_submissions").insert(row).select("*").limit(1).maybeSingle();
}

export async function saveStudentSubmission(input: {
  studentId: string;
  lessonId: string;
  body: string;
  linkUrl: string;
}): Promise<{ ok: boolean; error?: string; submission?: StudentSubmission }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const body = input.body.trim();
  const linkUrl = input.linkUrl.trim();
  const liveRow = {
    student_id: input.studentId,
    lesson_id: input.lessonId,
    content: packSubmissionContent(body, linkUrl),
    status: "submitted" as const,
  };
  let { data, error } = await writeStudentSubmissionRow(client, liveRow);
  if (error && isMissingColumn(error.message, "content")) {
    ({ data, error } = await writeStudentSubmissionRow(client, {
      student_id: input.studentId,
      lesson_id: input.lessonId,
      body,
      link_url: linkUrl,
      status: "submitted" as const,
      updated_at: new Date().toISOString(),
    }));
  }
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    submission: data
      ? submissionFromRow(data)
      : {
          student_id: input.studentId,
          lesson_id: input.lessonId,
          body,
          link_url: linkUrl,
          status: "submitted",
        },
  };
}
