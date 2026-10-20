/**
 * The evaluator split into steps that each fit inside one server request (Vercel stops a request after 5 minutes,
 * a whole paper takes 10 to 20). Each step reads the attempt again, does one piece of model work and returns what it
 * produced so the caller can save it before the next step starts:
 *   1. Stage 0 for the paper (page maps for script and marking report, the student's BMCR rows)
 *   2. Stage 1 for ONE requirement at a time
 *   3. Assemble the dataset (code only, no model call)
 * The calibration script (runEvaluation) uses the same steps in one go.
 */
import { examAttemptFromRow, type ExamAttempt } from "@/lib/exam-attempts";
import { findPastPaper } from "@/lib/past-papers";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { evaluatorModel, newUsage } from "./anthropic";
import { computeMetrics } from "./metrics";
import { loadSources, sourcesAsPromptText } from "./sources";
import { mapReportPages, mapScriptPages, readBmcr } from "./stage0";
import { evaluateRequirement } from "./stage1";
import type { BmcrRow, EvaluationDataset, PageMap, RequirementEvaluation, UsageTally } from "./types";

type PageRef = { page: number; url: string };

export type PaperContext = {
  attempt: ExamAttempt;
  paperId: string;
  paperLabel: string;
  requirements: { code: string; title: string; total_marks: number }[];
  questionText: string;
  officialText: string;
  scriptPages: PageRef[];
  reportPages: PageRef[];
  bmcrPages: PageRef[];
  sourceNotes: string[];
};

/** Everything a step needs about one paper of one attempt. Cheap: database reads only, no model call. */
export async function loadPaperContext(attemptId: string, paperIdOverride?: string): Promise<PaperContext> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Exam attempt not found.");
  const attempt = examAttemptFromRow(data as { [key: string]: unknown });

  const paperId = paperIdOverride || attempt.paper_id;
  const mapped = findPastPaper(paperId);
  if (!mapped) throw new Error(`Paper ${paperId} is not in the past-paper registry.`);
  if (mapped.sitting.id !== attempt.sitting_id) throw new Error(`Paper ${paperId} does not belong to this attempt's sitting (${attempt.sitting_id}).`);
  const paperLabel = mapped.paper.title;
  const requirements = mapped.paper.questions.map((q) => ({ code: q.code, title: q.title, total_marks: q.marks }));

  const sources = await loadSources(attempt.sitting_id, paperId);
  if (sources.missing.includes("question") || sources.missing.includes("solution")) {
    throw new Error(`Official sources incomplete (missing: ${sources.missing.join(", ")}). Evaluation not started.`);
  }

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
  return {
    attempt,
    paperId,
    paperLabel,
    requirements,
    questionText: sourcesAsPromptText(sources, ["question"]),
    officialText: sourcesAsPromptText(sources, ["question", "solution", "commentary", "competency"]),
    scriptPages,
    reportPages,
    bmcrPages,
    sourceNotes: sources.notes,
  };
}

/** What the steps have produced so far. Stored as JSON between steps. */
export type PaperProgress = {
  page_map: PageMap | null;
  bmcr_rows: BmcrRow[];
  evaluations: Record<string, RequirementEvaluation>;
  warnings: string[];
  usage: UsageTally;
};

export function emptyProgress(): PaperProgress {
  return { page_map: null, bmcr_rows: [], evaluations: {}, warnings: [], usage: newUsage() };
}

/** Step 1: Stage 0 page maps and BMCR rows for the paper. */
export async function runStage0(ctx: PaperContext, progress: PaperProgress): Promise<PaperProgress> {
  const expected = ctx.requirements.map((r) => ({ code: r.code, title: r.title }));
  const warnings: string[] = [];
  const usage = { ...progress.usage };
  const [{ map }, reportMap, bmcrRows] = await Promise.all([
    mapScriptPages({ paperLabel: ctx.paperLabel, expected, scriptPages: ctx.scriptPages, questionText: ctx.questionText, usage, warnings }),
    mapReportPages({ paperLabel: ctx.paperLabel, expected, reportPages: ctx.reportPages, usage, warnings }),
    readBmcr({ paperLabel: ctx.paperLabel, expected, bmcrPages: ctx.bmcrPages, usage, warnings }),
  ]);
  for (const row of map.requirements) row.report_pages = reportMap[row.code] || [];
  return { ...progress, page_map: map, bmcr_rows: bmcrRows, usage, warnings: [...progress.warnings, ...warnings] };
}

/** Step 2: Stage 1 for one requirement. */
export async function runRequirementStep(ctx: PaperContext, progress: PaperProgress, code: string): Promise<PaperProgress> {
  if (!progress.page_map) throw new Error("Stage 0 has not run for this paper.");
  const requirement = ctx.requirements.find((r) => r.code === code);
  if (!requirement) throw new Error(`Requirement ${code} is not on ${ctx.paperLabel}.`);
  const pageMap = progress.page_map.requirements.find((row) => row.code === code);
  if (!pageMap) throw new Error(`Requirement ${code} is missing from the page map.`);
  const usage = { ...progress.usage };
  const { evaluation, warnings } = await evaluateRequirement({
    requirement,
    pageMap,
    scriptPages: ctx.scriptPages,
    reportPages: ctx.reportPages,
    bmcr: progress.bmcr_rows.find((row) => row.code === code),
    officialText: ctx.officialText,
    usage,
    paperId: ctx.paperId,
  });
  return {
    ...progress,
    usage,
    evaluations: { ...progress.evaluations, [code]: evaluation },
    warnings: [...progress.warnings, ...warnings],
  };
}

/** The next requirement still to evaluate, in paper order, or null when all are done. */
export function nextRequirementCode(ctx: Pick<PaperContext, "requirements">, progress: PaperProgress, only?: string[]): string | null {
  const todo = ctx.requirements.filter((r) => (!only?.length || only.includes(r.code)) && !progress.evaluations[r.code]);
  return todo.length ? todo[0].code : null;
}

/** Step 3: assemble the dataset the reports are built from. Code only. */
export function assembleDataset(ctx: PaperContext, progress: PaperProgress): EvaluationDataset {
  if (!progress.page_map) throw new Error("Stage 0 has not run for this paper.");
  const evaluations = ctx.requirements.map((r) => progress.evaluations[r.code]).filter(Boolean) as RequirementEvaluation[];
  return {
    version: 1,
    attempt_id: ctx.attempt.id,
    sitting_id: ctx.attempt.sitting_id,
    paper_id: ctx.paperId,
    generated_at: new Date().toISOString(),
    model: evaluatorModel(),
    page_map: progress.page_map,
    bmcr_rows: progress.bmcr_rows,
    requirements: evaluations,
    metrics: evaluations.map(computeMetrics),
    source_notes: ctx.sourceNotes,
    warnings: progress.warnings,
  };
}
