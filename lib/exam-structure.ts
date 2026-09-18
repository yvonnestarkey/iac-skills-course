import { KNOWLEDGE_WEIGHT, round1 } from "./diagnostic-report";
import { PAST_PAPER_SITTINGS, type PastPaperSitting } from "./past-papers";

export type ExamQuestion = {
  code: string;
  marks: number;
  title: string;
  isCalculation?: boolean;
};

export type ExamPaper = {
  id: string;
  code: string;
  title: string;
  total_marks: number;
  questions: ExamQuestion[];
};

export type ExamSitting = {
  id: string;
  label: string;
  papers: ExamPaper[];
};

export function examSittingFromPastPaper(sitting: PastPaperSitting): ExamSitting {
  return {
    id: sitting.id,
    label: sitting.label,
    papers: sitting.papers.map((paper) => ({
      id: paper.id,
      code: paper.code,
      title: paper.title,
      total_marks: paper.total_marks,
      questions: paper.questions.map((question) => ({
        code: question.code,
        marks: question.marks,
        title: question.title,
        isCalculation: question.isCalculation,
      })),
    })),
  };
}

export const EXAM_SITTINGS: ExamSitting[] = PAST_PAPER_SITTINGS.map(examSittingFromPastPaper);

export const JUNE_2026_IAC: ExamSitting =
  EXAM_SITTINGS.find((sitting) => sitting.id === "june-2026") || EXAM_SITTINGS[EXAM_SITTINGS.length - 1]!;

export function paperLabel(paper: ExamPaper): string {
  return `${paper.title} (${paper.code})`;
}

export function questionLabel(question: ExamQuestion): string {
  return `${question.code} · ${question.title} (${question.marks})`;
}

export function isCalculationQuestion(question: ExamQuestion): boolean {
  return Boolean(question.isCalculation);
}

export function paperDisplayName(sitting: ExamSitting, paper: ExamPaper): string {
  return `${sitting.label} · ${paperLabel(paper)}`;
}

function normalizeExamId(examId: string): string {
  if (examId === "june-2026-iac") return "june-2026";
  return examId;
}

export function findSitting(examId: string | undefined | null): ExamSitting | undefined {
  if (!examId) return undefined;
  const needle = normalizeExamId(examId);
  return EXAM_SITTINGS.find((exam) => exam.id === needle);
}

export function findPaper(examId: string, paperId: string): ExamPaper | undefined {
  return findSitting(examId)?.papers.find((paper) => paper.id === paperId || paper.code === paperId);
}

export function findQuestion(examId: string, paperId: string, code: string): ExamQuestion | undefined {
  return findPaper(examId, paperId)?.questions.find((question) => question.code === code);
}

export function findQuestionByCode(code: string): { sitting: ExamSitting; paper: ExamPaper; question: ExamQuestion } | null {
  for (const sitting of EXAM_SITTINGS) {
    for (const paper of sitting.papers) {
      const question = paper.questions.find((item) => item.code === code);
      if (question) return { sitting, paper, question };
    }
  }
  return null;
}

export function splitSectionMarks(total: number): { knowledge: number; application: number } {
  const knowledge = round1(total * KNOWLEDGE_WEIGHT);
  const application = round1(Math.max(0, total - knowledge));
  return { knowledge, application };
}

export function sectionCapError(code: string, available: number, earned: number): string | null {
  const matches: ExamQuestion[] = [];
  for (const sitting of EXAM_SITTINGS) {
    for (const paper of sitting.papers) {
      const question = paper.questions.find((item) => item.code === code);
      if (question) matches.push(question);
    }
  }
  if (!matches.length) return null;
  const max = Math.max(...matches.map((question) => question.marks));
  if (available > max + 0.05) {
    return `${code} is ${max} marks. Available marks cannot exceed that section total.`;
  }
  if (earned > max + 0.05) {
    return `${code} is ${max} marks. Earned marks cannot exceed that section total.`;
  }
  return null;
}
