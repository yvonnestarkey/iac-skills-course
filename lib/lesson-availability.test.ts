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
  assert.equal(shouldShowEnrolledAccess("full"), true);
  assert.equal(shouldShowEnrolledAccess("free_preview"), false);
  assert.equal(shouldShowEnrolledAccess("full", true), false);
});
