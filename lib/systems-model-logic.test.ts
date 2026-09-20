import assert from "node:assert/strict";
import { test } from "node:test";
import { currentLineageWinner, emptyWorkingState, mergeRevisitQueue, yvonneOutranks } from "./systems-model-logic";

test("later revision replaces the active interpretation without dropping the old id from history", () => {
  const records = [
    { id: "a", supersedes_id: null, epistemic_status: "ai_hypothesis", lifecycle: "superseded" },
    { id: "b", supersedes_id: "a", epistemic_status: "ai_hypothesis", lifecycle: "active" },
  ];
  const winners = currentLineageWinner(records);
  assert.deepEqual(winners.map((row) => row.id), ["b"]);
});

test("Yvonne correction outranks the superseded AI hypothesis", () => {
  const records = [
    { id: "ai", supersedes_id: null, epistemic_status: "superseded", lifecycle: "superseded" },
    { id: "yvonne", supersedes_id: "ai", epistemic_status: "yvonne_corrected", lifecycle: "active" },
  ];
  const winners = currentLineageWinner(records);
  assert.equal(winners[0].id, "yvonne");
  assert.equal(yvonneOutranks("yvonne_corrected"), true);
  assert.equal(yvonneOutranks("ai_hypothesis"), false);
});

test("revisit items accumulate on the working-state queue", () => {
  const first = mergeRevisitQueue(emptyWorkingState(), [{ source_id: "lesson:ch7-l1", reason: "function may be diagnostic" }]);
  const second = mergeRevisitQueue(first, [
    { source_id: "lesson:ch7-l1", reason: "function may be diagnostic" },
    { source_id: "lesson:ch3-l3", reason: "earlier activity may prepare this" },
  ]);
  assert.equal(second.revisit_queue?.length, 2);
});
