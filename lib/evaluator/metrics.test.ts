import assert from "node:assert/strict";
import test from "node:test";
import { aggregateProximity, applyNotAttemptedRule, bmcrVerdict, buildComponents, buildCoreIssue, computeMetrics, diagnose, enforceCoachHypothesisEvidence, finalizeCommunication, rtfqGate, validateRequirement } from "./metrics";
import { coreComponents, componentTreeSummary, proximityAvailable, questionModelFor, toolsFor, type RequirementModel } from "./question-model";
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

test("diagnoses: volume and accuracy are judged together against the pass mark (draft)", () => {
  const q1a = diagnose(base({ total_marks: 22, technical_awarded: 7, volume: { attempts: 20, note: "" } })).volume_accuracy!;
  assert.equal(q1a.passes, false);
  assert.equal(Math.round(q1a.needed_volume! * 100), 143);
  assert.equal(Math.round(q1a.needed_accuracy! * 100), 55);
  assert.match(q1a.text, /^Volume 91%, Accuracy 35%\. At your accuracy you would have needed to write about 143%/);
  // The worked example from the course: 80% volume at 80% accuracy passes, 80% volume at 50% accuracy does not.
  assert.equal(diagnose(base({ total_marks: 10, technical_awarded: 6.4, volume: { attempts: 8, note: "" } })).volume_accuracy!.passes, true);
  const half = diagnose(base({ total_marks: 10, technical_awarded: 4, volume: { attempts: 8, note: "" } })).volume_accuracy!;
  assert.equal(half.passes, false);
  assert.equal(Math.round(half.needed_volume! * 100), 100);
  const zero = diagnose(base({ total_marks: 6, technical_awarded: 0, volume: { attempts: 4, note: "" } })).volume_accuracy!;
  assert.equal(zero.needed_volume, null);
  assert.match(zero.text, /None of your points earned a mark/);
  assert.equal(diagnose(base({ volume: null })).volume_accuracy, null);
});

test("diagnoses: communication sentence is composed from the counts", () => {
  const pts = (cats: string[]) => cats.map((category, i) => ({ n: i + 1, statement: "x", category: category as "Complete", note: "" }));
  const a = diagnose(base({ communication: { overall: null, points: pts([...Array(11).fill("Complete"), ...Array(7).fill("Underdeveloped"), ...Array(2).fill("Unclear")]), trend: "", evidence: "" } }));
  assert.equal(a.communication!.text, "Many of your points were complete and well communicated. Some were underdeveloped. A few were unclear.");
  assert.equal(a.communication!.counts.Underdeveloped, 7);
  const d = diagnose(base({ communication: { overall: null, points: pts(["Complete", "Complete", "Underdeveloped", "Unclear"]), trend: "", evidence: "" } }));
  assert.equal(d.communication!.text, "Many of your points were complete and well communicated. Some were underdeveloped. Some were unclear.");
  // 12 Oct: Most is over 60%; unreadable points are reported on their own and left out of the shares.
  const u = diagnose(base({ communication: { overall: null, points: pts([...Array(6).fill("Complete"), ...Array(4).fill("Underdeveloped"), "Unreadable"]), trend: "", evidence: "" } }));
  assert.equal(u.communication!.text, "Many of your points were complete and well communicated. Many were underdeveloped. A few of your points could not be read reliably (watch your handwriting).");
});

test("diagnoses: core issues are named and the reflection follows coverage and depth", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q1_a")!.core_issue!;
  const raw = (rows: Record<string, [number, "none" | "surface" | "developed"]>) => ({
    components: Object.entries(rows).map(([component, [attempts, depth]]) => ({ component, attempts, depth })),
    evidence: "",
  });
  const names = {
    bg: "Section 1: Background",
    debt: "Section 2: Debt covenants",
    loco: "Section 4: Damaged locomotives",
  };
  const partly = diagnose(base({ core_issue: buildCoreIssue(model, raw({ [names.bg]: [12, "developed"], [names.debt]: [4, "developed"], [names.loco]: [1, "surface"] })) })).core_issue!;
  assert.equal(partly.core_issues_text, "Background, Debt covenants and Damaged locomotives were the core issues here.");
  assert.equal(partly.reflects, "partly");
  assert.equal(partly.reflection_text, "Your answer partly reflects the core issues: Damaged locomotives got only a surface treatment.");
  const none = diagnose(base({ core_issue: buildCoreIssue(model, raw({})) })).core_issue!;
  assert.equal(none.reflects, "no");
  const yes = diagnose(base({ core_issue: buildCoreIssue(model, raw({ [names.bg]: [3, "developed"], [names.debt]: [2, "developed"], [names.loco]: [2, "developed"] })) })).core_issue!;
  assert.equal(yes.reflection_text, "Your answer reflects the core issues.");
  const q1d = diagnose(base({ core_issue: buildCoreIssue(questionModelFor("iac-2026-p1", "P1Q1_d")!.core_issue!, raw({})) })).core_issue!;
  assert.equal(q1d.core_issues_text, "Goal 7: Affordable and clean energy was the core issue here.");
});

test("question model: Q2(e) is a compliance discussion with 33 classified rows (7 direct, 15 indirect, 11 thinking)", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_e")!;
  assert.equal(model.discussion_basis, "compliance");
  assert.deepEqual(proximityAvailable(model), { direct: 7, indirect: 15, thinking: 11 });
});

test("question model: Q2(f) is a compliance discussion with 40 classified rows including the contingent rows (14 direct, 18 indirect, 8 thinking)", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_f")!;
  assert.equal(model.discussion_basis, "compliance");
  assert.deepEqual(proximityAvailable(model), { direct: 14, indirect: 18, thinking: 8 });
  assert.ok(model.proximity_items.some((item) => item.row === 78));
});

test("question model: Q2(g)(i) is a non-compliance discussion with 19 classified rows (8 direct, 8 indirect, 3 thinking)", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_g1")!;
  assert.equal(model.discussion_basis, "non_compliance");
  assert.deepEqual(proximityAvailable(model), { direct: 8, indirect: 8, thinking: 3 });
});

test("question model: Q2(g)(ii) is a compliance discussion (ISA 300 spine, Yvonne 12 Oct) with 18 classified rows (2 direct, 6 indirect, 10 thinking)", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_g2")!;
  assert.equal(model.discussion_basis, "compliance");
  assert.deepEqual(proximityAvailable(model), { direct: 2, indirect: 6, thinking: 10 });
});

test("question model: Q2(h) is a compliance discussion (ISA 570, Yvonne 12 Oct) with 26 classified rows (8 direct, 13 indirect, 5 thinking)", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_h")!;
  assert.equal(model.discussion_basis, "compliance");
  assert.deepEqual(proximityAvailable(model), { direct: 8, indirect: 13, thinking: 5 });
});

test("the 'why' test counts statements that name an item and stop at the what, coach-only and not in the student text", () => {
  const point = (n: number, explains_why: "yes" | "no" | "not_applicable") => ({ n, statement: "", category: "Complete" as const, note: "", explains_why });
  const m = computeMetrics(base({ communication: { overall: null, points: [point(1, "no"), point(2, "no"), point(3, "yes"), point(4, "not_applicable")], trend: "", evidence: "" } }));
  assert.deepEqual(m.diagnoses.communication?.why, { named: 3, omitted: 2 });
  assert.ok(!/why|threat/i.test(m.diagnoses.communication!.text));
  const old = computeMetrics(base({ communication: { overall: null, points: [{ n: 1, statement: "", category: "Complete", note: "" }], trend: "", evidence: "" } }));
  assert.deepEqual(old.diagnoses.communication?.why, { named: 0, omitted: 0 });
});

test("Q2(f) component tree: basic-theory nodes count as available, public-sector nodes are beyond the basics", () => {
  const summary = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q2_f"));
  assert.ok(summary);
  assert.equal(summary.available + summary.beyond_basics, 32);
  assert.equal(summary.beyond_basics, 4);
  assert.equal(summary.available, 28);
  assert.equal(summary.cpc_issues, 5);
  const layer1 = summary.by_layer1.map((entry) => entry.layer1);
  assert.equal(layer1.length, 6);
  const competence = summary.by_layer1.find((entry) => entry.layer1.includes("competence"));
  assert.deepEqual(competence, { layer1: "ISA 220: competence, capabilities, time and resources", available: 2, beyond_basics: 2 });
  assert.equal(componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q1_b")), null);
});

test("component trees for Q2(e), (g)(i), (g)(ii) and (h): sizes, beyond-the-basics nodes and Code-chain issues", () => {
  const e = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q2_e"))!;
  assert.deepEqual([e.available, e.beyond_basics, e.cpc_issues], [28, 3, 2]);
  assert.deepEqual(e.by_layer1.map((entry) => entry.layer1), ["Business ethics", "Professional ethics (applies to CAs)", "Safeguards (max 3 marks)"]);
  const g1 = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q2_g1"))!;
  assert.deepEqual([g1.available, g1.beyond_basics], [21, 0]);
  assert.deepEqual(g1.by_layer1.map((entry) => entry.layer1), ["Factors that raise the risk", "Factors that lower the risk"]);
  const g2 = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q2_g2"))!;
  assert.deepEqual([g2.available, g2.beyond_basics], [16, 2]);
  const h = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q2_h"))!;
  assert.deepEqual([h.available, h.beyond_basics], [18, 9]);
});

test("buildComponents merges the layered tree: exploited implies recognised, beyond-the-basics nodes are not counted as available, layers are computed in code", () => {
  const model = questionModelFor("iac-2026-p1", "P1Q2_f")!;
  const tree = model.component_tree!;
  const idOf = (label: string) => `n${tree.findIndex((node) => node.label.startsWith(label)) + 1}`;
  const evidence = buildComponents(model, {
    nodes: [
      { id: idOf("Enough staff"), recognised: false, exploited: true, note: "" },
      { id: idOf("Accounting expertise"), recognised: true, exploited: false, note: "" },
      { id: idOf("Knowledge of state-owned"), recognised: true, exploited: false, note: "PFMA mentioned" },
    ],
    code_chain: [{ issue: "Accounting services", indicator: "yes", threat: "yes", principle: "partly" }],
    evidence: "",
  })!;
  assert.equal(evidence.nodes!.length, 32);
  const staff = evidence.nodes!.find((node) => node.label.startsWith("Enough staff"))!;
  assert.deepEqual([staff.recognised, staff.exploited], [true, true]);
  const competence = evidence.layers.find((layer) => layer.layer.includes("competence"))!;
  assert.deepEqual([competence.available, competence.recognised, competence.exploited], [2, 2, 1]);
  assert.ok(!evidence.layers.some((layer) => layer.layer.includes("Public-sector")));
  const beyond = evidence.nodes!.filter((node) => !node.basic_theory);
  assert.equal(beyond.length, 4);
  assert.equal(evidence.layers.reduce((sum, layer) => sum + layer.available, 0), 28);
  assert.deepEqual(evidence.code_chain, [{ issue: "Accounting services", indicator: "yes", threat: "yes", principle: "partly", explanation: "no", significance: "no", safeguard: "no" }]);
});

test("buildComponents keeps the model's flat layers when the requirement has no tree, and has no Code chain without Code issues", () => {
  const flat = buildComponents(questionModelFor("iac-2026-p1", "P1Q1_b"), { layers: [{ layer: "SWOT buckets", source: "required", available: 4, recognised: 4, exploited: 3, note: "" }], evidence: "e" })!;
  assert.equal(flat.layers.length, 1);
  assert.equal(flat.nodes, undefined);
  const g1 = buildComponents(questionModelFor("iac-2026-p1", "P1Q2_g1"), { nodes: [], evidence: "" })!;
  assert.equal(g1.code_chain, undefined);
  assert.equal(buildComponents(questionModelFor("iac-2026-p1", "P1Q1_b"), null), null);
});

test("core issues are components carrying 3+ marks above their fair share: Q2(e) has the Code as core and safeguards (max 3) not", () => {
  const core = (code: string) => (coreComponents(questionModelFor("iac-2026-p1", code)) ?? []).filter((c) => c.core).map((c) => c.label);
  const e = coreComponents(questionModelFor("iac-2026-p1", "P1Q2_e"))!;
  assert.equal(e.find((c) => c.label === "Code of Professional Conduct")!.core, true);
  assert.equal(e.find((c) => c.label === "Safeguards (max 3 marks)")!.core, false);
  assert.deepEqual(core("P1Q2_e").sort(), ["Code of Professional Conduct", "King IV P1: ethical leadership", "NKT's dilemma"].sort());
  // fair share = max / components; core = at least 3 marks above it
  assert.deepEqual(core("P1Q2_g1").sort(), ["Complexity and uncertainty", "Incentives and pressure"].sort());
  assert.deepEqual(core("P1Q2_g2"), ["ISA 300 para 2: attention to important areas of the audit"]);
  assert.deepEqual(core("P1Q2_f").sort(), ["ISA 210: preconditions for the audit", "ISA 220: ethics and independence", "ISA 220: integrity of owners, management and those charged with governance"].sort());
  assert.deepEqual(core("P1Q2_h").sort(), ["16(b): feasibility of management's plans", "16(c): cash flow forecast"].sort());
  assert.equal(coreComponents(questionModelFor("iac-2026-p1", "P1Q1_b")), null);
  // Q1(c): calculation; 10 components, fair share 27 / 10 = 2.7, core from 5.7 marks: tax (11) only
  assert.deepEqual(core("P1Q1_c"), ["Tax"]);
  // Q1(a): SWOT is Layer 1, the case section is Layer 2; 10 components, fair share 20 / 10 = 2, core from 5 marks
  assert.deepEqual(core("P1Q1_a").sort(), ["Strengths: Background", "Threats: Background", "Weaknesses: Background"].sort());
  // Q1(d): fair share 3, core from 6 marks
  assert.deepEqual(core("P1Q1_d"), ["Goal 7: affordable and clean energy"]);
});

test("Q1(a) and Q1(d) component trees: SWOT then case section; the two turnaround-section marks are not components", () => {
  const a = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q1_a"))!;
  assert.deepEqual(a.by_layer1.map((entry) => [entry.layer1, entry.available]), [["Strengths", 6], ["Weaknesses", 10], ["Opportunities", 2], ["Threats", 17]]);
  assert.equal(a.available, 35);
  const d = componentTreeSummary(questionModelFor("iac-2026-p1", "P1Q1_d"))!;
  assert.deepEqual(d.by_layer1.map((entry) => [entry.layer1, entry.available]), [["Goal 6: clean water and sanitation", 3], ["Goal 7: affordable and clean energy", 6]]);
});

test("Q2(e): the Code is one component (applies, issues, principles together)", () => {
  const tree = questionModelFor("iac-2026-p1", "P1Q2_e")!.component_tree!;
  const code = tree.filter((n) => n.path[1] === "Code of Professional Conduct");
  assert.equal(code.length, 8);
  assert.equal(code.filter((n) => n.chain === "cpc").length, 2);
});
