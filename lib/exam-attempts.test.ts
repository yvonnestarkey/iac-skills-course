import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  attemptPaperName,
  attemptStatusLabel,
  attemptStudentLabel,
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
    "awaiting_documents"
  );
  assert.equal(
    deriveAttemptStatus(
      attempt({
        bmcr_worksheet_url: "https://x/a.pdf",
        marked_script_url: "https://x/p1.pdf",
        marked_script_p2_url: "https://x/p2.pdf",
        marked_script_p3_url: "https://x/p3.pdf",
        marking_report_url: "https://x/c.pdf",
      })
    ),
    "ready_to_submit"
  );
  assert.equal(deriveAttemptStatus(attempt({ status: "analysing" })), "analysing");
  assert.equal(attemptStatusLabel("evidence_ready"), "Documents uploaded");
});

test("attempt paper name is sitting plus paper for the evaluation route", () => {
  assert.equal(attemptPaperName(attempt()), "January 2026 Paper 1 – Mzansi Trendz");
});

test("staff test attempts are labelled separately from student attempts", () => {
  assert.equal(attempt({}).source, "student");
  assert.equal(examAttemptFromRow({ ...attempt(), source: "staff_test" }).source, "staff_test");
});

test("attempt student labels come from the existing profile name, not a copied field", () => {
  assert.equal(
    attemptStudentLabel(attempt({ user_id: "72755d08-e52c-4387-b910-794672fd924b" }), {
      full_name: "Amina Patel",
      email: "amina@example.com",
    }).name,
    "Amina Patel"
  );
  assert.equal(
    attemptStudentLabel(attempt(), { full_name: null, email: "amina.patel@example.com" }).name,
    "Amina Patel"
  );
  assert.equal(attemptStudentLabel(attempt({ source: "staff_test" })).name, "Staff test");
  assert.equal(attemptStudentLabel(attempt()).name, "Unknown student");
});

test("students upload Paper 1, Paper 2 and Paper 3 on one sitting attempt", () => {
  const workspace = readFileSync(resolve("components/student/ExamAttemptWorkspace.tsx"), "utf8");
  const start = readFileSync(resolve("components/student/ExamAttemptNew.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/exam-attempt-script-papers.sql"), "utf8");
  assert.match(workspace, /Paper 1/);
  assert.match(workspace, /Paper 2/);
  assert.match(workspace, /Paper 3/);
  assert.match(workspace, /eval-file-input/);
  assert.doesNotMatch(workspace, /No file chosen/);
  assert.doesNotMatch(start, /Which paper/);
  assert.match(sql, /marked_script_p2/);
  assert.match(sql, /marked_script_p3/);
});
