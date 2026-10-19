import { examAttemptFromRow } from "@/lib/exam-attempts";
import { findPastPaper } from "@/lib/past-papers";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { evaluatorModel, newUsage } from "./anthropic";
import { computeMetrics } from "./metrics";
import { loadSources, sourcesAsPromptText } from "./sources";
import { mapReportPages, mapScriptPages, readBmcr } from "./stage0";
import { evaluateRequirement } from "./stage1";
import { synthesiseReport } from "./stage2";
import type { EvaluationDataset, EvaluationReport, RequirementEvaluation, UsageTally } from "./types";

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
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Exam attempt not found.");
  const attempt = examAttemptFromRow(data as { [key: string]: unknown });

  const paperId = options.paperId || attempt.paper_id;
  const mapped = findPastPaper(paperId);
  if (!mapped) throw new Error(`Paper ${paperId} is not in the past-paper registry.`);
  if (mapped.sitting.id !== attempt.sitting_id) throw new Error(`Paper ${paperId} does not belong to this attempt's sitting (${attempt.sitting_id}).`);
  const paperLabel = mapped.paper.title;
  const requirements = mapped.paper.questions.map((q) => ({ code: q.code, title: q.title, total_marks: q.marks }));
  const expected = requirements.map((r) => ({ code: r.code, title: r.title }));

  const usage = newUsage();
  const warnings: string[] = [];

  log("Loading official sources…");
  const sources = await loadSources(attempt.sitting_id, paperId);
  if (sources.missing.includes("question") || sources.missing.includes("solution")) {
    throw new Error(`Official sources incomplete (missing: ${sources.missing.join(", ")}). Evaluation not started.`);
  }
  const questionText = sourcesAsPromptText(sources, ["question"]);
  const officialText = sourcesAsPromptText(sources, ["question", "solution", "commentary", "competency"]);

  // A whole-sitting attempt keeps Paper 1 in marked_script and Papers 2 and 3 in their own slots.
  // An older single-paper attempt keeps its one script in marked_script whichever paper it was.
  const paperIndex = mapped.sitting.papers.findIndex((paper) => paper.id === mapped.paper.id);
  const wholeSitting = Boolean(attempt.page_images.marked_script_p2?.length || attempt.page_images.marked_script_p3?.length);
  const scriptKind = !wholeSitting || paperIndex <= 0 ? "marked_script" : paperIndex === 1 ? "marked_script_p2" : "marked_script_p3";
  const scriptPages = attempt.page_images[scriptKind] || [];
  const reportPages = attempt.page_images.marking_report || [];
  const bmcrPages = attempt.page_images.bmcr_worksheet || [];
  if (!scriptPages.length || !reportPages.length || !bmcrPages.length) {
    throw new Error(`Page images missing for the BMCR, the ${paperLabel} script or the marking report. Run evidence preparation first.`);
  }

  log("Stage 0: mapping script pages by required label…");
  const [{ map }, reportMap, bmcrRows] = await Promise.all([
    mapScriptPages({ paperLabel, expected, scriptPages, questionText, usage, warnings }),
    mapReportPages({ paperLabel, expected, reportPages, usage, warnings }),
    readBmcr({ paperLabel, expected, bmcrPages, usage, warnings }),
  ]);
  for (const row of map.requirements) row.report_pages = reportMap[row.code] || [];

  const toRun = requirements.filter((r) => !options.only?.length || options.only.includes(r.code));
  log(`Stage 1: evaluating ${toRun.length} requirement(s)…`);
  const evaluated = await mapLimit(toRun, options.concurrency ?? 3, async (requirement) => {
    const pageMap = map.requirements.find((row) => row.code === requirement.code)!;
    log(`  ${pageMap.label}…`);
    return evaluateRequirement({
      requirement,
      pageMap,
      scriptPages,
      reportPages,
      bmcr: bmcrRows.find((row) => row.code === requirement.code),
      officialText,
      usage,
      paperId,
    });
  });

  const evaluations: RequirementEvaluation[] = evaluated.map((item) => item.evaluation);
  for (const item of evaluated) warnings.push(...item.warnings);

  const dataset: EvaluationDataset = {
    version: 1,
    attempt_id: attempt.id,
    sitting_id: attempt.sitting_id,
    paper_id: paperId,
    generated_at: new Date().toISOString(),
    model: evaluatorModel(),
    page_map: map,
    bmcr_rows: bmcrRows,
    requirements: evaluations,
    metrics: evaluations.map(computeMetrics),
    source_notes: sources.notes,
    warnings,
  };

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
