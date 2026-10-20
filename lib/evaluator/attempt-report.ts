import { findPastPaper, findPastPaperSitting } from "@/lib/past-papers";
import { buildOverallReport } from "./overall-report";
import { PAPER_NAMES } from "./report-text";
import { buildPaperReport, paperNumber } from "./student-report";
import type { EvaluationDataset } from "./types";

/** Keep the most recently saved dataset per paper, in paper order. */
export function latestDatasetPerPaper(rows: { created_at: string; dataset: EvaluationDataset }[]): EvaluationDataset[] {
  const latest = new Map<string, { created_at: string; dataset: EvaluationDataset }>();
  for (const row of rows) {
    const prev = latest.get(row.dataset.paper_id);
    if (!prev || prev.created_at < row.created_at) latest.set(row.dataset.paper_id, row);
  }
  return [...latest.values()].map((v) => v.dataset).sort((a, b) => paperNumber(a) - paperNumber(b));
}

/** The full student report: the Overall Report, then one Per Paper Report per paper (markdown sections). */
export function attemptReportSections(datasets: EvaluationDataset[], studentName?: string, sittingLabel?: string): string[] {
  const label = sittingLabel || (datasets[0] ? findPastPaperSitting(datasets[0].sitting_id)?.label : undefined);
  const paperNames: Record<number, string> = {};
  for (const d of datasets) if (PAPER_NAMES[d.paper_id]) paperNames[paperNumber(d)] = PAPER_NAMES[d.paper_id];
  return [
    buildOverallReport(datasets, { studentName, sittingLabel: label, paperNames }),
    ...datasets.map((d) => {
      const titles: Record<string, string> = {};
      for (const q of findPastPaper(d.paper_id)?.paper.questions ?? []) titles[q.code] = q.title;
      return buildPaperReport(d, { studentName, sittingLabel: label, paperNames, titles });
    }),
  ];
}
