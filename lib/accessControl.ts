import type { OutlineChapter, OutlineLesson } from "./student-lesson";
import type { StudentSubmission } from "./student-submissions";

export interface LessonGate {
  id: string;
  title: string;
  requires_submission?: boolean;
  requires_coach_approval?: boolean;
  prereq_lesson_id?: string | null;
  extra_prereq_lesson_ids?: string[];
  unlock_at?: string | null;
}

export interface AccessResult {
  isLocked: boolean;
  reason?: string;
  prereqLessonId?: string;
  prereqTitle?: string;
}

export interface AccessCheckOptions {
  completed?: Record<string, boolean>;
  now?: Date;
}

export function catalogFromOutline(chapters: OutlineChapter[] | null | undefined): LessonGate[] {
  return (chapters || []).flatMap((chapter) => (chapter?.lessons || []).map(outlineToGate));
}

export function outlineToGate(lesson: LessonGate | OutlineLesson): LessonGate {
  return {
    id: lesson.id,
    title: lesson.title,
    requires_submission: Boolean(lesson.requires_submission),
    requires_coach_approval: Boolean(lesson.requires_coach_approval),
    prereq_lesson_id: lesson.prereq_lesson_id || null,
    extra_prereq_lesson_ids: "extra_prereq_lesson_ids" in lesson ? lesson.extra_prereq_lesson_ids || [] : [],
    unlock_at: lesson.unlock_at || null,
  };
}

function hasSubmissionContent(submission: StudentSubmission | null | undefined): boolean {
  if (!submission) return false;
  return Boolean(submission.body.trim() || submission.link_url.trim());
}

export function isValidSubmission(prereq: LessonGate, submission: StudentSubmission | null | undefined): boolean {
  if (!prereq.requires_submission && !prereq.requires_coach_approval) return true;
  if (!hasSubmissionContent(submission)) return false;
  if (prereq.requires_coach_approval) return submission?.status === "approved";
  return true;
}

/**
 * Sequential gates for a target lesson:
 * 1. Prerequisite completion (`prereq_lesson_id`)
 * 2. Self-submission gate (`requires_submission` on the prereq)
 * 3. Coach approval gate (`requires_coach_approval` on the prereq)
 * 4. Date/drip bounds (`unlock_at` on the target)
 */
export function checkLessonAccess(
  target: LessonGate,
  catalog: LessonGate[],
  submissions: Record<string, StudentSubmission | undefined>,
  options: AccessCheckOptions = {}
): AccessResult {
  const prereqId = target.prereq_lesson_id || "";
  if (prereqId) {
    const prereq = catalog.find((lesson) => lesson.id === prereqId) || {
      id: prereqId,
      title: "the previous lesson",
      requires_submission: true,
    };
    const prereqTitle = prereq.title || "the previous lesson";

    if (prereq.requires_submission || prereq.requires_coach_approval) {
      const submission = submissions[prereqId];
      if (!hasSubmissionContent(submission)) {
        return {
          isLocked: true,
          reason: `Requires submission from ${prereqTitle}`,
          prereqLessonId: prereqId,
          prereqTitle,
        };
      }
      if (prereq.requires_coach_approval && submission?.status !== "approved") {
        return {
          isLocked: true,
          reason: `Waiting for coach approval on ${prereqTitle}`,
          prereqLessonId: prereqId,
          prereqTitle,
        };
      }
    } else if (options.completed && !options.completed[prereqId]) {
      return {
        isLocked: true,
        reason: `Finish ${prereqTitle} first`,
        prereqLessonId: prereqId,
        prereqTitle,
      };
    }
  }

  for (const extraId of target.extra_prereq_lesson_ids || []) {
    if (options.completed?.[extraId]) continue;
    const extra = catalog.find((lesson) => lesson.id === extraId);
    const extraTitle = extra?.title || "the required reading tool";
    return {
      isLocked: true,
      reason: `Finish ${extraTitle} first`,
      prereqLessonId: extraId,
      prereqTitle: extraTitle,
    };
  }

  if (target.unlock_at) {
    const opens = new Date(target.unlock_at);
    const now = options.now || new Date();
    if (Number.isFinite(opens.getTime()) && opens.getTime() > now.getTime()) {
      return {
        isLocked: true,
        reason: `This lesson opens on ${opens.toLocaleDateString()}`,
      };
    }
  }

  return { isLocked: false };
}

