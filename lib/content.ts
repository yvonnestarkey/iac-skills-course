import { allLessons } from "./course";
import { fetchSurveyAssignmentFlags } from "./custom-surveys";
import { lessonIsAssignment } from "./lesson-type";
import { getSupabase } from "./supabase";
import type { Chapter, CourseData, FlatLesson, Lesson, LessonType } from "./types";

export const LESSON_TYPES: LessonType[] = ["video", "reading", "assignment", "upload", "download", "ask", "survey"];

export const CSV_COLUMNS = [
  "chapter",
  "type",
  "title",
  "duration",
  "seconds",
  "blurb",
  "body",
  "takeaways",
  "due",
  "brief",
];

/** Paragraph and bullet lists travel in one cell, separated by a pipe. */
export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  `ch1,video,Control accounts,9 min,540,Why control accounts catch errors early,"First paragraph.|Second paragraph.","Reconcile monthly|Investigate differences",,`,
  `ch2,assignment,Assignment · Control account reconciliation,,,,,,Fri 3 Oct,"Reconcile the sales ledger control account and explain each difference."`,
].join("\n");

export interface LessonDraft {
  chapterId: string;
  lesson: Lesson;
}

export interface ParseResult {
  drafts: LessonDraft[];
  errors: string[];
}

/** Minimal RFC 4180 reader: handles quoted fields, embedded commas and newlines. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function splitList(value: string): string[] {
  return value
    .split(/\||\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function secondsFrom(duration: string, seconds: string): number {
  const explicit = parseInt(seconds, 10);
  if (explicit > 0) return explicit;
  const minutes = parseInt(duration, 10);
  return minutes > 0 ? minutes * 60 : 600;
}

/**
 * Chapter ids are ch1, ch2… while their lesson ids read c1l1, c1l2… so new
 * lesson ids have to follow the chapter's own numbering, not its id.
 */
export function lessonPrefix(chapter: Chapter): string {
  const sample = (chapter.lessons || []).find((l) => /^(.+?)l\d+$/.test(l.id));
  const match = sample ? /^(.+?)l\d+$/.exec(sample.id) : null;
  if (match?.[1]) return match[1];
  return chapter.id.replace(/^ch/, "c");
}

export function nextLiveLessonId(chapterId: string, existingIds: string[] = []): string {
  const slug = (chapterId || "lesson").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "lesson";
  const used = new Set(existingIds);
  let n = 1;
  let id = `${slug}-l${n}`;
  while (used.has(id) || used.has(`${slug}l${n}`)) {
    n += 1;
    id = `${slug}-l${n}`;
  }
  return id.slice(0, 80);
}

/** Accepts a chapter id (ch1), its lesson prefix (c1), a number (1), or any part of the title. */
export function matchChapter(chapters: Chapter[], value: string): Chapter | null {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return null;
  return (
    chapters.find((c) => c.id.toLowerCase() === wanted) ||
    chapters.find((c) => lessonPrefix(c).toLowerCase() === wanted) ||
    chapters.find((c) => c.title.toLowerCase().startsWith(`chapter ${wanted}`)) ||
    chapters.find((c) => c.title.toLowerCase().includes(wanted)) ||
    null
  );
}

export function nextLessonId(data: CourseData, chapterId: string, taken: string[] = []): string {
  const chapter = data.chapters.find((c) => c.id === chapterId);
  const prefix = chapter ? lessonPrefix(chapter) : chapterId;
  const used = new Set([...allLessons(data).map((l) => l.id), ...taken]);
  let n = (chapter?.lessons?.length || 0) + 1;
  while (used.has(`${prefix}l${n}`)) n += 1;
  return `${prefix}l${n}`;
}

/** Builds a lesson from form or CSV values, filling in what each type needs. */
export function buildLesson(id: string, fields: Record<string, string>): Lesson {
  const type = fields.type as LessonType;
  const lesson: Lesson = { id, type, title: fields.title.trim() };

  if (type === "video" || type === "reading") {
    lesson.duration = fields.duration.trim() || (type === "video" ? "10 min" : "6 min read");
    lesson.blurb = fields.blurb.trim() || lesson.title;
    lesson.body = splitList(fields.body).length ? splitList(fields.body) : [lesson.blurb];
    if (splitList(fields.takeaways).length) lesson.takeaways = splitList(fields.takeaways);
    if (type === "video") lesson.seconds = secondsFrom(fields.duration, fields.seconds);
    if (type === "video" && fields.videoUrl?.trim()) lesson.video_url = fields.videoUrl.trim();
  } else if (type === "assignment" || type === "upload") {
    lesson.due = fields.due.trim() || "TBC";
    lesson.brief = fields.brief.trim() || fields.blurb.trim() || lesson.title;
  } else {
    lesson.blurb =
      fields.blurb.trim() ||
      (type === "ask"
        ? "Send a question to your coach and it lands in your thread."
        : "Two minutes of feedback on this chapter.");
    if (type === "survey") {
      if (fields.surveyId) lesson.survey_id = fields.surveyId;
      if (fields.brief.trim()) lesson.brief = fields.brief.trim();
    }
  }
  if (fields.bannerUrl?.trim()) lesson.banner_image_url = fields.bannerUrl.trim();
  return lesson;
}

export function csvToDrafts(data: CourseData, text: string): ParseResult {
  const rows = parseCsvRows(text);
  const errors: string[] = [];
  const drafts: LessonDraft[] = [];
  if (!rows.length) return { drafts, errors: ["Nothing to import — the file or box is empty."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes("chapter") || !header.includes("type") || !header.includes("title")) {
    return {
      drafts,
      errors: [`The first row must be a header containing at least: chapter, type, title. Got: ${rows[0].join(", ")}`],
    };
  }

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const fields: Record<string, string> = {};
    CSV_COLUMNS.forEach((column) => {
      const at = header.indexOf(column);
      fields[column] = at >= 0 ? (row[at] || "").trim() : "";
    });

    const chapter = matchChapter(data.chapters, fields.chapter);
    if (!chapter) {
      errors.push(`Row ${line}: no chapter matches "${fields.chapter}".`);
      return;
    }
    if (!LESSON_TYPES.includes(fields.type as LessonType)) {
      errors.push(`Row ${line}: type "${fields.type}" must be one of ${LESSON_TYPES.join(", ")}.`);
      return;
    }
    if (!fields.title) {
      errors.push(`Row ${line}: title is required.`);
      return;
    }
    const id = nextLessonId(data, chapter.id, drafts.map((d) => d.lesson.id));
    drafts.push({ chapterId: chapter.id, lesson: buildLesson(id, fields) });
  });

  return { drafts, errors };
}

/* ---------- Supabase: the lessons table ---------- */

export interface LessonRow {
  id: string;
  chapter_id: string;
  position: number;
  type: string;
  title: string;
  duration: string | null;
  seconds: number | null;
  blurb: string | null;
  body: string[] | null;
  takeaways: string[] | null;
  due: string | null;
  brief: string | null;
  survey_id?: string | null;
  video_url?: string | null;
  banner_image_url?: string | null;
}

export function draftToRow(draft: LessonDraft, position: number): LessonRow {
  const l = draft.lesson;
  return {
    id: l.id,
    chapter_id: draft.chapterId,
    position,
    type: l.type,
    title: l.title,
    duration: l.duration || null,
    seconds: l.seconds || null,
    blurb: l.blurb || null,
    body: l.body || null,
    takeaways: l.takeaways || null,
    due: l.due || null,
    brief: l.brief || null,
    survey_id: l.survey_id || null,
    video_url: l.video_url || null,
    banner_image_url: l.banner_image_url || null,
  };
}

export function rowToDraft(row: LessonRow): LessonDraft {
  const lesson: Lesson = { id: row.id, type: row.type as LessonType, title: row.title };
  if (row.duration) lesson.duration = row.duration;
  if (row.seconds) lesson.seconds = row.seconds;
  if (row.blurb) lesson.blurb = row.blurb;
  if (row.body) lesson.body = row.body;
  if (row.takeaways) lesson.takeaways = row.takeaways;
  if (row.due) lesson.due = row.due;
  if (row.brief) lesson.brief = row.brief;
  if (row.survey_id) lesson.survey_id = row.survey_id;
  if (row.video_url) lesson.video_url = row.video_url;
  if (row.banner_image_url) lesson.banner_image_url = row.banner_image_url;
  return { chapterId: row.chapter_id, lesson };
}

export interface DbResult<T = null> {
  ok: boolean;
  error?: string;
  data?: T;
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

export async function checkLessonsTable(): Promise<DbResult<number>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured. Add .env.local and restart the dev server." };
  const { count, error } = await client.from("lessons").select("id", { count: "exact", head: true });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true, data: count || 0 };
}

export async function pushLessons(drafts: LessonDraft[], startPosition: number): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const rows = drafts.map((draft, i) => draftToRow(draft, startPosition + i));
  return upsertLessonRows(rows as unknown as Record<string, unknown>[]);
}

export async function pullLessons(): Promise<DbResult<LessonDraft[]>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client
    .from("lessons")
    .select("*")
    .order("chapter_id", { ascending: true })
    .order("position", { ascending: true });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true, data: (data as LessonRow[]).map(rowToDraft) };
}

export async function deleteLesson(id: string): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("lessons").delete().eq("id", id);
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

const OPTIONAL_LESSON_COLUMNS = ["survey_id", "banner_image_url", "video_url", "video_urls", "pdf_url"];

async function upsertLessonRows(rows: Record<string, unknown>[]): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  let payload: Record<string, unknown>[] = rows.map((row) => ({ ...row }));
  for (let attempt = 0; attempt < OPTIONAL_LESSON_COLUMNS.length + 1; attempt += 1) {
    const { error } = await client.from("lessons").upsert(payload, { onConflict: "id" });
    if (!error) return { ok: true };
    const missing = OPTIONAL_LESSON_COLUMNS.find((column) => payload.some((row) => column in row) && error.message.includes(column));
    if (!missing) return { ok: false, error: describe(error) };
    payload = payload.map((row) => {
      const next = { ...row };
      delete next[missing];
      return next;
    });
  }
  return { ok: false, error: "Could not save lessons." };
}

export interface ManagedLesson {
  id: string;
  chapter_id: string;
  position: number;
  type: LessonType;
  title: string;
  duration: string | null;
  seconds: number | null;
  blurb: string | null;
  body: unknown;
  takeaways: unknown;
  due: string | null;
  brief: string | null;
  video_url: string | null;
  video_urls: unknown;
  pdf_url: string | null;
  survey_id: string | null;
  banner_image_url: string | null;
  requires_submission: boolean | null;
  requires_coach_approval: boolean | null;
  prereq_lesson_id: string | null;
  resource_downloads: unknown;
  unlock_at: string | null;
}

export interface ManagedChapter {
  id: string;
  title: string;
  lessons: ManagedLesson[];
}

function asManagedLesson(row: Record<string, unknown>): ManagedLesson {
  return {
    id: String(row.id),
    chapter_id: String(row.chapter_id || ""),
    position: Number(row.position || 0),
    type: (row.type as LessonType) || "reading",
    title: String(row.title || "Untitled lesson"),
    duration: row.duration != null ? String(row.duration) : null,
    seconds: typeof row.seconds === "number" ? row.seconds : null,
    blurb: row.blurb != null ? String(row.blurb) : null,
    body: row.body ?? null,
    takeaways: row.takeaways ?? null,
    due: row.due != null ? String(row.due) : null,
    brief: row.brief != null ? String(row.brief) : null,
    video_url: row.video_url != null ? String(row.video_url) : null,
    video_urls: row.video_urls ?? null,
    pdf_url: row.pdf_url != null ? String(row.pdf_url) : null,
    survey_id: row.survey_id != null ? String(row.survey_id) : null,
    banner_image_url: row.banner_image_url != null ? String(row.banner_image_url) : null,
    requires_submission: typeof row.requires_submission === "boolean" ? row.requires_submission : null,
    requires_coach_approval: typeof row.requires_coach_approval === "boolean" ? row.requires_coach_approval : null,
    prereq_lesson_id: row.prereq_lesson_id != null ? String(row.prereq_lesson_id) : null,
    resource_downloads: row.resource_downloads ?? null,
    unlock_at: row.unlock_at != null ? String(row.unlock_at) : null,
  };
}

export function copyLessonTitle(title: string, existingTitles: string[] = []): string {
  const base = title.replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/i, "").trim() || title.trim();
  const names = new Set(existingTitles.map((item) => item.trim().toLowerCase()));
  let next = `${base} (Copy)`;
  let n = 2;
  while (names.has(next.toLowerCase())) {
    next = `${base} (Copy ${n})`;
    n += 1;
  }
  return next;
}

function duplicateId(originalId: string, taken: Set<string>): string {
  const root = originalId.slice(0, 64);
  const base = `${root}-copy`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${root}-copy${n}`)) n += 1;
  return `${root}-copy${n}`.slice(0, 80);
}

export async function fetchManagedCourse(): Promise<DbResult<ManagedChapter[]>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", data: [] };
  const chapters = await client.from("chapters").select("id, title, position").order("position", { ascending: true });
  const pageSize = 1000;
  const lessonRows: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += pageSize) {
    const page = await client
      .from("lessons")
      .select("*")
      .order("chapter_id", { ascending: true })
      .order("position", { ascending: true })
      .range(from, from + pageSize - 1);
    if (page.error) return { ok: false, error: describe(page.error), data: [] };
    lessonRows.push(...((page.data || []) as Record<string, unknown>[]));
    if (!page.data || page.data.length < pageSize) break;
  }
  const grouped = new Map<string, ManagedLesson[]>();
  lessonRows.forEach((row) => {
    const lesson = asManagedLesson(row as Record<string, unknown>);
    const list = grouped.get(lesson.chapter_id) || [];
    list.push(lesson);
    grouped.set(lesson.chapter_id, list);
  });
  const chapterRows = chapters.data || [];
  const ids = chapterRows.length ? chapterRows.map((row) => String(row.id)) : [...grouped.keys()];
  const extra = [...grouped.keys()].filter((id) => !ids.includes(id));
  const meta = new Map(chapterRows.map((row) => [String(row.id), String(row.title || row.id)]));
  return {
    ok: true,
    data: [...ids, ...extra]
      .filter((id) => grouped.has(id) || meta.has(id))
      .map((id) => ({
        id,
        title: meta.get(id) || id,
        lessons: grouped.get(id) || [],
      })),
  };
}

/** Assignment and survey lessons from live `public.lessons`, ordered by chapter then position. */
export async function fetchLiveAssignmentLessons(): Promise<FlatLesson[]> {
  const client = getSupabase();
  if (!client) return [];
  const [chapters, first] = await Promise.all([
    client.from("chapters").select("id, title, position").order("position", { ascending: true }),
    client
      .from("lessons")
      .select("id, title, type, due, survey_id, chapter_id, position")
      .in("type", ["assignment", "survey"])
      .order("chapter_id", { ascending: true })
      .order("position", { ascending: true }),
  ]);
  const lessons =
    first.error && /survey_id/i.test(first.error.message)
      ? await client
          .from("lessons")
          .select("id, title, type, due, chapter_id, position")
          .in("type", ["assignment", "survey"])
          .order("chapter_id", { ascending: true })
          .order("position", { ascending: true })
      : first;
  if (lessons.error || !lessons.data?.length) return [];
  const titles = new Map((chapters.data || []).map((row) => [String(row.id), String(row.title || row.id)]));
  const order = new Map((chapters.data || []).map((row, index) => [String(row.id), index]));
  const flags = await fetchSurveyAssignmentFlags();
  const chapterOf = (chapterId: string): Chapter => ({
    id: chapterId,
    title: titles.get(chapterId) || chapterId,
    summary: "",
    lessons: [],
  });
  return [...lessons.data]
    .sort((left, right) => {
      const leftChapter = order.get(String(left.chapter_id)) ?? 999;
      const rightChapter = order.get(String(right.chapter_id)) ?? 999;
      if (leftChapter !== rightChapter) return leftChapter - rightChapter;
      return Number(left.position || 0) - Number(right.position || 0);
    })
    .map((row) => {
      const record = row as Record<string, unknown>;
      const surveyId = record.survey_id != null ? String(record.survey_id) : null;
      const type = (record.type as LessonType) || "assignment";
      return {
        id: String(record.id),
        type,
        title: String(record.title || "Untitled lesson"),
        due: record.due != null ? String(record.due) : undefined,
        survey_id: surveyId,
        is_assignment: lessonIsAssignment({ type, is_assignment: Boolean(surveyId && flags[surveyId]) }),
        chapter: chapterOf(String(record.chapter_id || "")),
      };
    });
}

async function rewriteChapterOrder(chapterId: string, lessonIds: string[]): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const updates = lessonIds.map((id, index) =>
    client.from("lessons").update({ chapter_id: chapterId, position: index + 1 }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return { ok: false, error: describe(failed.error) };
  return { ok: true };
}

export async function duplicateLesson(lessonId: string): Promise<DbResult<ManagedLesson>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (error) return { ok: false, error: describe(error) };
  if (!data) return { ok: false, error: "Lesson not found in Supabase. Load lessons from the database first." };
  const source = data as Record<string, unknown>;
  const chapterId = String(source.chapter_id || "");
  const siblings = await client
    .from("lessons")
    .select("id, title, position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: true });
  if (siblings.error) return { ok: false, error: describe(siblings.error) };
  const rows = siblings.data || [];
  const index = rows.findIndex((row) => String(row.id) === lessonId);
  const taken = new Set(rows.map((row) => String(row.id)));
  const newId = duplicateId(lessonId, taken);
  const clone: Record<string, unknown> = { ...source };
  delete clone.created_at;
  delete clone.updated_at;
  clone.id = newId;
  clone.title = copyLessonTitle(String(source.title || "Untitled lesson"), rows.map((row) => String(row.title || "")));
  clone.chapter_id = chapterId;
  clone.position = Number(source.position || index + 1) + 1;
  const inserted = await upsertLessonRows([clone]);
  if (!inserted.ok) return inserted;
  const ordered = rows.map((row) => String(row.id));
  ordered.splice(Math.max(index, 0) + 1, 0, newId);
  const rewritten = await rewriteChapterOrder(chapterId, ordered);
  if (!rewritten.ok) return rewritten;
  return { ok: true, data: asManagedLesson(clone) };
}

export async function saveChapterOrder(chapterId: string, lessonIds: string[]): Promise<DbResult> {
  return rewriteChapterOrder(chapterId, lessonIds);
}

export async function moveLessonToChapter(
  lessonId: string,
  fromChapterId: string,
  toChapterId: string,
  toIndex?: number
): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const fromRows = await client.from("lessons").select("id").eq("chapter_id", fromChapterId).order("position", { ascending: true });
  const toRows =
    fromChapterId === toChapterId
      ? fromRows
      : await client.from("lessons").select("id").eq("chapter_id", toChapterId).order("position", { ascending: true });
  if (fromRows.error) return { ok: false, error: describe(fromRows.error) };
  if (toRows.error) return { ok: false, error: describe(toRows.error) };
  const fromIds = (fromRows.data || []).map((row) => String(row.id)).filter((id) => id !== lessonId);
  const toIds = (toRows.data || []).map((row) => String(row.id)).filter((id) => id !== lessonId);
  const insertAt = toIndex == null ? toIds.length : Math.max(0, Math.min(toIndex, toIds.length));
  toIds.splice(insertAt, 0, lessonId);
  if (fromChapterId !== toChapterId) {
    const fromResult = await rewriteChapterOrder(fromChapterId, fromIds);
    if (!fromResult.ok) return fromResult;
  }
  return rewriteChapterOrder(toChapterId, toIds);
}

export async function updateLessonFields(id: string, patch: Record<string, unknown>): Promise<DbResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  let payload: Record<string, unknown> = { ...patch };
  for (let attempt = 0; attempt < OPTIONAL_LESSON_COLUMNS.length + 1; attempt += 1) {
    const { error } = await client.from("lessons").update(payload).eq("id", id);
    if (!error) return { ok: true };
    const missing = OPTIONAL_LESSON_COLUMNS.find((column) => column in payload && error.message.includes(column));
    if (!missing) return { ok: false, error: describe(error) };
    delete payload[missing];
  }
  return { ok: false, error: "Could not update the lesson." };
}

export async function uploadLessonBanner(file: File): Promise<DbResult<string>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buckets = ["course-pdfs", "lesson-banners"];
  for (const bucket of buckets) {
    const uploaded = await client.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (uploaded.error) continue;
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) return { ok: true, data: data.publicUrl };
  }
  return { ok: false, error: "Could not upload that image. Paste a public image URL instead." };
}
