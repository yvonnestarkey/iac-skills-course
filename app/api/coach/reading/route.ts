import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const studentId = new URL(request.url).searchParams.get("studentId") || "";
  if (!studentId) return NextResponse.json({ error: "Student required." }, { status: 400 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const [attempts, checks] = await Promise.all([
    db.from("reading_attempts").select("*").eq("user_id", studentId).order("created_at", { ascending: true }),
    db.from("reading_checks").select("*").eq("user_id", studentId).order("created_at", { ascending: true }),
  ]);
  if (attempts.error) return NextResponse.json({ error: attempts.error.message }, { status: 400 });
  if (checks.error) return NextResponse.json({ error: checks.error.message }, { status: 400 });
  return NextResponse.json({ attempts: attempts.data || [], checks: checks.data || [] });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { studentId?: string; kind?: string; key?: string } | null;
  const studentId = String(body?.studentId || "");
  const kind = body?.kind === "check" ? "check" : body?.kind === "exercise" ? "exercise" : "";
  const key = String(body?.key || "");
  if (!studentId || !kind || !key) return NextResponse.json({ error: "Student, task, and reset key are required." }, { status: 400 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  if (kind === "check") {
    const removed = await db.from("reading_checks").delete().eq("user_id", studentId).eq("check_id", key).select("id");
    if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, removed: removed.data?.length || 0 });
  }

  const [attempts, calls] = await Promise.all([
    db.from("reading_attempts").delete().eq("user_id", studentId).eq("exercise_id", key).select("id"),
    db.from("reading_mark_calls").delete().eq("user_id", studentId).eq("exercise_id", key).select("id"),
  ]);
  if (attempts.error) return NextResponse.json({ error: attempts.error.message }, { status: 400 });
  if (calls.error) return NextResponse.json({ error: calls.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, removed: (attempts.data?.length || 0) + (calls.data?.length || 0) });
}
