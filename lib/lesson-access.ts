import { catalogFromOutline, checkLessonAccess, type AccessResult } from "./accessControl";
import { isChapterSequentiallyLocked } from "./course-phases";
import type { DrillAttempt, ReadingCheckResult } from "./reading-drills";
import { fetchCourseOutline, type OutlineChapter } from "./student-lesson";
import { fetchStudentSubmissions, submissionFromRow, type StudentSubmission } from "./student-submissions";
import { getServiceSupabase } from "./supabase-admin";
import { getSupabase } from "./supabase";
import { mergeCompletedWithReading } from "./task2-gate";

async function loadStudentAccessState(studentId: string): Promise<{
  submissions: Record<string, StudentSubmission>;
  completed: Record<string, boolean>;
  attempts: DrillAttempt[];
  checks: ReadingCheckResult[];
}> {
  const client = getServiceSupabase() || getSupabase();
  if (!client) {
    return { submissions: await fetchStudentSubmissions(studentId), completed: {}, attempts: [], checks: [] };
  }
  const [{ data: subRows }, { data: progressRows }, { data: attemptRows }, { data: checkRows }] = await Promise.all([
    client.from("student_submissions").select("*").eq("student_id", studentId),
    client.from("lesson_progress").select("lesson_id").eq("user_id", studentId).eq("completed", true),
    client.from("reading_attempts").select("exercise_id").eq("user_id", studentId),
    client.from("reading_checks").select("check_id").eq("user_id", studentId),
  ]);
  const submissions: Record<string, StudentSubmission> = {};
  (subRows || []).forEach((row) => {
    const item = submissionFromRow(row);
    submissions[item.lesson_id] = item;
  });
  const completed: Record<string, boolean> = {};
  (progressRows || []).forEach((row) => {
    completed[String(row.lesson_id)] = true;
  });
  return {
    submissions,
    completed,
    attempts: (attemptRows || []) as DrillAttempt[],
    checks: (checkRows || []) as ReadingCheckResult[],
  };
}

/** Async pedagogical gate. Does not consider purchase/entitlement. */
export async function getLessonAccess(
  studentId: string,
  targetLessonId: string,
  options?: { outline?: OutlineChapter[]; chapterId?: string | null }
): Promise<AccessResult> {
  const outline = options?.outline || (await fetchCourseOutline());
  const catalog = catalogFromOutline(outline);
  const target = catalog.find((lesson) => lesson.id === targetLessonId);
  const { submissions, completed, attempts, checks } = await loadStudentAccessState(studentId);
  const gatedCompleted = mergeCompletedWithReading(completed, outline, { attempts, checks });
  const lessonAccess = target ? checkLessonAccess(target, catalog, submissions, { completed: gatedCompleted }) : { isLocked: false };
  if (lessonAccess.isLocked) return lessonAccess;
  const chapterId =
    options?.chapterId || outline.find((chapter) => chapter.lessons.some((lesson) => lesson.id === targetLessonId))?.id;
  if (chapterId && isChapterSequentiallyLocked(outline, chapterId, completed)) {
    return { isLocked: true, reason: "Finish the previous section first." };
  }
  return { isLocked: false };
}
