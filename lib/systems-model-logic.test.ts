import assert from "node:assert/strict";
import { test } from "node:test";
import { currentLineageWinner, emptyWorkingState, mergeRevisitQueue, mergeWorkingState, yvonneOutranks } from "./systems-model-logic";

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

test("working-state patches merge lists instead of replacing them", () => {
  const first = mergeWorkingState(emptyWorkingState(), {
    examined_deeply: [{ source_id: "lesson:ch7-l1" }],
    revisit_queue: [{ source_id: "lesson:ch7-l1", reason: "check diagnostic function" }],
    next_investigation: "read ch10",
  });
  const second = mergeWorkingState(first, {
    examined_deeply: [{ source_id: "lesson:ch10-l6" }],
    next_investigation: "ask Yvonne about dual function",
  });
  assert.equal(second.examined_deeply?.length, 2);
  assert.equal(second.revisit_queue?.length, 1);
  assert.equal(second.next_investigation, "ask Yvonne about dual function");
});

test("revisit items accumulate on the working-state queue", () => {
  const first = mergeRevisitQueue(emptyWorkingState(), [{ source_id: "lesson:ch7-l1", reason: "function may be diagnostic" }]);
  const second = mergeRevisitQueue(first, [
    { source_id: "lesson:ch7-l1", reason: "function may be diagnostic" },
    { source_id: "lesson:ch3-l3", reason: "earlier activity may prepare this" },
  ]);
  assert.equal(second.revisit_queue?.length, 2);
});
