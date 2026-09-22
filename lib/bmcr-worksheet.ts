import { findRegisteredPaper, type PastPaperSectionConfig } from "@/lib/data/past-papers";
import { findPastPaper } from "@/lib/past-papers";

export const FIRST_BMCR_WORKSHEET_PAPER_ID = "jan-2026-p1";

export type BmcrWorksheetRow = {
  code: string;
  title: string;
  totalMarks: number;
};

export type BmcrWorksheet = {
  examBody: "IAC";
  sittingId: string;
  sittingLabel: string;
  paperId: string;
  paperTitle: string;
  paperCode: string;
  paperTotalMarks: number;
  marksSource: string;
  rows: BmcrWorksheetRow[];
};

function sittingLabelFromId(sittingId: string, fallback: string): string {
  if (sittingId === "jan-2025") return "January 2025";
  if (sittingId === "june-2025") return "June 2025";
  if (sittingId === "jan-2026") return "January 2026";
  if (sittingId === "june-2026") return "June 2026";
  return fallback;
}

/** Totals come from the approved past-paper registry `section.totalMarks`, not Direct/Indirect/Thinking. */
export function bmcrWorksheetForPaper(paperId: string | undefined | null): BmcrWorksheet | null {
  const registered = findRegisteredPaper(paperId);
  if (!registered?.paper.sections.length) return null;
  const mapped = findPastPaper(registered.paper.id);
  const sittingId = registered.exam.id;
  const rows = registered.paper.sections.map((section: PastPaperSectionConfig) => ({
    code: section.code,
    title: section.title,
    totalMarks: section.totalMarks,
  }));
  const summed = rows.reduce((sum, row) => sum + row.totalMarks, 0);
  return {
    examBody: "IAC",
    sittingId,
    sittingLabel: sittingLabelFromId(sittingId, registered.exam.title),
    paperId: registered.paper.id,
    paperTitle: registered.paper.title,
    paperCode: registered.paper.code,
    paperTotalMarks: registered.paper.totalMarks || summed,
    marksSource: `lib/data/past-papers/iac-${sittingId}.json → papers[].sections[].totalMarks`,
    rows,
  };
}

export function worksheetHref(paperId: string): string {
  return `/student/evaluator/worksheet/${encodeURIComponent(paperId)}`;
}

export function hasPrintableBmcrWorksheet(paperId: string | undefined | null): boolean {
  return Boolean(bmcrWorksheetForPaper(paperId));
}
