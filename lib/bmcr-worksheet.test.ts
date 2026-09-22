import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIRST_BMCR_WORKSHEET_PAPER_ID,
  FIRST_BMCR_WORKSHEET_SITTING_ID,
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
