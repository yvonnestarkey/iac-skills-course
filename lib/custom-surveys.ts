import { downloadRosterCsv } from "./roster";
import { safeHref } from "./rich-text";
import { getSupabase } from "./supabase";

export { safeHref } from "./rich-text";

export type SurveyQuestionType = "dropdown" | "radio" | "short_text" | "long_text" | "rating" | "info_link";

export const SURVEY_QUESTION_TYPES: { id: SurveyQuestionType; label: string }[] = [
  { id: "dropdown", label: "Single Select Dropdown" },
  { id: "radio", label: "Multiple Choice Radio" },
  { id: "short_text", label: "Short Text" },
  { id: "long_text", label: "Long Text / Paragraph" },
  { id: "rating", label: "Rating Scale (1-5)" },
  { id: "info_link", label: "Info / Course Link" },
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
  return type === "dropdown" || type === "radio";
}

export function isInfoBlock(type: SurveyQuestionType): boolean {
  return type === "info_link";
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
    label: "",
    helperText: "",
    required: false,
    options: questionNeedsOptions(type) ? ["Option 1", "Option 2"] : [],
    resourceUrl: "",
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
    else next[key] = String(answer);
  });
  return next;
}

export function formatSurveyAnswer(value: string | undefined): string {
  return (value || "").trim();
}

export function studentSurveyPath(slug: string): string {
  return `/student/surveys/${encodeURIComponent(slug)}`;
}

export async function fetchCourseChapters(): Promise<{
  ok: boolean;
  error?: string;
  data: { id: string; title: string }[];
}> {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client.from("chapters").select("id, title, position").order("position", { ascending: true });
    if (!error && data?.length) {
      return { ok: true, data: data.map((row) => ({ id: String(row.id), title: String(row.title || row.id) })) };
    }
  }
  const { outlineFromSeed } = await import("./student-lesson");
  return { ok: true, data: outlineFromSeed().map((chapter) => ({ id: chapter.id, title: chapter.title })) };
}

export async function attachSurveyToChapter(
  survey: CustomSurvey,
  chapterId: string
): Promise<{ ok: boolean; error?: string; lessonId?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const chapter = chapterId.trim();
  if (!chapter) return { ok: false, error: "Choose a chapter." };
  const slug = survey.slug || slugifySurveyTitle(survey.title);
  const lessonId = `${chapter}-survey-${slug}`.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
  const last = await client
    .from("lessons")
    .select("position")
    .eq("chapter_id", chapter)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = Number(last.data?.position || 0) + 1;
  const row: Record<string, unknown> = {
    id: lessonId,
    chapter_id: chapter,
    position,
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
  if (!survey.isActive) await setCustomSurveyActive(survey.id, true);
  const { invalidateCourseOutline } = await import("./student-lesson");
  invalidateCourseOutline();
  return { ok: true, lessonId };
}

export async function fetchCustomSurveys(): Promise<{ ok: boolean; error?: string; data: CustomSurvey[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const { data, error } = await client.from("custom_surveys").select("*").order("created_at", { ascending: false });
  if (error) {
    if (tableMissing(error.message)) {
      return { ok: false, error: "Run the custom surveys SQL in Supabase first.", data: [] };
    }
    return { ok: false, error: describe(error), data: [] };
  }
  return { ok: true, data: ((data || []) as Record<string, unknown>[]).map(surveyFromRow) };
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

export async function submitCustomSurveyResponse(
  surveyId: string,
  answers: Record<string, string>
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

export function downloadSurveyCsv(survey: CustomSurvey, responses: CustomSurveyResponse[]): void {
  const columns = survey.questions.filter((question) => questionCollectsAnswer(question.type));
  const headers = ["Student", "Email", "Submitted", ...columns.map((question) => question.label || question.id)];
  const lines = responses.map((response) => [
    response.studentName,
    response.studentEmail,
    response.createdAt,
    ...columns.map((question) => formatSurveyAnswer(response.answers[question.id])),
  ]);
  downloadRosterCsv(`${survey.slug || "survey"}-responses.csv`, headers, lines);
}
