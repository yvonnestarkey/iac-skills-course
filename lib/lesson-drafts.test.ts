import assert from "node:assert/strict";
import test from "node:test";
import { asDraftFlag, canViewDraftLessons, isDraftLesson, publishedOutline } from "./lesson-drafts";
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
  user_metadata: {},
  app_metadata: {},
});

const outline = [
  {
    id: "ch1",
    title: "Chapter 1",
    lessons: [
      { id: "live-1", title: "Published", type: "video" as const },
      { id: "draft-1", title: "Work in progress", type: "reading" as const, is_draft: true },
    ],
  },
];

test("only explicit draft lessons count as drafts", () => {
  assert.equal(asDraftFlag(true), true);
  assert.equal(asDraftFlag("true"), true);
  assert.equal(isDraftLesson({ is_draft: true }), true);
  assert.equal(isDraftLesson({ is_draft: false }), false);
  assert.equal(isDraftLesson({}), false);
});

test("published outline hides draft lessons from students", () => {
  const visible = publishedOutline(outline);
  assert.deepEqual(
    visible[0].lessons.map((lesson) => lesson.id),
    ["live-1"]
  );
});

test("coach view can see drafts; student gates and students cannot", () => {
  assert.equal(canViewDraftLessons(coach, "override"), true);
  assert.equal(canViewDraftLessons(coach, "student_gates"), false);
  assert.equal(canViewDraftLessons(coach, "student_gates", true), true);
  assert.equal(canViewDraftLessons(student, "override"), false);
  assert.equal(canViewDraftLessons(student, "override", true), false);
});
