import type { OutlineChapter, OutlineLesson } from "@/lib/student-lesson";

const CLINIC_CHAPTER_ID = "ch11";

export function isStudyClinicChapter(chapter: { id?: string | null; title?: string | null }): boolean {
  const title = (chapter.title || "").trim();
  if (/common\s+(fixes|challenges)/i.test(title) || /fixes for common/i.test(title)) return true;
  return chapter.id === CLINIC_CHAPTER_ID;
}

export function findStudyClinicChapter(outline: OutlineChapter[] | null | undefined): OutlineChapter | null {
  return (outline || []).find((chapter) => isStudyClinicChapter(chapter)) || null;
}

export function studyClinicVideos(outline: OutlineChapter[] | null | undefined): OutlineLesson[] {
  const chapter = findStudyClinicChapter(outline);
  return (chapter?.lessons || []).filter((lesson) => lesson.type === "video");
}

export function isStudyClinicVideo(outline: OutlineChapter[] | null | undefined, lessonId: string): boolean {
  return studyClinicVideos(outline).some((lesson) => lesson.id === lessonId);
}
