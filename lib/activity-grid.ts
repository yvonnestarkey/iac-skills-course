import { lastActiveLabel } from "./course";
import { courseHasNamedPhases, splitCoursePhases } from "./course-phases";
import { formatSastDateTime, isoToSastDateAndTime, parsePortalTimestamp } from "./dates";
import { publishedOutline } from "./lesson-drafts";
import { activityLevel, type LessonEngagement } from "./lesson-progress";
import type { OutlineChapter } from "./student-lesson";

export type ActivityColumn = {
  id: string;
  lessonLabel: string;
  title: string;
  chapterId: string;
  chapterLabel: string;
  chapterTitle: string;
  phaseId: string;
  phaseLabel: string;
};

export type ActivityHeaderGroup = {
  key: string;
  label: string;
  title: string;
  span: number;
};

function shortChapterLabel(title: string, index: number): string {
  const match = title.trim().match(/^(S\d+|Task\s+\d+)/i);
  if (match) return match[1].replace(/\s+/, " ");
  return `Chapter ${index}`;
}

export function activityColumnsFromOutline(chapters: OutlineChapter[]): ActivityColumn[] {
  const columns: ActivityColumn[] = [];
  const namedPhases = courseHasNamedPhases(publishedOutline(chapters));
  splitCoursePhases(publishedOutline(chapters)).forEach((phase, phaseIndex) => {
    const phaseLabel = namedPhases ? `Phase ${phaseIndex + 1}` : "";
    phase.chapters.forEach((chapter, chapterIndex) => {
      const chapterLabel = shortChapterLabel(chapter.title || chapter.id, chapterIndex + 1);
      (chapter.lessons || []).forEach((lesson, lessonIndex) => {
        columns.push({
          id: lesson.id,
          lessonLabel: `L${lessonIndex + 1}`,
          title: lesson.title,
          chapterId: chapter.id,
          chapterLabel,
          chapterTitle: chapter.title || chapter.id,
          phaseId: phase.id,
          phaseLabel,
        });
      });
    });
  });
  return columns;
}

export function activityHeaderGroups(columns: ActivityColumn[]): {
  phases: ActivityHeaderGroup[];
  chapters: ActivityHeaderGroup[];
} {
  const phases: ActivityHeaderGroup[] = [];
  const chapters: ActivityHeaderGroup[] = [];
  columns.forEach((column) => {
    const lastPhase = phases[phases.length - 1];
    if (lastPhase && lastPhase.key === column.phaseId) lastPhase.span += 1;
    else phases.push({ key: column.phaseId, label: column.phaseLabel, title: column.phaseLabel, span: 1 });

    const chapterKey = `${column.phaseId}:${column.chapterId}`;
    const lastChapter = chapters[chapters.length - 1];
    if (lastChapter && lastChapter.key === chapterKey) lastChapter.span += 1;
    else {
      chapters.push({
        key: chapterKey,
        label: column.chapterLabel,
        title: column.chapterTitle,
        span: 1,
      });
    }
  });
  return { phases, chapters };
}

export function currentActivityPosition(
  columns: ActivityColumn[],
  lessons: LessonEngagement[] | undefined
): {
  last?: ActivityColumn;
  lastItem?: LessonEngagement;
  current?: ActivityColumn;
} {
  const byId = new Map((lessons || []).map((item) => [item.lessonId, item]));
  let last: ActivityColumn | undefined;
  let lastItem: LessonEngagement | undefined;
  let lastCompleteIndex = -1;
  columns.forEach((column, index) => {
    const item = byId.get(column.id);
    if (!item?.opened) return;
    last = column;
    lastItem = item;
    if (activityLevel(item) === "complete") lastCompleteIndex = index;
  });
  const current = columns.find((column, index) => {
    if (index <= lastCompleteIndex) return false;
    return activityLevel(byId.get(column.id)) !== "complete";
  });
  return { last, lastItem, current: current || last };
}

const LEVEL_WEIGHT: Record<ReturnType<typeof activityLevel>, number> = {
  none: 0,
  click: 0.18,
  partial: 0.55,
  complete: 1,
};

export type EngagementHeat = {
  score: number;
  complete: number;
  opened: number;
  total: number;
  background: string;
  label: string;
};

/** Name-cell colour: red with little progress, green when they are completing work. */
export function engagementHeat(
  columns: Array<{ id: string }>,
  byLesson: Record<string, LessonEngagement>
): EngagementHeat {
  const total = columns.length;
  if (!total) {
    return { score: 0, complete: 0, opened: 0, total: 0, background: "var(--card)", label: "No published lessons" };
  }
  let complete = 0;
  let opened = 0;
  let weight = 0;
  columns.forEach((column) => {
    const level = activityLevel(byLesson[column.id]);
    if (level !== "none") opened += 1;
    if (level === "complete") complete += 1;
    weight += LEVEL_WEIGHT[level];
  });
  const score = weight / total;
  const hue = Math.round(score * 142);
  const sat = 72 + Math.round(score * 6);
  const light = 86 - Math.round(score * 8);
  return {
    score,
    complete,
    opened,
    total,
    background: `hsl(${hue} ${sat}% ${light}%)`,
    label: `${complete} of ${total} complete · ${opened} opened`,
  };
}

function stamp(value: string | null | undefined): number {
  if (!value) return 0;
  return parsePortalTimestamp(value)?.getTime() || 0;
}

/** Latest of profile last-active and any lesson open — last time they were in the course. */
export function lastCourseVisitAt(
  lastActive: string | null | undefined,
  byLesson: Record<string, LessonEngagement>
): string | null {
  let latest = lastActive || null;
  let latestMs = stamp(latest);
  Object.values(byLesson).forEach((item) => {
    const value = item.lastOpenedAt || item.openedAt;
    if (!value) return;
    const ms = stamp(value);
    if (ms >= latestMs) {
      latest = value;
      latestMs = ms;
    }
  });
  return latest;
}

export function lastCourseVisitLabel(at: string | null): { text: string; title: string } {
  if (!at) return { text: "unknown", title: "No course visit recorded" };
  const sastDate = isoToSastDateAndTime(at).date || at.slice(0, 10);
  const text = lastActiveLabel({ lastActive: sastDate });
  const timed = /T|\d{2}:\d{2}/.test(at) ? formatSastDateTime(at) : "";
  return { text, title: timed || text };
}
