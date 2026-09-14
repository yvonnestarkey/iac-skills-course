import { SURVEY_QUESTIONS } from "./constants";
import { daysAgo, longDate, parseISO } from "./dates";
import { lessonMinutes } from "./lesson-duration";
import type {
  Chapter,
  CourseData,
  FlatLesson,
  Lesson,
  Message,
  Student,
  SurveyAnswer,
  UploadRecord,
} from "./types";

export function allLessons(data: CourseData): FlatLesson[] {
  return data.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
}

export function gradedLessons(data: CourseData): FlatLesson[] {
  return allLessons(data).filter((l) => l.type === "assignment" || l.type === "upload");
}

export function findLesson(data: CourseData, id: string): FlatLesson {
  const lessons = allLessons(data);
  return lessons.find((l) => l.id === id) || lessons[0];
}

export function chapterCode(chapter: Chapter): string {
  return chapter.title.split(" · ")[0];
}

/** Assignment / upload titles read better without their prefix in coach views. */
export function shortLessonTitle(lesson: Lesson): string {
  return lesson.title.replace(/^(Assignment|Upload) · /, "");
}

export function textFor(student: Student, lessonId: string): string {
  return (student.submissions && student.submissions[lessonId]) || "";
}

export function fileFor(student: Student, lessonId: string): UploadRecord | null {
  return (student.uploads && student.uploads[lessonId]) || null;
}

export function hasWork(student: Student, lesson: Lesson): boolean {
  if (lesson.type === "upload") return Boolean(fileFor(student, lesson.id));
  return Boolean(textFor(student, lesson.id).trim());
}

export function isDone(student: Student, lesson: Lesson): boolean {
  if ((student.completed || []).includes(lesson.id)) return true;
  if (lesson.type === "video" || lesson.type === "reading" || lesson.type === "survey" || lesson.type === "ask") {
    return false;
  }
  return hasWork(student, lesson);
}

export function thread(data: CourseData, id: string): Message[] {
  return data.messages[id] || [];
}

export function unansweredQuestion(data: CourseData, id: string): Message | null {
  let pending: Message | null = null;
  for (const message of thread(data, id)) {
    if (message.from === "student" && message.kind === "question") pending = message;
    if (message.from === "coach") pending = null;
  }
  return pending;
}

export function waitingQuestions(data: CourseData): Student[] {
  return data.students.filter((s) => unansweredQuestion(data, s.id));
}

/** Sidebar progress: teaching lessons only. */
export function progressFor(data: CourseData, student: Student) {
  const teaching = allLessons(data).filter((l) => l.type === "video" || l.type === "reading");
  const done = teaching.filter((l) => (student.completed || []).includes(l.id)).length;
  return { done, total: teaching.length, pct: Math.round((done / teaching.length) * 100) };
}

export function surveyFor(student: Student, lessonId: string): SurveyAnswer | null {
  return (student.surveys && student.surveys[lessonId]) || null;
}

export function surveyLessons(data: CourseData): FlatLesson[] {
  return allLessons(data).filter((l) => l.type === "survey");
}

export function surveyScore(answer: SurveyAnswer): number | null {
  const values = SURVEY_QUESTIONS.map((q) => answer[q.id]).filter((v) => typeof v === "number");
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function estimateMinutes(lesson: Lesson): number {
  return lessonMinutes(lesson);
}

export function taskAction(lesson: Lesson): string {
  if (lesson.type === "video") return "Watch and take notes";
  if (lesson.type === "reading") return "Read and annotate";
  if (lesson.type === "assignment") return "Write up and submit";
  if (lesson.type === "upload") return "Scan and upload PDF";
  if (lesson.type === "download") return "Download the PDF";
  if (lesson.type === "survey") return "Complete the check-in";
  return "Work through this lesson";
}

// The whole course, in order, so a plan can show a finish date. Ask the Coach
// stays open on demand and is not packed into dated sessions.
export function courseTasks(data: CourseData) {
  return allLessons(data)
    .filter((l) => l.type !== "ask")
    .map((l) => ({ lesson: l, minutes: estimateMinutes(l) }));
}

export function cohortName(data: CourseData, id: string): string {
  const c = (data.cohorts || []).find((x) => x.id === id);
  return c ? c.name : "Unassigned";
}

export function lastActiveLabel(student: Student): string {
  const days = daysAgo(student.lastActive);
  if (days === null) return "unknown";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return longDate(parseISO(student.lastActive));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("");
}

export function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
