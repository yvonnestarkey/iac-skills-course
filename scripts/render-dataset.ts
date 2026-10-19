/**
 * Rebuild the review sheet from a dataset.json an earlier run already wrote. No model calls, no cost.
 *
 *   npm run render:dataset -- --file=calibration-output/<attempt>/<paper>/<timestamp>/dataset.json
 *
 * Writes review.md next to the dataset (and student-report.md with the Per Paper Report).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { reviveStringifiedFields } from "../lib/evaluator/revive";
import { renderCalibrationMarkdown } from "../lib/evaluator/render";
import { buildPaperReport } from "../lib/evaluator/student-report";
import { computeMetrics, finalizeCommunication } from "../lib/evaluator/metrics";
import type { EvaluationDataset, RequirementEvaluation } from "../lib/evaluator/types";

/**
 * Repair for datasets written before the model's stringified fields were revived: a string that was spread into an
 * object leaves numeric keys "0", "1", "2"... (other keys, such as an empty points list added afterwards, may sit
 * beside them). Join the characters, then revive the text, which also recovers any sibling fields glued onto it.
 */
function repairRequirement(req: Record<string, unknown>): { fixed: Record<string, unknown>; count: number } {
  let fixed = { ...req };
  let count = 0;
  for (const field of ["communication", "rtfq", "volume", "components", "core_issue", "quick_comment", "competency"]) {
    const value = fixed[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const numeric = Object.keys(record).filter((key) => /^\d+$/.test(key));
    if (numeric.length < 2 || !numeric.every((key, index) => key === String(index))) continue;
    const text = numeric.map((key) => String(record[key])).join("");
    const revived = reviveStringifiedFields({ [field]: text }) as Record<string, unknown>;
    if (typeof revived[field] !== "object") continue;
    fixed = { ...fixed, ...Object.fromEntries(Object.entries(revived).filter(([key, item]) => key === field || item !== undefined && !(Array.isArray(fixed[key]) ? (fixed[key] as unknown[]).length : fixed[key]))) };
    count += 1;
  }
  return { fixed, count };
}

const hit = process.argv.find((item) => item.startsWith("--file="));
if (!hit) {
  console.error("Pass --file=<path to dataset.json>");
  process.exit(1);
}
const file = hit.slice("--file=".length);
const dataset = JSON.parse(readFileSync(file, "utf8")) as EvaluationDataset;
let repaired = 0;
dataset.requirements = dataset.requirements.map((req) => {
  const { fixed, count } = repairRequirement(req as unknown as Record<string, unknown>);
  repaired += count;
  const out = fixed as unknown as RequirementEvaluation;
  if (out.communication) out.communication = finalizeCommunication({ evidence: "", ...out.communication }, out.total_marks, out.discussion_basis);
  return out;
});
if (repaired) {
  dataset.metrics = dataset.requirements.map(computeMetrics);
  dataset.warnings = dataset.warnings.filter((w) => !/Communication/.test(w));
  console.log(`Repaired ${repaired} field(s) that had been saved as spread-out text, and recomputed the metrics.`);
}
const dir = path.dirname(file);
writeFileSync(path.join(dir, "review.md"), renderCalibrationMarkdown({ dataset, report: null, usage: { input_tokens: 0, output_tokens: 0, calls: 0 } }));
writeFileSync(path.join(dir, "student-report.md"), buildPaperReport(dataset));
console.log(`Written to ${dir}: review.md and student-report.md`);
