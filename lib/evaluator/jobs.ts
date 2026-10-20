/**
 * Background jobs for the student Script Evaluator (server only, service role).
 *
 * A submitted whole-sitting attempt gets one job per paper. Each job is worked through in small steps
 * (Stage 0, one question at a time, then the report data), each step in its own server request, because a request is
 * stopped after 5 minutes and a paper takes 10 to 20. Progress is saved after every step. A finished step starts the
 * next one by calling the step route again (with the job's own secret token). If that chain ever breaks, any page that
 * shows the status (the student's or Yvonne's) restarts it.
 */
import { randomBytes } from "node:crypto";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import type { ExamAttempt } from "@/lib/exam-attempts";
import { findPastPaperSitting } from "@/lib/past-papers";
import { sendResendEmail } from "@/lib/resend";
import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { MAX_STEP_FAILURES, STEP_LOCK_MS, jobIsClaimable, parseEvaluatorMode, type EvaluatorMode, type JobStatus, type JobStep } from "./job-rules";
import { assembleDataset, emptyProgress, loadPaperContext, nextRequirementCode, runRequirementStep, runStage0, type PaperContext, type PaperProgress } from "./steps";

export type EvaluatorJob = {
  id: string;
  attempt_id: string;
  paper_id: string;
  status: JobStatus;
  step: JobStep;
  progress: PaperProgress | Record<string, never>;
  failures: number;
  last_error: string | null;
  locked_until: string | null;
  worker_token: string;
  origin: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
};

function db() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return supabase;
}

export const EVALUATOR_JOBS_SQL_HINT = "Paste supabase/evaluator-jobs.sql in the Supabase SQL editor, then try again.";

/** The switch. Defaults to staff-only if the settings table is not there yet. */
export async function getEvaluatorMode(): Promise<EvaluatorMode> {
  const supabase = getServiceSupabase();
  if (!supabase) return "staff";
  const { data, error } = await supabase.from("evaluator_settings").select("mode").eq("id", 1).maybeSingle();
  if (error || !data) return "staff";
  return parseEvaluatorMode((data as { mode?: string }).mode);
}

export async function setEvaluatorMode(mode: EvaluatorMode): Promise<void> {
  const { error } = await db().from("evaluator_settings").upsert({ id: 1, mode, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function jobsForAttempt(attemptId: string): Promise<EvaluatorJob[]> {
  const { data, error } = await db().from("evaluator_jobs").select("*").eq("attempt_id", attemptId);
  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluatorJob[];
}

/** One job per paper of the attempt's sitting. Existing jobs are left as they are. */
export async function createJobsForAttempt(attempt: Pick<ExamAttempt, "id" | "sitting_id">, origin: string): Promise<EvaluatorJob[]> {
  const sitting = findPastPaperSitting(attempt.sitting_id);
  if (!sitting) throw new Error(`Unknown sitting ${attempt.sitting_id}.`);
  const rows = sitting.papers.map((paper) => ({
    attempt_id: attempt.id,
    paper_id: paper.id,
    worker_token: randomBytes(24).toString("hex"),
    origin,
  }));
  const { error } = await db().from("evaluator_jobs").upsert(rows, { onConflict: "attempt_id,paper_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return jobsForAttempt(attempt.id);
}

/** Ask the site to run the job's next step. Returns quickly: the step itself runs after the response. */
export async function kickJob(job: Pick<EvaluatorJob, "id" | "worker_token" | "origin">, fallbackOrigin?: string): Promise<void> {
  const origin = job.origin || fallbackOrigin;
  if (!origin) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    await fetch(`${origin}/api/evaluator/jobs/${job.id}/step`, {
      method: "POST",
      headers: { "x-worker-token": job.worker_token },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // The status pages restart a stalled job, so a lost kick is not fatal.
  } finally {
    clearTimeout(timer);
  }
}

/** Restart any job of the attempt that is waiting or whose last step stopped without finishing. */
export async function kickPendingJobs(attemptId: string, fallbackOrigin?: string): Promise<void> {
  const now = Date.now();
  const jobs = await jobsForAttempt(attemptId);
  await Promise.all(
    jobs
      .filter((job) => (job.status === "queued" || job.status === "running") && (!job.locked_until || new Date(job.locked_until).getTime() < now))
      .map((job) => kickJob(job, fallbackOrigin))
  );
}

/**
 * Take the job for one step. Returns null if it is finished, another request is already working on it, or it has
 * used up its tries. Each claim counts as a try on the current step (a success resets the count), so a step that is
 * cut off by the 5-minute limit is counted too, and cannot loop for ever.
 */
export async function claimJob(jobId: string): Promise<EvaluatorJob | null> {
  const supabase = db();
  const { data: currentRow, error: readError } = await supabase.from("evaluator_jobs").select("*").eq("id", jobId).maybeSingle();
  if (readError) throw new Error(readError.message);
  const current = currentRow as EvaluatorJob | null;
  if (!current || !jobIsClaimable(current)) return null;
  if (current.failures >= MAX_STEP_FAILURES) {
    await supabase.from("evaluator_jobs").update({ status: "failed", locked_until: null, updated_at: new Date().toISOString() }).eq("id", jobId).eq("updated_at", current.updated_at);
    await notifyYvonne(
      `Script Evaluator needs attention: ${await studentLabel(current.attempt_id)}`,
      `The ${current.paper_id} evaluation stopped after ${current.failures} tries at step "${current.step}".\n\nLast error: ${current.last_error ?? "the step did not finish in time"}\n\nRetry it in Coach tools > Script Evaluator reports.\n${current.origin ?? ""}/coach/evaluator`,
      `evaluator-failed-${current.id}-${current.updated_at}`
    );
    return null;
  }
  const now = new Date();
  const { data, error } = await supabase
    .from("evaluator_jobs")
    .update({
      status: "running",
      failures: current.failures + 1,
      locked_until: new Date(now.getTime() + STEP_LOCK_MS).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", jobId)
    .eq("updated_at", current.updated_at) // only if nobody else claimed it in between
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EvaluatorJob | null) ?? null;
}

async function loadContextPreparingEvidence(job: EvaluatorJob): Promise<PaperContext> {
  try {
    return await loadPaperContext(job.attempt_id, job.paper_id);
  } catch (error) {
    if (!/Page images missing/.test(error instanceof Error ? error.message : "")) throw error;
    // The page scans are made right after submit; if they are not ready yet, make them now and try once more.
    await prepareExamAttemptEvidence(job.attempt_id);
    return loadPaperContext(job.attempt_id, job.paper_id);
  }
}

function asProgress(value: EvaluatorJob["progress"]): PaperProgress {
  const p = value as Partial<PaperProgress>;
  return p && p.usage && p.evaluations ? (p as PaperProgress) : emptyProgress();
}

async function notifyYvonne(subject: string, text: string, idempotencyKey: string) {
  try {
    await sendResendEmail({ to: REGISTRATION_CONTACT_EMAIL, subject, text, idempotencyKey });
  } catch {
    // Email is a convenience; the review page shows the same information.
  }
}

async function studentLabel(attemptId: string): Promise<string> {
  const supabase = db();
  const { data: attempt } = await supabase.from("exam_attempts").select("user_id, sitting_label").eq("id", attemptId).maybeSingle();
  const row = attempt as { user_id?: string; sitting_label?: string } | null;
  if (!row?.user_id) return "A student";
  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", row.user_id).maybeSingle();
  const p = profile as { email?: string; full_name?: string | null } | null;
  return `${p?.full_name || p?.email || "A student"}${row.sitting_label ? ` (${row.sitting_label})` : ""}`;
}

/**
 * Run one step of a claimed job and save the result. Returns finished=true when the job is done or has failed for good,
 * so the caller knows whether to start the next step.
 */
export async function runClaimedStep(job: EvaluatorJob): Promise<{ finished: boolean; retrying: boolean }> {
  const supabase = db();
  let progress = asProgress(job.progress);
  let step: JobStep = job.step;
  try {
    const ctx = await loadContextPreparingEvidence(job);
    if (step === "stage0") {
      progress = await runStage0(ctx, progress);
      step = "requirements";
    } else if (step === "requirements") {
      const code = nextRequirementCode(ctx, progress);
      if (code) progress = await runRequirementStep(ctx, progress, code);
      if (!nextRequirementCode(ctx, progress)) step = "assemble";
    }
    let runId: string | null = job.run_id;
    if (step === "assemble") {
      const dataset = assembleDataset(ctx, progress);
      const { data, error } = await supabase
        .from("evaluator_runs")
        .insert({ attempt_id: job.attempt_id, kind: "student", model: dataset.model, dataset, report: null, usage: progress.usage })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      runId = (data as { id: string }).id;
      step = "done";
    }
    const finished = step === "done";
    const { error: saveError } = await supabase
      .from("evaluator_jobs")
      .update({
        progress,
        step,
        status: finished ? "done" : "running",
        failures: 0,
        last_error: null,
        locked_until: null,
        run_id: runId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (saveError) throw new Error(saveError.message);
    if (finished) {
      const jobs = await jobsForAttempt(job.attempt_id);
      if (jobs.length && jobs.every((j) => j.status === "done")) {
        await notifyYvonne(
          `Script Evaluator report ready for review: ${await studentLabel(job.attempt_id)}`,
          `All papers for this attempt have been evaluated. Review and release the report in Coach tools > Script Evaluator reports.\n\n${job.origin ?? ""}/coach/evaluator`,
          `evaluator-ready-${job.attempt_id}`
        );
      }
    }
    return { finished, retrying: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failures = job.failures; // this try was counted when the step was claimed
    const failed = failures >= MAX_STEP_FAILURES;
    await supabase
      .from("evaluator_jobs")
      .update({ status: failed ? "failed" : "running", failures, last_error: message.slice(0, 2000), locked_until: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    if (failed) {
      await notifyYvonne(
        `Script Evaluator needs attention: ${await studentLabel(job.attempt_id)}`,
        `The ${job.paper_id} evaluation stopped after ${failures} tries at step "${step}".\n\nError: ${message}\n\nRetry it in Coach tools > Script Evaluator reports.\n${job.origin ?? ""}/coach/evaluator`,
        `evaluator-failed-${job.id}-${job.updated_at}`
      );
    }
    return { finished: failed, retrying: !failed };
  }
}

/** Staff: put a failed job back in the queue (keeps the progress it had). */
export async function retryJob(jobId: string): Promise<EvaluatorJob | null> {
  const { data, error } = await db()
    .from("evaluator_jobs")
    .update({ status: "running", failures: 0, last_error: null, locked_until: null, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EvaluatorJob | null) ?? null;
}

/** The finished dataset per paper for an attempt, from each job's saved run. */
export async function attemptRunIds(attemptId: string): Promise<string[]> {
  return (await jobsForAttempt(attemptId)).map((job) => job.run_id).filter((id): id is string => Boolean(id));
}
