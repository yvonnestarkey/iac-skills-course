import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { sastDateAndTimeToIso } from "./dates";
import {
  COACH_DASHBOARD_GROUPS,
  coachDashboardGreeting,
  coachDashboardTools,
  coachMarkingItems,
  coachStudentCounts,
  markingHref,
} from "./coach-dashboard";
import type { SurveySubmissionRow } from "./custom-surveys";

function row(overrides: Partial<SurveySubmissionRow> = {}): SurveySubmissionRow {
  return {
    id: "sub-1",
    surveyId: "task-1",
    studentId: "stu-1",
    studentName: "Amina",
    studentEmail: "amina@test.com",
    answers: {},
    status: "submitted",
    grade: null,
    feedback: "",
    feedbackFileUrl: "",
    gradedBy: "",
    gradedByName: "",
    gradedAt: "",
    createdAt: "2026-11-10T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
    surveyTitle: "Task 1",
    isAssignment: true,
    requiresGrade: true,
    ...overrides,
  };
}

test("paid and free counts skip deregistered students", () => {
  assert.deepEqual(
    coachStudentCounts([
      { courseAccess: "full" },
      { courseAccess: "full" },
      { courseAccess: "free_preview" },
      { courseAccess: "full", accessActive: false },
      { courseAccess: "free_preview", accessActive: false },
    ]),
    { paid: 2, free: 1, deregistered: 2 }
  );
});

test("the marking queue keeps submitted assignments and links to the review page", () => {
  const items = coachMarkingItems([
    row({ id: "old", createdAt: "2026-11-01T08:00:00.000Z", href: "/coach/submissions/lesson/abc" }),
    row({ id: "survey", isAssignment: false, surveyTitle: "Check-in" }),
    row({ id: "graded", status: "graded", surveyTitle: "Done" }),
    row({ id: "fresh", createdAt: "2026-11-11T08:00:00.000Z", studentName: "Lebo", surveyTitle: "Grassroots" }),
  ]);
  assert.deepEqual(
    items.map((item) => item.id),
    ["fresh", "old"]
  );
  assert.equal(items[0].href, "/coach/submissions/fresh");
  assert.equal(items[1].href, "/coach/submissions/lesson/abc");
  assert.equal(markingHref({ id: "survey-9" }), "/coach/submissions/survey-9");
});

test("SAST morning, afternoon, and evening greetings stay locked to Johannesburg", () => {
  assert.equal(coachDashboardGreeting(new Date(sastDateAndTimeToIso("2026-11-12", "08:30") || "")), "Good morning");
  assert.equal(coachDashboardGreeting(new Date(sastDateAndTimeToIso("2026-11-12", "14:00") || "")), "Good afternoon");
  assert.equal(coachDashboardGreeting(new Date(sastDateAndTimeToIso("2026-11-12", "19:10") || "")), "Good evening");
});

test("coach tools sit in three columns and keep the previous destinations", () => {
  assert.equal(COACH_DASHBOARD_GROUPS.length, 3);
  const hrefs = coachDashboardTools().map((item) => item.href).join(" ");
  assert.match(hrefs, /\/coach\/lists/);
  assert.match(hrefs, /\/coach\/drips/);
  assert.match(hrefs, /\/coach\/dashboard-posts/);
  assert.match(hrefs, /\/coach\/referrals/);
  assert.match(hrefs, /\/coach\/evaluator/);
  assert.equal(coachDashboardTools().some((item) => item.href === "/coach/waitlist"), false);

  const home = readFileSync(resolve("app/coach/page.tsx"), "utf8");
  const dash = readFileSync(resolve("components/coach/CoachHomeDashboard.tsx"), "utf8");
  assert.match(home, /CoachHomeDashboard/);
  assert.match(dash, /Paid students/);
  assert.match(dash, /Free students/);
  assert.match(dash, /Assignments to mark/);
  assert.match(dash, /router\.push\(item\.href\)/);
  assert.match(dash, /coach-dash-grid/);
});
