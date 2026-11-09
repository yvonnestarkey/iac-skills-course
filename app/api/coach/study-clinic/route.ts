import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  clipFromDraft,
  fetchStudyClinicClip,
  fetchStudyClinicClips,
  inferStudyClinicKind,
  inferStudyClinicSection,
  studyClinicMissingResourceSqlError,
  studyClinicMissingSectionSqlError,
  type StudyClinicDraft,
} from "@/lib/study-clinic";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SECTION_SQL = "Paste supabase/study-clinic-sections.sql, then run: notify pgrst, 'reload schema';";
const RESOURCE_SQL = "Paste supabase/study-clinic-resources.sql so PDFs and links can save.";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const clips = await fetchStudyClinicClips({ includeDrafts: true });
  return NextResponse.json({ clips }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const body = (await request.json().catch(() => null)) as StudyClinicDraft | null;
  const parsed = clipFromDraft(body || ({} as StudyClinicDraft));
  if (!parsed.clip) return NextResponse.json({ error: parsed.error || "Invalid resource." }, { status: 400 });
  const now = new Date().toISOString();
  const row = { ...parsed.clip, updated_at: now };
  const { error } = await db.from("study_clinic").upsert(row);
  if (error) {
    if (studyClinicMissingSectionSqlError(error.message)) {
      return NextResponse.json({ error: SECTION_SQL }, { status: 400 });
    }
    if (studyClinicMissingResourceSqlError(error.message)) {
      return NextResponse.json({ error: RESOURCE_SQL }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let saved = (await fetchStudyClinicClip(parsed.clip.id, { includeDrafts: true })) || parsed.clip;
  if (inferStudyClinicSection(saved) !== parsed.clip.section) {
    const { error: fixError } = await db
      .from("study_clinic")
      .update({ section: parsed.clip.section, updated_at: now })
      .eq("id", parsed.clip.id);
    if (fixError) {
      return NextResponse.json(
        { error: `Saved, but it landed in the wrong library. ${SECTION_SQL}` },
        { status: 400 }
      );
    }
    saved = { ...saved, section: parsed.clip.section };
  }
  if (inferStudyClinicKind(saved) !== parsed.clip.kind) {
    return NextResponse.json({ error: RESOURCE_SQL }, { status: 400 });
  }
  return NextResponse.json({ ok: true, clip: { ...parsed.clip, ...saved, section: parsed.clip.section } });
}
