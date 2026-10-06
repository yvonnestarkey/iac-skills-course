# Script Evaluator v2 (calibration build)

Branch `evaluator-v2`. Not wired to the student submit flow yet; staff/calibration only.

Pipeline (per exam attempt):
1. **Stage 0** — map script pages to requirements by the candidate's written labels (never by page order), map marking-report pages, transcribe the student's BMCR sheet.
2. **Stage 1** — per requirement, observation only: marks, Question Type, Competency, Buried Treasure, Volume, Components, Core Issue, RTFQ, Communication, plus a "quick comment" with certainty. Ratios (BMCR conversion, Accuracy, proximity conversion) are computed in code in `metrics.ts`. NOT_ATTEMPTED rule enforced in code.
3. **Stage 2** — synthesise 2–4 patterns as working hypotheses with probes, using the confirmed Eve rules (`lib/data/eve-rules/rules.json`). Coach-only flags (wellbeing, quit risk, data quality) are separate from the student report.

Methodology text comes from `lib/data/eve-tools/tools.json` (evaluator tools) and `lib/data/eve-rules/rules.json` (Eve rules). Refresh these from the Obsidian vault when rules change.

Run a calibration:
`npm run calibrate:evaluator -- --attempt=<uuid> --only=P1Q1_b` → writes dataset.json, report.json, review.md under `calibration-output/`.
Add `--save` to store the run in `evaluator_runs` (run `supabase/evaluator-runs.sql` first).
Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, optional EVALUATOR_MODEL (default claude-sonnet-5-5).
