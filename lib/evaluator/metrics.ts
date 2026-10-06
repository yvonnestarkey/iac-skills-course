import type { ProximityBucket, RequirementEvaluation, RequirementMetrics } from "./types";

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
  return warnings;
}

/** Enforce NOT_ATTEMPTED: only BMCR, Question Type and Competency run. */
export function applyNotAttemptedRule(requirement: RequirementEvaluation): RequirementEvaluation {
  if (requirement.attempted) return requirement;
  return {
    ...requirement,
    buried_treasure: null,
    volume: null,
    components: null,
    core_issue: null,
    rtfq: null,
    communication: null,
    technical_awarded: requirement.technical_awarded ?? 0,
  };
}
