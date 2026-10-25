import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics, finalizeCommunication } from "./metrics";
import { buildOverallReport } from "./overall-report";
import { buildPaperReport, groupByPart, reportHeader } from "./student-report";
import { signalLines } from "./signals";
import { pct, num } from "./report-format";
import type { EvaluationDataset, RequirementEvaluation } from "./types";

const bucket = (available: number, awarded: number) => ({ available, seen: awarded, awarded });
function req(overrides: Partial<RequirementEvaluation> = {}): RequirementEvaluation {
  return {
    code: "P1Q1_a", label: "Q1(a)", attempted: true, total_marks: 22, technical_awarded: 5, pvaa_awarded: 2,
    question_type: "Discussion", discussion_basis: "non_compliance", question_type_basis: "", competency: { topic: "Going concern", basis: "" },
    bmcr: { student_known: 15, available: 22 }, buried_treasure_items: null,
    buried_treasure: { direct: bucket(14, 3), indirect: bucket(16, 4), thinking: bucket(7, 0) },
    volume: { attempts: 24, note: "" }, components: null, core_issue: null,
    rtfq: { dimensions: [{ dimension: "shape", required: "Prepare a SWOT analysis", delivered: "yes", note: "" }, { dimension: "lens", required: "Going concern", delivered: "partly", note: "x" }], evidence: "" },
    communication: { overall: null, points: [
      { n: 1, statement: "a", category: "Complete", note: "" }, { n: 2, statement: "b", category: "Underdeveloped", note: "" },
      { n: 3, statement: "c", category: "Underdeveloped", note: "" }, { n: 4, statement: "d", category: "Complete", note: "" } ], trend: "", evidence: "" },
    quick_comment: { main_issue: null, certainty: "uncertain", evidence: "" }, uncertainties: [], ...overrides,
  };
}
function dataset(paper: number, requirements: RequirementEvaluation[]): EvaluationDataset {
  const finished = requirements.map((r) => ({ ...r, communication: finalizeCommunication(r.communication, r.total_marks, r.discussion_basis) }));
  return { version: 1, attempt_id: "t", sitting_id: "s", paper_id: `iac-2026-p${paper}`, generated_at: "", model: "", page_map: { requirements: [], answer_order: [] },
    bmcr_rows: [], requirements: finished, metrics: finished.map(computeMetrics), source_notes: [], warnings: [] };
}

test("formatting: half-up rounding and one-decimal marks", () => {
  assert.equal(pct(5, 8), "63%");
  assert.equal(pct(0, 0), "-");
  assert.equal(num(20.5), "20.5");
  assert.equal(num(20), "20");
});

test("Per Paper Report: header, how-to-read and the five steps in order, in Yvonne's wording, tables only", () => {
  const ds = dataset(1, [req(), req({ code: "P1Q2_e", label: "Q2(e)", discussion_basis: "compliance" })]);
  const md = buildPaperReport(ds, { paperNames: { 1: "Inpahla" } });
  assert.ok(md.startsWith("###### (Student name) · June 2026\n\n# Paper 1: Inpahla"));
  assert.ok(md.includes("Each Paper report follows the same five steps"));
  const steps = [...md.matchAll(/^## (Step \d)\. ([^:]+):/gm)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(steps, ["Step 1 RTFQ", "Step 2 Buried Treasure", "Step 3 Volume and Accuracy", "Step 4 Components and Core Issue", "Step 5 Communication"]);
  assert.ok(md.includes("A line that only introduces the points under it is not counted."));
  assert.ok(!md.includes("What it shows"));
  assert.ok(md.includes("### Part I") && md.includes("### Part II"));
  assert.equal(reportHeader(ds, { studentName: "Sam" }), "Paper 1");
});

test("Step 1 shows Delivered? as Yes / Partly / No and says Not attempted", () => {
  const md = buildPaperReport(dataset(1, [req(), req({ code: "P1Q1_b", label: "Q1(b)", attempted: false })]));
  const s1 = md.slice(md.indexOf("## Step 1"), md.indexOf("## Step 2"));
  assert.ok(s1.includes("| Shape | Prepare a SWOT analysis | Yes |"));
  assert.ok(s1.includes("| Lens | Going concern | Partly | x |"));
  assert.ok(s1.includes("Not attempted"));
});

test("Step 2 shows earned of available at three distances", () => {
  const md = buildPaperReport(dataset(1, [req()]));
  assert.ok(md.includes("| Q1(a) | 3 of 14 | 4 of 16 | 0 of 7 |"));
});

test("Step 3 shows volume points and accuracy with no combined column; communication shows the diagnosis, never counts", () => {
  const md = buildPaperReport(dataset(1, [req()]));
  const s3 = md.slice(md.indexOf("## Step 3"), md.indexOf("## Step 4"));
  assert.ok(s3.includes("| Q1(a) | 22 | 24 | 109% | 5 | 21% |\n") || s3.includes("| Q1(a) | 22 | 24 | 109% | 5 | 21% |"));
  assert.ok(!s3.includes("×"), "no combined Volume × Accuracy / Coverage × Accuracy column");
  assert.ok(s3.includes("**Discussion questions (Volume and Accuracy)**"));
  const s5 = md.slice(md.indexOf("## Step 5"));
  assert.ok(s5.includes("- **Complete:**") && s5.includes("**Most** = more than 60%"));
  assert.ok(/\| Q1\(a\) \| \*\*.*(complete|underdeveloped)/.test(s5));
  assert.ok(!/\d+ of \d+ statements/.test(s5));
});

test("Overall Report: BMCR caps Basic at the Required Total and counts professional marks in Marks Earned", () => {
  // Q1(a): total 22, known 30 (capped to 22), earned 5 + 2 = 7
  const md = buildOverallReport([dataset(1, [req({ bmcr: { student_known: 30, available: 22 } })])]);
  const s1 = md.slice(md.indexOf("## Step 1"), md.indexOf("## Step 2"));
  assert.ok(s1.includes("| Part I | 22 | 7 | 32% | 22 | 100% | 32% | Enough theory, not converting |"));
  assert.ok(s1.includes("The exam (1 paper)"));
});

test("Overall Report: types and pillars use marks without the professional marks; under 35% is High Risk; PVAAs have their own row", () => {
  const md = buildOverallReport([dataset(1, [req(), req({ code: "P1Q2_f", label: "Q2(f)", discussion_basis: "compliance", total_marks: 11, technical_awarded: 9, pvaa_awarded: 1 })])]);
  const s2 = md.slice(md.indexOf("## Step 2"), md.indexOf("## Step 3"));
  // Q1(a): 22 - 2 PVAA = 20 available, 5 earned (25%): Strategy is High Risk. Q2(f): 11 - 1 = 10, 9 earned (90%): Audit.
  assert.ok(s2.includes("5 of 20 (25%)"));
  assert.ok(/Strategy, Risk Management & Governance[^\n]*\n\|[^\n]*\*\*5 of 20 \(25%\) High Risk\*\*/.test(s2));
  assert.ok(!/\*\*9 of 10 \(90%\) High Risk/.test(s2));
  assert.ok(s2.includes("Effective Communication & PVAAs") && s2.includes("3 of 3 (100%)"));
  assert.ok(s2.indexOf("Audit & Assurance (") < s2.indexOf("Strategy, Risk Management & Governance ("), "best to weakest");
});

test("Signals: Direct and Indirect at half, Volume and Accuracy at 60%, separately", () => {
  const ds = dataset(1, [req({ buried_treasure: { direct: bucket(14, 7), indirect: bucket(10, 6), thinking: bucket(0, 0) }, volume: { attempts: 11, note: "" }, technical_awarded: 9 })]);
  const lines = signalLines([ds]);
  const get = (text: string) => lines.find((l) => l.signal.startsWith(text))!;
  assert.equal(get("50% or more of the Direct").exam, "1"); // 7 of 14 = exactly half
  assert.equal(get("50% or more of the Indirect").exam, "0");
  assert.equal(get("Volume below 60%").exam, "1"); // 11 / 22 = 50%
  assert.equal(get("Accuracy below 60%").exam, "0"); // 9 / 11 = 82%
});

test("Signals: one general RTFQ line, no by-type lines and no combined Buried Treasure line", () => {
  const miss = { dimensions: [{ dimension: "shape" as const, required: "x", delivered: "no" as const, note: "" }], evidence: "" };
  const mk = (code: string) => req({ code, label: code, rtfq: miss });
  const lines = signalLines([dataset(1, [mk("P1Q1_a"), mk("P1Q1_d"), mk("P1Q2_g1")])]);
  assert.equal(lines.filter((l) => l.tool === "RTFQ").length, 1);
  assert.ok(!lines.some((l) => l.signal.includes("Specifically") || l.signal.startsWith("Either")));
});

test("Overall Report: warnings, the signals table and the glossary are present", () => {
  const md = buildOverallReport([dataset(1, [req(), req({ code: "P1Q1_b", label: "Q1(b)", attempted: false, total_marks: 11, technical_awarded: 0, pvaa_awarded: 0, bmcr: { student_known: 6, available: 11 } })])]);
  assert.ok(md.includes("**Warning: Questions not attempted or not finished**"));
  assert.ok(md.includes("Q1(b) not attempted (11 marks, of which you believed 6 were within reach)."));
  assert.ok(md.includes("## What do the Signals and Tools mean?"));
  assert.ok(md.includes("| Questions attempted |"));
  assert.equal(groupByPart(dataset(1, [req()])).length, 1);
});

// ---- Candidate 802 (June 2026): the Overall Report must reproduce the figures Yvonne signed off on 15 Oct 2026 ----
import fixture from "./candidate-802.fixture.json";

test("Candidate 802: Overall Report Step 1 and Step 2 match the signed-off figures", () => {
  const byPaper = new Map<number, RequirementEvaluation[]>();
  for (const f of fixture as { paper: number; code: string; label: string; total: number; technical: number; pvaa: number; known: number; type: string; attempted: boolean }[]) {
    const r = req({
      code: f.code, label: f.label, attempted: f.attempted, total_marks: f.total, technical_awarded: f.technical, pvaa_awarded: f.pvaa,
      bmcr: { student_known: f.known, available: f.total },
      question_type: f.type === "calculation" ? "Non-discussion" : "Discussion", discussion_basis: f.type === "calculation" ? null : (f.type as "compliance" | "non_compliance"),
      buried_treasure: null, volume: null, rtfq: null, communication: null,
    });
    byPaper.set(f.paper, [...(byPaper.get(f.paper) ?? []), r]);
  }
  const md = buildOverallReport([...byPaper.entries()].map(([p, rs]) => dataset(p, rs)));
  const s1 = md.slice(md.indexOf("## Step 1"), md.indexOf("## Step 2"));
  assert.ok(s1.includes("| Part I | 66 | 19 | 29% | 38 | 58% | 50% | Enough theory, not converting |"));
  assert.ok(s1.includes("| Part II | 54 | 37 | 69% | 48 | 89% | 77% | Enough theory, converting |"));
  assert.ok(s1.includes("| **Total** | **120** | **56** | **47%** | **86** | **72%** | **65%** | **Enough theory, not converting** |"));
  assert.ok(s1.includes("| Part II | 50 | 11 | 22% | 23 | 46% | 48% | Not enough theory, not converting |"));
  assert.ok(s1.includes("| **The exam (three papers)** | **360** | **143.5** | **40%** | **227.5** | **63%** | **63%** | **Enough theory, not converting** |"));
  const s2 = md.slice(md.indexOf("## Step 2"), md.indexOf("## Step 3"));
  for (const figure of ["26 of 39 (67%)", "10 of 47 (21%)", "13 of 42 (31%)", "49 of 128 (38%)", "26.5 of 79 (34%)", "57 of 135 (42%)", "43 of 70 (61%)", "39 of 67 (58%)", "11 of 18 (61%)"]) assert.ok(s2.includes(figure), figure);
  for (const risk of ["17.5 of 57 (31%) High Risk", "18 of 78 (23%) High Risk", "5 of 23 (22%) High Risk", "10 of 47 (21%) High Risk"]) assert.ok(s2.includes(risk), risk);
  assert.ok(!/43 of 70 \(61%\) High Risk/.test(s2));
});
