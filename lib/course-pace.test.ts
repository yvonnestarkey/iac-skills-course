import assert from "node:assert/strict";
import test from "node:test";
import { courseStudyMinutes, estimateCourseFinish, formatCourseFinishDate } from "./course-pace";

test("course duration sums lesson minutes and completed study time", () => {
  const lessons = [
    { id: "a", type: "video" as const, duration_minutes: 60 },
    { id: "b", type: "reading" as const, duration_minutes: 120 },
    { id: "c", type: "assignment" as const, duration_minutes: 180 },
  ];
  assert.deepEqual(courseStudyMinutes(lessons, { a: true, b: true }), { total: 360, done: 180 });
});

test("pace estimate projects remaining duration from progress so far", () => {
  const estimate = estimateCourseFinish({
    today: "2026-11-10",
    startedOn: "2026-11-01",
    totalMinutes: 600,
    doneMinutes: 300,
  });
  assert.equal(estimate.date, "2026-11-19");
  assert.equal(estimate.message, "At your current pace, you'll complete the course on 19 November 2026.");
});

test("pace estimate waits for the first completed lesson", () => {
  const estimate = estimateCourseFinish({
    today: "2026-11-10",
    startedOn: "2026-11-01",
    totalMinutes: 600,
    doneMinutes: 0,
  });
  assert.equal(estimate.date, null);
  assert.match(estimate.message, /first lesson/i);
});

test("pace estimate recognises a finished course", () => {
  const estimate = estimateCourseFinish({
    today: "2026-11-10",
    startedOn: "2026-10-01",
    totalMinutes: 600,
    doneMinutes: 600,
  });
  assert.equal(estimate.message, "You've completed the course.");
});

test("finish date includes the month and year", () => {
  assert.equal(formatCourseFinishDate("2027-01-15"), "15 January 2027");
});
