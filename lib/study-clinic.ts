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

export const STUDY_CLINIC_SECTION_IDS = [
  "financial-reporting",
  "auditing",
  "financial-management",
  "taxation",
  "study-advice",
] as const;

export type StudyClinicSectionId = (typeof STUDY_CLINIC_SECTION_IDS)[number];

export type StudyClinicSection = {
  id: StudyClinicSectionId;
  title: string;
  image: string;
};

export const STUDY_CLINIC_SECTIONS: StudyClinicSection[] = [
  { id: "financial-reporting", title: "Financial Reporting", image: "/study-clinic/financial-reporting.jpg" },
  { id: "auditing", title: "Auditing", image: "/study-clinic/auditing.jpg" },
  { id: "financial-management", title: "Financial Management", image: "/study-clinic/financial-management.jpg" },
  { id: "taxation", title: "Taxation", image: "/study-clinic/taxation.jpg" },
  { id: "study-advice", title: "Study Advice", image: "/study-clinic/study-advice.jpg" },
];

export const DEFAULT_STUDY_CLINIC_SECTION: StudyClinicSectionId = "study-advice";

export function isStudyClinicSectionId(value: string | null | undefined): value is StudyClinicSectionId {
  return STUDY_CLINIC_SECTION_IDS.includes(String(value || "") as StudyClinicSectionId);
}

export function studyClinicSectionById(id: string | null | undefined): StudyClinicSection | null {
  return STUDY_CLINIC_SECTIONS.find((section) => section.id === id) || null;
}

export function inferStudyClinicSection(clip: { id?: string | null; title?: string | null; section?: string | null }): StudyClinicSectionId {
  if (isStudyClinicSectionId(clip.section)) return clip.section;
  const blob = `${clip.id || ""} ${clip.title || ""}`;
  if (/\bfinman\b|financial management|struggle with finman/i.test(blob)) return "financial-management";
  return DEFAULT_STUDY_CLINIC_SECTION;
}

export function clipsForStudyClinicSection(clips: StudyClinicClip[], section: StudyClinicSectionId): StudyClinicClip[] {
  return clips.filter((clip) => inferStudyClinicSection(clip) === section);
}

export function studyClinicSectionHref(section: StudyClinicSectionId): string {
  return `/student/study-clinic/${section}`;
}

export function studyClinicWatchHref(clipId: string): string {
  return `/student/study-clinic/${clipId}`;
}

export type StudyClinicClip = {
  id: string;
  title: string;
  duration: string | null;
  blurb: string | null;
  video_urls: unknown;
  position: number;
  published: boolean;
  section: StudyClinicSectionId;
};

export type StudyClinicDraft = {
  id: string;
  title: string;
  duration: string;
  blurb: string;
  videoUrlsText: string;
  position: string;
  published: boolean;
  section: StudyClinicSectionId;
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
    section: inferStudyClinicSection({ id, title, section: row.section != null ? String(row.section) : null }),
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
    section: DEFAULT_STUDY_CLINIC_SECTION,
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
    section: inferStudyClinicSection(clip),
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
      section: inferStudyClinicSection({ id, title, section: draft.section }),
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
