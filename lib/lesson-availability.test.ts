import test from "node:test";
import assert from "node:assert/strict";
import { checkLessonAccess } from "./accessControl";
import {
  composeLessonAvailability,
  shouldShowBuyCourseCta,
  shouldShowEnrolledAccess,
} from "./lesson-availability";

const catalog = [
  { id: "task-1", title: "Task 1", requires_submission: true },
  { id: "task-2", title: "Task 2", prereq_lesson_id: "task-1" },
  { id: "video-2", title: "Later video", prereq_lesson_id: "video-1" },
  { id: "video-1", title: "First video" },
];

test("full entitlement still withholds a pedagogically locked lesson", () => {
  const pedagogical = checkLessonAccess(catalog[1], catalog, {}, { completed: {} });
  const composed = composeLessonAvailability({ commercialCanRead: true, pedagogical });
  assert.equal(composed.layer, "progression");
  assert.equal(composed.canReadBody, false);
  assert.equal(composed.access.reason === "purchase", false);
  assert.match(composed.access.reason || "", /submission/i);
});

test("a designated preview lesson opens even when progression is locked", () => {
  const pedagogical = checkLessonAccess(catalog[1], catalog, {}, { completed: {} });
  const composed = composeLessonAvailability({
    commercialCanRead: true,
    isPreviewLesson: true,
    pedagogical,
  });
  assert.equal(composed.layer, "preview");
  assert.equal(composed.canReadBody, true);
  assert.equal(composed.access.isLocked, false);
});

test("free preview of a paid lesson stays on the purchase layer", () => {
  const composed = composeLessonAvailability({
    commercialCanRead: false,
    pedagogical: { isLocked: true, reason: "Finish Task 1 first" },
  });
  assert.equal(composed.layer, "purchase");
  assert.equal(composed.canReadBody, false);
  assert.equal(composed.access.reason, "purchase");
});

test("full entitlement plus an open progression gate can read the body", () => {
  const pedagogical = checkLessonAccess(
    catalog[1],
    catalog,
    { "task-1": { student_id: "s1", lesson_id: "task-1", body: "done", link_url: "", status: "submitted" } },
    { completed: { "task-1": true } }
  );
  const composed = composeLessonAvailability({ commercialCanRead: true, pedagogical });
  assert.equal(composed.layer, "open");
  assert.equal(composed.canReadBody, true);
  assert.equal(composed.access.isLocked, false);
});

test("Task 2 assignment stays locked until extra reading tools are complete", () => {
  const assignment = {
    id: "ch12-l15",
    title: "Task 2 - Question & Submission",
    extra_prereq_lesson_ids: ["ch12-skim", "ch12-mopane"],
  };
  const tools = [
    assignment,
    { id: "ch12-skim", title: "Skimming" },
    { id: "ch12-mopane", title: "Mopane" },
  ];
  const locked = checkLessonAccess(assignment, tools, {}, { completed: { "ch12-skim": true } });
  assert.equal(locked.isLocked, true);
  assert.match(locked.reason || "", /Mopane/);
  const open = checkLessonAccess(assignment, tools, {}, { completed: { "ch12-skim": true, "ch12-mopane": true } });
  assert.equal(open.isLocked, false);
});

test("completion-only prereqs stay locked when the student has no progress yet", () => {
  const locked = checkLessonAccess(catalog[2], catalog, {}, { completed: {} });
  assert.equal(locked.isLocked, true);
  assert.match(locked.reason || "", /Finish First video/);
});

test("dashboard buy CTA follows entitlement, not a stale sales card", () => {
  assert.equal(shouldShowBuyCourseCta("free_preview"), true);
  assert.equal(shouldShowBuyCourseCta("full"), false);
  assert.equal(shouldShowBuyCourseCta("staff"), false);
  assert.equal(shouldShowBuyCourseCta(null), false);
  assert.equal(shouldShowBuyCourseCta("none"), false);
  assert.equal(shouldShowEnrolledAccess("full"), true);
  assert.equal(shouldShowEnrolledAccess("free_preview"), false);
  assert.equal(shouldShowEnrolledAccess("full", true), false);
});
