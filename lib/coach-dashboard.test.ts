import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { addDays, isoDate, sastDateAndTimeToIso, today } from "./dates";
import {
  awaitingEvaluatorReportCount,
  COACH_DASHBOARD_GROUPS,
  coachDashboardGreeting,
  coachDashboardTools,
  coachMarkingItems,
  coachStudentCounts,
  coachWatchStudents,
  heardFromCoachWithinDays,
  isDisengagedStudent,
  isQuietStudent,
  markingHref,
  mergeLastHeardByStudent,
} from "./coach-dashboard";
import type { SurveySubmissionRow } from "./custom-surveys";
import type { Student } from "./types";

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

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: "s1",
    name: "Amina",
    email: "amina@test.com",
    cohort: "jan27",
    status: "active",
    lastActive: isoDate(addDays(today(), -1)),
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

test("submitted script evaluations without a released report are waiting", () => {
  assert.equal(
    awaitingEvaluatorReportCount([
      { status: "report_ready", evaluator_report_released_at: null },
      { status: "report_ready", evaluator_report_released_at: "2026-11-10T08:00:00.000Z" },
      { status: "started", evaluator_report_released_at: null },
      { status: "analysing", source: "staff_test", evaluator_report_released_at: null },
      { status: "evidence_ready", evaluator_report_released_at: null },
    ]),
    2
  );
});

test("disengaged students have not been in for a week; quiet students have", () => {
  const stale = student({
    id: "stale",
    name: "Sipho",
    email: "sipho@test.com",
    lastActive: isoDate(addDays(today(), -8)),
  });
  const never = student({ id: "never", name: "Naledi", email: "naledi@test.com", lastActive: undefined });
  const recent = student({ id: "recent", name: "Lebo", email: "lebo@test.com", lastActive: isoDate(addDays(today(), -1)) });
  const paused = student({
    id: "paused",
    name: "Paused",
    email: "paused@test.com",
    status: "paused",
    lastActive: isoDate(addDays(today(), -20)),
  });
  assert.equal(isDisengagedStudent(stale), true);
  assert.equal(isDisengagedStudent(never), true);
  assert.equal(isDisengagedStudent(recent), false);
  assert.equal(isDisengagedStudent(paused), false);

  const now = new Date("2026-11-12T10:00:00.000Z");
  const oldNote = "2026-11-01T08:00:00.000Z";
  const freshNote = "2026-11-11T08:00:00.000Z";
  assert.equal(heardFromCoachWithinDays(freshNote, 7, now), true);
  assert.equal(heardFromCoachWithinDays(oldNote, 7, now), false);
  assert.equal(isQuietStudent(recent, oldNote, now), true);
  assert.equal(isQuietStudent(recent, freshNote, now), false);
  assert.equal(isQuietStudent(stale, oldNote, now), false);

  const heard = mergeLastHeardByStudent(
    [recent, stale],
    [
      { studentId: recent.id, at: oldNote },
      { studentEmail: "lebo@test.com", at: freshNote },
    ]
  );
  assert.equal(heard[recent.id], freshNote);
  assert.deepEqual(
    coachWatchStudents([stale, never, recent, paused], "disengaged").map((item) => item.id),
    ["never", "stale"]
  );
  assert.equal(coachWatchStudents([recent], "quiet", { [recent.id]: oldNote }, now)[0]?.id, "recent");
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
  const reminders = readFileSync(resolve("components/coach/CoachReminders.tsx"), "utf8");
  assert.match(home, /CoachHomeDashboard/);
  assert.match(dash, /Paid students/);
  assert.match(dash, /Free students/);
  assert.match(dash, /Awaiting reports/);
  assert.match(dash, /Disengaged/);
  assert.match(dash, /Quiet/);
  assert.doesNotMatch(dash, /Assignments to mark/);
  assert.match(dash, /Send a group message/);
  assert.match(dash, /CoachReminders/);
  assert.match(dash, /CoachJournalNeeds/);
  assert.match(reminders, /Type a student name/);
  assert.match(reminders, /In a week/);
  assert.match(dash, /router\.push\(item\.href\)/);
  assert.match(dash, /coach-dash-grid/);
});
