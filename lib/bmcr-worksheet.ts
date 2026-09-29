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

export function worksheetHref(sittingOrPaperId: string, from?: string): string {
  const sittingId = resolveBmcrSittingId(sittingOrPaperId) || sittingOrPaperId;
  const path = `/student/evaluator/worksheet/${encodeURIComponent(sittingId)}`;
  if (!from) return path;
  return `${path}?${new URLSearchParams({ from }).toString()}`;
}

/** Safe return into the evaluator after printing. Standalone visits continue with the sitting selected. */
export function evaluatorContinueHref(from: string | undefined | null, sittingId: string): string {
  const fallback = `/student/evaluator/new?sitting=${encodeURIComponent(sittingId)}`;
  const raw = String(from || "").trim();
  if (!raw.startsWith("/student/evaluator") || raw.startsWith("//") || /:\/\//.test(raw)) return fallback;
  return raw;
}

export function hasPrintableBmcrWorksheet(sittingOrPaperId: string | undefined | null): boolean {
  return Boolean(bmcrWorksheetForSitting(sittingOrPaperId));
}

/** Print-only labels. Official `row.title` stays the full required wording. */
const JUNE_2026_PRINT_LABELS: Record<string, string> = {
  P1Q1_a: "SWOT / going concern",
  P1Q1_b: "Turnaround financing proposals",
  P1Q1_c: "Zug AG capital budget",
  P1Q1_d: "Green initiatives / SDGs 6 & 7",
  P1Q2_e: "Ethics / loan-covenant defaults",
  P1Q2_f: "Audit acceptance factors",
  P1Q2_g1: "RoMM at financial-statement level",
  P1Q2_g2: "Overall audit response",
  P1Q2_h: "Going-concern audit procedures",
  P2Q1_a: "Operating & investing cash flows",
  P2Q2_b: "VAT / patient loyalty programme",
  P2Q2_c: "Normal tax / SARs expense",
  P2Q2_d: "Separate VAT vendors (clinics)",
  P2Q2_e: "VAT & tax / clinic expansion",
  P2Q2_f: "Management fees tax",
  P3Q1_a: "Financial & operational risks",
  P3Q1_b: "Breakeven sales (units)",
  P3Q2_c: "Management ethics",
  P3Q2_d: "WhatsApp conversation",
  P3Q2_e: "Share issue & dividend procedures",
};

const PRINT_LABEL_MAX = 52;

function shortenRequiredTitle(officialTitle: string): string {
  const trimmed = officialTitle.replace(/\s+/g, " ").trim();
  const stripped = trimmed
    .replace(/^(prepare|discuss|evaluate|describe|advise|calculate|formulate|assess|write a report identifying|write a report|write)\s+/i, "")
    .replace(/^using the direct method,\s*/i, "")
    .replace(/^(a |an |the |any )/i, "");
  const compact = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  if (compact.length <= PRINT_LABEL_MAX) return compact;
  const cut = compact.slice(0, PRINT_LABEL_MAX);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > 24 ? cut.slice(0, atSpace) : cut).trim()}…`;
}

export function bmcrPrintQuestionLabel(code: string, officialTitle: string, sittingId?: string): string {
  if (sittingId === "june-2026") {
    const mapped = JUNE_2026_PRINT_LABELS[code];
    if (mapped) return mapped;
  }
  return shortenRequiredTitle(officialTitle);
}

export function bmcrPrintSheetTitle(sittingLabel: string): string {
  return `${sittingLabel} IAC — BMCR Worksheet`;
}

export function bmcrPrintPaperLine(paper: Pick<BmcrWorksheetPaper, "paperTitle" | "paperTotalMarks">): string {
  const match = paper.paperTitle.match(/^(Paper\s+\d+)\s*[–—-]\s*(.+)$/i);
  if (match) return `${match[1]} — ${match[2].trim()} · ${paper.paperTotalMarks} marks`;
  return `${paper.paperTitle} · ${paper.paperTotalMarks} marks`;
}

/** Measured against the print stylesheet so one paper stays on one A4 page. */
export const BMCR_PRINT_A4_MM = {
  pageHeight: 297,
  marginTop: 10,
  marginBottom: 10,
  header: 22,
  instruction: 36,
  tableHead: 9,
  row: 9.2,
  totalRow: 10,
  afterTable: 2,
};

export function bmcrPrintPaperHeightMm(rowCount: number, includeInstructions: boolean): number {
  const { header, instruction, tableHead, row, totalRow, afterTable } = BMCR_PRINT_A4_MM;
  return header + (includeInstructions ? instruction : 0) + tableHead + rowCount * row + totalRow + afterTable;
}

export function bmcrPrintUsableHeightMm(): number {
  return BMCR_PRINT_A4_MM.pageHeight - BMCR_PRINT_A4_MM.marginTop - BMCR_PRINT_A4_MM.marginBottom;
}

export function bmcrPrintPagePlan(worksheet: BmcrSittingWorksheet): {
  pages: { paperId: string; page: number; heightMm: number; overflowMm: number }[];
  pageCount: number;
} {
  const usable = bmcrPrintUsableHeightMm();
  const pages = worksheet.papers.map((paper, index) => {
    const heightMm = bmcrPrintPaperHeightMm(paper.rows.length, index === 0);
    return {
      paperId: paper.paperId,
      page: index + 1,
      heightMm,
      overflowMm: Math.max(0, Math.round((heightMm - usable) * 10) / 10),
    };
  });
  return { pages, pageCount: pages.length };
}
