import { findLesson } from "./course";
import {
  isDiyLesson,
  isMainTaskAssignment,
  isSectionChapter,
  isTaskChapter,
  isTaskSubmissionAssignment,
} from "./course-phases";
import { withComputedDuration } from "./lesson-duration";
import { getLessonPdfUrl } from "./getLessonPdf";
import { SEED } from "./seed";
import { getSupabase } from "./supabase";
import { asLessonType, displayLessonType } from "./lesson-type";
import type { UserProfile } from "../types/database";
import type { CourseData, Lesson, LessonType } from "./types";

export interface StudentLesson {
  id: string;
  type: LessonType;
  title: string;
  chapterId: string;
  chapterTitle: string;
  duration?: string;
  seconds?: number;
  video_duration_seconds?: number;
  estimated_read_minutes?: number;
  duration_minutes?: number;
  video_url?: string;
  blurb?: string;
  body?: string[];
  takeaways?: string[];
  due?: string;
  brief?: string;
  requires_submission?: boolean;
  requires_coach_approval?: boolean;
  prereq_lesson_id?: string | null;
  pdf_url?: string;
  resource_downloads?: unknown;
  unlock_at?: string | null;
  survey_id?: string | null;
  survey_slug?: string | null;
  banner_image_url?: string | null;
  next: { id: string; title: string } | null;
  source: "supabase" | "seed";
}

export interface LessonProgress {
  completed: boolean;
  notes: string;
}

export interface OutlineLesson {
  id: string;
  title: string;
  type: LessonType;
  duration?: string;
  seconds?: number;
  video_duration_seconds?: number;
  estimated_read_minutes?: number;
  duration_minutes?: number;
  requires_submission?: boolean;
  requires_coach_approval?: boolean;
  prereq_lesson_id?: string | null;
  unlock_at?: string | null;
}

export interface OutlineChapter {
  id: string;
  title: string;
  summary?: string;
  lessons: OutlineLesson[];
}

export type StudentUser = Pick<UserProfile, "id" | "email" | "role" | "full_name">;

const OUTLINE_TTL_MS = 120_000;
const OUTLINE_STORAGE_KEY = "iac-course-outline-v1";

type OutlineCacheEntry = { at: number; data: OutlineChapter[] };
let memoryOutline: OutlineCacheEntry | null = null;

function firstVideoUrl(...values: unknown[]): string | undefined {
  const urls: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) urls.push(value.trim());
    else if (Array.isArray(value)) value.forEach(collect);
  };
  values.forEach(collect);
  return (
    urls.find(
      (url) =>
        url.includes("player.vimeo.com") ||
        url.includes("youtube.com") ||
        url.includes("youtu.be")
    ) || urls[0]
  );
}

function asStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\||\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return undefined;
}

function chapterTitle(chapterId: string): string {
  const chapter = SEED.chapters.find((c) => c.id === chapterId);
  return chapter ? chapter.title : chapterId;
}

function fromSeed(lessonId: string): StudentLesson | null {
  const hit = findLesson(SEED, lessonId);
  if (!hit || hit.id !== lessonId) return null;
  return packSeed(hit);
}

function packSeed(lesson: Lesson & { chapter: { id: string; title: string } }): StudentLesson {
  const ordered = SEED.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
  const index = ordered.findIndex((l) => l.id === lesson.id);
  const next = ordered[index + 1];
  const gates = outlineFromSeed()
    .flatMap((chapter) => chapter.lessons)
    .find((item) => item.id === lesson.id);
  const pdf_url = getLessonPdfUrl(lesson);
  return {
    id: lesson.id,
    type: displayLessonType({ ...lesson, pdf_url }),
    title: lesson.title,
    chapterId: lesson.chapter.id,
    chapterTitle: lesson.chapter.title,
    duration: lesson.duration,
    seconds: lesson.seconds,
    blurb: lesson.blurb,
    body: lesson.body,
    takeaways: lesson.takeaways,
    due: lesson.due,
    brief: lesson.brief,
    requires_submission: gates?.requires_submission ?? false,
    requires_coach_approval: Boolean(lesson.requires_coach_approval || gates?.requires_coach_approval),
    prereq_lesson_id: gates?.prereq_lesson_id || lesson.prereq_lesson_id || null,
    pdf_url,
    resource_downloads: lesson.resource_downloads,
    unlock_at: lesson.unlock_at || null,
    survey_id: lesson.survey_id || null,
    survey_slug: lesson.type === "survey" ? lesson.brief || null : null,
    banner_image_url: lesson.banner_image_url || null,
    next: next ? { id: next.id, title: next.title } : null,
    source: "seed",
  };
}

function numberOrUndef(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function asBool(value: unknown): boolean | undefined {
  if (value === true || value === false) return value;
  return undefined;
}

function asPrereq(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function outlineLessonFromRow(row: {
  id: string;
  title: string;
  type: string;
  duration?: string | null;
  seconds?: number | null;
  video_duration_seconds?: number | null;
  estimated_read_minutes?: number | null;
  duration_minutes?: number | null;
  requires_submission?: boolean | null;
  requires_coach_approval?: boolean | null;
  prereq_lesson_id?: string | null;
  unlock_at?: string | null;
}): OutlineLesson {
  const flagged = asBool(row.requires_submission);
  const lesson: OutlineLesson = {
    id: row.id,
    title: row.title,
    type: displayLessonType({
      type: asLessonType(row.type),
      title: row.title,
      requires_submission: flagged,
    }),
    duration: row.duration || undefined,
    seconds: numberOrUndef(row.seconds),
    video_duration_seconds: numberOrUndef(row.video_duration_seconds),
    estimated_read_minutes: numberOrUndef(row.estimated_read_minutes),
    duration_minutes: numberOrUndef(row.duration_minutes),
    requires_submission: Boolean(flagged),
    requires_coach_approval: asBool(row.requires_coach_approval) ?? false,
    prereq_lesson_id: asPrereq(row.prereq_lesson_id) || null,
    unlock_at: asPrereq(row.unlock_at) || null,
  };
  return withComputedDuration(lesson);
}

function withSubmissionPrereqs(chapters: OutlineChapter[]): OutlineChapter[] {
  const firstTask = chapters.findIndex((chapter) => isTaskChapter(chapter.title));
  const hasNamedPhases = chapters.some(
    (chapter) => isSectionChapter(chapter.title) || isTaskChapter(chapter.title)
  );

  const flagged = chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => {
      if (isDiyLesson(lesson.title)) return { ...lesson, requires_submission: false };
      if (isTaskSubmissionAssignment(chapter.title, lesson)) return { ...lesson, requires_submission: true };
      return lesson;
    }),
  }));

  let lastMainTaskId: string | null = null;
  let pendingPhase1Gate: string | null = null;
  const gated = new Map<string, OutlineLesson>();

  flagged.forEach((chapter, chapterIndex) => {
    const phase1Open = hasNamedPhases && (firstTask === -1 || chapterIndex < firstTask);
    chapter.lessons.forEach((lesson) => {
      if (phase1Open) {
        gated.set(lesson.id, { ...lesson, prereq_lesson_id: null });
        return;
      }

      let prereq_lesson_id: string | null = null;
      if (lastMainTaskId) prereq_lesson_id = lastMainTaskId;
      else if (pendingPhase1Gate) prereq_lesson_id = pendingPhase1Gate;

      const next = { ...lesson, prereq_lesson_id: prereq_lesson_id || null };
      gated.set(lesson.id, next);

      if (isMainTaskAssignment(chapter.title, next)) {
        lastMainTaskId = next.id;
        pendingPhase1Gate = null;
      } else if (!lastMainTaskId && (next.requires_submission || next.requires_coach_approval)) {
        pendingPhase1Gate = next.id;
      } else {
        pendingPhase1Gate = null;
      }
    });
  });

  return flagged.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => gated.get(lesson.id) || lesson),
  }));
}

export function courseDataFromOutline(outline: OutlineChapter[]): CourseData {
  return {
    company: "Accounting Study Advice",
    className: "IAC Skills Course",
    term: "",
    cohorts: [],
    liveSessions: SEED.liveSessions || [],
    chapters: outline.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary || "",
      lessons: chapter.lessons.map((lesson) => {
        const timed = withComputedDuration(lesson);
        return {
          id: timed.id,
          type: timed.type,
          title: timed.title,
          duration: timed.duration,
          seconds: timed.seconds,
          video_duration_seconds: timed.video_duration_seconds,
          estimated_read_minutes: timed.estimated_read_minutes,
          duration_minutes: timed.duration_minutes,
        };
      }),
    })),
    students: [],
    messages: {},
    chats: {},
  };
}

export function outlineFromSeed(): OutlineChapter[] {
  return withSubmissionPrereqs(
    SEED.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      lessons: chapter.lessons.map((lesson) =>
        outlineLessonFromRow({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          duration: lesson.duration,
          seconds: lesson.seconds,
          video_duration_seconds: lesson.video_duration_seconds,
          estimated_read_minutes: lesson.estimated_read_minutes,
          duration_minutes: lesson.duration_minutes,
          requires_submission: lesson.requires_submission,
          requires_coach_approval: lesson.requires_coach_approval,
          prereq_lesson_id: lesson.prereq_lesson_id,
        })
      ),
    }))
  );
}

const OUTLINE_COLUMNS =
  "id, title, type, duration, seconds, chapter_id, position, video_duration_seconds, estimated_read_minutes, duration_minutes";
const GATE_COLUMNS = `${OUTLINE_COLUMNS}, requires_submission, requires_coach_approval, prereq_lesson_id`;
const DRIP_COLUMNS = `${GATE_COLUMNS}, unlock_at`;

function readOutlineCache(): OutlineChapter[] | null {
  if (memoryOutline && Date.now() - memoryOutline.at < OUTLINE_TTL_MS) {
    return memoryOutline.data;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OUTLINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OutlineCacheEntry;
    if (!Array.isArray(parsed?.data) || Date.now() - parsed.at >= OUTLINE_TTL_MS) return null;
    memoryOutline = parsed;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeOutlineCache(data: OutlineChapter[]) {
  memoryOutline = { at: Date.now(), data };
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OUTLINE_STORAGE_KEY, JSON.stringify(memoryOutline));
  } catch {
    // Ignore quota errors; in-memory cache still covers this tab session.
  }
}

export function invalidateCourseOutline() {
  memoryOutline = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(OUTLINE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function nextFromOutline(outline: OutlineChapter[], lessonId: string): { id: string; title: string } | null {
  const list = outline.flatMap((chapter) => chapter.lessons);
  const index = list.findIndex((item) => item.id === lessonId);
  const next = index >= 0 ? list[index + 1] : undefined;
  return next ? { id: next.id, title: next.title } : null;
}

function applyOutlineGates(lesson: StudentLesson, outline: OutlineChapter[]): StudentLesson {
  const match = outline.flatMap((chapter) => chapter.lessons).find((item) => item.id === lesson.id);
  const chapter = outline.find((item) => item.id === lesson.chapterId);
  return {
    ...lesson,
    chapterTitle: chapter?.title || lesson.chapterTitle,
    requires_submission: Boolean(match?.requires_submission),
    requires_coach_approval: Boolean(match?.requires_coach_approval || lesson.requires_coach_approval),
    prereq_lesson_id: match?.prereq_lesson_id || null,
    unlock_at: match?.unlock_at || lesson.unlock_at || null,
    next: nextFromOutline(outline, lesson.id) || lesson.next,
  };
}

async function loadCourseOutlineUncached(): Promise<OutlineChapter[]> {
  const client = getSupabase();
  if (client) {
    let rows: Array<{
      id: string;
      title: string;
      type: string;
      duration?: string | null;
      seconds?: number | null;
      chapter_id: string;
      position?: number;
      video_duration_seconds?: number | null;
      estimated_read_minutes?: number | null;
      duration_minutes?: number | null;
      requires_submission?: boolean | null;
      requires_coach_approval?: boolean | null;
      prereq_lesson_id?: string | null;
      unlock_at?: string | null;
    }> | null = null;
    let { data, error } = await client
      .from("lessons")
      .select(DRIP_COLUMNS)
      .order("chapter_id", { ascending: true })
      .order("position", { ascending: true });
    rows = data;
    if (error) {
      const gated = await client
        .from("lessons")
        .select(GATE_COLUMNS)
        .order("chapter_id", { ascending: true })
        .order("position", { ascending: true });
      rows = gated.data;
      error = gated.error;
    }
    if (error) {
      const fallback = await client
        .from("lessons")
        .select(OUTLINE_COLUMNS)
        .order("chapter_id", { ascending: true })
        .order("position", { ascending: true });
      rows = fallback.data;
      error = fallback.error;
    }
    if (error) {
      const fallback = await client
        .from("lessons")
        .select("id, title, type, duration, seconds, chapter_id, position")
        .order("chapter_id", { ascending: true })
        .order("position", { ascending: true });
      rows = fallback.data;
      error = fallback.error;
    }
    if (!error && rows && rows.length) {
      const { data: chapterRows } = await client
        .from("chapters")
        .select("id, title, summary, position")
        .order("position", { ascending: true });
      const grouped = new Map<string, OutlineLesson[]>();
      rows.forEach((row) => {
        const list = grouped.get(row.chapter_id) || [];
        list.push(outlineLessonFromRow(row));
        grouped.set(row.chapter_id, list);
      });
      const chapterMeta = new Map((chapterRows || []).map((row) => [row.id, row]));
      const ids = chapterRows?.length ? chapterRows.map((row) => row.id) : [...grouped.keys()];
      const extra = [...grouped.keys()].filter((id) => !ids.includes(id));
      return withSubmissionPrereqs(
        [...ids, ...extra].filter((id) => grouped.has(id)).map((id) => {
          const lessons = grouped.get(id) || [];
          const live = chapterMeta.get(id);
          const seed = SEED.chapters.find((chapter) => chapter.id === id);
          return {
            id,
            title: live?.title || seed?.title || id,
            summary: live?.summary || seed?.summary,
            lessons,
          };
        })
      );
    }
  }
  return outlineFromSeed();
}

/** Shared course tree for the sidebar and lesson pages. Cached in-memory (and sessionStorage in the browser). */
export async function fetchCourseOutline(): Promise<OutlineChapter[]> {
  const cached = readOutlineCache();
  if (cached) return cached;
  const data = await loadCourseOutlineUncached();
  writeOutlineCache(data);
  return data;
}

export function studentUserFromAuth(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): StudentUser {
  const role = user.user_metadata?.role || user.app_metadata?.role || null;
  const fullName = user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email || null,
    role: role ? String(role) : null,
    full_name: typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
  };
}

export async function getStudentUser(): Promise<StudentUser | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return studentUserFromAuth(user);
}

export async function fetchCompletedLessonIds(userId: string): Promise<string[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("completed", true);
  return (data || []).map((row) => row.lesson_id);
}

/** Only allow in-app student paths through the login `next` query. */
export function safeStudentPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/student") || value.startsWith("//") || value.includes("://")) {
    return "/student";
  }
  return value;
}

const LESSON_ROW_COLUMNS =
  "id, title, type, duration, seconds, chapter_id, position, video_url, video_urls, blurb, body, takeaways, due, brief, requires_submission, requires_coach_approval, prereq_lesson_id, pdf_url, resource_downloads, unlock_at, video_duration_seconds, estimated_read_minutes, duration_minutes, survey_id, banner_image_url";

async function loadLessonRow(client: NonNullable<ReturnType<typeof getSupabase>>, lessonId: string) {
  const withPdf = await client.from("lessons").select(LESSON_ROW_COLUMNS).eq("id", lessonId).maybeSingle();
  if (!withPdf.error && withPdf.data) return withPdf;
  return client.from("lessons").select("*").eq("id", lessonId).maybeSingle();
}

/** Prefer the lessons table; fall back to the seeded course so local still works. */
export async function fetchStudentLesson(
  lessonId: string,
  outline?: OutlineChapter[]
): Promise<StudentLesson | null> {
  const tree = outline ?? (await fetchCourseOutline());
  const client = getSupabase();
  if (client) {
    const { data, error } = await loadLessonRow(client, lessonId);
    if (!error && data) {
      const pdf_url = getLessonPdfUrl({
        pdf_url: data.pdf_url,
        resource_downloads: data.resource_downloads,
      });
      return applyOutlineGates(
        {
          id: data.id,
          type: displayLessonType({
            type: asLessonType(data.type),
            title: data.title,
            pdf_url,
            requires_submission: asBool(data.requires_submission) ?? false,
          }),
          title: data.title,
          chapterId: data.chapter_id,
          chapterTitle: chapterTitle(data.chapter_id),
          duration: data.duration || undefined,
          seconds: data.seconds || undefined,
          video_duration_seconds: data.video_duration_seconds || undefined,
          estimated_read_minutes: data.estimated_read_minutes || undefined,
          duration_minutes: data.duration_minutes || undefined,
          video_url: firstVideoUrl(data.video_url, data.video_urls),
          blurb: data.blurb || undefined,
          body: asStringList(data.body),
          takeaways: asStringList(data.takeaways),
          due: data.due || undefined,
          brief: data.brief || undefined,
          requires_submission: asBool(data.requires_submission) ?? false,
          requires_coach_approval: asBool(data.requires_coach_approval) ?? false,
          prereq_lesson_id: asPrereq(data.prereq_lesson_id) || null,
          pdf_url,
          resource_downloads: data.resource_downloads,
          unlock_at: asPrereq(data.unlock_at) || null,
          survey_id: asPrereq((data as { survey_id?: unknown }).survey_id) || null,
          survey_slug: asLessonType(data.type) === "survey" ? String(data.brief || "").trim() || null : null,
          banner_image_url: asPrereq((data as { banner_image_url?: unknown }).banner_image_url) || null,
          next: nextFromOutline(tree, lessonId),
          source: "supabase",
        },
        tree
      );
    }
  }
  const seed = fromSeed(lessonId);
  return seed ? applyOutlineGates(seed, tree) : null;
}

export async function fetchLessonProgress(lessonId: string): Promise<{
  userId: string | null;
  email: string | null;
  progress: LessonProgress;
}> {
  const empty = { completed: false, notes: "" };
  const client = getSupabase();
  if (!client) return { userId: null, email: null, progress: empty };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user || null;
  if (!user) return { userId: null, email: null, progress: empty };

  const { data } = await client
    .from("lesson_progress")
    .select("completed, notes")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email || null,
    progress: {
      completed: Boolean(data?.completed),
      notes: data?.notes || "",
    },
  };
}

export async function saveLessonProgress(lessonId: string, progress: LessonProgress): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: "Sign in to save your progress." };

  const { error } = await client.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: lessonId,
    completed: progress.completed,
    notes: progress.notes,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutStudent(): Promise<void> {
  const { clearOnboardingSkipCookie } = await import("./onboarding");
  await clearOnboardingSkipCookie();
  const client = getSupabase();
  if (client) await client.auth.signOut();
}
