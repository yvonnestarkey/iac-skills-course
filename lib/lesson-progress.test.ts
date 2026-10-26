import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VIDEO_COMPLETE_PERCENT,
  assembleStudentProgress,
  buildLessonEngagement,
  describeProgressReasons,
  watchedEnough,
} from "./lesson-progress";

test("80 percent watched counts as complete", () => {
  assert.equal(watchedEnough(79), false);
  assert.equal(watchedEnough(VIDEO_COMPLETE_PERCENT), true);
  const watched = buildLessonEngagement("ch1-l1", { user_id: "u1", lesson_id: "ch1-l1", video_percent: 82 });
  assert.equal(watched.completed, true);
  assert.deepEqual(watched.reasons, ["watched"]);
});

test("a submission counts as complete even without a progress row", () => {
  const submitted = buildLessonEngagement("ch2-l4", null, true);
  assert.equal(submitted.opened, true);
  assert.equal(submitted.completed, true);
  assert.deepEqual(submitted.reasons, ["submitted"]);
  assert.equal(describeProgressReasons(submitted.reasons), "Submitted work");
});

test("an opened lesson without watch or work stays incomplete", () => {
  const opened = buildLessonEngagement("ch3-l1", {
    user_id: "u1",
    lesson_id: "ch3-l1",
    completed: false,
    updated_at: "2026-10-01T10:00:00.000Z",
    notes: "started watching",
  });
  assert.equal(opened.opened, true);
  assert.equal(opened.completed, false);
  assert.equal(opened.hasNotes, true);
  assert.equal(describeProgressReasons(opened.reasons), "Opened only");
});

test("coach roster merges marked complete, watch, and submissions", () => {
  const bundle = assembleStudentProgress({
    lessonIds: ["ch1-l1", "ch1-l2", "ch2-l1", "draft-l1"],
    progress: [
      { user_id: "anna", lesson_id: "ch1-l1", completed: true },
      { user_id: "anna", lesson_id: "ch1-l2", completed: false, video_percent: 91 },
      { user_id: "anna", lesson_id: "gone", completed: true },
    ],
    submissions: [{ student_id: "anna", lesson_id: "ch2-l1" }, { student_id: "ben", lesson_id: "ch1-l1" }],
  });

  assert.deepEqual(bundle.byUser.anna.completed.sort(), ["ch1-l1", "ch1-l2", "ch2-l1"]);
  assert.equal(bundle.byUser.anna.opened.includes("ch1-l1"), true);
  assert.equal(bundle.byUser.anna.completed.includes("gone"), false);
  assert.deepEqual(bundle.byUser.ben.completed, ["ch1-l1"]);
  assert.deepEqual(bundle.byUser.ben.opened, ["ch1-l1"]);
});
