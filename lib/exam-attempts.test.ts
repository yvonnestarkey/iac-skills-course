import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EXAM_SCRIPT_ALREADY_UPLOADED,
  EXAM_SCRIPT_ONCE_WARNING,
  EXAM_SCRIPT_SCAN_NOTE,
  attemptHasAllRequiredFiles,
  attemptHasAnyUploadedFile,
  attemptMarkingReportPages,
  attemptPaperName,
  attemptScriptSlotLocked,
  attemptStatusLabel,
  attemptStudentLabel,
  attemptProfileFiles,
  attemptUploadedFiles,
  deriveAttemptStatus,
  examAttemptFileStoragePath,
  examAttemptFromRow,
  isExamAttemptFileKind,
  isExamAttemptOwnedStoragePath,
  type ExamAttempt,
} from "./exam-attempts";
import { STUDENT_ATTEMPT_SOURCE } from "./staff-access";

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

test("coach profile lists only the PDFs the student uploaded on an attempt", () => {
  const files = attemptUploadedFiles(
    attempt({
      marked_script_url: "https://x/p1.pdf",
      marked_script_name: "paper-1.pdf",
      marked_script_p2_url: "https://x/p2.pdf",
      marking_report_url: "https://x/report.pdf",
      marking_report_name: "marks.pdf",
    })
  );
  assert.deepEqual(
    files.map((file) => [file.kind, file.label, file.url, file.name]),
    [
      ["marked_script", "Paper 1", "https://x/p1.pdf", "paper-1.pdf"],
      ["marked_script_p2", "Paper 2", "https://x/p2.pdf", "Paper 2.pdf"],
      ["marking_report", "Marking report 1", "https://x/report.pdf", "marks.pdf"],
    ]
  );
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/ScriptEvaluationsPanel.tsx"), "utf8");
  assert.match(profile, /ScriptEvaluationsPanel/);
  assert.match(panel, /Script Evaluations/);
  assert.match(panel, /Download \{file\.label\}/);
  assert.match(panel, /attemptProfileFiles/);
  assert.match(panel, /fetchOwnExamAttempts/);
});

test("a manual script evaluation PDF sits at the top of the profile document list", () => {
  const files = attemptProfileFiles(
    attempt({
      coach_report_url: "https://x/kyle-report.pdf",
      coach_report_name: "kyle-June 2026 IAC Script Report.pdf",
      marked_script_url: "https://x/p1.pdf",
      marking_report_url: "https://x/marks.pdf",
    })
  );
  assert.equal(files[0]?.kind, "coach_report");
  assert.equal(files[0]?.label, "Script evaluation report");
  assert.equal(files[0]?.name, "kyle-June 2026 IAC Script Report.pdf");
  assert.equal(files[1]?.kind, "marked_script");
  assert.equal(attemptProfileFiles(attempt({ marked_script_url: "https://x/p1.pdf" }))[0]?.kind, "marked_script");
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
  assert.match(workspace, /marking_report_2/);
  assert.match(workspace, /Zimbabwe students have/);
  assert.match(workspace, /eval-file-input/);
  assert.doesNotMatch(workspace, /No file chosen/);
  assert.doesNotMatch(start, /Which paper/);
  assert.match(sql, /marked_script_p2/);
  assert.match(sql, /marked_script_p3/);
});

test("a successfully uploaded script cannot be replaced, and the one-shot warning is on the page", () => {
  const locked = attempt({ marked_script_url: "https://x/p1.pdf", marked_script_path: "p1.pdf" });
  assert.equal(attemptScriptSlotLocked(locked, "marked_script"), true);
  assert.equal(attemptScriptSlotLocked(locked, "marked_script_p2"), false);
  assert.equal(attemptScriptSlotLocked(attempt(), "bmcr_worksheet"), false);
  assert.equal(EXAM_SCRIPT_ALREADY_UPLOADED.includes("already uploaded"), true);
  const workspace = readFileSync(resolve("components/student/ExamAttemptWorkspace.tsx"), "utf8");
  const lib = readFileSync(resolve("lib/exam-attempts.ts"), "utf8");
  assert.match(workspace, /EXAM_SCRIPT_SCAN_NOTE/);
  assert.match(workspace, /EXAM_SCRIPT_ONCE_WARNING/);
  assert.match(workspace, /attempt\.sitting_label/);
  assert.doesNotMatch(workspace, /All three papers/);
  assert.match(workspace, /Print the BMCR here if you haven/);
  assert.match(workspace, /eval-secondary[\s\S]*BMCR/);
  assert.doesNotMatch(workspace, /Completed BMCR worksheet/);
  assert.match(workspace, /attemptScriptSlotLocked/);
  assert.match(lib, /This paper is already uploaded/);
  assert.match(EXAM_SCRIPT_SCAN_NOTE, /INCLUDING BLANK PAGES/);
  assert.match(EXAM_SCRIPT_ONCE_WARNING, /cannot resubmit this/);
});

test("coach uploads on behalf of a student land in that student's exam-attempt folder", () => {
  const path = examAttemptFileStoragePath({
    userId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    kind: "marked_script",
    fileName: "Paper 1.pdf",
    stamp: 1,
  });
  assert.match(path, /^exam-attempts\/22222222-2222-4222-8222-222222222222\/33333333-3333-4333-8333-333333333333\/marked_script\//);
  assert.equal(isExamAttemptFileKind("marked_script_p2"), true);
  assert.equal(isExamAttemptFileKind("marking_report_2"), true);
  assert.equal(isExamAttemptFileKind("coach_report"), false);
  assert.equal(STUDENT_ATTEMPT_SOURCE, "student");
  const page = readFileSync(resolve("app/coach/evaluator/page.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/CoachUploadStudentScripts.tsx"), "utf8");
  const route = readFileSync(resolve("app/api/coach/evaluator/student-scripts/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/exam-attempt-marking-report-2.sql"), "utf8");
  assert.match(page, /CoachUploadStudentScripts/);
  assert.match(panel, /Upload a student’s scripts/);
  assert.match(panel, /\/api\/coach\/evaluator\/student-scripts/);
  assert.match(panel, /attemptHasAnyUploadedFile/);
  assert.match(panel, /two marking reports/);
  assert.match(panel, /second mark report/);
  assert.match(route, /STUDENT_ATTEMPT_SOURCE/);
  assert.match(route, /examAttemptFileStoragePath/);
  assert.match(route, /createExamAttempt/);
  assert.match(route, /attemptHasAnyUploadedFile/);
  assert.match(route, /sign-upload/);
  assert.match(route, /createSignedUploadUrl/);
  assert.match(panel, /uploadToSignedUrl/);
  assert.doesNotMatch(panel, /renderPdfPageImages/);
  assert.equal(
    isExamAttemptOwnedStoragePath(path, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "marked_script"),
    true
  );
  assert.equal(
    isExamAttemptOwnedStoragePath(path, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "marking_report"),
    false
  );
  assert.match(sql, /marking_report_2_url/);
});

test("a coach can submit an incomplete sitting and attach two marking reports", () => {
  const partial = attempt({ marked_script_url: "https://x/p1.pdf", marked_script_name: "p1.pdf" });
  assert.equal(attemptHasAnyUploadedFile(partial), true);
  assert.equal(attemptHasAllRequiredFiles(partial), false);
  const bothReports = attempt({
    marking_report_url: "https://x/r1.pdf",
    marking_report_name: "report-1.pdf",
    marking_report_2_url: "https://x/r2.pdf",
    marking_report_2_name: "report-2.pdf",
    page_images: {
      marking_report: [{ page: 1, path: "a", url: "https://x/r1-1.jpg" }],
      marking_report_2: [
        { page: 1, path: "b", url: "https://x/r2-1.jpg" },
        { page: 2, path: "c", url: "https://x/r2-2.jpg" },
      ],
    },
  });
  const pages = attemptMarkingReportPages(bothReports);
  assert.equal(pages.length, 3);
  assert.deepEqual(
    pages.map((page) => page.url),
    ["https://x/r1-1.jpg", "https://x/r2-1.jpg", "https://x/r2-2.jpg"]
  );
  const files = attemptUploadedFiles(bothReports);
  assert.deepEqual(
    files.map((file) => file.kind),
    ["marking_report", "marking_report_2"]
  );
});
