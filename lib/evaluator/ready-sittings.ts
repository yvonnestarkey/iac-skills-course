/**
 * Sittings the new Script Evaluator can mark: every paper in the sitting has a pre-calibrated Question Model.
 * Kept as a plain list (not derived from the model files) so the student upload screen does not ship the models to
 * the browser. ready-sittings.test.ts checks this list against the Question Models.
 * Add a sitting here only after its three Question Models are in lib/data/question-models (Yvonne, 20 Oct 2026).
 */
export const EVALUATOR_READY_SITTINGS: readonly string[] = ["june-2026"];

export function isEvaluatorReadySitting(sittingId: string | null | undefined): boolean {
  return Boolean(sittingId && EVALUATOR_READY_SITTINGS.includes(sittingId));
}
