import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TASK_1_ASSIGNMENT_FALLBACK_ID,
  TASK_1_START_FALLBACK_ID,
  findTask1Assignment,
  hasTask1Submission,
  task1AssignmentFromOutline,
  task1StartFromOutline,
} from "./task1-gate";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [
      { id: "ch10-l1", title: "L1 - What will we cover in Task 1?", type: "video" },
      { id: "ch10-l7", title: "Task 1 - Question & Submission", type: "assignment", requires_submission: true },
      { id: "ch10-l8", title: "Task 1 DIY", type: "assignment" },
    ],
  },
];

test("Task 1 assignment is the Question & Submission lesson, not DIY", () => {
  const found = findTask1Assignment(outline);
  assert.equal(found?.lessonId, "ch10-l7");
  assert.equal(task1AssignmentFromOutline([]).lessonId, TASK_1_ASSIGNMENT_FALLBACK_ID);
});

test("Task 1 start is L1 of the chapter, not the assignment", () => {
  assert.equal(task1StartFromOutline(outline).lessonId, "ch10-l1");
  assert.equal(task1StartFromOutline(outline).lessonTitle, "L1 - What will we cover in Task 1?");
  assert.equal(task1StartFromOutline([]).lessonId, TASK_1_START_FALLBACK_ID);
});

test("Evaluator unlocks from the Task 1 submission record only", () => {
  assert.equal(hasTask1Submission({}, outline), false);
  assert.equal(hasTask1Submission({ "ch10-l7": { body: "", link_url: "" } }, outline), false);
  assert.equal(
    hasTask1Submission({ "ch10-l7": { body: "", link_url: "https://cdn.example/task1.pdf" } }, outline),
    true
  );
  assert.equal(hasTask1Submission({ "ch10-l8": { body: "DIY notes", link_url: "" } }, outline), false);
});
