import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { exerciseFromDraft, fetchPracticeExercises, type PracticeExerciseDraft } from "@/lib/reading-practice";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const rows = await fetchPracticeExercises({ includeDrafts: true });
  return NextResponse.json({ exercises: rows });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const body = (await request.json().catch(() => null)) as PracticeExerciseDraft | null;
  const parsed = exerciseFromDraft(body || ({} as PracticeExerciseDraft));
  if (!parsed.exercise) return NextResponse.json({ error: parsed.error || "Invalid exercise." }, { status: 400 });
  const exercise = parsed.exercise;
  const now = new Date().toISOString();
  const { error } = await db.from("reading_practice_exercises").upsert({
    id: exercise.id,
    title: exercise.title,
    area: exercise.area,
    published: body?.published !== false,
    payload: exercise,
    updated_at: now,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, exercise });
}
