import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PAST_PAPER_SITTING_ID, findPastPaperSitting } from "./past-papers";
import {
  COMPETENCY_DOCUMENT_STEMS,
  evaluatorNewAttemptPapers,
  officialSourcePackComplete,
  officialSourceSpec,
  officialSourcesBlockEvidenceReady,
} from "./exam-source-pack";

const JANUARY_2026_P1 = {
  question: ["iac-january-2026-paper-1-question-mzansi", "iac january 2026 paper 1 question mzansi"],
  solution: [
    "iac-january-2026-paper-1-part-i-solution-mzansi",
    "iac-january-2026-paper-1-part-ii-solution-mzansi",
    "iac january 2026 paper 1 part i solution mzansi",
    "iac january 2026 paper 1 part ii solution mzansi",
  ],
  commentary: ["iac-january-2026-markers-and-umpires-comments", "iac january 2026 markers and umpires comments"],
};

test("January 2026 official source mapping is unchanged", () => {
  const p1 = officialSourceSpec("jan-2026", "jan-2026-p1");
  const p2 = officialSourceSpec("jan-2026", "jan-2026-p2");
  const p3 = officialSourceSpec("jan-2026", "jan-2026-p3");
  assert.ok(p1 && p2 && p3);
  assert.deepEqual(p1?.question, JANUARY_2026_P1.question);
  assert.deepEqual(p1?.solution, JANUARY_2026_P1.solution);
  assert.deepEqual(p1?.commentary, JANUARY_2026_P1.commentary);
  assert.ok(p2?.question.some((stem) => /paper-2-question-lexi/.test(stem)));
  assert.ok(p3?.question.some((stem) => /paper-3-question-ir/.test(stem)));
  assert.deepEqual(p1?.competency, COMPETENCY_DOCUMENT_STEMS);
  assert.equal(officialSourceSpec("jan-2026", "iac-2026-p1"), null);
});

test("January 2026 Paper 1 maps to Mzansi question, solutions, and sitting commentary", () => {
  const spec = officialSourceSpec("jan-2026", "jan-2026-p1");
  assert.ok(spec);
  assert.ok(spec?.question.some((stem) => /paper-1-question-mzansi/.test(stem)));
  assert.ok(spec?.solution.some((stem) => /part-i-solution-mzansi/.test(stem)));
  assert.ok(spec?.solution.some((stem) => /part-ii-solution-mzansi/.test(stem)));
  assert.ok(spec?.commentary.some((stem) => /january-2026-markers-and-umpires/.test(stem)));
  assert.ok(spec?.competency.includes("iac-competency-map"));
});

test("June 2026 papers resolve existing Inpahla, Med4Me, and Beita question and solution sources", () => {
  const papers = [
    ["iac-2026-p1", /paper-1-question-inpahla/, /part-i-solution-inpahla/, /part-ii-solution-inpahla/],
    ["iac-2026-p2", /paper-2-question-med4me/, /part-i-solution-med4me/, /part-ii-solution-med4me/],
    ["iac-2026-p3", /paper-3-question-beita/, /part-i-solution-beita/, /part-ii-solution-beita/],
  ] as const;

  for (const [paperId, question, partI, partII] of papers) {
    const spec = officialSourceSpec("june-2026", paperId);
    assert.ok(spec, paperId);
    assert.ok(spec?.question.some((stem) => question.test(stem)), paperId);
    assert.ok(spec?.solution.some((stem) => partI.test(stem)), paperId);
    assert.ok(spec?.solution.some((stem) => partII.test(stem)), paperId);
    assert.deepEqual(spec?.commentary, []);
    assert.ok(spec?.competency.includes("iac-competency-map"));
    assert.deepEqual(spec?.competency, COMPETENCY_DOCUMENT_STEMS);
  }
});

test("June missing examiner commentary does not prevent evidence readiness", () => {
  assert.equal(officialSourcePackComplete(["commentary"]), true);
  assert.equal(officialSourcesBlockEvidenceReady(["commentary"]), false);
  assert.equal(officialSourcePackComplete([]), true);
  assert.equal(officialSourcePackComplete(["commentary", "competency"]), false);
});

test("missing question or solution still blocks evidence readiness", () => {
  assert.equal(officialSourcesBlockEvidenceReady(["question"]), true);
  assert.equal(officialSourcesBlockEvidenceReady(["solution"]), true);
  assert.equal(officialSourcePackComplete(["question"]), false);
  assert.equal(officialSourcePackComplete(["solution"]), false);
  assert.equal(officialSourcesBlockEvidenceReady([]), false);
  assert.equal(officialSourcesBlockEvidenceReady(["competency"]), false);
});

test("unmapped sittings do not invent an official pack", () => {
  assert.equal(officialSourceSpec("june-2025", "june-2025-p1"), null);
});

test("staff new-attempt UI defaults to June 2026 and can select all three mapped papers", () => {
  assert.equal(DEFAULT_PAST_PAPER_SITTING_ID, "june-2026");
  const sitting = findPastPaperSitting(DEFAULT_PAST_PAPER_SITTING_ID);
  assert.equal(sitting?.id, "june-2026");
  const papers = evaluatorNewAttemptPapers("june-2026");
  assert.deepEqual(
    papers.map((paper) => paper.id),
    ["iac-2026-p1", "iac-2026-p2", "iac-2026-p3"]
  );
  assert.ok(papers.every((paper) => paper.officialMapped));
  assert.ok(papers.every((paper) => !paper.commentaryMapped));
  assert.match(papers[0]?.title || "", /Inpahla/);
  assert.match(papers[1]?.title || "", /Med4Me/);
  assert.match(papers[2]?.title || "", /Beita/);

  const january = evaluatorNewAttemptPapers("jan-2026");
  assert.deepEqual(
    january.map((paper) => paper.id),
    ["jan-2026-p1", "jan-2026-p2", "jan-2026-p3"]
  );
  assert.ok(january.every((paper) => paper.officialMapped && paper.commentaryMapped));
});
