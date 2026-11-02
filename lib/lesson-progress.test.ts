import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VIDEO_COMPLETE_PERCENT,
  activityLevel,
  assembleStudentProgress,
  buildLessonEngagement,
  describeProgressReasons,
  watchedEnough,
} from "./lesson-progress";
import {
  activityColumnsFromOutline,
  currentActivityPosition,
  engagementHeat,
  lastCourseVisitAt,
  lastCourseVisitLabel,
} from "./activity-grid";

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

test("activity colours treat a brief open as red and mid-watch as yellow", () => {
  assert.equal(activityLevel(undefined), "none");
  assert.equal(
    activityLevel(buildLessonEngagement("ch1-l1", { user_id: "u1", lesson_id: "ch1-l1", completed: false, video_percent: 8 })),
    "click"
  );
  assert.equal(
    activityLevel(buildLessonEngagement("ch1-l1", { user_id: "u1", lesson_id: "ch1-l1", completed: false, video_percent: 52 })),
    "partial"
  );
  assert.equal(
    activityLevel(buildLessonEngagement("ch1-l1", { user_id: "u1", lesson_id: "ch1-l1", completed: true })),
    "complete"
  );
});

test("current activity is the next incomplete lesson after the last complete one", () => {
  const columns = activityColumnsFromOutline([
    {
      id: "ch1",
      title: "S1 Start",
      lessons: [
        { id: "a", title: "One", type: "video" },
        { id: "b", title: "Two", type: "video" },
        { id: "c", title: "Three", type: "video" },
      ],
    },
  ]);
  const position = currentActivityPosition(columns, [
    buildLessonEngagement("a", { user_id: "u1", lesson_id: "a", completed: true }),
    buildLessonEngagement("b", { user_id: "u1", lesson_id: "b", completed: false, video_percent: 12 }),
  ]);
  assert.equal(position.last?.id, "b");
  assert.equal(position.current?.id, "b");
  assert.equal(position.current?.chapterLabel, "S1");
});

test("name-cell heat is red with no work and green when lessons are complete", () => {
  const columns = [{ id: "a" }, { id: "b" }];
  const none = engagementHeat(columns, {});
  assert.equal(none.score, 0);
  assert.equal(none.complete, 0);
  assert.match(none.background, /^hsl\(0 /);

  const done = engagementHeat(columns, {
    a: buildLessonEngagement("a", { user_id: "u1", lesson_id: "a", completed: true }),
    b: buildLessonEngagement("b", { user_id: "u1", lesson_id: "b", completed: true }),
  });
  assert.equal(done.score, 1);
  assert.equal(done.complete, 2);
  assert.match(done.background, /^hsl\(142 /);

  const mixed = engagementHeat(columns, {
    a: buildLessonEngagement("a", { user_id: "u1", lesson_id: "a", completed: true }),
  });
  assert.ok(mixed.score > none.score && mixed.score < done.score);
});

test("last course visit prefers a later lesson open over profile last-active", () => {
  assert.equal(lastCourseVisitAt("2026-10-01", {}), "2026-10-01");
  assert.equal(
    lastCourseVisitAt("2026-10-01", {
      a: buildLessonEngagement("a", {
        user_id: "u1",
        lesson_id: "a",
        last_opened_at: "2026-11-01T08:00:00.000Z",
      }),
    }),
    "2026-11-01T08:00:00.000Z"
  );
  assert.equal(lastCourseVisitLabel(null).text, "unknown");
  assert.equal(lastCourseVisitLabel("2026-11-02").text.length > 0, true);
});
