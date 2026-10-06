import assert from "node:assert/strict";
import test from "node:test";
import { normalisePageMap, requirementLabel } from "./pagemap";

const expected = [
  { code: "P1Q1_a", title: "SWOT" },
  { code: "P1Q1_d", title: "Green initiatives" },
];

test("labels", () => {
  assert.equal(requirementLabel("P1Q1_d"), "Q1(d)");
  assert.equal(requirementLabel("P1Q2_g1"), "Q2(g1)");
});

test("candidate order is non-authoritative: (d) answered first still maps by label", () => {
  const { map } = normalisePageMap(
    {
      answer_order: ["P1Q1_d", "P1Q1_a"],
      requirements: [
        { code: "P1Q1_d", attempted: true, script_pages: [1, 2, 3, 4], mapped_by: "label", uncertain: false },
        { code: "P1Q1_a", attempted: true, script_pages: [5, 6], mapped_by: "label", uncertain: false },
      ],
    },
    expected,
    { scriptPages: 6, reportPages: 0 }
  );
  assert.deepEqual(map.requirements.find((r) => r.code === "P1Q1_d")?.script_pages, [1, 2, 3, 4]);
  assert.deepEqual(map.requirements.find((r) => r.code === "P1Q1_a")?.script_pages, [5, 6]);
  assert.deepEqual(map.answer_order, ["P1Q1_d", "P1Q1_a"]);
});

test("missing and invalid entries become not-attempted with warnings; content mapping is flagged uncertain", () => {
  const { map, warnings } = normalisePageMap(
    { requirements: [{ code: "P1Q1_a", attempted: true, script_pages: [2, 99], mapped_by: "content", uncertain: false }, { code: "NOPE", attempted: true, script_pages: [1] }] },
    expected,
    { scriptPages: 6, reportPages: 0 }
  );
  const a = map.requirements.find((r) => r.code === "P1Q1_a")!;
  assert.deepEqual(a.script_pages, [2]);
  assert.equal(a.uncertain, true);
  const d = map.requirements.find((r) => r.code === "P1Q1_d")!;
  assert.equal(d.attempted, false);
  assert.ok(warnings.some((w) => w.includes("NOPE")));
  assert.ok(warnings.some((w) => w.includes("P1Q1_d")));
});
