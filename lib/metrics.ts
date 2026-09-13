import { SURVEY_QUESTIONS } from "./constants";
import { courseTasks, gradedLessons, hasWork, isDone, surveyFor, surveyLessons, surveyScore } from "./course";
import type { CourseData, Student, SurveyAnswer } from "./types";

/** Course-wide progress used by the coach views: teaching + graded work. */
export function overallProgress(data: CourseData, student: Student) {
  const tasks = courseTasks(data);
  const done = tasks.filter((t) => isDone(student, t.lesson)).length;
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
}

export function averageSurveyScore(data: CourseData, students: Student[]): number | null {
  const scores: number[] = [];
  const lessons = surveyLessons(data);
  students.forEach((s) => {
    lessons.forEach((l) => {
      const answer = surveyFor(s, l.id);
      const score = answer ? surveyScore(answer) : null;
      if (score !== null) scores.push(score);
    });
  });
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function pendingSubmissions(data: CourseData, students: Student[]): number {
  let count = 0;
  const graded = gradedLessons(data);
  students
    .filter((s) => s.status !== "paused")
    .forEach((s) => {
      graded.forEach((l) => {
        if (!hasWork(s, l)) count += 1;
      });
    });
  return count;
}

export function submittedCount(data: CourseData, student: Student): number {
  return gradedLessons(data).filter((l) => hasWork(student, l)).length;
}

export function cohortStudents(data: CourseData, cohort: string): Student[] {
  if (cohort === "all") return data.students;
  return data.students.filter((s) => s.cohort === cohort);
}

export function cohortCompletion(data: CourseData, students: Student[]): number {
  if (!students.length) return 0;
  return Math.round(students.reduce((sum, s) => sum + overallProgress(data, s).pct, 0) / students.length);
}

/** Per-question averages for one module survey. */
export function surveyBreakdown(answers: SurveyAnswer[]) {
  return SURVEY_QUESTIONS.map((q) => {
    const values = answers.map((a) => a[q.id]).filter((v) => typeof v === "number") as number[];
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { q, avg, count: values.length };
  });
}
