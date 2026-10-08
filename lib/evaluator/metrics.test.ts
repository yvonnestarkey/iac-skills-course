import assert from "node:assert/strict";
import test from "node:test";
import { aggregateProximity, applyNotAttemptedRule, bmcrVerdict, buildCoreIssue, computeMetrics, enforceCoachHypothesisEvidence, finalizeCommunication, rtfqGate, validateRequirement } from "./metrics";
import { questionModelFor, toolsFor, type RequirementModel } from "./question-model";
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
    discussion_basis: "non_compliance",
    question_type_basis: "",
    competency: { topic: "Strategy", basis: "" },
    bmcr: { student_known: 15, available: 15 },
    buried_treasure_items: null,
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

test("BMCR verdicts use fixed 50% / 70% thresholds, exactly 50% counts as enough theory", () => {
  assert.equal(bmcrVerdict(7, 15, 22), "enough_theory_not_converting"); // Q1(a): 68% basic, 47% converted
  assert.equal(bmcrVerdict(0, 3, 6), "enough_theory_not_converting"); // Q1(d): exactly 50% basic
  assert.equal(bmcrVerdict(0, 7, 11), "enough_theory_not_converting"); // Q1(b): not attempted, still has a BMCR
  assert.equal(bmcrVerdict(7, 10, 20), "enough_theory_converting"); // exactly 70% converts
  assert.equal(bmcrVerdict(2, 5, 20), "not_enough_theory");
  assert.equal(bmcrVerdict(0, 0, 20), "no_basic_marks");
  assert.equal(bmcrVerdict(null, null, 20), "no_basic_marks");
});

test("tool gating: discussion runs the full set, calculation and not-attempted do not", () => {
  assert.equal(toolsFor("Discussion", true).components, true);
  assert.equal(toolsFor("Discussion", true).volumeAccuracy, true);
  assert.equal(toolsFor("Non-discussion", true).volumeAccuracy, false);
  assert.equal(toolsFor("Non-discussion", true).coreIssue, false);
  assert.equal(toolsFor("Discussion", false).buriedTreasure, false);
  // RTFQ is pervasive: it runs on every attempted requirement, calculation included, never on a skipped one.
  assert.equal(toolsFor("Non-discussion", true).rtfq, true);
  assert.equal(toolsFor("Discussion", false).rtfq, false);
});

test("rtfq gate: a missed shape or lens is a misread; the other tools still run", () => {
  const dim = (dimension: "shape" | "directions" | "lens", delivered: "yes" | "partly" | "no") => ({ dimension, required: "", delivered, note: "" });
  assert.equal(rtfqGate({ dimensions: [dim("shape", "yes"), dim("directions", "partly"), dim("lens", "partly")], evidence: "" }), "clear");
  assert.equal(rtfqGate({ dimensions: [dim("shape", "no"), dim("directions", "yes"), dim("lens", "yes")], evidence: "" }), "misread");
  assert.equal(rtfqGate({ dimensions: [dim("shape", "yes"), dim("directions", "yes"), dim("lens", "no")], evidence: "" }), "misread");
  assert.equal(rtfqGate({ dimensions: [dim("shape", "yes"), dim("directions", "no"), dim("lens", "yes")], evidence: "" }), "clear");
  assert.equal(rtfqGate(null), null);
});

test("proximity aggregation uses the pre-calibrated model, with Available as denominator", () => {
  const model: RequirementModel = {
    question_type: "Discussion",
    proximity_items: [
      { row: 12, proximity: "direct" },
      { row: 14, proximity: "direct" },
      { row: 21, proximity: "indirect" },
      { row: 30, proximity: "thinking" },
    ],
  };
  const out = aggregateProximity(model, [
    { row: 12, seen: true, awarded: true },
    { row: 14, seen: true, awarded: false },
    { row: 21, seen: false, awarded: false },
    { row: 99, seen: true, awarded: true }, // not in the model: ignored
  ]);
  assert.deepEqual(out?.direct, { available: 2, seen: 2, awarded: 1 });
  assert.deepEqual(out?.indirect, { available: 1, seen: 0, awarded: 0 });
  assert.deepEqual(out?.thinking, { available: 1, seen: 0, awarded: 0 });
  assert.equal(aggregateProximity({ question_type: "Discussion", proximity_items: [] }, []), null);
});

test("components layers: recognised cannot exceed available, exploited cannot exceed recognised", () => {
  const ok = base({
    components: {
      layers: [
        { layer: "SWOT buckets", source: "required", available: 4, recognised: 4, exploited: 4, note: "all four used" },
        { layer: "Case sections", source: "case_sections", available: 5, recognised: 2, exploited: 2, note: "sections 1 and 2" },
      ],
      evidence: "",
    },
  });
  assert.deepEqual(validateRequirement(ok), []);
  const bad = base({
    components: { layers: [{ layer: "Goals", source: "required", available: 2, recognised: 3, exploited: 3, note: "" }], evidence: "" },
  });
  assert.equal(validateRequirement(bad).length, 1 + 0);
});

test("core issue: priority comes from the model; alignment is coverage of higher-priority components", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q1_a")!.core_issue!;
  const out = buildCoreIssue(model, {
    components: [
      { component: "Section 1: Background", attempts: 15, depth: "surface" },
      { component: "Section 2: Debt covenants", attempts: 7, depth: "surface" },
      { component: "Section 4: Damaged locomotives", attempts: 0, depth: "none" },
      { component: "Section 5: Green initiatives", attempts: 3, depth: "surface" },
    ],
    evidence: "",
  })!;
  assert.equal(out.higher_total, 3);
  assert.equal(out.higher_covered, 2);
  assert.equal(out.alignment, "partly");
  assert.equal(out.components.find((c) => c.component.startsWith("Section 6"))!.attempts, 0); // missing from model output = 0
  assert.equal(buildCoreIssue(undefined, { components: [], evidence: "" }), null);
  const none = buildCoreIssue(model, { components: [], evidence: "" })!;
  assert.equal(none.alignment, "misaligned");
});

test("core issue: a dominant component is optional and reported when present", () => {
  const model = [
    { layer: "Assertions", component: "Valuation", priority: "dominant" as const, clue_type: "materiality" as const, clue: "" },
    { layer: "Assertions", component: "Existence", priority: "higher" as const, clue_type: "risk" as const, clue: "" },
    { layer: "Assertions", component: "Presentation", priority: "lower" as const, clue_type: "low_relevance" as const, clue: "" },
  ];
  const out = buildCoreIssue(model, {
    components: [
      { component: "Existence", attempts: 4, depth: "surface" },
      { component: "Valuation", attempts: 0, depth: "none" },
    ],
    evidence: "",
  })!;
  assert.equal(out.higher_total, 2);
  assert.equal(out.dominant_covered, false);
  assert.equal(out.alignment, "partly");
  const q1a = buildCoreIssue(questionModelFor("iac-2026-p1", "P1Q1_a")!.core_issue!, { components: [], evidence: "" })!;
  assert.equal(q1a.dominant_covered, null); // Q1(a) has no dominant component
});

test("rtfq: three dimensions with yes/partly/no; duplicates or gaps are flagged", () => {
  const ok = base({
    rtfq: {
      dimensions: [
        { dimension: "shape", required: "Discuss", delivered: "no", note: "" },
        { dimension: "directions", required: "Goals 6 and 7", delivered: "no", note: "" },
        { dimension: "lens", required: "Alignment with the goals", delivered: "partly", note: "" },
      ],
      evidence: "",
    },
  });
  assert.deepEqual(validateRequirement(ok), []);
  const bad = base({ rtfq: { dimensions: [{ dimension: "shape", required: "", delivered: "yes", note: "" }], evidence: "" } });
  assert.equal(validateRequirement(bad).length, 1);
});

test("communication: per-point categories; trend must not be quantified; points should match Volume", () => {
  const ok = base({
    volume: { attempts: 2, note: "" },
    communication: {
      overall: { introduction: "not_expected", introduction_note: "", knowledge: null, application: null, so_what: null, note: "" },
      points: [
        { n: 1, statement: "Steps aligned with the UN goals", category: "Underdeveloped", note: "" },
        { n: 2, statement: "More aligned with...", category: "Unclear", note: "sentence stops" },
      ],
      trend: "Mostly underdeveloped, with one unfinished sentence.",
      evidence: "",
    },
  });
  assert.deepEqual(validateRequirement(ok), []);
  const bad = base({
    volume: { attempts: 6, note: "" },
    communication: { overall: null, points: [{ n: 1, statement: "x", category: "Complete", note: "" }], trend: "4 of 6 were underdeveloped", evidence: "" },
  });
  assert.equal(validateRequirement(bad).length, 3);
});

test("communication overall: introduction from 10 marks; knowledge/application/so-what only for compliance", () => {
  const overall = { introduction: "present", introduction_note: "", knowledge: "yes", application: "partly", so_what: "no", note: "" } as const;
  const comm = { overall, points: [], trend: "", evidence: "" };
  assert.equal(finalizeCommunication(comm, 6, "compliance")!.overall!.introduction, "not_expected");
  assert.equal(finalizeCommunication(comm, 10, "compliance")!.overall!.introduction, "present");
  assert.equal(finalizeCommunication({ ...comm, overall: { ...overall, introduction: "not_expected" } }, 22, "compliance")!.overall!.introduction, "absent");
  assert.equal(finalizeCommunication(comm, 22, "compliance")!.overall!.application, "partly");
  const tools = finalizeCommunication(comm, 22, "non_compliance")!.overall!;
  assert.deepEqual([tools.knowledge, tools.application, tools.so_what], [null, null, null]);
  assert.equal(tools.introduction, "not_expected");
  assert.equal(finalizeCommunication(null, 22, null), null);
  const bad = base({ discussion_basis: "non_compliance", total_marks: 22, volume: { attempts: 0, note: "" }, communication: { overall, points: [], trend: "", evidence: "" } });
  assert.equal(validateRequirement(bad).length, 1);
  assert.equal(validateRequirement(base({ ...bad, communication: { overall: { ...overall, introduction: "not_expected", knowledge: null, application: null, so_what: null }, points: [], trend: "", evidence: "" } })).length, 0);
});

test("question model: discussion_basis is calibrated (all non_compliance for Q1(a), (b), (d)) and absent for non-discussion", () => {
  assert.equal(questionModelFor("iac-2026-p1", "P1Q1_a")!.discussion_basis, "non_compliance");
  assert.equal(questionModelFor("iac-2026-p1", "P1Q1_d")!.discussion_basis, "non_compliance");
  assert.equal(questionModelFor("iac-2026-p1", "P1Q1_c")!.discussion_basis ?? null, null);
});

test("coach hypotheses: need two distinct valid requirements to be supported; unknown codes dropped", () => {
  const h = { skill_gap: "g", pattern: "p", evidence: [], working_hypothesis: "w", would_confirm: "c", would_reject: "r", probe: "q", skill_to_train: "t" };
  const out = enforceCoachHypothesisEvidence(
    [
      { ...h, evidence_requirements: ["P1Q1_a", "P1Q1_a"], confidence: "supported" },
      { ...h, evidence_requirements: ["P1Q1_a", "P1Q1_d"], confidence: "supported" },
      { ...h, evidence_requirements: ["P1Q1_a", "NOPE"], confidence: "supported" },
    ],
    ["P1Q1_a", "P1Q1_d"]
  );
  assert.deepEqual(out.map((x) => x.confidence), ["tentative", "supported", "tentative"]);
  assert.deepEqual(out[2].evidence_requirements, ["P1Q1_a"]);
});
