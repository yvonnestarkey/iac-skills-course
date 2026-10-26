import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { callStructured, newUsage } from "@/lib/evaluator/anthropic";
import {
  DAILY_MARKED_LIMIT,
  MARKING_SCHEMA,
  MARKING_SYSTEM,
  READING_MARK_MODEL_DEFAULT,
  buildMarkingPrompt,
  getExercise,
  markingCostUsd,
  normaliseMarking,
} from "@/lib/reading-drills";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Marks one Read the Required practice answer. The only part of the drills that costs money.
 * Any refusal or failure returns { selfMark: true, reason } so the page falls back to self-marking.
 */
export async function POST(req: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { exerciseId?: string; answer?: string };
  const ex = getExercise(String(body.exerciseId || ""));
  const answer = String(body.answer || "").trim();
  if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 400 });
  if (answer.split(/\s+/).length < 15) return NextResponse.json({ error: "The answer is too short to mark." }, { status: 400 });

  if (process.env.READING_MARKING_ENABLED === "false") {
    return NextResponse.json({ selfMark: true, reason: "Automatic marking is switched off." });
  }
  const db = getServiceSupabase();
  if (!db || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ selfMark: true, reason: "Automatic marking is not set up yet." });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await db
    .from("reading_mark_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("ok", true)
    .gte("created_at", since);
  if (countError) {
    return NextResponse.json({ selfMark: true, reason: "Automatic marking is not set up yet." });
  }
  if ((count || 0) >= DAILY_MARKED_LIMIT) {
    return NextResponse.json({
      selfMark: true,
      reason: `You have had ${DAILY_MARKED_LIMIT} answers marked in the last 24 hours, the daily limit. Mark this one yourself against the marker's rows.`,
    });
  }

  const model = process.env.READING_MARK_MODEL?.trim() || READING_MARK_MODEL_DEFAULT;
  const usage = newUsage();
  try {
    const raw = await callStructured<Parameters<typeof normaliseMarking>[1]>({
      system: MARKING_SYSTEM,
      userContent: [{ type: "text", text: buildMarkingPrompt(ex, answer) }],
      toolName: "record_marking",
      toolDescription: "Record the RTFQ verdicts, the marker's rows earned, any excluded material used, and the one fix.",
      schema: MARKING_SCHEMA,
      usage,
      maxTokens: 3000,
      model,
    });
    const marking = normaliseMarking(ex, raw);
    const cost = markingCostUsd(model, usage.input_tokens, usage.output_tokens);
    const { data: call } = await db
      .from("reading_mark_calls")
      .insert({ user_id: user.id, exercise_id: ex.id, model, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: cost })
      .select("id")
      .single();
    return NextResponse.json({ marking, markCallId: call?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("reading_mark_calls").insert({
      user_id: user.id,
      exercise_id: ex.id,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: markingCostUsd(model, usage.input_tokens, usage.output_tokens),
      ok: false,
      error: message.slice(0, 500),
    });
    return NextResponse.json({ selfMark: true, reason: "Automatic marking did not work this time." });
  }
}
