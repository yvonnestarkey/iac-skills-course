import { proximityAvailable, type CoreIssueComponent, type RequirementModel } from "./question-model";
import type { BmcrVerdict, CommunicationEvidence, CoreIssueEvidence, DiscussionBasis, ProximityBucket, RequirementEvaluation, RequirementMetrics } from "./types";

/** Taught thresholds (kept deliberately simple so students can reproduce them without discretion). */
export const BMCR_THEORY_THRESHOLD = 0.5; // Basic marks as a share of total marks
export const BMCR_CONVERSION_THRESHOLD = 0.7; // marks awarded as a share of Basic marks

/** Cross-multiplied so rounding can never flip a borderline case (e.g. 3 of 6 is exactly 50%). */
export function bmcrVerdict(awarded: number | null, basic: number | null, total: number): BmcrVerdict {
  if (basic === null || !Number.isFinite(basic) || basic <= 0 || total <= 0) return "no_basic_marks";
  if (basic * 2 < total) return "not_enough_theory";
  if (awarded === null) return "enough_theory_not_converting";
  return awarded * 10 >= basic * 7 ? "enough_theory_converting" : "enough_theory_not_converting";
}

/** Aggregate item-level evidence against the question model's classification. Counts only; no judgement. */
export function aggregateProximity(
  model: RequirementModel | null,
  items: { row: number; seen: boolean; awarded: boolean }[] | null
): { direct: ProximityBucket; indirect: ProximityBucket; thinking: ProximityBucket } | null {
  const available = proximityAvailable(model);
  if (!model || !available || !items) return null;
  const out = {
    direct: { available: available.direct, seen: 0, awarded: 0 },
    indirect: { available: available.indirect, seen: 0, awarded: 0 },
    thinking: { available: available.thinking, seen: 0, awarded: 0 },
  };
  const byRow = new Map(items.map((item) => [item.row, item]));
  for (const modelled of model.proximity_items) {
    const evidence = byRow.get(modelled.row);
    if (!evidence) continue;
    if (evidence.seen) out[modelled.proximity].seen += 1;
    if (evidence.awarded) out[modelled.proximity].awarded += 1;
  }
  return out;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function bucketConversion(bucket: ProximityBucket | undefined): number | null {
  if (!bucket) return null;
  return ratio(bucket.awarded, bucket.available);
}

/** All arithmetic is done here, in code. The model reports counts; it never calculates ratios. */
export function computeMetrics(requirement: RequirementEvaluation): RequirementMetrics {
  const volume = requirement.volume?.attempts ?? null;
  const bt = requirement.buried_treasure;
  return {
    code: requirement.code,
    bmcr_conversion: ratio(requirement.technical_awarded, requirement.bmcr.student_known),
    bmcr_verdict: bmcrVerdict(requirement.technical_awarded, requirement.bmcr.student_known, requirement.total_marks),
    bmcr_known_pct: ratio(requirement.bmcr.student_known, requirement.total_marks),
    actual_pct: ratio(requirement.technical_awarded, requirement.total_marks),
    accuracy: requirement.attempted ? ratio(requirement.technical_awarded, volume) : null,
    proximity_conversion: {
      direct: bucketConversion(bt?.direct),
      indirect: bucketConversion(bt?.indirect),
      thinking: bucketConversion(bt?.thinking),
    },
  };
}

/**
 * Sanity checks that catch model slips before they reach a report.
 * Returns human-readable warnings; never throws.
 */
export function validateRequirement(requirement: RequirementEvaluation): string[] {
  const warnings: string[] = [];
  const { code, total_marks: total } = requirement;
  const awarded = requirement.technical_awarded;
  if (awarded !== null && (awarded < 0 || awarded > total)) {
    warnings.push(`${code}: technical marks awarded (${awarded}) outside 0–${total}.`);
  }
  const known = requirement.bmcr.student_known;
  if (known !== null && (known < 0 || known > total)) {
    warnings.push(`${code}: BMCR known marks (${known}) outside 0–${total}.`);
  }
  if (!requirement.attempted) {
    if (requirement.volume || requirement.components || requirement.core_issue || requirement.rtfq || requirement.communication) {
      warnings.push(`${code}: not attempted, but answer-based measures were returned. They were discarded.`);
    }
  }
  const bt = requirement.buried_treasure;
  if (bt) {
    for (const [name, bucket] of Object.entries(bt)) {
      if (bucket.awarded > bucket.available) warnings.push(`${code}: ${name} awarded exceeds available.`);
      if (bucket.seen > bucket.available && bucket.available > 0) warnings.push(`${code}: ${name} seen exceeds available.`);
    }
  }
  if (requirement.communication && requirement.volume && requirement.communication.points.length !== requirement.volume.attempts) {
    warnings.push(`${code}: Communication points (${requirement.communication.points.length}) differ from Volume attempts (${requirement.volume.attempts}); they should be the same statements.`);
  }
  if (requirement.communication && /\d/.test(requirement.communication.trend)) {
    warnings.push(`${code}: Communication trend contains numbers; Communication is not quantified for students.`);
  }
  if (requirement.communication) {
    const overall = requirement.communication.overall;
    if (!overall) warnings.push(`${code}: Communication has no overall assessment.`);
    else if (requirement.discussion_basis === "compliance" && (!overall.knowledge || !overall.application || !overall.so_what)) warnings.push(`${code}: compliance discussion should have knowledge, application and so-what assessed.`);
    else if (requirement.discussion_basis !== "compliance" && (overall.knowledge || overall.application || overall.so_what)) warnings.push(`${code}: knowledge, application and so-what apply to compliance discussions only.`);
    else if ((requirement.total_marks < 10 || requirement.discussion_basis !== "compliance") && overall.introduction !== "not_expected") warnings.push(`${code}: introduction should be not_expected (only checked for compliance discussions of 10 marks or more).`);
    else if (requirement.total_marks >= 10 && requirement.discussion_basis === "compliance" && overall.introduction === "not_expected") warnings.push(`${code}: introduction is expected at 10 marks or more for compliance discussions.`);
  }
  if (requirement.rtfq) {
    const names = new Set(requirement.rtfq.dimensions.map((d) => d.dimension));
    if (requirement.rtfq.dimensions.length !== 3 || names.size !== 3) warnings.push(`${code}: RTFQ should have exactly one entry each for shape, directions and lens.`);
  }
  for (const layer of requirement.components?.layers ?? []) {
    if (layer.recognised > layer.available) warnings.push(`${code}: Components "${layer.layer}" recognised exceeds available.`);
    if (layer.exploited > layer.recognised) warnings.push(`${code}: Components "${layer.layer}" exploited exceeds recognised.`);
  }
  return warnings;
}

/** Enforce NOT_ATTEMPTED: only BMCR, Question Type and Competency run. */
export function applyNotAttemptedRule(requirement: RequirementEvaluation): RequirementEvaluation {
  if (requirement.attempted) return requirement;
  return {
    ...requirement,
    buried_treasure_items: null,
    buried_treasure: null,
    volume: null,
    components: null,
    core_issue: null,
    rtfq: null,
    communication: null,
    technical_awarded: requirement.technical_awarded ?? 0,
  };
}

export type RawCoreIssue = {
  components: { component: string; attempts: number; depth: "none" | "surface" | "developed" }[];
  off_plan_note?: string;
  evidence: string;
};

/**
 * Merge the pre-calibrated Core Issue components with what the student did.
 * Priority and clue come from the question model; the evaluating model only reports attempts and depth.
 * Alignment is computed here: coverage of the higher-priority components.
 */
export function buildCoreIssue(model: CoreIssueComponent[] | undefined, raw: RawCoreIssue | null): CoreIssueEvidence | null {
  if (!model || !model.length || !raw) return null;
  const components = model.map((entry) => {
    const found = raw.components.find((c) => c.component.trim().toLowerCase() === entry.component.trim().toLowerCase());
    const attempts = found && Number.isFinite(found.attempts) && found.attempts > 0 ? Math.floor(found.attempts) : 0;
    return {
      layer: entry.layer,
      component: entry.component,
      priority: entry.priority,
      clue_type: entry.clue_type,
      clue: entry.clue,
      attempts,
      depth: attempts === 0 ? ("none" as const) : found?.depth === "none" ? ("surface" as const) : found?.depth ?? ("surface" as const),
    };
  });
  const higher = components.filter((c) => c.priority === "higher" || c.priority === "dominant");
  const dominant = components.find((c) => c.priority === "dominant");
  const covered = higher.filter((c) => c.attempts > 0).length;
  const alignment = higher.length === 0 ? null : covered === higher.length ? "aligned" : covered === 0 ? "misaligned" : "partly";
  return { components, higher_total: higher.length, higher_covered: covered, dominant_covered: dominant ? dominant.attempts > 0 : null, alignment, off_plan_note: raw.off_plan_note?.trim() ?? "", evidence: raw.evidence };
}

/**
 * The introduction is worth 1-2 marks in compliance discussions of 10 marks or more; otherwise it is not checked yet.
 * Decided in code from the requirement's total marks, never by the evaluating model.
 */
export function finalizeCommunication(communication: CommunicationEvidence | null, totalMarks: number, basis: DiscussionBasis | null): CommunicationEvidence | null {
  if (!communication) return null;
  if (!communication.overall) return communication;
  // Introductions are checked for compliance discussions only, at 10 marks or more (Yvonne, 8 Oct 2026).
  const expected = totalMarks >= 10 && basis === "compliance";
  const introduction = expected ? (communication.overall.introduction === "not_expected" ? "absent" : communication.overall.introduction) : "not_expected";
  const compliance = basis === "compliance";
  const { knowledge, application, so_what } = communication.overall;
  return {
    ...communication,
    overall: {
      ...communication.overall,
      introduction,
      // Only compliance discussions get the knowledge / application / so-what read; non-compliance relies on the per-statement categories.
      knowledge: compliance ? knowledge ?? null : null,
      application: compliance ? application ?? null : null,
      so_what: compliance ? so_what ?? null : null,
    },
  };
}
