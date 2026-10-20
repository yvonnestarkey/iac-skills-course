import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import {
  attemptHasAllRequiredFiles,
  attemptPaperName,
  examAttemptFromRow,
  isAttemptSubmitted,
  isMissingExamAttemptsTable,
  requestScriptEvaluation,
} from "@/lib/exam-attempts";
import { newEvaluatorApplies } from "@/lib/evaluator/job-rules";
import { createJobsForAttempt, getEvaluatorMode, kickJob } from "@/lib/evaluator/jobs";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";
import { isCoachAccount } from "@/lib/roles";
import { STAFF_TEST_ATTEMPT_SOURCE } from "@/lib/staff-access";
import { studentUserFromAuth } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: isMissingExamAttemptsTable(error.message)
          ? "Paste supabase/exam-attempts.sql in the Supabase SQL editor, then try again."
          : error.message,
      },
      { status: 400 }
    );
  }
  if (!data) return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });

  const attempt = examAttemptFromRow(data as Record<string, unknown>);
  if (!isAttemptSubmitted(attempt.status)) {
    if (!attemptHasAllRequiredFiles(attempt)) {
      return NextResponse.json(
        { error: "Upload the completed BMCR worksheet, Paper 1, Paper 2, Paper 3, and the marking report first." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("exam_attempts")
      .update({ status: "analysing", submitted_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // The new evaluator takes whole-sitting uploads for sittings it has Question Models for, for the accounts the
  // switch allows (Coach tools > Script Evaluator reports). Everything else keeps the old evaluator for now.
  const useNewEvaluator = newEvaluatorApplies({
    mode: await getEvaluatorMode(),
    sittingReady: isEvaluatorReadySitting(attempt.sitting_id),
    wholeSitting: Boolean(attempt.marked_script_p2_path || attempt.marked_script_p3_path),
    staffTest: attempt.source === STAFF_TEST_ATTEMPT_SOURCE || isCoachAccount(studentUserFromAuth(user)),
  });
  const origin = request.nextUrl.origin;

  if (useNewEvaluator) {
    after(async () => {
      void prepareExamAttemptEvidence(id);
      try {
        const jobs = await createJobsForAttempt(attempt, origin);
        await Promise.all(jobs.filter((job) => job.status !== "done").map((job) => kickJob(job, origin)));
      } catch {
        // The status page retries job creation and restarts stalled jobs.
      }
    });
    return NextResponse.json({ ok: true, status: "analysing", evaluator: "v2" });
  }

  after(() => {
    void prepareExamAttemptEvidence(id);
    if (attempt.marked_script_url && !attempt.evaluation_id) {
      void requestScriptEvaluation({
        fileUrl: attempt.marked_script_url,
        paperName: attemptPaperName(attempt),
        userId: user.id,
        attemptId: id,
        pageImageUrls: (attempt.page_images.marked_script || []).map((page) => page.url).filter(Boolean),
        origin: request.nextUrl.origin,
        cookie: request.headers.get("cookie") || "",
      });
    }
  });

  return NextResponse.json({ ok: true, status: "analysing" });
}
