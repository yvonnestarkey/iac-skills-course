/**
 * Pure rules for the student evaluator jobs (no database, no model), so they can be unit-tested.
 */
export type EvaluatorMode = "off" | "staff" | "all";
export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobStep = "stage0" | "requirements" | "assemble" | "done";

export const MAX_STEP_FAILURES = 3;
/** A claimed step may run for at most 5 minutes; the lock lasts a little longer so two workers never overlap. */
export const STEP_LOCK_MS = 6 * 60 * 1000;

export function parseEvaluatorMode(value: unknown): EvaluatorMode {
  return value === "off" || value === "all" ? value : "staff";
}

/**
 * Does the new evaluator take this submission? Only for sittings with Question Models, only for whole-sitting
 * uploads (all three scripts on one attempt), and only for the accounts the switch allows.
 */
export function newEvaluatorApplies(input: { mode: EvaluatorMode; sittingReady: boolean; wholeSitting: boolean; staffTest: boolean }): boolean {
  if (!input.sittingReady || !input.wholeSitting) return false;
  if (input.mode === "all") return true;
  if (input.mode === "staff") return input.staffTest;
  return false;
}

/** A job may be picked up when it is not finished and nobody holds a live lock on it. */
export function jobIsClaimable(job: { status: JobStatus; locked_until: string | null }, now = Date.now()): boolean {
  if (job.status === "done" || job.status === "failed") return false;
  return !job.locked_until || new Date(job.locked_until).getTime() < now;
}

export type PaperStatusForStudent = "waiting" | "working" | "done" | "checking";

/** What a student is told about one paper. A failed job is shown as "checking": Yvonne has been emailed. */
export function studentPaperStatus(job: { status: JobStatus } | null): PaperStatusForStudent {
  if (!job) return "waiting";
  if (job.status === "done") return "done";
  if (job.status === "failed") return "checking";
  return job.status === "running" ? "working" : "waiting";
}

/** Questions finished out of the paper's total, for a progress line. */
export function questionsDone(progress: unknown, total: number): { done: number; total: number } {
  const evaluations = (progress as { evaluations?: Record<string, unknown> } | null)?.evaluations ?? {};
  return { done: Math.min(Object.keys(evaluations).length, total), total };
}
