import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { isStudyClinicSectionId, studyClinicMissingPageSqlError, type StudyClinicSectionId } from "@/lib/study-clinic";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const body = (await request.json().catch(() => null)) as {
    section?: string;
    intro?: string;
    body?: string;
  } | null;
  if (!isStudyClinicSectionId(body?.section)) {
    return NextResponse.json({ error: "Choose a Study Clinic library first." }, { status: 400 });
  }
  const page = {
    section: body.section as StudyClinicSectionId,
    intro: String(body?.intro || ""),
    body: String(body?.body || ""),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("study_clinic_pages").upsert(page);
  if (error) {
    if (studyClinicMissingPageSqlError(error.message)) {
      return NextResponse.json(
        { error: "Paste supabase/study-clinic-resources.sql so library copy can save." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    page: { section: page.section, intro: page.intro, body: page.body },
  });
}
