import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApproxDuration,
  isTaskSubmitted,
  suggestedTaskDueDates,
  TASK_DUE_DEFINITIONS,
  taskDateToShow,
  taskDueItemsFromOutline,
  taskSubmittedOn,
} from "./student-task-due-dates";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [
      { id: "ch10-l1", title: "L1", type: "video", duration_minutes: 60 },
      { id: "ch10-l2", title: "L2", type: "reading", duration_minutes: 240 },
      { id: "ch10-l7", title: "Task 1 - Question & Submission", type: "assignment", duration_minutes: 30 },
      { id: "ch10-l8", title: "Task 1 DIY", type: "assignment", duration_minutes: 20 },
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
  assert.equal(byId["task-1"].minutes, 350);
  assert.equal(byId["task-1"].approx, "Approx 6 hours");
  assert.equal(byId["task-3"].minutes, 90);
  assert.equal(byId["task-3-diy"].minutes, 120);
  assert.equal(byId["task-5-extra"].minutes, 45);
  assert.equal(byId["sim-exam"].minutes, 180);
  assert.equal(byId["task-2"].minutes, 0);
  assert.equal(byId["task-1"].firstLessonId, "ch10-l1");
  assert.equal(byId["task-1"].assignmentLessonId, "ch10-l7");
  assert.equal(byId["task-3-diy"].assignmentLessonId, "ch14-l1");
  assert.equal(byId["sim-exam"].assignmentLessonId, "ch19-l1");
});

test("submitted Tasks use the main assignment, not the DIY extra in Task 1", () => {
  const items = taskDueItemsFromOutline(outline);
  const task1 = items.find((item) => item.id === "task-1");
  assert.equal(isTaskSubmitted(task1!, { "ch10-l8": { body: "DIY only" } }), false);
  assert.equal(isTaskSubmitted(task1!, { "ch10-l7": { body: "Submitted Task 1" } }), true);
});

test("completed Tasks show the submission date instead of the planned due date", () => {
  const items = taskDueItemsFromOutline(outline);
  const task1 = items.find((item) => item.id === "task-1")!;
  const planned = "2026-11-15";
  assert.equal(taskSubmittedOn(task1, {}), null);
  assert.deepEqual(taskDateToShow(task1, {}, planned), { date: planned, kind: "due" });
  assert.equal(
    taskSubmittedOn(task1, { "ch10-l7": { body: "Submitted Task 1", submitted_at: "2026-09-21T15:00:00.000Z" } }),
    "2026-09-21"
  );
  assert.deepEqual(
    taskDateToShow(
      task1,
      { "ch10-l7": { body: "Submitted Task 1", submitted_at: "2026-09-21T15:00:00.000Z" } },
      planned
    ),
    { date: "2026-09-21", kind: "submitted" }
  );
  assert.equal(
    taskSubmittedOn(task1, { "ch10-l7": { body: "Submitted Task 1", submitted_at: "2026-09-21T22:30:00.000Z" } }),
    "2026-09-22"
  );
  assert.equal(taskSubmittedOn(task1, { "ch10-l8": { body: "DIY", submitted_at: "2026-09-21T15:00:00.000Z" } }), null);
  assert.deepEqual(
    taskDateToShow(task1, { "ch10-l7": { body: "Submitted Task 1" } }, planned),
    { date: null, kind: "submitted" }
  );
});

test("new students get a Task due every 5 days from registration", () => {
  const dates = suggestedTaskDueDates({
    today: "2026-11-10",
    registeredOn: "2026-11-10",
    items: TASK_DUE_DEFINITIONS.map((item) => ({ id: item.id })),
  });
  assert.equal(dates["task-1"], "2026-11-15");
  assert.equal(dates["task-2"], "2026-11-20");
  assert.equal(dates["task-3"], "2026-11-25");
  assert.equal(dates["sim-exam"], "2026-12-25");
});

test("current students get the next incomplete Task in 3 days, then every 5 days", () => {
  const dates = suggestedTaskDueDates({
    today: "2026-11-10",
    registeredOn: "2026-09-01",
    items: [
      { id: "task-1", completed: true },
      { id: "task-2", completed: true },
      { id: "task-3", completed: false },
      { id: "task-3-diy", completed: false },
      { id: "task-4", completed: false },
    ],
  });
  assert.equal(dates["task-1"], undefined);
  assert.equal(dates["task-2"], undefined);
  assert.equal(dates["task-3"], "2026-11-13");
  assert.equal(dates["task-3-diy"], "2026-11-18");
  assert.equal(dates["task-4"], "2026-11-23");
});

test("approx duration rounds to half hours", () => {
  assert.equal(formatApproxDuration(0), "Approx —");
  assert.equal(formatApproxDuration(20), "Approx 20 min");
  assert.equal(formatApproxDuration(60), "Approx 1 hour");
  assert.equal(formatApproxDuration(90), "Approx 1.5 hours");
  assert.equal(formatApproxDuration(300), "Approx 5 hours");
});
