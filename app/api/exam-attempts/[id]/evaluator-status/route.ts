import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { examAttemptFromRow, isAttemptSubmitted } from "@/lib/exam-attempts";
import { releasedReportForAttempt } from "@/lib/evaluator/coach-report";
import { newEvaluatorApplies, questionsDone, studentPaperStatus } from "@/lib/evaluator/job-rules";
import { createJobsForAttempt, getEvaluatorMode, jobsForAttempt, kickPendingJobs } from "@/lib/evaluator/jobs";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";
import { findPastPaperSitting } from "@/lib/past-papers";
import { isCoachAccount } from "@/lib/roles";
import { STAFF_TEST_ATTEMPT_SOURCE } from "@/lib/staff-access";
import { studentUserFromAuth } from "@/lib/student-lesson";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * What the student sees while the new evaluator works: per paper, waiting / working / done / being checked, and
 * whether the report has been released. Looking at the status also restarts any stalled job.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = getServiceSupabase();
  if (!url || !anonKey || !service) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const supabase = createServerClient(url, anonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const staff = isCoachAccount(studentUserFromAuth(user));

  const { id } = await context.params;
  const { data } = await service.from("exam_attempts").select("*").eq("id", id).maybeSingle();
  if (!data || (!staff && (data as { user_id?: string }).user_id !== user.id)) {
    return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
  }
  const attempt = examAttemptFromRow(data as Record<string, unknown>);
  const origin = request.nextUrl.origin;

  let jobs = await jobsForAttempt(id).catch(() => []);
  if (!jobs.length && isAttemptSubmitted(attempt.status) && !attempt.coach_report_url) {
    const applies = newEvaluatorApplies({
      mode: await getEvaluatorMode(),
      sittingReady: isEvaluatorReadySitting(attempt.sitting_id),
      wholeSitting: Boolean(attempt.marked_script_p2_path || attempt.marked_script_p3_path),
      staffTest: attempt.source === STAFF_TEST_ATTEMPT_SOURCE || (staff && attempt.user_id === user.id),
    });
    // Submitted for the new evaluator but the jobs were never made (for example the submit request was cut short).
    if (applies) jobs = await createJobsForAttempt(attempt, origin).catch(() => []);
  }
  const released = Boolean(attempt.evaluator_report_released_at);
  if (!jobs.length) {
    if (!attempt.coach_report_url) return NextResponse.json({ evaluator: "old" });
    const report = releasedReportForAttempt({
      attemptId: id,
      coachReportUrl: attempt.coach_report_url,
      coachReportName: attempt.coach_report_name,
      released,
      staff,
      systemReady: false,
    });
    return NextResponse.json({
      evaluator: "v2",
      papers: [],
      all_done: true,
      released,
      report_url: report?.url ?? null,
      report_kind: report?.kind ?? "pdf",
    });
  }

  after(() => kickPendingJobs(id, origin).catch(() => undefined));

  const sitting = findPastPaperSitting(attempt.sitting_id);
  const papers = (sitting?.papers ?? []).map((paper) => {
    const job = jobs.find((j) => j.paper_id === paper.id) ?? null;
    return {
      paper_id: paper.id,
      title: paper.title,
      status: studentPaperStatus(job),
      ...questionsDone(job?.progress, paper.questions.length),
    };
  });
  const allDone = papers.every((p) => p.status === "done");
  const report = releasedReportForAttempt({
    attemptId: id,
    coachReportUrl: attempt.coach_report_url,
    coachReportName: attempt.coach_report_name,
    released,
    staff,
    systemReady: allDone,
  });
  return NextResponse.json({
    evaluator: "v2",
    papers,
    all_done: allDone,
    released,
    report_url: report?.url ?? null,
    report_kind: report?.kind ?? null,
  });
}
