import { getServiceSupabase } from "@/lib/supabase-admin";
import { evaluatorModel } from "./anthropic";
import { synthesiseReport } from "./stage2";
import { assembleDataset, emptyProgress, loadPaperContext, runRequirementStep, runStage0 } from "./steps";
import type { EvaluationDataset, EvaluationReport, UsageTally } from "./types";

export type RunOptions = {
  /** Which paper of a whole-sitting attempt to evaluate, e.g. "iac-2026-p2". Defaults to the attempt's own paper_id. */
  paperId?: string;
  /** Limit Stage 1 to these requirement codes (calibration). */
  only?: string[];
  /** Skip Stage 2 (dataset only). */
  datasetOnly?: boolean;
  /** Concurrent requirement evaluations. */
  concurrency?: number;
  onProgress?: (message: string) => void;
};

export type RunResult = { dataset: EvaluationDataset; report: EvaluationReport | null; usage: UsageTally };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export async function runEvaluation(attemptId: string, options: RunOptions = {}): Promise<RunResult> {
  const log = options.onProgress || (() => {});
  log("Loading official sources…");
  const ctx = await loadPaperContext(attemptId, options.paperId);

  log("Stage 0: mapping script pages by required label…");
  let progress = await runStage0(ctx, emptyProgress());

  const toRun = ctx.requirements.filter((r) => !options.only?.length || options.only.includes(r.code));
  log(`Stage 1: evaluating ${toRun.length} requirement(s)…`);
  // Requirements run side by side here; each one only adds its own entry, so the results are merged afterwards.
  const base = progress;
  const results = await mapLimit(toRun, options.concurrency ?? 3, async (requirement) => {
    log(`  ${requirement.code}…`);
    return runRequirementStep(ctx, { ...base, usage: { input_tokens: 0, output_tokens: 0, calls: 0 }, warnings: [] }, requirement.code);
  });
  for (const r of results) {
    progress = {
      ...progress,
      evaluations: { ...progress.evaluations, ...r.evaluations },
      warnings: [...progress.warnings, ...r.warnings],
      usage: {
        input_tokens: progress.usage.input_tokens + r.usage.input_tokens,
        output_tokens: progress.usage.output_tokens + r.usage.output_tokens,
        calls: progress.usage.calls + r.usage.calls,
      },
    };
  }
  const usage = progress.usage;
  const dataset: EvaluationDataset = assembleDataset(ctx, progress);

  let report: EvaluationReport | null = null;
  if (options.datasetOnly) {
    // dataset only
  } else if (options.only?.length) {
    // The coach layer looks across the whole script; a partial run would give misleading patterns.
    log("Stage 2 skipped: partial run (--only). Run the full script for whole-script patterns.");
  } else {
    log("Stage 2: synthesising report…");
    report = await synthesiseReport({ dataset, usage, model: evaluatorModel() });
  }
  return { dataset, report, usage };
}

/** Persist a run. Requires supabase/evaluator-runs.sql. */
export async function saveEvaluationRun(attemptId: string, result: RunResult, kind: "calibration" | "student" = "calibration") {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const { data, error } = await supabase
    .from("evaluator_runs")
    .insert({
      attempt_id: attemptId,
      kind,
      model: result.dataset.model,
      dataset: result.dataset,
      report: result.report,
      usage: result.usage,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
