import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIRST_BMCR_WORKSHEET_PAPER_ID,
  FIRST_BMCR_WORKSHEET_SITTING_ID,
  bmcrPrintPagePlan,
  bmcrPrintPaperLine,
  bmcrPrintQuestionLabel,
  bmcrPrintSheetTitle,
  bmcrPrintUsableHeightMm,
  bmcrWorksheetForSitting,
  evaluatorContinueHref,
  resolveBmcrSittingId,
  worksheetHref,
} from "./bmcr-worksheet";

test("January 2026 BMCR is one sitting worksheet with all three papers and registry totalMarks", () => {
  const worksheet = bmcrWorksheetForSitting(FIRST_BMCR_WORKSHEET_SITTING_ID);
  assert.ok(worksheet);
  assert.equal(worksheet?.sittingId, "jan-2026");
  assert.equal(worksheet?.title, "January 2026 IAC — Basic Marks Conversion Rate");
  assert.equal(worksheet?.papers.length, 3);
  assert.equal(worksheet?.papers[0]?.paperId, "jan-2026-p1");
  assert.equal(worksheet?.papers[0]?.paperTotalMarks, 120);
  assert.equal(worksheet?.papers[0]?.rows.length, 8);
  assert.equal(worksheet?.papers[0]?.rows[0]?.code, "P1Q1_a");
  assert.equal(worksheet?.papers[0]?.rows[0]?.totalMarks, 16);
  assert.equal(
    worksheet?.papers[0]?.rows.reduce((sum, row) => sum + row.totalMarks, 0),
    120
  );
  assert.equal(worksheet?.papers[1]?.paperId, "jan-2026-p2");
  assert.equal(worksheet?.papers[2]?.paperId, "jan-2026-p3");
  assert.match(worksheet?.marksSource || "", /iac-jan-2026\.json/);
  assert.ok(!/available/i.test(worksheet?.marksSource || ""));
});

test("a paper id still opens the sitting-level worksheet", () => {
  assert.equal(resolveBmcrSittingId(FIRST_BMCR_WORKSHEET_PAPER_ID), "jan-2026");
  assert.equal(worksheetHref(FIRST_BMCR_WORKSHEET_PAPER_ID), "/student/evaluator/worksheet/jan-2026");
  assert.equal(bmcrWorksheetForSitting(FIRST_BMCR_WORKSHEET_PAPER_ID)?.sittingId, "jan-2026");
});

test("Close BMCR returns to the evaluator from path and keeps the sitting", () => {
  assert.equal(
    worksheetHref("jan-2026", "/student/evaluator/new?sitting=jan-2026"),
    "/student/evaluator/worksheet/jan-2026?from=%2Fstudent%2Fevaluator%2Fnew%3Fsitting%3Djan-2026"
  );
  assert.equal(
    evaluatorContinueHref("/student/evaluator/new?sitting=jan-2026", "jan-2026"),
    "/student/evaluator/new?sitting=jan-2026"
  );
  assert.equal(
    evaluatorContinueHref("/student/evaluator/attempt/abc", "jan-2026"),
    "/student/evaluator/attempt/abc"
  );
  assert.equal(evaluatorContinueHref("https://example.com", "jan-2026"), "/student/evaluator/new?sitting=jan-2026");
  assert.equal(evaluatorContinueHref("", "jan-2026"), "/student/evaluator/new?sitting=jan-2026");
});

test("June 2026 print labels stay short without changing official required wording or marks", () => {
  const worksheet = bmcrWorksheetForSitting("june-2026");
  assert.ok(worksheet);
  assert.equal(worksheet?.sittingId, "june-2026");
  assert.equal(worksheet?.papers.length, 3);
  const p1 = worksheet?.papers[0];
  assert.equal(p1?.paperId, "iac-2026-p1");
  assert.equal(p1?.rows[0]?.code, "P1Q1_a");
  assert.equal(
    p1?.rows[0]?.title,
    "Prepare a SWOT analysis in view of the going concern challenges experienced by Inpahla"
  );
  assert.equal(p1?.rows[0]?.totalMarks, 22);
  assert.equal(bmcrPrintQuestionLabel("P1Q1_a", p1?.rows[0]?.title || "", "june-2026"), "SWOT / going concern");
  assert.equal(bmcrPrintQuestionLabel("P1Q1_b", p1?.rows[1]?.title || "", "june-2026"), "Turnaround financing proposals");
  assert.equal(bmcrPrintQuestionLabel("P1Q1_c", p1?.rows[2]?.title || "", "june-2026"), "Zug AG capital budget");
  assert.equal(bmcrPrintSheetTitle(worksheet?.sittingLabel || ""), "June 2026 IAC — BMCR Worksheet");
  assert.equal(bmcrPrintPaperLine(p1!), "Paper 1 — Inpahla SOC Ltd · 120 marks");
  assert.equal(bmcrPrintPaperLine(worksheet!.papers[1]!), "Paper 2 — Med4Me Group · 120 marks");
  assert.equal(bmcrPrintPaperLine(worksheet!.papers[2]!), "Paper 3 — Beita Furniture · 120 marks");
  for (const paper of worksheet!.papers) {
    assert.equal(
      paper.rows.reduce((sum, row) => sum + row.totalMarks, 0),
      paper.paperTotalMarks
    );
    for (const row of paper.rows) {
      const label = bmcrPrintQuestionLabel(row.code, row.title, "june-2026");
      assert.notEqual(label, row.title);
      assert.ok(label.length < row.title.length);
      assert.ok(!/direct|indirect|thinking/i.test(label));
    }
  }
  assert.match(worksheet?.marksSource || "", /iac-june-2026\.json/);
});

test("January print labels do not reuse June 2026 short names", () => {
  const worksheet = bmcrWorksheetForSitting("jan-2026");
  const title = worksheet?.papers[0]?.rows[0]?.title || "";
  assert.match(title, /inventory-account/i);
  const label = bmcrPrintQuestionLabel("P1Q1_a", title, "jan-2026");
  assert.notEqual(label, "SWOT / going concern");
  assert.match(label, /inventory/i);
});

test("June 2026 BMCR prints as three A4 pages with no overflow", () => {
  const worksheet = bmcrWorksheetForSitting("june-2026");
  assert.ok(worksheet);
  const plan = bmcrPrintPagePlan(worksheet!);
  assert.equal(plan.pageCount, 3);
  assert.deepEqual(
    plan.pages.map((page) => page.paperId),
    ["iac-2026-p1", "iac-2026-p2", "iac-2026-p3"]
  );
  assert.deepEqual(
    plan.pages.map((page) => page.page),
    [1, 2, 3]
  );
  const usable = bmcrPrintUsableHeightMm();
  for (const page of plan.pages) {
    assert.equal(page.overflowMm, 0, `${page.paperId} overflow ${page.overflowMm}mm`);
    assert.ok(page.heightMm <= usable, `${page.paperId} ${page.heightMm}mm > ${usable}mm`);
  }
  assert.ok(plan.pages[0]!.heightMm > plan.pages[1]!.heightMm);
});
