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

export const STUDY_CLINIC_KINDS = ["video", "pdf", "link"] as const;

export type StudyClinicKind = (typeof STUDY_CLINIC_KINDS)[number];

export function isStudyClinicKind(value: string | null | undefined): value is StudyClinicKind {
  return STUDY_CLINIC_KINDS.includes(String(value || "") as StudyClinicKind);
}

export function inferStudyClinicKind(clip: {
  kind?: string | null;
  video_urls?: unknown;
  resource_url?: string | null;
}): StudyClinicKind {
  if (isStudyClinicKind(clip.kind)) return clip.kind;
  const resource = (clip.resource_url || "").trim();
  if (resource) return /\.pdf(\?|#|$)/i.test(resource) ? "pdf" : "link";
  return "video";
}

export function studyClinicKindLabel(kind: StudyClinicKind): string {
  if (kind === "pdf") return "PDF";
  if (kind === "link") return "Link";
  return "Video";
}

export type StudyClinicPage = {
  section: StudyClinicSectionId;
  intro: string;
  body: string;
};

export function defaultStudyClinicIntro(section: StudyClinicSectionId): string {
  if (section === "study-advice") {
    return "Short videos for the study problems that get in the way. Open the one you need.";
  }
  return "Resources for this library. Open the one you need.";
}

export function emptyStudyClinicPage(section: StudyClinicSectionId): StudyClinicPage {
  return { section, intro: "", body: "" };
}

export function studyClinicPageForSection(pages: StudyClinicPage[], section: StudyClinicSectionId): StudyClinicPage {
  return pages.find((page) => page.section === section) || emptyStudyClinicPage(section);
}

export function studyClinicIntro(page: StudyClinicPage | null | undefined, section: StudyClinicSectionId): string {
  const intro = (page?.intro || "").trim();
  return intro || defaultStudyClinicIntro(section);
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
  kind: StudyClinicKind;
  resource_url: string | null;
  resource_label: string | null;
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
  kind: StudyClinicKind;
  resourceUrl: string;
  resourceLabel: string;
};

export function clinicResourceHref(clip: StudyClinicClip): { href: string; external: boolean } | null {
  const kind = inferStudyClinicKind(clip);
  if (kind === "video") {
    const videos = parseLessonVideos(clip.video_urls);
    if (!videos.length) return null;
    return { href: studyClinicWatchHref(clip.id), external: false };
  }
  const url = (clip.resource_url || "").trim();
  if (!url) return null;
  return { href: url, external: true };
}

function db() {
  return getServiceSupabase() || getSupabase();
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asClip(row: Record<string, unknown>): StudyClinicClip | null {
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!id || !title) return null;
  const resource_url = asText(row.resource_url);
  return {
    id,
    title,
    duration: row.duration != null ? String(row.duration) : null,
    blurb: row.blurb != null ? String(row.blurb) : null,
    video_urls: row.video_urls ?? [],
    position: Number(row.position || 0),
    published: row.published !== false,
    section: inferStudyClinicSection({ id, title, section: row.section != null ? String(row.section) : null }),
    kind: inferStudyClinicKind({
      kind: row.kind != null ? String(row.kind) : null,
      video_urls: row.video_urls,
      resource_url,
    }),
    resource_url,
    resource_label: asText(row.resource_label),
  };
}

function asPage(row: Record<string, unknown>): StudyClinicPage | null {
  if (!isStudyClinicSectionId(String(row.section || ""))) return null;
  return {
    section: row.section as StudyClinicSectionId,
    intro: row.intro != null ? String(row.intro) : "",
    body: row.body != null ? String(row.body) : "",
  };
}

export function emptyClinicDraft(section?: StudyClinicSectionId): StudyClinicDraft {
  return {
    id: "",
    title: "",
    duration: "",
    blurb: "",
    videoUrlsText: "",
    position: "",
    published: true,
    section: section && isStudyClinicSectionId(section) ? section : DEFAULT_STUDY_CLINIC_SECTION,
    kind: "video",
    resourceUrl: "",
    resourceLabel: "",
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
    kind: inferStudyClinicKind(clip),
    resourceUrl: clip.resource_url || "",
    resourceLabel: clip.resource_label || "",
  };
}

export function slugifyClinicId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function clipFromDraft(draft: StudyClinicDraft): { clip?: StudyClinicClip; error?: string } {
  const title = draft.title.trim();
  const id = draft.id.trim() || slugifyClinicId(title);
  const videos = parseLessonVideos(draft.videoUrlsText.split(/\n/).map((line) => line.trim()).filter(Boolean));
  const resourceUrl = draft.resourceUrl.trim();
  const kind = inferStudyClinicKind({ kind: draft.kind, video_urls: videos, resource_url: resourceUrl });
  if (!title) return { error: "Title is required." };
  if (!id) return { error: "Give this resource an id or title." };
  if (kind === "video" && !videos.length) return { error: "Add at least one video URL." };
  if (kind === "pdf" && !resourceUrl) return { error: "Upload or paste a PDF URL." };
  if (kind === "link" && !resourceUrl) return { error: "Add a link URL." };
  return {
    clip: {
      id,
      title,
      duration: draft.duration.trim() || null,
      blurb: draft.blurb.trim() || null,
      video_urls: kind === "video" ? videos : [],
      position: Math.max(0, Number(draft.position) || 0),
      published: draft.published,
      section: inferStudyClinicSection({ id, title, section: draft.section }),
      kind,
      resource_url: kind === "video" ? null : resourceUrl,
      resource_label: kind === "link" ? draft.resourceLabel.trim() || null : null,
    },
  };
}

export function studyClinicMissingResourceSqlError(message: string | null | undefined): boolean {
  return /column .* (kind|resource_url|resource_label)/i.test(message || "") || /could not find the '(kind|resource_url|resource_label)'/i.test(message || "");
}

export function studyClinicMissingSectionSqlError(message: string | null | undefined): boolean {
  return /could not find the 'section'/i.test(message || "") || /column .*['"]section['"]/i.test(message || "");
}

export function studyClinicMissingPageSqlError(message: string | null | undefined): boolean {
  return /study_clinic_pages/i.test(message || "") && /does not exist|schema cache|relation/i.test(message || "");
}

export function mergeStudyClinicClips(
  current: StudyClinicClip[],
  incoming: StudyClinicClip[],
  preferSection?: StudyClinicSectionId
): StudyClinicClip[] {
  const byId = new Map<string, StudyClinicClip>();
  for (const clip of incoming) byId.set(clip.id, clip);
  for (const clip of current) {
    const existing = byId.get(clip.id);
    if (!existing) {
      if (preferSection && clip.section === preferSection) byId.set(clip.id, clip);
      continue;
    }
    const keepLocalSection = Boolean(preferSection) && clip.section === preferSection && existing.section !== preferSection;
    const keepLocalResource = Boolean(clip.resource_url) && !existing.resource_url;
    byId.set(clip.id, {
      ...existing,
      ...(keepLocalSection ? { section: clip.section } : {}),
      ...(keepLocalResource ? { kind: clip.kind, resource_url: clip.resource_url, resource_label: clip.resource_label } : {}),
    });
  }
  return [...byId.values()].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return left.title.localeCompare(right.title);
  });
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

export async function fetchStudyClinicPages(): Promise<StudyClinicPage[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client.from("study_clinic_pages").select("*");
  if (error || !data) return [];
  return data.map((row) => asPage(row as Record<string, unknown>)).filter((row): row is StudyClinicPage => Boolean(row));
}

export async function fetchStudyClinicPage(section: StudyClinicSectionId): Promise<StudyClinicPage> {
  const client = db();
  if (!client) return emptyStudyClinicPage(section);
  const { data, error } = await client.from("study_clinic_pages").select("*").eq("section", section).maybeSingle();
  if (error || !data) return emptyStudyClinicPage(section);
  return asPage(data as Record<string, unknown>) || emptyStudyClinicPage(section);
}
