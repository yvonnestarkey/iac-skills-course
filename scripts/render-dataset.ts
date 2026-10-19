/**
 * Rebuild the review sheet from a dataset.json an earlier run already wrote. No model calls, no cost.
 *
 *   npm run render:dataset -- --file=calibration-output/<attempt>/<paper>/<timestamp>/dataset.json
 *
 * Writes review.md next to the dataset (and student-report.md with the Per Paper Report).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderCalibrationMarkdown } from "../lib/evaluator/render";
import { buildPaperReport } from "../lib/evaluator/student-report";
import type { EvaluationDataset } from "../lib/evaluator/types";

const hit = process.argv.find((item) => item.startsWith("--file="));
if (!hit) {
  console.error("Pass --file=<path to dataset.json>");
  process.exit(1);
}
const file = hit.slice("--file=".length);
const dataset = JSON.parse(readFileSync(file, "utf8")) as EvaluationDataset;
const dir = path.dirname(file);
writeFileSync(path.join(dir, "review.md"), renderCalibrationMarkdown({ dataset, report: null, usage: { input_tokens: 0, output_tokens: 0, calls: 0 } }));
writeFileSync(path.join(dir, "student-report.md"), buildPaperReport(dataset));
console.log(`Written to ${dir}: review.md and student-report.md`);
