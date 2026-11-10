import type { CustomSurveyResponse } from "./custom-surveys";
import { task1AssignmentFromOutline } from "./task1-gate";
import type { OutlineChapter, OutlineLesson } from "./student-lesson";

export const S4_REPEAT_SURVEY_SLUG = "s4-repeat-student-gate";
export const S4_REPEAT_GATE_LESSON_ID = "s4-repeat-gate";
export const S4_REPEAT_QUESTION_ID = "q-done-course-before";
export const S4_SITTING_QUESTION_ID = "q-which-sitting";
export const S4_YES = "Yes";
export const S4_NO = "No";
export const S4_NO_MESSAGE =
  "This question is only intended for students who have already completed the Skills in this course, and is designed to assess which Skills they need to work on the most for this sitting. It will be waiting for you once you're done with your Tasks. For now, please start with Task 1";
export const S4_UNANSWERED_MESSAGE = "Please complete the question in L1 first.";
export const S4_SITTING_OPTIONS = [
  "Jan 2026",
  "June 2025",
  "Jan 2025",
  "June 2024",
  "Jan 2024",
  "I can't remember",
];

export function isS4Chapter(title: string | null | undefined): boolean {
  return /^S4\b/i.test(String(title || "").trim());
}

export function findS4Chapter(chapters: OutlineChapter[] | null | undefined): OutlineChapter | null {
  return (chapters || []).find((chapter) => isS4Chapter(chapter.title)) || null;
}

export function findS4GateLesson(chapters: OutlineChapter[] | null | undefined): OutlineLesson | null {
  const chapter = findS4Chapter(chapters);
  if (!chapter?.lessons?.length) return null;
  return (
    chapter.lessons.find((lesson) => lesson.id === S4_REPEAT_GATE_LESSON_ID) ||
    chapter.lessons.find((lesson) => /worked through|completed this iac skills course/i.test(lesson.title || "")) ||
    (chapter.lessons[0]?.type === "survey" ? chapter.lessons[0] : null) ||
    null
  );
}

export function isS4GateLesson(lesson: { id?: string | null; title?: string | null }, chapters?: OutlineChapter[] | null): boolean {
  const gate = findS4GateLesson(chapters);
  if (gate) return lesson.id === gate.id;
  return lesson.id === S4_REPEAT_GATE_LESSON_ID || /worked through|completed this iac skills course/i.test(String(lesson.title || ""));
}

export function applyS4RepeatGate(chapters: OutlineChapter[]): OutlineChapter[] {
  const gate = findS4GateLesson(chapters);
  if (!gate) return chapters;
  return chapters.map((chapter) => {
    if (!isS4Chapter(chapter.title)) return chapter;
    return {
      ...chapter,
      lessons: (chapter.lessons || []).map((lesson) =>
        lesson.id === gate.id ? lesson : { ...lesson, repeat_chapter_gate_id: gate.id }
      ),
    };
  });
}

function answerYesNo(value: string | null | undefined): "yes" | "no" | null {
  const text = String(value || "").trim().toLowerCase();
  if (text === "yes") return "yes";
  if (text === "no") return "no";
  return null;
}

export function s4RepeatAnswer(
  reviews: Record<string, CustomSurveyResponse> | null | undefined,
  chapters?: OutlineChapter[] | null
): "yes" | "no" | null {
  const gate = findS4GateLesson(chapters);
  const surveyId = gate?.survey_id;
  const review = surveyId ? reviews?.[surveyId] : null;
  const fromSurvey = answerYesNo(review?.answers?.[S4_REPEAT_QUESTION_ID]);
  if (fromSurvey) return fromSurvey;
  for (const item of Object.values(reviews || {})) {
    const found = answerYesNo(item.answers?.[S4_REPEAT_QUESTION_ID]);
    if (found) return found;
  }
  return null;
}

export function s4RepeatUnlocked(
  reviews: Record<string, CustomSurveyResponse> | null | undefined,
  chapters?: OutlineChapter[] | null
): boolean {
  return s4RepeatAnswer(reviews, chapters) === "yes";
}

export function s4RepeatDeclined(
  reviews: Record<string, CustomSurveyResponse> | null | undefined,
  chapters?: OutlineChapter[] | null
): boolean {
  return s4RepeatAnswer(reviews, chapters) === "no";
}

export function s4RepeatSubmittedMessage(answers: Record<string, string> | null | undefined): string | null {
  if (answerYesNo(answers?.[S4_REPEAT_QUESTION_ID]) === "no") return S4_NO_MESSAGE;
  return null;
}

export function s4Task1Href(chapters?: OutlineChapter[] | null): string {
  return `/student/${task1AssignmentFromOutline(chapters).lessonId}`;
}
