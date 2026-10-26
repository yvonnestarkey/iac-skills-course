import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { asDraftFlag } from "@/lib/lesson-drafts";
import { assembleStudentProgress, type LessonProgressRow, type SubmissionProgressRow } from "@/lib/lesson-progress";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const PROGRESS_COLUMNS =
  "user_id, lesson_id, completed, opened_at, last_opened_at, video_seconds, video_percent, notes, updated_at";
const PROGRESS_FALLBACK = "user_id, lesson_id, completed, notes, updated_at";

async function selectPaged<T>(
  load: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) return { data: rows, error: error.message };
    rows.push(...(((data || []) as T[]) || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const studentId = new URL(request.url).searchParams.get("studentId") || "";

  const lessons = await db.from("lessons").select("id, is_draft");
  let lessonRows: Array<{ id: string; is_draft?: unknown }> = [];
  if (lessons.error) {
    const fallback = await db.from("lessons").select("id");
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 400 });
    lessonRows = (fallback.data || []) as Array<{ id: string }>;
  } else {
    lessonRows = (lessons.data || []) as Array<{ id: string; is_draft?: unknown }>;
  }
  const lessonIds = lessonRows
    .filter((row) => !asDraftFlag(row.is_draft))
    .map((row) => String(row.id))
    .filter(Boolean);

  const progressQuery = (columns: string) => (from: number, to: number) => {
    let query = db.from("lesson_progress").select(columns);
    if (studentId) query = query.eq("user_id", studentId);
    return query.range(from, to);
  };

  let progress = await selectPaged<LessonProgressRow>(progressQuery(PROGRESS_COLUMNS));
  if (progress.error && /opened_at|last_opened_at|video_seconds|video_percent/i.test(progress.error)) {
    progress = await selectPaged<LessonProgressRow>(progressQuery(PROGRESS_FALLBACK));
  }
  if (progress.error) return NextResponse.json({ error: progress.error }, { status: 400 });

  const submissions = await selectPaged<SubmissionProgressRow>((from, to) => {
    let query = db.from("student_submissions").select("student_id, lesson_id");
    if (studentId) query = query.eq("student_id", studentId);
    return query.range(from, to);
  });
  if (submissions.error) return NextResponse.json({ error: submissions.error }, { status: 400 });

  return NextResponse.json(
    assembleStudentProgress({
      lessonIds,
      progress: progress.data,
      submissions: submissions.data,
    })
  );
}
