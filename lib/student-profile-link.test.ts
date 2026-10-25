import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { canLinkStudentProfile, studentProfilePath } from "./student-profile-link";

test("student names on coach lists open the profile in a new tab", () => {
  assert.equal(studentProfilePath("af3d12e6-c21f-4593-9a7e-111111111111"), "/coach/students/af3d12e6-c21f-4593-9a7e-111111111111");
  assert.equal(canLinkStudentProfile(""), false);
  const link = readFileSync(resolve("components/coach/StudentProfileLink.tsx"), "utf8");
  assert.match(link, /target="_blank"/);
  assert.match(link, /studentProfilePath/);
  const pages = [
    "app/coach/evaluator/page.tsx",
    "components/coach/AssignmentsTab.tsx",
    "components/coach/SurveysTab.tsx",
    "components/coach/SurveyResultsView.tsx",
    "components/coach/RosterTab.tsx",
    "components/coach/RevenueReportPage.tsx",
    "components/coach/CoachReferralsPage.tsx",
    "components/coach/SubmissionReview.tsx",
    "components/coach/CoachInbox.tsx",
  ];
  for (const file of pages) {
    assert.match(readFileSync(resolve(file), "utf8"), /StudentProfileLink/, file);
  }
});
