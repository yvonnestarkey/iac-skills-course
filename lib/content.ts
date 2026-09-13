import { allLessons } from "./course";
import { getSupabase } from "./supabase";
import type { Chapter, CourseData, Lesson, LessonType } from "./types";

export const LESSON_TYPES: LessonType[] = ["video", "reading", "assignment", "upload", "ask", "survey"];

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
  const sample = chapter.lessons.find((l) => /^(.+?)l\d+$/.test(l.id));
  if (sample) return /^(.+?)l\d+$/.exec(sample.id)[1];
  return chapter.id.replace(/^ch/, "c");
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
  let n = (chapter?.lessons.length || 0) + 1;
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
  } else if (type === "assignment" || type === "upload") {
    lesson.due = fields.due.trim() || "TBC";
    lesson.brief = fields.brief.trim() || fields.blurb.trim() || lesson.title;
  } else {
    lesson.blurb =
      fields.blurb.trim() ||
      (type === "ask"
        ? "Send a question to your coach and it lands in your thread."
        : "Two minutes of feedback on this chapter.");
  }
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
  const { error } = await client.from("lessons").upsert(rows, { onConflict: "id" });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
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
