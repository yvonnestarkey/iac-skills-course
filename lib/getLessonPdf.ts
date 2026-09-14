import { asPdfUrl } from "./lesson-resources";

export interface LessonPdfSource {
  pdf_url?: unknown;
  resource_downloads?: unknown;
}

function firstResourceFileUrl(value: unknown): string | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const first = value[0];
  if (typeof first === "string") return asPdfUrl(first);
  if (!first || typeof first !== "object") return undefined;
  const row = first as Record<string, unknown>;
  return asPdfUrl(row.file_url ?? row.url ?? row.href ?? row.download_url);
}

/**
 * Same PDF for student lessons and coach preview.
 * Prefer the pasted public `pdf_url`; only then use the first resource download.
 */
export function getLessonPdfUrl(lesson: LessonPdfSource | null | undefined): string | undefined {
  if (!lesson) return undefined;
  return asPdfUrl(lesson.pdf_url) || firstResourceFileUrl(lesson.resource_downloads);
}
