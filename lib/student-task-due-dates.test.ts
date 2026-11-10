import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApproxDuration,
  taskDueItemsFromOutline,
} from "./student-task-due-dates";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [
      { id: "ch10-l1", title: "L1", type: "video", duration_minutes: 60 },
      { id: "ch10-l2", title: "L2", type: "reading", duration_minutes: 240 },
    ],
  },
  {
    id: "ch13",
    title: "Task 3 - Discussion Questions",
    lessons: [{ id: "ch13-l1", title: "L1", type: "video", duration_minutes: 90 }],
  },
  {
    id: "ch14",
    title: "Task 3 Extra - Discussion Questions",
    lessons: [{ id: "ch14-l1", title: "DIY", type: "assignment", duration_minutes: 120 }],
  },
  {
    id: "ch17",
    title: "Task 5 Extra - Advanced Structuring Question",
    lessons: [{ id: "ch17-l1", title: "Extra", type: "video", duration_minutes: 45 }],
  },
  {
    id: "ch19",
    title: "Task - Sim Exam 1",
    lessons: [{ id: "ch19-l1", title: "Sim", type: "assignment", duration_minutes: 180 }],
  },
];

test("Task due rows follow the dashboard list and use chapter durations", () => {
  const items = taskDueItemsFromOutline(outline);
  assert.deepEqual(
    items.map((item) => item.label),
    ["Task 1", "Task 2", "Task 3", "Task 3DIY", "Task 4", "Task 5", "Task 5Extra", "Task 6", "Sim Exam"]
  );
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.equal(byId["task-1"].minutes, 300);
  assert.equal(byId["task-1"].approx, "Approx 5 hours");
  assert.equal(byId["task-3"].minutes, 90);
  assert.equal(byId["task-3-diy"].minutes, 120);
  assert.equal(byId["task-5-extra"].minutes, 45);
  assert.equal(byId["sim-exam"].minutes, 180);
  assert.equal(byId["task-2"].minutes, 0);
  assert.equal(byId["task-1"].firstLessonId, "ch10-l1");
});

test("approx duration rounds to half hours", () => {
  assert.equal(formatApproxDuration(0), "Approx —");
  assert.equal(formatApproxDuration(20), "Approx 20 min");
  assert.equal(formatApproxDuration(60), "Approx 1 hour");
  assert.equal(formatApproxDuration(90), "Approx 1.5 hours");
  assert.equal(formatApproxDuration(300), "Approx 5 hours");
});
