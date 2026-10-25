import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  COACH_REPORT_SQL,
  canReleaseEvaluatorReport,
  coachReportStoragePath,
  isCoachReportPdf,
  isMissingCoachReportColumn,
  releasedReportForAttempt,
} from "./coach-report";

test("a coach PDF can be released without waiting for the system report", () => {
  assert.equal(canReleaseEvaluatorReport({ systemReady: false, coachReportUrl: "https://x/report.pdf" }), true);
  assert.equal(canReleaseEvaluatorReport({ systemReady: true, coachReportUrl: null }), true);
  assert.equal(canReleaseEvaluatorReport({ systemReady: false, coachReportUrl: "" }), false);
});

test("the released report prefers the uploaded PDF over the system HTML", () => {
  const pdf = releasedReportForAttempt({
    attemptId: "a1",
    coachReportUrl: "https://x/keagan.pdf",
    coachReportName: "Keagan Jun26.pdf",
    released: true,
    staff: false,
    systemReady: true,
  });
  assert.deepEqual(pdf, { url: "https://x/keagan.pdf", kind: "pdf", name: "Keagan Jun26.pdf" });
  assert.equal(
    releasedReportForAttempt({
      attemptId: "a1",
      coachReportUrl: null,
      released: true,
      staff: false,
      systemReady: true,
    })?.url,
    "/evaluator-report/a1"
  );
  assert.equal(
    releasedReportForAttempt({
      attemptId: "a1",
      coachReportUrl: "https://x/keagan.pdf",
      released: false,
      staff: false,
      systemReady: true,
    }),
    null
  );
});

test("coach PDF upload is on the Script Evaluator reports page and the review route", () => {
  const page = readFileSync(resolve("app/coach/evaluator/page.tsx"), "utf8");
  const route = readFileSync(resolve("app/api/evaluator/review/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/exam-attempt-coach-report.sql"), "utf8");
  const student = readFileSync(resolve("components/student/ExamAttemptSubmitted.tsx"), "utf8");
  const status = readFileSync(resolve("app/api/exam-attempts/[id]/evaluator-status/route.ts"), "utf8");
  assert.match(page, /Upload report PDF/);
  assert.match(page, /upload_report/);
  assert.match(route, /upload_report/);
  assert.match(route, /coach_report_url/);
  assert.match(sql, /coach_report_url/);
  assert.match(student, /report_kind === "pdf"/);
  assert.match(status, /releasedReportForAttempt/);
  assert.match(COACH_REPORT_SQL, /exam-attempt-coach-report.sql/);
  assert.equal(isCoachReportPdf({ type: "application/pdf", name: "x.pdf", size: 12 }), true);
  assert.equal(isCoachReportPdf({ type: "image/png", name: "x.png", size: 12 }), false);
  assert.match(coachReportStoragePath({ userId: "u1", attemptId: "a1", fileName: "Keagan Jun26.pdf" }), /coach-report/);
  assert.equal(isMissingCoachReportColumn("Could not find the 'coach_report_url' column"), true);
});
