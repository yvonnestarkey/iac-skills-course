import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attemptStatusLabel,
  deriveAttemptStatus,
  examAttemptFromRow,
  type ExamAttempt,
} from "./exam-attempts";

function attempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return examAttemptFromRow({
    id: "a1",
    user_id: "u1",
    sitting_id: "jan-2026",
    paper_id: "jan-2026-p1",
    sitting_label: "January 2026",
    paper_title: "Paper 1 – Mzansi Trendz",
    status: "started",
    ...overrides,
  });
}

test("status stays independent per attempt and does not jump to report ready", () => {
  assert.equal(deriveAttemptStatus(attempt()), "started");
  assert.equal(deriveAttemptStatus(attempt({ bmcr_worksheet_url: "https://x/a.pdf" })), "awaiting_documents");
  assert.equal(
    deriveAttemptStatus(
      attempt({
        bmcr_worksheet_url: "https://x/a.pdf",
        marked_script_url: "https://x/b.pdf",
        marking_report_url: "https://x/c.pdf",
      })
    ),
    "ready_to_submit"
  );
  assert.equal(deriveAttemptStatus(attempt({ status: "analysing" })), "analysing");
  assert.equal(attemptStatusLabel("evidence_ready"), "Documents uploaded");
});
