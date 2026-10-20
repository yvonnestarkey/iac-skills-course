import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { claimJob, kickJob, runClaimedStep } from "@/lib/evaluator/jobs";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Runs ONE step of a student evaluator job. Called only by the site itself, with the job's own secret token.
 * Answers at once; the step runs after the response, and a finished step starts the next one.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = request.headers.get("x-worker-token") || "";
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const { data } = await supabase.from("evaluator_jobs").select("id, worker_token").eq("id", id).maybeSingle();
  const row = data as { id: string; worker_token: string } | null;
  if (!row || !token || !sameToken(token, row.worker_token)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const job = await claimJob(id);
  if (!job) return NextResponse.json({ ok: true, skipped: true });

  after(async () => {
    const { finished, retrying } = await runClaimedStep(job);
    if (!finished) {
      // A short pause after a failed try, so a passing hiccup at the model provider has time to clear.
      if (retrying) await new Promise((resolve) => setTimeout(resolve, 20000));
      await kickJob(job, request.nextUrl.origin);
    }
  });
  return NextResponse.json({ ok: true, started: job.step }, { status: 202 });
}
