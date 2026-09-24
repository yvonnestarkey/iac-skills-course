import type { OutlineChapter, OutlineLesson } from "@/lib/student-lesson";

type PreviewRule = {
  match: RegExp;
  all?: boolean;
  lessonNumbers?: readonly number[];
  excludeExtra?: boolean;
};

/** Authoritative free-preview selection. Resolved against the live outline, never hardcoded IDs. */
export const PREVIEW_SELECTION: readonly PreviewRule[] = [
  { match: /^S1\b/i, all: true },
  { match: /^S2\b/i, lessonNumbers: [1, 2, 3, 4] },
  { match: /^S3\b/i, lessonNumbers: [4] },
  { match: /^Task\s+1\b/i, excludeExtra: true, lessonNumbers: [1, 2] },
  { match: /^Fixes\b/i, lessonNumbers: [1] },
  { match: /^Task\s+2\b/i, excludeExtra: true, lessonNumbers: [1] },
  { match: /^Task\s+3\b/i, excludeExtra: true, lessonNumbers: [1, 2] },
  { match: /^Task\s+4\b/i, excludeExtra: true, lessonNumbers: [1, 2] },
  { match: /^Task\s+5\b/i, excludeExtra: true, lessonNumbers: [1] },
  { match: /^Task\s+6\b/i, excludeExtra: true, lessonNumbers: [1] },
];

export function titledLessonNumber(title: string): number | null {
  const match = String(title || "").trim().match(/^L(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function chapterMatches(title: string, rule: PreviewRule): boolean {
  const trimmed = title.trim();
  if (rule.excludeExtra && /\bExtra\b/i.test(trimmed)) return false;
  return rule.match.test(trimmed);
}

function selectPreviewLessons(chapter: OutlineChapter, rule: PreviewRule): OutlineLesson[] {
  const lessons = chapter.lessons || [];
  if (rule.all) return lessons;
  const wanted = new Set(rule.lessonNumbers || []);
  return lessons.filter((lesson) => {
    const number = titledLessonNumber(lesson.title);
    return number != null && wanted.has(number);
  });
}

export function resolvePreviewLessonIds(chapters: OutlineChapter[] | null | undefined): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const rule of PREVIEW_SELECTION) {
    const chapter = (chapters || []).find((item) => chapterMatches(item.title || "", rule));
    if (!chapter) continue;
    for (const lesson of selectPreviewLessons(chapter, rule)) {
      if (seen.has(lesson.id)) continue;
      seen.add(lesson.id);
      ids.push(lesson.id);
    }
  }
  return ids;
}

export function isPreviewLessonId(lessonId: string, previewLessonIds: Iterable<string>): boolean {
  const preview = previewLessonIds instanceof Set ? previewLessonIds : new Set(previewLessonIds);
  return preview.has(lessonId);
}
