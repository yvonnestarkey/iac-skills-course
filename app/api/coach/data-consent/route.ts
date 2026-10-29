import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const asChoice = (v: unknown): boolean | null => (v === true || v === "yes" ? true : v === false || v === "no" ? false : null);

/** Coach view and change of a student's data choices (for students who ask by email). */
export async function GET(request: NextRequest) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const client = getServiceSupabase();
  const studentId = request.nextUrl.searchParams.get("student_id") || "";
  if (!client || !studentId) return NextResponse.json({ error: "Missing student." }, { status: 400 });
  const { data, error } = await client
    .from("student_profiles")
    .select("eve_training_consent, research_consent, consent_updated_at, consent_updated_by")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    eve: data?.eve_training_consent ?? null,
    research: data?.research_consent ?? null,
    updatedAt: data?.consent_updated_at ?? null,
    updatedBy: data?.consent_updated_by ?? null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const client = getServiceSupabase();
  const body = (await request.json().catch(() => null)) as { student_id?: string; eve?: unknown; research?: unknown } | null;
  if (!client || !body?.student_id) return NextResponse.json({ error: "Missing student." }, { status: 400 });
  const patch: Record<string, unknown> = {
    student_id: body.student_id,
    consent_updated_at: new Date().toISOString(),
    consent_updated_by: `coach:${user?.email || "staff"}`,
  };
  if ("eve" in body) patch.eve_training_consent = asChoice(body.eve);
  if ("research" in body) patch.research_consent = asChoice(body.research);
  const { error } = await client.from("student_profiles").upsert(patch, { onConflict: "student_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
