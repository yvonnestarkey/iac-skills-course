import { pctOf } from "@/lib/buried-treasure";
import { round1 } from "@/lib/diagnostic-report";
import {
  findRegisteredExam,
  findRegisteredPaper,
  sectionsForPaperId,
  type PastPaperSectionConfig,
} from "@/lib/data/past-papers";

export type SAICACompetencyArea =
  | "A Strategy and Governance"
  | "B Stewardship of Capitals"
  | "C Decision-making"
  | "D Reporting on Value Creation"
  | "E Tax Governance and Compliance"
  | "F Assurance and Related Services"
  | "Acumen Overlay";

export type CompetencyStatus = "CRITICAL_GAP" | "DEVELOPING" | "PROFICIENT";

export type CompetencyAreaScore = {
  area: SAICACompetencyArea;
  available: number;
  earned: number;
  percentage: number;
  status: CompetencyStatus;
  statusLabel: string;
  questionCodes: string[];
  diagnostic: string;
};

export type CompetencyBreakdown = {
  rows: CompetencyAreaScore[];
  weakest: CompetencyAreaScore[];
  strongest: CompetencyAreaScore[];
};

const AREA_ORDER: SAICACompetencyArea[] = [
  "A Strategy and Governance",
  "B Stewardship of Capitals",
  "C Decision-making",
  "D Reporting on Value Creation",
  "E Tax Governance and Compliance",
  "F Assurance and Related Services",
  "Acumen Overlay",
];

export const SAICA_COMPETENCY_AREAS: Record<string, Record<string, SAICACompetencyArea>> = {
  "jan-2025": {
    P1_a: "E Tax Governance and Compliance",
    P1_b: "E Tax Governance and Compliance",
    P1_c: "E Tax Governance and Compliance",
    P1_d: "E Tax Governance and Compliance",
    P1_e: "A Strategy and Governance",
    P1_f: "F Assurance and Related Services",
    P1_g: "F Assurance and Related Services",
    P1_h: "Acumen Overlay",
    P2_a: "A Strategy and Governance",
    P2_b: "A Strategy and Governance",
    P2_c: "C Decision-making",
    P2_d: "Acumen Overlay",
    P2_e: "D Reporting on Value Creation",
    P2_f: "C Decision-making",
    P2_g: "D Reporting on Value Creation",
    P2_h: "D Reporting on Value Creation",
    P2_i: "D Reporting on Value Creation",
    P3_a: "C Decision-making",
    P3_b: "C Decision-making",
    P3_c: "A Strategy and Governance",
    P3_d: "D Reporting on Value Creation",
    P3_e: "D Reporting on Value Creation",
    P3_f: "F Assurance and Related Services",
  },
  "june-2025": {
    P1_a: "D Reporting on Value Creation",
    P1_b: "D Reporting on Value Creation",
    P1_c: "F Assurance and Related Services",
    P1_d: "Acumen Overlay",
    P1_e: "F Assurance and Related Services",
    P1_f: "C Decision-making",
    P1_g: "C Decision-making",
    P2_a: "E Tax Governance and Compliance",
    P2_b: "E Tax Governance and Compliance",
    P2_c: "A Strategy and Governance",
    P2_d: "B Stewardship of Capitals",
    P2_e: "D Reporting on Value Creation",
    P2_f: "D Reporting on Value Creation",
    P3_a: "F Assurance and Related Services",
    P3_b: "F Assurance and Related Services",
    P3_c: "Acumen Overlay",
    P3_d: "A Strategy and Governance",
    P3_e: "Acumen Overlay",
    P3_f: "A Strategy and Governance",
    P3_g: "C Decision-making",
    P3_h: "A Strategy and Governance",
    P3_i: "C Decision-making",
  },
  "jan-2026": {
    P1Q1_a: "F Assurance and Related Services",
    P1Q1_b: "B Stewardship of Capitals",
    P1Q1_c: "F Assurance and Related Services",
    P1Q1_d: "F Assurance and Related Services",
    P1Q2_e: "D Reporting on Value Creation",
    P1Q2_f: "A Strategy and Governance",
    P1Q2_g: "D Reporting on Value Creation",
    P1Q2_h: "D Reporting on Value Creation",
    P2Q1_a: "E Tax Governance and Compliance",
    P2Q1_b: "E Tax Governance and Compliance",
    P2Q1_c: "E Tax Governance and Compliance",
    P2Q1_d: "E Tax Governance and Compliance",
    P2Q2_e: "C Decision-making",
    P2Q2_f: "C Decision-making",
    P2Q2_g: "A Strategy and Governance",
    P2Q2_h: "Acumen Overlay",
    P2Q2_i: "Acumen Overlay",
    P3Q1_a: "A Strategy and Governance",
    P3Q1_b: "A Strategy and Governance",
    P3Q1_c: "C Decision-making",
    P3Q1_d: "C Decision-making",
    P3Q2_e: "D Reporting on Value Creation",
    P3Q2_f: "D Reporting on Value Creation",
    P3Q2_g: "F Assurance and Related Services",
  },
  "june-2026": {
    P1Q1_a: "A Strategy and Governance",
    P1Q1_b: "C Decision-making",
    P1Q1_c: "C Decision-making",
    P1Q1_d: "A Strategy and Governance",
    P1Q2_e: "Acumen Overlay",
    P1Q2_f: "F Assurance and Related Services",
    P1Q2_g1: "F Assurance and Related Services",
    P1Q2_g2: "F Assurance and Related Services",
    P1Q2_h: "F Assurance and Related Services",
    P2Q1_a: "D Reporting on Value Creation",
    P2Q2_b: "E Tax Governance and Compliance",
    P2Q2_c: "E Tax Governance and Compliance",
    P2Q2_d: "E Tax Governance and Compliance",
    P2Q2_e: "E Tax Governance and Compliance",
    P2Q2_f: "E Tax Governance and Compliance",
    P3Q1_a: "B Stewardship of Capitals",
    P3Q1_b: "C Decision-making",
    P3Q2_c: "Acumen Overlay",
    P3Q2_d: "F Assurance and Related Services",
    P3Q2_e: "F Assurance and Related Services",
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

function competencyStatus(percentage: number): { status: CompetencyStatus; statusLabel: string } {
  if (percentage < 50) return { status: "CRITICAL_GAP", statusLabel: "🔴 Critical Gap (< 50%)" };
  if (percentage < 65) return { status: "DEVELOPING", statusLabel: "🟡 Developing (50% – 64%)" };
  return { status: "PROFICIENT", statusLabel: "🟢 Proficient (65%+)" };
}

function competencyDiagnostic(area: SAICACompetencyArea, percentage: number, codes: string[]): string {
  const listed = codes.join(", ");
  if (percentage >= 65) {
    return `${area} is Proficient at ${percentage}%. Keep using the same applied structure on ${listed}.`;
  }
  if (percentage >= 50) {
    return `${area} is Developing at ${percentage}%. You are converting some marks on ${listed}, but the requireds still need more scenario-locked depth.`;
  }
  return `${area} is a Critical Gap at ${percentage}%. Marks on ${listed} are not converting — plan the required, state the principle, then apply it to this entity's facts.`;
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

function addToBucket(
  buckets: Map<SAICACompetencyArea, { available: number; earned: number; questionCodes: string[] }>,
  area: SAICACompetencyArea,
  available: number,
  earned: number,
  code: string
) {
  if (available <= 0) return;
  const current = buckets.get(area) || { available: 0, earned: 0, questionCodes: [] };
  current.available = round1(current.available + available);
  current.earned = round1(current.earned + earned);
  if (!current.questionCodes.includes(code)) current.questionCodes.push(code);
  buckets.set(area, current);
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
    const earned = earnedForSection(section, studentSectionMarks);
    if (area && area !== "Acumen Overlay") {
      addToBucket(buckets, area, section.totalMarks, earned, section.code);
    }
    const overlayAvailable = area === "Acumen Overlay" ? section.totalMarks : section.macroComm;
    const overlayEarned =
      area === "Acumen Overlay"
        ? earned
        : Math.min(section.macroComm, asEarned(studentSectionMarks[`${section.code}.macroComm`]));
    addToBucket(buckets, "Acumen Overlay", overlayAvailable, overlayEarned, section.code);
  }

  const rows = AREA_ORDER.filter((area) => buckets.has(area)).map((area) => {
    const bucket = buckets.get(area)!;
    const earned = Math.min(bucket.available, bucket.earned);
    const percentage = pctOf(earned, bucket.available);
    const band = competencyStatus(percentage);
    return {
      area,
      available: bucket.available,
      earned,
      percentage,
      status: band.status,
      statusLabel: band.statusLabel,
      questionCodes: bucket.questionCodes,
      diagnostic: competencyDiagnostic(area, percentage, bucket.questionCodes),
    };
  });

  const ranked = [...rows].sort((left, right) => left.percentage - right.percentage);
  return {
    rows,
    weakest: ranked.filter((row) => row.status !== "PROFICIENT").slice(0, 3),
    strongest: [...ranked].reverse().filter((row) => row.status === "PROFICIENT").slice(0, 3),
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
        `| ${row.area} | ${row.available} | ${row.earned} | ${row.percentage}% | ${row.statusLabel} | ${row.questionCodes.join(", ")} |`
    ),
    "",
    "Competency diagnostics (copy the wording; do not invent replacement percentages):",
    ...breakdown.rows.map((row) => `- ${row.area}: ${row.diagnostic}`),
    breakdown.weakest.length
      ? `- Weakest areas: ${breakdown.weakest.map((row) => `${row.area} (${row.percentage}%)`).join("; ")}`
      : "- Weakest areas: none below Proficient.",
    breakdown.strongest.length
      ? `- Strongest areas: ${breakdown.strongest.map((row) => `${row.area} (${row.percentage}%)`).join("; ")}`
      : "- Strongest areas: none at 65%+ yet.",
  ].join("\n");
}
