import iacJan2025 from "./iac-jan-2025.json";

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

export type PastPaperRegistryEntry = {
  id: string;
  code: string;
  title: string;
  totalMarks: number;
  paperList: { id: string; code: string; title: string; totalMarks: number }[];
  sectionCodes: string[];
};

export const IAC_JAN_2025_CONFIG = iacJan2025 as PastExamConfig;

export const IAC_JAN_2025: PastPaperRegistryEntry = {
  id: IAC_JAN_2025_CONFIG.id,
  code: IAC_JAN_2025_CONFIG.code,
  title: IAC_JAN_2025_CONFIG.title,
  totalMarks: IAC_JAN_2025_CONFIG.totalMarks,
  paperList: IAC_JAN_2025_CONFIG.papers.map((paper) => ({
    id: paper.id,
    code: paper.code,
    title: paper.title,
    totalMarks: paper.totalMarks,
  })),
  sectionCodes: IAC_JAN_2025_CONFIG.papers.flatMap((paper) => paper.sections.map((section) => section.code)),
};

export const PAST_EXAMS: PastExamConfig[] = [IAC_JAN_2025_CONFIG];

export const PAST_PAPERS: PastPaperRegistryEntry[] = [IAC_JAN_2025];

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
