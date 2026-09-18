import { pctOf } from "@/lib/buried-treasure";
import { round1 } from "@/lib/diagnostic-report";
import {
  findRegisteredExam,
  findRegisteredPaper,
  sectionsForPaperId,
  type PastPaperSectionConfig,
} from "@/lib/data/past-papers";

export type SAICACompetencyArea =
  | "Strategy and Governance"
  | "Stewardship of Capitals"
  | "Decision-making"
  | "Reporting on Value Creation"
  | "Tax Governance and Compliance"
  | "Assurance and Related Services"
  | "Ethics and Professional Values";

export type CompetencyStatus = "Strength" | "Developing" | "Critical leak";

export type CompetencyAreaScore = {
  area: SAICACompetencyArea;
  available: number;
  earned: number;
  percentage: number;
  status: CompetencyStatus;
  questionCodes: string[];
  diagnostic: string;
};

export type CompetencyBreakdown = {
  rows: CompetencyAreaScore[];
  weakest: CompetencyAreaScore[];
  strongest: CompetencyAreaScore[];
};

const AREA_ORDER: SAICACompetencyArea[] = [
  "Strategy and Governance",
  "Stewardship of Capitals",
  "Decision-making",
  "Reporting on Value Creation",
  "Tax Governance and Compliance",
  "Assurance and Related Services",
  "Ethics and Professional Values",
];

export const SAICA_COMPETENCY_AREAS: Record<string, Record<string, SAICACompetencyArea>> = {
  "jan-2025": {
    P1_a: "Tax Governance and Compliance",
    P1_b: "Tax Governance and Compliance",
    P1_c: "Tax Governance and Compliance",
    P1_d: "Tax Governance and Compliance",
    P1_e: "Strategy and Governance",
    P1_f: "Assurance and Related Services",
    P1_g: "Assurance and Related Services",
    P1_h: "Ethics and Professional Values",
    P2_a: "Strategy and Governance",
    P2_b: "Strategy and Governance",
    P2_c: "Decision-making",
    P2_d: "Ethics and Professional Values",
    P2_e: "Reporting on Value Creation",
    P2_f: "Decision-making",
    P2_g: "Reporting on Value Creation",
    P2_h: "Reporting on Value Creation",
    P2_i: "Reporting on Value Creation",
    P3_a: "Decision-making",
    P3_b: "Decision-making",
    P3_c: "Strategy and Governance",
    P3_d: "Reporting on Value Creation",
    P3_e: "Reporting on Value Creation",
    P3_f: "Assurance and Related Services",
  },
  "june-2025": {
    P1_a: "Reporting on Value Creation",
    P1_b: "Reporting on Value Creation",
    P1_c: "Assurance and Related Services",
    P1_d: "Ethics and Professional Values",
    P1_e: "Assurance and Related Services",
    P1_f: "Decision-making",
    P1_g: "Decision-making",
    P2_a: "Tax Governance and Compliance",
    P2_b: "Tax Governance and Compliance",
    P2_c: "Strategy and Governance",
    P2_d: "Stewardship of Capitals",
    P2_e: "Reporting on Value Creation",
    P2_f: "Reporting on Value Creation",
    P3_a: "Assurance and Related Services",
    P3_b: "Assurance and Related Services",
    P3_c: "Ethics and Professional Values",
    P3_d: "Strategy and Governance",
    P3_e: "Ethics and Professional Values",
    P3_f: "Strategy and Governance",
    P3_g: "Decision-making",
    P3_h: "Strategy and Governance",
    P3_i: "Decision-making",
  },
  "jan-2026": {
    P1Q1_a: "Assurance and Related Services",
    P1Q1_b: "Stewardship of Capitals",
    P1Q1_c: "Assurance and Related Services",
    P1Q1_d: "Assurance and Related Services",
    P1Q2_e: "Reporting on Value Creation",
    P1Q2_f: "Strategy and Governance",
    P1Q2_g: "Reporting on Value Creation",
    P1Q2_h: "Reporting on Value Creation",
    P2Q1_a: "Tax Governance and Compliance",
    P2Q1_b: "Tax Governance and Compliance",
    P2Q1_c: "Tax Governance and Compliance",
    P2Q1_d: "Tax Governance and Compliance",
    P2Q2_e: "Decision-making",
    P2Q2_f: "Decision-making",
    P2Q2_g: "Strategy and Governance",
    P2Q2_h: "Ethics and Professional Values",
    P2Q2_i: "Ethics and Professional Values",
    P3Q1_a: "Strategy and Governance",
    P3Q1_b: "Strategy and Governance",
    P3Q1_c: "Decision-making",
    P3Q1_d: "Decision-making",
    P3Q2_e: "Reporting on Value Creation",
    P3Q2_f: "Reporting on Value Creation",
    P3Q2_g: "Assurance and Related Services",
  },
  "june-2026": {
    P1Q1_a: "Strategy and Governance",
    P1Q1_b: "Decision-making",
    P1Q1_c: "Decision-making",
    P1Q1_d: "Strategy and Governance",
    P1Q2_e: "Ethics and Professional Values",
    P1Q2_f: "Assurance and Related Services",
    P1Q2_g1: "Assurance and Related Services",
    P1Q2_g2: "Assurance and Related Services",
    P1Q2_h: "Assurance and Related Services",
    P2Q1_a: "Reporting on Value Creation",
    P2Q2_b: "Tax Governance and Compliance",
    P2Q2_c: "Tax Governance and Compliance",
    P2Q2_d: "Tax Governance and Compliance",
    P2Q2_e: "Tax Governance and Compliance",
    P2Q2_f: "Tax Governance and Compliance",
    P3Q1_a: "Stewardship of Capitals",
    P3Q1_b: "Decision-making",
    P3Q2_c: "Ethics and Professional Values",
    P3Q2_d: "Assurance and Related Services",
    P3Q2_e: "Assurance and Related Services",
  },
};

function asEarned(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function sittingIdForPaper(paperId: string): string | null {
  const exam = findRegisteredExam(paperId);
  if (exam) return exam.id;
  return findRegisteredPaper(paperId)?.exam.id || null;
}

function competencyStatus(percentage: number): CompetencyStatus {
  if (percentage >= 60) return "Strength";
  if (percentage >= 45) return "Developing";
  return "Critical leak";
}

function competencyDiagnostic(area: SAICACompetencyArea, percentage: number, codes: string[]): string {
  const listed = codes.join(", ");
  if (percentage >= 60) {
    return `${area} is a strength at ${percentage}%. Keep using the same applied structure on ${listed}.`;
  }
  if (percentage >= 45) {
    return `${area} is developing at ${percentage}%. You are converting some marks on ${listed}, but the requireds still need more scenario-locked depth.`;
  }
  return `${area} is a critical leak at ${percentage}%. Marks on ${listed} are not converting — plan the required, state the principle, then apply it to this entity's facts.`;
}

function earnedForSection(section: PastPaperSectionConfig, studentSectionMarks: Record<string, number>): number {
  const directKey = `${section.code}.direct`;
  const indirectKey = `${section.code}.indirect`;
  const thinkingKey = `${section.code}.thinking`;
  const macroKey = `${section.code}.macroComm`;
  const hasSplit = [directKey, indirectKey, thinkingKey, macroKey].some((key) =>
    Object.prototype.hasOwnProperty.call(studentSectionMarks, key)
  );
  if (hasSplit) {
    return Math.min(
      section.totalMarks,
      round1(
        asEarned(studentSectionMarks[directKey]) +
          asEarned(studentSectionMarks[indirectKey]) +
          asEarned(studentSectionMarks[thinkingKey]) +
          asEarned(studentSectionMarks[macroKey])
      )
    );
  }
  return Math.min(section.totalMarks, asEarned(studentSectionMarks[section.code]));
}

export function evaluateCompetencyBreakdown(
  paperId: string | undefined | null,
  studentSectionMarks: Record<string, number> = {}
): CompetencyBreakdown {
  const sections = sectionsForPaperId(paperId);
  const sittingId = paperId ? sittingIdForPaper(paperId) : null;
  const areaMap = sittingId ? SAICA_COMPETENCY_AREAS[sittingId] || {} : {};

  const buckets = new Map<
    SAICACompetencyArea,
    { available: number; earned: number; questionCodes: string[] }
  >();

  for (const section of sections) {
    const area = areaMap[section.code];
    if (!area) continue;
    const current = buckets.get(area) || { available: 0, earned: 0, questionCodes: [] };
    current.available = round1(current.available + section.totalMarks);
    current.earned = round1(current.earned + earnedForSection(section, studentSectionMarks));
    current.questionCodes.push(section.code);
    buckets.set(area, current);
  }

  const rows = AREA_ORDER.filter((area) => buckets.has(area)).map((area) => {
    const bucket = buckets.get(area)!;
    const earned = Math.min(bucket.available, bucket.earned);
    const percentage = pctOf(earned, bucket.available);
    return {
      area,
      available: bucket.available,
      earned,
      percentage,
      status: competencyStatus(percentage),
      questionCodes: bucket.questionCodes,
      diagnostic: competencyDiagnostic(area, percentage, bucket.questionCodes),
    };
  });

  const ranked = [...rows].sort((left, right) => left.percentage - right.percentage);
  return {
    rows,
    weakest: ranked.filter((row) => row.status !== "Strength").slice(0, 3),
    strongest: [...ranked].reverse().filter((row) => row.status === "Strength").slice(0, 3),
  };
}

export function formatCompetencyBreakdown(breakdown: CompetencyBreakdown): string {
  if (!breakdown.rows.length) {
    return "DETERMINISTIC SAICA COMPETENCY METRICS: no competency map is registered for this paper.";
  }
  return [
    "DETERMINISTIC SAICA COMPETENCY METRICS (use these exact figures; do not recalculate):",
    "Markdown table rows to copy:",
    "| Competency Area | Available Marks | Marks You Got | Conversion % | Diagnostic Status | Related questions |",
    "|---|---|---|---|---|---|",
    ...breakdown.rows.map(
      (row) =>
        `| ${row.area} | ${row.available} | ${row.earned} | ${row.percentage}% | ${row.status} | ${row.questionCodes.join(", ")} |`
    ),
    "",
    "Competency diagnostics (copy the wording; do not invent replacement percentages):",
    ...breakdown.rows.map((row) => `- ${row.area}: ${row.diagnostic}`),
    breakdown.weakest.length
      ? `- Weakest areas: ${breakdown.weakest.map((row) => `${row.area} (${row.percentage}%)`).join("; ")}`
      : "- Weakest areas: none below strength.",
    breakdown.strongest.length
      ? `- Strongest areas: ${breakdown.strongest.map((row) => `${row.area} (${row.percentage}%)`).join("; ")}`
      : "- Strongest areas: none at 60%+ yet.",
  ].join("\n");
}
