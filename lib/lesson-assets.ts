import { listPreviewLessonIds, stripProtectedLesson } from "@/lib/commerce";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const PUBLIC_TEACHING_BUCKET = "course-pdfs";
export const PRIVATE_TEACHING_BUCKET = "course-teaching";
export const SIGNED_URL_SECONDS = 60 * 60;

const STUDENT_PREFIXES = ["assignment-submissions/", "exam-attempts/", "survey-responses/"];

export function parseCourseStorageRef(url: string): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/i);
  if (!match) return null;
  return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
}

export function isStudentUploadPath(path: string): boolean {
  return STUDENT_PREFIXES.some((prefix) => path.startsWith(prefix));
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

function urlFromDownloadItem(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const raw = record.file_url ?? record.url ?? record.href ?? record.download_url;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  return null;
}

function collectLessonUrls(lesson: { pdf_url?: unknown; resource_downloads?: unknown }): string[] {
  const urls: string[] = [];
  if (typeof lesson.pdf_url === "string" && lesson.pdf_url.trim()) urls.push(lesson.pdf_url.trim());
  for (const item of asDownloadList(lesson.resource_downloads)) {
    const url = urlFromDownloadItem(item);
    if (url) urls.push(url);
  }
  return urls;
}

async function previewStorageKeys(): Promise<Set<string>> {
  const client = getServiceSupabase();
  const keys = new Set<string>();
  if (!client) return keys;
  const previewIds = await listPreviewLessonIds();
  if (!previewIds.length) return keys;
  const { data } = await client.from("lessons").select("pdf_url, resource_downloads").in("id", previewIds);
  for (const row of data || []) {
    for (const url of collectLessonUrls(row)) {
      const ref = parseCourseStorageRef(url);
      if (ref && !isStudentUploadPath(ref.path)) keys.add(`${ref.bucket}:${ref.path}`);
    }
  }
  return keys;
}

let privateBucketReadyPromise: Promise<boolean> | null = null;

export async function privateTeachingBucketReady(): Promise<boolean> {
  if (privateBucketReadyPromise) return privateBucketReadyPromise;
  privateBucketReadyPromise = (async () => {
    const client = getServiceSupabase();
    if (!client) return false;
    const { data, error } = await client.storage.getBucket(PRIVATE_TEACHING_BUCKET);
    return Boolean(data) && !error;
  })();
  const ready = await privateBucketReadyPromise;
  if (!ready) privateBucketReadyPromise = null;
  return ready;
}

async function objectExists(bucket: string, path: string): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client) return false;
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const name = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  const { data } = await client.storage.from(bucket).list(folder, { search: name, limit: 100 });
  return Boolean(data?.some((item) => item.name === name));
}

async function migratePaidTeachingObject(path: string, previewKeys: Set<string>): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client) return false;
  const alreadyPrivate = await objectExists(PRIVATE_TEACHING_BUCKET, path);
  if (!alreadyPrivate) {
    const downloaded = await client.storage.from(PUBLIC_TEACHING_BUCKET).download(path);
    if (downloaded.error || !downloaded.data) return false;
    const uploaded = await client.storage.from(PRIVATE_TEACHING_BUCKET).upload(path, downloaded.data, { upsert: true });
    if (uploaded.error) return false;
  }
  const usedByPreview = previewKeys.has(`${PUBLIC_TEACHING_BUCKET}:${path}`) || previewKeys.has(`${PRIVATE_TEACHING_BUCKET}:${path}`);
  if (!usedByPreview) {
    await client.storage.from(PUBLIC_TEACHING_BUCKET).remove([path]);
  }
  return true;
}

async function signedTeachingUrl(path: string): Promise<string | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data, error } = await client.storage.from(PRIVATE_TEACHING_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function resolveTeachingUrl(url: string, options: { preview: boolean; canRead: boolean; previewKeys: Set<string> }): Promise<string | null> {
  const ref = parseCourseStorageRef(url);
  if (!ref || isStudentUploadPath(ref.path)) {
    return options.canRead ? url : null;
  }
  if (options.preview) {
    return options.canRead ? url : null;
  }
  if (!(await privateTeachingBucketReady())) {
    return options.canRead ? url : null;
  }
  const migrated = await migratePaidTeachingObject(ref.path, options.previewKeys);
  if (!options.canRead) return null;
  if (!migrated) return null;
  return (await signedTeachingUrl(ref.path)) || null;
}

function rewriteDownloadItem(item: unknown, nextUrl: string | null): unknown {
  if (!nextUrl) return null;
  if (typeof item === "string") return nextUrl;
  if (item && typeof item === "object") {
    const record = { ...(item as Record<string, unknown>) };
    if ("file_url" in record) record.file_url = nextUrl;
    else if ("url" in record) record.url = nextUrl;
    else if ("href" in record) record.href = nextUrl;
    else if ("download_url" in record) record.download_url = nextUrl;
    else record.url = nextUrl;
    return record;
  }
  return nextUrl;
}

export async function protectLessonResourceFields<T extends Record<string, unknown>>(
  lesson: T,
  options: { canRead: boolean; preview: boolean }
): Promise<T> {
  const previewKeys = options.preview ? new Set<string>() : await previewStorageKeys();
  const pdfUrl = typeof lesson.pdf_url === "string" ? lesson.pdf_url : null;
  const nextPdf = pdfUrl ? await resolveTeachingUrl(pdfUrl, { ...options, previewKeys }) : null;
  const downloads = asDownloadList(lesson.resource_downloads);
  const nextDownloads: unknown[] = [];
  for (const item of downloads) {
    const url = urlFromDownloadItem(item);
    if (!url) continue;
    const resolved = await resolveTeachingUrl(url, { ...options, previewKeys });
    const rewritten = rewriteDownloadItem(item, resolved);
    if (rewritten) nextDownloads.push(rewritten);
  }
  const withResolved = {
    ...lesson,
    pdf_url: nextPdf,
    resource_downloads: nextDownloads.length ? nextDownloads : null,
  };
  return options.canRead ? withResolved : stripProtectedLesson(withResolved);
}
