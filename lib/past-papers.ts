import pastPaperData from "@/data/past-papers.json";
import { KNOWLEDGE_WEIGHT, round1 } from "@/lib/diagnostic-report";
import { PAST_EXAMS, type PastExamConfig } from "@/lib/data/past-papers";

export type PastPaperQuestion = {
  code: string;
  title: string;
  marks: number;
  isCalculation?: boolean;
  direct_available: number;
  indirect_available: number;
  thinking_available: number;
};

export type PastPaperBuriedTreasureCaps = {
  direct_available: number;
  indirect_available: number;
  thinking_available: number;
};

export type PastPaper = {
  id: string;
  code: string;
  title: string;
  total_marks: number;
  buried_treasure: PastPaperBuriedTreasureCaps;
  questions: PastPaperQuestion[];
};

export type PastPaperSitting = {
  id: string;
  label: string;
  papers: PastPaper[];
};

function sittingLabel(exam: PastExamConfig): string {
  if (exam.id === "jan-2025") return "January 2025 IAC Exam";
  if (exam.id === "june-2025") return "June 2025 IAC Exam";
  if (exam.id === "jan-2026") return "January 2026 IAC Exam";
  return exam.title;
}

function examToSitting(exam: PastExamConfig): PastPaperSitting {
  return {
    id: exam.id,
    label: sittingLabel(exam),
    papers: exam.papers.map((paper) => {
      const direct_available = round1(paper.sections.reduce((sum, section) => sum + section.direct, 0));
      const indirect_available = round1(paper.sections.reduce((sum, section) => sum + section.indirect, 0));
      const thinking_available = round1(paper.sections.reduce((sum, section) => sum + section.thinking, 0));
      return {
        id: paper.id,
        code: paper.code,
        title: paper.title,
        total_marks: paper.totalMarks,
        buried_treasure: { direct_available, indirect_available, thinking_available },
        questions: paper.sections.map((section) => ({
          code: section.code,
          title: section.title,
          marks: section.totalMarks,
          isCalculation: section.isCalculation,
          direct_available: section.direct,
          indirect_available: section.indirect,
          thinking_available: section.thinking,
        })),
      };
    }),
  };
}

const SITTING_ORDER = ["nov-2024", "jan-2025", "june-2025", "nov-2025", "jan-2026", "june-2026"];

function mergeRegisteredSittings(base: PastPaperSitting[]): PastPaperSitting[] {
  const overlays = PAST_EXAMS.map(examToSitting);
  const byId = new Map<string, PastPaperSitting>();
  for (const sitting of base) byId.set(sitting.id, sitting);
  for (const overlay of overlays) byId.set(overlay.id, overlay);
  return [...byId.values()].sort((left, right) => {
    const leftRank = SITTING_ORDER.indexOf(left.id);
    const rightRank = SITTING_ORDER.indexOf(right.id);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });
}

export const PAST_PAPER_SITTINGS = mergeRegisteredSittings(pastPaperData.sittings as PastPaperSitting[]);

export const DEFAULT_PAST_PAPER_SITTING_ID = "june-2026";

export function findPastPaperSitting(sittingId: string | undefined | null): PastPaperSitting | undefined {
  if (!sittingId) return undefined;
  return PAST_PAPER_SITTINGS.find((sitting) => sitting.id === sittingId);
}

export function defaultPastPaperSitting(): PastPaperSitting {
  return findPastPaperSitting(DEFAULT_PAST_PAPER_SITTING_ID) || PAST_PAPER_SITTINGS[PAST_PAPER_SITTINGS.length - 1];
}

export function findPastPaper(paperId: string | undefined | null): { sitting: PastPaperSitting; paper: PastPaper } | null {
  if (!paperId) return null;
  for (const sitting of PAST_PAPER_SITTINGS) {
    if (sitting.id === paperId) {
      return { sitting, paper: sitting.papers[0] };
    }
    const paper = sitting.papers.find((item) => item.id === paperId || item.code === paperId);
    if (paper) return { sitting, paper };
  }
  return null;
}

export function findPastPaperQuestion(
  paperId: string,
  code: string
): { sitting: PastPaperSitting; paper: PastPaper; question: PastPaperQuestion } | null {
  const mapped = findPastPaper(paperId);
  if (!mapped) return null;
  const question = mapped.paper.questions.find((item) => item.code === code);
  if (!question) return null;
  return { ...mapped, question };
}

export function findPastPaperQuestionByCode(
  code: string
): { sitting: PastPaperSitting; paper: PastPaper; question: PastPaperQuestion } | null {
  for (const sitting of PAST_PAPER_SITTINGS) {
    for (const paper of sitting.papers) {
      const question = paper.questions.find((item) => item.code === code);
      if (question) return { sitting, paper, question };
    }
  }
  return null;
}

export function pastPaperDisplayName(sitting: PastPaperSitting, paper: PastPaper): string {
  return `${sitting.label} · ${paper.title} (${paper.code})`;
}

export function pastPaperQuestionLabel(question: PastPaperQuestion): string {
  return `${question.code} · ${question.title} (${question.marks})`;
}

export function paperBuriedTreasureCaps(paper: PastPaper): PastPaperBuriedTreasureCaps {
  return paper.buried_treasure;
}

export function sittingBuriedTreasureCaps(sitting: PastPaperSitting): PastPaperBuriedTreasureCaps {
  return sitting.papers.reduce<PastPaperBuriedTreasureCaps>(
    (acc, paper) => ({
      direct_available: round1(acc.direct_available + paper.buried_treasure.direct_available),
      indirect_available: round1(acc.indirect_available + paper.buried_treasure.indirect_available),
      thinking_available: round1(acc.thinking_available + paper.buried_treasure.thinking_available),
    }),
    { direct_available: 0, indirect_available: 0, thinking_available: 0 }
  );
}

export function sumQuestionBuriedTreasure(questions: PastPaperQuestion[]): PastPaperBuriedTreasureCaps {
  return questions.reduce<PastPaperBuriedTreasureCaps>(
    (acc, question) => ({
      direct_available: round1(acc.direct_available + question.direct_available),
      indirect_available: round1(acc.indirect_available + question.indirect_available),
      thinking_available: round1(acc.thinking_available + question.thinking_available),
    }),
    { direct_available: 0, indirect_available: 0, thinking_available: 0 }
  );
}

export function knowledgeApplicationCaps(question: PastPaperQuestion) {
  const knowledge = round1(question.marks * KNOWLEDGE_WEIGHT);
  const application = round1(Math.max(0, question.marks - knowledge));
  return { knowledge, application };
}

export type PastPaperDraft = {
  question_code: string;
  direct_earned: string;
  indirect_earned: string;
  thinking_earned: string;
  tier1_earned: string;
  tier1_available: string;
  tier2_earned: string;
  tier2_available: string;
};

export function draftsFromPastPaper(paper: PastPaper): PastPaperDraft[] {
  return paper.questions.map((question) => {
    const split = knowledgeApplicationCaps(question);
    return {
      question_code: question.code,
      direct_earned: "",
      indirect_earned: "",
      thinking_earned: "",
      tier1_earned: "",
      tier1_available: String(split.knowledge),
      tier2_earned: "",
      tier2_available: String(split.application),
    };
  });
}

export function pastPaperSectionCapError(
  question: PastPaperQuestion,
  earned: { direct: number; indirect: number; thinking: number }
): string | null {
  if (earned.direct > question.direct_available + 0.05) {
    return `${question.code} Direct is ${question.direct_available} marks. Marks You Got cannot exceed that cap.`;
  }
  if (earned.indirect > question.indirect_available + 0.05) {
    return `${question.code} Indirect is ${question.indirect_available} marks. Marks You Got cannot exceed that cap.`;
  }
  if (earned.thinking > question.thinking_available + 0.05) {
    return `${question.code} Thinking is ${question.thinking_available} marks. Marks You Got cannot exceed that cap.`;
  }
  const total = round1(earned.direct + earned.indirect + earned.thinking);
  if (total > question.marks + 0.05) {
    return `${question.code} is ${question.marks} marks. Earned marks cannot exceed that section total.`;
  }
  return null;
}
