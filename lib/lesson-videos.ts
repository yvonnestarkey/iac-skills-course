export interface LessonVideo {
  url: string;
  heading?: string;
  after?: string;
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Stable identity so the same Vimeo/YouTube clip is kept once, first occurrence wins. */
export function videoIdentity(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (host.includes("vimeo.com")) {
      const id = parts[0] === "video" ? parts[1] : parts[0];
      if (id && /^\d+$/.test(id)) return `vimeo:${id}`;
    }
    if (host === "youtu.be" && parts[0]) return `youtube:${parts[0]}`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : parsed.searchParams.get("v");
      if (id) return `youtube:${id}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed.replace(/\?.*$/, "");
  }
}

function videoFromUnknown(value: unknown): LessonVideo[] {
  if (typeof value === "string") {
    const url = value.trim();
    return url ? [{ url }] : [];
  }
  if (Array.isArray(value)) return value.flatMap(videoFromUnknown);
  if (!value || typeof value !== "object") return [];

  const row = value as Record<string, unknown>;
  const url = asTrimmed(row.url) || asTrimmed(row.src);
  if (!url) return [];

  const heading = asTrimmed(row.heading) || undefined;
  const after = asTrimmed(row.after) || undefined;
  return [{ url, ...(heading ? { heading } : {}), ...(after ? { after } : {}) }];
}

/** Parse mixed `video_urls` arrays; strings become `{ url }`. Dedupes by clip id, first wins. */
export function parseLessonVideos(...values: unknown[]): LessonVideo[] {
  const collected = values.flatMap(videoFromUnknown);
  const seen = new Set<string>();
  const videos: LessonVideo[] = [];
  for (const item of collected) {
    const key = videoIdentity(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    videos.push(item);
  }
  return videos;
}

export function firstLessonVideoUrl(...values: unknown[]): string | undefined {
  return parseLessonVideos(...values)[0]?.url;
}

export function isMultiVideoLesson(type: string | undefined, videos: LessonVideo[]): boolean {
  return type === "video" && (videos.length > 1 || Boolean(videos[0]?.heading));
}

/** Visible accordion label. Uses the stored heading when present; does not invent content titles. */
export function videoPartHeading(video: LessonVideo, index: number, total: number): string {
  const raw = (video.heading || "").replace(/\.mp4$/i, "").trim();
  const stripped = raw.replace(/^part\s+\d+(\s+of\s+\d+)?\s*[—–:-]\s*/i, "").trim();
  const title = stripped || raw;
  if (!title) return total > 1 ? `Part ${index + 1} of ${total}` : "Video";
  if (total === 1) return title;
  return `Part ${index + 1} of ${total} — ${title}`;
}
