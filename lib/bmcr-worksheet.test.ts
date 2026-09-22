import assert from "node:assert/strict";
import { test } from "node:test";
import { FIRST_BMCR_WORKSHEET_PAPER_ID, bmcrWorksheetForPaper } from "./bmcr-worksheet";

test("January 2026 Paper 1 worksheet uses registry totalMarks", () => {
  const worksheet = bmcrWorksheetForPaper(FIRST_BMCR_WORKSHEET_PAPER_ID);
  assert.ok(worksheet);
  assert.equal(worksheet?.sittingId, "jan-2026");
  assert.equal(worksheet?.paperId, "jan-2026-p1");
  assert.equal(worksheet?.paperTotalMarks, 120);
  assert.equal(worksheet?.rows.length, 8);
  assert.equal(worksheet?.rows[0]?.code, "P1Q1_a");
  assert.equal(worksheet?.rows[0]?.totalMarks, 16);
  assert.equal(worksheet?.rows.reduce((sum, row) => sum + row.totalMarks, 0), 120);
  assert.match(worksheet?.marksSource || "", /iac-jan-2026\.json/);
});
