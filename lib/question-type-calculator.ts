export interface SectionQuestionTypeInput {
  sectionCode: string;
  discussionMarks: { available: number; earned: number };
  formatCalcMarks: { available: number; earned: number };
}

export interface QuestionTypePerformance {
  discussion: {
    available: number;
    earned: number;
    percentage: number;
    status: "CRITICAL_GAP" | "DEVELOPING" | "PROFICIENT";
    statusLabel: string;
  };
  formatCalc: {
    available: number;
    earned: number;
    percentage: number;
    status: "CRITICAL_GAP" | "DEVELOPING" | "PROFICIENT";
    statusLabel: string;
  };
  primaryExecutionTypeGap: "DISCUSSION_COMMUNICATION_GAP" | "CALCULATION_MECHANICS_GAP" | "BALANCED_PERFORMANCE";
  diagnosticHeadline: string;
}

export function evaluateQuestionTypePerformance(inputs: SectionQuestionTypeInput[]): QuestionTypePerformance {
  let discussionAvailable = 0;
  let discussionEarned = 0;
  let formatCalcAvailable = 0;
  let formatCalcEarned = 0;

  inputs.forEach((item) => {
    discussionAvailable += item.discussionMarks.available;
    discussionEarned += item.discussionMarks.earned;
    formatCalcAvailable += item.formatCalcMarks.available;
    formatCalcEarned += item.formatCalcMarks.earned;
  });

  const discussionPct = discussionAvailable > 0 ? (discussionEarned / discussionAvailable) * 100 : 0;
  const formatCalcPct = formatCalcAvailable > 0 ? (formatCalcEarned / formatCalcAvailable) * 100 : 0;

  const getStatus = (pct: number) => {
    if (pct < 50.0) return { status: "CRITICAL_GAP" as const, statusLabel: "🔴 Critical Gap (< 50%)" };
    if (pct < 65.0) return { status: "DEVELOPING" as const, statusLabel: "🟡 Developing (50% – 64%)" };
    return { status: "PROFICIENT" as const, statusLabel: "🟢 Proficient (65%+)" };
  };

  const discStatus = getStatus(discussionPct);
  const calcStatus = getStatus(formatCalcPct);

  let primaryExecutionTypeGap: QuestionTypePerformance["primaryExecutionTypeGap"] = "BALANCED_PERFORMANCE";
  let diagnosticHeadline = "";

  if (formatCalcPct >= 65.0 && discussionPct < 50.0) {
    primaryExecutionTypeGap = "DISCUSSION_COMMUNICATION_GAP";
    diagnosticHeadline = "CALCULATIONS INTACT — CRITICAL FAILURE ON DISCUSSION & INTEGRATION";
  } else if (discussionPct >= 60.0 && formatCalcPct < 50.0) {
    primaryExecutionTypeGap = "CALCULATION_MECHANICS_GAP";
    diagnosticHeadline = "COMMUNICATION STRONG — FAILURE DRIVEN BY JOURNAL & CALCULATION MECHANICS";
  } else {
    diagnosticHeadline = "BALANCED QUESTION TYPE CONVERSION PROFILE";
  }

  return {
    discussion: {
      available: discussionAvailable,
      earned: discussionEarned,
      percentage: Number(discussionPct.toFixed(1)),
      ...discStatus,
    },
    formatCalc: {
      available: formatCalcAvailable,
      earned: formatCalcEarned,
      percentage: Number(formatCalcPct.toFixed(1)),
      ...calcStatus,
    },
    primaryExecutionTypeGap,
    diagnosticHeadline,
  };
}

export type MacroSkillShiftId =
  | "TEXTBOOK_COLLECTOR"
  | "PRECISION_LEAKER"
  | "CONCEPTUAL_COMMENTATOR"
  | "BALANCED_CONVERTER";

export type MacroSkillShiftProfile = {
  id: MacroSkillShiftId;
  label: string;
  diagnostic: string;
};

export function classifyMacroSkillShift(input: {
  knowledgePct: number;
  thinkingPct: number;
  questionType: QuestionTypePerformance;
}): MacroSkillShiftProfile {
  if (input.knowledgePct >= 65 && input.thinkingPct < 50) {
    return {
      id: "TEXTBOOK_COLLECTOR",
      label: "The Textbook Collector",
      diagnostic:
        "You are collecting textbook principles and case triggers (Knowledge & Trigger is intact), but Tier 3 thinking is not converting. Stop restating the syllabus and spend the marks on scenario-locked execution.",
    };
  }
  if (input.questionType.primaryExecutionTypeGap === "CALCULATION_MECHANICS_GAP") {
    return {
      id: "PRECISION_LEAKER",
      label: "The Precision Leaker",
      diagnostic:
        "Discussion and integration are converting, but journals, workings, calculations, and disclosure format are leaking. The failure is mechanical precision, not a missing concept.",
    };
  }
  if (input.questionType.primaryExecutionTypeGap === "DISCUSSION_COMMUNICATION_GAP") {
    return {
      id: "CONCEPTUAL_COMMENTATOR",
      label: "The Conceptual Commentator",
      diagnostic:
        "Format, calculations, journals, and disclosures are converting, but discussion and integration are below 50%. You are producing numbers without the required argument, stakeholders, and scenario lock.",
    };
  }
  return {
    id: "BALANCED_CONVERTER",
    label: "Balanced converter",
    diagnostic: "Discussion/integration and format/calculation conversion are in the same band. Repair the weaker Buried Treasure tier rather than one question type only.",
  };
}

export function formatQuestionTypePerformance(performance: QuestionTypePerformance, skillShift?: MacroSkillShiftProfile): string {
  return [
    "DETERMINISTIC QUESTION TYPE METRICS (use these exact figures; do not recalculate):",
    `- Discussion & Integration: ${performance.discussion.earned} / ${performance.discussion.available} = ${performance.discussion.percentage}% · ${performance.discussion.statusLabel}`,
    `- Format, Calculations, Journals & Disclosures: ${performance.formatCalc.earned} / ${performance.formatCalc.available} = ${performance.formatCalc.percentage}% · ${performance.formatCalc.statusLabel}`,
    `- primaryExecutionTypeGap: ${performance.primaryExecutionTypeGap}`,
    `- questionTypeHeadline: ${performance.diagnosticHeadline}`,
    skillShift ? `- macroSkillShift: ${skillShift.id} (${skillShift.label})` : "",
    skillShift ? `- skillShiftDiagnostic: ${skillShift.diagnostic}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function asEarned(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function questionTypeInputsForPaper(
  sections: Array<{
    code: string;
    totalMarks: number;
    isCalculation?: boolean;
    macroComm: number;
  }>,
  studentSectionMarks: Record<string, number>
): SectionQuestionTypeInput[] {
  return sections.map((section) => {
    const direct = asEarned(studentSectionMarks[`${section.code}.direct`]);
    const indirect = asEarned(studentSectionMarks[`${section.code}.indirect`]);
    const thinking = asEarned(studentSectionMarks[`${section.code}.thinking`]);
    const macro = asEarned(studentSectionMarks[`${section.code}.macroComm`]);
    const hasSplit = [`${section.code}.direct`, `${section.code}.indirect`, `${section.code}.thinking`, `${section.code}.macroComm`].some(
      (key) => Object.prototype.hasOwnProperty.call(studentSectionMarks, key)
    );
    const totalEarned = hasSplit
      ? Math.min(section.totalMarks, round1(direct + indirect + thinking + macro))
      : Math.min(section.totalMarks, asEarned(studentSectionMarks[section.code]));

    if (section.isCalculation) {
      return {
        sectionCode: section.code,
        discussionMarks: { available: 0, earned: 0 },
        formatCalcMarks: { available: section.totalMarks, earned: totalEarned },
      };
    }

    const formatAvailable = Math.max(0, section.macroComm);
    const discussionAvailable = Math.max(0, round1(section.totalMarks - formatAvailable));
    const formatEarned = Math.min(formatAvailable, hasSplit ? macro : 0);
    const discussionEarned = Math.min(discussionAvailable, Math.max(0, round1(totalEarned - formatEarned)));
    return {
      sectionCode: section.code,
      discussionMarks: { available: discussionAvailable, earned: discussionEarned },
      formatCalcMarks: { available: formatAvailable, earned: formatEarned },
    };
  });
}
