import { getSupabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { parseLessonVideos } from "@/lib/lesson-videos";

/** Old Common Fixes chapter. Those videos now live in study_clinic, not the course. */
export function isRetiredCourseChapter(chapter: { id?: string | null; title?: string | null }): boolean {
  const id = String(chapter.id || "");
  const title = (chapter.title || "").trim();
  if (id === "ch11") return true;
  return /common\s+(fixes|challenges)/i.test(title) || /fixes for common/i.test(title);
}

export function withoutRetiredChapters<T extends { id?: string | null; title?: string | null }>(chapters: T[] | null | undefined): T[] {
  return (chapters || []).filter((chapter) => !isRetiredCourseChapter(chapter));
}

export type StudyClinicClip = {
  id: string;
  title: string;
  duration: string | null;
  blurb: string | null;
  video_urls: unknown;
  position: number;
  published: boolean;
};

export type StudyClinicDraft = {
  id: string;
  title: string;
  duration: string;
  blurb: string;
  videoUrlsText: string;
  position: string;
  published: boolean;
};

function db() {
  return getServiceSupabase() || getSupabase();
}

function asClip(row: Record<string, unknown>): StudyClinicClip | null {
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!id || !title) return null;
  return {
    id,
    title,
    duration: row.duration != null ? String(row.duration) : null,
    blurb: row.blurb != null ? String(row.blurb) : null,
    video_urls: row.video_urls ?? [],
    position: Number(row.position || 0),
    published: row.published !== false,
  };
}

export function emptyClinicDraft(): StudyClinicDraft {
  return {
    id: "",
    title: "",
    duration: "",
    blurb: "",
    videoUrlsText: "",
    position: "",
    published: true,
  };
}

export function draftFromClip(clip: StudyClinicClip): StudyClinicDraft {
  const videos = parseLessonVideos(clip.video_urls);
  return {
    id: clip.id,
    title: clip.title,
    duration: clip.duration || "",
    blurb: clip.blurb || "",
    videoUrlsText: videos.map((video) => video.url).join("\n"),
    position: clip.position ? String(clip.position) : "",
    published: clip.published,
  };
}

export function slugifyClinicId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function clipFromDraft(draft: StudyClinicDraft): { clip?: Omit<StudyClinicClip, "published"> & { published: boolean }; error?: string } {
  const title = draft.title.trim();
  const id = draft.id.trim() || slugifyClinicId(title);
  const videos = parseLessonVideos(draft.videoUrlsText.split(/\n/).map((line) => line.trim()).filter(Boolean));
  if (!title) return { error: "Title is required." };
  if (!id) return { error: "Give the video an id or title." };
  if (!videos.length) return { error: "Add at least one video URL." };
  return {
    clip: {
      id,
      title,
      duration: draft.duration.trim() || null,
      blurb: draft.blurb.trim() || null,
      video_urls: videos,
      position: Math.max(0, Number(draft.position) || 0),
      published: draft.published,
    },
  };
}

export async function fetchStudyClinicClips(options?: { includeDrafts?: boolean }): Promise<StudyClinicClip[]> {
  const client = db();
  if (!client) return [];
  let query = client.from("study_clinic").select("*").order("position", { ascending: true }).order("title", { ascending: true });
  if (!options?.includeDrafts) query = query.eq("published", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => asClip(row as Record<string, unknown>)).filter((row): row is StudyClinicClip => Boolean(row));
}

export async function fetchStudyClinicClip(id: string, options?: { includeDrafts?: boolean }): Promise<StudyClinicClip | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client.from("study_clinic").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const clip = asClip(data as Record<string, unknown>);
  if (!clip) return null;
  if (!options?.includeDrafts && !clip.published) return null;
  return clip;
}
