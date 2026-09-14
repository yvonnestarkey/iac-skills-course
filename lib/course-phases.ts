import type { OutlineChapter, OutlineLesson } from "./student-lesson";

export type CoursePhaseId = "phase1" | "phase2";

export interface CoursePhase {
  id: CoursePhaseId;
  title: string;
  unit: "Sections" | "Tasks";
  chapters: OutlineChapter[];
}

export function asCompletedMap(completed: Record<string, boolean> | string[] | undefined): Record<string, boolean> {
  if (!completed) return {};
  if (Array.isArray(completed)) {
    const map: Record<string, boolean> = {};
    completed.forEach((id) => {
      map[id] = true;
    });
    return map;
  }
  return completed;
}

export function isSectionChapter(title: string): boolean {
  return /^S\d/i.test(title.trim());
}

export function isTaskChapter(title: string): boolean {
  return /^Task\b/i.test(title.trim());
}

export function splitCoursePhases(chapters: OutlineChapter[]): CoursePhase[] {
  const firstTask = chapters.findIndex((chapter) => isTaskChapter(chapter.title));
  let phase1 = firstTask === -1 ? chapters : chapters.slice(0, firstTask);
  let phase2 = firstTask === -1 ? [] : chapters.slice(firstTask);

  const hasNamedPhases = chapters.some((chapter) => isSectionChapter(chapter.title) || isTaskChapter(chapter.title));
  if (!hasNamedPhases && chapters.length > 1) {
    const mid = Math.max(1, Math.ceil(chapters.length / 2));
    phase1 = chapters.slice(0, mid);
    phase2 = chapters.slice(mid);
  }

  const phases: CoursePhase[] = [
    {
      id: "phase1",
      title: "Phase 1: Strategy & Study Methodologies",
      unit: "Sections",
      chapters: phase1,
    },
    {
      id: "phase2",
      title: "Phase 2: Tasks & Tools",
      unit: "Tasks",
      chapters: phase2,
    },
  ];
  return phases.filter((phase) => phase.chapters.length);
}

export function chapterProgress(chapter: OutlineChapter, completed: Record<string, boolean>): {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
} {
  const total = chapter.lessons.length;
  const done = chapter.lessons.filter((lesson) => completed[lesson.id]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
}

export function phaseProgress(phase: CoursePhase, completed: Record<string, boolean>): {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
} {
  const totals = phase.chapters.reduce(
    (sum, chapter) => {
      const next = chapterProgress(chapter, completed);
      return { done: sum.done + next.done, total: sum.total + next.total };
    },
    { done: 0, total: 0 }
  );
  return {
    ...totals,
    pct: totals.total ? Math.round((totals.done / totals.total) * 100) : 0,
    complete: totals.total > 0 && totals.done === totals.total,
  };
}

/** Completed chapters in a phase — used for “X of Y Sections/Tasks Completed”. */
export function phaseUnitProgress(phase: CoursePhase, completed: Record<string, boolean>): {
  done: number;
  total: number;
} {
  return {
    done: phase.chapters.filter((chapter) => chapterProgress(chapter, completed).complete).length,
    total: phase.chapters.length,
  };
}

/** A chapter is unlocked when every lesson before it in course order is complete. */
export function isChapterUnlocked(
  chapters: OutlineChapter[],
  chapterId: string,
  completed: Record<string, boolean>
): boolean {
  for (const chapter of chapters) {
    if (chapter.id === chapterId) return true;
    if (!chapterProgress(chapter, completed).complete) return false;
  }
  return true;
}

export function isPhaseUnlocked(phases: CoursePhase[], phaseId: CoursePhaseId, completed: Record<string, boolean>): boolean {
  const ordered = phases.flatMap((phase) => phase.chapters);
  const phase = phases.find((item) => item.id === phaseId);
  const first = phase?.chapters[0];
  if (!first) return true;
  return isChapterUnlocked(ordered, first.id, completed);
}

export function findResumeLesson(
  chapters: OutlineChapter[],
  completed: Record<string, boolean>
): { chapter: OutlineChapter; lesson: OutlineLesson } | null {
  for (const chapter of chapters) {
    const lesson = chapter.lessons.find((item) => !completed[item.id]);
    if (lesson) return { chapter, lesson };
  }
  const lastChapter = chapters[chapters.length - 1];
  const lastLesson = lastChapter?.lessons[lastChapter.lessons.length - 1];
  if (lastChapter && lastLesson) return { chapter: lastChapter, lesson: lastLesson };
  return null;
}

export function findLessonLocation(
  chapters: OutlineChapter[],
  lessonId: string | null | undefined
): { chapter: OutlineChapter; lesson: OutlineLesson } | null {
  if (!lessonId) return null;
  for (const chapter of chapters) {
    const lesson = chapter.lessons.find((item) => item.id === lessonId);
    if (lesson) return { chapter, lesson };
  }
  return null;
}
