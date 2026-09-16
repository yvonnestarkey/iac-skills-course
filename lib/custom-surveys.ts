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
  | "bmcr_calculator";

export const SURVEY_QUESTION_TYPES: { id: SurveyQuestionType; label: string }[] = [
  { id: "dropdown", label: "Single Select Dropdown" },
  { id: "radio", label: "Multiple Choice Radio" },
  { id: "multi_select", label: "Multi-select tags" },
  { id: "short_text", label: "Short Text" },
  { id: "long_text", label: "Long Text / Paragraph" },
  { id: "rating", label: "Rating Scale (1-5)" },
  { id: "info_link", label: "Info / Course Link" },
  { id: "bmcr_calculator", label: "BMCR Calculator" },
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
  questions: SurveyQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomSurveyResponse {
  id: string;
  surveyId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  answers: Record<string, string>;
  createdAt: string;
}

export interface SurveyDraft {
  title: string;
  description: string;
  slug: string;
  isActive: boolean;
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
    label: type === "bmcr_calculator" ? "BMCR Calculator" : "",
    helperText:
      type === "bmcr_calculator"
        ? "Enter marks from your marked attempt. Basic Marks % and BMCR update as you type."
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

export function formatSurveyAnswer(value: string | undefined, type?: SurveyQuestionType): string {
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

  const row = {
    title,
    description: draft.description.trim(),
    slug,
    is_active: draft.isActive,
    questions,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? client.from("custom_surveys").update(row).eq("id", id).select("*").maybeSingle()
    : client.from("custom_surveys").insert(row).select("*").maybeSingle();
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That slug is already in use. Choose another." };
    return { ok: false, error: describe(error) };
  }
  return { ok: true, survey: data ? surveyFromRow(data as Record<string, unknown>) : undefined };
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
    response: {
      id: String(row.id),
      surveyId: String(row.survey_id),
      studentId: String(row.student_id),
      studentName: "",
      studentEmail: session.user.email || "",
      answers: asAnswers(row.answers),
      createdAt: String(row.created_at || ""),
    },
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
  const { error } = await client.from("custom_survey_responses").insert({
    survey_id: surveyId,
    student_id: session.user.id,
    answers,
  });
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
      return {
        id: String(row.id),
        surveyId: String(row.survey_id),
        studentId,
        studentName: profile?.name || "Student",
        studentEmail: profile?.email || "",
        answers: asAnswers(row.answers),
        createdAt: String(row.created_at || ""),
      };
    }),
  };
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
        response: {
          id: String(row.id),
          surveyId: String(row.survey_id),
          studentId: String(row.student_id || ""),
          studentName: "",
          studentEmail: "",
          answers: asAnswers(row.answers),
          createdAt: String(row.created_at || ""),
        },
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
