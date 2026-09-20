import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CHAPTER_COLUMNS = "id, title, summary, position";

const LESSON_COLUMN_SETS = [
  "id, chapter_id, position, type, title, duration, seconds, blurb, due, video_duration_seconds, estimated_read_minutes, duration_minutes, requires_submission, requires_coach_approval, prereq_lesson_id",
  "id, chapter_id, position, type, title, duration, seconds, blurb, due, video_duration_seconds, estimated_read_minutes, duration_minutes",
  "id, chapter_id, position, type, title, duration, seconds, blurb, due",
  "id, chapter_id, position, type, title, duration, seconds",
];

type ChapterRow = {
  id: string;
  title: string;
  summary?: string | null;
  position?: number | null;
};

type LessonRow = Record<string, unknown>;

function asLesson(row: LessonRow) {
  const lesson: Record<string, unknown> = {
    id: String(row.id),
    chapter_id: String(row.chapter_id || ""),
    position: Number(row.position || 0),
    type: String(row.type || ""),
    title: String(row.title || ""),
  };
  if ("duration" in row) lesson.duration = row.duration ?? null;
  if ("seconds" in row) lesson.seconds = row.seconds ?? null;
  if ("blurb" in row) lesson.blurb = row.blurb ?? null;
  if ("due" in row) lesson.due = row.due ?? null;
  if ("video_duration_seconds" in row) lesson.video_duration_seconds = row.video_duration_seconds ?? null;
  if ("estimated_read_minutes" in row) lesson.estimated_read_minutes = row.estimated_read_minutes ?? null;
  if ("duration_minutes" in row) lesson.duration_minutes = row.duration_minutes ?? null;
  if ("requires_submission" in row) lesson.requires_submission = row.requires_submission === true;
  if ("requires_coach_approval" in row) lesson.requires_coach_approval = row.requires_coach_approval === true;
  if ("prereq_lesson_id" in row) lesson.prereq_lesson_id = row.prereq_lesson_id ?? null;
  return lesson;
}

async function fetchLessonRows(): Promise<{ rows: LessonRow[]; error: string | null }> {
  for (const columns of LESSON_COLUMN_SETS) {
    const rows: LessonRow[] = [];
    let failed: string | null = null;
    for (let from = 0; from < 20000; from += 1000) {
      const page = await supabase
        .from("lessons")
        .select(columns)
        .order("position", { ascending: true })
        .range(from, from + 999);
      if (page.error) {
        failed = page.error.message;
        break;
      }
      rows.push(...(((page.data || []) as unknown) as LessonRow[]));
      if (!page.data || page.data.length < 1000) {
        return { rows, error: null };
      }
    }
    if (!failed) return { rows, error: null };
  }
  return { rows: [], error: "Could not load lessons." };
}

export async function GET() {
  const chaptersResult = await supabase
    .from("chapters")
    .select(CHAPTER_COLUMNS)
    .order("position", { ascending: true });

  if (chaptersResult.error) {
    return NextResponse.json({ error: chaptersResult.error.message }, { status: 400 });
  }

  const lessonsResult = await fetchLessonRows();
  if (lessonsResult.error && !lessonsResult.rows.length) {
    return NextResponse.json({ error: lessonsResult.error }, { status: 400 });
  }

  const grouped = new Map<string, ReturnType<typeof asLesson>[]>();
  for (const row of lessonsResult.rows) {
    const lesson = asLesson(row);
    const chapterId = String(lesson.chapter_id);
    const list = grouped.get(chapterId) || [];
    list.push(lesson);
    grouped.set(chapterId, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => Number(a.position) - Number(b.position));
  }

  const chapterRows = (chaptersResult.data || []) as ChapterRow[];
  const seen = new Set(chapterRows.map((row) => String(row.id)));
  const extras = [...grouped.keys()].filter((id) => !seen.has(id));

  const chapters = [
    ...chapterRows.map((row) => ({
      id: String(row.id),
      title: String(row.title || row.id),
      summary: row.summary || "",
      position: Number(row.position || 0),
      lessons: grouped.get(String(row.id)) || [],
    })),
    ...extras.map((id) => ({
      id,
      title: id,
      summary: "",
      position: Number.MAX_SAFE_INTEGER,
      lessons: grouped.get(id) || [],
    })),
  ];

  return NextResponse.json({ chapters });
}
