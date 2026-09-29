import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { examAttemptFromRow } from "./exam-attempts";
import { bundleEvaluatorEvidence, extractExamAttemptId } from "./exam-evaluator-evidence";

test("evaluator evidence exposes BMCR, script, and marking-report page numbers", () => {
  const attempt = examAttemptFromRow({
    id: "5f64826f-30dd-4b5e-bb49-465c2ac3246c",
    user_id: "u1",
    sitting_id: "jan-2026",
    paper_id: "jan-2026-p1",
    sitting_label: "January 2026",
    paper_title: "Paper 1 – Mzansi Trendz",
    paper_code: "IAC-JAN-2026-P1",
    status: "evidence_ready",
    page_images: {
      bmcr_worksheet: [
        { page: 2, path: "p2", url: "https://x/bmcr-2.jpg" },
        { page: 1, path: "p1", url: "https://x/bmcr-1.jpg" },
      ],
      marked_script: Array.from({ length: 56 }, (_, index) => ({
        page: index + 1,
        path: `s${index + 1}`,
        url: `https://x/script-${index + 1}.jpg`,
      })),
      marking_report: Array.from({ length: 53 }, (_, index) => ({
        page: index + 1,
        path: `r${index + 1}`,
        url: `https://x/report-${index + 1}.jpg`,
      })),
    },
  });

  const bundle = bundleEvaluatorEvidence(attempt);
  assert.equal(bundle.analysed, false);
  assert.equal(bundle.attempt.id, attempt.id);
  assert.equal(bundle.attempt.paper_id, "jan-2026-p1");
  assert.ok(bundle.paper?.requirements.some((item) => item.code === "P1Q1_b"));
  assert.deepEqual(bundle.evidence.bmcr.page_numbers, [1, 2]);
  assert.equal(bundle.evidence.bmcr.page_count, 2);
  assert.equal(bundle.evidence.exam_script.page_count, 56);
  assert.deepEqual(bundle.evidence.exam_script.page_numbers.slice(0, 3), [1, 2, 3]);
  assert.equal(bundle.evidence.exam_script.page_numbers[55], 56);
  assert.equal(bundle.evidence.marking_report.page_count, 53);
  assert.equal(bundle.evidence.marking_report.pages[0].page_url, "https://x/report-1.jpg");
  assert.equal("image_url" in bundle.evidence.marking_report.pages[0], false);
  assert.equal(bundle.evidence.bmcr.stored_kind, "bmcr_worksheet");
  assert.equal(bundle.evidence.exam_script.stored_kind, "marked_script");
});

test("extractExamAttemptId reads ChatGPT action body and query shapes", () => {
  const id = "4aa3b0ed-e7d7-4d7e-ada0-77b9d52a4438";
  assert.equal(extractExamAttemptId({ attempt_id: id }), id);
  assert.equal(extractExamAttemptId({ attemptId: id }), id);
  assert.equal(extractExamAttemptId({ id }), id);
  assert.equal(extractExamAttemptId(`Attempt ${id}`), id);
  assert.equal(extractExamAttemptId(id), id);
  assert.equal(extractExamAttemptId({ attempt_id: { id } }), id);
  assert.equal(extractExamAttemptId(null), "");
});

test("Mindset Sandbox plugin registers getEvaluatorAttemptEvidence as a quoted Supabase RPC", () => {
  const sql = readFileSync(resolve("supabase/evaluator-attempt-evidence-rpc.sql"), "utf8");
  assert.match(sql, /public\."getEvaluatorAttemptEvidence"\(attempt_id text\)/);
  assert.match(sql, /page_url/);
  assert.equal(/image_url/.test(sql), false);
  assert.match(sql, /grant execute on function public\."getEvaluatorAttemptEvidence"\(text\) to anon/);
});

test("Mindset Sandbox plugin registers a tiny getEvaluatorAttemptSummary RPC", () => {
  const sql = readFileSync(resolve("supabase/evaluator-attempt-summary-rpc.sql"), "utf8");
  assert.match(sql, /public\."getEvaluatorAttemptSummary"\(attempt_id text\)/);
  assert.match(sql, /student_name/);
  assert.match(sql, /bmcr_page_count/);
  assert.match(sql, /exam_script_page_count/);
  assert.match(sql, /marking_report_page_count/);
  assert.equal(/page_url/.test(sql), false);
  assert.equal(/image_url/.test(sql), false);
  assert.match(sql, /grant execute on function public\."getEvaluatorAttemptSummary"\(text\) to anon/);
});
