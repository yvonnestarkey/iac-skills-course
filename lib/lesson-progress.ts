/** Shared rules for lesson opens, video watch, submissions, and coach completion. */

export const VIDEO_COMPLETE_PERCENT = 80;

export type ProgressReason = "marked" | "watched" | "submitted";

export type LessonProgressRow = {
  user_id: string;
  lesson_id: string;
  completed?: boolean | null;
  opened_at?: string | null;
  last_opened_at?: string | null;
  video_seconds?: number | null;
  video_percent?: number | null;
  notes?: string | null;
  updated_at?: string | null;
};

export type SubmissionProgressRow = {
  student_id: string;
  lesson_id: string;
};

export type LessonEngagement = {
  lessonId: string;
  opened: boolean;
  openedAt: string | null;
  lastOpenedAt: string | null;
  completed: boolean;
  markedComplete: boolean;
  videoPercent: number;
  videoSeconds: number;
  submitted: boolean;
  hasNotes: boolean;
  reasons: ProgressReason[];
};

export type StudentProgressView = {
  completed: string[];
  opened: string[];
  lessons: LessonEngagement[];
};

export type CoachProgressBundle = {
  lessonIds: string[];
  byUser: Record<string, StudentProgressView>;
};

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function watchedEnough(percent: unknown): boolean {
  return asInt(percent) >= VIDEO_COMPLETE_PERCENT;
}

export function engagementReasons(input: {
  markedComplete?: boolean;
  videoPercent?: number;
  submitted?: boolean;
}): ProgressReason[] {
  const reasons: ProgressReason[] = [];
  if (input.markedComplete) reasons.push("marked");
  if (watchedEnough(input.videoPercent)) reasons.push("watched");
  if (input.submitted) reasons.push("submitted");
  return reasons;
}

export function describeProgressReasons(reasons: ProgressReason[]): string {
  if (!reasons.length) return "Opened only";
  const labels: Record<ProgressReason, string> = {
    marked: "Marked complete",
    watched: `Watched ${VIDEO_COMPLETE_PERCENT}%`,
    submitted: "Submitted work",
  };
  return reasons.map((reason) => labels[reason]).join(" · ");
}

export function buildLessonEngagement(
  lessonId: string,
  row?: LessonProgressRow | null,
  submitted = false
): LessonEngagement {
  const markedComplete = Boolean(row?.completed);
  const videoPercent = Math.min(100, asInt(row?.video_percent));
  const reasons = engagementReasons({ markedComplete, videoPercent, submitted });
  const openedAt = row?.opened_at || row?.updated_at || null;
  return {
    lessonId,
    opened: Boolean(row || submitted),
    openedAt,
    lastOpenedAt: row?.last_opened_at || openedAt,
    completed: reasons.length > 0,
    markedComplete,
    videoPercent,
    videoSeconds: asInt(row?.video_seconds),
    submitted,
    hasNotes: Boolean(String(row?.notes || "").trim()),
    reasons,
  };
}

export function assembleStudentProgress(input: {
  lessonIds: string[];
  progress: LessonProgressRow[];
  submissions: SubmissionProgressRow[];
}): CoachProgressBundle {
  const lessonIds = [...new Set(input.lessonIds.map(String).filter(Boolean))];
  const live = new Set(lessonIds);
  const byUser: Record<string, { rows: Map<string, LessonProgressRow>; submitted: Set<string> }> = {};

  const bucket = (userId: string) => {
    if (!byUser[userId]) byUser[userId] = { rows: new Map(), submitted: new Set() };
    return byUser[userId];
  };

  input.progress.forEach((row) => {
    const userId = String(row.user_id || "");
    const lessonId = String(row.lesson_id || "");
    if (!userId || !lessonId) return;
    bucket(userId).rows.set(lessonId, row);
  });

  input.submissions.forEach((row) => {
    const userId = String(row.student_id || "");
    const lessonId = String(row.lesson_id || "");
    if (!userId || !lessonId) return;
    bucket(userId).submitted.add(lessonId);
  });

  const views: Record<string, StudentProgressView> = {};
  Object.entries(byUser).forEach(([userId, data]) => {
    const lessonSet = new Set([...data.rows.keys(), ...data.submitted]);
    const lessons = [...lessonSet]
      .map((lessonId) => buildLessonEngagement(lessonId, data.rows.get(lessonId), data.submitted.has(lessonId)))
      .sort((a, b) => a.lessonId.localeCompare(b.lessonId));
    views[userId] = {
      completed: lessons.filter((item) => item.completed && (!live.size || live.has(item.lessonId))).map((item) => item.lessonId),
      opened: lessons.filter((item) => item.opened && (!live.size || live.has(item.lessonId))).map((item) => item.lessonId),
      lessons,
    };
  });

  return { lessonIds, byUser: views };
}

export function emptyStudentProgress(): StudentProgressView {
  return { completed: [], opened: [], lessons: [] };
}
