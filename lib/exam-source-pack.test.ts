import assert from "node:assert/strict";
import { test } from "node:test";
import { officialSourceSpec } from "./exam-source-pack";

test("January 2026 Paper 1 maps to Mzansi question, solutions, and sitting commentary", () => {
  const spec = officialSourceSpec("jan-2026", "jan-2026-p1");
  assert.ok(spec);
  assert.ok(spec?.question.some((stem) => /paper-1-question-mzansi/.test(stem)));
  assert.ok(spec?.solution.some((stem) => /part-i-solution-mzansi/.test(stem)));
  assert.ok(spec?.solution.some((stem) => /part-ii-solution-mzansi/.test(stem)));
  assert.ok(spec?.commentary.some((stem) => /january-2026-markers-and-umpires/.test(stem)));
  assert.ok(spec?.competency.includes("iac-competency-map"));
});

test("unmapped sittings do not invent an official pack", () => {
  assert.equal(officialSourceSpec("june-2025", "june-2025-p1"), null);
});
