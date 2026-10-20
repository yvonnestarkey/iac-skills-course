import assert from "node:assert/strict";
import test from "node:test";
import { jobIsClaimable, newEvaluatorApplies, parseEvaluatorMode, questionsDone, studentPaperStatus } from "./job-rules";

test("the switch: staff mode only takes staff test attempts; all takes everyone; off takes nobody", () => {
  const base = { sittingReady: true, wholeSitting: true };
  assert.equal(newEvaluatorApplies({ ...base, mode: "staff", staffTest: true }), true);
  assert.equal(newEvaluatorApplies({ ...base, mode: "staff", staffTest: false }), false);
  assert.equal(newEvaluatorApplies({ ...base, mode: "all", staffTest: false }), true);
  assert.equal(newEvaluatorApplies({ ...base, mode: "off", staffTest: true }), false);
});

test("only sittings with Question Models, and only whole-sitting uploads", () => {
  assert.equal(newEvaluatorApplies({ mode: "all", staffTest: false, sittingReady: false, wholeSitting: true }), false);
  assert.equal(newEvaluatorApplies({ mode: "all", staffTest: false, sittingReady: true, wholeSitting: false }), false);
});

test("unknown switch values fall back to staff only", () => {
  assert.equal(parseEvaluatorMode(undefined), "staff");
  assert.equal(parseEvaluatorMode("all"), "all");
  assert.equal(parseEvaluatorMode("everyone"), "staff");
});

test("a job is claimable when unfinished and not locked", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(jobIsClaimable({ status: "queued", locked_until: null }, now), true);
  assert.equal(jobIsClaimable({ status: "running", locked_until: "2026-10-20T12:03:00Z" }, now), false);
  assert.equal(jobIsClaimable({ status: "running", locked_until: "2026-10-20T11:50:00Z" }, now), true);
  assert.equal(jobIsClaimable({ status: "done", locked_until: null }, now), false);
  assert.equal(jobIsClaimable({ status: "failed", locked_until: null }, now), false);
});

test("students never see 'failed': it reads as being checked", () => {
  assert.equal(studentPaperStatus({ status: "failed" }), "checking");
  assert.equal(studentPaperStatus({ status: "done" }), "done");
  assert.equal(studentPaperStatus(null), "waiting");
  assert.deepEqual(questionsDone({ evaluations: { a: 1, b: 2 } }, 9), { done: 2, total: 9 });
});
