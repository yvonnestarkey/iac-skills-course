import { courseHasNamedPhases, splitCoursePhases } from "./course-phases";
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
