import { KNOWLEDGE_WEIGHT, round1 } from "./diagnostic-report";

export type ExamQuestion = {
  code: string;
  marks: number;
  title: string;
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

export const JUNE_2026_IAC: ExamSitting = {
  id: "june-2026-iac",
  label: "June 2026 IAC Exam",
  papers: [
    {
      id: "iac-2026-p1",
      code: "IAC-2026-P1",
      title: "Paper 1",
      total_marks: 120,
      questions: [
        { code: "P1Q1_a", marks: 22, title: "Inpahla SWOT" },
        { code: "P1Q1_b", marks: 11, title: "Inpahla Turnaround" },
        { code: "P1Q1_c", marks: 27, title: "Inpahla Capital Budget NPV" },
        { code: "P1Q1_d", marks: 6, title: "Inpahla SDGs" },
        { code: "P1Q2_e", marks: 14, title: "Inpahla Ethics & Covenants" },
        { code: "P1Q2_f", marks: 11, title: "Inpahla Client Acceptance" },
        { code: "P1Q2_g1", marks: 12, title: "Inpahla FS Risk Assessment" },
        { code: "P1Q2_g2", marks: 7, title: "Inpahla Audit Response" },
        { code: "P1Q2_h", marks: 10, title: "Inpahla Going Concern Audit" },
      ],
    },
    {
      id: "iac-2026-p2",
      code: "IAC-2026-P2",
      title: "Paper 2",
      total_marks: 120,
      questions: [
        { code: "P2Q1_a", marks: 70, title: "Med4Me Consolidated Direct Cash Flow" },
        { code: "P2Q2_b", marks: 10, title: "Med4Me Loyalty Programme Tax" },
        { code: "P2Q2_c", marks: 8, title: "Med4Me SARs s8C Tax" },
        { code: "P2Q2_d", marks: 6, title: "Med4Me VAT Branch Registration" },
        { code: "P2Q2_e", marks: 20, title: "Med4Me Clinic Expansion Tax" },
        { code: "P2Q2_f", marks: 6, title: "Med4Me Management Fees s80A" },
      ],
    },
    {
      id: "iac-2026-p3",
      code: "IAC-2026-P3",
      title: "Paper 3",
      total_marks: 120,
      questions: [
        { code: "P3Q1_a", marks: 33, title: "Beita Financial & Operational Risks" },
        { code: "P3Q1_b", marks: 43, title: "Beita Breakeven & Costing" },
        { code: "P3Q2_c", marks: 10, title: "Beita Governance & Ethics" },
        { code: "P3Q2_d", marks: 10, title: "Beita Minimum Wage NOCLAR" },
        { code: "P3Q2_e", marks: 24, title: "Beita Share & Dividend Audit" },
      ],
    },
  ],
};

export const EXAM_SITTINGS: ExamSitting[] = [JUNE_2026_IAC];

export function paperLabel(paper: ExamPaper): string {
  return `${paper.title} (${paper.code})`;
}

export function questionLabel(question: ExamQuestion): string {
  return `${question.code} · ${question.title} (${question.marks})`;
}

export function paperDisplayName(sitting: ExamSitting, paper: ExamPaper): string {
  return `${sitting.label} · ${paperLabel(paper)}`;
}

export function findSitting(examId: string): ExamSitting | undefined {
  return EXAM_SITTINGS.find((exam) => exam.id === examId);
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
  const mapped = findQuestionByCode(code);
  if (!mapped) return null;
  const max = mapped.question.marks;
  if (available > max + 0.05) {
    return `${code} is ${max} marks. Available marks cannot exceed that section total.`;
  }
  if (earned > max + 0.05) {
    return `${code} is ${max} marks. Earned marks cannot exceed that section total.`;
  }
  return null;
}
