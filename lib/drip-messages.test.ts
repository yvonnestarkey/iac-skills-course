import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  dripAppliesToCohort,
  dripFromRow,
  dripIsDue,
  dripScopeLabel,
  dripTriggerLabel,
  emptyDripWrite,
  enrolmentDelayDue,
  fixedDateDue,
  isTaskChapterOption,
  lessonCompletedDue,
  taskCompletedDue,
  validateDripWrite,
  type DripMessage,
  type DripStudentContext,
} from "./drip-messages";

const now = new Date("2026-10-26T10:00:00.000Z");

function rule(overrides: Partial<DripMessage> = {}): DripMessage {
  return {
    id: "drip-1",
    title: "Welcome",
    body: "Glad you joined.",
    trigger: "enrolment_delay",
    delayDays: 14,
    sendOn: null,
    lessonId: null,
    taskId: null,
    scope: "static",
    cohortId: null,
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    createdBy: null,
    deliveryCount: 0,
    ...overrides,
  };
}

function student(overrides: Partial<DripStudentContext> = {}): DripStudentContext {
  return {
    userId: "student-1",
    email: "s1@test.com",
    name: "Student",
    cohort: "jan27",
    enrolledAt: "2026-10-12T08:00:00.000Z",
    completedLessonIds: [],
    taskLessonIds: [],
    ...overrides,
  };
}

test("two weeks after enrolment is due on day 14 and not before", () => {
  assert.equal(enrolmentDelayDue("2026-10-12T08:00:00.000Z", 14, new Date("2026-10-25T10:00:00.000Z")), false);
  assert.equal(enrolmentDelayDue("2026-10-12T08:00:00.000Z", 14, now), true);
  assert.equal(enrolmentDelayDue("2026-10-12T08:00:00.000Z", 0, new Date("2026-10-12T08:00:00.000Z")), true);
});

test("a fixed date sends on that SAST day and later", () => {
  assert.equal(fixedDateDue("2026-10-27", now), false);
  assert.equal(fixedDateDue("2026-10-26", now), true);
  assert.equal(fixedDateDue("2026-10-20", now), true);
});

test("progress drips wait for the chosen lesson or every lesson in the task", () => {
  assert.equal(lessonCompletedDue(["ch1-l1"], "ch1-l2"), false);
  assert.equal(lessonCompletedDue(["ch1-l1", "ch1-l2"], "ch1-l2"), true);
  assert.equal(taskCompletedDue(["t1-l1"], ["t1-l1", "t1-l2"]), false);
  assert.equal(taskCompletedDue(["t1-l1", "t1-l2"], ["t1-l1", "t1-l2"]), true);
  assert.equal(taskCompletedDue(["t1-l1"], []), false);
});

test("static drips apply to every cohort and cohort drips stay on that cohort", () => {
  assert.equal(dripAppliesToCohort({ scope: "static", cohortId: null }, "jun27"), true);
  assert.equal(dripAppliesToCohort({ scope: "cohort", cohortId: "jan27" }, "jan27"), true);
  assert.equal(dripAppliesToCohort({ scope: "cohort", cohortId: "jan27" }, "jun27"), false);
});

test("inactive or wrong-cohort drips are not due", () => {
  assert.equal(dripIsDue(rule({ isActive: false }), student(), now), false);
  assert.equal(
    dripIsDue(rule({ scope: "cohort", cohortId: "jun27" }), student({ cohort: "jan27" }), now),
    false
  );
  assert.equal(dripIsDue(rule({ delayDays: 14 }), student({ enrolledAt: "2026-10-20T08:00:00.000Z" }), now), false);
  assert.equal(
    dripIsDue(
      rule({ trigger: "lesson_completed", lessonId: "ch2-l1", delayDays: null }),
      student({ completedLessonIds: ["ch2-l1"] }),
      now
    ),
    true
  );
});

test("drip writes require the matching trigger target", () => {
  const empty = validateDripWrite(emptyDripWrite());
  assert.equal(empty.ok, false);
  const ok = validateDripWrite({
    ...emptyDripWrite(),
    title: "Two weeks in",
    body: "How is Task 1 going?",
    delayDays: 14,
  });
  assert.equal(ok.ok, true);
  const missingLesson = validateDripWrite({
    ...emptyDripWrite(),
    title: "After the clip",
    body: "Watch the next one.",
    trigger: "lesson_completed",
  });
  assert.equal(missingLesson.ok, false);
});

test("trigger and scope labels stay coach-readable", () => {
  assert.equal(dripTriggerLabel(rule({ delayDays: 0 })), "The day they join");
  assert.equal(dripTriggerLabel(rule({ delayDays: 14 })), "2 weeks after enrolment");
  assert.equal(dripScopeLabel(rule()), "All current and future cohorts");
  assert.equal(dripScopeLabel(rule({ scope: "cohort", cohortId: "jan27" })), "January 2027 only");
  assert.equal(isTaskChapterOption("Task 1 · Buried Treasure"), true);
  assert.equal(isTaskChapterOption("S1 · How marking works"), false);
});

test("database rows map onto drip messages", () => {
  const message = dripFromRow(
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Fixed date",
      body: "Exam week reminder",
      trigger_type: "fixed_date",
      send_on: "2026-12-01",
      scope: "cohort",
      cohort_id: "jan27",
      is_active: true,
    },
    3
  );
  assert.equal(message?.trigger, "fixed_date");
  assert.equal(message?.sendOn, "2026-12-01");
  assert.equal(message?.cohortId, "jan27");
  assert.equal(message?.deliveryCount, 3);
});

test("coach tools expose drip-feed messages and hide waitlist plus evaluator preview", () => {
  const home = readFileSync(resolve("app/coach/page.tsx"), "utf8");
  const waitlist = readFileSync(resolve("app/coach/waitlist/page.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/drip-messages.sql"), "utf8");
  const catchup = readFileSync(resolve("app/api/student/notifications/catch-up/route.ts"), "utf8");
  assert.match(home, /\/coach\/drips/);
  assert.match(home, /Drip-feed messages/);
  assert.doesNotMatch(home, /\/evaluator-preview/);
  assert.doesNotMatch(home, /Evaluator report preview/);
  assert.doesNotMatch(home, /\/coach\/waitlist/);
  assert.match(waitlist, /redirect\("\/coach"\)/);
  assert.match(sql, /create table if not exists public\.drip_messages/);
  assert.match(sql, /create table if not exists public\.drip_deliveries/);
  assert.match(catchup, /claimDueDripMessagesForStudent/);
});
