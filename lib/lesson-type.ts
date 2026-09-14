import type { LessonType } from "./types";

const LESSON_TYPES: LessonType[] = ["video", "reading", "assignment", "upload", "ask", "survey", "download"];

export function asLessonType(value: string | null | undefined): LessonType {
  const type = String(value || "").toLowerCase();
  return LESSON_TYPES.includes(type as LessonType) ? (type as LessonType) : "reading";
}

/** Treat resource PDFs as downloads even if the row is still stored as upload. */
export function displayLessonType(lesson: {
  type?: string | null;
  title?: string | null;
  pdf_url?: string | null;
  requires_submission?: boolean | null;
}): LessonType {
  const type = asLessonType(lesson.type);
  if (type === "download") return "download";
  const title = lesson.title || "";
  const looksLikeStudentFile = /upload|submission/i.test(title);
  if (type === "upload" && !lesson.requires_submission && (lesson.pdf_url || !looksLikeStudentFile)) {
    return "download";
  }
  return type;
}

export function lessonTypeLabel(type: string): string {
  switch (displayLessonType({ type })) {
    case "download":
      return "Resource download";
    case "upload":
    case "assignment":
      return "File uploads";
    case "video":
      return "Video";
    case "reading":
      return "Reading";
    case "ask":
      return "Ask your coach";
    case "survey":
      return "Check-in";
    default:
      return type.replace(/[_-]+/g, " ");
  }
}
