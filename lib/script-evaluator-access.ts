import type { CustomSurveyResponse } from "./custom-surveys";
import { s4RepeatUnlocked } from "./s4-repeat-gate";
import type { OutlineChapter } from "./student-lesson";
import { hasSubmissionContent, hasTask1Submission } from "./task1-gate";

/** Seed / live ids for the Grassroots upload in Repeat Students (was S6, now S4). */
export const GRASSROOTS_SUBMISSION_FALLBACK_IDS = ["ch9-l3", "ch9-l4"];

export function isGrassrootsSubmissionLesson(lesson: {
  title?: string | null;
  type?: string | null;
  requires_submission?: boolean | null;
}): boolean {
  const title = String(lesson.title || "");
  if (!/grassroots/i.test(title)) return false;
  if (/submission/i.test(title)) return true;
  return lesson.type === "assignment" || Boolean(lesson.requires_submission);
}

export function grassrootsSubmissionLessonIds(outline?: OutlineChapter[] | null): string[] {
  const ids = new Set<string>(GRASSROOTS_SUBMISSION_FALLBACK_IDS);
  for (const chapter of outline || []) {
    for (const lesson of chapter.lessons || []) {
      if (isGrassrootsSubmissionLesson(lesson)) ids.add(lesson.id);
    }
  }
  return [...ids];
}

export function hasGrassrootsSubmission(
  submissions: Record<string, { body?: string | null; link_url?: string | null } | undefined> | null | undefined,
  outline?: OutlineChapter[] | null
): boolean {
  return grassrootsSubmissionLessonIds(outline).some((id) => hasSubmissionContent(submissions?.[id]));
}

export function canOpenScriptEvaluator(input: {
  submissions?: Record<string, { body?: string | null; link_url?: string | null } | undefined> | null;
  outline?: OutlineChapter[] | null;
  surveyReviews?: Record<string, CustomSurveyResponse> | null;
}): boolean {
  if (hasTask1Submission(input.submissions, input.outline)) return true;
  if (hasGrassrootsSubmission(input.submissions, input.outline)) return true;
  if (s4RepeatUnlocked(input.surveyReviews, input.outline)) return true;
  return false;
}
