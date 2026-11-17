import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { callStructured, newUsage } from "@/lib/evaluator/anthropic";
import {
  LIVE,
  MARKING_SCHEMA,
  MARKING_SYSTEM,
  READING_MARK_MODEL_DEFAULT,
  buildMarkingPrompt,
  getLiveExercise,
  markingCostUsd,
  normaliseMarking,
} from "@/lib/reading-drills";
import { liveHash, requestAddress } from "@/lib/reading-live";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Shared wifi in a venue puts many students behind one address, so the address limit is generous. */
const PER_ADDRESS_DAILY = 30;

const hash = liveHash;

/**
 * Marks a live-session answer. No sign-in, so spend is held down three ways: per browser, per address,
 * and a total for the day across everyone. Any refusal or failure falls back to self-marking.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { exerciseId?: string; answer?: string; browserId?: string };
  const ex = getLiveExercise(String(body.exerciseId || ""));
  const answer = String(body.answer || "").trim();
  if (!ex) return NextResponse.json({ error: "This exercise is not open for live sessions." }, { status: 400 });
  if (answer.split(/\s+/).length < 15) return NextResponse.json({ error: "The answer is too short to mark." }, { status: 400 });

  const selfMark = (reason: string) => NextResponse.json({ selfMark: true, reason });
  if (process.env.READING_LIVE_MARKING_ENABLED === "false" || process.env.READING_MARKING_ENABLED === "false") {
    return selfMark("Automatic marking is switched off for this session.");
  }
  const db = getServiceSupabase();
  if (!db || !process.env.ANTHROPIC_API_KEY) return selfMark("Automatic marking is not set up yet.");

  const address = requestAddress(req);
  const addressHash = hash(address);
  const browserHash = hash(String(body.browserId || address).slice(0, 80));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = (filter: { col?: string; val?: string }) => {
    let q = db.from("reading_live_calls").select("id", { count: "exact", head: true }).eq("ok", true).gte("created_at", since);
    if (filter.col && filter.val) q = q.eq(filter.col, filter.val);
    return q;
  };
  const [byBrowser, byAddress, total] = await Promise.all([
    count({ col: "browser_hash", val: browserHash }),
    count({ col: "address_hash", val: addressHash }),
    count({}),
  ]);
  if (byBrowser.error || byAddress.error || total.error) return selfMark("Automatic marking is not set up yet.");
  const dailyCap = Number(process.env.READING_LIVE_DAILY_CAP) || LIVE.dailyCap;
  if ((total.count || 0) >= dailyCap) return selfMark("Today's automatic marking for live sessions is used up.");
  if ((byBrowser.count || 0) >= LIVE.perBrowserDaily || (byAddress.count || 0) >= PER_ADDRESS_DAILY) {
    return selfMark(`You have had ${LIVE.perBrowserDaily} live answers marked today, the limit.`);
  }

  const model = process.env.READING_MARK_MODEL?.trim() || READING_MARK_MODEL_DEFAULT;
  const usage = newUsage();
  const log = { exercise_id: ex.id, browser_hash: browserHash, address_hash: addressHash, model };
  try {
    const raw = await callStructured<Parameters<typeof normaliseMarking>[1]>({
      system: MARKING_SYSTEM,
      userContent: [{ type: "text", text: buildMarkingPrompt(ex, answer) }],
      toolName: "record_marking",
      toolDescription: "Record the RTFQ verdicts, the marker's rows earned, any excluded material used, and the one fix.",
      schema: MARKING_SCHEMA,
      usage,
      maxTokens: 3500,
      model,
    });
    const marking = normaliseMarking(ex, raw);
    const { data: call } = await db.from("reading_live_calls").insert({
      ...log,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: markingCostUsd(model, usage.input_tokens, usage.output_tokens),
      answer: answer.slice(0, 6000),
      rows_earned: Object.entries(marking.rows).filter(([, r]) => r.earned).map(([id]) => id),
    }).select("id").single();
    return NextResponse.json({ marking, markCallId: call?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("reading_live_calls").insert({
      ...log,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: markingCostUsd(model, usage.input_tokens, usage.output_tokens),
      ok: false,
      error: message.slice(0, 500),
    });
    return selfMark("Automatic marking did not work this time.");
  }
}
