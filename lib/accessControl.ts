import { fetchCourseOutline, type OutlineChapter, type OutlineLesson } from "./student-lesson";
import {
  fetchLessonSubmission,
  fetchStudentSubmissions,
  type StudentSubmission,
} from "./student-submissions";
import { getSupabase } from "./supabase";

export interface LessonGate {
  id: string;
  title: string;
  requires_submission?: boolean;
  requires_coach_approval?: boolean;
  prereq_lesson_id?: string | null;
}

export interface AccessResult {
  isLocked: boolean;
  reason?: string;
  prereqLessonId?: string;
  prereqTitle?: string;
}

export function catalogFromOutline(chapters: OutlineChapter[]): LessonGate[] {
  return chapters.flatMap((chapter) => chapter.lessons.map(outlineToGate));
}

export function outlineToGate(lesson: LessonGate | OutlineLesson): LessonGate {
  return {
    id: lesson.id,
    title: lesson.title,
    requires_submission: Boolean(lesson.requires_submission),
    requires_coach_approval: Boolean(lesson.requires_coach_approval),
    prereq_lesson_id: lesson.prereq_lesson_id || null,
  };
}

export function isValidSubmission(prereq: LessonGate, submission: StudentSubmission | null | undefined): boolean {
  if (!prereq.requires_submission && !prereq.requires_coach_approval) return true;
  if (!submission) return false;
  const hasContent = Boolean(submission.body.trim() || submission.link_url.trim());
  if (!hasContent) return false;
  if (prereq.requires_coach_approval) return submission.status === "approved";
  return true;
}

function submissionReason(title: string): string {
  return `Requires submission from ${title}`;
}

/**
 * Sync gate: a target lesson stays locked until its prerequisite submission
 * (and coach approval, when required) is in place.
 */
export function checkLessonAccess(
  target: LessonGate,
  catalog: LessonGate[],
  submissions: Record<string, StudentSubmission | undefined>
): AccessResult {
  const prereqId = target.prereq_lesson_id || "";
  if (!prereqId) return { isLocked: false };

  const prereq = catalog.find((lesson) => lesson.id === prereqId) || {
    id: prereqId,
    title: "the previous lesson",
    requires_submission: true,
  };
  const prereqTitle = prereq.title || "the previous lesson";
  const reason = submissionReason(prereqTitle);

  if (!prereq.requires_submission && !prereq.requires_coach_approval) {
    return { isLocked: false };
  }

  if (!isValidSubmission(prereq, submissions[prereqId])) {
    return { isLocked: true, reason, prereqLessonId: prereqId, prereqTitle };
  }

  return { isLocked: false };
}

async function fetchLessonGate(lessonId: string): Promise<LessonGate | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from("lessons")
    .select("id, title, requires_submission, requires_coach_approval, prereq_lesson_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    requires_submission: Boolean(data.requires_submission),
    requires_coach_approval: Boolean(data.requires_coach_approval),
    prereq_lesson_id: data.prereq_lesson_id || null,
  };
}

/** Async gate used by the lesson page when a student opens a target lesson. */
export async function getLessonAccess(studentId: string, targetLessonId: string): Promise<AccessResult> {
  const client = getSupabase();
  if (!client) {
    const outline = await fetchCourseOutline();
    const catalog = catalogFromOutline(outline);
    const target = catalog.find((lesson) => lesson.id === targetLessonId);
    if (!target) return { isLocked: false };
    const submissions = await fetchStudentSubmissions(studentId);
    return checkLessonAccess(target, catalog, submissions);
  }

  let target = await fetchLessonGate(targetLessonId);
  if (!target) {
    const outline = await fetchCourseOutline();
    target = catalogFromOutline(outline).find((lesson) => lesson.id === targetLessonId) || null;
  }
  if (!target?.prereq_lesson_id) return { isLocked: false };

  let prereq = await fetchLessonGate(target.prereq_lesson_id);
  if (!prereq) {
    const outline = await fetchCourseOutline();
    prereq = catalogFromOutline(outline).find((lesson) => lesson.id === target!.prereq_lesson_id) || {
      id: target.prereq_lesson_id,
      title: "the previous lesson",
      requires_submission: true,
    };
  }

  const submission = await fetchLessonSubmission(studentId, prereq.id);
  return checkLessonAccess(target, [target, prereq], { [prereq.id]: submission || undefined });
}
