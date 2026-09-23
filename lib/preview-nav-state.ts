export function shouldMarkPreviewNav(entitlement: string | null, bypass: boolean): boolean {
  return !bypass && entitlement === "free_preview";
}

export function isPurchaseLockedLesson(lessonId: string, markPreviewNav: boolean, previewLessonIds: Iterable<string>): boolean {
  if (!markPreviewNav) return false;
  const preview = previewLessonIds instanceof Set ? previewLessonIds : new Set(previewLessonIds);
  return !preview.has(lessonId);
}
