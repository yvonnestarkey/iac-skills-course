import assert from "node:assert/strict";
import test from "node:test";
import { missedCohortAnnouncements } from "./notification-catchup";

const liveSession = {
  kind: "announcement",
  audience: "cohort",
  title: "Live Session - 20 October",
  message: "Our first live session is almost here.",
  createdAt: "2026-10-13T13:00:00.000Z",
};

test("late joiners receive earlier cohort announcements they missed", () => {
  const missed = missedCohortAnnouncements({
    studentId: "new-student",
    cohort: "jan27",
    own: [],
    others: [
      { ...liveSession, userId: "a", cohort: "jan27" },
      { ...liveSession, userId: "b", cohort: "jan27" },
    ],
  });
  assert.equal(missed.length, 1);
  assert.equal(missed[0].title, liveSession.title);
});

test("one-to-one notes and assignment feedback are not copied to later joiners", () => {
  const missed = missedCohortAnnouncements({
    studentId: "new-student",
    cohort: "jan27",
    own: [],
    others: [
      {
        userId: "a",
        cohort: "jan27",
        kind: "announcement",
        audience: "student",
        title: "Welcome Nyasham",
        message: "Thanks for completing onboarding.",
        createdAt: "2026-10-13T11:14:00.000Z",
      },
      {
        userId: "a",
        cohort: "jan27",
        kind: "assignment_feedback",
        title: "Assignment feedback",
        message: "Please resubmit Task 1.",
        createdAt: "2026-10-12T09:00:00.000Z",
      },
    ],
  });
  assert.equal(missed.length, 0);
});

test("a student who already has the announcement does not get a duplicate", () => {
  const missed = missedCohortAnnouncements({
    studentId: "new-student",
    cohort: "jan27",
    own: [{ ...liveSession, userId: "new-student", cohort: "jan27" }],
    others: [
      { ...liveSession, userId: "a", cohort: "jan27" },
      { ...liveSession, userId: "b", cohort: "jan27" },
    ],
  });
  assert.equal(missed.length, 0);
});
