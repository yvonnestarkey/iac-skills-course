import iacJan2025 from "./iac-jan-2025.json";
import iacJune2025 from "./iac-june-2025.json";
import iacJan2026 from "./iac-jan-2026.json";

export type PastPaperSectionConfig = {
  code: string;
  title: string;
  totalMarks: number;
  isCalculation?: boolean;
  direct: number;
  indirect: number;
  thinking: number;
  macroComm: number;
};

export type PastPaperConfig = {
  id: string;
  code: string;
  title: string;
  caseName?: string;
  totalMarks: number;
  sections: PastPaperSectionConfig[];
};

export type PastExamConfig = {
  id: string;
  code: string;
  title: string;
  totalMarks: number;
  papers: PastPaperConfig[];
};

export type PastPaperMarkCaps = {
  total: number;
  direct: number;
  indirect: number;
  thinking: number;
  macroComm: number;
};

export type PastPaperRegistryEntry = {
  id: string;
  code: string;
  title: string;
  totalMarks: number;
  paperList: { id: string; code: string; title: string; totalMarks: number }[];
  sectionCodes: string[];
  markCaps: PastPaperMarkCaps;
};

function sumCaps(exam: PastExamConfig): PastPaperMarkCaps {
  const sections = exam.papers.flatMap((paper) => paper.sections);
  return {
    total: exam.totalMarks,
    direct: sections.reduce((sum, section) => sum + section.direct, 0),
    indirect: sections.reduce((sum, section) => sum + section.indirect, 0),
    thinking: sections.reduce((sum, section) => sum + section.thinking, 0),
    macroComm: sections.reduce((sum, section) => sum + section.macroComm, 0),
  };
}

function registryEntry(exam: PastExamConfig): PastPaperRegistryEntry {
  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    totalMarks: exam.totalMarks,
    paperList: exam.papers.map((paper) => ({
      id: paper.id,
      code: paper.code,
      title: paper.title,
      totalMarks: paper.totalMarks,
    })),
    sectionCodes: exam.papers.flatMap((paper) => paper.sections.map((section) => section.code)),
    markCaps: sumCaps(exam),
  };
}

export const IAC_JAN_2025_CONFIG = iacJan2025 as PastExamConfig;
export const IAC_JUNE_2025_CONFIG = iacJune2025 as PastExamConfig;
export const IAC_JAN_2026_CONFIG = iacJan2026 as PastExamConfig;

export const IAC_JAN_2025 = registryEntry(IAC_JAN_2025_CONFIG);
export const IAC_JUNE_2025 = registryEntry(IAC_JUNE_2025_CONFIG);
export const IAC_JAN_2026 = registryEntry(IAC_JAN_2026_CONFIG);

export const PAST_EXAMS: PastExamConfig[] = [IAC_JAN_2025_CONFIG, IAC_JUNE_2025_CONFIG, IAC_JAN_2026_CONFIG];

export const PAST_PAPERS: PastPaperRegistryEntry[] = [IAC_JAN_2025, IAC_JUNE_2025, IAC_JAN_2026];

export function findRegisteredExam(paperId: string | undefined | null): PastExamConfig | null {
  if (!paperId) return null;
  const needle = paperId.trim().toLowerCase();
  return (
    PAST_EXAMS.find(
      (exam) =>
        exam.id.toLowerCase() === needle ||
        exam.code.toLowerCase() === needle ||
        exam.code.replace(/_/g, "-").toLowerCase() === needle
    ) || null
  );
}

export function findRegisteredPaper(
  paperId: string | undefined | null
): { exam: PastExamConfig; paper: PastPaperConfig } | null {
  if (!paperId) return null;
  const exam = findRegisteredExam(paperId);
  if (exam) return { exam, paper: exam.papers[0] };
  const needle = paperId.trim().toLowerCase();
  for (const item of PAST_EXAMS) {
    const paper = item.papers.find(
      (entry) => entry.id.toLowerCase() === needle || entry.code.toLowerCase() === needle
    );
    if (paper) return { exam: item, paper };
  }
  return null;
}

export function sectionsForPaperId(paperId: string | undefined | null): PastPaperSectionConfig[] {
  if (!paperId) return [];
  const exam = findRegisteredExam(paperId);
  if (exam) return exam.papers.flatMap((paper) => paper.sections);
  const mapped = findRegisteredPaper(paperId);
  return mapped?.paper.sections || [];
}

export function allSectionCodes(exam: PastExamConfig = IAC_JAN_2025_CONFIG): string[] {
  return exam.papers.flatMap((paper) => paper.sections.map((section) => section.code));
}
