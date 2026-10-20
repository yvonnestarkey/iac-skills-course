import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parseEvaluatorMode } from "@/lib/evaluator/job-rules";
import { kickJob, retryJob, setEvaluatorMode } from "@/lib/evaluator/jobs";
import { sendResendEmail } from "@/lib/resend";
import { isCoachAccount } from "@/lib/roles";
import { studentUserFromAuth } from "@/lib/student-lesson";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Staff actions from Coach tools > Script Evaluator reports: release / hide a report, retry a paper, the switch. */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = getServiceSupabase();
  if (!url || !anonKey || !service) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const supabase = createServerClient(url, anonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoachAccount(studentUserFromAuth(user))) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const form = await request.formData();
  const action = String(form.get("action") || "");
  const back = NextResponse.redirect(new URL("/coach/evaluator", request.url), 303);

  if (action === "mode") {
    await setEvaluatorMode(parseEvaluatorMode(form.get("mode")));
    return back;
  }
  if (action === "retry") {
    const job = await retryJob(String(form.get("job_id") || ""));
    if (job) await kickJob(job, request.nextUrl.origin);
    return back;
  }
  if (action === "release" || action === "unrelease") {
    const attemptId = String(form.get("attempt_id") || "");
    const release = action === "release";
    const { data, error } = await service
      .from("exam_attempts")
      .update({ evaluator_report_released_at: release ? new Date().toISOString() : null, evaluator_report_released_by: release ? user.id : null })
      .eq("id", attemptId)
      .select("user_id, sitting_label")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = data as { user_id?: string; sitting_label?: string } | null;
    if (release && row?.user_id) {
      // Tell the student their report is ready. Best effort: the report shows on their Script Evaluator page either way.
      const { data: profile } = await service.from("profiles").select("email, full_name").eq("id", row.user_id).maybeSingle();
      const p = profile as { email?: string; full_name?: string | null } | null;
      if (p?.email) {
        await sendResendEmail({
          to: p.email,
          subject: "Your Script Evaluator report is ready",
          text: `Hi ${p.full_name?.split(" ")[0] || "there"},\n\nYour Script Evaluator report${row.sitting_label ? ` for ${row.sitting_label}` : ""} is ready. Open it here:\n${request.nextUrl.origin}/evaluator-report/${attemptId}\n\nYvonne`,
          idempotencyKey: `evaluator-released-${attemptId}`,
        }).catch(() => undefined);
      }
    }
    return back;
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
