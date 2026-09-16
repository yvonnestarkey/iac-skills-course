import {
  BMCR_CHALLENGES,
  bmcrAssignmentId,
  formatBmcrAnswer,
  hasBmcrData,
  hasBmcrDiagnostics,
  isBmcrAnswer,
  parseBmcrAnswer,
  saveBmcrEvaluation,
} from "./bmcr";
import { downloadRosterCsv } from "./roster";
import { safeHref } from "./rich-text";
import { getSupabase } from "./supabase";

export { safeHref } from "./rich-text";

export type SurveyQuestionType =
  | "dropdown"
  | "radio"
  | "short_text"
  | "long_text"
  | "rating"
  | "info_link"
  | "multi_select"
  | "bmcr_calculator"
  | "pdf_upload";

export const SURVEY_QUESTION_TYPES: { id: SurveyQuestionType; label: string }[] = [
  { id: "dropdown", label: "Single Select Dropdown" },
  { id: "radio", label: "Multiple Choice Radio" },
  { id: "multi_select", label: "Multi-select tags" },
  { id: "short_text", label: "Short Text" },
  { id: "long_text", label: "Long Text / Paragraph" },
  { id: "rating", label: "Rating Scale (1-5)" },
  { id: "info_link", label: "Info / Course Link" },
  { id: "bmcr_calculator", label: "BMCR Calculator" },
  { id: "pdf_upload", label: "PDF Upload" },
];

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  helperText: string;
  required: boolean;
  options: string[];
  resourceUrl: string;
}

export interface CustomSurvey {
  id: string;
  title: string;
  description: string;
  slug: string;
  isActive: boolean;
  isAssignment: boolean;
  requiresGrade: boolean;
  pdfUrl: string;
  questions: SurveyQuestion[];
  createdAt: string;
  updatedAt: string;
}

export type SurveyResponseStatus = "submitted" | "graded" | "rejected" | "resubmit";

export const SURVEY_RESPONSE_STATUSES: { id: SurveyResponseStatus; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "graded", label: "Graded" },
  { id: "rejected", label: "Rejected" },
  { id: "resubmit", label: "Resubmit" },
];

export interface CustomSurveyResponse {
  id: string;
  surveyId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  answers: Record<string, string>;
  status: SurveyResponseStatus;
  grade: number | null;
  feedback: string;
  feedbackFileUrl: string;
  gradedBy: string;
  gradedByName: string;
  gradedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveySubmissionRow extends CustomSurveyResponse {
  surveyTitle: string;
  isAssignment: boolean;
  requiresGrade: boolean;
}

export interface SurveyDraft {
  title: string;
  description: string;
  slug: string;
  isActive: boolean;
  isAssignment: boolean;
  requiresGrade: boolean;
  pdfUrl: string;
  questions: SurveyQuestion[];
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

export function questionNeedsOptions(type: SurveyQuestionType): boolean {
  return type === "dropdown" || type === "radio" || type === "multi_select";
}

export function isInfoBlock(type: SurveyQuestionType): boolean {
  return type === "info_link";
}

export function isBmcrBlock(type: SurveyQuestionType): boolean {
  return type === "bmcr_calculator";
}

export function isPdfUploadBlock(type: SurveyQuestionType): boolean {
  return type === "pdf_upload";
}

export type SurveyPdfUploadAnswer = { url: string; name: string };

function filenameFromPdfUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (last) return last;
  } catch {
    /* ignore */
  }
  return "Uploaded PDF";
}

export function parsePdfUploadAnswer(value: string | undefined): SurveyPdfUploadAnswer | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return { url: raw, name: filenameFromPdfUrl(raw) };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const url = String(parsed.url || "").trim();
    if (!url) return null;
    return { url, name: String(parsed.name || "").trim() || filenameFromPdfUrl(url) };
  } catch {
    return null;
  }
}

export function stringifyPdfUploadAnswer(file: SurveyPdfUploadAnswer): string {
  return JSON.stringify({ url: file.url, name: file.name });
}

export function questionCollectsAnswer(type: SurveyQuestionType): boolean {
  return !isInfoBlock(type);
}

export function slugifySurveyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "survey";
}

export function newSurveyQuestion(type: SurveyQuestionType = "short_text"): SurveyQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: type === "bmcr_calculator" ? "BMCR Calculator" : type === "pdf_upload" ? "Upload your PDF" : "",
    helperText:
      type === "bmcr_calculator"
        ? "Enter marks from your marked attempt. Basic Marks % and BMCR update as you type."
        : type === "pdf_upload"
          ? "PDF only. Scan or export your completed work as a single file."
          : "",
    required: false,
    options: questionNeedsOptions(type)
      ? type === "multi_select"
        ? [...BMCR_CHALLENGES]
        : ["Option 1", "Option 2"]
      : [],
    resourceUrl: "",
  };
}

function templateQuestion(
  id: string,
  type: SurveyQuestionType,
  label: string,
  extra: Partial<SurveyQuestion> = {}
): SurveyQuestion {
  return {
    id,
    type,
    label,
    helperText: extra.helperText || "",
    required: extra.required ?? false,
    options: extra.options || [],
    resourceUrl: extra.resourceUrl || "",
  };
}

export function task2SelfEvaluationDraft(): SurveyDraft {
  return {
    title: "Task 2 — Case Study Planning & RTFQ",
    description:
      "Self-evaluation for Task 2. Work through the checklist, name what got in the way, capture one takeaway, then complete the BMCR from your marked attempt.",
    slug: "task-2-case-study-planning-rtfq",
    isActive: false,
    isAssignment: false,
    requiresGrade: false,
    pdfUrl: "",
    questions: [
      templateQuestion("info-section-a", "info_link", "Section A — Task execution checklist", {
        helperText: "Be honest about how you actually worked this question, not how you meant to work it.",
      }),
      templateQuestion("q-reframe", "radio", "Did you reframe before you started this question?", {
        required: true,
        options: ["Yes", "Partially", "Not this time"],
        helperText: "Did you change the association with “not knowing” before you opened the question?",
      }),
      templateQuestion("q-index", "radio", "Did you index the case study?", {
        required: true,
        options: ["Yes", "Partially", "No"],
      }),
      templateQuestion("q-read-vs-look", "radio", "Read vs Look — how did you actually work the case study?", {
        required: true,
        options: ["I read it", "I mostly looked", "Mixed"],
      }),
      templateQuestion("q-rtfq", "long_text", "RTFQ comments — what did you notice in the required?", {
        required: true,
        helperText: "What did the wording actually ask for? Where did you misread, rush, or skip a constraint?",
      }),
      templateQuestion("info-section-b", "info_link", "Section B — Challenges", {
        helperText: "Select every challenge that showed up on this attempt.",
      }),
      templateQuestion("q-challenges", "multi_select", "Which challenges showed up?", {
        options: [...BMCR_CHALLENGES],
      }),
      templateQuestion("info-section-c", "info_link", "Section C — Key takeaway", {
        helperText: "One clear thing you will do differently on the next question.",
      }),
      templateQuestion("q-takeaway", "long_text", "Key takeaway", {
        required: true,
      }),
      templateQuestion("info-section-d", "info_link", "Section D — BMCR calculator", {
        helperText: "Use your marked attempt and the markplan. Question Total My Marks is the sum of the three rows above it.",
      }),
      templateQuestion("q-bmcr", "bmcr_calculator", "BMCR Calculator", {
        required: true,
        helperText: "Basic Marks % = Basic Markplan ÷ Question Total Markplan. BMCR = Basic My Marks ÷ Basic Markplan.",
      }),
    ],
  };
}

export function emptySurveyDraft(): SurveyDraft {
  return {
    title: "",
    description: "",
    slug: "",
    isActive: false,
    isAssignment: false,
    requiresGrade: false,
    pdfUrl: "",
    questions: [newSurveyQuestion("short_text")],
  };
}

export function asSurveyQuestions(value: unknown): SurveyQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const type = SURVEY_QUESTION_TYPES.some((entry) => entry.id === row.type)
        ? (row.type as SurveyQuestionType)
        : "short_text";
      const options = Array.isArray(row.options)
        ? row.options.map((option) => String(option || "").trim()).filter(Boolean)
        : [];
      const id = String(row.id || "").trim();
      if (!id) return null;
      return {
        id,
        type,
        label: String(row.label || "").trim(),
        helperText: String(row.helperText || row.helper_text || "").trim(),
        required: isInfoBlock(type) ? false : Boolean(row.required),
        options,
        resourceUrl: String(row.resourceUrl || row.resource_url || "").trim(),
      } satisfies SurveyQuestion;
    })
    .filter((item): item is SurveyQuestion => Boolean(item));
}

function surveyFromRow(row: Record<string, unknown>): CustomSurvey {
  return {
    id: String(row.id),
    title: String(row.title || "Untitled survey"),
    description: String(row.description || ""),
    slug: String(row.slug || ""),
    isActive: row.is_active === true,
    isAssignment: row.is_assignment === true,
    requiresGrade: row.requires_grade === true,
    pdfUrl: String(row.pdf_url || ""),
    questions: asSurveyQuestions(row.questions),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, answer]) => {
    if (Array.isArray(answer)) next[key] = answer.map((item) => String(item || "")).filter(Boolean).join("; ");
    else if (answer == null) next[key] = "";
    else if (typeof answer === "object") next[key] = JSON.stringify(answer);
    else next[key] = String(answer);
  });
  return next;
}

function asResponseStatus(value: unknown): SurveyResponseStatus {
  if (value === "graded" || value === "rejected" || value === "resubmit") return value;
  return "submitted";
}

function asGrade(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function responseFromRow(
  row: Record<string, unknown>,
  profile?: { name: string; email: string },
  graderName?: string
): CustomSurveyResponse {
  return {
    id: String(row.id),
    surveyId: String(row.survey_id || ""),
    studentId: String(row.student_id || ""),
    studentName: profile?.name || "",
    studentEmail: profile?.email || "",
    answers: asAnswers(row.answers),
    status: asResponseStatus(row.status),
    grade: asGrade(row.grade),
    feedback: String(row.feedback || ""),
    feedbackFileUrl: String(row.feedback_file_url || ""),
    gradedBy: String(row.graded_by || ""),
    gradedByName: graderName || "",
    gradedAt: String(row.graded_at || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export function surveyPdfUploads(survey: CustomSurvey, answers: Record<string, string>): SurveyPdfUploadAnswer[] {
  return survey.questions
    .filter((question) => isPdfUploadBlock(question.type))
    .map((question) => parsePdfUploadAnswer(answers[question.id]))
    .filter((item): item is SurveyPdfUploadAnswer => Boolean(item));
}

export function surveyResponseStatusLabel(status: SurveyResponseStatus): string {
  return SURVEY_RESPONSE_STATUSES.find((item) => item.id === status)?.label || "Submitted";
}

export function surveyResponseStatusClass(status: SurveyResponseStatus): string {
  if (status === "graded") return "ok";
  if (status === "rejected") return "warn";
  if (status === "resubmit") return "ask";
  return "";
}

export function formatSurveyAnswer(value: string | undefined, type?: SurveyQuestionType): string {
  if (type === "pdf_upload") return parsePdfUploadAnswer(value)?.url || "";
  if (type === "bmcr_calculator" || isBmcrAnswer(value)) return formatBmcrAnswer(value);
  return (value || "").trim();
}

export function studentSurveyPath(slug: string): string {
  return `/student/surveys/${encodeURIComponent(slug)}`;
}

export const SURVEY_PLACE_START = "__start__";
export const SURVEY_PLACE_END = "__end__";

export type CourseChapterOption = {
  id: string;
  title: string;
};

export type ChapterLessonOption = {
  id: string;
  title: string;
};

export function insertIndexAfterLesson(lessonIds: string[], afterLessonId?: string | null): number {
  if (!afterLessonId || afterLessonId === SURVEY_PLACE_END) return lessonIds.length;
  if (afterLessonId === SURVEY_PLACE_START) return 0;
  const index = lessonIds.indexOf(afterLessonId);
  return index >= 0 ? index + 1 : lessonIds.length;
}

export function sortSurveysNewestFirst(surveys: CustomSurvey[]): CustomSurvey[] {
  return [...surveys].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || "") || 0;
    const rightTime = Date.parse(right.updatedAt || right.createdAt || "") || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return (right.createdAt || right.id).localeCompare(left.createdAt || left.id);
  });
}

export async function fetchCourseChapters(): Promise<{
  ok: boolean;
  error?: string;
  data: CourseChapterOption[];
}> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const { data, error } = await client.from("chapters").select("id, title, position").order("position", { ascending: true });
  if (error) return { ok: false, error: error.message, data: [] };
  return {
    ok: true,
    data: (data || []).map((row) => ({ id: String(row.id), title: String(row.title || row.id) })),
  };
}

export async function fetchChapterLessons(chapterId: string): Promise<{
  ok: boolean;
  error?: string;
  data: ChapterLessonOption[];
}> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const chapter = chapterId.trim();
  if (!chapter) return { ok: true, data: [] };
  const { data, error } = await client
    .from("lessons")
    .select("id, title, position")
    .eq("chapter_id", chapter)
    .order("position", { ascending: true })
    .limit(1000);
  if (error) return { ok: false, error: describe(error), data: [] };
  return {
    ok: true,
    data: (data || []).map((row) => ({ id: String(row.id), title: String(row.title || row.id) })),
  };
}

export async function attachSurveyToChapter(
  survey: CustomSurvey,
  chapterId: string,
  afterLessonId?: string | null
): Promise<{ ok: boolean; error?: string; lessonId?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const chapter = chapterId.trim();
  if (!chapter) return { ok: false, error: "Choose a chapter." };
  const slug = survey.slug || slugifySurveyTitle(survey.title);
  const lessonId = `${chapter}-survey-${slug}`.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
  const siblings = await client
    .from("lessons")
    .select("id, position")
    .eq("chapter_id", chapter)
    .order("position", { ascending: true });
  if (siblings.error) return { ok: false, error: describe(siblings.error) };
  const orderedIds = (siblings.data || []).map((row) => String(row.id)).filter((id) => id !== lessonId);
  const insertAt = insertIndexAfterLesson(orderedIds, afterLessonId);
  const row: Record<string, unknown> = {
    id: lessonId,
    chapter_id: chapter,
    position: insertAt + 1,
    type: "survey",
    title: survey.title,
    blurb: survey.description || survey.title,
    brief: slug,
    duration: "5 min",
    survey_id: survey.id,
  };
  let { error } = await client.from("lessons").upsert(row, { onConflict: "id" });
  if (error && /survey_id/i.test(error.message)) {
    const fallback = { ...row };
    delete fallback.survey_id;
    const retry = await client.from("lessons").upsert(fallback, { onConflict: "id" });
    error = retry.error;
  }
  if (error) return { ok: false, error: describe(error) };
  orderedIds.splice(insertAt, 0, lessonId);
  const { saveChapterOrder } = await import("./content");
  const rewritten = await saveChapterOrder(chapter, orderedIds);
  if (!rewritten.ok) return { ok: false, error: rewritten.error || "Survey was added, but the chapter order could not be saved." };
  if (!survey.isActive) await setCustomSurveyActive(survey.id, true);
  const { invalidateCourseOutline } = await import("./student-lesson");
  invalidateCourseOutline();
  return { ok: true, lessonId };
}

export async function fetchCustomSurveys(): Promise<{ ok: boolean; error?: string; data: CustomSurvey[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  let { data, error } = await client.from("custom_surveys").select("*").order("updated_at", { ascending: false });
  if (error && /updated_at/i.test(error.message)) {
    const retry = await client.from("custom_surveys").select("*").order("created_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    if (tableMissing(error.message)) {
      return { ok: false, error: "Run the custom surveys SQL in Supabase first.", data: [] };
    }
    return { ok: false, error: describe(error), data: [] };
  }
  return { ok: true, data: sortSurveysNewestFirst(((data || []) as Record<string, unknown>[]).map(surveyFromRow)) };
}

export async function fetchActiveCustomSurveys(): Promise<{ ok: boolean; error?: string; data: CustomSurvey[] }> {
  const result = await fetchCustomSurveys();
  if (!result.ok) return result;
  return { ok: true, data: result.data.filter((survey) => survey.isActive) };
}

export async function fetchCustomSurvey(id: string): Promise<{ ok: boolean; error?: string; survey: CustomSurvey | null }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", survey: null };
  const { data, error } = await client.from("custom_surveys").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: describe(error), survey: null };
  return { ok: true, survey: data ? surveyFromRow(data as Record<string, unknown>) : null };
}

export async function fetchCustomSurveyBySlug(
  slug: string
): Promise<{ ok: boolean; error?: string; survey: CustomSurvey | null }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", survey: null };
  const { data, error } = await client.from("custom_surveys").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (tableMissing(error.message)) {
      return { ok: false, error: "Run the custom surveys SQL in Supabase first.", survey: null };
    }
    return { ok: false, error: describe(error), survey: null };
  }
  return { ok: true, survey: data ? surveyFromRow(data as Record<string, unknown>) : null };
}

export async function saveCustomSurvey(
  draft: SurveyDraft,
  id?: string
): Promise<{ ok: boolean; error?: string; survey?: CustomSurvey }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const title = draft.title.trim();
  const slug = (draft.slug.trim() || slugifySurveyTitle(title)).replace(/^\/+|\/+$/g, "");
  if (!title) return { ok: false, error: "Add a survey title." };
  if (!slug) return { ok: false, error: "Add a URL slug." };
  const questions = draft.questions
    .map((question) => ({
      ...question,
      label: question.label.trim(),
      helperText: question.helperText.trim(),
      resourceUrl: String(question.resourceUrl || "").trim(),
      required: isInfoBlock(question.type) ? false : question.required,
      options: question.options.map((option) => option.trim()).filter(Boolean),
    }))
    .filter((question) => question.label);
  if (!questions.length) return { ok: false, error: "Add at least one question or info block with a header." };
  const invalidOptions = questions.find((question) => questionNeedsOptions(question.type) && question.options.length < 2);
  if (invalidOptions) return { ok: false, error: `"${invalidOptions.label}" needs at least two options.` };
  const invalidLink = questions.find(
    (question) => isInfoBlock(question.type) && question.resourceUrl && !safeHref(question.resourceUrl)
  );
  if (invalidLink) return { ok: false, error: `"${invalidLink.label}" has an invalid Resource URL.` };

  const pdfUrl = draft.pdfUrl.trim();
  const row: Record<string, unknown> = {
    title,
    description: draft.description.trim(),
    slug,
    is_active: draft.isActive,
    is_assignment: draft.isAssignment,
    requires_grade: draft.requiresGrade,
    pdf_url: pdfUrl,
    questions,
    updated_at: new Date().toISOString(),
  };

  const write = (payload: Record<string, unknown>) =>
    id
      ? client.from("custom_surveys").update(payload).eq("id", id).select("*").maybeSingle()
      : client.from("custom_surveys").insert(payload).select("*").maybeSingle();

  const optionalColumns = [
    {
      column: "is_assignment",
      required: draft.isAssignment,
      sql: "alter table public.custom_surveys add column if not exists is_assignment boolean not null default false;",
    },
    {
      column: "requires_grade",
      required: draft.requiresGrade,
      sql: "alter table public.custom_surveys add column if not exists requires_grade boolean not null default false;",
    },
    {
      column: "pdf_url",
      required: Boolean(pdfUrl),
      sql: "alter table public.custom_surveys add column if not exists pdf_url text;",
    },
  ];

  let payload = { ...row };
  let { data, error } = await write(payload);
  for (let attempt = 0; attempt < optionalColumns.length && error; attempt += 1) {
    const missing = optionalColumns.find((item) => item.column in payload && (error?.message || "").includes(item.column));
    if (!missing) break;
    if (missing.required) {
      return { ok: false, error: `Paste this SQL in Supabase first:\n\n${missing.sql}` };
    }
    delete payload[missing.column];
    ({ data, error } = await write(payload));
  }
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That slug is already in use. Choose another." };
    return { ok: false, error: describe(error) };
  }
  return { ok: true, survey: data ? surveyFromRow(data as Record<string, unknown>) : undefined };
}

export async function fetchSurveyAssignmentFlags(): Promise<Record<string, boolean>> {
  const client = getSupabase();
  if (!client) return {};
  const withFlag = await client.from("custom_surveys").select("id, is_assignment");
  if (withFlag.error && /is_assignment/i.test(withFlag.error.message || "")) {
    const retry = await client.from("custom_surveys").select("id");
    if (retry.error || !retry.data) return {};
    return Object.fromEntries(retry.data.map((row) => [String(row.id), false]));
  }
  if (withFlag.error || !withFlag.data) return {};
  return Object.fromEntries(
    withFlag.data.map((row) => [String(row.id), (row as { is_assignment?: boolean }).is_assignment === true])
  );
}

export async function uploadSurveyPdf(file: File): Promise<{ ok: boolean; error?: string; url?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const name = file.name.toLowerCase();
  if (!file.type.includes("pdf") && !name.endsWith(".pdf")) {
    return { ok: false, error: "Please upload a PDF file." };
  }
  const path = `surveys/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: "Could not upload that PDF. Paste a public PDF URL instead." };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a public URL for that PDF." };
  return { ok: true, url: data.publicUrl };
}

export async function uploadSurveyResponsePdf(
  file: File,
  surveyId: string,
  questionId: string
): Promise<{ ok: boolean; error?: string; url?: string; name?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  const name = file.name.toLowerCase();
  if (!file.type.includes("pdf") && !name.endsWith(".pdf")) {
    return { ok: false, error: "Please upload a PDF file." };
  }
  const originalName = file.name.trim() || "upload.pdf";
  const path = `survey-responses/${surveyId}/${session.user.id}/${questionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) {
    return {
      ok: false,
      error:
        "Could not upload that PDF. Paste the survey storage SQL in Supabase if this is the first student upload.",
    };
  }
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a public URL for that PDF." };
  return { ok: true, url: data.publicUrl, name: originalName };
}

export async function setCustomSurveyActive(id: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client
    .from("custom_surveys")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function deleteCustomSurvey(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("custom_surveys").delete().eq("id", id);
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function fetchOwnSurveyResponse(
  surveyId: string
): Promise<{ ok: boolean; error?: string; response: CustomSurveyResponse | null }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", response: null };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required.", response: null };
  const { data, error } = await client
    .from("custom_survey_responses")
    .select("*")
    .eq("survey_id", surveyId)
    .eq("student_id", session.user.id)
    .maybeSingle();
  if (error) return { ok: false, error: describe(error), response: null };
  if (!data) return { ok: true, response: null };
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    response: responseFromRow(row, { name: "", email: session.user.email || "" }),
  };
}

export async function persistSurveyBmcrEvaluation(input: {
  survey: CustomSurvey;
  answers: Record<string, string>;
  studentId: string;
  lessonId?: string | null;
}): Promise<void> {
  const bmcrQuestion = input.survey.questions.find((question) => isBmcrBlock(question.type));
  if (!bmcrQuestion) return;
  const marks = parseBmcrAnswer(input.answers[bmcrQuestion.id]);
  const challengeQuestion =
    input.survey.questions.find((question) => question.id === "q-challenges") ||
    input.survey.questions.find((question) => question.type === "multi_select");
  const takeawayQuestion =
    input.survey.questions.find((question) => question.id === "q-takeaway") ||
    input.survey.questions.find((question) => question.type === "long_text" && /takeaway/i.test(question.label));
  const challenges = (input.answers[challengeQuestion?.id || ""] || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const key_takeaways = (input.answers[takeawayQuestion?.id || ""] || "").trim();
  if (!hasBmcrData(marks) && !hasBmcrDiagnostics(marks) && !challenges.length && !key_takeaways) return;
  const assignmentId = bmcrAssignmentId(input.lessonId, input.survey.id);
  if (!assignmentId) return;
  await saveBmcrEvaluation({
    studentId: input.studentId,
    assignmentId,
    marks,
    challenges,
    key_takeaways,
  });
}

export async function submitCustomSurveyResponse(
  surveyId: string,
  answers: Record<string, string>,
  lessonId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  const payload: Record<string, unknown> = {
    survey_id: surveyId,
    student_id: session.user.id,
    answers,
    status: "submitted",
  };
  let { error } = await client.from("custom_survey_responses").insert(payload);
  if (error && /status/i.test(error.message || "")) {
    delete payload.status;
    ({ error } = await client.from("custom_survey_responses").insert(payload));
  }
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You have already submitted this survey." };
    return { ok: false, error: describe(error) };
  }
  const survey = await fetchCustomSurvey(surveyId);
  if (survey.survey) {
    await persistSurveyBmcrEvaluation({
      survey: survey.survey,
      answers,
      studentId: session.user.id,
      lessonId,
    });
  }
  return { ok: true };
}

export async function fetchSurveyResponses(
  surveyId: string
): Promise<{ ok: boolean; error?: string; data: CustomSurveyResponse[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const { data, error } = await client
    .from("custom_survey_responses")
    .select("*")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: describe(error), data: [] };
  const rows = (data || []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((row) => String(row.student_id || "")).filter(Boolean))];
  const names = new Map<string, { name: string; email: string }>();
  if (ids.length) {
    const profiles = await client.from("profiles").select("id, full_name, email").in("id", ids);
    (profiles.data || []).forEach((profile) => {
      names.set(String(profile.id), {
        name: String(profile.full_name || "").trim() || String(profile.email || "Student"),
        email: String(profile.email || ""),
      });
    });
  }
  return {
    ok: true,
    data: rows.map((row) => {
      const studentId = String(row.student_id || "");
      const profile = names.get(studentId);
      return responseFromRow(row, profile);
    }),
  };
}

async function loadProfileNames(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  ids: string[]
): Promise<Map<string, { name: string; email: string }>> {
  const names = new Map<string, { name: string; email: string }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return names;
  const profiles = await client.from("profiles").select("id, full_name, email").in("id", unique);
  (profiles.data || []).forEach((profile) => {
    names.set(String(profile.id), {
      name: String(profile.full_name || "").trim() || String(profile.email || "Student"),
      email: String(profile.email || ""),
    });
  });
  return names;
}

export async function fetchAllSurveySubmissions(): Promise<{
  ok: boolean;
  error?: string;
  data: SurveySubmissionRow[];
}> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const { data, error } = await client.from("custom_survey_responses").select("*").order("created_at", { ascending: false });
  if (error) {
    if (tableMissing(error.message)) {
      return { ok: false, error: "Run the custom surveys SQL in Supabase first.", data: [] };
    }
    return { ok: false, error: describe(error), data: [] };
  }
  const rows = (data || []) as Record<string, unknown>[];
  const surveyIds = [...new Set(rows.map((row) => String(row.survey_id || "")).filter(Boolean))];
  const surveys = surveyIds.length
    ? await client.from("custom_surveys").select("*").in("id", surveyIds)
    : { data: [] as Record<string, unknown>[] };
  const surveyMap = new Map(
    ((surveys.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), surveyFromRow(row)])
  );
  const studentIds = rows.map((row) => String(row.student_id || ""));
  const graderIds = rows.map((row) => String(row.graded_by || ""));
  const names = await loadProfileNames(client, [...studentIds, ...graderIds]);
  return {
    ok: true,
    data: rows.map((row) => {
      const survey = surveyMap.get(String(row.survey_id || ""));
      const student = names.get(String(row.student_id || ""));
      const grader = names.get(String(row.graded_by || ""));
      return {
        ...responseFromRow(row, student || { name: "Student", email: "" }, grader?.name),
        surveyTitle: survey?.title || "Survey",
        isAssignment: survey?.isAssignment === true,
        requiresGrade: survey?.requiresGrade === true,
      };
    }),
  };
}

export async function fetchSurveySubmission(
  id: string
): Promise<{ ok: boolean; error?: string; survey: CustomSurvey | null; response: CustomSurveyResponse | null }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", survey: null, response: null };
  const { data, error } = await client.from("custom_survey_responses").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: describe(error), survey: null, response: null };
  if (!data) return { ok: true, survey: null, response: null };
  const row = data as Record<string, unknown>;
  const survey = await fetchCustomSurvey(String(row.survey_id || ""));
  const names = await loadProfileNames(client, [String(row.student_id || ""), String(row.graded_by || "")]);
  const student = names.get(String(row.student_id || ""));
  const grader = names.get(String(row.graded_by || ""));
  return {
    ok: true,
    survey: survey.survey,
    response: responseFromRow(row, student || { name: "Student", email: "" }, grader?.name),
  };
}

export async function saveSurveyReview(input: {
  id: string;
  status: SurveyResponseStatus;
  grade: number | null;
  feedback: string;
  feedbackFileUrl: string;
}): Promise<{ ok: boolean; error?: string; response?: CustomSurveyResponse }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  if (input.status === "submitted") return { ok: false, error: "Choose Graded, Rejected, or Resubmit." };
  const payload: Record<string, unknown> = {
    status: input.status,
    grade: input.grade,
    feedback: input.feedback.trim(),
    feedback_file_url: input.feedbackFileUrl.trim(),
    graded_by: session.user.id,
    graded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const optional = ["status", "grade", "feedback", "feedback_file_url", "graded_by", "graded_at", "updated_at"];
  let { data, error } = await client.from("custom_survey_responses").update(payload).eq("id", input.id).select("*").maybeSingle();
  for (let attempt = 0; attempt < optional.length && error; attempt += 1) {
    const missing = optional.find((column) => column in payload && (error?.message || "").includes(column));
    if (!missing) break;
    if (missing === "status" || missing === "feedback" || missing === "graded_by") {
      return {
        ok: false,
        error:
          "Paste this SQL in Supabase so grading can be stored:\n\nalter table public.custom_survey_responses add column if not exists status text not null default 'submitted';\nalter table public.custom_survey_responses add column if not exists grade numeric;\nalter table public.custom_survey_responses add column if not exists feedback text not null default '';\nalter table public.custom_survey_responses add column if not exists feedback_file_url text;\nalter table public.custom_survey_responses add column if not exists graded_by uuid;\nalter table public.custom_survey_responses add column if not exists graded_at timestamptz;\nalter table public.custom_survey_responses add column if not exists updated_at timestamptz not null default now();",
      };
    }
    delete payload[missing];
    ({ data, error } = await client.from("custom_survey_responses").update(payload).eq("id", input.id).select("*").maybeSingle());
  }
  if (error) return { ok: false, error: describe(error) };
  return { ok: true, response: data ? responseFromRow(data as Record<string, unknown>) : undefined };
}

export async function uploadCoachFeedbackFile(
  file: File,
  surveyId: string,
  responseId: string
): Promise<{ ok: boolean; error?: string; url?: string; name?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const attempts = [
    { bucket: "course-pdfs", path: `surveys/feedback/${surveyId}/${responseId}-${stamp}` },
    { bucket: "course-pdfs", path: `surveys/${responseId}-${stamp}` },
    { bucket: "course-pdfs", path: `survey-feedback/${surveyId}/${responseId}-${stamp}` },
    { bucket: "lesson-banners", path: `surveys/feedback/${responseId}-${stamp}` },
  ];
  for (const attempt of attempts) {
    const uploaded = await client.storage.from(attempt.bucket).upload(attempt.path, file, {
      upsert: true,
      contentType: file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream"),
    });
    if (uploaded.error) continue;
    const { data } = client.storage.from(attempt.bucket).getPublicUrl(attempt.path);
    if (data?.publicUrl) return { ok: true, url: data.publicUrl, name: file.name.trim() || "feedback" };
  }
  return { ok: false, error: "Could not upload that file. Try a PDF, or paste a public file URL into the feedback notes." };
}

export async function fetchStudentSurveyPacks(
  studentId: string
): Promise<{ survey: CustomSurvey; response: CustomSurveyResponse }[]> {
  const client = getSupabase();
  if (!client || !studentId) return [];
  const { data, error } = await client
    .from("custom_survey_responses")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error || !data?.length) return [];
  const rows = data as Record<string, unknown>[];
  const surveyIds = [...new Set(rows.map((row) => String(row.survey_id || "")).filter(Boolean))];
  const surveys = surveyIds.length
    ? await client.from("custom_surveys").select("*").in("id", surveyIds)
    : { data: [] as Record<string, unknown>[] };
  const surveyMap = new Map(
    ((surveys.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), surveyFromRow(row)])
  );
  return rows.flatMap((row) => {
    const survey = surveyMap.get(String(row.survey_id || ""));
    if (!survey) return [];
    return [
      {
        survey,
        response: responseFromRow(row),
      },
    ];
  });
}

export async function fetchSurveyResponsePairs(): Promise<Record<string, string[]>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("custom_survey_responses").select("student_id, survey_id");
  if (error || !data) return {};
  const map: Record<string, string[]> = {};
  data.forEach((row) => {
    const studentId = String(row.student_id || "");
    const surveyId = String(row.survey_id || "");
    if (!studentId || !surveyId) return;
    map[studentId] = map[studentId] || [];
    if (!map[studentId].includes(surveyId)) map[studentId].push(surveyId);
  });
  return map;
}

export async function fetchSurveyResponseCountsByStudent(): Promise<Record<string, number>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("custom_survey_responses").select("student_id");
  if (error || !data) return {};
  const map: Record<string, number> = {};
  data.forEach((row) => {
    const id = String(row.student_id || "");
    if (!id) return;
    map[id] = (map[id] || 0) + 1;
  });
  return map;
}

export function downloadSurveyCsv(survey: CustomSurvey, responses: CustomSurveyResponse[]): void {
  const columns = survey.questions.filter((question) => questionCollectsAnswer(question.type));
  const headers = ["Student", "Email", "Submitted", ...columns.map((question) => question.label || question.id)];
  const lines = responses.map((response) => [
    response.studentName,
    response.studentEmail,
    response.createdAt,
    ...columns.map((question) => formatSurveyAnswer(response.answers[question.id], question.type)),
  ]);
  downloadRosterCsv(`${survey.slug || "survey"}-responses.csv`, headers, lines);
}
