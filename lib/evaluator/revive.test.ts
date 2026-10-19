import assert from "node:assert/strict";
import test from "node:test";
import { reviveStringifiedFields } from "./revive";

test("revives an object the model returned as a JSON string", () => {
  const out = reviveStringifiedFields({ attempted: true, communication: '{"overall":{"introduction":"absent"},"points":[{"n":1}]}', note: "plain text" }) as Record<string, unknown>;
  assert.deepEqual((out.communication as { points: unknown[] }).points, [{ n: 1 }]);
  assert.equal(out.note, "plain text");
  assert.equal(out.attempted, true);
});

test("leaves text that is not JSON alone", () => {
  const out = reviveStringifiedFields({ evidence: "{not json" }) as Record<string, unknown>;
  assert.equal(out.evidence, "{not json");
});

test("recovers sibling fields that were glued onto the end of a stringified field", () => {
  const glued = '{"overall":{"introduction":"absent"},"points":[{"n":1}],"trend":"t"},"quick_comment":{"main_issue":"x","certainty":"supported","evidence":"e"},"uncertainties":["u"]}';
  const out = reviveStringifiedFields({ attempted: true, communication: glued }) as Record<string, unknown>;
  assert.deepEqual((out.communication as { points: unknown[] }).points, [{ n: 1 }]);
  assert.equal((out.quick_comment as { certainty: string }).certainty, "supported");
  assert.deepEqual(out.uncertainties, ["u"]);
});

test("a recovered sibling never overwrites a real value", () => {
  const out = reviveStringifiedFields({ uncertainties: ["real"], communication: '{"points":[]},"uncertainties":["glued"]}' }) as Record<string, unknown>;
  assert.deepEqual(out.uncertainties, ["real"]);
});
