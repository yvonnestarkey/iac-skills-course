import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isCoachAccount } from "@/lib/roles";
import { studentUserFromAuth } from "@/lib/student-lesson";
import { runEvaluation, saveEvaluationRun } from "@/lib/evaluator/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Staff-only calibration endpoint. Runs the v2 evaluator for one attempt and stores the result in
 * evaluator_runs. Not wired to the student submit flow yet.
 * Body: { attempt_id, only?: string[], dataset_only?: boolean }
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isCoachAccount(studentUserFromAuth(user))) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { attempt_id?: string; only?: string[]; dataset_only?: boolean };
  if (!body.attempt_id) return NextResponse.json({ error: "attempt_id is required." }, { status: 400 });

  try {
    const result = await runEvaluation(body.attempt_id, { only: body.only, datasetOnly: body.dataset_only });
    const runId = await saveEvaluationRun(body.attempt_id, result, "calibration");
    return NextResponse.json({ ok: true, run_id: runId, usage: result.usage, dataset: result.dataset, report: result.report });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Evaluation failed." }, { status: 500 });
  }
}
