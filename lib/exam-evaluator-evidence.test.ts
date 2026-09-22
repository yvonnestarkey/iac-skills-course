import assert from "node:assert/strict";
import { test } from "node:test";
import { examAttemptFromRow } from "./exam-attempts";
import { bundleEvaluatorEvidence } from "./exam-evaluator-evidence";

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
  assert.equal(bundle.evidence.marking_report.pages[0].image_url, "https://x/report-1.jpg");
  assert.equal(bundle.evidence.bmcr.stored_kind, "bmcr_worksheet");
  assert.equal(bundle.evidence.exam_script.stored_kind, "marked_script");
});
