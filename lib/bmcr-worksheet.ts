import { findRegisteredExam, findRegisteredPaper, type PastPaperSectionConfig } from "@/lib/data/past-papers";

export const FIRST_BMCR_WORKSHEET_SITTING_ID = "jan-2026";
export const FIRST_BMCR_WORKSHEET_PAPER_ID = "jan-2026-p1";

export type BmcrWorksheetRow = {
  code: string;
  title: string;
  totalMarks: number;
};

export type BmcrWorksheetPaper = {
  paperId: string;
  paperTitle: string;
  paperCode: string;
  paperTotalMarks: number;
  rows: BmcrWorksheetRow[];
};

export type BmcrSittingWorksheet = {
  examBody: "IAC";
  sittingId: string;
  sittingLabel: string;
  title: string;
  marksSource: string;
  papers: BmcrWorksheetPaper[];
};

function sittingLabelFromId(sittingId: string, fallback: string): string {
  if (sittingId === "jan-2025") return "January 2025";
  if (sittingId === "june-2025") return "June 2025";
  if (sittingId === "jan-2026") return "January 2026";
  if (sittingId === "june-2026") return "June 2026";
  return fallback.replace(/\s+SAICA IAC Examination$/i, "").replace(/\s+IAC Exam$/i, "");
}

function paperFromRegistry(paper: { id: string; title: string; code: string; totalMarks: number; sections: PastPaperSectionConfig[] }): BmcrWorksheetPaper {
  const rows = paper.sections.map((section) => ({
    code: section.code,
    title: section.title,
    totalMarks: section.totalMarks,
  }));
  const summed = rows.reduce((sum, row) => sum + row.totalMarks, 0);
  return {
    paperId: paper.id,
    paperTitle: paper.title,
    paperCode: paper.code,
    paperTotalMarks: paper.totalMarks || summed,
    rows,
  };
}

export function resolveBmcrSittingId(id: string | undefined | null): string | null {
  if (!id) return null;
  const exam = findRegisteredExam(id) || findRegisteredPaper(id)?.exam;
  return exam?.id || null;
}

/**
 * One printable BMCR for the whole sitting. Totals are registry `section.totalMarks`
 * (maximum awarded), not available mark-plan opportunities.
 */
export function bmcrWorksheetForSitting(id: string | undefined | null): BmcrSittingWorksheet | null {
  const exam = findRegisteredExam(id) || findRegisteredPaper(id)?.exam;
  if (!exam?.papers.some((paper) => paper.sections.length)) return null;
  const sittingLabel = sittingLabelFromId(exam.id, exam.title);
  return {
    examBody: "IAC",
    sittingId: exam.id,
    sittingLabel,
    title: `${sittingLabel} IAC — Basic Marks Conversion Rate`,
    marksSource: `lib/data/past-papers/iac-${exam.id}.json → papers[].sections[].totalMarks`,
    papers: exam.papers.filter((paper) => paper.sections.length).map(paperFromRegistry),
  };
}

export function worksheetHref(sittingOrPaperId: string): string {
  const sittingId = resolveBmcrSittingId(sittingOrPaperId) || sittingOrPaperId;
  return `/student/evaluator/worksheet/${encodeURIComponent(sittingId)}`;
}

export function hasPrintableBmcrWorksheet(sittingOrPaperId: string | undefined | null): boolean {
  return Boolean(bmcrWorksheetForSitting(sittingOrPaperId));
}
