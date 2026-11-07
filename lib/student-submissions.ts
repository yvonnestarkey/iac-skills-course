import type { SurveyResponseStatus, SurveySubmissionRow } from "./custom-surveys";
import { surveyResponseStatusLabel } from "./custom-surveys";
import { nextFeedbackLog } from "./feedback-log";
import { notifyAssignmentFeedback } from "./notifications";
import { getSupabase } from "./supabase";
import type { Submission, SubmissionFile, SubmissionStatus } from "../types/database";

export type { Submission, SubmissionFile, SubmissionStatus };
export type StudentSubmission = Submission;

export const LESSON_QUEUE_PREFIX = "lesson:";

export const STUDENT_SUBMISSION_REVIEW_SQL =
  "Paste supabase/student-submission-review.sql in the Supabase SQL editor, then try again.";

export type LessonSubmissionReview = StudentSubmission & {
  feedback: string;
  feedbackFileUrl: string;
  gradedAt: string;
  lessonTitle: string;
  studentName: string;
  studentEmail: string;
  submittedAt: string;
};

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

export function fileNameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return last.replace(/^\d+-/, "") || "Uploaded PDF";
  } catch {
    return "Uploaded PDF";
  }
}

function asSubmissionFile(url: string, name = ""): SubmissionFile | null {
  const trimmed = String(url || "").trim();
  if (!trimmed || !looksLikeUrl(trimmed)) return null;
  return { url: trimmed, name: String(name || "").trim() || fileNameFromUrl(trimmed) };
}

export function mergeSubmissionFiles(existing: SubmissionFile[], next: SubmissionFile | SubmissionFile[]): SubmissionFile[] {
  const extras = Array.isArray(next) ? next : [next];
  const out = [...existing];
  const seen = new Set(out.map((file) => file.url));
  for (const extra of extras) {
    const file = asSubmissionFile(extra?.url || "", extra?.name || "");
    if (!file || seen.has(file.url)) continue;
    seen.add(file.url);
    out.push(file);
  }
  return out;
}

export function submissionFiles(item: { files?: SubmissionFile[] | null; link_url?: string | null } | null | undefined): SubmissionFile[] {
  if (!item) return [];
  if (item.files?.length) return item.files;
  const one = asSubmissionFile(String(item.link_url || ""));
  return one ? [one] : [];
}

function filesFromUnknown(value: unknown, fallbackUrl = ""): SubmissionFile[] {
  const parsed: SubmissionFile[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const file = asSubmissionFile(item);
        if (file) parsed.push(file);
        continue;
      }
      if (item && typeof item === "object") {
        const rec = item as { url?: unknown; name?: unknown; link_url?: unknown };
        const file = asSubmissionFile(String(rec.url || rec.link_url || ""), String(rec.name || ""));
        if (file) parsed.push(file);
      }
    }
  }
  const fallback = asSubmissionFile(fallbackUrl);
  return fallback ? mergeSubmissionFiles(parsed, fallback) : mergeSubmissionFiles(parsed, []);
}

/** Live table stores work in `content`; the repo schema uses `body` + `link_url`. Extra PDFs live in `files`. */
export function unpackSubmissionContent(row: {
  body?: string | null;
  link_url?: string | null;
  content?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
}): { body: string; link_url: string; files: SubmissionFile[]; updated_at?: string } {
  const columnBody = String(row.body || "").trim();
  const columnLink = String(row.link_url || "").trim();
  const stamp = row.updated_at || row.submitted_at || undefined;
  const content = String(row.content || "").trim();

  let parsedBody = "";
  let parsedLink = "";
  let parsedFiles: SubmissionFile[] = [];
  if (content.startsWith("{")) {
    try {
      const parsed = JSON.parse(content) as { body?: unknown; link_url?: unknown; url?: unknown; files?: unknown };
      if (parsed && typeof parsed === "object") {
        parsedBody = String(parsed.body || "").trim();
        parsedLink = String(parsed.link_url || parsed.url || "").trim();
        parsedFiles = filesFromUnknown(parsed.files, parsedLink);
      }
    } catch {
      /* treat as plain text */
    }
  }

  const body = columnBody || parsedBody;
  let files = parsedFiles;
  if (!files.length) {
    const fromPlainContent = content && !content.startsWith("{") && looksLikeUrl(content) ? asSubmissionFile(content) : null;
    const one = fromPlainContent || asSubmissionFile(columnLink) || asSubmissionFile(parsedLink);
    files = one ? [one] : [];
  }
  const primary = files[0]?.url || columnLink || parsedLink;
  if (body || primary) return { body, link_url: primary, files, updated_at: stamp };
  if (!content) return { body: "", link_url: "", files: [], updated_at: stamp };
  if (looksLikeUrl(content)) {
    const file = asSubmissionFile(content);
    return { body: "", link_url: file?.url || content, files: file ? [file] : [], updated_at: stamp };
  }
  return { body: content, link_url: "", files: [], updated_at: stamp };
}

export function packSubmissionContent(body: string, linkUrl: string, files?: SubmissionFile[]): string {
  const trimmedBody = body.trim();
  const packed = mergeSubmissionFiles(
    [],
    files?.length ? files : linkUrl.trim() ? [{ url: linkUrl.trim(), name: fileNameFromUrl(linkUrl.trim()) }] : []
  );
  const primary = packed[0]?.url || linkUrl.trim();
  if (packed.length > 1) {
    return JSON.stringify({
      ...(trimmedBody ? { body: trimmedBody } : {}),
      link_url: primary,
      files: packed,
    });
  }
  if (primary && !trimmedBody) return primary;
  if (trimmedBody && !primary) return trimmedBody;
  if (!trimmedBody && !primary) return "";
  return JSON.stringify({ body: trimmedBody, link_url: primary, ...(packed.length ? { files: packed } : {}) });
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
  feedback?: string | null;
  feedback_file_url?: string | null;
  graded_at?: string | null;
}): StudentSubmission {
  const unpacked = unpackSubmissionContent(row);
  return {
    id: row.id,
    student_id: row.student_id,
    lesson_id: row.lesson_id,
    body: unpacked.body,
    link_url: unpacked.link_url,
    files: unpacked.files,
    status: asStatus(row.status),
    updated_at: unpacked.updated_at,
    submitted_at: String(row.submitted_at || "").trim() || undefined,
    feedback: String(row.feedback || ""),
    feedbackFileUrl: String(row.feedback_file_url || ""),
    gradedAt: String(row.graded_at || ""),
  };
}

export function normalizeQueueId(id: string): string {
  try {
    return decodeURIComponent(String(id || "").trim());
  } catch {
    return String(id || "").trim();
  }
}

export function isLessonQueueId(id: string): boolean {
  const raw = normalizeQueueId(id);
  return raw.startsWith(LESSON_QUEUE_PREFIX) || raw.startsWith("lesson/");
}

export function lessonIdFromQueue(id: string): string {
  return normalizeQueueId(id).replace(/^lesson[/:]/, "");
}

export function lessonQueuePath(id: string): string {
  return `/coach/submissions/lesson/${lessonIdFromQueue(id)}`;
}

export function lessonStatusToQueue(status: SubmissionStatus): SurveyResponseStatus {
  if (status === "approved") return "graded";
  if (status === "rejected") return "rejected";
  return "submitted";
}

export function queueStatusToLesson(status: SurveyResponseStatus): SubmissionStatus {
  return status === "graded" ? "approved" : "rejected";
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
          feedback: row.feedback != null ? String(row.feedback) : null,
          feedback_file_url: row.feedback_file_url != null ? String(row.feedback_file_url) : null,
          graded_at: row.graded_at != null ? String(row.graded_at) : null,
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
          feedback: item.feedback || "",
          feedbackFileUrl: item.feedbackFileUrl || "",
          gradedBy: "",
          gradedByName: "",
          gradedAt: reviewed ? when : "",
          createdAt: String(row.submitted_at || when),
          updatedAt: when,
          surveyTitle: titles.get(item.lesson_id) || item.lesson_id,
          isAssignment: true,
          requiresGrade: false,
          href: lessonQueuePath(item.id || `${item.student_id}:${item.lesson_id}`),
        };
        return rowOut;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  };
}

export async function fetchLessonSubmissionReview(
  queueId: string
): Promise<{ ok: boolean; error?: string; review?: LessonSubmissionReview }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const rawId = lessonIdFromQueue(queueId);
  let { data, error } = await client.from("student_submissions").select("*").eq("id", rawId).maybeSingle();
  if ((error || !data) && rawId.includes(":")) {
    const [studentId, lessonId] = rawId.split(":");
    const fallback = await client
      .from("student_submissions")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "This submission could not be found." };
  const row = data as Record<string, unknown>;
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
    feedback: row.feedback != null ? String(row.feedback) : null,
    feedback_file_url: row.feedback_file_url != null ? String(row.feedback_file_url) : null,
    graded_at: row.graded_at != null ? String(row.graded_at) : null,
  });
  const [profile, lesson] = await Promise.all([
    client.from("profiles").select("full_name, email").eq("id", item.student_id).maybeSingle(),
    client.from("lessons").select("title").eq("id", item.lesson_id).maybeSingle(),
  ]);
  return {
    ok: true,
    review: {
      ...item,
      feedback: item.feedback || "",
      feedbackFileUrl: item.feedbackFileUrl || "",
      gradedAt: item.gradedAt || "",
      lessonTitle: String(lesson.data?.title || item.lesson_id),
      studentName: String(profile.data?.full_name || "").trim() || String(profile.data?.email || "Student"),
      studentEmail: String(profile.data?.email || ""),
      submittedAt: String(row.submitted_at || item.updated_at || ""),
    },
  };
}

export async function saveLessonSubmissionReview(input: {
  id: string;
  status: SurveyResponseStatus;
  feedback: string;
  feedbackFileUrl: string;
}): Promise<{ ok: boolean; error?: string; review?: LessonSubmissionReview }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  if (input.status === "submitted") return { ok: false, error: "Choose Graded, Rejected, or Resubmit." };
  const rawId = lessonIdFromQueue(input.id);
  const current = await fetchLessonSubmissionReview(input.id);
  const now = new Date().toISOString();
  const previousStatus = current.review?.status;
  const nextStatus = queueStatusToLesson(input.status);
  const storedFeedback = nextFeedbackLog(current.review?.feedback, {
    note: input.feedback,
    at: now,
    statusChanged: Boolean(previousStatus && previousStatus !== nextStatus),
    statusLabel: surveyResponseStatusLabel(input.status),
  });
  const payload: Record<string, unknown> = {
    status: nextStatus,
    feedback: storedFeedback,
    feedback_file_url: input.feedbackFileUrl.trim(),
    graded_by: session.user.id,
    graded_at: now,
    updated_at: now,
  };
  const optional = ["updated_at", "feedback", "feedback_file_url", "graded_by", "graded_at"];
  let { data, error } = await client.from("student_submissions").update(payload).eq("id", rawId).select("*").maybeSingle();
  for (let attempt = 0; attempt < optional.length && error; attempt += 1) {
    const missing = optional.find((column) => column in payload && (error?.message || "").includes(column));
    if (!missing) break;
    delete payload[missing];
    ({ data, error } = await client.from("student_submissions").update(payload).eq("id", rawId).select("*").maybeSingle());
  }
  const droppedReviewColumns = !("feedback" in payload);
  if (error || !data) return { ok: false, error: error?.message || STUDENT_SUBMISSION_REVIEW_SQL };
  const loaded = await fetchLessonSubmissionReview(String((data as { id?: string }).id || rawId));
  if (loaded.review?.student_id) {
    const notified = await notifyAssignmentFeedback({
      studentId: loaded.review.student_id,
      studentEmail: loaded.review.studentEmail,
      title: `${input.status === "graded" ? "Graded" : "Returned"}: ${loaded.review.lessonTitle}`,
      message: [
        `Your coach reviewed “${loaded.review.lessonTitle}”.`,
        input.feedback.trim(),
        input.feedbackFileUrl ? `[Open coach file](${input.feedbackFileUrl})` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    if (!notified.ok) {
      return {
        ok: true,
        review: loaded.review,
        error: `Review saved, but the student was not notified${notified.error ? `: ${notified.error}` : "."}`,
      };
    }
  }
  return {
    ok: true,
    review: loaded.review,
    error: droppedReviewColumns ? STUDENT_SUBMISSION_REVIEW_SQL : undefined,
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
  files?: SubmissionFile[];
  status?: SubmissionStatus;
}): Promise<{ ok: boolean; error?: string; submission?: StudentSubmission }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const body = input.body.trim();
  const files = mergeSubmissionFiles(
    [],
    input.files?.length
      ? input.files
      : input.linkUrl.trim()
        ? [{ url: input.linkUrl.trim(), name: fileNameFromUrl(input.linkUrl.trim()) }]
        : []
  );
  const linkUrl = files[0]?.url || input.linkUrl.trim();
  const status = input.status || "submitted";
  const liveRow = {
    student_id: input.studentId,
    lesson_id: input.lessonId,
    content: packSubmissionContent(body, linkUrl, files),
    status,
  };
  let { data, error } = await writeStudentSubmissionRow(client, liveRow);
  if (error && isMissingColumn(error.message, "content")) {
    ({ data, error } = await writeStudentSubmissionRow(client, {
      student_id: input.studentId,
      lesson_id: input.lessonId,
      body,
      link_url: linkUrl,
      status,
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
          files,
          status,
        },
  };
}
