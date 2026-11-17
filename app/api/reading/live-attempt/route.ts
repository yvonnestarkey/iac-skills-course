import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { cleanLiveEmail, getLiveExercise, type DrillAttempt } from "@/lib/reading-drills";
import { liveHash, requestAddress } from "@/lib/reading-live";

export const dynamic = "force-dynamic";

const PER_BROWSER_DAILY = 20;

/** Saves a finished live-session attempt under the email the student gave. No sign-in needed. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; browserId?: string; attempt?: DrillAttempt; liveCallId?: string | null };
  const email = cleanLiveEmail(body.email);
  const attempt = body.attempt;
  const ex = getLiveExercise(String(attempt?.exercise_id || ""));
  if (!email) return NextResponse.json({ error: "Please give a valid email address." }, { status: 400 });
  if (!ex || !attempt || typeof attempt !== "object") return NextResponse.json({ error: "Unknown exercise." }, { status: 400 });
  if (JSON.stringify(attempt).length > 60000) return NextResponse.json({ error: "The attempt is too large to save." }, { status: 400 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Saving is not set up yet." }, { status: 500 });

  const browserHash = liveHash(String(body.browserId || requestAddress(req)).slice(0, 80));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await db
    .from("reading_live_attempts")
    .select("id", { count: "exact", head: true })
    .eq("browser_hash", browserHash)
    .gte("created_at", since);
  if (recent.error) return NextResponse.json({ error: "Saving is not set up yet." }, { status: 500 });
  if ((recent.count || 0) >= PER_BROWSER_DAILY) return NextResponse.json({ error: "Too many attempts saved from this browser today." }, { status: 429 });

  const user = await getRequestUser().catch(() => null);
  const callId = /^[0-9a-f-]{36}$/i.test(String(body.liveCallId || "")) ? String(body.liveCallId) : null;
  const { error } = await db.from("reading_live_attempts").insert({
    exercise_id: ex.id,
    email,
    user_id: user?.id ?? null,
    browser_hash: browserHash,
    pct: Math.max(0, Math.min(100, Math.round(Number(attempt.grade?.pct) || 0))),
    pot_pct: Math.max(0, Math.min(100, Math.round(Number(attempt.grade?.potPct) || 0))),
    marked_by: attempt.marked_by === "model" && callId ? "model" : "self",
    live_call_id: callId,
    attempt: { ...attempt, answer: String(attempt.answer || "").slice(0, 6000), mark_call_id: null },
  });
  if (error) return NextResponse.json({ error: "Saving did not work this time." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
