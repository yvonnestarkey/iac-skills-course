import test from "node:test";
import assert from "node:assert/strict";
import { checkLessonAccess } from "./accessControl";
import { AUTO_SEND_WAITLIST_ON_DEPLOY, coachMayUseInviteEndpoints, wouldSendInvitationsOnDeploy } from "./coach-invites";
import { composeLessonAvailability } from "./lesson-availability";
import { isCoachAccount } from "./roles";
import {
  attemptSourceForUser,
  composeStaffAwareLessonAccess,
  isGenuineStudentAttempt,
  staffCanOpenEvaluatorWithoutTask1,
  staffCanOpenEveryLesson,
  staffOverrideApplies,
  staffOverrideCreatesEntitlement,
  staffOverrideCreatesProgression,
  staffOverrideCreatesPurchase,
  STAFF_TEST_ATTEMPT_SOURCE,
} from "./staff-access";
import { studentUserFromAuth } from "./student-lesson";

const coach = studentUserFromAuth({
  id: "coach-1",
  email: "yvonne@accountingstudyadvice.com",
  user_metadata: {},
  app_metadata: { role: "coach" },
});

const student = studentUserFromAuth({
  id: "student-1",
  email: "s1@test.com",
  user_metadata: { role: "coach" },
  app_metadata: {},
});

const catalog = [
  { id: "preview-1", title: "Preview" },
  { id: "task-1", title: "Task 1", requires_submission: true },
  { id: "task-2", title: "Task 2", prereq_lesson_id: "task-1" },
];

test("coach can access every lesson under staff override", () => {
  assert.equal(staffCanOpenEveryLesson(coach, "override"), true);
  const locked = checkLessonAccess(catalog[2], catalog, {}, { completed: {} });
  const opened = composeStaffAwareLessonAccess({
    user: coach,
    view: "override",
    commercialCanRead: false,
    pedagogical: locked,
  });
  assert.equal(opened.canReadBody, true);
  assert.equal(opened.layer, "open");
});

test("coach can access Script Evaluator without student prerequisite submissions", () => {
  assert.equal(staffCanOpenEvaluatorWithoutTask1(coach, "override", false), true);
});

test("normal free student remains limited to preview lessons", () => {
  const locked = checkLessonAccess(catalog[2], catalog, {}, { completed: {} });
  const free = composeStaffAwareLessonAccess({
    user: student,
    view: "override",
    commercialCanRead: false,
    isPreviewLesson: false,
    pedagogical: locked,
  });
  assert.equal(free.layer, "purchase");
  assert.equal(free.canReadBody, false);
  const preview = composeLessonAvailability({
    commercialCanRead: true,
    isPreviewLesson: true,
    pedagogical: locked,
  });
  assert.equal(preview.layer, "preview");
});

test("paid student still follows normal progression gates", () => {
  const locked = checkLessonAccess(catalog[2], catalog, {}, { completed: {} });
  const paid = composeStaffAwareLessonAccess({
    user: student,
    view: "override",
    commercialCanRead: true,
    pedagogical: locked,
  });
  assert.equal(paid.layer, "progression");
  assert.equal(paid.canReadBody, false);
});

test("coach override does not create purchase, entitlement, or progression side effects", () => {
  assert.equal(staffOverrideCreatesPurchase(), false);
  assert.equal(staffOverrideCreatesEntitlement(), false);
  assert.equal(staffOverrideCreatesProgression(), false);
});

test("coach evaluator test activity is distinguishable from genuine student attempts", () => {
  assert.equal(attemptSourceForUser(coach), STAFF_TEST_ATTEMPT_SOURCE);
  assert.equal(attemptSourceForUser(student), "student");
  assert.equal(isGenuineStudentAttempt({ source: STAFF_TEST_ATTEMPT_SOURCE, user_id: coach.id }), false);
  assert.equal(isGenuineStudentAttempt({ source: "student", user_id: student.id }), true);
  assert.equal(isGenuineStudentAttempt({ source: "student", user_id: coach.id }, [coach.id]), false);
});

test("existing Coach tools remain staff-only and ordinary students cannot obtain staff override", () => {
  assert.equal(coachMayUseInviteEndpoints(coach), true);
  assert.equal(coachMayUseInviteEndpoints(student), false);
  assert.equal(staffOverrideApplies(student, "override"), false);
  assert.equal(isCoachAccount(student), false);
  assert.equal(staffOverrideApplies(coach, "student_gates"), false);
});

test("deployment sends no invitation or email", () => {
  assert.equal(AUTO_SEND_WAITLIST_ON_DEPLOY, false);
  assert.equal(wouldSendInvitationsOnDeploy(), false);
});
