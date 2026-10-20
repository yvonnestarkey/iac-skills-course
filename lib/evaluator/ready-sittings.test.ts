import assert from "node:assert/strict";
import test from "node:test";
import { findPastPaperSitting } from "../past-papers";
import { hasQuestionModel } from "./question-model";
import { EVALUATOR_READY_SITTINGS, isEvaluatorReadySitting } from "./ready-sittings";

test("every paper of every evaluator-ready sitting has a Question Model", () => {
  for (const id of EVALUATOR_READY_SITTINGS) {
    const sitting = findPastPaperSitting(id);
    assert.ok(sitting, `${id} is not a known sitting`);
    for (const paper of sitting!.papers) assert.ok(hasQuestionModel(paper.id), `${paper.id} has no Question Model`);
  }
});

test("only June 2026 is ready for now", () => {
  assert.equal(isEvaluatorReadySitting("june-2026"), true);
  assert.equal(isEvaluatorReadySitting("nov-2025"), false);
  assert.equal(isEvaluatorReadySitting(null), false);
});
