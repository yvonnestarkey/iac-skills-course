/**
 * Stage 1 post-processing, kept free of the model client so it can run on observations recorded by hand.
 */
import { aggregateProximity, applyNotAttemptedRule, buildComponents, buildCoreIssue, finalizeCommunication, validateRequirement, type RawComponents, type RawCoreIssue } from "./metrics";
import { requirementLabel } from "./pagemap";
import { questionModelFor, toolsFor } from "./question-model";
import type { BmcrRow, RequirementEvaluation } from "./types";

export type RawRequirementObservation = Omit<RequirementEvaluation, "code" | "label" | "total_marks" | "bmcr" | "buried_treasure" | "core_issue" | "components"> & {
  core_issue: RawCoreIssue | null;
  components: RawComponents | null;
};

/**
 * Turn the Stage 1 observations for one requirement (from the model, or recorded by hand in the same shape) into the
 * evaluation the reports are built from. All the rules live here, so a hand-recorded run gets exactly the same treatment.
 */
export function assembleRequirementEvaluation(input: {
  requirement: { code: string; title: string; total_marks: number };
  attempted: boolean;
  bmcr: BmcrRow | undefined;
  paperId: string;
  raw: RawRequirementObservation;
}): { evaluation: RequirementEvaluation; warnings: string[] } {
  const { requirement, raw } = input;
  const pageMap = { attempted: input.attempted };
  const label = requirementLabel(requirement.code);
  const model = questionModelFor(input.paperId, requirement.code);
  const questionType = model?.question_type ?? null;
  const discussionBasis = questionType === "Discussion" ? model?.discussion_basis ?? null : null;
  const gate = toolsFor(questionType ?? "Discussion", input.attempted);
  const warnings: string[] = [];
  // A paid answer must survive a missing list: later steps read these arrays, so default them and say so.
  if (raw.communication && !Array.isArray(raw.communication.points)) {
    warnings.push(`${label}: the model returned Communication without its list of points; Communication is empty for this requirement.`);
    raw.communication = { ...raw.communication, points: [] };
  }
  if (!raw.quick_comment) {
    warnings.push(`${label}: the model returned no quick comment (coach layer only; nothing in the student report depends on it).`);
    raw.quick_comment = { main_issue: null, certainty: "uncertain", evidence: "" };
  }
  if (!raw.competency) {
    warnings.push(`${label}: the model returned no competency topic.`);
    raw.competency = { topic: "", basis: "" };
  }
  if (!raw.question_type_basis) raw.question_type_basis = "";
  if (!Array.isArray(raw.uncertainties)) raw.uncertainties = [];
  if (raw.rtfq && !Array.isArray(raw.rtfq.dimensions)) {
    warnings.push(`${label}: the model returned RTFQ without its dimensions; RTFQ is empty for this requirement.`);
    raw.rtfq = { ...raw.rtfq, dimensions: [] };
  }
  if (gate.coreIssue && !model?.core_issue?.length) warnings.push(`${label}: no pre-calibrated Core Issue components; Core Issue not scored.`);
  if (gate.buriedTreasure && !model?.proximity_items.length) warnings.push(`${label}: no pre-calibrated proximity items; Buried Treasure not scored.`);
  const buriedTreasure = gate.buriedTreasure ? aggregateProximity(model, raw.buried_treasure_items ?? null) : null;

  const evaluation: RequirementEvaluation = applyNotAttemptedRule({
    ...raw,
    question_type: questionType ?? raw.question_type,
    discussion_basis: discussionBasis,
    attempted: Boolean(raw.attempted) && pageMap.attempted,
    code: requirement.code,
    label,
    total_marks: requirement.total_marks,
    bmcr: { student_known: input.bmcr?.student_known ?? null, available: input.bmcr?.available ?? null },
    buried_treasure_items: gate.buriedTreasure ? raw.buried_treasure_items ?? null : null,
    buried_treasure: buriedTreasure,
    volume: gate.volumeAccuracy ? raw.volume ?? null : null,
    components: gate.components ? buildComponents(model, raw.components ?? null) : null,
    core_issue: gate.coreIssue ? buildCoreIssue(model?.core_issue, raw.core_issue ?? null) : null,
    rtfq: gate.rtfq ? raw.rtfq ?? null : null,
    communication: gate.communication ? finalizeCommunication(raw.communication ?? null, requirement.total_marks, discussionBasis) : null,
    uncertainties: raw.uncertainties || [],
  });
  let checks: string[];
  try {
    checks = validateRequirement(evaluation);
  } catch (error) {
    // A check must never throw away a model call that has already been paid for.
    checks = [`${label}: validation failed (${error instanceof Error ? error.message : "unknown error"}); the result is kept unchecked.`];
  }
  return { evaluation, warnings: [...warnings, ...checks] };
}
