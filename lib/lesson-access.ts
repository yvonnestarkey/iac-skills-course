import { catalogFromOutline, checkLessonAccess, type AccessResult } from "./accessControl";
import { isChapterSequentiallyLocked } from "./course-phases";
import { fetchCourseOutline, type OutlineChapter } from "./student-lesson";
import { fetchStudentSubmissions, submissionFromRow, type StudentSubmission } from "./student-submissions";
import { getServiceSupabase } from "./supabase-admin";
import { getSupabase } from "./supabase";

async function loadStudentAccessState(studentId: string): Promise<{
  submissions: Record<string, StudentSubmission>;
  completed: Record<string, boolean>;
}> {
  const client = getServiceSupabase() || getSupabase();
  if (!client) {
    return { submissions: await fetchStudentSubmissions(studentId), completed: {} };
  }
  const [{ data: subRows }, { data: progressRows }] = await Promise.all([
    client.from("student_submissions").select("*").eq("student_id", studentId),
    client.from("lesson_progress").select("lesson_id").eq("user_id", studentId).eq("completed", true),
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
  return { submissions, completed };
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
  const { submissions, completed } = await loadStudentAccessState(studentId);
  const lessonAccess = target ? checkLessonAccess(target, catalog, submissions, { completed }) : { isLocked: false };
  if (lessonAccess.isLocked) return lessonAccess;
  const chapterId =
    options?.chapterId || outline.find((chapter) => chapter.lessons.some((lesson) => lesson.id === targetLessonId))?.id;
  if (chapterId && isChapterSequentiallyLocked(outline, chapterId, completed)) {
    return { isLocked: true, reason: "Finish the previous section first." };
  }
  return { isLocked: false };
}
