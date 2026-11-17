import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Coach view: recent live-session attempts, each matched by email to a course account where one exists. */
export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const exercise = new URL(request.url).searchParams.get("exercise") || "";

  let query = db.from("reading_live_attempts").select("*").order("created_at", { ascending: false }).limit(500);
  if (exercise) query = query.eq("exercise_id", exercise);
  const { data, error } = await query;
  if (error) {
    const missing = /reading_live_attempts/.test(error.message) && /exist|find/i.test(error.message);
    return NextResponse.json({ error: missing ? "Run supabase/reading-live.sql in Supabase first." : error.message }, { status: 400 });
  }
  const rows = data || [];
  const emails = [...new Set(rows.map((r) => String(r.email).toLowerCase()))];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const matches: Record<string, { id: string; name: string }> = {};
  if (emails.length || ids.length) {
    const [byEmail, byId] = await Promise.all([
      emails.length ? db.from("profiles").select("id, email, full_name").in("email", emails) : Promise.resolve({ data: [] }),
      ids.length ? db.from("profiles").select("id, email, full_name").in("id", ids) : Promise.resolve({ data: [] }),
    ]);
    for (const p of [...(byEmail.data || []), ...(byId.data || [])] as { id: string; email: string | null; full_name: string | null }[]) {
      if (p.email) matches[p.email.toLowerCase()] = { id: p.id, name: p.full_name || p.email };
    }
  }
  const byUser = Object.fromEntries(Object.values(matches).map((m) => [m.id, m]));
  return NextResponse.json({
    attempts: rows.map((r) => ({ ...r, student: (r.user_id && byUser[r.user_id]) || matches[String(r.email).toLowerCase()] || null })),
  });
}
