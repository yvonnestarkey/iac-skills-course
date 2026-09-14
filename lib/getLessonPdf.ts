import { asPdfUrl } from "./lesson-resources";

export interface LessonPdfSource {
  pdf_url?: unknown;
  resource_downloads?: unknown;
}

function asDownloadList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text) as unknown;
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [text];
      }
    }
    return [text];
  }
  if (value && typeof value === "object") return [value];
  return [];
}

function firstResourceFileUrl(value: unknown): string | undefined {
  const list = asDownloadList(value);
  if (!list.length) return undefined;
  const first = list[0];
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
