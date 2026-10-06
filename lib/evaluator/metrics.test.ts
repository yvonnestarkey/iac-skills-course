import assert from "node:assert/strict";
import test from "node:test";
import { applyNotAttemptedRule, computeMetrics, validateRequirement } from "./metrics";
import type { RequirementEvaluation } from "./types";

function base(overrides: Partial<RequirementEvaluation> = {}): RequirementEvaluation {
  return {
    code: "P1Q1_a",
    label: "Q1(a)",
    attempted: true,
    total_marks: 15,
    technical_awarded: 7,
    pvaa_awarded: 1,
    question_type: "Discussion",
    question_type_basis: "",
    competency: { topic: "Strategy", basis: "" },
    bmcr: { student_known: 15, available: 15 },
    buried_treasure: {
      direct: { available: 21, seen: 6, awarded: 5 },
      indirect: { available: 0, seen: 0, awarded: 0 },
      thinking: { available: 0, seen: 0, awarded: 0 },
    },
    volume: { attempts: 24, note: "" },
    components: null,
    core_issue: null,
    rtfq: null,
    communication: null,
    quick_comment: { main_issue: null, certainty: "uncertain", evidence: "" },
    uncertainties: [],
    ...overrides,
  };
}

test("ratios are computed in code from counts", () => {
  const m = computeMetrics(base());
  assert.equal(m.bmcr_conversion, 0.467);
  assert.equal(m.accuracy, 0.292);
  assert.equal(m.proximity_conversion.direct, 0.238);
  assert.equal(m.proximity_conversion.indirect, null); // zero available is not 0%
});

test("not attempted: answer-based measures are discarded, BMCR/type/competency remain", () => {
  const out = applyNotAttemptedRule(base({ attempted: false, technical_awarded: null }));
  assert.equal(out.volume, null);
  assert.equal(out.buried_treasure, null);
  assert.equal(out.technical_awarded, 0);
  assert.equal(out.question_type, "Discussion");
  assert.equal(computeMetrics(out).accuracy, null);
});

test("validation flags impossible values", () => {
  const warnings = validateRequirement(base({ technical_awarded: 20 }));
  assert.ok(warnings.some((w) => w.includes("outside 0–15")));
});
