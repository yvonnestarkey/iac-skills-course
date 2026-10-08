import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics, finalizeCommunication } from "./metrics";
import { buildPartReport, buildStudentReports, groupByPart, partTitle, showsKey } from "./student-report";
import type { EvaluationDataset, RequirementEvaluation } from "./types";

function req(overrides: Partial<RequirementEvaluation> = {}): RequirementEvaluation {
  return {
    code: "P1Q1_a", label: "Q1(a)", attempted: true, total_marks: 22, technical_awarded: 7, pvaa_awarded: 0,
    question_type: "Discussion", discussion_basis: "non_compliance", question_type_basis: "", competency: { topic: "Going concern", basis: "" },
    bmcr: { student_known: 15, available: 22 }, buried_treasure_items: null,
    buried_treasure: { direct: { available: 14, seen: 6, awarded: 4 }, indirect: { available: 16, seen: 3, awarded: 2 }, thinking: { available: 7, seen: 1, awarded: 1 } },
    volume: { attempts: 20, note: "" }, components: { layers: [{ layer: "Case sections", source: "case_sections", available: 6, recognised: 4, exploited: 3, note: "" }], evidence: "" },
    core_issue: null,
    rtfq: { dimensions: [{ dimension: "shape", required: "Discuss", delivered: "yes", note: "" }, { dimension: "lens", required: "Going concern", delivered: "yes", note: "" }], evidence: "" },
    communication: { overall: null, points: [{ n: 1, statement: "a", category: "Complete", note: "" }, { n: 2, statement: "b", category: "Underdeveloped", note: "" }], trend: "", evidence: "" },
    quick_comment: { main_issue: null, certainty: "uncertain", evidence: "" }, uncertainties: [], ...overrides,
  };
}

function dataset(requirements: RequirementEvaluation[]): EvaluationDataset {
  const finished = requirements.map((r) => ({ ...r, communication: finalizeCommunication(r.communication, r.total_marks, r.discussion_basis) }));
  return { version: 1, attempt_id: "t", sitting_id: "s", paper_id: "iac-2026-p1", generated_at: "", model: "", page_map: { requirements: [], answer_order: [] }, bmcr_rows: [], requirements: finished, metrics: finished.map(computeMetrics), source_notes: [], warnings: [] };
}

test("parts are grouped by question and titled in paper order", () => {
  const ds = dataset([req(), req({ code: "P1Q1_d", label: "Q1(d)" }), req({ code: "P1Q2_e", label: "Q2(e)" })]);
  assert.deepEqual(groupByPart(ds).map((p) => [p.title, p.requirements.length]), [["Paper 1 · Part I", 2], ["Paper 1 · Part II", 1]]);
  assert.equal(partTitle("P2Q1"), "Paper 2 · Part I");
});

test("every Part report has the same eight steps in the same order, with 9 and 10 held back", () => {
  const md = buildStudentReports(dataset([req(), req({ code: "P1Q2_e", label: "Q2(e)" })])).map((r) => r.markdown);
  for (const m of md) {
    const steps = [...m.matchAll(/### Step (\d+): (.+)/g)].map((x) => x[1]);
    assert.deepEqual(steps, ["1", "2", "3", "4", "5", "6", "7", "8"]);
    assert.ok(!m.includes("Step 9") && !m.includes("Step 10"));
    assert.equal((m.match(/\*\*What it asks:\*\*/g) ?? []).length, 8);
    assert.equal((m.match(/\*\*How to do it yourself:\*\*/g) ?? []).length, 8);
  }
});

test("model-written lines appear under 'What it shows' only when supplied", () => {
  const ds = dataset([req()]);
  const part = groupByPart(ds)[0];
  assert.ok(!buildPartReport(ds, part).includes("What it shows"));
  const withShows = buildPartReport(ds, part, { [showsKey("P1Q1", "rtfq")]: "You delivered both." });
  assert.ok(withShows.includes("**What it shows:** You delivered both."));
});

test("students see the communication diagnosis, never the counts", () => {
  const md = buildStudentReports(dataset([req()]))[0].markdown;
  const comm = md.slice(md.indexOf("### Step 8"));
  assert.ok(/Q1\(a\):/.test(comm));
  assert.ok(!/Underdeveloped\s*\|/.test(comm) && !/\d+ of \d+ statements/.test(comm));
});

test("volume and accuracy are shown together with the conclusion", () => {
  const md = buildStudentReports(dataset([req()]))[0].markdown;
  const step5 = md.slice(md.indexOf("### Step 5"), md.indexOf("### Step 6"));
  assert.ok(step5.includes("| Volume | Accuracy | Share of marks earned | Conclusion |"));
  assert.ok(/Q1\(a\) \| 91% \| 35% \| 32% \|/.test(step5));
});

test("misread RTFQ carries the plain message and non-discussion rows skip discussion tools", () => {
  const misread = req({ code: "P1Q1_c", label: "Q1(c)", question_type: "Non-discussion", discussion_basis: null, buried_treasure: null, volume: null, components: null, communication: null,
    rtfq: { dimensions: [{ dimension: "shape", required: "Calculate", delivered: "no", note: "wrote a discussion" }], evidence: "" } });
  const md = buildStudentReports(dataset([misread]))[0].markdown;
  assert.ok(md.includes("you earned little here because the question was misread"));
  assert.ok(!/Q1\(c\) \| \d+%/.test(md.slice(md.indexOf("### Step 5"), md.indexOf("### Step 6"))));
  assert.ok(md.slice(md.indexOf("### Step 4"), md.indexOf("### Step 5")).includes("Not applicable"));
});

test("not attempted requirement appears in BMCR and type only", () => {
  const na = req({ attempted: false, technical_awarded: 0, rtfq: null, buried_treasure: null, volume: null, components: null, communication: null });
  const md = buildStudentReports(dataset([na]))[0].markdown;
  assert.ok(md.slice(md.indexOf("### Step 1"), md.indexOf("### Step 2")).includes("Q1(a)"));
  assert.ok(md.slice(md.indexOf("### Step 3"), md.indexOf("### Step 4")).includes("Not attempted"));
});

test("step 2 shows three categories: compliance discussion, non-compliance discussion, and the third kind", () => {
  const md = buildStudentReports(dataset([req({ discussion_basis: "compliance" }), req({ code: "P1Q1_d", label: "Q1(d)" }), req({ code: "P1Q1_c", label: "Q1(c)", question_type: "Non-discussion", discussion_basis: null })]))[0].markdown;
  const step2 = md.slice(md.indexOf("### Step 2"), md.indexOf("### Step 3"));
  assert.ok(step2.includes("Discussion: compliance (rules)"));
  assert.ok(step2.includes("Discussion: non-compliance (tools)"));
  assert.ok(step2.includes("Non-discussion"));
  assert.ok(!step2.includes("Calculation"));
});
