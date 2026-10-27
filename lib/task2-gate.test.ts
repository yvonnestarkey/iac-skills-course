import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TASK_2_ASSIGNMENT_FALLBACK_ID,
  findTask2Assignment,
  hasTask2Submission,
  task2AssignmentFromOutline,
} from "./task2-gate";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch12",
    title: "Task 2 - Planning your Case Study & Required",
    lessons: [
      { id: "ch12-l1", title: "Intro", type: "video" },
      { id: "ch12-l15", title: "Task 2 - Question & Submission", type: "assignment", requires_submission: true },
      { id: "ch12-l16", title: "DIY Task 2", type: "assignment" },
    ],
  },
];

test("Task 2 assignment is the Question & Submission lesson, not DIY", () => {
  const found = findTask2Assignment(outline);
  assert.equal(found?.lessonId, "ch12-l15");
  assert.equal(task2AssignmentFromOutline([]).lessonId, TASK_2_ASSIGNMENT_FALLBACK_ID);
});

test("Reading & RTFQ practice unlocks from the Task 2 submission only", () => {
  assert.equal(hasTask2Submission({}, outline), false);
  assert.equal(hasTask2Submission({ "ch12-l15": { body: "", link_url: "" } }, outline), false);
  assert.equal(
    hasTask2Submission({ "ch12-l15": { body: "", link_url: "https://cdn.example/task2.pdf" } }, outline),
    true
  );
  assert.equal(hasTask2Submission({ "ch12-l16": { body: "DIY notes", link_url: "" } }, outline), false);
});
