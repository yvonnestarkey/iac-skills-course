import { BURIED_TREASURE_TIERS, pctOf } from "@/lib/buried-treasure";
import type { BuriedTreasureAnalysis, TierScore } from "@/types/evaluation";

export interface MarkTierInput {
  directMarks: { available: number; earned: number };
  indirectMarks: { available: number; earned: number };
  thinkingMarks: { available: number; earned: number };
  macroCommMarks?: { available: number; earned: number };
}

export type BuriedTreasureDiagnostics = Pick<
  BuriedTreasureAnalysis,
  | "directMarks"
  | "indirectMarks"
  | "thinkingMarks"
  | "knowledgeScore"
  | "applicationScore"
  | "macroCommScore"
  | "hasTheoryGap"
  | "primaryFailureCause"
  | "diagnosticHeadline"
> & {
  hasExecutionGap: boolean;
  presentationIsStrong: boolean;
  diagnosticMessage: string;
};

function asMark(value: { available: number; earned: number } | undefined, fallbackAvailable: number): {
  available: number;
  earned: number;
} {
  const available = Number(value?.available);
  const earned = Number(value?.earned);
  return {
    available: Number.isFinite(available) && available > 0 ? available : fallbackAvailable,
    earned: Number.isFinite(earned) ? Math.max(0, earned) : 0,
  };
}

function toScore(input: { available: number; earned: number }): TierScore {
  const available = Math.max(0, input.available);
  const earned = Math.max(0, Math.min(available, input.earned));
  return {
    available,
    earned,
    percentage: pctOf(earned, available),
  };
}

function combineScores(left: TierScore, right: TierScore): TierScore {
  const available = left.available + right.available;
  const earned = left.earned + right.earned;
  return {
    available,
    earned,
    percentage: pctOf(earned, available),
  };
}

export function computeBuriedTreasureDiagnostics(input: MarkTierInput): BuriedTreasureDiagnostics {
  const directMarks = toScore(asMark(input.directMarks, BURIED_TREASURE_TIERS[0].available));
  const indirectMarks = toScore(asMark(input.indirectMarks, BURIED_TREASURE_TIERS[1].available));
  const thinkingMarks = toScore(asMark(input.thinkingMarks, BURIED_TREASURE_TIERS[2].available));
  const macroCommScore = input.macroCommMarks
    ? toScore(asMark(input.macroCommMarks, 0))
    : { available: 0, earned: 0, percentage: 0 };

  const knowledgeScore = combineScores(directMarks, indirectMarks);
  const applicationScore = thinkingMarks;
  const presentationIsStrong = macroCommScore.available > 0 && macroCommScore.percentage >= 80;

  const trueKnowledgeGap = directMarks.percentage < 70 || indirectMarks.percentage < 45;
  const theoryIntact = directMarks.percentage >= 80 && indirectMarks.percentage >= 55;
  const thinkingSoft = thinkingMarks.percentage < 45;
  const mechanicsFailure = theoryIntact && thinkingMarks.percentage < 30;
  const executionGap = theoryIntact && thinkingSoft;

  let primaryFailureCause: BuriedTreasureAnalysis["primaryFailureCause"];
  let diagnosticHeadline: string;
  let diagnosticMessage: string;

  if (trueKnowledgeGap) {
    primaryFailureCause = "THEORY_GAP";
    diagnosticHeadline = "True knowledge gap: baseline theory and triggers are leaking before execution can convert.";
    diagnosticMessage =
      "You have a technical knowledge gap. You are missing baseline IFRS/Tax/Audit definitions, formulas, or standard triggers.";
  } else if (mechanicsFailure) {
    primaryFailureCause = "MECHANICS_FAILURE";
    diagnosticHeadline = "Theory is intact. The leak is Tier 3 mechanics — journals, directions, and scenario-locked execution.";
    diagnosticMessage =
      "Your theory is intact. You are extracting case study facts and recognizing rules, but losing the exam during Tier 3 transformation (journal mechanics, multi-stakeholder coverage, and scenario-locked depth).";
  } else if (executionGap) {
    primaryFailureCause = "EXECUTION_GAP";
    diagnosticHeadline = "Theory is intact. Marks are leaking in Tier 3 thinking and application.";
    diagnosticMessage =
      "Your theory is intact. You are extracting case study facts and recognizing rules, but losing the exam during Tier 3 transformation (journal mechanics, multi-stakeholder coverage, and scenario-locked depth).";
  } else {
    primaryFailureCause = "BREADTH_OMISSION";
    diagnosticHeadline = "The main leak is incomplete breadth — not a clean theory or mechanics failure.";
    diagnosticMessage =
      "You are converting some Direct and Indirect marks, but omitting enough scenario coverage that the paper cannot reach a pass conversion.";
  }

  if (presentationIsStrong) {
    diagnosticMessage +=
      " Presentation/formatting is strong (X1 / layout >= 80%), so macro-communication is NOT the reason for failure.";
  }

  return {
    directMarks,
    indirectMarks,
    thinkingMarks,
    knowledgeScore,
    applicationScore,
    macroCommScore,
    hasTheoryGap: trueKnowledgeGap,
    hasExecutionGap: executionGap || mechanicsFailure,
    presentationIsStrong,
    primaryFailureCause,
    diagnosticHeadline,
    diagnosticMessage,
  };
}

export function formatBuriedTreasureDiagnostics(diagnostics: BuriedTreasureDiagnostics): string {
  const line = (label: string, score: TierScore, benchmark?: string) =>
    `- ${label}: ${score.earned} / ${score.available} = ${score.percentage}%${benchmark ? ` (benchmark ${benchmark})` : ""}`;

  return [
    "DETERMINISTIC BURIED TREASURE METRICS (use these exact percentages; do not recalculate):",
    line("Direct Marks (Tier 1)", diagnostics.directMarks, ">= 80%"),
    line("Indirect Marks (Tier 2)", diagnostics.indirectMarks, ">= 60%"),
    line("Thinking Marks (Tier 3)", diagnostics.thinkingMarks, ">= 50%"),
    line("Knowledge & Trigger (Tier 1 + Tier 2)", diagnostics.knowledgeScore),
    line("Application & Execution (Tier 3)", diagnostics.applicationScore),
    line("Macro-communication (X1 / layout)", diagnostics.macroCommScore, ">= 80%"),
    `- hasTheoryGap: ${diagnostics.hasTheoryGap}`,
    `- hasExecutionGap: ${diagnostics.hasExecutionGap}`,
    `- presentationIsStrong: ${diagnostics.presentationIsStrong}`,
    `- primaryFailureCause: ${diagnostics.primaryFailureCause}`,
    `- diagnosticHeadline: ${diagnostics.diagnosticHeadline}`,
    `- diagnosticMessage: ${diagnostics.diagnosticMessage}`,
  ].join("\n");
}
