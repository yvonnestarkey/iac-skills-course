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

function isThinkificLessonPage(url: string): boolean {
  return /\/courses\/take\//i.test(url) || /thinkific\.com/i.test(url);
}

function firstResourceFileUrl(value: unknown): string | undefined {
  const list = asDownloadList(value);
  if (!list.length) return undefined;
  const first = list[0];
  const url =
    typeof first === "string"
      ? asPdfUrl(first)
      : first && typeof first === "object"
        ? asPdfUrl((first as Record<string, unknown>).file_url ?? (first as Record<string, unknown>).url ?? (first as Record<string, unknown>).href ?? (first as Record<string, unknown>).download_url)
        : undefined;
  if (!url || isThinkificLessonPage(url)) return undefined;
  return url;
}

/**
 * Same PDF for student lessons and coach preview.
 * Prefer the pasted public `pdf_url`; only then use the first resource download.
 * Never fall back to a Thinkific lesson page.
 */
export function getLessonPdfUrl(lesson: LessonPdfSource | null | undefined): string | undefined {
  if (!lesson) return undefined;
  const primary = asPdfUrl(lesson.pdf_url);
  if (primary) return primary;
  return firstResourceFileUrl(lesson.resource_downloads);
}

/** First non-PDF resource link on a lesson, for "open this URL" buttons. */
export function firstLessonWebLink(lesson: LessonPdfSource | null | undefined): { url: string; title: string } | null {
  if (!lesson) return null;
  for (const item of asDownloadList(lesson.resource_downloads)) {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const raw = typeof item === "string" ? item : String(record?.url ?? record?.href ?? record?.file_url ?? "");
    if (!raw.trim() || /\.pdf(\?|#|$)/i.test(raw)) continue;
    const title = String(record?.title ?? record?.label ?? "").trim();
    return { url: raw.trim(), title: title || "Open link" };
  }
  return null;
}
