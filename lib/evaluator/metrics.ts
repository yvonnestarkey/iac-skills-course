import { proximityAvailable, type RequirementModel } from "./question-model";
import type { BmcrVerdict, ProximityBucket, RequirementEvaluation, RequirementMetrics } from "./types";

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
