/**
 * Run the v2 evaluator for one stored exam attempt and write the result to files for review.
 *
 *   npm run calibrate:evaluator -- --attempt=<uuid> [--only=P1Q1_b,P1Q1_a] [--dataset-only] [--save] [--out=calibration-output]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (and optionally EVALUATOR_MODEL)
 * in .env.local. Writes <out>/<attempt>/<timestamp>/dataset.json, report.json, report.md.
 * --save also stores the run in evaluator_runs (needs supabase/evaluator-runs.sql).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runEvaluation, saveEvaluationRun } from "../lib/evaluator/run";
import { renderCalibrationMarkdown } from "../lib/evaluator/render";

function arg(name: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^['"]|['"]$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

async function main() {
  loadEnvLocal();
  const attemptId = arg("attempt");
  if (!attemptId) throw new Error("Pass --attempt=<uuid>");
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const outRoot = arg("out") || "calibration-output";
  const result = await runEvaluation(attemptId, {
    only,
    datasetOnly: process.argv.includes("--dataset-only"),
    onProgress: (message) => console.log(message),
  });
  const dir = path.join(outRoot, attemptId, new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "dataset.json"), JSON.stringify(result.dataset, null, 2));
  if (result.report) writeFileSync(path.join(dir, "report.json"), JSON.stringify(result.report, null, 2));
  writeFileSync(path.join(dir, "review.md"), renderCalibrationMarkdown(result));
  if (process.argv.includes("--save")) console.log("Saved run:", await saveEvaluationRun(attemptId, result));
  console.log(`Usage: ${result.usage.calls} calls, ${result.usage.input_tokens} in / ${result.usage.output_tokens} out tokens`);
  console.log(`Written to ${dir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
