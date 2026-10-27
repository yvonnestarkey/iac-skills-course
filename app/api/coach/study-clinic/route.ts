import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { clipFromDraft, fetchStudyClinicClips, type StudyClinicDraft } from "@/lib/study-clinic";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const clips = await fetchStudyClinicClips({ includeDrafts: true });
  return NextResponse.json({ clips });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const body = (await request.json().catch(() => null)) as StudyClinicDraft | null;
  const parsed = clipFromDraft(body || ({} as StudyClinicDraft));
  if (!parsed.clip) return NextResponse.json({ error: parsed.error || "Invalid video." }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await db.from("study_clinic").upsert({
    ...parsed.clip,
    updated_at: now,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, clip: parsed.clip });
}
